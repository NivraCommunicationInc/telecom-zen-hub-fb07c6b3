import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Employee Operations Edge Function - PERMANENTLY DISABLED
 * 
 * The employee portal has been removed. This endpoint returns 410 Gone.
 * Data is preserved but no employee operations are permitted.
 */

import { getCorsHeaders } from "../_shared/cors.ts";

const corsHeaders = {
  ...getCorsHeaders(null),
  'Content-Type': 'application/json',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log("[employee-operations] DISABLED - returning 410 Gone");

  return new Response(
    JSON.stringify({ 
      success: false,
      ok: false, 
      reason: "portal_permanently_disabled", 
      message: "Le portail employé a été supprimé définitivement. Aucune opération employé n'est permise." 
    }),
    { status: 410, headers: corsHeaders }
  );
});
