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

  // DEPRECATED: This endpoint is retired. Point cron jobs to billing-check-overdue directly.
  return new Response(
    JSON.stringify({
      gone: true,
      message: "This endpoint is retired. Use billing-check-overdue instead.",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
