import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

/**
 * ============================================================================
 * PORTAL SUBMIT INTERAC PAYMENT — DECOMMISSIONED
 * ============================================================================
 *
 * Cet ancien endpoint Interac est conservé en stub HTTP 410 pour
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
        "Endpoint désactivé. Veuillez payer par le flux Square/carte du portail client.",
    }),
    {
      status: 410,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
