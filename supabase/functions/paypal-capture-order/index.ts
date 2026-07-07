// ============================================================================
// paypal-capture-order — DÉSACTIVÉ (Phase 3.B.2)
// ============================================================================
// PayPal est officiellement gelé. Cette fonction ne peut plus écrire dans
// billing_payments, billing_invoices, billing_subscriptions, account_adjustments
// ni account_promotions (triggers DB `trg_forbid_paypal_*`).
//
// Remplacement : square-charge-invoice
//
// Conservée comme stub HTTP 410 pour éviter les 404 chez d'anciens clients
// pointant encore vers cet endpoint.
// ============================================================================
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  return new Response(
    JSON.stringify({
      error: "paypal_frozen_3b2",
      code: "PAYPAL_DECOMMISSIONED",
      message:
        "PayPal est désactivé. Utilisez Square (`square-charge-invoice`) pour tout nouveau paiement.",
      replaced_by: "square-charge-invoice",
      phase: "3.B.2",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
