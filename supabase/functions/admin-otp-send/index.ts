import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a unique request ID
function generateRequestId(): string {
  return `otp-send-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
}

// Generate 6-digit OTP (100000-999999 to avoid leading zeros issues)
function generateOTP(): string {
  const min = 100000;
  const max = 999999;
  const otp = Math.floor(Math.random() * (max - min + 1)) + min;
  return otp.toString();
}

// Hash OTP with pepper
async function hashOTP(otp: string): Promise<string> {
  const pepper = Deno.env.get("OTP_PEPPER_SECRET") || "nivra-otp-pepper-2024";
  const data = new TextEncoder().encode(otp + pepper);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Mask email for display
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const maskedLocal = local.length > 2 
    ? local[0] + local[1] + "***" 
    : local[0] + "***";
  return `${maskedLocal}@${domain}`;
}

interface RequestBody {
  admin_user_id: string;
  email: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = generateRequestId();
  const startTime = Date.now();
  
  console.log(`[${requestId}] admin-otp-send started at ${new Date().toISOString()}`);

  try {
    // Parse request body
    const body: RequestBody = await req.json();
    const { admin_user_id, email } = body;

    console.log(`[${requestId}] Processing OTP send for user: ${admin_user_id}, email: ${maskEmail(email)}`);

    if (!admin_user_id || !email) {
      console.error(`[${requestId}] Missing required fields`);
      return new Response(
        JSON.stringify({ success: false, error: "Missing admin_user_id or email", request_id: requestId }),
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

    // Check if user is actually an admin
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role, is_active")
      .eq("user_id", admin_user_id)
      .eq("role", "admin")
      .eq("is_active", true)
      .single();

    if (roleError || !roleData) {
      console.error(`[${requestId}] User is not an active admin:`, roleError);
      
      // Audit log unauthorized attempt
      await supabase.from("admin_auth_audit_log").insert({
        event: "otp_send_unauthorized",
        admin_user_id,
        email,
        request_id: requestId,
        meta: { ip, user_agent: userAgent, reason: "not_admin" }
      });

      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized", request_id: requestId }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Rate limiting: Check for recent OTP sends (max 3 per 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("admin_otp_codes")
      .select("*", { count: "exact", head: true })
      .eq("admin_user_id", admin_user_id)
      .gte("created_at", fiveMinutesAgo);

    if (recentCount && recentCount >= 3) {
      console.warn(`[${requestId}] Rate limit exceeded for user ${admin_user_id}`);
      
      await supabase.from("admin_auth_audit_log").insert({
        event: "otp_send_rate_limited",
        admin_user_id,
        email,
        request_id: requestId,
        meta: { ip, user_agent: userAgent, recent_count: recentCount }
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Trop de demandes de code. Veuillez patienter 5 minutes.", 
          request_id: requestId 
        }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate OTP
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    console.log(`[${requestId}] Generated OTP, expires at ${expiresAt.toISOString()}`);

    // Invalidate any existing unused codes for this user
    await supabase
      .from("admin_otp_codes")
      .update({ locked_at: new Date().toISOString() })
      .eq("admin_user_id", admin_user_id)
      .is("consumed_at", null)
      .is("locked_at", null);

    // Insert new OTP code
    const { error: insertError } = await supabase
      .from("admin_otp_codes")
      .insert({
        admin_user_id,
        email,
        otp_hash: otpHash,
        request_id: requestId,
        expires_at: expiresAt.toISOString(),
        ip,
        user_agent: userAgent
      });

    if (insertError) {
      console.error(`[${requestId}] Failed to insert OTP code:`, insertError);
      throw new Error("Failed to create OTP code");
    }

    // Send email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      
      const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "Nivra <noreply@nivra.ca>";
      
      const emailResult = await resend.emails.send({
        from: fromEmail,
        to: [email],
        subject: `Votre code de vérification Nivra Admin: ${otp}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Code de vérification Nivra Admin</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px;">
            <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); overflow: hidden;">
              <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">Nivra Admin</h1>
                <p style="color: #a0aec0; margin: 8px 0 0 0; font-size: 14px;">Portail d'administration sécurisé</p>
              </div>
              
              <div style="padding: 40px 32px;">
                <h2 style="color: #1a1a2e; margin: 0 0 16px 0; font-size: 20px;">Code de vérification</h2>
                <p style="color: #4a5568; margin: 0 0 24px 0; line-height: 1.6;">
                  Pour terminer votre connexion au portail admin Nivra, entrez le code ci-dessous :
                </p>
                
                <div style="background: #f7fafc; border: 2px dashed #e2e8f0; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
                  <span style="font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1a1a2e;">${otp}</span>
                </div>
                
                <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
                  <p style="color: #92400e; margin: 0; font-size: 14px;">
                    <strong>⏱ Ce code expire dans 10 minutes</strong>
                  </p>
                </div>
                
                <p style="color: #718096; margin: 0; font-size: 13px; line-height: 1.6;">
                  Si vous n'avez pas demandé ce code, ignorez cet email ou contactez l'équipe de sécurité immédiatement.
                </p>
              </div>
              
              <div style="background: #f7fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0;">
                <p style="color: #a0aec0; margin: 0; font-size: 12px; text-align: center;">
                  Request ID: ${requestId}<br>
                  © ${new Date().getFullYear()} Nivra. Tous droits réservés.
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Votre code de vérification Nivra Admin: ${otp}\n\nCe code expire dans 10 minutes.\n\nSi vous n'avez pas demandé ce code, ignorez cet email.\n\nRequest ID: ${requestId}`,
      });

      console.log(`[${requestId}] Email sent successfully:`, emailResult);
    } else {
      // Dev mode: log OTP to console
      console.log(`[${requestId}] DEV MODE - OTP Code: ${otp}`);
    }

    // Audit log successful send
    await supabase.from("admin_auth_audit_log").insert({
      event: "otp_send",
      admin_user_id,
      email,
      request_id: requestId,
      meta: { 
        ip, 
        user_agent: userAgent,
        expires_at: expiresAt.toISOString(),
        duration_ms: Date.now() - startTime
      }
    });

    console.log(`[${requestId}] OTP send completed successfully in ${Date.now() - startTime}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        request_id: requestId,
        expires_at: expiresAt.toISOString(),
        masked_email: maskEmail(email)
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error(`[${requestId}] Error in admin-otp-send:`, error);
    
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
