// TV account actions — Nivra Core & Nivra OneView CS
// Module 29 hardening (F29-1 → F29-19) — Reference: Module 28 (Internet)
//
// Actions:
//   - change_plan
//   - add_themed_pack
//   - remove_themed_pack
//   - purchase_vod
//   - terminal_action  (reboot / identify / factory_reset / firmware_push / deactivate / reactivate)
//   - set_parental
//   - set_channels
//   - approve_channel_selection   (staff confirm pending client request)
//   - reject_channel_selection    (staff cancel pending client request)
//
// Hardening:
//   - F29-1: Ownership assertion client_user_id ↔ profile + account_id ↔ client
//   - F29-2: Per-action ALLOWED_ROLES (change_plan, packs, vod, terminal, parental, channels)
//   - F29-3/F29-4: All channel_selections mutations routed here (no direct frontend writes),
//                  scoped by account_id where provided
//   - F29-5: Idempotency replay detection via admin_audit_log
//   - F29-6: Global anti-flood 20 mutations / 60 s per staff user
//   - F29-7: billing_subscriptions.plan_name synced on change_plan
//   - F29-8: Plan validated against public.services (TV)
//   - F29-9: addon_code validated against channel_packages / tv_packs (server-side canonical)
//   - F29-10: tv_parental_controls upsert on (user_id, account_id) — schema updated
//   - F29-11: Idempotency keys treated as opaque strings (stability enforced by callers)
//   - F29-12: Motifs required (≥ 5 chars std, ≥ 10 for critical terminal actions)
//   - F29-13: actor_role propagated to audit/activity/notes
//   - F29-14: metadata.simulated=true on ALL actions
//   - F29-15: reads scoped by account_id where provided (client responsibility)
//   - F29-16: Normalized error codes (UNAUTHORIZED, FORBIDDEN_ROLE, CROSS_CLIENT_TARGET, …)
//   - F29-17: PIN hashed with per-record salt + pepper (env)
//   - F29-18: purchase_vod payment_reference forced server-side
//   - F29-19: remove_themed_pack validates account_id scope
//
// No real operator provisioning is triggered.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkStaffAuth } from "../_shared/adminAuth.ts";
import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
import { writeAccountJournal } from "../_shared/writeAccountJournal.ts";

// Minute bucket in base36 — reserved as a complement to a stable business
// identity for actions with no natural per-write entity id (e.g. parental
// controls upsert scoped on (user_id, account_id)). Never used alone.
function isoMinuteBucket36(d: Date = new Date()): string {
  return Math.floor(d.getTime() / 60_000).toString(36);
}


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action =
  | "change_plan"
  | "add_themed_pack"
  | "remove_themed_pack"
  | "purchase_vod"
  | "terminal_action"
  | "set_parental"
  | "set_channels"
  | "approve_channel_selection"
  | "reject_channel_selection";

interface Body {
  action: Action;
  client_user_id: string;
  account_id?: string | null;
  subscription_id?: string | null;
  reason?: string | null;
  idempotency_key?: string | null;

  // change_plan
  previous_plan_name?: string;
  previous_monthly_price?: number;
  new_plan_name?: string;
  new_monthly_price?: number;
  change_type?: "upgrade" | "downgrade" | "lateral";
  effective_date?: string;

  // add/remove themed pack
  addon_id?: string;
  pack_id?: string;         // preferred: server resolves from channel_packages/tv_packs
  addon_code?: string;      // legacy: still accepted but validated against catalogue
  addon_name?: string;
  addon_type?: string;
  monthly_price?: number;

  // VOD
  title?: string;
  content_type?: "movie" | "event" | "ppv" | "series" | "rental";
  amount?: number;
  currency?: string;
  payment_method?: string;

  // terminal
  terminal_serial?: string;
  action_type?: "reboot" | "identify" | "factory_reset" | "firmware_push" | "deactivate" | "reactivate";

  // parental
  enabled?: boolean;
  max_rating?: "G" | "PG" | "PG-13" | "R" | "NC-17" | "adult_blocked";
  pin?: string;
  blocked_channels?: string[];
  time_restrictions?: Record<string, unknown>;

  // set_channels
  channel_ids?: string[];
  notes?: string;

  // approve/reject_channel_selection
  selection_id?: string;
}

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const err = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) =>
  json(status, { error_code: code, error: message, ...extra });

// F29-2 — Per-action ALLOWED_ROLES
const ROLES_CHANGE_PLAN = new Set([
  "admin", "super_admin", "supervisor", "employee", "billing_admin", "support",
]);
const ROLES_PACK = new Set([
  "admin", "super_admin", "supervisor", "employee", "billing_admin", "support",
]);
const ROLES_VOD = new Set([
  "admin", "super_admin", "supervisor", "employee", "billing_admin",
]);
const ROLES_TERMINAL_STD = new Set([
  "admin", "super_admin", "supervisor", "employee", "support", "techops",
]);
const ROLES_TERMINAL_CRITICAL = new Set([
  "admin", "super_admin", "supervisor", "techops",
]);
const ROLES_PARENTAL = new Set([
  "admin", "super_admin", "supervisor", "employee", "support",
]);
const ROLES_CHANNELS = new Set([
  "admin", "super_admin", "supervisor", "employee", "support",
]);

const TERMINAL_LABELS: Record<string, { label: string; critical: boolean }> = {
  reboot:         { label: "Redémarrage du terminal TV", critical: false },
  identify:       { label: "Identification du terminal TV", critical: false },
  factory_reset:  { label: "Réinitialisation usine du terminal TV", critical: true },
  firmware_push:  { label: "Mise à jour micrologiciel du terminal TV", critical: false },
  deactivate:     { label: "Désactivation du terminal TV", critical: true },
  reactivate:     { label: "Réactivation du terminal TV", critical: false },
};

const fmtMoney = (n: number, currency = "CAD") => {
  try {
    return new Intl.NumberFormat("fr-CA", { style: "currency", currency }).format(n);
  } catch (_e) {
    return `${n.toFixed(2)} $`;
  }
};

// F29-17 — PIN hash with per-record salt + pepper
const PIN_PEPPER = Deno.env.get("PARENTAL_PIN_PEPPER") || "nivra_tv_pepper_v1";
const randomSalt = () => {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(b => b.toString(16).padStart(2, "0")).join("");
};
const hashPin = async (pin: string, salt: string) => {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}:${pin}:${PIN_PEPPER}`),
  );
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return err(405, "METHOD_NOT_ALLOWED", "Method not allowed");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return err(401, "UNAUTHORIZED", "Non autorisé");

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return err(401, "INVALID_SESSION", "Session invalide");

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const staffResult = await checkStaffAuth(admin, user.id);
  if (!staffResult.isStaff) return err(403, "FORBIDDEN_ROLE", "Action réservée au personnel autorisé");

  // F29-13 — actor_role réel
  const callerRoles = staffResult.roles || [];
  const primaryRole = staffResult.callerRole || callerRoles[0] || "staff";
  const hasAnyRole = (allowed: Set<string>) => callerRoles.some((r) => allowed.has(r));

  let body: Body;
  try { body = await req.json(); }
  catch { return err(400, "INVALID_INPUT", "Corps JSON invalide"); }

  const { action, client_user_id } = body;
  if (!action || !client_user_id) {
    return err(400, "INVALID_INPUT", "Champs requis: action, client_user_id");
  }

  // F29-1 — Ownership: client_user_id must resolve to a profile
  const { data: profile } = await admin
    .from("profiles")
    .select("id, user_id, email, first_name, last_name, account_number")
    .eq("user_id", client_user_id)
    .maybeSingle();
  if (!profile) return err(404, "NOT_FOUND", "Client introuvable");

  // F29-1 — account_id must belong to this client
  if (body.account_id) {
    const { data: acct } = await admin
      .from("accounts")
      .select("id, client_id")
      .eq("id", body.account_id)
      .maybeSingle();
    if (!acct) return err(404, "NOT_FOUND", "Compte introuvable");
    if (acct.client_id !== client_user_id) {
      return err(403, "CROSS_CLIENT_TARGET", "Compte n'appartient pas à ce client");
    }
  }

  const clientEmail = profile.email || null;
  const firstName = profile.first_name || "Client";

  const { data: callerProfile } = await admin
    .from("profiles")
    .select("first_name,last_name,email")
    .eq("user_id", user.id)
    .maybeSingle();
  const callerName =
    [callerProfile?.first_name, callerProfile?.last_name].filter(Boolean).join(" ") ||
    callerProfile?.email || "Personnel Nivra";

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  // F29-6 — Global anti-flood: 20 tv.* mutations / 60 s per staff user
  {
    const since60 = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin
      .from("admin_audit_log")
      .select("id", { count: "exact", head: true })
      .eq("admin_user_id", user.id)
      .like("action", "tv.%")
      .gte("created_at", since60);
    if ((count ?? 0) >= 20) {
      return err(429, "RATE_LIMIT", "Trop de requêtes — patientez 60 s");
    }
  }

  // F29-5 — Idempotency replay: same key seen in last 5 min → return prior result
  if (body.idempotency_key) {
    const since5 = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data: prior } = await admin
      .from("admin_audit_log")
      .select("id, action, details, created_at")
      .eq("admin_user_id", user.id)
      .like("action", "tv.%")
      .gte("created_at", since5)
      .contains("details", { idempotency_key: body.idempotency_key })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prior) {
      return json(200, {
        ok: true,
        replayed: true,
        idempotency_key: body.idempotency_key,
        original_action: prior.action,
        original_details: prior.details,
      });
    }
  }

  const audit = async (label: string, payload: Record<string, unknown>, before: Record<string, unknown> | null = null) => {
    try {
      await admin.from("admin_audit_log").insert({
        action: `tv.${label}`,
        admin_user_id: user.id,
        admin_email: callerProfile?.email ?? null,
        target_id: client_user_id,
        target_type: "client",
        ip_address: ip,
        details: {
          ...payload,
          idempotency_key: body.idempotency_key ?? null,
          module_tag: "module29_tv",
          actor_role: primaryRole,
          before_state: before,
          client_id: client_user_id,
          account_id: body.account_id ?? null,
          simulated: true,
        },
      });
    } catch (_e) { /* swallow */ }
  };

  const activity = async (
    eventKey: string,
    action_type: string,
    entity_id: string | null,
    entity_type: string,
    summary: string,
    after_data: Record<string, unknown> | null = null,
    before_data: Record<string, unknown> | null = null,
  ) => {
    try {
      await writeAccountJournal(admin, {
        targetTable: "client_activity_logs",
        eventKey,
        correlationId: body.idempotency_key ?? null,
        actor: {
          userId: user.id,
          role: primaryRole ?? "system",
          name: callerName ?? "system",
          email: callerProfile?.email ?? null,
        },
        payload: {
          client_id: client_user_id,
          actor_user_id: user.id,
          actor_name: callerName,
          actor_role: primaryRole,
          action_type,
          entity_type,
          entity_id,
          summary,
          before_data,
          after_data,
        },
      });
    } catch (_e) { /* swallow */ }
  };

  const sysNote = async (eventKey: string, body_text: string) => {
    try {
      await writeAccountJournal(admin, {
        targetTable: "client_internal_notes",
        eventKey,
        correlationId: body.idempotency_key ?? null,
        actor: {
          userId: user.id,
          role: primaryRole ?? "system",
          name: callerName ?? "system",
          email: callerProfile?.email ?? null,
        },
        payload: {
          client_id: client_user_id,
          note_type: "system",
          body: body_text,
          created_by_user_id: user.id,
          created_by_role: primaryRole,
          created_by_name: callerName,
        },
      });
    } catch (_e) { /* swallow */ }
  };


  const enqueueEmail = async (template: string, vars: Record<string, unknown>) => {
    if (!clientEmail) return;
    try {
      await enqueueCommunication(admin, {
      channel: "email",
      recipient: clientEmail,
      templateKey: template,
      priority: 0,
      idempotencyKey: `acct360:tv:${body.account_id ?? "na"}:${template}:${body.idempotency_key ?? body.__audit_reason ?? "default"}`,
      templateVars: { ...vars, first_name: firstName, to_email: clientEmail },
    });
    } catch (_e) { /* swallow */ }
  };

  const requireReason = (min: number): string | Response => {
    const s = typeof body.reason === "string" ? body.reason.trim() : "";
    if (s.length < min) {
      return err(400, "REASON_REQUIRED", `Motif requis (min. ${min} caractères)`);
    }
    return s;
  };

  const simulatedMeta = (extra: Record<string, unknown> = {}) => ({
    idempotency_key: body.idempotency_key ?? null,
    actor_role: primaryRole,
    simulated: true,
    ...extra,
  });

  try {
    switch (action) {
      // ============================================================
      case "change_plan": {
        if (!hasAnyRole(ROLES_CHANGE_PLAN)) {
          return err(403, "FORBIDDEN_ROLE", "Rôle insuffisant pour changer un forfait TV");
        }
        const new_plan_name = (body.new_plan_name || "").trim();
        const new_monthly_price = Number(body.new_monthly_price ?? 0);
        if (!new_plan_name) return err(400, "INVALID_INPUT", "new_plan_name requis");
        if (!Number.isFinite(new_monthly_price) || new_monthly_price < 0) {
          return err(400, "INVALID_INPUT", "new_monthly_price invalide");
        }
        const reasonRes = requireReason(5);
        if (reasonRes instanceof Response) return reasonRes;
        const reasonStr = reasonRes;

        // F29-8 — Validate against catalogue (public.services, category=TV)
        const { data: catalogue } = await admin
          .from("services")
          .select("id, name, price, status, is_active, category")
          .eq("category", "TV");
        const catalogueMatch = (catalogue || []).find(
          (s: any) =>
            String(s.name).toLowerCase().trim() === new_plan_name.toLowerCase() &&
            (s.is_active === true || s.status === "active"),
        );
        if (!catalogueMatch) {
          return err(400, "UNKNOWN_PLAN", `Forfait "${new_plan_name}" introuvable au catalogue TV`);
        }

        const change_type = body.change_type || "upgrade";
        if (!["upgrade", "downgrade", "lateral"].includes(change_type)) {
          return err(400, "INVALID_INPUT", "change_type invalide");
        }
        const effective_date = body.effective_date || new Date().toISOString().slice(0, 10);

        const before = {
          plan_name: body.previous_plan_name ?? null,
          monthly_price: body.previous_monthly_price ?? null,
        };

        const { data, error: insErr } = await admin
          .from("tv_plan_changes")
          .insert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            subscription_id: body.subscription_id ?? null,
            previous_plan_name: body.previous_plan_name ?? null,
            previous_monthly_price: body.previous_monthly_price ?? null,
            new_plan_name,
            new_monthly_price,
            change_type,
            effective_date,
            status: "completed",
            reason: reasonStr,
            performed_by: user.id,
            metadata: simulatedMeta(),
          })
          .select("id")
          .single();
        if (insErr) return err(500, "DB_ERROR", insErr.message);

        // F29-7 — sync subscriptions + billing_subscriptions
        let subscriptionUpdateOk = true;
        let subscriptionUpdateError: string | null = null;
        if (body.subscription_id) {
          const { error: subErr } = await admin
            .from("subscriptions")
            .update({
              plan_name: new_plan_name,
              monthly_price: new_monthly_price,
              amount: new_monthly_price,
            })
            .eq("id", body.subscription_id);
          if (subErr) {
            subscriptionUpdateOk = false;
            subscriptionUpdateError = subErr.message;
          }
        }
        try {
          const { data: bc } = await admin
            .from("billing_customers")
            .select("id")
            .eq("user_id", client_user_id)
            .maybeSingle();
          if (bc?.id) {
            await admin
              .from("billing_subscriptions")
              .update({ plan_name: new_plan_name })
              .eq("customer_id", bc.id)
              .eq("status", "active");
          }
        } catch (_e) { /* non-blocking */ }

        if (!subscriptionUpdateOk) {
          await admin.from("billing_system_alerts").insert({
            alert_type: "tv_plan_change_orphaned",
            entity_type: "tv_plan_changes",
            entity_id: data.id,
            details: {
              plan_change_id: data.id,
              subscription_id: body.subscription_id,
              error: subscriptionUpdateError,
              client_user_id,
            },
          });
        }

        const after = {
          plan_change_id: data.id, plan_name: new_plan_name, monthly_price: new_monthly_price,
          change_type, effective_date,
        };
        await audit("change_plan", after, before);
        await activity(`tv:plan_change:${data.id}:activity`, "plan_change", data.id, "subscription",
          `Forfait TV: ${body.previous_plan_name || "—"} → ${new_plan_name} (${fmtMoney(new_monthly_price)})`,
          after, before);
        await sysNote(`tv:plan_change:${data.id}:note`, `[TV] Changement forfait — ${body.previous_plan_name || "—"} → ${new_plan_name} · ${fmtMoney(new_monthly_price)}/mois · ${change_type} · effectif ${effective_date}. Motif: ${reasonStr}`);
        await enqueueEmail("client_tv_plan_change", {
          previous_plan_name: body.previous_plan_name || "—",
          new_plan_name,
          new_monthly_price: fmtMoney(new_monthly_price),
          effective_date,
          change_type,
        });

        return json(200, { ok: true, plan_change_id: data.id });
      }

      // ============================================================
      case "add_themed_pack": {
        if (!hasAnyRole(ROLES_PACK)) {
          return err(403, "FORBIDDEN_ROLE", "Rôle insuffisant pour activer un bouquet TV");
        }
        const reasonRes = requireReason(5);
        if (reasonRes instanceof Response) return reasonRes;
        const reasonStr = reasonRes;

        // F29-9 — Resolve canonical pack from tv_packs / channel_packages
        let pack: { code: string; name: string; type: string; price: number } | null = null;
        if (body.pack_id) {
          const { data: tp } = await admin
            .from("tv_packs")
            .select("id, name, slug, category, discounted_price, is_active")
            .eq("id", body.pack_id)
            .maybeSingle();
          if (tp?.is_active) {
            pack = {
              code: `PACK_${String(tp.category || "themed").toUpperCase()}_${String(tp.slug || tp.id).slice(0, 32)}`,
              name: tp.name, type: tp.category || "themed_pack", price: Number(tp.discounted_price ?? 0),
            };
          } else {
            const { data: cp } = await admin
              .from("channel_packages")
              .select("id, name, category, discounted_price, is_active")
              .eq("id", body.pack_id)
              .maybeSingle();
            if (cp?.is_active) {
              pack = {
                code: `PACK_${String(cp.category || "themed").toUpperCase()}_${String(cp.id).slice(0, 8)}`,
                name: cp.name, type: cp.category || "themed_pack", price: Number(cp.discounted_price ?? 0),
              };
            }
          }
        } else if (body.addon_code) {
          // Legacy: verify code corresponds to a real pack by name
          const wantedName = (body.addon_name || "").trim();
          if (!wantedName) return err(400, "INVALID_INPUT", "addon_name requis avec addon_code");
          const [{ data: tp }, { data: cp }] = await Promise.all([
            admin.from("tv_packs").select("name, category, discounted_price, is_active").ilike("name", wantedName),
            admin.from("channel_packages").select("name, category, discounted_price, is_active").ilike("name", wantedName),
          ]);
          const row = (tp || []).find((r: any) => r.is_active) || (cp || []).find((r: any) => r.is_active);
          if (row) {
            pack = {
              code: body.addon_code,
              name: row.name,
              type: row.category || body.addon_type || "themed_pack",
              price: Number(row.discounted_price ?? body.monthly_price ?? 0),
            };
          }
        }
        if (!pack) {
          return err(400, "UNKNOWN_ADDON", "Bouquet introuvable au catalogue");
        }

        // F29-9 — reject duplicate active pack for same client/account
        const { data: dup } = await admin
          .from("tv_addon_subscriptions")
          .select("id")
          .eq("user_id", client_user_id)
          .eq("addon_code", pack.code)
          .eq("status", "active")
          .maybeSingle();
        if (dup) {
          return err(409, "DUPLICATE_ACTIVE", "Bouquet déjà actif pour ce client");
        }

        const { data, error: insErr } = await admin
          .from("tv_addon_subscriptions")
          .insert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            subscription_id: body.subscription_id ?? null,
            addon_code: pack.code,
            addon_name: pack.name,
            addon_type: pack.type,
            monthly_price: pack.price,
            status: "active",
            activated_by: user.id,
            metadata: simulatedMeta({ pack_id: body.pack_id ?? null }),
          })
          .select("id")
          .single();
        if (insErr) return err(500, "DB_ERROR", insErr.message);

        const after = { addon_id: data.id, addon_code: pack.code, addon_name: pack.name, monthly_price: pack.price };
        await audit("add_themed_pack", after);
        await activity(`tv:themed_pack:${data.id}:added:activity`, "service_add", data.id, "service",
          `Bouquet TV activé: ${pack.name} (${fmtMoney(pack.price)}/mois)`, after);
        await sysNote(`tv:themed_pack:${data.id}:added:note`, `[TV] Activation bouquet — ${pack.name} (${pack.code}) · ${fmtMoney(pack.price)}/mois. Motif: ${reasonStr}`);
        await enqueueEmail("client_tv_pack_change", {
          addon_name: pack.name, monthly_price: fmtMoney(pack.price), change_type: "activated",
        });

        return json(200, { ok: true, addon_id: data.id });
      }

      // ============================================================
      case "remove_themed_pack": {
        if (!hasAnyRole(ROLES_PACK)) {
          return err(403, "FORBIDDEN_ROLE", "Rôle insuffisant pour annuler un bouquet TV");
        }
        const reasonRes = requireReason(5);
        if (reasonRes instanceof Response) return reasonRes;
        const reasonStr = reasonRes;

        const addon_id = body.addon_id;
        if (!addon_id) return err(400, "INVALID_INPUT", "addon_id requis");

        const { data: existing, error: fetchErr } = await admin
          .from("tv_addon_subscriptions")
          .select("id, addon_name, monthly_price, status, user_id, account_id")
          .eq("id", addon_id)
          .maybeSingle();
        if (fetchErr) return err(500, "DB_ERROR", fetchErr.message);
        if (!existing) return err(404, "NOT_FOUND", "Bouquet introuvable");
        if (existing.user_id !== client_user_id) return err(403, "CROSS_CLIENT_TARGET", "Bouquet n'appartient pas à ce client");
        // F29-19 — enforce account scope when supplied
        if (body.account_id && existing.account_id && existing.account_id !== body.account_id) {
          return err(403, "CROSS_CLIENT_TARGET", "Bouquet n'appartient pas à ce compte");
        }
        if (existing.status !== "active") return err(409, "ALREADY_CANCELLED", "Bouquet déjà annulé");

        const { error: updErr } = await admin
          .from("tv_addon_subscriptions")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancelled_by: user.id,
            cancelled_reason: reasonStr,
          })
          .eq("id", addon_id);
        if (updErr) return err(500, "DB_ERROR", updErr.message);

        const after = { addon_id, addon_name: existing.addon_name };
        await audit("remove_themed_pack", after, { status: "active" });
        await activity("service_remove", addon_id, "service",
          `Bouquet TV annulé: ${existing.addon_name}`, after, { status: "active" });
        await sysNote(`[TV] Annulation bouquet — ${existing.addon_name}. Motif: ${reasonStr}`);
        await enqueueEmail("client_tv_pack_change", {
          addon_name: existing.addon_name,
          monthly_price: fmtMoney(Number(existing.monthly_price ?? 0)),
          change_type: "cancelled",
        });

        return json(200, { ok: true });
      }

      // ============================================================
      case "purchase_vod": {
        if (!hasAnyRole(ROLES_VOD)) {
          return err(403, "FORBIDDEN_ROLE", "Rôle insuffisant pour enregistrer un achat VOD");
        }
        const title = (body.title || "").trim();
        const amount = Number(body.amount ?? 0);
        if (!title) return err(400, "INVALID_INPUT", "title requis");
        if (!Number.isFinite(amount) || amount <= 0) return err(400, "INVALID_INPUT", "amount invalide");
        const reasonRes = requireReason(5);
        if (reasonRes instanceof Response) return reasonRes;
        const reasonStr = reasonRes;

        const content_type = body.content_type || "movie";
        const currency = body.currency || "CAD";
        const payment_method = body.payment_method || "on_invoice";
        // F29-18 — payment_reference forced server-side
        const payment_reference = `VOD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

        const { data, error: insErr } = await admin
          .from("tv_vod_purchases")
          .insert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            subscription_id: body.subscription_id ?? null,
            title,
            content_type,
            amount,
            currency,
            payment_method,
            payment_reference,
            status: "completed",
            performed_by: user.id,
            metadata: simulatedMeta(),
          })
          .select("id")
          .single();
        if (insErr) return err(500, "DB_ERROR", insErr.message);

        const after = { vod_id: data.id, title, amount, currency, payment_reference };
        await audit("purchase_vod", after);
        await activity("service_add", data.id, "service",
          `Achat VOD/PPV: ${title} (${fmtMoney(amount, currency)})`, after);
        await sysNote(`[TV] Achat VOD/PPV — ${title} (${content_type}) · ${fmtMoney(amount, currency)} · Réf: ${payment_reference}. Motif: ${reasonStr}`);
        await enqueueEmail("client_tv_vod_purchase", {
          title, content_type,
          amount: fmtMoney(amount, currency),
          payment_method, payment_reference,
        });

        return json(200, { ok: true, vod_id: data.id, payment_reference });
      }

      // ============================================================
      case "terminal_action": {
        const action_type = body.action_type;
        if (!action_type || !TERMINAL_LABELS[action_type]) {
          return err(400, "INVALID_INPUT", "action_type invalide");
        }
        const meta = TERMINAL_LABELS[action_type];
        const roleSet = meta.critical ? ROLES_TERMINAL_CRITICAL : ROLES_TERMINAL_STD;
        if (!hasAnyRole(roleSet)) {
          return err(403, "FORBIDDEN_ROLE", "Rôle insuffisant pour cette action terminal");
        }
        const minReason = meta.critical ? 10 : 5;
        const reasonRes = requireReason(minReason);
        if (reasonRes instanceof Response) return reasonRes;
        const reasonStr = reasonRes;

        // Anti-flood spécifique reboot (par terminal) préservé
        if (action_type === "reboot") {
          const since = new Date(Date.now() - 120_000).toISOString();
          let q = admin
            .from("tv_terminal_actions")
            .select("id, created_at")
            .eq("user_id", client_user_id)
            .eq("action_type", "reboot")
            .gte("created_at", since)
            .limit(1);
          if (body.terminal_serial) q = q.eq("terminal_serial", body.terminal_serial);
          const { data: recent } = await q;
          if (recent && recent.length > 0) {
            return err(429, "RATE_LIMIT", "Un reboot vient d'être demandé pour ce terminal. Réessayez dans quelques instants.");
          }
        }

        const { data, error: insErr } = await admin
          .from("tv_terminal_actions")
          .insert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            subscription_id: body.subscription_id ?? null,
            terminal_serial: body.terminal_serial ?? null,
            action_type,
            reason: reasonStr,
            status: "completed",
            performed_by: user.id,
            metadata: simulatedMeta({ critical: meta.critical }),
          })
          .select("id")
          .single();
        if (insErr) return err(500, "DB_ERROR", insErr.message);

        const after = { terminal_action_id: data.id, action_type, terminal_serial: body.terminal_serial ?? null, critical: meta.critical };
        await audit("terminal_action", after);
        await activity("equipment_change", data.id, "equipment",
          `${meta.label}${body.terminal_serial ? ` (SN ${body.terminal_serial})` : ""}`, after);
        await sysNote(`[TV] ${meta.label} — SN ${body.terminal_serial || "—"}. Motif: ${reasonStr}${meta.critical ? " [CRITIQUE]" : ""}`);
        await enqueueEmail("client_tv_terminal_action", {
          action_label: meta.label,
          terminal_serial: body.terminal_serial || "—",
          reason: reasonStr,
          is_critical: meta.critical ? "true" : "false",
        });

        return json(200, { ok: true, terminal_action_id: data.id });
      }

      // ============================================================
      case "set_parental": {
        if (!hasAnyRole(ROLES_PARENTAL)) {
          return err(403, "FORBIDDEN_ROLE", "Rôle insuffisant pour modifier le contrôle parental");
        }
        const reasonRes = requireReason(5);
        if (reasonRes instanceof Response) return reasonRes;
        const reasonStr = reasonRes;

        const enabled = !!body.enabled;
        const max_rating = body.max_rating || "PG-13";
        if (!["G","PG","PG-13","R","NC-17","adult_blocked"].includes(max_rating)) {
          return err(400, "INVALID_INPUT", "max_rating invalide");
        }
        const blocked_channels = Array.isArray(body.blocked_channels) ? body.blocked_channels.map(String).slice(0, 500) : [];
        const time_restrictions = body.time_restrictions ?? {};

        let pin_hash: string | null | undefined = undefined;
        let pin_salt: string | null | undefined = undefined;
        if (body.pin) {
          if (!/^\d{4,8}$/.test(body.pin)) {
            return err(400, "INVALID_INPUT", "NIP parental doit être 4 à 8 chiffres");
          }
          pin_salt = randomSalt();
          pin_hash = await hashPin(body.pin, pin_salt);
        }

        // F29-10 — Manual upsert scoped (user_id, account_id)
        const accountFilter = body.account_id ?? null;
        let existingQ = admin
          .from("tv_parental_controls")
          .select("id, enabled, max_rating, blocked_channels")
          .eq("user_id", client_user_id);
        existingQ = accountFilter
          ? existingQ.eq("account_id", accountFilter)
          : existingQ.is("account_id", null);
        const { data: existing } = await existingQ.maybeSingle();

        const basePayload: Record<string, unknown> = {
          user_id: client_user_id,
          account_id: accountFilter,
          enabled,
          max_rating,
          blocked_channels,
          time_restrictions,
          updated_by: user.id,
        };
        if (pin_hash !== undefined) {
          basePayload.pin_hash = `${pin_salt}:${pin_hash}`;
        }

        let opErr: any = null;
        if (existing) {
          const { error } = await admin
            .from("tv_parental_controls")
            .update(basePayload)
            .eq("id", existing.id);
          opErr = error;
        } else {
          const { error } = await admin
            .from("tv_parental_controls")
            .insert(basePayload);
          opErr = error;
        }
        if (opErr) return err(500, "DB_ERROR", opErr.message);

        const after = { enabled, max_rating, blocked_count: blocked_channels.length, pin_changed: !!body.pin };
        const before = existing
          ? { enabled: existing.enabled, max_rating: existing.max_rating, blocked_count: (existing.blocked_channels as any[])?.length ?? 0 }
          : null;
        await audit("set_parental", after, before);
        await activity("service_change", null, "service",
          `Contrôles parentaux TV — ${enabled ? "activés" : "désactivés"} (rating ${max_rating}, ${blocked_channels.length} chaîne(s))`,
          after, before);
        await sysNote(`[TV] Contrôles parentaux — ${enabled ? "activés" : "désactivés"} · rating=${max_rating} · bloquées=${blocked_channels.length}${body.pin ? " · NIP mis à jour" : ""}. Motif: ${reasonStr}`);
        await enqueueEmail("client_tv_parental_controls", {
          enabled: enabled ? "true" : "false",
          max_rating,
          blocked_count: String(blocked_channels.length),
          pin_changed: body.pin ? "true" : "false",
        });

        return json(200, { ok: true });
      }

      // ============================================================
      case "set_channels": {
        if (!hasAnyRole(ROLES_CHANNELS)) {
          return err(403, "FORBIDDEN_ROLE", "Rôle insuffisant pour modifier la sélection de chaînes");
        }
        const reasonRes = requireReason(5);
        if (reasonRes instanceof Response) return reasonRes;
        const reasonStr = reasonRes;

        const ids = Array.isArray(body.channel_ids) ? body.channel_ids.filter(Boolean) : [];
        if (ids.length === 0) return err(400, "INVALID_INPUT", "Aucune chaîne sélectionnée");

        const { data: chans, error: chErr } = await admin
          .from("tv_channels")
          .select("id,name,category,price")
          .in("id", ids)
          .eq("is_active", true);
        if (chErr) return err(500, "DB_ERROR", chErr.message);
        if (!chans || chans.length === 0) return err(400, "INVALID_INPUT", "Chaînes introuvables");
        if (chans.length !== ids.length) {
          return err(400, "INVALID_INPUT", "Certaines chaînes sont inconnues ou inactives");
        }

        const channelsJson = chans.map((c) => ({
          id: c.id, name: c.name, category: c.category, price: Number(c.price ?? 0),
        }));
        const total_price = channelsJson.reduce((s, c) => s + c.price, 0);

        const { data, error: insErr } = await admin
          .from("channel_selections")
          .insert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            channels: channelsJson,
            total_price,
            status: "confirmed",
            confirmed_at: new Date().toISOString(),
            confirmed_by: user.id,
            notes: body.notes ?? null,
          })
          .select("id")
          .single();
        if (insErr) return err(500, "DB_ERROR", insErr.message);

        const after = { selection_id: data.id, count: channelsJson.length, total_price };
        await audit("set_channels", after);
        await activity("channels_change", data.id, "service",
          `Chaînes TV mises à jour — ${channelsJson.length} chaîne(s) (${fmtMoney(total_price)})`,
          { ...after, channels: channelsJson.map((c) => c.name) });
        await sysNote(`[TV] Sélection chaînes — ${channelsJson.length} chaîne(s) · total ${fmtMoney(total_price)}. Motif: ${reasonStr}`);
        await enqueueEmail("client_tv_channels_updated", {
          channel_count: String(channelsJson.length),
          total_price: fmtMoney(total_price),
          channel_names: channelsJson.map((c) => c.name).slice(0, 20).join(", "),
        });

        return json(200, { ok: true, selection_id: data.id, total_price });
      }

      // ============================================================
      case "approve_channel_selection":
      case "reject_channel_selection": {
        if (!hasAnyRole(ROLES_CHANNELS)) {
          return err(403, "FORBIDDEN_ROLE", "Rôle insuffisant pour traiter une sélection de chaînes");
        }
        const approve = action === "approve_channel_selection";
        const minReason = approve ? 5 : 10;
        const reasonRes = requireReason(minReason);
        if (reasonRes instanceof Response) return reasonRes;
        const reasonStr = reasonRes;

        const selection_id = body.selection_id;
        if (!selection_id) return err(400, "INVALID_INPUT", "selection_id requis");

        const { data: sel, error: fErr } = await admin
          .from("channel_selections")
          .select("id, user_id, account_id, status, channels, total_price")
          .eq("id", selection_id)
          .maybeSingle();
        if (fErr) return err(500, "DB_ERROR", fErr.message);
        if (!sel) return err(404, "NOT_FOUND", "Sélection introuvable");
        if (sel.user_id !== client_user_id) return err(403, "CROSS_CLIENT_TARGET", "Sélection n'appartient pas à ce client");
        if (body.account_id && sel.account_id && sel.account_id !== body.account_id) {
          return err(403, "CROSS_CLIENT_TARGET", "Sélection n'appartient pas à ce compte");
        }
        if (sel.status !== "pending") return err(409, "INVALID_STATE", `Sélection déjà ${sel.status}`);

        const newStatus = approve ? "confirmed" : "cancelled";
        const patch: Record<string, unknown> = { status: newStatus };
        if (approve) {
          patch.confirmed_at = new Date().toISOString();
          patch.confirmed_by = user.id;
        }
        const { error: uErr } = await admin
          .from("channel_selections")
          .update(patch)
          .eq("id", selection_id);
        if (uErr) return err(500, "DB_ERROR", uErr.message);

        const label = approve ? "approve_channel_selection" : "reject_channel_selection";
        const after = { selection_id, status: newStatus, total_price: sel.total_price };
        await audit(label, after, { status: "pending" });
        await activity("channels_change", selection_id, "service",
          approve
            ? `Sélection chaînes confirmée par ${callerName}`
            : `Sélection chaînes refusée par ${callerName}`,
          after, { status: "pending" });
        await sysNote(`[TV] Sélection chaînes ${approve ? "confirmée" : "refusée"} — ${Array.isArray(sel.channels) ? sel.channels.length : 0} chaîne(s). Motif: ${reasonStr}`);
        await enqueueEmail(
          approve ? "client_tv_channels_updated" : "client_tv_channels_rejected",
          {
            channel_count: String(Array.isArray(sel.channels) ? sel.channels.length : 0),
            total_price: fmtMoney(Number(sel.total_price ?? 0)),
            reason: reasonStr,
          },
        );

        return json(200, { ok: true, selection_id, status: newStatus });
      }

      default:
        return err(400, "INVALID_INPUT", "Action inconnue");
    }
  } catch (e) {
    return err(500, "INTERNAL_ERROR", (e as Error).message || "Erreur serveur");
  }
});
