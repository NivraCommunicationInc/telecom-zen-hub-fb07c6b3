/**
 * noc-monitor — Network Operations Center Health Monitor
 *
 * Runs on cron (every 30 min via pg_cron) and on-demand via HTTP.
 * Performs 8 health checks across BSS + OSS layers.
 * Each check is idempotent — does not create duplicate open alerts.
 *
 * Checks:
 *   1. Subscriptions stuck in "suspended" > SUSPEND_ESCALATE_DAYS
 *   2. Subscriptions stuck in "pending" > PENDING_STUCK_HOURS
 *   3. Invoices overdue > OVERDUE_ESCALATE_DAYS not voided (billing-lifecycle fault)
 *   4. Email queue failures in last 24h above threshold
 *   5. Provisioning failures in last 24h above threshold
 *   6. Critical billing_system_alerts unresolved > ALERT_ESCALATE_HOURS
 *   7. Low inventory items (table may not exist — skipped gracefully)
 *   8. Network elements offline > ELEMENT_OFFLINE_HOURS (table may not exist)
 *
 * Response: { checks: CheckResult[], summary: { ok, warning, critical } }
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Thresholds ────────────────────────────────────────────────────────────
const SUSPEND_ESCALATE_DAYS     = 15;   // Suspended subscription → escalate after N days
const PENDING_STUCK_HOURS       = 48;   // Pending subscription → stuck after N hours
const OVERDUE_ESCALATE_DAYS     = 12;   // Invoice overdue → escalate (lifecycle missed it)
const EMAIL_FAIL_THRESHOLD      = 5;    // N failed emails in 24h → warning
const PROVISIONING_FAIL_THRESHOLD = 3;  // N provisioning failures in 24h → warning
const ALERT_ESCALATE_HOURS      = 6;    // Unresolved critical alert → re-escalate after N hours
const ELEMENT_OFFLINE_HOURS     = 2;    // Network element not seen → warning after N hours

// ─── Types ─────────────────────────────────────────────────────────────────
type Severity = "info" | "warning" | "critical";

interface CheckResult {
  check: string;
  status: "ok" | "warning" | "critical" | "skipped";
  count: number;
  message: string;
  alerts_raised: number;
}

interface NocSummary {
  ok: number;
  warning: number;
  critical: number;
  skipped: number;
  total_alerts_raised: number;
  ran_at: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Insert a billing_system_alert only if no open alert of the same type+entity exists. */
async function raiseAlert(
  supabase: SupabaseClient,
  opts: {
    alert_type: string;
    entity_type: string;
    entity_id?: string;
    severity: Severity;
    message: string;
    details?: Record<string, unknown>;
  },
): Promise<boolean> {
  // Idempotency: skip if already open
  const query = supabase
    .from("billing_system_alerts")
    .select("id")
    .eq("alert_type", opts.alert_type)
    .eq("resolved", false);

  if (opts.entity_id) query.eq("entity_id", opts.entity_id);

  const { data: existing } = await query.maybeSingle();
  if (existing) return false; // Already open

  const { error } = await supabase.from("billing_system_alerts").insert({
    alert_type: opts.alert_type,
    entity_type: opts.entity_type,
    entity_id: opts.entity_id || null,
    severity: opts.severity,
    message: opts.message,
    details: opts.details || {},
    resolved: false,
  });

  if (error) {
    console.error(`[noc-monitor] Failed to raise alert ${opts.alert_type}:`, error.message);
    return false;
  }
  return true;
}

/** Check if a table exists (for optional OSS tables). */
async function tableExists(supabase: SupabaseClient, tableName: string): Promise<boolean> {
  const { error } = await supabase.from(tableName).select("id").limit(1);
  // If table doesn't exist, Supabase returns a specific error code
  return !error || !error.message.includes("does not exist");
}

// ─── Checks ────────────────────────────────────────────────────────────────

async function checkSuspendedSubscriptions(supabase: SupabaseClient): Promise<CheckResult> {
  const cutoff = new Date(Date.now() - SUSPEND_ESCALATE_DAYS * 86400 * 1000).toISOString();

  const { data, error } = await supabase
    .from("billing_subscriptions")
    .select("id, customer_id, plan_name, suspension_date, status")
    .eq("status", "suspended")
    .lt("suspension_date", cutoff)
    .limit(50);

  if (error) return { check: "suspended_subscriptions", status: "skipped", count: 0, message: error.message, alerts_raised: 0 };

  const rows = data || [];
  let raised = 0;

  for (const sub of rows) {
    const ok = await raiseAlert(supabase, {
      alert_type: "subscription_suspended_too_long",
      entity_type: "billing_subscription",
      entity_id: sub.id,
      severity: "warning",
      message: `Abonnement suspendu depuis plus de ${SUSPEND_ESCALATE_DAYS} jours — forfait: ${sub.plan_name}`,
      details: { customer_id: sub.customer_id, suspension_date: sub.suspension_date, plan_name: sub.plan_name },
    });
    if (ok) raised++;
  }

  return {
    check: "suspended_subscriptions",
    status: rows.length === 0 ? "ok" : "warning",
    count: rows.length,
    message: rows.length === 0
      ? `Aucun abonnement suspendu depuis > ${SUSPEND_ESCALATE_DAYS}j`
      : `${rows.length} abonnement(s) suspendu(s) depuis > ${SUSPEND_ESCALATE_DAYS}j`,
    alerts_raised: raised,
  };
}

async function checkPendingSubscriptions(supabase: SupabaseClient): Promise<CheckResult> {
  const cutoff = new Date(Date.now() - PENDING_STUCK_HOURS * 3600 * 1000).toISOString();

  const { data, error } = await supabase
    .from("billing_subscriptions")
    .select("id, customer_id, plan_name, created_at")
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .limit(20);

  if (error) return { check: "pending_subscriptions", status: "skipped", count: 0, message: error.message, alerts_raised: 0 };

  const rows = data || [];
  let raised = 0;

  for (const sub of rows) {
    const ok = await raiseAlert(supabase, {
      alert_type: "subscription_pending_stuck",
      entity_type: "billing_subscription",
      entity_id: sub.id,
      severity: "warning",
      message: `Abonnement bloqué en "pending" depuis > ${PENDING_STUCK_HOURS}h — nécessite activation manuelle`,
      details: { customer_id: sub.customer_id, plan_name: sub.plan_name, created_at: sub.created_at },
    });
    if (ok) raised++;
  }

  return {
    check: "pending_subscriptions",
    status: rows.length === 0 ? "ok" : "warning",
    count: rows.length,
    message: rows.length === 0
      ? `Aucun abonnement bloqué en pending`
      : `${rows.length} abonnement(s) bloqué(s) en pending > ${PENDING_STUCK_HOURS}h`,
    alerts_raised: raised,
  };
}

async function checkOverdueInvoices(supabase: SupabaseClient): Promise<CheckResult> {
  const cutoff = new Date(Date.now() - OVERDUE_ESCALATE_DAYS * 86400 * 1000).toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("billing_invoices")
    .select("id, invoice_number, customer_id, total, due_date, status")
    .not("status", "in", '("paid","cancelled","refunded","void","paid_by_promo","credit")')
    .lt("due_date", cutoff)
    .limit(50);

  if (error) return { check: "overdue_invoices", status: "skipped", count: 0, message: error.message, alerts_raised: 0 };

  const rows = data || [];
  let raised = 0;
  const severity: Severity = rows.length > 10 ? "critical" : "warning";

  for (const inv of rows) {
    const ok = await raiseAlert(supabase, {
      alert_type: "invoice_overdue_not_voided",
      entity_type: "billing_invoice",
      entity_id: inv.id,
      severity,
      message: `Facture ${inv.invoice_number} — ${inv.status} — échéance ${inv.due_date} — ${Number(inv.total).toFixed(2)}$ — non-traitée par billing-lifecycle`,
      details: { invoice_number: inv.invoice_number, customer_id: inv.customer_id, total: inv.total, due_date: inv.due_date, current_status: inv.status },
    });
    if (ok) raised++;
  }

  return {
    check: "overdue_invoices",
    status: rows.length === 0 ? "ok" : severity,
    count: rows.length,
    message: rows.length === 0
      ? `Aucune facture en retard non-traitée`
      : `${rows.length} facture(s) échue(s) > ${OVERDUE_ESCALATE_DAYS}j non-traitées`,
    alerts_raised: raised,
  };
}

async function checkEmailFailures(supabase: SupabaseClient): Promise<CheckResult> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { count, error } = await supabase
    .from("email_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("created_at", since);

  if (error) return { check: "email_failures", status: "skipped", count: 0, message: error.message, alerts_raised: 0 };

  const n = count || 0;
  const severity: Severity = n > EMAIL_FAIL_THRESHOLD * 3 ? "critical" : "warning";
  let raised = 0;

  if (n >= EMAIL_FAIL_THRESHOLD) {
    const ok = await raiseAlert(supabase, {
      alert_type: "email_queue_failures_spike",
      entity_type: "email_queue",
      severity,
      message: `${n} emails en échec dans les dernières 24h (seuil: ${EMAIL_FAIL_THRESHOLD})`,
      details: { count: n, since, threshold: EMAIL_FAIL_THRESHOLD },
    });
    if (ok) raised++;
  }

  return {
    check: "email_failures",
    status: n < EMAIL_FAIL_THRESHOLD ? "ok" : severity,
    count: n,
    message: n < EMAIL_FAIL_THRESHOLD
      ? `${n} email(s) en échec — sous le seuil (${EMAIL_FAIL_THRESHOLD})`
      : `${n} emails en échec dans les 24 dernières heures`,
    alerts_raised: raised,
  };
}

async function checkProvisioningFailures(supabase: SupabaseClient): Promise<CheckResult> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  // Table may not exist yet — use try/catch
  try {
    const { count, error } = await supabase
      .from("provisioning_log")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", since);

    if (error?.message?.includes("does not exist")) {
      return { check: "provisioning_failures", status: "skipped", count: 0, message: "Table provisioning_log not yet created", alerts_raised: 0 };
    }
    if (error) return { check: "provisioning_failures", status: "skipped", count: 0, message: error.message, alerts_raised: 0 };

    const n = count || 0;
    const severity: Severity = n > PROVISIONING_FAIL_THRESHOLD * 3 ? "critical" : "warning";
    let raised = 0;

    if (n >= PROVISIONING_FAIL_THRESHOLD) {
      const ok = await raiseAlert(supabase, {
        alert_type: "provisioning_failures_spike",
        entity_type: "provisioning_log",
        severity,
        message: `${n} échecs de provisioning dans les 24 dernières heures (seuil: ${PROVISIONING_FAIL_THRESHOLD})`,
        details: { count: n, since, threshold: PROVISIONING_FAIL_THRESHOLD },
      });
      if (ok) raised++;
    }

    return {
      check: "provisioning_failures",
      status: n < PROVISIONING_FAIL_THRESHOLD ? "ok" : severity,
      count: n,
      message: n < PROVISIONING_FAIL_THRESHOLD
        ? `${n} échec(s) provisioning — sous le seuil`
        : `${n} échecs provisioning dans les 24 dernières heures`,
      alerts_raised: raised,
    };
  } catch {
    return { check: "provisioning_failures", status: "skipped", count: 0, message: "provisioning_log not available", alerts_raised: 0 };
  }
}

async function checkUnresolvedCriticalAlerts(supabase: SupabaseClient): Promise<CheckResult> {
  const cutoff = new Date(Date.now() - ALERT_ESCALATE_HOURS * 3600 * 1000).toISOString();

  const { data, error } = await supabase
    .from("billing_system_alerts")
    .select("id, alert_type, entity_type, entity_id, created_at, severity")
    .eq("resolved", false)
    .eq("severity", "critical")
    .lt("created_at", cutoff)
    .neq("alert_type", "noc_escalation") // Avoid re-escalating our own escalations
    .limit(20);

  if (error) return { check: "unresolved_critical_alerts", status: "skipped", count: 0, message: error.message, alerts_raised: 0 };

  const rows = data || [];
  let raised = 0;

  if (rows.length > 0) {
    const ok = await raiseAlert(supabase, {
      alert_type: "noc_escalation",
      entity_type: "billing_system_alerts",
      severity: "critical",
      message: `${rows.length} alerte(s) critique(s) non-résolue(s) depuis > ${ALERT_ESCALATE_HOURS}h — intervention requise`,
      details: {
        count: rows.length,
        cutoff,
        alert_ids: rows.map(r => r.id),
        alert_types: [...new Set(rows.map(r => r.alert_type))],
      },
    });
    if (ok) raised++;
  }

  return {
    check: "unresolved_critical_alerts",
    status: rows.length === 0 ? "ok" : "critical",
    count: rows.length,
    message: rows.length === 0
      ? `Aucune alerte critique non-résolue > ${ALERT_ESCALATE_HOURS}h`
      : `${rows.length} alerte(s) critique(s) non-résolue(s) — escalade requise`,
    alerts_raised: raised,
  };
}

async function checkLowInventory(supabase: SupabaseClient): Promise<CheckResult> {
  // Test existence first
  const { error: existErr } = await supabase.from("inventory_items").select("id").limit(1);
  if (existErr?.message?.includes("does not exist")) {
    return { check: "low_inventory", status: "skipped", count: 0, message: "Table inventory_items not yet created", alerts_raised: 0 };
  }

  const { data: lowItems, error: lowErr } = await supabase
    .from("v_inventory_low_stock")
    .select("id, name, category, quantity, reorder_point, stock_gap")
    .limit(30);

  if (lowErr) {
    // View might not exist — fallback to direct query
    const { data: fallback } = await supabase
      .from("inventory_items")
      .select("id, name, category, quantity, reorder_point")
      .eq("status", "in_stock")
      .limit(50);

    const below = (fallback || []).filter(i => (i.quantity || 0) <= (i.reorder_point || 5));
    let raised = 0;
    for (const item of below) {
      const ok = await raiseAlert(supabase, {
        alert_type: "inventory_low_stock",
        entity_type: "inventory_item",
        entity_id: item.id,
        severity: item.quantity === 0 ? "critical" : "warning",
        message: `Stock bas — ${item.name} (${item.category}): ${item.quantity} unité(s) restante(s) (seuil: ${item.reorder_point})`,
        details: { category: item.category, quantity: item.quantity, reorder_point: item.reorder_point },
      });
      if (ok) raised++;
    }
    return { check: "low_inventory", status: below.length === 0 ? "ok" : "warning", count: below.length, message: `${below.length} article(s) sous le seuil`, alerts_raised: raised };
  }

  const rows = lowItems || [];
  let raised = 0;
  for (const item of rows) {
    const ok = await raiseAlert(supabase, {
      alert_type: "inventory_low_stock",
      entity_type: "inventory_item",
      entity_id: item.id,
      severity: (item.quantity || 0) === 0 ? "critical" : "warning",
      message: `Stock bas — ${item.name} (${item.category}): ${item.quantity} unité(s) restante(s) (seuil: ${item.reorder_point})`,
      details: { category: item.category, quantity: item.quantity, reorder_point: item.reorder_point, stock_gap: item.stock_gap },
    });
    if (ok) raised++;
  }

  return {
    check: "low_inventory",
    status: rows.length === 0 ? "ok" : "warning",
    count: rows.length,
    message: rows.length === 0 ? "Tous les stocks sont au-dessus du seuil" : `${rows.length} article(s) sous le seuil de réapprovisionnement`,
    alerts_raised: raised,
  };
}

async function checkNetworkElements(supabase: SupabaseClient): Promise<CheckResult> {
  const { error: existErr } = await supabase.from("network_elements").select("id").limit(1);
  if (existErr?.message?.includes("does not exist")) {
    return { check: "network_elements", status: "skipped", count: 0, message: "Table network_elements not yet created", alerts_raised: 0 };
  }

  const cutoff = new Date(Date.now() - ELEMENT_OFFLINE_HOURS * 3600 * 1000).toISOString();

  // Elements that have a last_seen_at but it's stale, and status=active
  const { data, error } = await supabase
    .from("network_elements")
    .select("id, name, element_type, ip_address, last_seen_at, customer_id, site_id")
    .eq("status", "active")
    .not("last_seen_at", "is", null)
    .lt("last_seen_at", cutoff)
    .limit(20);

  if (error) return { check: "network_elements", status: "skipped", count: 0, message: error.message, alerts_raised: 0 };

  const rows = data || [];
  let raised = 0;

  for (const el of rows) {
    const isCritical = ["olt", "radius_server", "router"].includes(el.element_type);
    const ok = await raiseAlert(supabase, {
      alert_type: "network_element_offline",
      entity_type: "network_element",
      entity_id: el.id,
      severity: isCritical ? "critical" : "warning",
      message: `Équipement réseau hors-ligne: ${el.name} (${el.element_type}) — dernière vue: ${el.last_seen_at}`,
      details: {
        element_type: el.element_type,
        ip_address: el.ip_address,
        last_seen_at: el.last_seen_at,
        customer_id: el.customer_id,
        site_id: el.site_id,
      },
    });
    if (ok) raised++;
  }

  const hasCritical = rows.some(r => ["olt", "radius_server", "router"].includes(r.element_type));

  return {
    check: "network_elements",
    status: rows.length === 0 ? "ok" : hasCritical ? "critical" : "warning",
    count: rows.length,
    message: rows.length === 0
      ? `Tous les équipements réseau sont joignables`
      : `${rows.length} équipement(s) réseau hors-ligne > ${ELEMENT_OFFLINE_HOURS}h`,
    alerts_raised: raised,
  };
}

// ─── Main handler ──────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const respond = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth: accept service role key or cron trigger (no auth header = internal cron)
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (authHeader && token !== serviceKey) {
      return respond(403, { error: "Service role key required" });
    }

    console.log("[noc-monitor] Starting health checks...");
    const startedAt = new Date().toISOString();

    // Run all checks — continue even if one fails
    const checkResults: CheckResult[] = await Promise.allSettled([
      checkSuspendedSubscriptions(supabase),
      checkPendingSubscriptions(supabase),
      checkOverdueInvoices(supabase),
      checkEmailFailures(supabase),
      checkProvisioningFailures(supabase),
      checkUnresolvedCriticalAlerts(supabase),
      checkLowInventory(supabase),
      checkNetworkElements(supabase),
    ]).then(results =>
      results.map((r, i) => {
        if (r.status === "fulfilled") return r.value;
        console.error(`[noc-monitor] Check ${i} threw:`, r.reason);
        return {
          check: `check_${i}`,
          status: "skipped" as const,
          count: 0,
          message: `Exception: ${r.reason}`,
          alerts_raised: 0,
        };
      })
    );

    const summary: NocSummary = {
      ok:       checkResults.filter(r => r.status === "ok").length,
      warning:  checkResults.filter(r => r.status === "warning").length,
      critical: checkResults.filter(r => r.status === "critical").length,
      skipped:  checkResults.filter(r => r.status === "skipped").length,
      total_alerts_raised: checkResults.reduce((s, r) => s + r.alerts_raised, 0),
      ran_at: startedAt,
    };

    console.log(`[noc-monitor] Done — ok:${summary.ok} warn:${summary.warning} critical:${summary.critical} alerts:${summary.total_alerts_raised}`);

    return respond(200, { checks: checkResults, summary });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[noc-monitor] Fatal error:", msg);
    return respond(500, { error: msg });
  }
});
