// TEMPORARY TEST FUNCTION - DELETE AFTER VALIDATION
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use service role client for privileged access
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const testInvoiceId = "d26cab42-4c40-4ef1-9936-47c3c3384744";

    // Step 1: Get context info before update
    const { data: contextBefore, error: ctxErr } = await supabase.rpc("get_current_context");
    
    // Step 2: Attempt the bypass update using raw SQL via RPC
    // We need to create a temporary function to test this properly
    const { data: testResult, error: testErr } = await supabase.rpc(
      "test_paid_invoice_bypass_proof",
      { p_invoice_id: testInvoiceId }
    );

    return new Response(
      JSON.stringify({
        success: !testErr,
        contextBefore,
        testResult,
        error: testErr?.message || ctxErr?.message,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
