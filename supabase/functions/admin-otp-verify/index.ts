import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a unique request ID
function generateRequestId(): string {
  return `otp-verify-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

// Hash OTP with pepper (same as send function)
async function hashOTP(otp: string): Promise<string> {
  const pepper = Deno.env.get("OTP_PEPPER_SECRET") || "nivra-otp-pepper-2024";
  const data = new TextEncoder().encode(otp + pepper);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Generate secure session token
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Hash session token for storage
async function hashSessionToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

interface RequestBody {
  admin_user_id: string;
  email: string;
  otp: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = generateRequestId();
  const startTime = Date.now();
  
  console.log(`[${requestId}] admin-otp-verify started at ${new Date().toISOString()}`);

  try {
    // Parse request body
    const body: RequestBody = await req.json();
    const { admin_user_id, email, otp } = body;

    console.log(`[${requestId}] Processing OTP verify for user: ${admin_user_id}`);

    if (!admin_user_id || !email || !otp) {
      console.error(`[${requestId}] Missing required fields`);
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields", request_id: requestId }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      console.error(`[${requestId}] Invalid OTP format`);
      return new Response(
        JSON.stringify({ success: false, error: "Code invalide. Entrez 6 chiffres.", request_id: requestId }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get IP and user agent from request
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    // Get the latest valid OTP code for this user
    const { data: otpCode, error: fetchError } = await supabase
      .from("admin_otp_codes")
      .select("*")
      .eq("admin_user_id", admin_user_id)
      .is("consumed_at", null)
      .is("locked_at", null)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !otpCode) {
      console.error(`[${requestId}] No valid OTP code found:`, fetchError);
      
      // Audit log
      await supabase.from("admin_auth_audit_log").insert({
        event: "otp_verify_fail",
        admin_user_id,
        email,
        request_id: requestId,
        meta: { ip, user_agent: userAgent, reason: "otp_missing_or_expired" }
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Code expiré ou invalide. Veuillez demander un nouveau code.", 
          request_id: requestId 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if locked due to too many attempts
    if (otpCode.attempts >= otpCode.max_attempts) {
      console.warn(`[${requestId}] OTP code locked due to max attempts`);
      
      // Lock the code
      await supabase
        .from("admin_otp_codes")
        .update({ locked_at: new Date().toISOString() })
        .eq("id", otpCode.id);

      await supabase.from("admin_auth_audit_log").insert({
        event: "otp_locked",
        admin_user_id,
        email,
        request_id: requestId,
        meta: { ip, user_agent: userAgent, attempts: otpCode.attempts }
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Trop de tentatives. Veuillez demander un nouveau code.", 
          locked: true,
          request_id: requestId 
        }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Hash the submitted OTP and compare
    const submittedHash = await hashOTP(otp);
    
    if (submittedHash !== otpCode.otp_hash) {
      // Wrong code - increment attempts
      const newAttempts = otpCode.attempts + 1;
      const attemptsLeft = otpCode.max_attempts - newAttempts;
      
      console.warn(`[${requestId}] Invalid OTP. Attempts: ${newAttempts}/${otpCode.max_attempts}`);

      // Update attempts count
      const updateData: any = { attempts: newAttempts };
      if (newAttempts >= otpCode.max_attempts) {
        updateData.locked_at = new Date().toISOString();
      }
      
      await supabase
        .from("admin_otp_codes")
        .update(updateData)
        .eq("id", otpCode.id);

      await supabase.from("admin_auth_audit_log").insert({
        event: "otp_verify_fail",
        admin_user_id,
        email,
        request_id: requestId,
        meta: { 
          ip, 
          user_agent: userAgent, 
          reason: "wrong_code",
          attempts: newAttempts,
          attempts_left: attemptsLeft
        }
      });

      const errorMessage = attemptsLeft > 0 
        ? `Code incorrect. ${attemptsLeft} tentative(s) restante(s).`
        : "Trop de tentatives. Veuillez demander un nouveau code.";

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMessage,
          attempts_left: attemptsLeft,
          locked: attemptsLeft <= 0,
          request_id: requestId 
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // OTP is valid! Mark as consumed
    console.log(`[${requestId}] OTP verified successfully`);
    
    await supabase
      .from("admin_otp_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", otpCode.id);

    // Create OTP session
    const sessionToken = generateSessionToken();
    const sessionTokenHash = await hashSessionToken(sessionToken);
    const sessionExpiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours

    // Revoke any existing sessions for this user
    await supabase
      .from("admin_otp_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("admin_user_id", admin_user_id)
      .is("revoked_at", null);

    // Insert new session
    const { error: sessionError } = await supabase
      .from("admin_otp_sessions")
      .insert({
        admin_user_id,
        session_token_hash: sessionTokenHash,
        request_id: requestId,
        expires_at: sessionExpiresAt.toISOString()
      });

    if (sessionError) {
      console.error(`[${requestId}] Failed to create session:`, sessionError);
      throw new Error("Failed to create OTP session");
    }

    // Audit log success
    await supabase.from("admin_auth_audit_log").insert({
      event: "otp_verify_success",
      admin_user_id,
      email,
      request_id: requestId,
      meta: { 
        ip, 
        user_agent: userAgent,
        otp_code_request_id: otpCode.request_id,
        session_expires_at: sessionExpiresAt.toISOString(),
        duration_ms: Date.now() - startTime
      }
    });

    console.log(`[${requestId}] OTP session created, expires at ${sessionExpiresAt.toISOString()}`);

    return new Response(
      JSON.stringify({
        success: true,
        request_id: requestId,
        session_token: sessionToken,
        session_expires_at: sessionExpiresAt.toISOString()
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error(`[${requestId}] Error in admin-otp-verify:`, error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || "Internal server error",
        request_id: requestId 
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
