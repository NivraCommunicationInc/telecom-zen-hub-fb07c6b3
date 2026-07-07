// ============================================================================
// paypal-cancel-subscription — DÉSACTIVÉ (Phase 3.C.4)
// ============================================================================
// PayPal est officiellement décommissionné. Les annulations d'abonnement
// passent désormais exclusivement par la RPC canonique
// `public.cancel_subscription()` (voir Phase 3.C.3).
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
        "PayPal est désactivé. Utilisez la RPC canonique `cancel_subscription()`.",
      replaced_by: "rpc:cancel_subscription",
      phase: "3.C.4",
    }),
    { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
