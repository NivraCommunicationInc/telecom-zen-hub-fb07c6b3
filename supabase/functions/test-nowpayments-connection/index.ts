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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is admin
    const { data: adminUser } = await supabase
      .from("admin_users")
      .select("is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (!adminUser) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get settings
    const { data: settings } = await supabase
      .from("payment_gateway_settings")
      .select("mode")
      .eq("provider", "nowpayments")
      .single();

    const mode = settings?.mode || "sandbox";

    // Get API key
    const apiKey = Deno.env.get("NOWPAYMENTS_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "API key not configured",
          message: "NOWPAYMENTS_API_KEY environment variable is not set"
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine API base URL
    const baseUrl = mode === "production" 
      ? "https://api.nowpayments.io/v1"
      : "https://api-sandbox.nowpayments.io/v1";

    // Test connection by getting API status
    const statusResponse = await fetch(`${baseUrl}/status`, {
      headers: { "x-api-key": apiKey },
    });

    const statusData = await statusResponse.json();

    if (!statusResponse.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: statusData.message || "API connection failed",
          mode,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Also get available currencies
    const currenciesResponse = await fetch(`${baseUrl}/currencies`, {
      headers: { "x-api-key": apiKey },
    });

    const currenciesData = await currenciesResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        status: statusData,
        availableCurrencies: currenciesData.currencies?.slice(0, 20) || [],
        message: `Connected to NOWPayments ${mode} API successfully`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error testing NOWPayments connection:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
