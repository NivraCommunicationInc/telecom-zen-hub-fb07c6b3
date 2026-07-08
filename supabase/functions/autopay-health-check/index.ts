/**
 * autopay-health-check — decommissioned legacy PayPal health check
 *
 * Square autopay has its own monitoring path. This endpoint is a no-op so old
 * cron schedules cannot keep querying legacy PayPal tables.
 *
 * Schedule (recommended): once daily at 08:00 UTC via pg_cron.
 *
 * Auth: SERVICE_ROLE_KEY required (cron-only).
 *
 * Alert thresholds (any one fires the alert):
 *   - failure_rate > 10% over last 24h
 *   - absolute failures >= 5 in 24h
 *
 * The alert email itself is idempotent per day: re-running the cron won't
 * spam the inbox if conditions are still met.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function isAuthorized(req: Request): boolean {
  const auth = req.headers.get("Authorization") ?? "";
  return auth === `Bearer ${SERVICE_KEY}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (!isAuthorized(req)) {
    return new Response(
      JSON.stringify({ error: "unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, decommissioned: true, alert_sent: false }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
