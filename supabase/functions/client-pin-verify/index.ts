import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "../_shared/rateLimit.ts";

// Allowed origins whitelist (secure, not "*")
const ALLOWED_ORIGINS = [
  "https://nivra-telecom.ca",
  "https://www.nivra-telecom.ca",
  "https://telecom-zen-hub.lovable.app",
];

// Get CORS headers with proper origin validation
function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  const isAllowed = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin);

  return {
    "Access-Control-Allow-Origin": isAllowed ? requestOrigin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

// PBKDF2-SHA256 with per-record salt — must match client-pin-send
const PBKDF2_ITERATIONS = 100_000;
async function hashPin(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  return Array.from(new Uint8Array(derived))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Constant-time hex comparison
function timingSafeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Generate unique request ID for logging
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// Mask email for logging
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***";
  const maskedLocal = local.length > 2 ? local[0] + "***" + local[local.length - 1] : "***";
  return `${maskedLocal}@${domain}`;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const requestId = generateRequestId();
  console.log(`[client-pin-verify][${requestId}] Request received`);

  try {
    // Rate limit: 5 PIN verify attempts per 10 min per IP
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateCheck = await checkRateLimit({ key: `pin_verify:${clientIp}`, ...RATE_LIMITS.OTP_VERIFY });
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck, corsHeaders, "fr");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error(`[client-pin-verify][${requestId}] Invalid JSON body:`, parseErr);
      return new Response(
        JSON.stringify({ valid: false, reason: "invalid_request", error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, pin } = body;

    if (!email || !pin) {
      console.error(`[client-pin-verify][${requestId}] Missing email or pin`);
      return new Response(
        JSON.stringify({ valid: false, reason: "missing_params", error: "Email and PIN are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate PIN format
    if (!/^\d{6}$/.test(pin)) {
      console.log(`[client-pin-verify][${requestId}] Invalid PIN format`);
      return new Response(
        JSON.stringify({ valid: false, reason: "invalid_format", error: "PIN must be exactly 6 digits" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const maskedEmail = maskEmail(email);
    console.log(`[client-pin-verify][${requestId}] Verifying for: ${maskedEmail}`);

    // Fetch the latest non-expired, unused PIN record for this email
    const now = new Date().toISOString();
    const { data: pinRecords, error: fetchError } = await supabase
      .from("client_login_pins")
      .select("*")
      .eq("email", email.toLowerCase())
      .eq("used", false)
      .gt("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error(`[client-pin-verify][${requestId}] DB fetch error:`, fetchError);
      return new Response(
        JSON.stringify({ valid: false, reason: "db_error", error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pinRecords || pinRecords.length === 0) {
      console.log(`[client-pin-verify][${requestId}] No valid PIN found for: ${maskedEmail}`);
      return new Response(
        JSON.stringify({ valid: false, reason: "no_valid_pin", error: "Aucun code valide trouvé. Veuillez demander un nouveau code." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pinRecord = pinRecords[0];

    // Check if too many attempts (max 5)
    if (pinRecord.attempts >= 5) {
      console.log(`[client-pin-verify][${requestId}] Too many attempts for: ${maskedEmail}`);
      // Invalidate the PIN
      await supabase
        .from("client_login_pins")
        .update({ used: true })
        .eq("id", pinRecord.id);

      return new Response(
        JSON.stringify({ 
          valid: false, 
          reason: "too_many_attempts", 
          error: "Trop de tentatives échouées. Veuillez demander un nouveau code." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash the provided PIN and compare
    // Reject legacy rows missing per-record salt (must request a fresh PIN)
    if (!pinRecord.pin_salt) {
      console.log(`[client-pin-verify][${requestId}] Legacy PIN without salt, rejecting for: ${maskedEmail}`);
      await supabase.from("client_login_pins").update({ used: true }).eq("id", pinRecord.id);
      return new Response(
        JSON.stringify({ valid: false, reason: "no_valid_pin", error: "Code expiré. Veuillez demander un nouveau code." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const providedHash = await hashPin(pin, pinRecord.pin_salt);

    if (!timingSafeEqualHex(providedHash, pinRecord.pin_hash)) {
      const newAttempts = pinRecord.attempts + 1;
      console.log(`[client-pin-verify][${requestId}] Invalid PIN, attempt ${newAttempts}`);
      
      // Increment attempts
      await supabase
        .from("client_login_pins")
        .update({ attempts: newAttempts })
        .eq("id", pinRecord.id);

      const attemptsLeft = 5 - newAttempts;
      return new Response(
        JSON.stringify({ 
          valid: false,
          reason: "invalid_pin",
          error: `Code invalide. ${attemptsLeft} tentative${attemptsLeft !== 1 ? 's' : ''} restante${attemptsLeft !== 1 ? 's' : ''}.`,
          attempts_left: attemptsLeft
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PIN is valid - mark as used
    console.log(`[client-pin-verify][${requestId}] SUCCESS - PIN verified for: ${maskedEmail}`);
    await supabase
      .from("client_login_pins")
      .update({ used: true })
      .eq("id", pinRecord.id);

    // Also clean up old expired PINs for this user (housekeeping)
    await supabase
      .from("client_login_pins")
      .delete()
      .eq("email", email.toLowerCase())
      .lt("expires_at", now);

    return new Response(
      JSON.stringify({ valid: true, request_id: requestId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[client-pin-verify][${requestId}] Unexpected error:`, error);
    return new Response(
      JSON.stringify({ valid: false, reason: "server_error", error: errorMessage, request_id: requestId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
