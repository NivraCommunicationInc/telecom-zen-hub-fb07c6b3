/**
 * Edge Function: generate-verification-qr
 * Creates an identity_verification_session + returns QR code PNG data URL
 * SECURITY: public token is hashed (SHA-256) before persistence
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://nivra-telecom.ca",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Cache-Control": "no-store",
};

/** SHA-256 hash a string and return hex */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

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
    console.log(JSON.stringify({
      level: "info",
      event,
      request_id: requestId,
      timestamp: new Date().toISOString(),
      origin,
      auth_present: authPresent,
      ...details,
    }));
  };

  const logError = (event: string, error: unknown, details: Record<string, unknown> = {}) => {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(JSON.stringify({
      level: "error",
      event,
      request_id: requestId,
      timestamp: new Date().toISOString(),
      origin,
      auth_present: authPresent,
      error_message: err.message,
      error_stack: err.stack,
      ...details,
    }));
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
    logInfo("preflight_ok");
    return new Response("ok", { status: 200, headers: responseHeaders });
  }

  try {
    logInfo("request_received", { method: req.method });

    if (req.method !== "POST") {
      return jsonResponse(
        { error_code: "method_not_allowed", message: "Method not allowed" },
        405,
      );
    }

    const body = await req.json().catch(() => ({}));
    const { user_id: bodyUserId, checkout_type, order_context, regenerate_session_id, checkout_fields } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      logInfo("missing_env", {
        has_url: !!supabaseUrl,
        has_anon: !!supabaseAnonKey,
        has_service_role: !!serviceRoleKey,
      });
      return jsonResponse(
        { error_code: "config_error", message: "Missing backend environment configuration" },
        500,
      );
    }

    let userId: string | null = null;

    if (authPresent) {
      const token = authHeader.replace("Bearer ", "").trim();
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const { data: userData, error: userError } = await userClient.auth.getUser(token);
      if (userError || !userData?.user) {
        logInfo("auth_failed", { detail: userError?.message || "no user" });
        return jsonResponse(
          { error_code: "auth_failed", message: "Invalid or expired authentication token" },
          401,
        );
      }

      userId = userData.user.id;
      logInfo("auth_ok", { user_id_prefix: userId.slice(0, 8) });
    } else if (typeof bodyUserId === "string" && bodyUserId.trim()) {
      userId = bodyUserId.trim();
      logInfo("public_mode", { user_id_prefix: userId.slice(0, 8) });
    } else {
      return jsonResponse(
        { error_code: "unauthorized", message: "Missing Authorization header or user_id payload" },
        401,
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    logInfo("payload_received", {
      checkout_type: checkout_type || "mobile",
      has_regenerate_session_id: !!regenerate_session_id,
    });

    // Rate limiting windows
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const clientIp = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "")
      .split(",")[0]
      .trim() || null;

    // Mobile anti-abuse IP throttle
    if ((checkout_type || "mobile") === "mobile" && clientIp) {
      const { count: ipRecentCount } = await supabase
        .from("identity_verification_sessions")
        .select("id", { count: "exact", head: true })
        .eq("client_ip", clientIp)
        .gte("created_at", oneHourAgo);

      if ((ipRecentCount || 0) >= 10) {
        logInfo("ip_rate_limited", { client_ip: clientIp, recent_count: ipRecentCount, limit: 10 });
        return jsonResponse(
          { error_code: "ip_rate_limited", message: "Too many requests from this IP. Please try again later." },
          429,
        );
      }
    }

    // Per-user rate limiting: max 5 sessions per user per hour
    const { count: recentCount } = await supabase
      .from("identity_verification_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneHourAgo);

    if ((recentCount || 0) >= 5) {
      logInfo("rate_limited", { recent_count: recentCount, limit: 5 });
      return jsonResponse(
        {
          error_code: "rate_limited",
          message: "Rate limit exceeded. Max 5 verification sessions per hour.",
        },
        429,
      );
    }

    // Regeneration: expire old session and increment counter
    const MAX_REGEN = 3;
    let newRegenCount = 0;

    if (regenerate_session_id) {
      const { data: oldSession } = await supabase
        .from("identity_verification_sessions")
        .select("id, qr_regeneration_count")
        .eq("id", regenerate_session_id)
        .eq("user_id", userId)
        .single();

      if (oldSession) {
        if ((oldSession.qr_regeneration_count || 0) >= MAX_REGEN) {
          return jsonResponse(
            {
              error_code: "regen_limit",
              message: `Maximum QR regenerations reached (${MAX_REGEN}). Please restart checkout.`,
              max_regen_allowed: MAX_REGEN,
            },
            429,
          );
        }

        newRegenCount = (oldSession.qr_regeneration_count || 0) + 1;

        await supabase
          .from("identity_verification_sessions")
          .update({ status: "expired" })
          .eq("id", regenerate_session_id);

        await supabase.from("identity_verification_events").insert({
          session_id: regenerate_session_id,
          event_type: "expired_by_regeneration",
          actor_id: userId,
          actor_role: "client",
          details: { regen_count: newRegenCount, max_allowed: MAX_REGEN },
        });

        logInfo("expired_by_regeneration", {
          old_session_prefix: regenerate_session_id.slice(0, 8),
          regen_count: newRegenCount,
        });
      }
    }

    // Generate secure token + store hash only
    const publicToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const publicTokenHash = await hashToken(publicToken);
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000);

    const { data: session, error: sessionError } = await supabase
      .from("identity_verification_sessions")
      .insert({
        public_token: null,
        public_token_hash: publicTokenHash,
        user_id: userId,
        checkout_type: checkout_type || "mobile",
        order_context: order_context || {},
        checkout_fields: checkout_fields || null,
        client_ip: clientIp,
        client_user_agent: req.headers.get("user-agent"),
        status: "created",
        expires_at: expiresAt.toISOString(),
        qr_regeneration_count: newRegenCount,
      })
      .select()
      .single();

    if (sessionError || !session) {
      logError("db_insert_session_failed", sessionError || new Error("Missing session after insert"));
      return jsonResponse(
        {
          error_code: "db_error",
          message: "Failed to create verification session",
        },
        500,
      );
    }

    await supabase.from("identity_verification_events").insert({
      session_id: session.id,
      event_type: "session_created",
      actor_id: userId,
      actor_role: "client",
      details: { checkout_type, regenerated_from: regenerate_session_id || null },
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
      user_agent: req.headers.get("user-agent"),
    });

    const verifyUrl = `https://nivra-telecom.ca/verify-id?t=${publicToken}`;

    let qrPng: string | null = null;
    try {
      const QRCode = (await import("npm:qrcode@1.5.4")).default;
      qrPng = await QRCode.toDataURL(verifyUrl, {
        width: 280,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
        errorCorrectionLevel: "H",
      });
    } catch (qrError) {
      logError("qr_render_failed", qrError);
    }

    logInfo("session_created", {
      session_id: session.id,
      has_qr_png: !!qrPng,
      regen_count: newRegenCount,
    });

    return jsonResponse(
      {
        session_id: session.id,
        verify_url: verifyUrl,
        qr_png: qrPng,
        qr_data_url: qrPng,
        expires_at: expiresAt.toISOString(),
        status: "created",
        qr_regeneration_count: newRegenCount,
        max_regen_allowed: MAX_REGEN,
      },
      200,
    );
  } catch (error) {
    logError("internal_error", error);
    return jsonResponse(
      {
        error_code: "internal_error",
        message: "Internal server error",
      },
      500,
    );
  }
});
