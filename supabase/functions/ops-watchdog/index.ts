/**
 * ops-watchdog — Twice-daily operational monitoring watchdog.
 *
 * Runs at 07:00 and 19:00 America/Montreal (11:00 and 23:00 UTC).
 * Sends a single consolidated email to ops@ ONLY if problems are detected.
 * Silence = system is healthy. No spam.
 *
 * Anti-spam: each alert type uses a deterministic event_key including the date,
 * so re-running the watchdog on the same day for the same problem won't queue
 * a duplicate email (email_queue dedup — Bloc 4).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { recordHeartbeat } from "../_shared/cronHeartbeat.ts";

import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALERT_EMAIL = "support@nivra-telecom.ca";
const APP_ORIGIN = "https://www.nivra-telecom.ca";

// Crons that MUST run daily or more often. If any of these hasn't produced a
// success heartbeat in >24h, we alert. `email-queue-drain` runs every minute
// so its threshold is tighter.
const CRITICAL_CRONS: { name: string; maxAgeMinutes: number }[] = [
  { name: "billing-generate-renewals", maxAgeMinutes: 60 * 25 },
  { name: "billing-dunning-engine", maxAgeMinutes: 60 * 25 },
  { name: "billing-lifecycle", maxAgeMinutes: 60 * 25 },
  { name: "billing-daily-overdue-reminders", maxAgeMinutes: 60 * 25 },
  { name: "billing-reconcile-invoices", maxAgeMinutes: 60 * 25 },
  { name: "contract-signature-reminders-daily", maxAgeMinutes: 60 * 25 },
  { name: "email-queue-drain", maxAgeMinutes: 30 },
  // paypal-reconcile retiré en Phase 3.C.4 (cron désinscrit, edge stub 410)
];

interface Alert {
  key: string;
  title: string;
  what: string;
  since: string;
  impact: string;
  link: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase: any = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const startedAt = new Date();
  const todayKey = startedAt.toISOString().slice(0, 10);
  const alerts: Alert[] = [];

  try {
    // ── 1) Silent crons (no successful heartbeat within threshold) ─────────
    for (const c of CRITICAL_CRONS) {
      const cutoff = new Date(Date.now() - c.maxAgeMinutes * 60_000).toISOString();
      const { data: hb } = await supabase
        .from("cron_heartbeats")
        .select("started_at,status,error_message")
        .eq("cron_name", c.name)
        .eq("status", "success")
        .gte("started_at", cutoff)
        .order("started_at", { ascending: false })
        .limit(1);
      if (!hb || hb.length === 0) {
        // check when the LAST heartbeat of any kind was
        const { data: last } = await supabase
          .from("cron_heartbeats")
          .select("started_at,status,error_message")
          .eq("cron_name", c.name)
          .order("started_at", { ascending: false })
          .limit(1);
        const lastSeen = last?.[0]?.started_at ?? "jamais";
        alerts.push({
          key: `cron_silent_${c.name}_${todayKey}`,
          title: `Cron silencieux : ${c.name}`,
          what: `Aucune exécution réussie depuis plus de ${c.maxAgeMinutes} min.`,
          since: `Dernière trace : ${lastSeen}`,
          impact: c.name.startsWith("billing")
            ? "Facturation potentiellement arrêtée — clients à risque de coupure injustifiée ou de non-facturation."
            : "Fonction critique en panne silencieuse.",
          link: `${APP_ORIGIN}/core/system-health`,
        });
      }
    }

    // ── 2) Emails bloqués > 2h en queued/failed ───────────────────────────
    const twoHoursAgo = new Date(Date.now() - 2 * 3600_000).toISOString();
    const { data: stuckEmails } = await supabase
      .from("email_queue")
      .select("template_key,status")
      .in("status", ["queued", "failed"])
      .lt("created_at", twoHoursAgo);
    if ((stuckEmails?.length ?? 0) > 0) {
      const byTemplate = new Map<string, number>();
      for (const e of stuckEmails as any[]) {
        const k = `${e.status}:${e.template_key ?? "unknown"}`;
        byTemplate.set(k, (byTemplate.get(k) ?? 0) + 1);
      }
      const summary = Array.from(byTemplate.entries()).map(([k, n]) => `${k} × ${n}`).join(", ");
      alerts.push({
        key: `emails_stuck_${todayKey}`,
        title: `Emails bloqués depuis >2h (${stuckEmails!.length})`,
        what: `${stuckEmails!.length} email(s) coincé(s) en file.`,
        since: `Templates : ${summary}`,
        impact: "Clients ne reçoivent pas leurs confirmations / factures.",
        link: `${APP_ORIGIN}/core/system-health`,
      });
    }

    // ── 3) Paiements autopay échoués 24h ──────────────────────────────────
    const yesterday = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data: failedPayments } = await supabase
      .from("payments")
      .select("id,amount,error_message,client_id,created_at,provider")
      .eq("status", "failed")
      .gte("created_at", yesterday)
      .limit(50);
    if ((failedPayments?.length ?? 0) > 0) {
      const clients = new Set((failedPayments as any[]).map((p) => p.client_id).filter(Boolean));
      alerts.push({
        key: `autopay_failures_${todayKey}`,
        title: `Paiements échoués (24h) : ${failedPayments!.length}`,
        what: `${failedPayments!.length} paiement(s) en échec, ${clients.size} client(s) impactés.`,
        since: yesterday,
        impact: "Revenus non perçus, risque de suspension automatique de comptes valides.",
        link: `${APP_ORIGIN}/core/payments?status=failed`,
      });
    }

    // ── 4) Abonnements actifs sans facture pour cycle passé ───────────────
    const { data: overdueSubs } = await supabase
      .from("billing_subscriptions")
      .select("id,client_id,next_billing_date,current_period_end")
      .eq("status", "active")
      .lt("next_billing_date", new Date().toISOString())
      .limit(100);
    const missingInvoices: string[] = [];
    for (const s of (overdueSubs ?? []) as any[]) {
      const { count } = await supabase
        .from("billing_invoices")
        .select("id", { count: "exact", head: true })
        .eq("subscription_id", s.id)
        .gte("created_at", new Date(Date.now() - 48 * 3600_000).toISOString());
      if ((count ?? 0) === 0) missingInvoices.push(s.id);
    }
    if (missingInvoices.length > 0) {
      alerts.push({
        key: `missing_invoices_${todayKey}`,
        title: `Factures attendues non générées : ${missingInvoices.length}`,
        what: `${missingInvoices.length} abonnement(s) actif(s) au-delà de leur cycle sans facture.`,
        since: "Cycle passé, aucune facture créée dans les 48h.",
        impact: "Revenus manquants + risque de suspension automatique injustifiée.",
        link: `${APP_ORIGIN}/core/subscriptions`,
      });
    }

    // ── 5) Alertes critiques non résolues >24h ────────────────────────────
    const { count: unresolvedAlerts } = await supabase
      .from("billing_system_alerts")
      .select("id", { count: "exact", head: true })
      .eq("resolved", false)
      .lt("created_at", yesterday);
    if ((unresolvedAlerts ?? 0) > 0) {
      alerts.push({
        key: `unresolved_alerts_${todayKey}`,
        title: `Alertes système non résolues : ${unresolvedAlerts}`,
        what: `${unresolvedAlerts} alerte(s) dans billing_system_alerts non traitée(s) depuis >24h.`,
        since: `>${yesterday}`,
        impact: "Problèmes de facturation potentiellement ignorés.",
        link: `${APP_ORIGIN}/core/system-status`,
      });
    }

    // ── ENQUEUE SINGLE CONSOLIDATED EMAIL ─────────────────────────────────
    let emailSent = false;
    if (alerts.length > 0) {
      const rows = alerts.map((a) => `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
            <div style="font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(a.title)}</div>
            <div style="font-size:13px;color:#334155;margin-top:4px;">${escapeHtml(a.what)}</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px;"><b>Depuis :</b> ${escapeHtml(a.since)}</div>
            <div style="font-size:12px;color:#64748b;margin-top:2px;"><b>Impact :</b> ${escapeHtml(a.impact)}</div>
            <div style="margin-top:8px;"><a href="${a.link}" style="color:#0066CC;font-size:13px;font-weight:600;text-decoration:none;">→ Ouvrir dans Nivra Core</a></div>
          </td>
        </tr>`).join("");

      const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,Segoe UI,Arial,sans-serif;">
        <table role="presentation" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr><td style="padding:20px 24px;background:#0066CC;color:#ffffff;">
            <div style="font-size:12px;font-weight:600;letter-spacing:1px;opacity:0.9;">NIVRA — WATCHDOG OPS</div>
            <div style="font-size:20px;font-weight:800;margin-top:4px;">${alerts.length} alerte(s) détectée(s)</div>
            <div style="font-size:12px;opacity:0.9;margin-top:4px;">Scan du ${new Date().toISOString()}</div>
          </td></tr>
          <tr><td><table style="width:100%;border-collapse:collapse;">${rows}</table></td></tr>
          <tr><td style="padding:16px 24px;background:#f1f5f9;font-size:11px;color:#64748b;">
            Email interne automatique — silence = système sain. Anti-spam : 1× par 24h par alerte.
          </td></tr>
        </table></body></html>`;

      // Consolidated event_key: one email per day maximum for the aggregated report
      const eventKey = `ops_watchdog_${todayKey}_${alerts.map(a => a.key).sort().join("|")}`.slice(0, 400);

      const { error: qErr } = await enqueueCommunication({
        channel: "email",
        templateKey: "ops_watchdog_alert",
        recipient: ALERT_EMAIL,
        idempotencyKey: eventKey,
        templateVars: { alerts, scanned_at: new Date().toISOString(), language: "fr" },
      });
      // The unique-index trigger from Bloc 4 silently skips duplicates.
      emailSent = !qErr;
      if (qErr) console.warn("[ops-watchdog] email enqueue warning:", qErr);
    }

    const summary = { alerts_count: alerts.length, email_sent: emailSent, alerts: alerts.map(a => a.key) };
    await recordHeartbeat(supabase, "ops-watchdog", "success", startedAt, summary);

    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ops-watchdog] fatal:", msg);
    await recordHeartbeat(supabase, "ops-watchdog", "error", startedAt, {}, msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
