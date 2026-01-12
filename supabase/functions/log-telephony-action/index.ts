import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://nivratelecom.ca",
  "https://www.nivratelecom.ca",
  // Dev/preview (explicit allowlist; remove if you want production-only)
  "http://localhost:5173",
  "http://localhost:3000",
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow Lovable preview domains explicitly (still strict allowlist by pattern)
  try {
    const u = new URL(origin);
    return u.hostname.endsWith(".lovableproject.com");
  } catch {
    return false;
  }
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = isAllowedOrigin(origin);
  return {
    "Access-Control-Allow-Origin": allowed && origin ? origin : "https://nivratelecom.ca",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
  };
}

function json(origin: string | null, status: number, body: Record<string, unknown>) {
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

  // Strict CORS: reject unknown origins (preflight included)
  if (!isAllowedOrigin(origin)) {
    return json(origin, 403, {
      ok: false,
      code: "CORS_FORBIDDEN",
      error: "Origin not allowed",
    });
  }

  if (req.method === "OPTIONS") {
    return json(origin, 200, { ok: true });
  }

  if (req.method !== "POST") {
    return json(origin, 405, { ok: false, code: "METHOD_NOT_ALLOWED", error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("LOG_TELEPHONY_ERROR", { error: "Missing authorization header" });
      return json(origin, 401, { ok: false, code: "AUTH_MISSING", error: "Missing authorization header" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("LOG_TELEPHONY_ERROR", { error: "Invalid or expired token", authError });
      return json(origin, 401, { ok: false, code: "AUTH_INVALID", error: "Invalid or expired token" });
    }

    const { data: roleRow, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "employee"])
      .maybeSingle();

    if (roleError) {
      console.error("LOG_TELEPHONY_ERROR", { error: "Role check failed", roleError });
      return json(origin, 500, { ok: false, code: "ROLE_CHECK_FAILED", error: "Failed to verify staff role" });
    }

    if (!roleRow) {
      console.log("LOG_TELEPHONY", { ok: false, staff: false, userId: user.id });
      return json(origin, 403, { ok: false, code: "NOT_STAFF", error: "Unauthorized: staff only" });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json(origin, 400, { ok: false, code: "BAD_JSON", error: "Invalid JSON body" });
    }

    const client_id = body?.client_id;
    const action = body?.action;
    const phone_number = body?.phone_number;
    const direction = body?.direction ?? "outbound";
    const notes = body?.notes ?? null;
    const openphone_call_id = body?.openphone_call_id ?? null;
    const openphone_message_id = body?.openphone_message_id ?? null;
    const raw_payload = body?.raw_payload ?? null;

    if (!client_id) return json(origin, 400, { ok: false, code: "CLIENT_ID_REQUIRED", error: "client_id is required" });
    if (!isValidUUID(client_id)) return json(origin, 400, { ok: false, code: "CLIENT_ID_INVALID", error: "client_id must be a valid UUID" });

    if (!action) return json(origin, 400, { ok: false, code: "ACTION_REQUIRED", error: "action is required" });
    if (!["call", "sms"].includes(action)) {
      return json(origin, 400, { ok: false, code: "ACTION_INVALID", error: "action must be 'call' or 'sms'" });
    }

    if (direction !== "outbound" && direction !== "inbound") {
      return json(origin, 400, { ok: false, code: "DIRECTION_INVALID", error: "direction must be 'inbound' or 'outbound'" });
    }

    if (!phone_number) {
      return json(origin, 400, { ok: false, code: "PHONE_REQUIRED", error: "phone_number is required (E.164)" });
    }

    const normalized = toE164(String(phone_number));
    if (!normalized) {
      return json(origin, 400, {
        ok: false,
        code: "PHONE_INVALID",
        error: "phone_number invalid. Expected E.164 (e.g. +15145551234)",
      });
    }

    const agent_user_id = user.id;
    const agent_email = user.email ?? null;
    const agent_name = user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Agent";

    const { data: logEntry, error: insertError } = await supabase
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
      console.error("LOG_TELEPHONY_ERROR", { message: insertError.message, stack: insertError.details });
      return json(origin, 500, { ok: false, code: "DB_INSERT_FAILED", error: insertError.message });
    }

    console.log("LOG_TELEPHONY", { ok: true, staff: true, userId: user.id, action, client_id });
    return json(origin, 201, { ok: true, id: logEntry.id });
  } catch (e) {
    console.error("LOG_TELEPHONY_ERROR", {
      message: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });
    return json(origin, 500, { ok: false, code: "UNEXPECTED", error: "Internal server error" });
  }
});
