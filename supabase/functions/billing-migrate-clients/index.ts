import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * MODULE 54.2 Phase 6.2 — DECOMMISSIONED.
 *
 * This one-shot migration tool wrote directly to public.billing_subscriptions,
 * public.billing_invoices, public.billing_payments, and public.billing_invoice_lines,
 * bypassing the canonical writer gateway.
 *
 * The legacy-to-Billing-V2 migration is completed. Any residual customer
 * repair must go through the canonical RPCs:
 *   - create_subscription_ad_hoc  (subscriptions, provisioning allow-list)
 *   - build_invoice_ad_hoc        (invoices, automation allow-list)
 *
 * This endpoint now returns 410 GONE and performs no writes.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      success: false,
      error: "ENDPOINT_DECOMMISSIONED",
      message:
        "billing-migrate-clients was a one-shot legacy migration tool. It has been decommissioned in Module 54.2 Phase 6.2. Use create_subscription_ad_hoc / build_invoice_ad_hoc for any residual repair, or contact platform ops.",
      module: "54.2",
      phase: "6.2",
      decommissioned_at: "2026-07-12",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
