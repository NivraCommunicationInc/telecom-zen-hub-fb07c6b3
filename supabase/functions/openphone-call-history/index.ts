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
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "employee"]);

    if (rolesError) {
      console.error("Role check error:", rolesError);
      return new Response(
        JSON.stringify({ error: "Role verification failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!roles || roles.length === 0) {
      return new Response(
        JSON.stringify({ error: "Forbidden - admin/employee only" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // First, get all phone numbers
    const phoneNumbersRes = await fetch("https://api.openphone.com/v1/phone-numbers", {
      headers: {
        "Authorization": OPENPHONE_API_KEY,
        "Content-Type": "application/json",
      },
    });

    if (!phoneNumbersRes.ok) {
      const errText = await phoneNumbersRes.text();
      console.error("OpenPhone phone numbers error:", errText);
      return new Response(
        JSON.stringify({ error: "Failed to get phone numbers", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phoneNumbersData = await phoneNumbersRes.json();
    const phoneNumbers = phoneNumbersData.data || [];

    if (phoneNumbers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, calls: [], source: "no_phone_numbers" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get calls from local telephony_logs 
    const { data: localLogs, error: logsError } = await supabaseAdmin
      .from("telephony_logs")
      .select("*")
      .eq("action", "call")
      .order("created_at", { ascending: false })
      .limit(100);

    if (logsError) {
      console.error("Failed to fetch local logs:", logsError);
    }

    // Transform local logs to call format
    const localCalls = (localLogs || []).map((log: any) => ({
      id: log.id,
      direction: log.direction || "outgoing",
      participants: [log.phone_number],
      status: log.status || "completed",
      createdAt: log.created_at,
      duration: log.call_duration || 0,
      source: "local",
      agentName: log.agent_name,
    }));

    // Try to fetch recent calls from OpenPhone for each phone number
    const allCalls: any[] = [...localCalls];
    const seenIds = new Set(localCalls.map((c: any) => c.id));

    // Get unique participant numbers from our local logs
    const uniqueParticipants = [...new Set((localLogs || []).map((l: any) => l.phone_number).filter(Boolean))];

    // For each phone number + participant combo, try to fetch calls
    for (const phoneNum of phoneNumbers.slice(0, 2)) { // Limit to avoid rate limits
      for (const participant of uniqueParticipants.slice(0, 10)) {
        if (!participant) continue;
        
        try {
          const queryParams = new URLSearchParams();
          queryParams.set("phoneNumberId", phoneNum.id);
          queryParams.set("participants[]", participant);
          queryParams.set("maxResults", "20");

          const callsRes = await fetch(
            `https://api.openphone.com/v1/calls?${queryParams.toString()}`,
            {
              headers: {
                "Authorization": OPENPHONE_API_KEY,
                "Content-Type": "application/json",
              },
            }
          );

          if (callsRes.ok) {
            const callsData = await callsRes.json();
            for (const call of (callsData.data || [])) {
              if (!seenIds.has(call.id)) {
                seenIds.add(call.id);
                allCalls.push({
                  ...call,
                  source: "openphone",
                });
              }
            }
          }
        } catch (e) {
          console.error("Error fetching calls:", e);
        }
      }
    }

    // Sort by date descending
    allCalls.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return new Response(
      JSON.stringify({ 
        success: true, 
        calls: allCalls.slice(0, 50),
        phoneNumbers: phoneNumbers.map((p: any) => ({ id: p.id, number: p.phoneNumber })),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("openphone-call-history error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
