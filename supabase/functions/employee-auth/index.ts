import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

// EMPLOYEE PORTAL PERMANENTLY DISABLED
// This endpoint returns 410 Gone for all requests
serve(async (req) => {
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  console.log("[employee-auth] DISABLED - returning 410 Gone");
  
  return new Response(
    JSON.stringify({ 
      ok: false, 
      reason: "portal_permanently_disabled", 
      message: "Le portail employé a été supprimé définitivement." 
    }),
    { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});