import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Allowed origins whitelist for staff OTP (secure, not "*")
const ALLOWED_ORIGINS = [
  "https://nivra-telecom.ca",
  "https://www.nivra-telecom.ca",
  "https://telecom-zen-hub.lovable.app",
];

// Strict origin check (no wildcard domains, no fallback origin)
function isAllowedOrigin(origin: string | null): origin is string {
  return typeof origin === "string" && ALLOWED_ORIGINS.includes(origin);
}

// Get CORS headers for an allowed origin
function getCorsHeaders(allowedOrigin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

interface RequestBody {
  user_id: string;
  code: string;
}

// Generate unique request ID for logging
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// Same hash function as send
async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode("nivra_otp_salt_2026" + otp);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  const requestId = generateRequestId();
  const origin = req.headers.get("origin");
  const method = req.method;

  const originAllowed = isAllowedOrigin(origin);
  console.log(
    `[staff-otp-verify][${requestId}] ${method} request from origin: ${origin || "none"} (allowed=${originAllowed})`,
  );

  // IMPORTANT: If origin is not allowed, return 403 WITHOUT CORS headers.
  if (!originAllowed) {
    console.warn(`[staff-otp-verify][${requestId}] Blocked request: origin not allowed`);

    if (method === "OPTIONS") {
      return new Response(null, { status: 403 });
    }

    return new Response(
      JSON.stringify({ success: false, error: "Origin not allowed" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const corsHeaders = getCorsHeaders(origin);
  console.log(`[staff-otp-verify][${requestId}] CORS Allow-Origin: ${corsHeaders["Access-Control-Allow-Origin"]}`);

  // Handle CORS preflight
  if (method === "OPTIONS") {
    console.log(`[staff-otp-verify][${requestId}] Handling OPTIONS preflight - returning 204`);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: RequestBody = await req.json();
    const { user_id, code } = body;

    if (!user_id || !code) {
      return new Response(
        JSON.stringify({ success: false, error: "user_id and code are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return new Response(
        JSON.stringify({ success: false, error: "Code invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash the submitted code
    const codeHash = await hashOTP(code);

    // Find valid OTP for this user (not used, not expired)
    const { data: otpData, error: otpError } = await supabase
      .from("staff_otp_codes")
      .select("*")
      .eq("user_id", user_id)
      .eq("used", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) {
      console.error("OTP lookup error:", otpError);
      return new Response(
        JSON.stringify({ success: false, error: "Erreur de vérification" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!otpData) {
      // Audit log failed verification (no valid OTP)
      await supabase.from("admin_audit_log").insert({
        admin_user_id: user_id,
        action: "2fa_verify_failed",
        target_type: "user",
        target_id: user_id,
        details: { reason: "no_valid_otp" },
      });

      return new Response(
        JSON.stringify({ success: false, error: "Code expiré ou invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const maxAttempts = otpData.max_attempts || 5;

    // Check if max attempts exceeded
    if (otpData.attempts >= maxAttempts) {
      // Mark as used to prevent further attempts
      await supabase
        .from("staff_otp_codes")
        .update({ used: true })
        .eq("id", otpData.id);

      // Audit log lockout
      await supabase.from("admin_audit_log").insert({
        admin_user_id: user_id,
        action: "2fa_lockout",
        target_type: "user",
        target_id: user_id,
        details: { attempts: otpData.attempts, max_attempts: maxAttempts },
      });

      return new Response(
        JSON.stringify({ success: false, error: "Trop de tentatives. Demandez un nouveau code." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increment attempts before verification
    const newAttempts = otpData.attempts + 1;
    await supabase
      .from("staff_otp_codes")
      .update({ attempts: newAttempts })
      .eq("id", otpData.id);

    // Verify code hash
    if (otpData.code_hash !== codeHash) {
      const remainingAttempts = maxAttempts - newAttempts;
      
      // Audit log failed attempt
      await supabase.from("admin_audit_log").insert({
        admin_user_id: user_id,
        action: "2fa_verify_failed",
        target_type: "user",
        target_id: user_id,
        details: { reason: "invalid_code", attempts: newAttempts, remaining: remainingAttempts },
      });

      console.log(`OTP verification failed for user ${user_id}: ${remainingAttempts} attempts remaining`);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Code incorrect. ${remainingAttempts} tentative(s) restante(s).`
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Code is valid - mark as used (one-time use)
    await supabase
      .from("staff_otp_codes")
      .update({ used: true })
      .eq("id", otpData.id);

    // Update user_roles with otp_verified_at for session trust
    const { error: updateError } = await supabase
      .from("user_roles")
      .update({ otp_verified_at: new Date().toISOString() })
      .eq("user_id", user_id)
      .in("role", ["admin", "employee"]);

    if (updateError) {
      console.error("Failed to update otp_verified_at:", updateError);
    }

    // Get user email for audit log
    const { data: { user } } = await supabase.auth.admin.getUserById(user_id);

    // Audit log successful verification
    await supabase.from("admin_audit_log").insert({
      admin_user_id: user_id,
      admin_email: user?.email,
      action: "2fa_verified",
      target_type: "user",
      target_id: user_id,
      details: { method: "otp_email", attempts_used: newAttempts },
    });

    console.log(`OTP verified successfully for user ${user_id} (${user?.email})`);

    return new Response(
      JSON.stringify({ success: true, message: "Vérification réussie" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in staff-otp-verify:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
