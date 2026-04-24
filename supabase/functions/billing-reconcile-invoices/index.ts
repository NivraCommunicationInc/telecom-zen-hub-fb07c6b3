import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * BILLING RECONCILIATION JOB
 * 
 * Scheduled via pg_cron to run every 6 hours.
 * Scans all non-terminal invoices and reconciles amount_paid/balance_due/status
 * from the billing_payments table (single source of truth).
 * 
 * Idempotent: running twice produces the same result.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase: any = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[billing-reconcile] Starting reconciliation...");

    const { data, error } = await supabase.rpc("reconcile_all_invoices");

    if (error) {
      console.error("[billing-reconcile] RPC error:", error);
      throw error;
    }

    const result = data as { scanned: number; fixed: number; details: unknown[]; run_at: string };
    
    console.log(`[billing-reconcile] Complete: scanned=${result.scanned}, fixed=${result.fixed}`);

    if (result.fixed > 0) {
      // Log to automation runs table
      await supabase.from("billing_automation_runs").insert({
        run_type: "reconciliation",
        status: "completed",
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        summary: `Reconciled ${result.fixed}/${result.scanned} invoices`,
        processed_items: result.details,
      });
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[billing-reconcile] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
