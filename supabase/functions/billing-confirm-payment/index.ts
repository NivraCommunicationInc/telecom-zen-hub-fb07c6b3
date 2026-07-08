import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

/**
 * ============================================================================
 * BILLING CONFIRM PAYMENT — DECOMMISSIONED
 * ============================================================================
 *
 * Cette fonction servait à confirmer manuellement d'anciens paiements.
 * Elle est désormais désactivée — toute capture carte passe par Square
 * et les écritures financières par les RPC canoniques.
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
        "Endpoint désactivé. Utilisez le flux Square/carte ou les RPC canoniques de paiement.",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
