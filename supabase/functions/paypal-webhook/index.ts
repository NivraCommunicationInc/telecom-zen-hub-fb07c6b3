// ============================================================================
// paypal-webhook — DÉSACTIVÉ (Phase 3.C.4)
// ============================================================================
// PayPal est officiellement décommissionné. Ce webhook ne peut plus écrire
// dans billing_payments, billing_invoices, billing_subscriptions,
// account_adjustments ni account_promotions (triggers DB `trg_forbid_paypal_*`).
//
// Remplacement : `square-webhook`
//
// Conservé comme stub HTTP 410 pour éviter les 404 sur d'éventuels appels
// résiduels côté PayPal Dashboard. À désinscrire côté PayPal (voir
// docs/PHASE_3C4_AUDIT.md).
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
      error: "paypal_decommissioned_3c4",
      code: "PAYPAL_DECOMMISSIONED",
      message:
        "PayPal est désactivé. Utilisez Square (`square-webhook`) pour tout nouveau paiement.",
      replaced_by: "square-webhook",
      phase: "3.C.4",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
