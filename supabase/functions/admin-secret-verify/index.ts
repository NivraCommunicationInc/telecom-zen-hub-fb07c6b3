import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": [
    "authorization",
    "x-client-info",
    "apikey",
    "content-type",
    "x-supabase-client-platform",
    "x-supabase-client-version",
    "x-supabase-api-version",
    "x-requested-with",
  ].join(", "),
};

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 10;
// Forbidden codes — no hardcoded default; env var required
const FORBIDDEN_CODES = ["000000", "123456", "111111", "654321", "112233"];

// Hash code using SHA-256
async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Generate session token
function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, "0")).join("");
}

interface RequestBody {
  admin_user_id: string;
  code: string;
  session_id: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = `secret-verify-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const timestamp = new Date().toISOString();
  
  // Get IP and user agent for logging
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  console.log(`[${requestId}] [${timestamp}] admin-secret-verify started`);

  try {
    const body: RequestBody = await req.json();
    const { admin_user_id, code, session_id } = body;

    // Validate inputs
    if (!admin_user_id || !code || !session_id) {
      console.error(`[${requestId}] Missing required fields`);
      return new Response(
        JSON.stringify({ ok: false, request_id: requestId, error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      console.error(`[${requestId}] Invalid code format`);
      return new Response(
        JSON.stringify({ ok: false, request_id: requestId, error: "Code must be 6 digits" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for existing attempts record
    const { data: attemptRecord, error: attemptError } = await supabase
      .from("admin_secret_attempts")
      .select("*")
      .eq("admin_user_id", admin_user_id)
      .eq("session_id", session_id)
      .maybeSingle();

    if (attemptError) {
      console.error(`[${requestId}] Error checking attempts:`, attemptError);
      return new Response(
        JSON.stringify({ ok: false, request_id: requestId, error: "Database error" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if locked
    if (attemptRecord?.locked_until) {
      const lockedUntil = new Date(attemptRecord.locked_until);
      if (lockedUntil > new Date()) {
        const remainingMinutes = Math.ceil((lockedUntil.getTime() - Date.now()) / 60000);
        
        // Log lock attempt
        await supabase.from("admin_secret_audit_log").insert({
          request_id: requestId,
          admin_user_id,
          event: "verify_blocked_locked",
          ip_address: ip,
          user_agent: userAgent,
          meta: { locked_until: lockedUntil.toISOString(), remaining_minutes: remainingMinutes }
        });

        console.log(`[${requestId}] Account locked for ${remainingMinutes} more minutes`);
        return new Response(
          JSON.stringify({ 
            ok: false, 
            request_id: requestId, 
            error: "Account locked",
            locked: true,
            locked_until: lockedUntil.toISOString(),
            remaining_minutes: remainingMinutes
          }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Get stored code hash for this admin
    const { data: codeRecord, error: codeError } = await supabase
      .from("admin_security_codes")
      .select("code_hash")
      .eq("admin_user_id", admin_user_id)
      .maybeSingle();

    if (codeError) {
      console.error(`[${requestId}] Error fetching code:`, codeError);
      return new Response(
        JSON.stringify({ ok: false, request_id: requestId, error: "Database error" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Determine expected code hash
    let expectedHash: string;
    let usingDefaultCode = false;
    
    if (codeRecord?.code_hash) {
      expectedHash = codeRecord.code_hash;
    } else {
      // No code set — reject verification; admin must set a code first
      console.error(`[${requestId}] No security code configured for admin ${admin_user_id}`);
      
      await supabase.from("admin_secret_audit_log").insert({
        request_id: requestId,
        admin_user_id,
        event: "verify_rejected_no_code",
        ip_address: ip,
        user_agent: userAgent,
        meta: { reason: "no_security_code_configured" }
      });

      return new Response(
        JSON.stringify({ ok: false, request_id: requestId, error: "No security code configured. Please set one first.", needs_setup: true }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Hash the provided code and compare
    const providedHash = await hashCode(code);
    const isValid = providedHash === expectedHash;

    if (isValid) {
      // Success! Clear attempts and create session
      if (attemptRecord) {
        await supabase
          .from("admin_secret_attempts")
          .delete()
          .eq("id", attemptRecord.id);
      }

      // Generate session token
      const sessionToken = generateSessionToken();
      const sessionTokenHash = await hashCode(sessionToken);
      const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

      // Revoke any existing sessions for this admin
      await supabase
        .from("admin_otp_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("admin_user_id", admin_user_id)
        .is("revoked_at", null);

      // Create new session
      await supabase.from("admin_otp_sessions").insert({
        admin_user_id,
        session_token_hash: sessionTokenHash,
        expires_at: expiresAt.toISOString(),
        verified_at: new Date().toISOString(),
        request_id: requestId
      });

      // Log success
      await supabase.from("admin_secret_audit_log").insert({
        request_id: requestId,
        admin_user_id,
        event: "verify_success",
        ip_address: ip,
        user_agent: userAgent,
        meta: { using_default_code: usingDefaultCode }
      });

      console.log(`[${requestId}] Verification successful for admin ${admin_user_id}`);

      return new Response(
        JSON.stringify({
          ok: true,
          request_id: requestId,
          session_token: sessionToken,
          session_expires_at: expiresAt.toISOString(),
          using_default_code: usingDefaultCode
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    } else {
      // Failed verification
      const currentAttempts = (attemptRecord?.attempts || 0) + 1;
      const attemptsLeft = MAX_ATTEMPTS - currentAttempts;
      
      let lockUntil: string | null = null;
      if (currentAttempts >= MAX_ATTEMPTS) {
        lockUntil = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000).toISOString();
      }

      // Upsert attempt record
      if (attemptRecord) {
        await supabase
          .from("admin_secret_attempts")
          .update({
            attempts: currentAttempts,
            locked_until: lockUntil
          })
          .eq("id", attemptRecord.id);
      } else {
        await supabase.from("admin_secret_attempts").insert({
          admin_user_id,
          session_id,
          attempts: currentAttempts,
          locked_until: lockUntil
        });
      }

      // Log failure
      await supabase.from("admin_secret_audit_log").insert({
        request_id: requestId,
        admin_user_id,
        event: lockUntil ? "verify_failed_locked" : "verify_failed",
        ip_address: ip,
        user_agent: userAgent,
        meta: { attempts: currentAttempts, attempts_left: attemptsLeft }
      });

      console.log(`[${requestId}] Verification failed for admin ${admin_user_id}, attempts: ${currentAttempts}/${MAX_ATTEMPTS}`);

      if (lockUntil) {
        return new Response(
          JSON.stringify({
            ok: false,
            request_id: requestId,
            error: "Too many attempts. Account locked.",
            locked: true,
            locked_until: lockUntil,
            remaining_minutes: LOCK_DURATION_MINUTES
          }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({
          ok: false,
          request_id: requestId,
          error: "Invalid code",
          attempts_left: attemptsLeft
        }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[${requestId}] Error:`, errorMessage);
    
    return new Response(
      JSON.stringify({ ok: false, request_id: requestId, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
