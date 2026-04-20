import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

/**
 * ============================================================================
 * PORTAL SUBMIT INTERAC PAYMENT — DECOMMISSIONED
 * ============================================================================
 *
 * Nivra n'accepte plus les virements Interac.
 * Tous les paiements doivent passer par PayPal (incluant les cartes de
 * crédit via PayPal). Cet endpoint est conservé en stub HTTP 410 pour
 * éviter les 404 et signaler clairement le retrait du service.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      error: "endpoint_decommissioned",
      message:
        "Le virement Interac n'est plus accepté. Veuillez payer par PayPal / Carte de crédit dans votre portail client.",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
