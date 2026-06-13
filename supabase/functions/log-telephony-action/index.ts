import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://nivra-telecom.ca",
  "https://www.nivra-telecom.ca",
  "http://localhost:5173",
  "http://localhost:3000",
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow Lovable preview domains
  try {
    const u = new URL(origin);
    return u.hostname.endsWith(".lovableproject.com");
  } catch (_e) {
    return false;
  }
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = isAllowedOrigin(origin);
  return {
    "Access-Control-Allow-Origin": allowed && origin ? origin : "https://nivra-telecom.ca",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

function jsonResponse(origin: string | null, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
    },
  });
}

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

function toE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) {
    if (digits[0] === "0" || digits[0] === "1") return null;
    return `+1${digits}`;
  }
  if (phone.startsWith("+") && digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return jsonResponse(origin, 200, { ok: true });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return jsonResponse(origin, 405, { ok: false, code: "METHOD_NOT_ALLOWED", error: "Method not allowed" });
  }

  // Reject unknown origins
  if (!isAllowedOrigin(origin)) {
    console.error("LOG_TELEPHONY_ERROR", { error: "CORS forbidden", origin });
    return jsonResponse(origin, 403, { ok: false, code: "CORS_FORBIDDEN", error: "Origin not allowed" });
  }

  try {
    // 1. Read Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("LOG_TELEPHONY_ERROR", { error: "Missing authorization header" });
      return jsonResponse(origin, 401, { ok: false, code: "AUTH_MISSING", error: "Missing authorization header" });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 2. Validate user via auth.getUser with anon client
    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

    if (authError || !user) {
      console.error("LOG_TELEPHONY_ERROR", { error: "Invalid or expired token", authError: authError?.message });
      return jsonResponse(origin, 401, { ok: false, code: "AUTH_INVALID", error: "Invalid or expired token" });
    }

    // 3. Check if user is admin|employee using SERVICE ROLE (bypasses RLS)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: roles, error: roleError } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "employee"]);

    if (roleError) {
      console.error("LOG_TELEPHONY_ERROR", { error: "Role check failed", roleError: roleError.message });
      return jsonResponse(origin, 500, { ok: false, code: "ROLE_CHECK_FAILED", error: "Failed to verify staff role" });
    }

    if (!roles || roles.length === 0) {
      console.log("LOG_TELEPHONY", { ok: false, staff: false, userId: user.id });
      return jsonResponse(origin, 403, { ok: false, code: "NOT_STAFF", error: "Unauthorized: staff only" });
    }

    // 4. Parse and validate input
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch (_e) {
      return jsonResponse(origin, 400, { ok: false, code: "BAD_JSON", error: "Invalid JSON body" });
    }

    const client_id = body?.client_id as string | undefined;
    const action = body?.action as string | undefined;
    const phone_number = body?.phone_number as string | undefined;
    const direction = (body?.direction as string) ?? "outbound";
    const notes = (body?.notes as string) ?? null;
    const openphone_call_id = (body?.openphone_call_id as string) ?? null;
    const openphone_message_id = (body?.openphone_message_id as string) ?? null;
    const raw_payload = (body?.raw_payload as Record<string, unknown>) ?? null;

    if (!client_id) {
      return jsonResponse(origin, 400, { ok: false, code: "CLIENT_ID_REQUIRED", error: "client_id is required" });
    }
    if (!isValidUUID(client_id)) {
      return jsonResponse(origin, 400, { ok: false, code: "CLIENT_ID_INVALID", error: "client_id must be a valid UUID" });
    }
    if (!action) {
      return jsonResponse(origin, 400, { ok: false, code: "ACTION_REQUIRED", error: "action is required" });
    }
    if (!["call", "sms"].includes(action)) {
      return jsonResponse(origin, 400, { ok: false, code: "ACTION_INVALID", error: "action must be 'call' or 'sms'" });
    }
    if (direction !== "outbound" && direction !== "inbound") {
      return jsonResponse(origin, 400, { ok: false, code: "DIRECTION_INVALID", error: "direction must be 'inbound' or 'outbound'" });
    }
    if (!phone_number) {
      return jsonResponse(origin, 400, { ok: false, code: "PHONE_REQUIRED", error: "phone_number is required (E.164)" });
    }

    const normalized = toE164(String(phone_number));
    if (!normalized) {
      return jsonResponse(origin, 400, {
        ok: false,
        code: "PHONE_INVALID",
        error: "phone_number invalid. Expected E.164 (e.g. +15145551234)",
      });
    }

    // 5. Insert into telephony_logs using SERVICE ROLE (bypasses RLS)
    const agent_user_id = user.id;
    const agent_email = user.email ?? null;
    const agent_name = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Agent";

    const { data: logEntry, error: insertError } = await serviceClient
      .from("telephony_logs")
      .insert({
        client_id,
        action,
        direction,
        phone_number: normalized,
        notes,
        agent_user_id,
        agent_email,
        agent_name,
        openphone_call_id,
        openphone_message_id,
        raw_payload,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("LOG_TELEPHONY_ERROR", { message: insertError.message, details: insertError.details });
      return jsonResponse(origin, 500, { ok: false, code: "DB_INSERT_FAILED", error: insertError.message });
    }

    console.log("LOG_TELEPHONY", { ok: true, staff: true, userId: user.id, action, client_id, logId: logEntry.id });
    return jsonResponse(origin, 201, { ok: true, id: logEntry.id });

  } catch (e) {
    console.error("LOG_TELEPHONY_ERROR", {
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return jsonResponse(origin, 500, { ok: false, code: "UNEXPECTED", error: "Internal server error" });
  }
});
