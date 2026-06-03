/**
 * Edge Function: kyc-health
 * Real health check for KYC system — verifies DB connectivity and active session count.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const checks: { name: string; ok: boolean; detail?: string }[] = [];

  // Check 1: kyc_requests table accessible
  try {
    const { count, error } = await supabase
      .from("kyc_requests")
      .select("id", { count: "exact", head: true })
      .not("status", "in", '("approved","rejected","cancelled")');
    checks.push({ name: "kyc_requests table", ok: !error, detail: error?.message ?? `${count ?? 0} pending sessions` });
  } catch (e) {
    checks.push({ name: "kyc_requests table", ok: false, detail: String(e) });
  }

  // Check 2: identity_verification_sessions accessible
  try {
    const { error } = await supabase
      .from("identity_verification_sessions")
      .select("id", { count: "exact", head: true })
      .limit(1);
    checks.push({ name: "identity_verification_sessions table", ok: !error, detail: error?.message });
  } catch (e) {
    checks.push({ name: "identity_verification_sessions table", ok: false, detail: String(e) });
  }

  const allOk = checks.every(c => c.ok);

  return new Response(
    JSON.stringify({
      version: "1.2.0",
      status: allOk ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    }),
    { status: allOk ? 200 : 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
