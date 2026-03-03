/**
 * Edge Function: generate-verification-qr
 * Creates an identity_verification_session + returns QR code as data URL
 * SECURITY: Token is hashed (SHA-256) before storage. Only hash is persisted.
 * Rate-limited: max 5 sessions per user per hour
 * QR points to: https://nivra-telecom.ca/verify-id?t=<public_token>
 * 
 * Logging: Each request gets a request_id with step-level timing.
 * Fallback: If QR PNG fails, returns verify_url for client-side QR rendering.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Production CORS: allow all origins (handled at gateway level)
const ALLOWED_ORIGINS = [
  "https://nivra-telecom.ca",
  "https://www.nivra-telecom.ca",
  "https://telecom-zen-hub.lovable.app",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.find(o => o === origin) || ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma": "no-cache",
  };
}

/** SHA-256 hash a string and return hex */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Generate QR code as SVG data URL (no external dependency) */
function generateQrSvgDataUrl(text: string, size: number = 280): string {
  // Use a simple QR encoding via SVG with embedded data
  // This creates a URL-based QR code using a minimal approach
  const encoded = encodeURIComponent(text);
  // Generate a deterministic visual pattern based on text hash
  // For production QR: we use the client-side qrcode library as fallback
  // Server returns verify_url and client renders QR
  return "";
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();

  const log = (step: string, detail?: string) => {
    const elapsed = Date.now() - startTime;
    console.log(`[${requestId}] [${elapsed}ms] ${step}${detail ? ': ' + detail : ''}`);
  };

  const jsonResponse = (body: Record<string, unknown>, status: number) =>
    new Response(JSON.stringify({ ...body, request_id: requestId }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    log("START", "generate-verification-qr");

    const authHeader = req.headers.get("Authorization");
    const authPresent = !!authHeader?.startsWith("Bearer ");
    log("AUTH", `present=${authPresent}`);

    if (!authPresent) {
      return jsonResponse({ error_code: "unauthorized", error: "Missing or invalid Authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader! } },
    });

    // Verify user
    const token = authHeader!.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      log("AUTH_FAIL", userError?.message || "no user");
      return jsonResponse({ error_code: "auth_failed", error: "Invalid or expired authentication token" }, 401);
    }
    const userId = userData.user.id;
    log("AUTH_OK", `user=${userId.slice(0, 8)}...`);

    // Use service role for DB operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json().catch(() => ({}));
    const { checkout_type, order_context, regenerate_session_id, checkout_fields } = body;
    log("BODY", `type=${checkout_type}, regenerate=${!!regenerate_session_id}`);

    // Rate limiting: max 5 sessions per user per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("identity_verification_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", oneHourAgo);

    log("RATE_LIMIT", `recent=${recentCount}/5`);

    if ((recentCount || 0) >= 5) {
      return jsonResponse({
        error_code: "rate_limited",
        error: "Rate limit exceeded. Max 5 verification sessions per hour.",
      }, 429);
    }

    // If regenerating, expire the old session
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
        if (oldSession.qr_regeneration_count >= MAX_REGEN) {
          log("REGEN_LIMIT", `max ${MAX_REGEN} reached`);
          return jsonResponse({
            error_code: "regen_limit",
            error: `Maximum QR regenerations reached (${MAX_REGEN}). Please restart checkout.`,
            max_regen_allowed: MAX_REGEN,
          }, 429);
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

        log("REGEN_OK", `expired old=${regenerate_session_id.slice(0, 8)}, count=${newRegenCount}/${MAX_REGEN}`);
      }
    }

    // Generate secure public token
    const publicToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const publicTokenHash = await hashToken(publicToken);
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes

    // Create session — store HASH only, public_token is NULL
    log("DB_INSERT", "creating session...");
    const dbStart = Date.now();
    const { data: session, error: sessionError } = await supabase
      .from("identity_verification_sessions")
      .insert({
        public_token: null,
        public_token_hash: publicTokenHash,
        user_id: userId,
        checkout_type: checkout_type || "mobile",
        order_context: order_context || {},
        checkout_fields: checkout_fields || null,
        status: "created",
        expires_at: expiresAt.toISOString(),
        qr_regeneration_count: newRegenCount,
      })
      .select()
      .single();

    log("DB_INSERT", `done in ${Date.now() - dbStart}ms, success=${!sessionError}`);

    if (sessionError) {
      console.error("Session creation error:", sessionError);
      return jsonResponse({
        error_code: "db_error",
        error: "Failed to create verification session",
        detail: sessionError.message,
      }, 500);
    }

    // Log creation event
    await supabase.from("identity_verification_events").insert({
      session_id: session.id,
      event_type: "session_created",
      actor_id: userId,
      actor_role: "client",
      details: { checkout_type, regenerated_from: regenerate_session_id || null },
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
      user_agent: req.headers.get("user-agent"),
    });

    // Generate QR code as data URL
    const verifyUrl = `https://nivra-telecom.ca/verify-id?t=${publicToken}`;

    let qrDataUrl: string | null = null;
    try {
      const qrStart = Date.now();
      // Use dynamic import for QR generation — wrapped in try/catch for resilience
      const QRCode = (await import("npm:qrcode@1.5.4")).default;
      qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        width: 280,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
        errorCorrectionLevel: "H",
      });
      log("QR_RENDER", `done in ${Date.now() - qrStart}ms`);
    } catch (qrErr) {
      console.error("QR render error (returning URL fallback):", qrErr);
      log("QR_RENDER", `FAILED - returning URL fallback: ${String(qrErr)}`);
      // Client will generate QR from verify_url as fallback
    }

    const totalTime = Date.now() - startTime;
    log("DONE", `total=${totalTime}ms, qr=${qrDataUrl ? 'png' : 'fallback_url'}, session=${session.id}`);

    return jsonResponse({
      session_id: session.id,
      qr_data_url: qrDataUrl,
      verify_url: verifyUrl,
      expires_at: expiresAt.toISOString(),
      status: "created",
      qr_regeneration_count: newRegenCount,
      max_regen_allowed: MAX_REGEN,
    }, 200);
  } catch (err) {
    log("ERROR", String(err));
    console.error("QR generation error:", err);
    return jsonResponse({
      error_code: "internal_error",
      error: "Internal server error",
    }, 500);
  }
});
