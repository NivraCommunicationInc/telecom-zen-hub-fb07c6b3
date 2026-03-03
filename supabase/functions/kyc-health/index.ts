/**
 * Edge Function: kyc-health
 * Simple health check for KYC system. Returns 200 + version + timestamp.
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
      version: "1.1.0",
      status: "healthy",
      timestamp: new Date().toISOString(),
      session_flow: "created → submitted → manual_review → approved/rejected",
      auto_approve: false,
      functions: [
        "generate-verification-qr",
        "validate-verification-token",
        "submit-id-verification",
        "admin-review-verification",
        "process-id-ocr",
      ],
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
