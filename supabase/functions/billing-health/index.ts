/**
 * Edge Function: billing-health
 * Public health endpoint for billing subsystem. Returns 200 + version + timestamp.
 */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      version: "2.5.0",
      status: "healthy",
      timestamp: new Date().toISOString(),
      model: "prepaid",
      subsystems: [
        "billing-lifecycle",
        "billing-generate-renewals",
        "billing-reconcile-invoices",
        "billing-confirm-payment",
        "process-email-queue",
      ],
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
