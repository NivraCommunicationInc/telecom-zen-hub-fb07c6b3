// Mobile account actions — Nivra Core & Nivra OneView CS
// Module 30 hardening (F30-1 → F30-23) — Reference: Modules 28 (Internet) & 29 (TV)
//
// Actions:
//   - topup        : record a prepaid recharge
//   - add_addon    : activate a mobile add-on (from server-side catalogue)
//   - remove_addon : cancel an active mobile add-on
//   - sim_action   : SIM lifecycle transitions (suspend / reactivate / replace / swap / block)
//
// Hardening summary:
//   - F30-1  : Ownership assertion client_user_id ↔ profile + account_id ↔ client
//   - F30-2  : Per-action ALLOWED_ROLES (topup / addon / sim_std / sim_critical)
//   - F30-3  : Add-ons resolved from public.mobile_addons_catalog (server truth)
//   - F30-4  : All reads / writes scoped by (user_id, account_id where provided)
//   - F30-5  : payment_reference forced server-side except payment_method='manual'
//   - F30-6  : Global anti-flood 20 mobile.* mutations / 60 s per staff user
//   - F30-7  : Idempotency replay detection via admin_audit_log (5 min window)
//   - F30-8  : Motifs required: ≥5 chars std, ≥10 chars critical SIM actions
//   - F30-9  : metadata.simulated = true on every action
//   - F30-10 : billing_system_alerts raised for recurring add-ons w/o billing_subscription sync
//   - F30-11 : sim_action requires subscription_id + valid mobile_fulfillment
//   - F30-12 : SIM state machine (active ↔ suspended, replace/swap require active)
//   - F30-13 : remove_addon validates account_id scope
//   - F30-14 : PayPal removed from allowed payment_method
//   - F30-15 : MSISDN E.164/10-digit, ICCID 19-20 digits, amount capped, currency whitelist
//   - F30-16 : Normalized error codes (UNAUTHORIZED, FORBIDDEN_ROLE, CROSS_CLIENT_TARGET, …)
//   - F30-17 : actor_role from user_roles (no more hard-coded "staff")
//   - F30-18 : admin_audit_log carries `severity` for critical SIM actions
//   - F30-19 : audit/activity/notes/email failures surface via billing_system_alerts
//   - F30-20 : Server-side catalogue removes frontend price authority
//   - F30-21 : Emails read client_email_preferences.preferred_language
//   - F30-22 : SIM_ACTION_LABELS is the canonical source (UI mirrors this)
//   - F30-23 : Documentation aligned with block_roaming vs block_international
//
// No real operator provisioning is triggered — metadata.simulated=true always.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkStaffAuth } from "../_shared/adminAuth.ts";
import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
import { writeAccountJournal } from "../_shared/writeAccountJournal.ts";

// Minute bucket in base36 — reserved for actions with no stable per-write id.
// Every mobile action here has a stable business id (mobile_topups.id,
// mobile_addons.id, sim_actions.id) so it is not currently used, but kept
// available to mirror the internet-account-actions reference pattern.
function isoMinuteBucket36(d: Date = new Date()): string {
  return Math.floor(d.getTime() / 60_000).toString(36);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "topup" | "add_addon" | "remove_addon" | "sim_action";

type SimActionType =
  | "suspend_lost" | "suspend_stolen" | "suspend_other" | "reactivate"
  | "replace_sim" | "swap_to_esim" | "swap_to_physical"
  | "block_international" | "unblock_international"
  | "block_roaming" | "unblock_roaming";

interface Body {
  action: Action;
  client_user_id: string;
  account_id?: string | null;
  subscription_id?: string | null;
  msisdn?: string | null;
  reason?: string | null;
  idempotency_key?: string | null;

  // topup
  amount?: number;
  currency?: string;
  payment_method?: string;
  payment_reference?: string;

  // addon
  addon_id?: string;          // remove_addon: existing mobile_addons.id
  catalog_id?: string;        // add_addon: mobile_addons_catalog.id (preferred)
  addon_code?: string;        // add_addon: mobile_addons_catalog.addon_code (fallback)

  // sim
  sim_action_type?: SimActionType;
  new_iccid?: string;
}

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const err = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) =>
  json(status, { error_code: code, error: message, ...extra });

// F30-2 — Per-action ALLOWED_ROLES
const ROLES_TOPUP = new Set([
  "admin", "super_admin", "supervisor", "employee", "billing_admin", "support", "sales",
]);
const ROLES_ADDON = new Set([
  "admin", "super_admin", "supervisor", "employee", "billing_admin", "support",
]);
const ROLES_SIM_STD = new Set([
  "admin", "super_admin", "supervisor", "employee", "support", "techops",
]);
const ROLES_SIM_CRITICAL = new Set([
  "admin", "super_admin", "supervisor", "techops",
]);

// F30-22 — Canonical SIM action metadata
const SIM_ACTION_LABELS: Record<SimActionType, { label: string; critical: boolean; needsIccid?: boolean; requiresActive?: boolean; requiresSuspended?: boolean }> = {
  suspend_lost:          { label: "SIM suspendue (perte)", critical: true,  requiresActive: true },
  suspend_stolen:        { label: "SIM suspendue (vol)",   critical: true,  requiresActive: true },
  suspend_other:         { label: "SIM suspendue",         critical: true,  requiresActive: true },
  reactivate:            { label: "SIM réactivée",         critical: false, requiresSuspended: true },
  replace_sim:           { label: "SIM remplacée",         critical: true,  needsIccid: true },
  swap_to_esim:          { label: "Conversion vers eSIM",  critical: false, needsIccid: true },
  swap_to_physical:      { label: "Conversion vers SIM physique", critical: false, needsIccid: true },
  block_international:   { label: "Appels internationaux bloqués",   critical: false },
  unblock_international: { label: "Appels internationaux débloqués", critical: false },
  // F30-23 — block_roaming = data/voice roaming outside home network;
  // block_international = long-distance international calls (different toggle)
  block_roaming:         { label: "Itinérance bloquée",   critical: false },
  unblock_roaming:       { label: "Itinérance débloquée", critical: false },
};

// F30-14 — PayPal explicitly excluded (Phase 3.B decommissioned)
const ALLOWED_PAYMENT_METHODS = new Set([
  "manual", "cash", "interac", "credit_card", "debit_card", "square", "adjustment",
]);

const ALLOWED_CURRENCIES = new Set(["CAD", "USD"]);

// F30-15 — validation regexes
const MSISDN_RE = /^\+?1?\s*\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}$|^\+?[1-9]\d{7,14}$/;
const ICCID_RE = /^\d{19,20}$/;
const MAX_TOPUP_AMOUNT = 500;      // hard cap per transaction (CAD)
const MAX_ADDON_MONTHLY_PRICE = 200;

const fmtMoney = (n: number, currency = "CAD") => {
  try {
    return new Intl.NumberFormat("fr-CA", { style: "currency", currency }).format(n);
  } catch (_e) {
    return `${n.toFixed(2)} $`;
  }
};

const serverRef = (prefix: string) => {
  const buf = new Uint8Array(9);
  crypto.getRandomValues(buf);
  const b64 = btoa(String.fromCharCode(...buf)).replace(/[+/=]/g, "").toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${b64}`;
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

  // F30-1 — Ownership: client_user_id must resolve to a profile
  const { data: profile } = await admin
    .from("profiles")
    .select("id, user_id, email, first_name, last_name, account_number")
    .eq("user_id", client_user_id)
    .maybeSingle();
  if (!profile) return err(404, "NOT_FOUND", "Client introuvable");

  // F30-1 — account_id must belong to this client
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

  // F30-1 — subscription_id must belong to this client + account
  if (body.subscription_id) {
    const { data: sub } = await admin
      .from("subscriptions")
      .select("id, user_id, account_id")
      .eq("id", body.subscription_id)
      .maybeSingle();
    if (!sub) return err(404, "NOT_FOUND", "Abonnement introuvable");
    if (sub.user_id !== client_user_id) {
      return err(403, "CROSS_CLIENT_TARGET", "Abonnement n'appartient pas à ce client");
    }
    if (body.account_id && sub.account_id && sub.account_id !== body.account_id) {
      return err(403, "CROSS_CLIENT_TARGET", "Abonnement n'appartient pas à ce compte");
    }
  }

  const clientEmail = profile.email || null;
  const firstName = profile.first_name || "Client";

  // F30-21 — client language preference
  let preferredLang = "fr";
  try {
    const { data: prefs } = await admin
      .from("client_email_preferences")
      .select("preferred_language")
      .eq("user_id", client_user_id)
      .maybeSingle();
    if (prefs?.preferred_language) preferredLang = prefs.preferred_language;
  } catch (_e) { /* default fr */ }

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

  // F30-6 — Global anti-flood: 20 mobile.* mutations / 60 s per staff user
  {
    const since60 = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin
      .from("admin_audit_log")
      .select("id", { count: "exact", head: true })
      .eq("admin_user_id", user.id)
      .like("action", "mobile.%")
      .gte("created_at", since60);
    if ((count ?? 0) >= 20) {
      return err(429, "RATE_LIMIT", "Trop de requêtes — patientez 60 s");
    }
  }

  // F30-7 — Idempotency replay: same key seen in last 5 min → return prior result
  if (body.idempotency_key) {
    const since5 = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data: prior } = await admin
      .from("admin_audit_log")
      .select("id, action, details, created_at")
      .eq("admin_user_id", user.id)
      .like("action", "mobile.%")
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

  const raiseAlert = async (alert_type: string, details: Record<string, unknown>) => {
    try {
      await admin.from("billing_system_alerts").insert({
        alert_type,
        entity_type: "mobile_account_actions",
        entity_id: null,
        details: { ...details, client_user_id, actor_user_id: user.id },
      });
    } catch (_e) { /* nothing to do */ }
  };

  const audit = async (
    label: string,
    payload: Record<string, unknown>,
    before: Record<string, unknown> | null = null,
    severity: "info" | "warning" | "critical" = "info",
  ) => {
    try {
      await admin.from("admin_audit_log").insert({
        action: `mobile.${label}`,
        admin_user_id: user.id,
        admin_email: callerProfile?.email ?? null,
        target_id: client_user_id,
        target_type: "client",
        ip_address: ip,
        details: {
          ...payload,
          idempotency_key: body.idempotency_key ?? null,
          module_tag: "module30_mobile",
          actor_role: primaryRole,
          before_state: before,
          client_id: client_user_id,
          account_id: body.account_id ?? null,
          subscription_id: body.subscription_id ?? null,
          simulated: true,
          severity,
        },
      });
    } catch (e) {
      await raiseAlert("mobile_audit_write_failed", { label, error: String(e) });
    }
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
    } catch (e) {
      await raiseAlert("mobile_activity_write_failed", { action_type, error: String(e) });
    }
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
    } catch (e) {
      await raiseAlert("mobile_note_write_failed", { error: String(e) });
    }
  };


  const enqueueEmail = async (
    template: string,
    vars: Record<string, unknown>,
  ) => {
    if (!clientEmail) return;
    try {
      await enqueueCommunication(admin, {
      channel: "email",
      recipient: clientEmail,
      templateKey: template,
      priority: 0,
      idempotencyKey: `acct360:mobile:${body.account_id ?? "na"}:${template}:${body.idempotency_key ?? body.__audit_reason ?? "default"}`,
      templateVars: {
      ...vars,
      first_name: firstName,
      to_email: clientEmail,
      language: preferredLang,
    },
    });
    } catch (e) {
      await raiseAlert("mobile_email_enqueue_failed", { template, error: String(e) });
    }
  };

  const requireReason = (min: number): string | null => {
    const r = typeof body.reason === "string" ? body.reason.trim() : "";
    if (r.length < min) return null;
    return r;
  };

  try {
    switch (action) {
      // ============================================================
      case "topup": {
        if (!hasAnyRole(ROLES_TOPUP)) {
          return err(403, "FORBIDDEN_ROLE", "Rôle insuffisant pour appliquer une recharge");
        }
        const amount = Number(body.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          return err(400, "INVALID_INPUT", "Montant invalide");
        }
        if (amount > MAX_TOPUP_AMOUNT) {
          return err(400, "AMOUNT_EXCEEDED", `Montant maximum ${MAX_TOPUP_AMOUNT} $ par recharge`);
        }
        const currency = (body.currency || "CAD").toUpperCase();
        if (!ALLOWED_CURRENCIES.has(currency)) {
          return err(400, "INVALID_INPUT", "Devise non supportée");
        }
        const payment_method = (body.payment_method || "manual").toLowerCase();
        if (!ALLOWED_PAYMENT_METHODS.has(payment_method)) {
          return err(400, "INVALID_PAYMENT_METHOD", "Méthode de paiement non autorisée");
        }
        if (body.msisdn && !MSISDN_RE.test(body.msisdn)) {
          return err(400, "INVALID_INPUT", "Numéro mobile invalide");
        }

        // F30-5 — payment_reference always server-generated except manual/cash where
        // an agent-provided receipt reference is allowed but sanitized.
        let payment_reference: string;
        if ((payment_method === "manual" || payment_method === "cash") && body.payment_reference) {
          const sanitized = String(body.payment_reference).trim().slice(0, 64);
          payment_reference = sanitized || serverRef("TOP");
        } else {
          payment_reference = serverRef("TOP");
        }

        const { data, error: insErr } = await admin
          .from("mobile_topups")
          .insert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            subscription_id: body.subscription_id ?? null,
            msisdn: body.msisdn ?? null,
            amount,
            currency,
            payment_method,
            payment_reference,
            status: "completed",
            performed_by: user.id,
            reason: body.reason ?? null,
            metadata: {
              source: "mobile-account-actions",
              idempotency_key: body.idempotency_key ?? null,
              actor_role: primaryRole,
              simulated: true,
            },
          })
          .select("id")
          .single();
        if (insErr) return err(500, "DB_ERROR", insErr.message);

        const after = { topup_id: data.id, amount, currency, msisdn: body.msisdn ?? null, payment_method, payment_reference };
        await audit("topup", after);
        await activity(
          `mobile:topup:${data.id}:activity`,
          "balance_add",
          data.id,
          "mobile_topup",
          `Recharge mobile ${fmtMoney(amount, currency)}${body.msisdn ? ` — ${body.msisdn}` : ""}`,
          after,
        );
        await sysNote(`mobile:topup:${data.id}:note`, `[MOBILE.TOPUP] ${fmtMoney(amount, currency)} — ${payment_method} — réf ${payment_reference}${body.msisdn ? ` — ${body.msisdn}` : ""}`);
        await enqueueEmail("client_mobile_topup_confirmation", {
          amount: fmtMoney(amount, currency),
          msisdn: body.msisdn,
          payment_method,
          payment_reference,
        });

        return json(200, { ok: true, topup_id: data.id, payment_reference });
      }

      // ============================================================
      case "add_addon": {
        if (!hasAnyRole(ROLES_ADDON)) {
          return err(403, "FORBIDDEN_ROLE", "Rôle insuffisant pour ajouter une option mobile");
        }
        // F30-3 — resolve from catalogue only
        let catQ = admin.from("mobile_addons_catalog")
          .select("id, addon_code, addon_name, addon_type, monthly_price, one_time_price, is_active");
        if (body.catalog_id) catQ = catQ.eq("id", body.catalog_id);
        else if (body.addon_code) catQ = catQ.eq("addon_code", body.addon_code);
        else return err(400, "INVALID_INPUT", "catalog_id ou addon_code requis");
        const { data: cat } = await catQ.maybeSingle();
        if (!cat) return err(400, "UNKNOWN_ADDON", "Option introuvable au catalogue");
        if (!cat.is_active) return err(400, "ADDON_INACTIVE", "Option désactivée au catalogue");

        const monthly_price = Number(cat.monthly_price ?? 0);
        const one_time_price = Number(cat.one_time_price ?? 0);
        if (monthly_price > MAX_ADDON_MONTHLY_PRICE) {
          return err(400, "AMOUNT_EXCEEDED", "Prix mensuel dépasse la limite");
        }

        // Prevent duplicate active addon (F30-3/scope)
        let dupQ = admin.from("mobile_addons")
          .select("id")
          .eq("user_id", client_user_id)
          .eq("addon_code", cat.addon_code)
          .eq("status", "active");
        if (body.account_id) dupQ = dupQ.eq("account_id", body.account_id);
        else dupQ = dupQ.is("account_id", null);
        const { data: dup } = await dupQ.maybeSingle();
        if (dup) return err(409, "ADDON_ALREADY_ACTIVE", "Cette option est déjà active");

        const { data, error: insErr } = await admin
          .from("mobile_addons")
          .insert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            subscription_id: body.subscription_id ?? null,
            addon_code: cat.addon_code,
            addon_name: cat.addon_name,
            addon_type: cat.addon_type,
            monthly_price,
            one_time_price,
            status: "active",
            activated_by: user.id,
            metadata: {
              idempotency_key: body.idempotency_key ?? null,
              catalog_id: cat.id,
              actor_role: primaryRole,
              simulated: true,
            },
          })
          .select("id")
          .single();
        if (insErr) return err(500, "DB_ERROR", insErr.message);

        // F30-10 — billing sync alert for recurring add-ons (no direct billing_subscription line yet)
        if (monthly_price > 0) {
          await raiseAlert("mobile_addon_billing_sync_pending", {
            addon_id: data.id,
            addon_code: cat.addon_code,
            monthly_price,
            note: "Recurring mobile add-on activated — billing_subscriptions integration pending",
          });
        }

        const after = { addon_id: data.id, addon_code: cat.addon_code, addon_name: cat.addon_name, monthly_price, one_time_price };
        await audit("add_addon", after);
        await activity(
          "service_add",
          data.id,
          "mobile_addon",
          `Option mobile ajoutée: ${cat.addon_name} (${fmtMoney(monthly_price)}/mois)`,
          after,
        );
        await sysNote(`[MOBILE.ADD_ADDON] ${cat.addon_name} — ${cat.addon_code} — ${fmtMoney(monthly_price)}/mois`);
        await enqueueEmail("client_mobile_addon_change", {
          addon_name: cat.addon_name,
          monthly_price: fmtMoney(monthly_price),
          change_type: "activated",
        });

        return json(200, { ok: true, addon_id: data.id });
      }

      // ============================================================
      case "remove_addon": {
        if (!hasAnyRole(ROLES_ADDON)) {
          return err(403, "FORBIDDEN_ROLE", "Rôle insuffisant pour retirer une option mobile");
        }
        const addon_id = body.addon_id;
        if (!addon_id) return err(400, "INVALID_INPUT", "addon_id requis");
        const reasonStr = requireReason(5);
        if (!reasonStr) return err(400, "REASON_REQUIRED", "Motif requis (min. 5 caractères)");

        const { data: existing, error: fetchErr } = await admin
          .from("mobile_addons")
          .select("id, addon_name, addon_code, monthly_price, status, user_id, account_id, subscription_id")
          .eq("id", addon_id)
          .maybeSingle();
        if (fetchErr) return err(500, "DB_ERROR", fetchErr.message);
        if (!existing) return err(404, "NOT_FOUND", "Option introuvable");
        // F30-13 — full ownership check
        if (existing.user_id !== client_user_id) {
          return err(403, "CROSS_CLIENT_TARGET", "Option n'appartient pas à ce client");
        }
        if (body.account_id && existing.account_id && existing.account_id !== body.account_id) {
          return err(403, "CROSS_CLIENT_TARGET", "Option n'appartient pas à ce compte");
        }
        if (existing.status !== "active") {
          return err(409, "INVALID_STATE", "Option déjà annulée");
        }

        const { error: updErr } = await admin
          .from("mobile_addons")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString(),
            cancelled_by: user.id,
            cancelled_reason: reasonStr,
          })
          .eq("id", addon_id);
        if (updErr) return err(500, "DB_ERROR", updErr.message);

        const before = { addon_id, status: "active" };
        const after = { addon_id, status: "cancelled", reason: reasonStr };
        await audit("remove_addon", { addon_id, addon_name: existing.addon_name, reason: reasonStr }, before);
        await activity(
          "service_remove",
          addon_id,
          "mobile_addon",
          `Option mobile retirée: ${existing.addon_name}`,
          after,
          before,
        );
        await sysNote(`[MOBILE.REMOVE_ADDON] ${existing.addon_name} — Motif: ${reasonStr}`);
        await enqueueEmail("client_mobile_addon_change", {
          addon_name: existing.addon_name,
          monthly_price: fmtMoney(Number(existing.monthly_price ?? 0)),
          change_type: "cancelled",
        });

        return json(200, { ok: true });
      }

      // ============================================================
      case "sim_action": {
        const sim_action_type = body.sim_action_type;
        if (!sim_action_type || !SIM_ACTION_LABELS[sim_action_type]) {
          return err(400, "INVALID_INPUT", "sim_action_type invalide");
        }
        const meta = SIM_ACTION_LABELS[sim_action_type];

        // F30-2 — role gating (critical vs standard)
        const criticalActions = new Set<SimActionType>(["suspend_stolen", "replace_sim"]);
        const needsCritical = criticalActions.has(sim_action_type);
        const rolesAllowed = needsCritical ? ROLES_SIM_CRITICAL : ROLES_SIM_STD;
        if (!hasAnyRole(rolesAllowed)) {
          return err(403, "FORBIDDEN_ROLE", "Rôle insuffisant pour cette action SIM");
        }

        // F30-8 — mandatory motif
        const minMotif = meta.critical ? 10 : 5;
        const reasonStr = requireReason(minMotif);
        if (!reasonStr) {
          return err(400, "REASON_REQUIRED", `Motif requis (min. ${minMotif} caractères)`);
        }

        // F30-11 — subscription_id required + resolves to mobile_fulfillment
        if (!body.subscription_id) {
          return err(400, "INVALID_INPUT", "subscription_id requis pour une action SIM");
        }
        if (meta.needsIccid) {
          if (!body.new_iccid) return err(400, "INVALID_INPUT", "new_iccid requis");
          if (!ICCID_RE.test(body.new_iccid)) return err(400, "INVALID_INPUT", "ICCID invalide (19-20 chiffres)");
        }
        if (body.msisdn && !MSISDN_RE.test(body.msisdn)) {
          return err(400, "INVALID_INPUT", "Numéro mobile invalide");
        }

        let fulfillQ = admin
          .from("mobile_fulfillment")
          .select("id, sim_iccid, sim_type, account_id, subscription_id, activation_status")
          .eq("user_id", client_user_id)
          .eq("subscription_id", body.subscription_id);
        if (body.account_id) fulfillQ = fulfillQ.eq("account_id", body.account_id);
        const { data: fulfill } = await fulfillQ
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!fulfill) {
          return err(404, "NOT_FOUND", "Aucune ligne mobile provisionnée pour cet abonnement");
        }

        const mobile_fulfillment_id = fulfill.id;
        const old_iccid = fulfill.sim_iccid ?? null;

        // F30-12 — SIM state machine (derived from last completed sim_action)
        const { data: lastAction } = await admin
          .from("sim_actions")
          .select("action_type, status")
          .eq("mobile_fulfillment_id", mobile_fulfillment_id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const suspendKinds = new Set(["suspend_lost", "suspend_stolen", "suspend_other"]);
        const currentlySuspended = !!(lastAction && suspendKinds.has(lastAction.action_type));

        if (meta.requiresActive && currentlySuspended) {
          return err(409, "INVALID_STATE", "SIM déjà suspendue — impossible d'appliquer cette action");
        }
        if (meta.requiresSuspended && !currentlySuspended) {
          return err(409, "INVALID_STATE", "SIM active — rien à réactiver");
        }
        // replace/swap require active line
        if (["replace_sim", "swap_to_esim", "swap_to_physical"].includes(sim_action_type) && currentlySuspended) {
          return err(409, "INVALID_STATE", "SIM suspendue — réactivez avant de remplacer/convertir");
        }

        const { data, error: insErr } = await admin
          .from("sim_actions")
          .insert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            subscription_id: body.subscription_id,
            mobile_fulfillment_id,
            action_type: sim_action_type,
            reason: reasonStr,
            old_iccid,
            new_iccid: body.new_iccid ?? null,
            status: "completed",
            performed_by: user.id,
            metadata: {
              idempotency_key: body.idempotency_key ?? null,
              actor_role: primaryRole,
              simulated: true,
              critical: meta.critical,
            },
          })
          .select("id")
          .single();
        if (insErr) return err(500, "DB_ERROR", insErr.message);

        // F30-9 / F30-12 — Update fulfillment (state + iccid where applicable)
        const fulfillUpdate: Record<string, unknown> = {};
        if (body.new_iccid && (sim_action_type === "replace_sim" || sim_action_type === "swap_to_physical")) {
          fulfillUpdate.sim_iccid = body.new_iccid;
          fulfillUpdate.sim_type = "physical";
        } else if (body.new_iccid && sim_action_type === "swap_to_esim") {
          fulfillUpdate.sim_iccid = body.new_iccid;
          fulfillUpdate.sim_type = "esim";
        }
        if (suspendKinds.has(sim_action_type)) {
          fulfillUpdate.activation_status = "suspended";
        } else if (sim_action_type === "reactivate") {
          fulfillUpdate.activation_status = "activated";
        }
        if (Object.keys(fulfillUpdate).length > 0) {
          const { error: updErr } = await admin
            .from("mobile_fulfillment")
            .update(fulfillUpdate)
            .eq("id", mobile_fulfillment_id);
          if (updErr) {
            await raiseAlert("mobile_fulfillment_sync_failed", {
              sim_action_id: data.id,
              error: updErr.message,
            });
          }
        }

        const before = { activation_status: fulfill.activation_status ?? null, sim_iccid: old_iccid, sim_type: fulfill.sim_type ?? null };
        const after = {
          sim_action_id: data.id,
          sim_action_type,
          msisdn: body.msisdn ?? null,
          old_iccid,
          new_iccid: body.new_iccid ?? null,
          critical: meta.critical,
        };
        await audit("sim_action", after, before, meta.critical ? "critical" : "info");
        await activity(
          "service_change",
          data.id,
          "sim_action",
          `${meta.label}${body.msisdn ? ` — ${body.msisdn}` : ""}`,
          after,
          before,
        );
        await sysNote(`[MOBILE.SIM_ACTION] ${meta.label}${body.msisdn ? ` — ${body.msisdn}` : ""} — Motif: ${reasonStr}${body.new_iccid ? ` — Nouvelle ICCID: ${body.new_iccid}` : ""}`);
        await enqueueEmail("client_mobile_sim_action", {
          action_label: meta.label,
          reason: reasonStr,
          msisdn: body.msisdn,
          is_critical: meta.critical ? "true" : "false",
        });

        return json(200, { ok: true, sim_action_id: data.id });
      }

      default:
        return err(400, "INVALID_INPUT", "Action inconnue");
    }
  } catch (e) {
    return err(500, "INTERNAL_ERROR", (e as Error).message || "Erreur serveur");
  }
});
