// Internet account actions — Nivra Core & Nivra OneView CS
// Single entry for all client Internet management operations:
//   - change_plan       : change Internet plan (upgrade/downgrade/lateral)
//   - modem_action      : reboot / identify / factory_reset / firmware_push / deactivate / reactivate
//   - run_diagnostic    : record a line diagnostic (link, signal, speed, latency, loss)
//   - set_wifi          : update SSID / band / guest network configuration
//   - set_static_ip     : assign or release a static IP add-on
//
// Every action:
//   - validates staff role via user_roles (admin/employee/supervisor/support/billing_admin/sales)
//   - writes the domain row
//   - records admin_audit_log entry (best-effort, never blocks)
//   - queues a branded corporate-shell client email through email_queue (Violet Bold)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkStaffAuth } from "../_shared/adminAuth.ts";
import { computeTaxes } from "../_shared/tax-constants.ts";

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

  // change_plan
  previous_plan_name?: string;
  previous_monthly_price?: number;
  previous_speed_mbps?: number;
  new_plan_name?: string;
  new_monthly_price?: number;
  new_speed_mbps?: number;
  change_type?: "upgrade" | "downgrade" | "lateral";
  effective_date?: string;

  // modem
  modem_serial?: string;
  modem_mac?: string;
  action_type?: "reboot" | "identify" | "factory_reset" | "firmware_push" | "deactivate" | "reactivate";

  // diagnostic
  diagnostic_type?: "full" | "link" | "speedtest" | "latency";
  link_status?: string;
  signal_strength_db?: number;
  download_mbps?: number;
  upload_mbps?: number;
  latency_ms?: number;
  packet_loss_pct?: number;
  notes?: string;

  // wifi
  ssid_24?: string;
  ssid_5?: string;
  password_hint?: string;
  band_mode?: "2.4" | "5" | "dual";
  guest_enabled?: boolean;
  guest_ssid?: string;
  guest_password_hint?: string;
  channel_24?: number;
  channel_5?: number;

  // static IP
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

const ALLOWED_ROLES = new Set([
  "admin", "employee", "supervisor", "support", "billing_admin", "sales",
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { error: "Non autorisé" });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return json(401, { error: "Session invalide" });

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

    const { isStaff } = await checkStaffAuth(admin, user.id);
  if (!isStaff) return json(403, { error: "Action réservée au personnel autorisé" });

  let body: Body;
  try { body = await req.json(); }
  catch { return json(400, { error: "Corps JSON invalide" }); }

  const { action, client_user_id } = body;
  if (!action || !client_user_id) {
    return json(400, { error: "Champs requis: action, client_user_id" });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, user_id, email, first_name, last_name, account_number")
    .eq("user_id", client_user_id)
    .maybeSingle();

  const clientEmail = profile?.email || null;
  const firstName = profile?.first_name || "Client";

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

  const audit = async (label: string, payload: Record<string, unknown>) => {
    try {
      await admin.from("admin_audit_log").insert({
        action: `internet.${label}`,
        admin_user_id: user.id,
        admin_email: callerProfile?.email ?? null,
        target_id: client_user_id,
        target_type: "client",
        ip_address: ip,
        details: payload,
      });
    } catch (_e) { /* swallow */ }
  };

  const activity = async (
    action_type: string,
    entity_id: string | null,
    entity_type: string,
    summary: string,
    after_data: Record<string, unknown> | null = null,
  ) => {
    try {
      await admin.from("client_activity_logs").insert({
        client_id: client_user_id,
        actor_user_id: user.id,
        actor_name: callerName,
        actor_role: "staff",
        action_type,
        entity_type,
        entity_id,
        summary,
        before_data: null,
        after_data,
      });
    } catch (_e) { /* swallow */ }
  };

  const sysNote = async (body_text: string) => {
    try {
      await admin.from("client_internal_notes").insert({
        client_id: client_user_id,
        note_type: "system",
        body: body_text,
        created_by_user_id: user.id,
        created_by_role: "staff",
        created_by_name: callerName,
      });
    } catch (_e) { /* swallow */ }
  };

  const enqueueEmail = async (template: string, vars: Record<string, unknown>, attachments?: Array<{ filename: string; content: string; contentType: string }> | null) => {
    if (!clientEmail) return;
    try {
      await admin.from("email_queue").insert({
        to_email: clientEmail,
        template_key: template,
        template_vars: { ...vars, first_name: firstName, to_email: clientEmail },
        attachments: attachments || null,
        status: "queued",
        priority: 0,
      });
    } catch (_e) { /* swallow */ }
  };

  try {
    switch (action) {
      // ============================================================
      case "change_plan": {
        const new_plan_name = (body.new_plan_name || "").trim();
        const new_monthly_price = Number(body.new_monthly_price ?? 0);
        if (!new_plan_name) return json(400, { error: "new_plan_name requis" });
        if (!Number.isFinite(new_monthly_price) || new_monthly_price < 0) {
          return json(400, { error: "new_monthly_price invalide" });
        }
        const change_type = body.change_type || "upgrade";
        const effective_date = body.effective_date || new Date().toISOString().slice(0, 10);

        const { data, error } = await admin
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
            reason: body.reason ?? null,
            performed_by: user.id,
            metadata: { idempotency_key: body.idempotency_key },
          })
          .select("id")
          .single();
        if (error) return json(500, { error: error.message });

        // Track subscription update result. If it fails, audit it so ops can
        // reconcile the inconsistent state (plan_change row exists but the
        // subscription itself still shows the old plan/price).
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
            // Raise a system alert so ops can manually reconcile
            await admin.from("billing_system_alerts").insert({
              alert_type: "internet_plan_change_orphaned",
              entity_type: "internet_plan_changes",
              entity_id: data.id,
              details: {
                plan_change_id: data.id,
                subscription_id: body.subscription_id,
                error: subErr.message,
                client_user_id,
              },
            });
          }
        }

        await audit("change_plan", {
          plan_change_id: data.id, new_plan_name, new_monthly_price,
          new_speed_mbps: body.new_speed_mbps, change_type,
          subscription_update_ok: subscriptionUpdateOk,
          subscription_update_error: subscriptionUpdateError,
        });
        await activity(
          "internet_plan_change",
          data.id,
          "internet_plan_change",
          `Forfait Internet: ${body.previous_plan_name ?? "—"} → ${new_plan_name} (${fmtMoney(new_monthly_price)}/mois, ${change_type})`,
          {
            plan_change_id: data.id,
            previous_plan_name: body.previous_plan_name ?? null,
            new_plan_name,
            new_monthly_price,
            new_speed_mbps: body.new_speed_mbps ?? null,
            change_type,
            effective_date,
          },
        );
        await sysNote(
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

        // ── Prorated charge on monthly invoice (never a separate invoice) ────
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

                  // Try to find a current pending/issued invoice for this subscription
                  const { data: currentInvoice } = await admin
                    .from("billing_invoices")
                    .select("id, invoice_number, cycle_start_date, cycle_end_date")
                    .eq("subscription_id", bSub.id)
                    .in("status", ["pending", "issued"])
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                  if (currentInvoice) {
                    // ── Case A: add line via canonical RPC ────────────────
                    // Phase 3 V2: aucun calcul fiscal côté Edge — la RPC
                    // add_prorata_line_to_invoice insère la ligne ET recalcule
                    // TPS/TVQ/total/balance_due côté DB dans une transaction.
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
                    if (proErr2) {
                      console.error("[internet-account-actions] add_prorata_line_to_invoice error:", proErr2);
                      throw proErr2;
                    }

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
                    // ── Case B: defer to next renewal via account_adjustments ─
                    const { data: acct } = await admin
                      .from("accounts")
                      .select("id")
                      .eq("client_id", client_user_id)
                      .maybeSingle();

                    if (acct?.id) {
                      await admin.from("account_adjustments").insert({
                        account_id: acct.id,
                        type: "fee",
                        amount: prorationSubtotal, // pré-taxes; billing-generate-renewals recalcule TPS+TVQ
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
          return json(400, { error: "action_type invalide" });
        }
        const meta = MODEM_LABELS[action_type];
        if (meta.critical && !body.reason) {
          return json(400, { error: "Raison obligatoire pour cette action" });
        }

        const { data, error } = await admin
          .from("internet_modem_actions")
          .insert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            subscription_id: body.subscription_id ?? null,
            modem_serial: body.modem_serial ?? null,
            modem_mac: body.modem_mac ?? null,
            action_type,
            reason: body.reason ?? null,
            status: "completed",
            performed_by: user.id,
            metadata: { idempotency_key: body.idempotency_key },
          })
          .select("id")
          .single();
        if (error) return json(500, { error: error.message });

        await audit("modem_action", {
          modem_action_id: data.id, action_type,
          modem_serial: body.modem_serial, modem_mac: body.modem_mac,
        });
        await activity(
          "internet_modem_action",
          data.id,
          "internet_modem_action",
          `Modem: ${meta.label}${body.modem_serial ? ` · S/N ${body.modem_serial}` : ""}`,
          { modem_action_id: data.id, action_type, modem_serial: body.modem_serial ?? null, modem_mac: body.modem_mac ?? null, reason: body.reason ?? null },
        );
        await sysNote(`[INTERNET] ${meta.label}${body.modem_serial ? ` · S/N ${body.modem_serial}` : ""}${body.reason ? ` · Raison: ${body.reason}` : ""}`);
        await enqueueEmail("client_internet_modem_action", {
          action_label: meta.label,
          modem_serial: body.modem_serial || "—",
          modem_mac: body.modem_mac || "—",
          reason: body.reason || "—",
          is_critical: meta.critical ? "true" : "false",
        });

        return json(200, { ok: true, modem_action_id: data.id });
      }

      // ============================================================
      case "run_diagnostic": {
        const diagnostic_type = body.diagnostic_type || "full";
        const { data, error } = await admin
          .from("internet_diagnostics")
          .insert({
            user_id: client_user_id,
            account_id: body.account_id ?? null,
            subscription_id: body.subscription_id ?? null,
            diagnostic_type,
            link_status: body.link_status ?? null,
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
        if (error) return json(500, { error: error.message });

        await audit("run_diagnostic", {
          diagnostic_id: data.id, diagnostic_type, link_status: body.link_status,
          download_mbps: body.download_mbps, upload_mbps: body.upload_mbps,
        });
        await activity(
          "internet_diagnostic",
          data.id,
          "internet_diagnostic",
          `Diagnostic Internet (${diagnostic_type}) — lien ${body.link_status ?? "—"}`,
          {
            diagnostic_id: data.id,
            diagnostic_type,
            link_status: body.link_status ?? null,
            download_mbps: body.download_mbps ?? null,
            upload_mbps: body.upload_mbps ?? null,
            latency_ms: body.latency_ms ?? null,
            packet_loss_pct: body.packet_loss_pct ?? null,
          },
        );
        await sysNote(
          `[INTERNET] Diagnostic ${diagnostic_type} — lien: ${body.link_status ?? "—"}` +
          ` · DL ${body.download_mbps ?? "—"} Mbps · UL ${body.upload_mbps ?? "—"} Mbps` +
          ` · latence ${body.latency_ms ?? "—"} ms · perte ${body.packet_loss_pct ?? "—"}%` +
          (body.notes ? ` · ${body.notes}` : ""),
        );
        await enqueueEmail("client_internet_diagnostic", {
          diagnostic_type,
          link_status: body.link_status || "—",
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
        const band_mode = body.band_mode || "dual";
        if (!["2.4", "5", "dual"].includes(band_mode)) {
          return json(400, { error: "band_mode invalide" });
        }
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

        const { error } = await admin
          .from("internet_wifi_settings")
          .upsert(payload, { onConflict: "user_id" });
        if (error) return json(500, { error: error.message });

        await audit("set_wifi", {
          band_mode, guest_enabled: !!body.guest_enabled,
          ssid_24: body.ssid_24, ssid_5: body.ssid_5,
        });
        await activity(
          "internet_wifi_change",
          null,
          "internet_wifi_settings",
          `WiFi mis à jour — bande ${band_mode}${body.guest_enabled ? ` · invité activé (${body.guest_ssid || "—"})` : " · invité désactivé"}`,
          { band_mode, ssid_24: body.ssid_24 ?? null, ssid_5: body.ssid_5 ?? null, guest_enabled: !!body.guest_enabled, guest_ssid: body.guest_ssid ?? null },
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
        const mode = body.static_ip_mode || "assign";

        if (mode === "release") {
          const id = body.assignment_id;
          if (!id) return json(400, { error: "assignment_id requis" });
          const { data: existing, error: fErr } = await admin
            .from("internet_static_ip_assignments")
            .select("id, status, user_id, ip_address")
            .eq("id", id)
            .maybeSingle();
          if (fErr) return json(500, { error: fErr.message });
          if (!existing) return json(404, { error: "Attribution introuvable" });
          if (existing.user_id !== client_user_id) return json(403, { error: "Cible invalide" });
          if (existing.status === "released") return json(409, { error: "Déjà libérée" });

          const { error: uErr } = await admin
            .from("internet_static_ip_assignments")
            .update({
              status: "released",
              released_at: new Date().toISOString(),
              released_reason: body.reason ?? null,
            })
            .eq("id", id);
          if (uErr) return json(500, { error: uErr.message });

          await audit("static_ip_release", { assignment_id: id, ip_address: existing.ip_address });
          await enqueueEmail("client_internet_static_ip", {
            mode: "released",
            ip_address: existing.ip_address || "—",
            monthly_price: fmtMoney(0),
            reason: body.reason || "—",
          });

          return json(200, { ok: true });
        }

        // assign
        const ip_address = (body.ip_address || "").trim();
        if (!ip_address || !isValidIp(ip_address)) {
          return json(400, { error: "ip_address IPv4 valide requise" });
        }
        const monthly_price = Number(body.monthly_price ?? 0);
        if (!Number.isFinite(monthly_price) || monthly_price < 0) {
          return json(400, { error: "monthly_price invalide" });
        }

        const { data, error } = await admin
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
            metadata: { idempotency_key: body.idempotency_key },
          })
          .select("id")
          .single();
        if (error) return json(500, { error: error.message });

        await audit("static_ip_assign", {
          assignment_id: data.id, ip_address, monthly_price,
        });
        await enqueueEmail("client_internet_static_ip", {
          mode: "assigned",
          ip_address,
          monthly_price: fmtMoney(monthly_price),
          reason: body.reason || "—",
        });

        return json(200, { ok: true, assignment_id: data.id });
      }

      default:
        return json(400, { error: "Action inconnue" });
    }
  } catch (e) {
    return json(500, { error: (e as Error).message || "Erreur serveur" });
  }
});
