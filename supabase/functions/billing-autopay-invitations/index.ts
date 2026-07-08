// ============================================================
// Autopay activation invitations — decommissioned for legacy PayPal flow
// ============================================================
// Square autopay uses a separate flow. This endpoint is intentionally a no-op
// so old cron schedules cannot queue PayPal autopay invitation emails.
// ============================================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  return new Response(
    JSON.stringify({ success: true, decommissioned: true, processed: 0, queued: 0 }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
