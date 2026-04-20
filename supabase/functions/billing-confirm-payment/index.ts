import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

/**
 * ============================================================================
 * BILLING CONFIRM PAYMENT — DECOMMISSIONED
 * ============================================================================
 *
 * Nivra n'accepte que PayPal (incluant les cartes de crédit via PayPal).
 * Cette fonction servait à confirmer manuellement les paiements Interac.
 * Elle est désormais désactivée — toute la logique de capture passe par
 * `paypal-webhook` et l'agrégateur `apply_payment_to_invoice`.
 *
 * Conservée comme stub HTTP 410 pour éviter les 404 chez les clients qui
 * pointent encore vers cet endpoint.
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
        "La confirmation manuelle de paiement Interac n'est plus prise en charge. Nivra n'accepte que PayPal / Carte de crédit.",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
