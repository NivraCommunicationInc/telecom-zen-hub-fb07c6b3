import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Production CORS - restricted origins
const ALLOWED_ORIGINS = [
  "https://nivratelecom.ca",
  "https://www.nivratelecom.ca",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
}

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

/**
 * Validate UUID format
 */
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Verify JWT - staff only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("LOG_TELEPHONY_ERROR", { error: "Missing authorization header" });
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
      console.error("LOG_TELEPHONY_ERROR", { error: "Invalid or expired token", authError });
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is staff (admin or employee) via user_roles table
    const { data: role, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "employee"])
      .maybeSingle();

    if (roleError) {
      console.error("LOG_TELEPHONY_ERROR", { error: "Failed to check role", roleError });
      return new Response(
        JSON.stringify({ error: "Failed to verify staff role" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!role) {
      console.error("LOG_TELEPHONY_ERROR", { error: "Unauthorized: not staff", userId: user.id });
      return new Response(
        JSON.stringify({ error: "Unauthorized: staff only" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      client_id,
      clientId, // Support both formats
      action,
      phone_number,
      phoneNumber, // Support both formats
      direction = "outbound",
      notes,
      agent_user_id,
      agentUserId,
      agent_name,
      agentName,
      agent_email,
      agentEmail,
      openphone_call_id,
      openphone_message_id,
      raw_payload,
    } = body;

    // Normalize field names (support both snake_case and camelCase)
    const finalClientId = client_id || clientId;
    const finalPhoneNumber = phone_number || phoneNumber;
    const finalAgentUserId = agent_user_id || agentUserId || user.id;
    const finalAgentName = agent_name || agentName || user.email?.split("@")[0] || "Agent";
    const finalAgentEmail = agent_email || agentEmail || user.email;

    // Validate required fields
    if (!finalClientId) {
      return new Response(
        JSON.stringify({ error: "client_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isValidUUID(finalClientId)) {
      return new Response(
        JSON.stringify({ error: "client_id must be a valid UUID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!action) {
      return new Response(
        JSON.stringify({ error: "action is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["call", "sms"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "action must be 'call' or 'sms'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["inbound", "outbound"].includes(direction)) {
      return new Response(
        JSON.stringify({ error: "direction must be 'inbound' or 'outbound'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone number to E.164
    let normalizedPhone: string | null = null;
    if (finalPhoneNumber) {
      normalizedPhone = toE164(finalPhoneNumber);
      if (!normalizedPhone) {
        return new Response(
          JSON.stringify({ error: "Invalid phone number format. Expected E.164 (e.g. +15145551234)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Insert telephony log using service role (bypasses RLS)
    const { data: logEntry, error: insertError } = await supabase
      .from("telephony_logs")
      .insert({
        client_id: finalClientId,
        action,
        direction,
        phone_number: normalizedPhone,
        notes: notes || null,
        agent_user_id: finalAgentUserId,
        agent_name: finalAgentName,
        agent_email: finalAgentEmail,
        openphone_call_id: openphone_call_id || null,
        openphone_message_id: openphone_message_id || null,
        raw_payload: raw_payload || null,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("LOG_TELEPHONY_ERROR", { 
        error: "Failed to insert telephony log", 
        insertError,
        client_id: finalClientId,
        action 
      });
      return new Response(
        JSON.stringify({ error: "Failed to log action", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Success log
    console.log("LOG_TELEPHONY", { 
      ok: true, 
      staff: role.role,
      userId: user.id, 
      action, 
      client_id: finalClientId,
      logId: logEntry.id
    });

    return new Response(
      JSON.stringify({ ok: true, id: logEntry.id }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("LOG_TELEPHONY_ERROR", { 
      error: "Unexpected error", 
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
