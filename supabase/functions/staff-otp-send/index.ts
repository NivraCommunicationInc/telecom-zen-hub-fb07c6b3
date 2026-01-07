import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Allowed origins whitelist for staff OTP (secure, not "*")
const ALLOWED_ORIGINS = [
  "https://nivratelecom.ca",
  "https://www.nivratelecom.ca",
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

// Rate limit: max 3 OTP requests per 15 minutes per user
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 3;

interface RequestBody {
  user_id: string;
}

// Generate unique request ID for logging
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// SHA-256 hash for OTP
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
    `[staff-otp-send][${requestId}] ${method} request from origin: ${origin || "none"} (allowed=${originAllowed})`,
  );

  // IMPORTANT: If origin is not allowed, return 403 WITHOUT CORS headers.
  if (!originAllowed) {
    console.warn(`[staff-otp-send][${requestId}] Blocked request: origin not allowed`);

    if (method === "OPTIONS") {
      return new Response(null, { status: 403 });
    }

    return new Response(
      JSON.stringify({ success: false, error: "Origin not allowed" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const corsHeaders = getCorsHeaders(origin);
  console.log(`[staff-otp-send][${requestId}] CORS Allow-Origin: ${corsHeaders["Access-Control-Allow-Origin"]}`);

  // Handle CORS preflight
  if (method === "OPTIONS") {
    console.log(`[staff-otp-send][${requestId}] Handling OPTIONS preflight - returning 204`);
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let body: RequestBody;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error(`[staff-otp-send][${requestId}] Invalid JSON body:`, parseErr);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { user_id } = body;
    console.log(`[staff-otp-send][${requestId}] Processing for user_id: ${user_id?.substring(0, 8)}...`);

    if (!user_id) {
      console.error(`[staff-otp-send][${requestId}] Missing user_id`);
      return new Response(
        JSON.stringify({ success: false, error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify user is staff (admin or employee)
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role, status")
      .eq("user_id", user_id)
      .in("role", ["admin", "employee"])
      .maybeSingle();

    if (roleError) {
      console.error(`[staff-otp-send][${requestId}] Role lookup error:`, roleError);
      return new Response(
        JSON.stringify({ success: false, error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!roleData) {
      console.log(`[staff-otp-send][${requestId}] User is not staff`);
      return new Response(
        JSON.stringify({ success: false, error: "User is not staff" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[staff-otp-send][${requestId}] User role: ${roleData.role}, status: ${roleData.status}`);

    if (roleData.status !== "active") {
      return new Response(
        JSON.stringify({ success: false, error: "Account is not active" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Rate limiting: check OTP requests in last 15 minutes
    const rateLimitWindow = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const { count: recentRequests } = await supabase
      .from("staff_otp_codes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user_id)
      .gte("created_at", rateLimitWindow);

    if (recentRequests && recentRequests >= RATE_LIMIT_MAX_REQUESTS) {
      console.log(`Rate limit exceeded for user ${user_id}: ${recentRequests} requests in window`);
      
      // Audit log rate limit hit
      await supabase.from("admin_audit_log").insert({
        admin_user_id: user_id,
        action: "2fa_rate_limited",
        target_type: "user",
        target_id: user_id,
        details: { requests_in_window: recentRequests },
      });

      return new Response(
        JSON.stringify({ success: false, error: "Trop de demandes. Réessayez dans 15 minutes." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user email from auth
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(user_id);
    
    if (userError || !user?.email) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not find user email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate OTP
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate any existing unused OTPs for this user
    await supabase
      .from("staff_otp_codes")
      .update({ used: true })
      .eq("user_id", user_id)
      .eq("used", false);

    // Insert new OTP
    const { error: insertError } = await supabase
      .from("staff_otp_codes")
      .insert({
        user_id,
        email: user.email,
        code_hash: otpHash,
        expires_at: expiresAt.toISOString(),
        attempts: 0,
        max_attempts: 5,
        used: false,
      });

    if (insertError) {
      console.error("Failed to insert OTP:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to generate OTP" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Audit log OTP send
    await supabase.from("admin_audit_log").insert({
      admin_user_id: user_id,
      admin_email: user.email,
      action: "2fa_otp_sent",
      target_type: "user",
      target_id: user_id,
      details: { method: "email", expires_in_minutes: 10 },
    });

    console.log(`OTP generated for ${user.email}, expires at ${expiresAt.toISOString()}`);

    // Send email with OTP
    if (RESEND_API_KEY) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Nivra Sécurité <noreply@nivratelecom.ca>",
            to: [user.email],
            subject: "Votre code de vérification Nivra",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #0891b2;">Code de vérification</h2>
                <p>Votre code de vérification pour accéder au portail Nivra est :</p>
                <div style="background: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                  <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1f2937;">${otp}</span>
                </div>
                <p style="color: #6b7280; font-size: 14px;">Ce code expire dans 10 minutes.</p>
                <p style="color: #6b7280; font-size: 14px;">Si vous n'avez pas demandé ce code, ignorez ce message.</p>
              </div>
            `,
          }),
        });

        if (!emailResponse.ok) {
          console.error("Resend API error:", await emailResponse.text());
        } else {
          console.log(`OTP email sent to ${user.email}`);
        }
      } catch (emailErr) {
        console.error("Failed to send email:", emailErr);
      }
    } else {
      // DEV mode - log OTP to console
      console.log(`[DEV MODE] OTP for ${user.email}: ${otp}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: "OTP sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in staff-otp-send:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
