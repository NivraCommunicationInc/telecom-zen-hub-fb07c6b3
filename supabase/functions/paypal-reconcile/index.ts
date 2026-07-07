// ============================================================================
// paypal-reconcile — DÉSACTIVÉ (Phase 3.C.4)
// ============================================================================
// PayPal est officiellement décommissionné. La réconciliation PayPal n'a
// plus lieu d'être car aucun nouveau paiement n'est créé via PayPal.
// Les paiements historiques restent en base (provider='paypal') pour audit.
//
// Le cron job `paypal-reconcile` (jobid=104) a été désactivé dans la
// migration Phase 3.C.4.
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
        "PayPal est désactivé. Aucune nouvelle réconciliation n'est nécessaire ; l'historique reste consultable en base.",
      phase: "3.C.4",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
