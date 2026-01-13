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
    const OPENPHONE_API_KEY = Deno.env.get("OPENPHONE_API_KEY");
    if (!OPENPHONE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OpenPhone API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Parse query params
    const url = new URL(req.url);
    const phoneNumberId = url.searchParams.get("phoneNumberId");
    const participantNumber = url.searchParams.get("participant");
    const maxResults = url.searchParams.get("maxResults") || "50";

    // Build query params for OpenPhone API
    const queryParams = new URLSearchParams();
    queryParams.set("maxResults", maxResults);
    if (phoneNumberId) queryParams.set("phoneNumberId", phoneNumberId);
    if (participantNumber) queryParams.set("participants", participantNumber);

    // Fetch messages from OpenPhone
    const messagesRes = await fetch(
      `https://api.openphone.com/v1/messages?${queryParams.toString()}`,
      {
        headers: {
          "Authorization": OPENPHONE_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    if (!messagesRes.ok) {
      const errText = await messagesRes.text();
      console.error("OpenPhone messages error:", errText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch messages", details: errText }),
        { status: messagesRes.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messagesData = await messagesRes.json();

    return new Response(
      JSON.stringify({ 
        success: true, 
        messages: messagesData.data || [],
        nextPageToken: messagesData.nextPageToken || null
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("openphone-conversations error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
