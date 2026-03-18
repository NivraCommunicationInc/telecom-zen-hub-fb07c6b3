import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * billing-subscription-cycle
 * 
 * Triggers recurring invoice generation for the canonical `subscriptions` table.
 * Calls `fn_run_subscription_renewals(p_lookahead_days)` which atomically:
 *   1. Finds active subscriptions with next_billing_date <= today + lookahead
 *   2. Generates billing_invoices + billing_invoice_lines
 *   3. Updates next_billing_date += 30 days
 *   4. Logs to order_automation_log
 * 
 * Designed to be triggered by pg_cron daily or manually from Core.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Accept optional lookahead_days (default 3 = J-3 prepaid model)
    let lookaheadDays = 3;
    try {
      const body = await req.json();
      if (body?.lookahead_days) lookaheadDays = parseInt(body.lookahead_days, 10);
    } catch { /* no body = use defaults */ }

    console.log(`[billing-subscription-cycle] Running with lookahead=${lookaheadDays} days`);

    const { data, error } = await supabase.rpc("fn_run_subscription_renewals", {
      p_lookahead_days: lookaheadDays,
    });

    if (error) {
      console.error("[billing-subscription-cycle] RPC error:", error);
      throw error;
    }

    console.log(`[billing-subscription-cycle] Result:`, JSON.stringify(data));

    // Log to billing_automation_runs for observability
    await supabase.from("billing_automation_runs").insert({
      run_type: "subscription_renewal_cycle",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      status: "completed",
      renewals_generated: (data as any)?.created || 0,
      errors_count: (data as any)?.errors || 0,
      summary: `Processed ${(data as any)?.processed || 0}, created ${(data as any)?.created || 0}, skipped ${(data as any)?.skipped || 0}`,
      processed_items: data,
    });

    return new Response(JSON.stringify({ success: true, ...data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[billing-subscription-cycle] Error:", error);

    // Log failure to automation runs for observability
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase.from("billing_automation_runs").insert({
        run_type: "subscription_renewal_cycle",
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        status: "failed",
        errors_count: 1,
        summary: `FAILED: ${errorMessage}`,
        errors: [{ message: errorMessage, timestamp: new Date().toISOString() }],
      });
    } catch { /* don't let logging failure mask the original error */ }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
