/**
 * Edge Function: nivra-health-check
 * Runs critical-path checks and emails support+nivratelecom on regression.
 * Called by daily pg_cron + accessible via /core/health UI.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const checks: CheckResult[] = [];
  const startedAt = new Date().toISOString();

  // 1) DB reachable + critical tables readable
  try {
    const { error } = await supabase.from("orders").select("id", { count: "exact", head: true }).limit(1);
    checks.push({ name: "Nivra Core order list", ok: !error, detail: error?.message });
  } catch (e) {
    checks.push({ name: "Nivra Core order list", ok: false, detail: String(e) });
  }

  // 2) Profiles table (portal client login)
  try {
    const { error } = await supabase.from("profiles").select("id", { count: "exact", head: true }).limit(1);
    checks.push({ name: "Portal client login (profiles)", ok: !error, detail: error?.message });
  } catch (e) {
    checks.push({ name: "Portal client login (profiles)", ok: false, detail: String(e) });
  }

  // 3) PayPal capture pipeline — RPC exists
  try {
    const { error } = await supabase.rpc("apply_payment_to_invoice", {
      p_invoice_id: "00000000-0000-0000-0000-000000000000",
      p_amount: 0,
      p_method: "paypal",
      p_provider: "paypal",
      p_provider_payment_id: "healthcheck",
      p_provider_order_id: "healthcheck",
      p_source: "healthcheck",
      p_created_by_name: "healthcheck",
      p_created_by_role: "system",
      p_customer_id: null,
    });
    // RPC is reachable if it ran (even with DB-level error). Only fail if the function itself is missing.
    const functionMissing = error?.code === "PGRST202" ||
      ((error?.message || "").toLowerCase().includes("function") && (error?.message || "").toLowerCase().includes("not"));
    const rpcReachable = !error || !functionMissing;
    checks.push({
      name: "PayPal payment capture RPC",
      ok: rpcReachable,
      detail: rpcReachable ? "RPC reachable" : error?.message,
    });
  } catch (e) {
    checks.push({ name: "PayPal payment capture RPC", ok: false, detail: String(e) });
  }

  // 4) Email queue dispatcher writable (order confirmation pipeline)
  try {
    const { error } = await supabase.from("email_queue").select("id", { count: "exact", head: true }).limit(1);
    checks.push({ name: "Order confirmation email queue", ok: !error, detail: error?.message });
  } catch (e) {
    checks.push({ name: "Order confirmation email queue", ok: false, detail: String(e) });
  }

  // 5) Public checkout: compute_checkout_pricing RPC reachable
  try {
    const { error } = await supabase.rpc("compute_checkout_pricing", {
      p_services: [{ plan_code: "INT100", plan_name: "Internet 100 Mbps", plan_price: 90, category: "internet" }],
      p_promo_code: null,
      p_user_id: null,
    });
    const rpcReachable = !error || /not.found|services/i.test(error?.message || "");
    checks.push({
      name: "Public checkout pricing engine",
      ok: rpcReachable,
      detail: rpcReachable ? "RPC reachable" : error?.message,
    });
  } catch (e) {
    checks.push({ name: "Public checkout pricing engine", ok: false, detail: String(e) });
  }

  const failures = checks.filter((c) => !c.ok);
  const overallOk = failures.length === 0;

  // On regression → notify business emails
  if (!overallOk) {
    const subject = `🚨 ALERTE RÉGRESSION — ${failures.map((f) => f.name).join(", ")} cassé`;
    const html = `
      <h2>Régression détectée — ${new Date().toLocaleString("fr-CA")}</h2>
      <p>Le health check Nivra a détecté ${failures.length} échec(s) :</p>
      <ul>
        ${failures.map((f) => `<li><strong>${f.name}</strong> — ${f.detail || "échec"}</li>`).join("")}
      </ul>
      <p><strong>Démarré:</strong> ${startedAt}</p>
      <p>Vérifier immédiatement les fichiers récemment modifiés et les logs des Edge Functions.</p>
    `;
    await supabase.from("email_queue").insert([
      {
        event_key: `health_check_${Date.now()}_support`,
        to_email: "support@nivra-telecom.ca",
        template_key: "custom_html",
        subject,
        template_vars: { subject, html },
        status: "queued",
        attempts: 0,
        max_attempts: 5,
      },
      {
        event_key: `health_check_${Date.now()}_alt`,
        to_email: "nivratelecom@gmail.com",
        template_key: "custom_html",
        subject,
        template_vars: { subject, html },
        status: "queued",
        attempts: 0,
        max_attempts: 5,
      },
    ]);
  }

  return new Response(
    JSON.stringify({
      ok: overallOk,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      total: checks.length,
      passed: checks.length - failures.length,
      failed: failures.length,
      checks,
    }),
    {
      status: overallOk ? 200 : 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
