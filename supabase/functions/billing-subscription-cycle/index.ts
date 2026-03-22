import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * billing-subscription-cycle — DEPRECATED / NO-OP
 *
 * This function previously used the legacy `public.subscriptions` table
 * which does not exist in the canonical billing schema (`billing_subscriptions`),
 * causing FK violations on every run.
 *
 * All recurring billing is now handled exclusively by `billing-lifecycle`
 * via the `generate_account_renewal_invoice` RPC (account-level, canonical path).
 *
 * This endpoint returns 410 Gone to prevent silent misuse.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.warn("[billing-subscription-cycle] DEPRECATED — use billing-lifecycle instead");

  return new Response(
    JSON.stringify({
      error: "DEPRECATED",
      message: "billing-subscription-cycle is disabled. All renewals are handled by billing-lifecycle via generate_account_renewal_invoice.",
      migration: "Use POST /billing-lifecycle for canonical renewal processing.",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
