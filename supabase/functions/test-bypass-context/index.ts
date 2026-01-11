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
    // Use SERVICE_ROLE key for server context
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const testInvoiceId = "d26cab42-4c40-4ef1-9936-47c3c3384744";

    // Step 1: Get context info BEFORE bypass
    const { data: contextBefore, error: ctxErr } = await supabaseAdmin.rpc("get_db_context");
    
    // Step 2: Set bypass flag and attempt update via RPC
    const { data: bypassResult, error: bypassErr } = await supabaseAdmin.rpc(
      "test_bypass_update",
      { invoice_id: testInvoiceId }
    );

    // Step 3: Get context info AFTER (same session won't work, but we log what we can)
    const { data: contextAfter, error: ctxAfterErr } = await supabaseAdmin.rpc("get_db_context");

    return new Response(
      JSON.stringify({
        success: !bypassErr,
        context_before: contextBefore,
        context_after: contextAfter,
        bypass_result: bypassResult,
        bypass_error: bypassErr?.message || null,
        context_error: ctxErr?.message || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
