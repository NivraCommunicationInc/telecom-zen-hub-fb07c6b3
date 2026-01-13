import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CallRequest {
  to: string; // E.164 format phone number
  from?: string; // Optional: specific OpenPhone number to call from
  clientId?: string; // For logging purposes
  agentName?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnon = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin/employee role
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "employee"])
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Forbidden - admin/employee only" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: CallRequest = await req.json();
    
    if (!body.to) {
      return new Response(
        JSON.stringify({ error: "Phone number (to) is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Clean the phone number for deep link
    const cleanNumber = body.to.replace(/\D/g, '');

    // Get client name if clientId provided
    let clientName: string | null = null;
    if (body.clientId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", body.clientId)
        .maybeSingle();
      clientName = profile?.full_name || profile?.email || null;
    }

    // Log the call action to telephony_logs
    const { data: logEntry, error: logError } = await supabaseAdmin
      .from("telephony_logs")
      .insert({
        client_id: body.clientId || null,
        phone_number: body.to,
        action: "call",
        direction: "outbound",
        agent_user_id: user.id,
        agent_name: body.agentName || user.email,
        status: "initiated",
        client_name: clientName,
      })
      .select("id")
      .single();

    if (logError) {
      console.error("Failed to log call:", logError);
    }

    console.log("Call logged, returning deep link for:", body.to);

    // Return success with deep link info
    // OpenPhone API doesn't support programmatic call initiation
    // The frontend will use the deep link to trigger the call
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Call logged - opening OpenPhone",
        deepLink: `openphone://call?number=${cleanNumber}`,
        logId: logEntry?.id || null
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("openphone-call error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
