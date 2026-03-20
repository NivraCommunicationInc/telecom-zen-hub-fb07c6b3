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

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify JWT to get user_id
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    const body = await req.json();
    const {
      session_id,
      event_type,
      event_category = "checkout",
      status = "info",
      order_number,
      order_id,
      invoice_number,
      payment_number,
      payment_reference,
      paypal_order_id,
      paypal_capture_id,
      amount,
      currency = "CAD",
      error_message,
      error_code,
      metadata = {},
    } = body;

    if (!event_type) {
      return new Response(JSON.stringify({ error: "event_type is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for guaranteed insert (bypasses RLS)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await adminClient.from("transaction_events").insert({
      user_id: userId,
      session_id,
      event_type,
      event_category,
      status,
      order_number,
      order_id,
      invoice_number,
      payment_number,
      payment_reference,
      paypal_order_id,
      paypal_capture_id,
      amount,
      currency,
      error_message,
      error_code,
      metadata,
      source: "edge_function",
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null,
      user_agent: req.headers.get("user-agent") || null,
    }).select("id").single();

    if (error) {
      console.error("[log-transaction-event] Insert error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ id: data.id, ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[log-transaction-event] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
