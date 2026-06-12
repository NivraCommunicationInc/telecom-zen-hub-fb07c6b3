/**
 * revenue-assurance — Nivra Revenue Assurance Engine
 *
 * Detects revenue leakage across 8 categories. Runs on cron (daily at 09:00 UTC)
 * and on-demand via HTTP. Each finding raises an idempotent billing_system_alert.
 *
 * Checks:
 *   1. ra_renewal_gap              — Active sub with cycle_end past, no renewal invoice
 *   2. ra_paid_balance_mismatch    — Invoice status=paid but balance_due > 0.01
 *   3. ra_missing_tax              — Invoice subtotal > $5 with TPS+TVQ = 0 (tax leak)
 *   4. ra_duplicate_payment        — Same provider_payment_id on 2+ payments
 *   5. ra_voided_with_payment      — Void/cancelled invoice that has a confirmed payment
 *   6. ra_active_overdue_unsuspended — Active sub with overdue balance > 5 days (lifecycle missed)
 *   7. ra_price_mismatch           — Invoice total deviates > $1 from sub plan_price + taxes
 *   8. ra_orphaned_payment         — Confirmed payment on void/cancelled invoice
 *
 * Quebec tax rates: TPS 5% + TVQ 9.975%
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Quebec tax rates
const TPS_RATE  = 0.05;
const TVQ_RATE  = 0.09975;
const TAX_RATE  = TPS_RATE + TVQ_RATE; // 14.975%

// ─── Types ────────────────────────────────────────────────────────────────────

interface CheckResult {
  check: string;
  label: string;
  findings: number;
  alerts_raised: number;
  revenue_at_risk: number; // CAD
  status: "ok" | "warning" | "critical";
  message: string;
}

interface RAReport {
  checks: CheckResult[];
  summary: {
    total_findings: number;
    total_alerts_raised: number;
    total_revenue_at_risk: number;
    critical: number;
    warning: number;
    ok: number;
    ran_at: string;
    environment: string;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function raiseAlert(
  supabase: SupabaseClient,
  opts: {
    alert_type: string;
    entity_type: string;
    entity_id?: string;
    severity: "info" | "warning" | "critical";
    message: string;
    details?: Record<string, unknown>;
  },
): Promise<boolean> {
  let query = supabase
    .from("billing_system_alerts")
    .select("id")
    .eq("alert_type", opts.alert_type)
    .eq("resolved", false);

  if (opts.entity_id) query = query.eq("entity_id", opts.entity_id);

  const { data: existing } = await query.maybeSingle();
  if (existing) return false;

  // message stored inside details.message (no top-level message column)
  const { error } = await supabase.from("billing_system_alerts").insert({
    alert_type: opts.alert_type,
    entity_type: opts.entity_type,
    entity_id: opts.entity_id || null,
    severity: opts.severity,
    details: { ...(opts.details || {}), message: opts.message },
    resolved: false,
  });
  return !error;
}

// ─── Check 1: Active subscription with no renewal invoice ─────────────────────

async function checkRenewalGap(supabase: SupabaseClient): Promise<CheckResult> {
  // Active subs whose cycle_end_date passed > 2 days ago with no invoice for next cycle
  const cutoff = new Date(Date.now() - 2 * 86400 * 1000).toISOString().split("T")[0];

  const { data: subs, error } = await supabase
    .from("billing_subscriptions")
    .select("id, customer_id, plan_name, plan_price, cycle_end_date, next_renewal_at")
    .eq("status", "active")
    .lt("cycle_end_date", cutoff)
    .eq("environment", "production")
    .limit(50);

  if (error) return { check: "ra_renewal_gap", label: "Renouvellements manquants", findings: 0, alerts_raised: 0, revenue_at_risk: 0, status: "ok", message: error.message };

  let raised = 0;
  let revenueAtRisk = 0;

  for (const sub of subs || []) {
    // Verify no invoice exists for a cycle after cycle_end_date
    const { count } = await supabase
      .from("billing_invoices")
      .select("*", { count: "exact", head: true })
      .eq("subscription_id", sub.id)
      .gt("cycle_start_date", sub.cycle_end_date)
      .not("status", "in", '("cancelled","void")');

    if ((count || 0) > 0) continue; // Renewal invoice exists — OK

    revenueAtRisk += Number(sub.plan_price) * (1 + TAX_RATE);
    const ok = await raiseAlert(supabase, {
      alert_type: "ra_renewal_gap",
      entity_type: "billing_subscription",
      entity_id: sub.id,
      severity: "critical",
      message: `Renouvellement manquant — abonnement ${sub.plan_name} (cycle terminé ${sub.cycle_end_date}) — ${(Number(sub.plan_price) * (1 + TAX_RATE)).toFixed(2)}$ en risque`,
      details: { customer_id: sub.customer_id, plan_name: sub.plan_name, plan_price: sub.plan_price, cycle_end_date: sub.cycle_end_date, next_renewal_at: sub.next_renewal_at },
    });
    if (ok) raised++;
  }

  const n = (subs || []).length;
  return {
    check: "ra_renewal_gap",
    label: "Renouvellements manquants",
    findings: n,
    alerts_raised: raised,
    revenue_at_risk: revenueAtRisk,
    status: n === 0 ? "ok" : n > 5 ? "critical" : "warning",
    message: n === 0 ? "Tous les renouvellements sont générés" : `${n} abonnement(s) actif(s) sans facture de renouvellement`,
  };
}

// ─── Check 2: Paid invoice with balance_due > 0 ───────────────────────────────

async function checkPaidBalanceMismatch(supabase: SupabaseClient): Promise<CheckResult> {
  const { data, error } = await supabase
    .from("billing_invoices")
    .select("id, invoice_number, customer_id, subscription_id, total, balance_due, amount_paid")
    .eq("status", "paid")
    .gt("balance_due", 0.01)
    .eq("environment", "production")
    .limit(50);

  if (error) return { check: "ra_paid_balance_mismatch", label: "Solde résiduel sur factures payées", findings: 0, alerts_raised: 0, revenue_at_risk: 0, status: "ok", message: error.message };

  const rows = data || [];
  let raised = 0;
  const revenueAtRisk = rows.reduce((s: number, r: any) => s + Number(r.balance_due || 0), 0);

  for (const inv of rows) {
    const ok = await raiseAlert(supabase, {
      alert_type: "ra_paid_balance_mismatch",
      entity_type: "billing_invoice",
      entity_id: inv.id,
      severity: "warning",
      message: `Facture ${inv.invoice_number} marquée "payée" mais balance_due=${Number(inv.balance_due).toFixed(2)}$ — total=${Number(inv.total).toFixed(2)}$ amount_paid=${Number(inv.amount_paid || 0).toFixed(2)}$`,
      details: { invoice_number: inv.invoice_number, customer_id: inv.customer_id, total: inv.total, amount_paid: inv.amount_paid, balance_due: inv.balance_due },
    });
    if (ok) raised++;
  }

  return {
    check: "ra_paid_balance_mismatch",
    label: "Solde résiduel sur factures payées",
    findings: rows.length,
    alerts_raised: raised,
    revenue_at_risk: revenueAtRisk,
    status: rows.length === 0 ? "ok" : "warning",
    message: rows.length === 0 ? "Aucun solde résiduel sur factures payées" : `${rows.length} facture(s) payées avec balance_due > 0 — ${revenueAtRisk.toFixed(2)}$ en risque`,
  };
}

// ─── Check 3: Invoice with missing taxes (TPS+TVQ = 0 on taxable amount) ──────

async function checkMissingTax(supabase: SupabaseClient): Promise<CheckResult> {
  // Invoices with subtotal > $5, not credit/adjustment, and both TPS and TVQ = 0
  const since = new Date(Date.now() - 90 * 86400 * 1000).toISOString(); // Last 90 days

  const { data, error } = await supabase
    .from("billing_invoices")
    .select("id, invoice_number, customer_id, subscription_id, subtotal, tps_amount, tvq_amount, total, type")
    .gt("subtotal", 5)
    .eq("tps_amount", 0)
    .eq("tvq_amount", 0)
    .not("type", "in", '("credit","adjustment")')
    .not("status", "in", '("cancelled","void","draft")')
    .eq("environment", "production")
    .gte("created_at", since)
    .limit(50);

  if (error) return { check: "ra_missing_tax", label: "Taxes manquantes", findings: 0, alerts_raised: 0, revenue_at_risk: 0, status: "ok", message: error.message };

  const rows = data || [];
  let raised = 0;
  // Revenue at risk = missing taxes on each invoice
  const revenueAtRisk = rows.reduce((s: number, r: any) => s + Number(r.subtotal || 0) * TAX_RATE, 0);

  for (const inv of rows) {
    const expectedTax = Number(inv.subtotal) * TAX_RATE;
    const ok = await raiseAlert(supabase, {
      alert_type: "ra_missing_tax",
      entity_type: "billing_invoice",
      entity_id: inv.id,
      severity: "critical",
      message: `Facture ${inv.invoice_number} — taxes manquantes — sous-total ${Number(inv.subtotal).toFixed(2)}$ sans TPS/TVQ — ${expectedTax.toFixed(2)}$ de taxes non-collectées`,
      details: { invoice_number: inv.invoice_number, customer_id: inv.customer_id, subtotal: inv.subtotal, expected_tps: (Number(inv.subtotal) * TPS_RATE).toFixed(2), expected_tvq: (Number(inv.subtotal) * TVQ_RATE).toFixed(2), type: inv.type },
    });
    if (ok) raised++;
  }

  return {
    check: "ra_missing_tax",
    label: "Taxes manquantes (TPS/TVQ)",
    findings: rows.length,
    alerts_raised: raised,
    revenue_at_risk: revenueAtRisk,
    status: rows.length === 0 ? "ok" : "critical",
    message: rows.length === 0 ? "Toutes les factures taxables ont TPS+TVQ" : `${rows.length} facture(s) avec taxes manquantes — ${revenueAtRisk.toFixed(2)}$ de taxes non-collectées`,
  };
}

// ─── Check 4: Duplicate provider_payment_id ────────────────────────────────────

async function checkDuplicatePayments(supabase: SupabaseClient): Promise<CheckResult> {
  // Find provider_payment_id values that appear on 2+ confirmed payments
  // Supabase doesn't support GROUP BY directly, so we use a workaround
  const since = new Date(Date.now() - 90 * 86400 * 1000).toISOString();

  const { data, error } = await supabase
    .from("billing_payments")
    .select("id, invoice_id, customer_id, amount, provider_payment_id, status, created_at")
    .not("provider_payment_id", "is", null)
    .eq("status", "confirmed")
    .gte("created_at", since)
    .order("provider_payment_id")
    .limit(500);

  if (error) return { check: "ra_duplicate_payment", label: "Paiements en double", findings: 0, alerts_raised: 0, revenue_at_risk: 0, status: "ok", message: error.message };

  // Group by provider_payment_id
  const grouped: Record<string, any[]> = {};
  for (const p of data || []) {
    const key = p.provider_payment_id;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  }

  const duplicates = Object.entries(grouped).filter(([, payments]) => payments.length > 1);
  let raised = 0;
  let revenueAtRisk = 0;

  for (const [ppid, payments] of duplicates) {
    const totalAmount = payments.reduce((s, p) => s + Number(p.amount), 0);
    const excess = totalAmount - Number(payments[0].amount); // Extra amount applied
    revenueAtRisk += excess;
    const ok = await raiseAlert(supabase, {
      alert_type: "ra_duplicate_payment",
      entity_type: "billing_payment",
      entity_id: payments[0].id,
      severity: "critical",
      message: `Paiement en double — provider_payment_id "${ppid}" apparaît sur ${payments.length} paiements — montant total ${totalAmount.toFixed(2)}$`,
      details: { provider_payment_id: ppid, payment_count: payments.length, total_amount: totalAmount, payment_ids: payments.map(p => p.id), invoice_ids: payments.map(p => p.invoice_id) },
    });
    if (ok) raised++;
  }

  return {
    check: "ra_duplicate_payment",
    label: "Paiements en double",
    findings: duplicates.length,
    alerts_raised: raised,
    revenue_at_risk: revenueAtRisk,
    status: duplicates.length === 0 ? "ok" : "critical",
    message: duplicates.length === 0 ? "Aucun doublon de paiement détecté" : `${duplicates.length} provider_payment_id en double — fraude/double-traitement possible`,
  };
}

// ─── Check 5: Void/cancelled invoice with confirmed payment ────────────────────

async function checkVoidedWithPayment(supabase: SupabaseClient): Promise<CheckResult> {
  // Find invoices that are void/cancelled but have confirmed payments
  const { data, error } = await supabase
    .from("billing_invoices")
    .select("id, invoice_number, customer_id, total, status")
    .in("status", ["void", "cancelled"])
    .eq("environment", "production")
    .limit(200);

  if (error) return { check: "ra_voided_with_payment", label: "Factures annulées avec paiement", findings: 0, alerts_raised: 0, revenue_at_risk: 0, status: "ok", message: error.message };

  let raised = 0;
  let revenueAtRisk = 0;
  let findings = 0;

  for (const inv of data || []) {
    const { count } = await supabase
      .from("billing_payments")
      .select("*", { count: "exact", head: true })
      .eq("invoice_id", inv.id)
      .eq("status", "confirmed");

    if ((count || 0) === 0) continue;
    findings++;
    revenueAtRisk += Number(inv.total || 0);
    const ok = await raiseAlert(supabase, {
      alert_type: "ra_voided_with_payment",
      entity_type: "billing_invoice",
      entity_id: inv.id,
      severity: "warning",
      message: `Facture ${inv.invoice_number} (${inv.status}) a ${count} paiement(s) confirmé(s) — ${Number(inv.total).toFixed(2)}$ reçu mais facture annulée`,
      details: { invoice_number: inv.invoice_number, customer_id: inv.customer_id, total: inv.total, invoice_status: inv.status, payment_count: count },
    });
    if (ok) raised++;
  }

  return {
    check: "ra_voided_with_payment",
    label: "Factures annulées avec paiement",
    findings,
    alerts_raised: raised,
    revenue_at_risk: revenueAtRisk,
    status: findings === 0 ? "ok" : "warning",
    message: findings === 0 ? "Aucune facture annulée avec paiement" : `${findings} facture(s) annulée(s) avec paiement confirmé — ${revenueAtRisk.toFixed(2)}$ à réconcilier`,
  };
}

// ─── Check 6: Active subscription with overdue unpaid invoice, not suspended ──

async function checkActiveOverdueUnsuspended(supabase: SupabaseClient): Promise<CheckResult> {
  const cutoff = new Date(Date.now() - 5 * 86400 * 1000).toISOString().split("T")[0];

  // Invoices overdue > 5 days, not paid, whose subscription is still active
  const { data, error } = await supabase
    .from("billing_invoices")
    .select("id, invoice_number, customer_id, subscription_id, total, balance_due, due_date, status")
    .not("status", "in", '("paid","cancelled","void","refunded","paid_by_promo","credit","draft")')
    .gt("balance_due", 0.01)
    .lt("due_date", cutoff)
    .eq("environment", "production")
    .limit(100);

  if (error) return { check: "ra_active_overdue_unsuspended", label: "Abonnements actifs en retard non-suspendus", findings: 0, alerts_raised: 0, revenue_at_risk: 0, status: "ok", message: error.message };

  let raised = 0;
  let revenueAtRisk = 0;
  let findings = 0;

  for (const inv of data || []) {
    if (!inv.subscription_id) continue;

    // Check if subscription is still active
    const { data: sub } = await supabase
      .from("billing_subscriptions")
      .select("id, status, plan_name")
      .eq("id", inv.subscription_id)
      .eq("status", "active")
      .maybeSingle();

    if (!sub) continue; // Already suspended or cancelled

    findings++;
    revenueAtRisk += Number(inv.balance_due || 0);
    const ok = await raiseAlert(supabase, {
      alert_type: "ra_active_overdue_unsuspended",
      entity_type: "billing_invoice",
      entity_id: inv.id,
      severity: "warning",
      message: `Facture ${inv.invoice_number} en retard (${inv.due_date}) — ${Number(inv.balance_due).toFixed(2)}$ impayé — abonnement encore actif — billing-lifecycle n'a pas suspendu`,
      details: { invoice_number: inv.invoice_number, customer_id: inv.customer_id, subscription_id: inv.subscription_id, plan_name: sub.plan_name, balance_due: inv.balance_due, due_date: inv.due_date, invoice_status: inv.status },
    });
    if (ok) raised++;
  }

  return {
    check: "ra_active_overdue_unsuspended",
    label: "Actifs en retard non-suspendus",
    findings,
    alerts_raised: raised,
    revenue_at_risk: revenueAtRisk,
    status: findings === 0 ? "ok" : findings > 10 ? "critical" : "warning",
    message: findings === 0 ? "Aucun abonnement actif avec facture en retard non-traitée" : `${findings} abonnement(s) actif(s) avec facture en retard — billing-lifecycle manquant`,
  };
}

// ─── Check 7: Invoice total deviates > $1 from plan_price + taxes ─────────────

async function checkPriceMismatch(supabase: SupabaseClient): Promise<CheckResult> {
  const since = new Date(Date.now() - 30 * 86400 * 1000).toISOString();

  const { data, error } = await supabase
    .from("billing_invoices")
    .select("id, invoice_number, customer_id, subscription_id, total, subtotal, type, status")
    .in("type", ["initial", "renewal"])
    .not("status", "in", '("cancelled","void","draft")')
    .eq("environment", "production")
    .gte("created_at", since)
    .limit(200);

  if (error) return { check: "ra_price_mismatch", label: "Écarts de prix", findings: 0, alerts_raised: 0, revenue_at_risk: 0, status: "ok", message: error.message };

  let raised = 0;
  let revenueAtRisk = 0;
  let findings = 0;

  for (const inv of data || []) {
    if (!inv.subscription_id) continue;

    const { data: sub } = await supabase
      .from("billing_subscriptions")
      .select("plan_price, plan_name")
      .eq("id", inv.subscription_id)
      .maybeSingle();

    if (!sub) continue;

    const expectedTotal = Number(sub.plan_price) * (1 + TAX_RATE);
    const actualTotal   = Number(inv.total);
    const deviation     = Math.abs(expectedTotal - actualTotal);

    if (deviation <= 1.00) continue; // Within $1 tolerance (proration, credits, etc.)

    findings++;
    revenueAtRisk += deviation;
    const ok = await raiseAlert(supabase, {
      alert_type: "ra_price_mismatch",
      entity_type: "billing_invoice",
      entity_id: inv.id,
      severity: deviation > 10 ? "critical" : "warning",
      message: `Facture ${inv.invoice_number} — total ${actualTotal.toFixed(2)}$ mais forfait "${sub.plan_name}" = ${expectedTotal.toFixed(2)}$ — écart ${deviation > 0 ? "-" : "+"}${deviation.toFixed(2)}$`,
      details: { invoice_number: inv.invoice_number, customer_id: inv.customer_id, invoice_total: actualTotal, plan_price: sub.plan_price, expected_total: expectedTotal, deviation: deviation, plan_name: sub.plan_name },
    });
    if (ok) raised++;
  }

  return {
    check: "ra_price_mismatch",
    label: "Écarts de prix facture/forfait",
    findings,
    alerts_raised: raised,
    revenue_at_risk: revenueAtRisk,
    status: findings === 0 ? "ok" : findings > 5 ? "critical" : "warning",
    message: findings === 0 ? "Tous les totaux de factures correspondent aux prix des forfaits" : `${findings} facture(s) avec écart de prix — ${revenueAtRisk.toFixed(2)}$ de divergence cumulée`,
  };
}

// ─── Check 8: Confirmed payment whose invoice is void/cancelled ───────────────

async function checkOrphanedPayments(supabase: SupabaseClient): Promise<CheckResult> {
  const since = new Date(Date.now() - 90 * 86400 * 1000).toISOString();

  const { data, error } = await supabase
    .from("billing_payments")
    .select("id, invoice_id, customer_id, amount, provider_payment_id, created_at")
    .eq("status", "confirmed")
    .gte("created_at", since)
    .limit(500);

  if (error) return { check: "ra_orphaned_payment", label: "Paiements orphelins", findings: 0, alerts_raised: 0, revenue_at_risk: 0, status: "ok", message: error.message };

  let raised = 0;
  let revenueAtRisk = 0;
  let findings = 0;

  for (const pay of data || []) {
    if (!pay.invoice_id) continue;

    const { data: inv } = await supabase
      .from("billing_invoices")
      .select("id, invoice_number, status")
      .eq("id", pay.invoice_id)
      .in("status", ["void", "cancelled"])
      .maybeSingle();

    if (!inv) continue;

    findings++;
    revenueAtRisk += Number(pay.amount || 0);
    const ok = await raiseAlert(supabase, {
      alert_type: "ra_orphaned_payment",
      entity_type: "billing_payment",
      entity_id: pay.id,
      severity: "warning",
      message: `Paiement orphelin ${pay.id.slice(0, 8)}… — ${Number(pay.amount).toFixed(2)}$ confirmé sur facture ${inv.invoice_number} (${inv.status}) — argent reçu sans facture active`,
      details: { payment_id: pay.id, invoice_id: pay.invoice_id, invoice_number: inv.invoice_number, invoice_status: inv.status, amount: pay.amount, provider_payment_id: pay.provider_payment_id, customer_id: pay.customer_id },
    });
    if (ok) raised++;
  }

  return {
    check: "ra_orphaned_payment",
    label: "Paiements orphelins",
    findings,
    alerts_raised: raised,
    revenue_at_risk: revenueAtRisk,
    status: findings === 0 ? "ok" : "warning",
    message: findings === 0 ? "Aucun paiement orphelin détecté" : `${findings} paiement(s) confirmé(s) sur factures annulées — ${revenueAtRisk.toFixed(2)}$ à réconcilier`,
  };
}

// ─── HTTP handler ─────────────────────────────────────────────────────────────

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

    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (authHeader && token !== serviceKey) {
      return respond(403, { error: "Service role key required" });
    }

    console.log("[revenue-assurance] Starting checks...");
    const ranAt = new Date().toISOString();

    const results = await Promise.allSettled([
      checkRenewalGap(supabase),
      checkPaidBalanceMismatch(supabase),
      checkMissingTax(supabase),
      checkDuplicatePayments(supabase),
      checkVoidedWithPayment(supabase),
      checkActiveOverdueUnsuspended(supabase),
      checkPriceMismatch(supabase),
      checkOrphanedPayments(supabase),
    ]);

    const checks: CheckResult[] = results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      console.error(`[revenue-assurance] Check ${i} threw:`, r.reason);
      return {
        check: `check_${i}`,
        label: `Check ${i}`,
        findings: 0,
        alerts_raised: 0,
        revenue_at_risk: 0,
        status: "ok" as const,
        message: `Exception: ${r.reason}`,
      };
    });

    const report: RAReport = {
      checks,
      summary: {
        total_findings:      checks.reduce((s, c) => s + c.findings, 0),
        total_alerts_raised: checks.reduce((s, c) => s + c.alerts_raised, 0),
        total_revenue_at_risk: checks.reduce((s, c) => s + c.revenue_at_risk, 0),
        critical: checks.filter(c => c.status === "critical").length,
        warning:  checks.filter(c => c.status === "warning").length,
        ok:       checks.filter(c => c.status === "ok").length,
        ran_at: ranAt,
        environment: "production",
      },
    };

    console.log(`[revenue-assurance] Done — findings:${report.summary.total_findings} risk:${report.summary.total_revenue_at_risk.toFixed(2)}$ alerts:${report.summary.total_alerts_raised}`);

    return respond(200, report);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[revenue-assurance] Fatal:", msg);
    return respond(500, { error: msg });
  }
});
