import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

/**
 * ============================================================================
 * DEPRECATED — LEGACY OVERDUE INVOICE CHECKER
 * ============================================================================
 *
 * This function previously used the legacy "billing" table.
 * The canonical replacement is: billing-check-overdue
 * It operates on: billing_invoices + billing_subscriptions
 *
 * This stub proxies to the canonical function.
 * ============================================================================
 */

serve(async (req) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[check-overdue-invoices] DEPRECATED — proxying to billing-check-overdue");

    const { data, error } = await supabase.functions.invoke("billing-check-overdue", {
      body: {},
    });

    if (error) {
      console.error("[check-overdue-invoices] Proxy error:", error);
      throw new Error(`Proxy to billing-check-overdue failed: ${error.message}`);
    }

    return new Response(
      JSON.stringify({
        deprecated: true,
        message: "This function is deprecated. All logic now runs via billing-check-overdue.",
        proxied_result: data,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[check-overdue-invoices] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" } }
    );
  }
});
