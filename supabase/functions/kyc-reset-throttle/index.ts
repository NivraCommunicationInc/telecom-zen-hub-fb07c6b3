/**
 * Edge Function: kyc-reset-throttle
 * Admin-only utility to clear KYC QR throttle counters for an IP.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://nivra-telecom.ca",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Cache-Control": "no-store",
};

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  const origin = req.headers.get("origin") || "";
  const authHeader = req.headers.get("Authorization") || "";
  const authPresent = authHeader.startsWith("Bearer ");

  const responseHeaders = {
    ...CORS_HEADERS,
    "request-id": requestId,
    "x-request-id": requestId,
  };

  const logInfo = (event: string, details: Record<string, unknown> = {}) => {
    console.log(
      JSON.stringify({
        level: "info",
        event,
        request_id: requestId,
        timestamp: new Date().toISOString(),
        origin,
        auth_present: authPresent,
        ...details,
      }),
    );
  };

  const logError = (event: string, error: unknown, details: Record<string, unknown> = {}) => {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(
      JSON.stringify({
        level: "error",
        event,
        request_id: requestId,
        timestamp: new Date().toISOString(),
        origin,
        auth_present: authPresent,
        error_message: err.message,
        error_stack: err.stack,
        ...details,
      }),
    );
  };

  const jsonResponse = (body: Record<string, unknown>, status: number) =>
    new Response(JSON.stringify({ ...body, request_id: requestId }), {
      status,
      headers: {
        ...responseHeaders,
        "Content-Type": "application/json",
      },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: responseHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error_code: "method_not_allowed", message: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonResponse(
        { error_code: "config_error", message: "Missing backend environment configuration" },
        500,
      );
    }

    if (!authPresent) {
      return jsonResponse({ error_code: "unauthorized", message: "Authorization required" }, 401);
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return jsonResponse(
        { error_code: "auth_failed", message: "Invalid or expired authentication token" },
        401,
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const adminUserId = userData.user.id;

    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", adminUserId)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      return jsonResponse({ error_code: "forbidden", message: "Admin access required" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const requestedIp = typeof body?.ip === "string" ? body.ip.trim() : "";
    const fallbackIp = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "")
      .split(",")[0]
      .trim();

    const targetIp = requestedIp || fallbackIp;
    if (!targetIp) {
      return jsonResponse(
        { error_code: "missing_ip", message: "IP is required or must be derivable from request" },
        400,
      );
    }

    const throttleKey = `kyc_qr_ip:${targetIp}`;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { count: attemptsBefore } = await supabase
      .from("rate_limit_attempts")
      .select("id", { count: "exact", head: true })
      .eq("key", throttleKey)
      .gte("created_at", oneHourAgo);

    const { error: deleteAttemptsError } = await supabase
      .from("rate_limit_attempts")
      .delete()
      .eq("key", throttleKey);

    if (deleteAttemptsError) {
      logError("delete_attempts_failed", deleteAttemptsError, { target_ip: targetIp });
      return jsonResponse(
        { error_code: "throttle_reset_failed", message: "Failed to clear throttle attempts" },
        500,
      );
    }

    await supabase
      .from("rate_limit_lockouts")
      .delete()
      .eq("key", throttleKey);

    await supabase.from("admin_audit_log").insert({
      admin_user_id: adminUserId,
      admin_email: userData.user.email || null,
      action: "kyc_reset_throttle",
      target_type: "ip",
      target_id: targetIp,
      details: {
        throttle_key: throttleKey,
        attempts_cleared: attemptsBefore || 0,
        requested_ip: requestedIp || null,
        fallback_ip: fallbackIp || null,
      },
      ip_address: fallbackIp || null,
    });

    logInfo("throttle_reset_ok", {
      admin_user_id_prefix: adminUserId.slice(0, 8),
      target_ip: targetIp,
      attempts_cleared: attemptsBefore || 0,
    });

    return jsonResponse(
      {
        ok: true,
        message: "Throttle reset completed",
        ip: targetIp,
        attempts_cleared: attemptsBefore || 0,
      },
      200,
    );
  } catch (error) {
    logError("internal_error", error);
    return jsonResponse({ error_code: "internal_error", message: "Internal server error" }, 500);
  }
});
