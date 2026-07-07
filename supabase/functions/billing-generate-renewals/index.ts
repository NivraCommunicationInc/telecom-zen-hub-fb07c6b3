import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { enforceBillingRateLimit } from "../_shared/billingRateLimit.ts";
import { reportEdgeError } from "../_shared/sentry.ts";
import { recordHeartbeat } from "../_shared/cronHeartbeat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * ============================================================================
 * CRON: Daily renewal orchestrator — Phase 3.C.2 (thin orchestrator)
 * ============================================================================
 *
 * SINGLE SOURCE OF TRUTH: `public.run_subscription_renewals(p_lookahead_days)`.
 *
 * This function is INTENTIONALLY THIN. It MUST NOT:
 *   - read the live catalog / plan prices / promotions / taxes;
 *   - compute any subtotal, discount, tax, or total;
 *   - mutate `billing_subscriptions`, `billing_invoices`, `billing_invoice_lines`
 *     directly (all writes flow through the canonical RPC);
 *   - invoke any PayPal Edge Function (PayPal is decommissioned — Phase 3.B).
 *
 * Responsibilities (only):
 *   1) call the canonical renewal RPC (idempotent — safe on retry / catch-up);
 *   2) for each successful renewal invoice, trigger the Square card-on-file
 *      charge if the customer has `square_card_id` (autopay);
 *   3) emit a heartbeat and structured summary.
 *
 * The RPC selects subscriptions with `cycle_end_date <= CURRENT_DATE + N days`,
 * so past-due cycles are automatically caught up on the next cron tick without
 * any client-side window logic.
 * ============================================================================
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const rl = await enforceBillingRateLimit(req, "billing-generate-renewals", corsHeaders);
  if (rl) return rl;

  const cronStartedAt = new Date();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase: any = createClient<any>(supabaseUrl, supabaseServiceKey);

  const results = {
    processed: 0,
    invoices_created: [] as string[],
    autopay_charged: 0,
    autopay_failed: 0,
    errors: [] as string[],
  };

  try {
    // Lookahead: J+3 (matches historical schedule). Past-due cycles are picked
    // up automatically because `cycle_end_date <= now + 3d` is trivially true
    // for anything already expired.
    const LOOKAHEAD_DAYS = 3;

    console.log(`[billing-generate-renewals] Invoking canonical RPC run_subscription_renewals(${LOOKAHEAD_DAYS})`);

    const { data: rpcRows, error: rpcErr } = await supabase.rpc("run_subscription_renewals", {
      p_lookahead_days: LOOKAHEAD_DAYS,
      p_context: { trigger: "cron", source: "billing-generate-renewals" },
    });

    if (rpcErr) throw rpcErr;

    const rows: Array<{ subscription_id: string; invoice_id: string | null; status: string }> = rpcRows ?? [];
    console.log(`[billing-generate-renewals] RPC returned ${rows.length} row(s)`);

    for (const row of rows) {
      if (!row.invoice_id || !row.status?.startsWith("ok")) {
        results.errors.push(`sub=${row.subscription_id}: ${row.status}`);
        continue;
      }
      results.processed++;

      // Fetch minimal invoice metadata for downstream orchestration.
      const { data: invoice } = await supabase
        .from("billing_invoices")
        .select("id, invoice_number, total, customer_id")
        .eq("id", row.invoice_id)
        .maybeSingle();

      if (!invoice) {
        results.errors.push(`sub=${row.subscription_id}: invoice ${row.invoice_id} not found post-RPC`);
        continue;
      }

      results.invoices_created.push(invoice.invoice_number);

      // ── Autopay: Square is the sole active processor (Phase 3.B) ──
      // We do NOT read prices, taxes or promotions here — `invoice.total` is
      // already the canonical amount produced by `renew_subscription()`.
      const { data: customer } = await supabase
        .from("billing_customers")
        .select("square_card_id")
        .eq("id", invoice.customer_id)
        .maybeSingle();

      if (customer?.square_card_id) {
        console.log(`[billing-generate-renewals] Triggering Square autopay for invoice ${invoice.invoice_number}`);
        const { data: squareResult, error: squareErr } = await supabase.functions.invoke(
          "square-charge-subscription",
          { body: { subscription_id: row.subscription_id, invoice_id: invoice.id, amount: invoice.total } },
        );

        if (!squareErr && squareResult?.ok) {
          results.autopay_charged++;
        } else {
          results.autopay_failed++;
          const reason = squareErr?.message ?? squareResult?.error ?? "unknown";
          console.error(`[billing-generate-renewals] Square autopay failed for ${invoice.invoice_number}: ${reason}`);
          await supabase.from("billing_system_alerts").insert({
            alert_type: "square_charge_failed_on_renewal",
            entity_type: "billing_invoice",
            entity_id: invoice.id,
            severity: "warning",
            details: {
              message: `Square autopay échoué pour ${invoice.invoice_number}: ${reason}`,
              subscription_id: row.subscription_id,
              amount: invoice.total,
              reason,
            },
          }).catch(() => {});
        }
      }
      // NOTE: No PayPal fallback. PayPal is decommissioned (Phase 3.B).
      // When no Square card is on file, the invoice remains due and the
      // dunning pipeline handles reminders / grace / suspension.
    }

    // ── Heartbeat + summary ──
    await supabase.from("billing_system_alerts").insert({
      alert_type: "cron_heartbeat",
      entity_type: "cron",
      entity_reference: "billing-generate-renewals",
      severity: "info",
      details: {
        message: `Cron OK — lookahead=${LOOKAHEAD_DAYS}d — processed=${results.processed}, autopay_ok=${results.autopay_charged}, autopay_fail=${results.autopay_failed}, errors=${results.errors.length}`,
        ...results,
      },
    }).catch(() => {});

    if (results.errors.length > 0 && results.processed === 0) {
      await supabase.from("billing_system_alerts").insert({
        alert_type: "renewal_generation_all_failed",
        entity_type: "cron",
        entity_reference: "billing-generate-renewals",
        severity: "critical",
        details: {
          message: `CRITIQUE: ${results.errors.length} erreur(s), 0 facture créée`,
          errors: results.errors,
        },
      }).catch(() => {});
    }

    await recordHeartbeat(supabase, "billing-generate-renewals", "success", cronStartedAt, {
      processed: results.processed,
      autopay_charged: results.autopay_charged,
      autopay_failed: results.autopay_failed,
      errors: results.errors.length,
    });

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[billing-generate-renewals] Error:", error);
    await reportEdgeError(error, { function: "billing-generate-renewals" }).catch(() => {});
    try {
      await recordHeartbeat(
        supabase,
        "billing-generate-renewals",
        "error",
        cronStartedAt,
        results,
        error instanceof Error ? error.message : String(error),
      );
    } catch { /* non-blocking */ }
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
