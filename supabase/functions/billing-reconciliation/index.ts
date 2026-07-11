/**
 * billing-reconciliation — Nightly financial sanity check.
 *
 * Runs once per day (recommend 03:00 UTC via pg_cron). For every account it
 * cross-checks the three sources of truth that MUST agree:
 *
 *   1. The subscription recurring setup state from billing_subscriptions.
 *   2. `billing_subscriptions.status` (our internal state)
 *   3. `billing_invoices` (paid/unpaid history)
 *   4. Sum of `billing_payments` (cash actually received)
 *
 * For each account it computes:
 *   - Sum of total payments received this month
 *   - Sum of total invoice value this month
 *   - Sum of expected MRR (active subscriptions × plan_price)
 *   - Discrepancy: |payments - invoices_paid|
 *
 * If a discrepancy > 0.01$ is detected, a `billing_system_alerts` row of type
 * `reconciliation_discrepancy` is raised, AND an admin email is queued so the
 * issue is visible the next morning (not buried in a dashboard nobody opens).
 *
 * Auth: SUPABASE_SERVICE_ROLE_KEY required (cron-only).
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { reportEdgeError } from "../_shared/sentry.ts";

import { enqueueCommunication } from "../_shared/enqueueCommunication.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ALERT_EMAIL = "support@nivra-telecom.ca";

// Default tolerance: payments and invoices can be off by 1¢ due to rounding.
// Tunable per-account in the future via a billing_config table.
const TOLERANCE_CAD = 0.01;

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get("Authorization") ?? "";
  return auth === `Bearer ${SERVICE_KEY}`;
}

interface AccountSummary {
  account_id: string;
  account_number: string | null;
  client_id: string;
  active_subscription_mrr: number; // expected monthly recurring (sum of plan_price for active)
  invoices_total_30d: number;       // sum of billing_invoices.total in last 30d
  invoices_paid_30d: number;        // sum of paid invoices in last 30d
  payments_received_30d: number;    // sum of billing_payments.amount confirmed in last 30d
  discrepancy: number;              // |payments - invoices_paid|
  has_orphan_payments: boolean;     // payments not attached to any invoice
  has_orphan_invoices: boolean;     // invoices with no matching payment trail
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!isAuthorized(req)) {
    return new Response(
      JSON.stringify({ error: "unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase: any = createClient(SUPABASE_URL, SERVICE_KEY);
  const startedAt = Date.now();
  let totalChecked = 0;
  let discrepanciesFound = 0;
  let alertsCreated = 0;
  const discrepancyDetails: AccountSummary[] = [];

  try {
    // Pull all non-closed accounts. Closed accounts shouldn't have new activity,
    // and we don't want to spam alerts for them.
    const { data: accounts, error: accErr } = await supabase
      .from("accounts")
      .select("id, account_number, client_id, status")
      .neq("status", "closed");

    if (accErr) throw accErr;

    const since30d = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();

    for (const account of accounts ?? []) {
      totalChecked++;
      try {
        // Resolve billing_customer for this account
        const { data: customer } = await supabase
          .from("billing_customers")
          .select("id")
          .eq("user_id", account.client_id)
          .maybeSingle();

        if (!customer?.id) continue; // not a billing customer yet, skip

        // Active subs MRR
        const { data: activeSubs } = await supabase
          .from("billing_subscriptions")
          .select("plan_price")
          .eq("customer_id", customer.id)
          .eq("status", "active");
        const activeMrr = (activeSubs ?? []).reduce((a: number, s: any) => a + Number(s.plan_price ?? 0), 0);

        // Invoices in last 30d
        const { data: invoices } = await supabase
          .from("billing_invoices")
          .select("id, total, amount_paid, status")
          .eq("customer_id", customer.id)
          .gte("created_at", since30d);
        const invoicesTotal = (invoices ?? []).reduce((a: number, i: any) => a + Number(i.total ?? 0), 0);
        const invoicesPaid = (invoices ?? [])
          .filter((i: any) => i.status === "paid")
          .reduce((a: number, i: any) => a + Number(i.total ?? 0), 0);

        // Payments confirmed in last 30d
        const { data: payments } = await supabase
          .from("billing_payments")
          .select("amount, status, invoice_id")
          .eq("customer_id", customer.id)
          .gte("created_at", since30d);
        const paymentsReceived = (payments ?? [])
          .filter((p: any) => p.status === "confirmed")
          .reduce((a: number, p: any) => a + Number(p.amount ?? 0), 0);

        // Orphan detection
        const hasOrphanPayments = (payments ?? [])
          .filter((p: any) => p.status === "confirmed")
          .some((p: any) => !p.invoice_id);
        const hasOrphanInvoices = (invoices ?? [])
          .some((i: any) => i.status === "paid" && Number(i.amount_paid ?? 0) === 0);

        const discrepancy = Math.abs(paymentsReceived - invoicesPaid);

        const summary: AccountSummary = {
          account_id: account.id,
          account_number: account.account_number,
          client_id: account.client_id,
          active_subscription_mrr: round2(activeMrr),
          invoices_total_30d: round2(invoicesTotal),
          invoices_paid_30d: round2(invoicesPaid),
          payments_received_30d: round2(paymentsReceived),
          discrepancy: round2(discrepancy),
          has_orphan_payments: hasOrphanPayments,
          has_orphan_invoices: hasOrphanInvoices,
        };

        // If anything looks off, raise an alert (idempotent per day per account).
        if (discrepancy > TOLERANCE_CAD || hasOrphanPayments || hasOrphanInvoices) {
          discrepanciesFound++;
          discrepancyDetails.push(summary);

          const todayKey = new Date().toISOString().split("T")[0];
          const alertKey = `reconciliation_${account.id}_${todayKey}`;

          // Skip if we already raised this alert today
          const { data: existing } = await supabase
            .from("billing_system_alerts")
            .select("id")
            .eq("alert_type", "reconciliation_discrepancy")
            .eq("entity_id", account.id)
            .gte("created_at", todayKey + "T00:00:00Z")
            .maybeSingle();

          if (!existing) {
            await supabase.from("billing_system_alerts").insert({
              alert_type: "reconciliation_discrepancy",
              entity_type: "accounts",
              entity_id: account.id,
              entity_reference: account.account_number,
              details: {
                ...summary,
                tolerance: TOLERANCE_CAD,
                alert_key: alertKey,
                window_days: 30,
              },
            });
            alertsCreated++;
          }
        }
      } catch (e) {
        console.error("[reconciliation] account error:", account.id, e);
        reportEdgeError(e, {
          function: "billing-reconciliation",
          account_id: account.id,
        }).catch(() => {});
      }
    }

    // Summary digest email — sent ONCE per run if there's anything to report.
    if (discrepanciesFound > 0) {
      const topOffenders = discrepancyDetails
        .sort((a, b) => b.discrepancy - a.discrepancy)
        .slice(0, 10);

      await enqueueCommunication({
        channel: "email",
        templateKey: "reconciliation_digest",
        recipient: ALERT_EMAIL,
        idempotencyKey: `reconciliation_digest_${new Date().toISOString().split("T")[0]}`,
        templateVars: {
          run_date: new Date().toISOString(),
          accounts_checked: totalChecked,
          discrepancies_found: discrepanciesFound,
          alerts_created: alertsCreated,
          top_offenders: topOffenders,
        },
        subject: `[Nivra Billing] ${discrepanciesFound} reconciliation discrepancy(ies) detected`,
      });
    }

    const durationMs = Date.now() - startedAt;
    console.log(`[reconciliation] done — checked=${totalChecked}, discrepancies=${discrepanciesFound}, alerts=${alertsCreated}, duration=${durationMs}ms`);

    return new Response(
      JSON.stringify({
        ok: true,
        accounts_checked: totalChecked,
        discrepancies_found: discrepanciesFound,
        alerts_created: alertsCreated,
        duration_ms: durationMs,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[reconciliation] fatal:", err);
    reportEdgeError(err, { function: "billing-reconciliation" }).catch(() => {});
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
