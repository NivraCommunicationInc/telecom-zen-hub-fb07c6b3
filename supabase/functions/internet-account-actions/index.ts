// Internet account actions — Nivra Core & Nivra OneView CS
// Single entry for all client Internet management operations:
//   - change_plan       : change Internet plan (upgrade/downgrade/lateral)
//   - modem_action      : reboot / identify / factory_reset / firmware_push / deactivate / reactivate
//   - run_diagnostic    : record a line diagnostic (link, signal, speed, latency, loss)
//   - set_wifi          : update SSID / band / guest network configuration
//   - set_static_ip     : assign or release a static IP add-on
//
// Module 28 hardening (F28-1 → F28-17):
//   - Per-action ALLOWED_ROLES (F28-3)
//   - Ownership assertion client_user_id ↔ profile + account_id ↔ client (F28-2)
//   - Idempotency replay detection via admin_audit_log (F28-4)
//   - link_status accepts ok|up|degraded|down|unstable (F28-5)
//   - Global anti-flood 20 mutations / 60 s per staff user (F28-6)
//   - Release / assign / critical actions require ≥ 5 (10 for critical) chars motif (F28-7 / F28-9)
//   - WiFi upsert scoped (user_id, account_id) (F28-8)
//   - actor_role extracted from user_roles (F28-10)
//   - Plan validated against public.services (Internet) catalogue (F28-12)
//   - Diagnostic flagged simulated=true server-side (F28-13)
//   - Normalized error codes (F28-14)
//   - Before/after snapshots in activity + audit
//   - billing_subscriptions.plan_name synced (F28-17)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkStaffAuth } from "../_shared/adminAuth.ts";
import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
import { writeAccountJournal } from "../_shared/writeAccountJournal.ts";

// Minute bucket in base36, used only as a complement to a stable business
// identity for actions with no natural per-write entity id (e.g. WiFi upsert).
function isoMinuteBucket36(d: Date = new Date()): string {
  return Math.floor(d.getTime() / 60_000).toString(36);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action =
  | "change_plan"
  | "modem_action"
  | "run_diagnostic"
  | "set_wifi"
  | "set_static_ip";

interface Body {
  action: Action;
  client_user_id: string;
  account_id?: string | null;
  subscription_id?: string | null;
  reason?: string | null;
  idempotency_key?: string | null;

  previous_plan_name?: string;
  previous_monthly_price?: number;
  previous_speed_mbps?: number;
  new_plan_name?: string;
  new_monthly_price?: number;
  new_speed_mbps?: number;
  change_type?: "upgrade" | "downgrade" | "lateral";
  effective_date?: string;

  modem_serial?: string;
  modem_mac?: string;
  action_type?: "reboot" | "identify" | "factory_reset" | "firmware_push" | "deactivate" | "reactivate";

  diagnostic_type?: "full" | "link" | "speedtest" | "latency";
  link_status?: string;
  signal_strength_db?: number;
  download_mbps?: number;
  upload_mbps?: number;
  latency_ms?: number;
  packet_loss_pct?: number;
  notes?: string;

  ssid_24?: string;
  ssid_5?: string;
  password_hint?: string;
  band_mode?: "2.4" | "5" | "dual";
  guest_enabled?: boolean;
  guest_ssid?: string;
  guest_password_hint?: string;
  channel_24?: number;
  channel_5?: number;

  static_ip_mode?: "assign" | "release";
  ip_address?: string;
  monthly_price?: number;
  assignment_id?: string;
}

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const err = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) =>
  json(status, { error_code: code, error: message, ...extra });

// F28-3 — per-action ALLOWED_ROLES
const ROLES_READ_ALL = new Set([
  "admin", "super_admin", "supervisor", "employee", "support",
  "billing_admin", "sales", "techops", "manager",
]);
const ROLES_CHANGE_PLAN = new Set([
  "admin", "super_admin", "supervisor", "employee", "billing_admin", "support",
]);
const ROLES_MODEM_STD = new Set([
  "admin", "super_admin", "supervisor", "employee", "support", "techops",
]);
const ROLES_MODEM_CRITICAL = new Set([
  "admin", "super_admin", "supervisor", "techops",
]);
const ROLES_DIAGNOSTIC = ROLES_READ_ALL;
const ROLES_WIFI = new Set([
  "admin", "super_admin", "supervisor", "employee", "support", "techops",
]);
const ROLES_STATIC_IP = new Set([
  "admin", "super_admin", "supervisor", "techops",
]);

const MODEM_LABELS: Record<string, { label: string; critical: boolean }> = {
  reboot:        { label: "Redémarrage du modem", critical: false },
  identify:      { label: "Identification du modem", critical: false },
  factory_reset: { label: "Réinitialisation usine du modem", critical: true },
  firmware_push: { label: "Mise à jour micrologiciel du modem", critical: false },
  deactivate:    { label: "Désactivation du modem", critical: true },
  reactivate:    { label: "Réactivation du modem", critical: false },
};

const fmtMoney = (n: number, currency = "CAD") => {
  try {
    return new Intl.NumberFormat("fr-CA", { style: "currency", currency }).format(n);
  } catch (_e) {
    return `${n.toFixed(2)} $`;
  }
};

const isValidIp = (s: string) =>
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/.test(s);

// F28-5 — accepted link statuses (normalise up→ok, unstable→degraded for storage)
const LINK_STATUS_INPUT = new Set(["ok", "up", "degraded", "down", "unstable"]);
const normaliseLinkStatus = (s?: string | null): string | null => {
  if (!s) return null;
  const v = s.toLowerCase();
  if (v === "up") return "ok";
  if (v === "unstable") return "degraded";
  return v;
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

  // F28-10 — actor_role réel
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

  // F28-2 — Ownership: client_user_id must resolve to a profile
  const { data: profile } = await admin
    .from("profiles")
    .select("id, user_id, email, first_name, last_name, account_number")
    .eq("user_id", client_user_id)
    .maybeSingle();
  if (!profile) return err(404, "NOT_FOUND", "Client introuvable");

  // F28-2 — If account_id supplied, it must belong to this client
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

  // F28-6 — Global anti-flood: 20 internet.* mutations / 60 s per staff user
  {
    const since60 = new Date(Date.now() - 60_000).toISOString();
    const { count } = await admin
      .from("admin_audit_log")
      .select("id", { count: "exact", head: true })
      .eq("admin_user_id", user.id)
      .like("action", "internet.%")
      .gte("created_at", since60);
    if ((count ?? 0) >= 20) {
      return err(429, "RATE_LIMIT", "Trop de requêtes — patientez 60 s");
    }
  }

  // F28-4 — Idempotency replay: same key seen in last 5 min → return prior result
  if (body.idempotency_key) {
    const since5 = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data: prior } = await admin
      .from("admin_audit_log")
      .select("id, action, details, created_at")
      .eq("admin_user_id", user.id)
      .like("action", "internet.%")
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
        action: `internet.${label}`,
        admin_user_id: user.id,
        admin_email: callerProfile?.email ?? null,
        target_id: client_user_id,
        target_type: "client",
        ip_address: ip,
        details: {
          ...payload,
          idempotency_key: body.idempotency_key ?? null,
          module_tag: "module28_internet",
          actor_role: primaryRole,
          before_state: before,
          client_id: client_user_id,
          account_id: body.account_id ?? null,
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

  const enqueueEmail = async (
    template: string,
    vars: Record<string, unknown>,
    attachments?: Array<{ filename: string; content: string; contentType: string }> | null,
  ) => {
    if (!clientEmail) return;
    try {
      await enqueueCommunication(admin, {
      channel: "email",
      recipient: clientEmail,
      templateKey: template,
      attachments: attachments || null,
      priority: 0,
      idempotencyKey: `acct360:internet:${body.account_id ?? "na"}:${template}:${body.idempotency_key ?? body.__audit_reason ?? "default"}`,
      templateVars: { ...vars, first_name: firstName, to_email: clientEmail },
    });
    } catch (_e) { /* swallow */ }
  };

  try {
    switch (action) {
      // ============================================================
      case "change_plan": {
        if (!hasAnyRole(ROLES_CHANGE_PLAN)) {
          return err(403, "FORBIDDEN_ROLE", "Rôle insuffisant pour changer un forfait Internet");
        }
        const new_plan_name = (body.new_plan_name || "").trim();
        const new_monthly_price = Number(body.new_monthly_price ?? 0);
        if (!new_plan_name) return err(400, "INVALID_INPUT", "new_plan_name requis");
        if (!Number.isFinite(new_monthly_price) || new_monthly_price < 0) {
          return err(400, "INVALID_INPUT", "new_monthly_price invalide");
        }
        const reasonStr = typeof body.reason === "string" ? body.reason.trim() : "";
        if (reasonStr.length < 5) {
          return err(400, "REASON_REQUIRED", "Motif requis (min. 5 caractères)");
        }

        // F28-12 — Validate against catalogue (public.services, category=Internet)
        const { data: catalogue } = await admin
          .from("services")
          .select("id, name, price")
          .eq("category", "Internet")
          .or("status.eq.active,is_active.eq.true");
        const catalogueMatch = (catalogue || []).find(
          (s: any) => String(s.name).toLowerCase().trim() === new_plan_name.toLowerCase(),
        );
        if (!catalogueMatch) {
          return err(400, "UNKNOWN_PLAN", `Forfait "${new_plan_name}" introuvable au catalogue Internet`);
        }

        const change_type = body.change_type || "upgrade";
        if (!["upgrade", "downgrade", "lateral"].includes(change_type)) {
          return err(400, "INVALID_INPUT", "change_type invalide");
        }
        const effective_date = body.effective_date || new Date().toISOString().slice(0, 10);

        const before = {
          plan_name: body.previous_plan_name ?? null,
          monthly_price: body.previous_monthly_price ?? null,
          speed_mbps: body.previous_speed_mbps ?? null,
        };

        const { data, error: insErr } = await admin
          .from("internet_plan_changes")
          .insert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            subscription_id: body.subscription_id ?? null,
            previous_plan_name: body.previous_plan_name ?? null,
            previous_monthly_price: body.previous_monthly_price ?? null,
            previous_speed_mbps: body.previous_speed_mbps ?? null,
            new_plan_name,
            new_monthly_price,
            new_speed_mbps: body.new_speed_mbps ?? null,
            change_type,
            effective_date,
            status: "completed",
            reason: reasonStr,
            performed_by: user.id,
            metadata: {
              idempotency_key: body.idempotency_key ?? null,
              actor_role: primaryRole,
              simulated: true,
            },
          })
          .select("id")
          .single();
        if (insErr) return err(500, "DB_ERROR", insErr.message);

        // F28-17 — sync subscriptions AND billing_subscriptions
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
        // Sync billing_subscription plan_name (Phase 3 canonical)
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
            alert_type: "internet_plan_change_orphaned",
            entity_type: "internet_plan_changes",
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
          plan_change_id: data.id,
          plan_name: new_plan_name,
          monthly_price: new_monthly_price,
          speed_mbps: body.new_speed_mbps ?? null,
          change_type,
          effective_date,
        };

        await audit("change_plan", after, before);
        await activity(
          `internet:plan_change:${data.id}:activity`,
          "internet_plan_change",
          data.id,
          "internet_plan_change",
          `Forfait Internet: ${body.previous_plan_name ?? "—"} → ${new_plan_name} (${fmtMoney(new_monthly_price)}/mois, ${change_type})`,
          after,
          before,
        );
        await sysNote(
          `internet:plan_change:${data.id}:note`,
          `[INTERNET] Forfait changé — ${body.previous_plan_name ?? "—"} → ${new_plan_name} · ${fmtMoney(new_monthly_price)}/mois · ${change_type} · effectif ${effective_date}` +
          (subscriptionUpdateOk ? "" : ` · ⚠️ abonnement non synchronisé (${subscriptionUpdateError})`),
        );
        await enqueueEmail("client_internet_plan_change", {
          previous_plan_name: body.previous_plan_name || "—",
          new_plan_name,
          new_monthly_price: fmtMoney(new_monthly_price),
          new_speed_mbps: body.new_speed_mbps ? String(body.new_speed_mbps) : "—",
          effective_date,
          change_type,
        });

        // Prorata (upgrade only) — server-side, DB RPC recalculates taxes
        const prevPrice = Number(body.previous_monthly_price ?? 0);
        const priceDiff = new_monthly_price - prevPrice;
        if (change_type === "upgrade" && priceDiff > 0 && prevPrice > 0) {
          try {
            const { data: bc } = await admin
              .from("billing_customers")
              .select("id")
              .eq("user_id", client_user_id)
              .maybeSingle();

            if (bc?.id) {
              const { data: bSub } = await admin
                .from("billing_subscriptions")
                .select("id, customer_id, cycle_end_date, payment_method")
                .eq("customer_id", bc.id)
                .eq("status", "active")
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              if (bSub?.cycle_end_date) {
                const todayDate = new Date(effective_date);
                const cycleEndDate = new Date(bSub.cycle_end_date);
                const daysRemaining = Math.max(1, Math.ceil(
                  (cycleEndDate.getTime() - todayDate.getTime()) / 86_400_000
                ));
                const prorationSubtotal = Math.round(priceDiff * (daysRemaining / 30) * 100) / 100;

                if (prorationSubtotal >= 0.01) {
                  const lineDesc = `Ajustement proratisé — ${body.previous_plan_name ?? "ancien forfait"} → ${new_plan_name} (${daysRemaining}/30 jours)`;

                  const { data: currentInvoice } = await admin
                    .from("billing_invoices")
                    .select("id, invoice_number, cycle_start_date, cycle_end_date")
                    .eq("subscription_id", bSub.id)
                    .in("status", ["pending", "issued"])
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                  if (currentInvoice) {
                    const { data: proRes, error: proErr2 } = await admin.rpc(
                      "add_prorata_line_to_invoice",
                      {
                        p_invoice_id: currentInvoice.id,
                        p_description: lineDesc,
                        p_subtotal: prorationSubtotal,
                        p_line_type: "service",
                        p_service_id: null,
                        p_metadata: {
                          source: "internet-account-actions",
                          reason: "plan_change_prorata",
                          days_remaining: daysRemaining,
                          plan_before: body.previous_plan_name ?? null,
                          plan_after: new_plan_name,
                        },
                      },
                    );
                    if (proErr2) throw proErr2;

                    const proTotalWithTax = Number((proRes as any)?.line_total_with_tax ?? 0);
                    const newInvoiceTotal = Number((proRes as any)?.new_invoice_total ?? 0);

                    const { buildInvoicePdfAttachment } = await import("../_shared/pdfFromDb.ts");
                    const invoicePdf = await buildInvoicePdfAttachment(currentInvoice.id, "Facture").catch(() => null);
                    await enqueueEmail("invoice_created", {
                      invoice_number: currentInvoice.invoice_number,
                      total: newInvoiceTotal.toFixed(2),
                      amount: proTotalWithTax.toFixed(2),
                      due_date: bSub.cycle_end_date,
                      cycle_start: effective_date,
                      cycle_end: bSub.cycle_end_date,
                    }, invoicePdf ? [invoicePdf] : null);
                  } else {
                    const { data: acct } = await admin
                      .from("accounts")
                      .select("id")
                      .eq("client_id", client_user_id)
                      .maybeSingle();

                    if (acct?.id) {
                      await admin.from("account_adjustments").insert({
                        account_id: acct.id,
                        type: "fee",
                        amount: prorationSubtotal,
                        description: lineDesc,
                        months_total: 1,
                        months_remaining: 1,
                        status: "active",
                        created_by: user.id,
                      });
                    }
                  }
                }
              }
            }
          } catch (proErr) {
            console.error("[internet-account-actions] proration error:", proErr);
          }
        }

        return json(200, { ok: true, plan_change_id: data.id });
      }

      // ============================================================
      case "modem_action": {
        const action_type = body.action_type;
        if (!action_type || !MODEM_LABELS[action_type]) {
          return err(400, "INVALID_INPUT", "action_type invalide");
        }
        const meta = MODEM_LABELS[action_type];

        // F28-3 — critical modem actions restricted
        const requiredRoles = meta.critical ? ROLES_MODEM_CRITICAL : ROLES_MODEM_STD;
        if (!hasAnyRole(requiredRoles)) {
          return err(403, "FORBIDDEN_ROLE", `Rôle insuffisant pour: ${meta.label}`);
        }

        // F28-9 — motif ≥ 10 chars for critical, ≥ 5 for reboot, none required otherwise
        const reasonStr = typeof body.reason === "string" ? body.reason.trim() : "";
        if (meta.critical && reasonStr.length < 10) {
          return err(400, "REASON_REQUIRED", "Motif requis (min. 10 caractères) pour cette action critique");
        }
        if (action_type === "reboot" && reasonStr.length < 5) {
          return err(400, "REASON_REQUIRED", "Motif requis (min. 5 caractères)");
        }

        // Cooldown reboot 120s
        if (action_type === "reboot") {
          const since = new Date(Date.now() - 120_000).toISOString();
          let q = admin
            .from("internet_modem_actions")
            .select("id, created_at")
            .eq("user_id", client_user_id)
            .eq("action_type", "reboot")
            .gte("created_at", since)
            .limit(1);
          if (body.modem_serial) q = q.eq("modem_serial", body.modem_serial);
          const { data: recent } = await q;
          if (recent && recent.length > 0) {
            return err(429, "RATE_LIMIT", "Un reboot vient d'être demandé pour cet équipement. Réessayez dans quelques instants.");
          }
        }

        const { data, error: insErr } = await admin
          .from("internet_modem_actions")
          .insert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            subscription_id: body.subscription_id ?? null,
            modem_serial: body.modem_serial ?? null,
            modem_mac: body.modem_mac ?? null,
            action_type,
            reason: reasonStr || null,
            status: "completed",
            performed_by: user.id,
            metadata: {
              idempotency_key: body.idempotency_key ?? null,
              simulated: true,
              actor_role: primaryRole,
            },
          })
          .select("id")
          .single();
        if (insErr) return err(500, "DB_ERROR", insErr.message);

        const after = {
          modem_action_id: data.id,
          action_type,
          modem_serial: body.modem_serial ?? null,
          modem_mac: body.modem_mac ?? null,
          reason: reasonStr || null,
        };
        await audit("modem_action", after);
        await activity(
          `internet:modem_action:${data.id}:activity`,
          "internet_modem_action",
          data.id,
          "internet_modem_action",
          `Modem: ${meta.label}${body.modem_serial ? ` · S/N ${body.modem_serial}` : ""}`,
          after,
        );
        await sysNote(
          `internet:modem_action:${data.id}:note`,
          `[INTERNET] ${meta.label}${body.modem_serial ? ` · S/N ${body.modem_serial}` : ""}${reasonStr ? ` · Raison: ${reasonStr}` : ""}`,
        );
        await enqueueEmail("client_internet_modem_action", {
          action_label: meta.label,
          modem_serial: body.modem_serial || "—",
          modem_mac: body.modem_mac || "—",
          reason: reasonStr || "—",
          is_critical: meta.critical ? "true" : "false",
        });

        return json(200, { ok: true, modem_action_id: data.id });
      }

      // ============================================================
      case "run_diagnostic": {
        if (!hasAnyRole(ROLES_DIAGNOSTIC)) {
          return err(403, "FORBIDDEN_ROLE", "Rôle insuffisant pour un diagnostic");
        }
        const diagnostic_type = body.diagnostic_type || "full";
        if (!["full", "link", "speedtest", "latency"].includes(diagnostic_type)) {
          return err(400, "INVALID_INPUT", "diagnostic_type invalide");
        }
        const inRange = (v: unknown, min: number, max: number) =>
          v == null || (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max);
        if (!inRange(body.download_mbps, 0, 100000)) return err(400, "INVALID_INPUT", "download_mbps hors bornes");
        if (!inRange(body.upload_mbps, 0, 100000)) return err(400, "INVALID_INPUT", "upload_mbps hors bornes");
        if (!inRange(body.latency_ms, 0, 60000)) return err(400, "INVALID_INPUT", "latency_ms hors bornes");
        if (!inRange(body.packet_loss_pct, 0, 100)) return err(400, "INVALID_INPUT", "packet_loss_pct hors bornes");
        if (body.link_status && !LINK_STATUS_INPUT.has(body.link_status.toLowerCase())) {
          return err(400, "INVALID_INPUT", "link_status invalide");
        }
        const link_status = normaliseLinkStatus(body.link_status ?? null);

        const { data, error: insErr } = await admin
          .from("internet_diagnostics")
          .insert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            subscription_id: body.subscription_id ?? null,
            diagnostic_type,
            link_status,
            signal_strength_db: body.signal_strength_db ?? null,
            download_mbps: body.download_mbps ?? null,
            upload_mbps: body.upload_mbps ?? null,
            latency_ms: body.latency_ms ?? null,
            packet_loss_pct: body.packet_loss_pct ?? null,
            notes: body.notes ?? null,
            performed_by: user.id,
          })
          .select("id")
          .single();
        if (insErr) return err(500, "DB_ERROR", insErr.message);

        const after = {
          diagnostic_id: data.id,
          diagnostic_type,
          link_status,
          download_mbps: body.download_mbps ?? null,
          upload_mbps: body.upload_mbps ?? null,
          latency_ms: body.latency_ms ?? null,
          packet_loss_pct: body.packet_loss_pct ?? null,
          simulated: true, // F28-13
        };
        await audit("run_diagnostic", after);
        await activity(
          `internet:diagnostic:${data.id}:activity`,
          "internet_diagnostic",
          data.id,
          "internet_diagnostic",
          `Diagnostic Internet (${diagnostic_type}) — lien ${link_status ?? "—"}`,
          after,
        );
        await sysNote(
          `internet:diagnostic:${data.id}:note`,
          `[INTERNET] Diagnostic ${diagnostic_type} — lien: ${link_status ?? "—"}` +
          ` · DL ${body.download_mbps ?? "—"} Mbps · UL ${body.upload_mbps ?? "—"} Mbps` +
          ` · latence ${body.latency_ms ?? "—"} ms · perte ${body.packet_loss_pct ?? "—"}%` +
          (body.notes ? ` · ${body.notes}` : ""),
        );
        await enqueueEmail("client_internet_diagnostic", {
          diagnostic_type,
          link_status: link_status || "—",
          download_mbps: body.download_mbps != null ? String(body.download_mbps) : "—",
          upload_mbps: body.upload_mbps != null ? String(body.upload_mbps) : "—",
          latency_ms: body.latency_ms != null ? String(body.latency_ms) : "—",
          packet_loss_pct: body.packet_loss_pct != null ? String(body.packet_loss_pct) : "—",
          notes: body.notes || "—",
        });

        return json(200, { ok: true, diagnostic_id: data.id });
      }

      // ============================================================
      case "set_wifi": {
        if (!hasAnyRole(ROLES_WIFI)) {
          return err(403, "FORBIDDEN_ROLE", "Rôle insuffisant pour la config WiFi");
        }
        const band_mode = body.band_mode || "dual";
        if (!["2.4", "5", "dual"].includes(band_mode)) {
          return err(400, "INVALID_INPUT", "band_mode invalide");
        }

        // F28-8 — scope by (user_id, account_id): select existing then update, else insert
        const payload: Record<string, unknown> = {
          user_id: client_user_id,
          account_id: body.account_id ?? null,
          ssid_24: body.ssid_24 ?? null,
          ssid_5: body.ssid_5 ?? null,
          password_hint: body.password_hint ?? null,
          band_mode,
          guest_enabled: !!body.guest_enabled,
          guest_ssid: body.guest_ssid ?? null,
          guest_password_hint: body.guest_password_hint ?? null,
          channel_24: body.channel_24 ?? null,
          channel_5: body.channel_5 ?? null,
          updated_by: user.id,
        };

        let existingQ = admin
          .from("internet_wifi_settings")
          .select("id, ssid_24, ssid_5, band_mode, guest_enabled, guest_ssid")
          .eq("user_id", client_user_id);
        existingQ = body.account_id
          ? existingQ.eq("account_id", body.account_id)
          : existingQ.is("account_id", null);
        const { data: existing } = await existingQ.maybeSingle();

        let before: Record<string, unknown> | null = null;
        if (existing) {
          before = {
            ssid_24: existing.ssid_24,
            ssid_5: existing.ssid_5,
            band_mode: existing.band_mode,
            guest_enabled: existing.guest_enabled,
            guest_ssid: existing.guest_ssid,
          };
          const { error: uErr } = await admin
            .from("internet_wifi_settings")
            .update(payload)
            .eq("id", existing.id);
          if (uErr) return err(500, "DB_ERROR", uErr.message);
        } else {
          const { error: iErr } = await admin
            .from("internet_wifi_settings")
            .insert(payload);
          if (iErr) return err(500, "DB_ERROR", iErr.message);
        }

        const after = {
          band_mode,
          ssid_24: body.ssid_24 ?? null,
          ssid_5: body.ssid_5 ?? null,
          guest_enabled: !!body.guest_enabled,
          guest_ssid: body.guest_ssid ?? null,
        };
        await audit("set_wifi", after, before);
        await activity(
          "internet_wifi_change",
          null,
          "internet_wifi_settings",
          `WiFi mis à jour — bande ${band_mode}${body.guest_enabled ? ` · invité activé (${body.guest_ssid || "—"})` : " · invité désactivé"}`,
          after,
          before,
        );
        await sysNote(
          `[INTERNET] WiFi mis à jour — bande ${band_mode}` +
          ` · SSID 2.4: ${body.ssid_24 ?? "—"} · SSID 5: ${body.ssid_5 ?? "—"}` +
          ` · Invité: ${body.guest_enabled ? `oui (${body.guest_ssid ?? "—"})` : "non"}`,
        );
        await enqueueEmail("client_internet_wifi_change", {
          ssid_24: body.ssid_24 || "—",
          ssid_5: body.ssid_5 || "—",
          band_mode,
          guest_enabled: body.guest_enabled ? "true" : "false",
          guest_ssid: body.guest_ssid || "—",
        });

        return json(200, { ok: true });
      }

      // ============================================================
      case "set_static_ip": {
        if (!hasAnyRole(ROLES_STATIC_IP)) {
          return err(403, "FORBIDDEN_ROLE", "Rôle insuffisant pour la gestion d'IP statique");
        }
        const mode = body.static_ip_mode || "assign";
        const reasonStr = typeof body.reason === "string" ? body.reason.trim() : "";

        if (mode === "release") {
          // F28-7 — motif obligatoire ≥ 5 chars
          if (reasonStr.length < 5) {
            return err(400, "REASON_REQUIRED", "Motif requis (min. 5 caractères) pour libérer une IP");
          }
          const id = body.assignment_id;
          if (!id) return err(400, "INVALID_INPUT", "assignment_id requis");
          const { data: existing, error: fErr } = await admin
            .from("internet_static_ip_assignments")
            .select("id, status, user_id, ip_address, monthly_price")
            .eq("id", id)
            .maybeSingle();
          if (fErr) return err(500, "DB_ERROR", fErr.message);
          if (!existing) return err(404, "NOT_FOUND", "Attribution introuvable");
          if (existing.user_id !== client_user_id) {
            return err(403, "CROSS_CLIENT_TARGET", "IP n'appartient pas à ce client");
          }
          if (existing.status === "released") return err(409, "DUPLICATE_ACTIVE", "Déjà libérée");

          const { error: uErr } = await admin
            .from("internet_static_ip_assignments")
            .update({
              status: "released",
              released_at: new Date().toISOString(),
              released_reason: reasonStr,
            })
            .eq("id", id);
          if (uErr) return err(500, "DB_ERROR", uErr.message);

          const before = { status: "active", ip_address: existing.ip_address, monthly_price: existing.monthly_price };
          const after = { status: "released", ip_address: existing.ip_address, released_reason: reasonStr };

          await audit("static_ip_release", { assignment_id: id, ...after }, before);
          await activity(
            "internet_static_ip_release",
            id,
            "internet_static_ip",
            `IP statique libérée — ${existing.ip_address ?? "—"}`,
            after,
            before,
          );
          await sysNote(`[INTERNET] IP statique libérée — ${existing.ip_address ?? "—"} · Raison: ${reasonStr}`);
          await enqueueEmail("client_internet_static_ip", {
            mode: "released",
            ip_address: existing.ip_address || "—",
            monthly_price: fmtMoney(0),
            reason: reasonStr,
          });

          return json(200, { ok: true });
        }

        // assign
        if (reasonStr.length < 5) {
          return err(400, "REASON_REQUIRED", "Motif requis (min. 5 caractères) pour attribuer une IP");
        }
        const ip_address = (body.ip_address || "").trim();
        if (!ip_address || !isValidIp(ip_address)) {
          return err(400, "INVALID_INPUT", "ip_address IPv4 valide requise");
        }
        const monthly_price = Number(body.monthly_price ?? 0);
        if (!Number.isFinite(monthly_price) || monthly_price < 0) {
          return err(400, "INVALID_INPUT", "monthly_price invalide");
        }

        const { data: dupRows, error: dupErr } = await admin
          .from("internet_static_ip_assignments")
          .select("id, user_id")
          .eq("ip_address", ip_address)
          .eq("status", "active")
          .limit(1);
        if (dupErr) return err(500, "DB_ERROR", dupErr.message);
        if (dupRows && dupRows.length > 0) {
          return err(409, "DUPLICATE_ACTIVE", `IP ${ip_address} déjà attribuée`);
        }

        const { data, error: insErr } = await admin
          .from("internet_static_ip_assignments")
          .insert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            subscription_id: body.subscription_id ?? null,
            ip_address,
            monthly_price,
            status: "active",
            activated_at: new Date().toISOString(),
            performed_by: user.id,
            metadata: { idempotency_key: body.idempotency_key ?? null, actor_role: primaryRole },
          })
          .select("id")
          .single();
        if (insErr) return err(500, "DB_ERROR", insErr.message);

        const after = { assignment_id: data.id, ip_address, monthly_price, status: "active" };
        await audit("static_ip_assign", after);
        await activity(
          "internet_static_ip_assign",
          data.id,
          "internet_static_ip",
          `IP statique attribuée — ${ip_address} (${fmtMoney(monthly_price)}/mois)`,
          after,
        );
        await sysNote(`[INTERNET] IP statique attribuée — ${ip_address} · ${fmtMoney(monthly_price)}/mois · Raison: ${reasonStr}`);
        await enqueueEmail("client_internet_static_ip", {
          mode: "assigned",
          ip_address,
          monthly_price: fmtMoney(monthly_price),
          reason: reasonStr,
        });

        return json(200, { ok: true, assignment_id: data.id });
      }

      default:
        return err(400, "UNKNOWN_ACTION", "Action inconnue");
    }
  } catch (e) {
    return err(500, "INTERNAL_ERROR", (e as Error).message || "Erreur serveur");
  }
});
