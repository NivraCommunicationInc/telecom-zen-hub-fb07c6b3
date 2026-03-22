import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * ══════════════════════════════════════════════════════════════════════
 * DEPRECATED — 2026-03-22
 * ══════════════════════════════════════════════════════════════════════
 * ALL overdue/suspension/void logic is now handled by billing-lifecycle.
 * This function is kept as a no-op to prevent 404s on stale invocations.
 * ══════════════════════════════════════════════════════════════════════
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.warn("[billing-check-overdue] DEPRECATED — all logic moved to billing-lifecycle");
  return new Response(
    JSON.stringify({
      deprecated: true,
      message: "All overdue/suspension/void logic is now in billing-lifecycle. This function is a no-op.",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
