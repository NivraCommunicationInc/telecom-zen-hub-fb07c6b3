import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * E.164 phone number normalization (server-side)
 */
function toE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  
  // Already has country code (11 digits starting with 1)
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }
  
  // 10-digit Canadian/US number
  if (digits.length === 10) {
    if (digits[0] === "0" || digits[0] === "1") {
      return null;
    }
    return `+1${digits}`;
  }
  
  // Already E.164 with plus
  if (phone.startsWith("+") && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  
  return null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT - staff only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Decode JWT to get user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is staff (admin or employee)
    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "employee"])
      .maybeSingle();

    if (!role) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: staff only" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const {
      clientId,
      action,
      phoneNumber,
      notes,
      agentUserId,
      agentName,
      agentEmail,
      openphone_call_id,
      openphone_message_id,
    } = body;

    // Validate required fields
    if (!clientId || !action) {
      return new Response(
        JSON.stringify({ error: "clientId and action are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["call", "sms"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "action must be 'call' or 'sms'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone number to E.164
    let normalizedPhone: string | null = null;
    if (phoneNumber) {
      normalizedPhone = toE164(phoneNumber);
      if (!normalizedPhone) {
        return new Response(
          JSON.stringify({ error: "Invalid phone number format" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Insert telephony log using service role (bypasses RLS)
    const { data: logEntry, error: insertError } = await supabase
      .from("telephony_logs")
      .insert({
        client_id: clientId,
        action,
        direction: "outbound",
        phone_number: normalizedPhone,
        notes: notes || null,
        agent_user_id: agentUserId || user.id,
        agent_name: agentName || user.email?.split("@")[0] || "Agent",
        agent_email: agentEmail || user.email,
        openphone_call_id: openphone_call_id || null,
        openphone_message_id: openphone_message_id || null,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to insert telephony log:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to log action", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, id: logEntry.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
