import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

/**
 * STRIPE — CREATE PAYMENT INTENT (DECOMMISSIONED)
 *
 * Stripe is permanently disabled. PayPal is the primary payment provider.
 * This function returns 403 for all requests.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.warn("[stripe-create-payment-intent] BLOCKED — Stripe disabled in production");
  return new Response(
    JSON.stringify({ error: "Stripe payments are disabled. Use PayPal instead." }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
