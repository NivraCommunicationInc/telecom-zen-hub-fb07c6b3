/**
 * Edge Function: billing-health
 * Real health check for billing subsystem — verifies DB connectivity and key table access.
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

  // Check 1: billing_invoices accessible + count pending
  try {
    const { count, error } = await supabase
      .from("billing_invoices")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    checks.push({ name: "billing_invoices table", ok: !error, detail: error?.message ?? `${count ?? 0} pending invoices` });
  } catch (e) {
    checks.push({ name: "billing_invoices table", ok: false, detail: String(e) });
  }

  // Check 2: billing_subscriptions accessible
  try {
    const { count, error } = await supabase
      .from("billing_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");
    checks.push({ name: "billing_subscriptions table", ok: !error, detail: error?.message ?? `${count ?? 0} active subscriptions` });
  } catch (e) {
    checks.push({ name: "billing_subscriptions table", ok: false, detail: String(e) });
  }

  // Check 3: email queue not backed up (DLQ check)
  try {
    const { count, error } = await supabase
      .from("email_queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "dlq");
    const dlqOk = !error && (count ?? 0) <= 10;
    checks.push({ name: "email queue DLQ", ok: dlqOk, detail: error?.message ?? `${count ?? 0} DLQ emails` });
  } catch (e) {
    checks.push({ name: "email queue DLQ", ok: false, detail: String(e) });
  }

  const allOk = checks.every(c => c.ok);

  return new Response(
    JSON.stringify({
      version: "2.6.0",
      status: allOk ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      model: "prepaid",
      checks,
    }),
    { status: allOk ? 200 : 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
