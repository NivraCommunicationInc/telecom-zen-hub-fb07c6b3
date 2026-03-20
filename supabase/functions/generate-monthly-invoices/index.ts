import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

/**
 * ============================================================================
 * DEPRECATED — LEGACY MONTHLY INVOICE GENERATOR
 * ============================================================================
 *
 * This function previously used legacy tables (subscriptions, monthly_invoices,
 * monthly_invoice_lines) which are NO LONGER authoritative.
 *
 * The canonical replacement is: billing-generate-renewals
 * It operates on: billing_subscriptions → billing_invoices → billing_payments
 *
 * This stub remains deployed so that any existing CRON trigger does not 404,
 * but it performs NO legacy operations. It proxies to the canonical function.
 * ============================================================================
 */

Deno.serve(async (req) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[generate-monthly-invoices] DEPRECATED — proxying to billing-generate-renewals");

    // Proxy to canonical function
    const { data, error } = await supabase.functions.invoke("billing-generate-renewals", {
      body: {},
    });

    if (error) {
      console.error("[generate-monthly-invoices] Proxy error:", error);
      throw new Error(`Proxy to billing-generate-renewals failed: ${error.message}`);
    }

    console.log("[generate-monthly-invoices] Proxy result:", data);

    return new Response(
      JSON.stringify({
        deprecated: true,
        message: "This function is deprecated. All logic now runs via billing-generate-renewals.",
        proxied_result: data,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[generate-monthly-invoices] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" } }
    );
  }
});
