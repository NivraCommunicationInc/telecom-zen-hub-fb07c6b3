import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple hash function using Web Crypto API
async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")); // salt with service key
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function generatePin(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1000000).padStart(6, "0");
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

// Retry with exponential backoff
async function sendEmailWithRetry(
  resend: InstanceType<typeof Resend>,
  emailConfig: { from: string; to: string[]; subject: string; html: string },
  maxRetries = 3
): Promise<{ success: boolean; error?: string }> {
  const delays = [500, 2000, 5000]; // 0.5s, 2s, 5s
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { error } = await resend.emails.send(emailConfig);
      if (!error) {
        return { success: true };
      }
      console.error(`[client-pin-send] Email attempt ${attempt + 1} failed:`, error);
      
      // Don't retry on certain errors
      if (error.message?.includes("validation") || error.message?.includes("invalid")) {
        return { success: false, error: error.message };
      }
      
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
      }
    } catch (err) {
      console.error(`[client-pin-send] Email attempt ${attempt + 1} exception:`, err);
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delays[attempt]));
      }
    }
  }
  
  return { success: false, error: "Failed to send email after multiple attempts" };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = generateRequestId();
  console.log(`[client-pin-send][${requestId}] Request received`);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error(`[client-pin-send][${requestId}] RESEND_API_KEY not configured`);
      return new Response(
        JSON.stringify({ 
          sent: false, 
          reason: "config_error",
          error: "Email service not configured. Contact Support@nivratelecom.ca" 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    let body;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error(`[client-pin-send][${requestId}] Invalid JSON body:`, parseErr);
      return new Response(
        JSON.stringify({ sent: false, reason: "invalid_request", error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, user_id } = body;

    if (!email || !user_id) {
      console.error(`[client-pin-send][${requestId}] Missing email or user_id`);
      return new Response(
        JSON.stringify({ sent: false, reason: "missing_params", error: "Email and user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const maskedEmail = maskEmail(email);
    console.log(`[client-pin-send][${requestId}] Processing for: ${maskedEmail}`);

    // Rate limit check: no PIN sent in last 60 seconds
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
    const { data: recentPins, error: checkError } = await supabase
      .from("client_login_pins")
      .select("id, created_at")
      .eq("email", email.toLowerCase())
      .gte("created_at", oneMinuteAgo)
      .order("created_at", { ascending: false })
      .limit(1);

    if (checkError) {
      console.error(`[client-pin-send][${requestId}] Rate limit check failed:`, checkError);
      return new Response(
        JSON.stringify({ sent: false, reason: "db_error", error: "Database error. Please retry." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (recentPins && recentPins.length > 0) {
      console.log(`[client-pin-send][${requestId}] Rate limited for: ${maskedEmail}`);
      return new Response(
        JSON.stringify({ sent: false, reason: "rate_limited", retry_after_seconds: 60 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate PIN and hash it
    const pin = generatePin();
    const pinHash = await hashPin(pin);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    console.log(`[client-pin-send][${requestId}] Generated PIN, expires: ${expiresAt}`);

    // Store hashed PIN
    const { error: insertError } = await supabase
      .from("client_login_pins")
      .insert({
        user_id,
        email: email.toLowerCase(),
        pin_hash: pinHash,
        expires_at: expiresAt,
        attempts: 0,
        used: false,
      });

    if (insertError) {
      console.error(`[client-pin-send][${requestId}] DB insert failed:`, insertError);
      return new Response(
        JSON.stringify({ sent: false, reason: "db_error", error: "Failed to create verification code" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email with PIN using retry logic
    const emailResult = await sendEmailWithRetry(resend, {
      from: "Nivra Telecom <noreply@nivratelecom.ca>",
      to: [email],
      subject: "Votre code de vérification Nivra",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; margin: 0; padding: 20px; }
            .container { max-width: 480px; margin: 0 auto; background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
            .logo { text-align: center; margin-bottom: 24px; }
            .logo-box { display: inline-block; width: 48px; height: 48px; background: linear-gradient(135deg, #06b6d4, #22d3ee); border-radius: 12px; line-height: 48px; font-size: 24px; font-weight: bold; color: #0f172a; }
            h1 { font-size: 20px; color: #18181b; text-align: center; margin: 0 0 16px; }
            .pin-box { background: #f4f4f5; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0; }
            .pin { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #06b6d4; font-family: monospace; }
            p { color: #52525b; font-size: 14px; line-height: 1.6; margin: 12px 0; }
            .footer { text-align: center; color: #a1a1aa; font-size: 12px; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e4e4e7; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo"><span class="logo-box">N</span></div>
            <h1>Code de vérification</h1>
            <p style="text-align: center;">Voici votre code de vérification pour accéder à votre Portail Client Nivra:</p>
            <div class="pin-box">
              <span class="pin">${pin}</span>
            </div>
            <p style="text-align: center;">Ce code expire dans <strong>10 minutes</strong>.</p>
            <p style="text-align: center; color: #dc2626; font-size: 13px;">Si vous n'avez pas demandé ce code, veuillez ignorer cet email.</p>
            <div class="footer">
              <p>Nivra Communications Inc. © ${new Date().getFullYear()}</p>
              <p>1799 Av. Pierre-Péladeau, Laval, QC H7T 2Y5</p>
              <p>Support: Support@nivratelecom.ca | 438-544-2233</p>
              <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (!emailResult.success) {
      console.error(`[client-pin-send][${requestId}] Email send failed: ${emailResult.error}`);
      // Delete the PIN record since email failed
      await supabase.from("client_login_pins").delete().eq("pin_hash", pinHash);
      return new Response(
        JSON.stringify({ 
          sent: false, 
          reason: "email_failed",
          error: "Impossible d'envoyer le code pour le moment. Réessayez dans 1 minute ou contactez Support@nivratelecom.ca" 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[client-pin-send][${requestId}] SUCCESS - email sent to ${maskedEmail}`);

    return new Response(
      JSON.stringify({ sent: true, request_id: requestId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[client-pin-send][${requestId}] Unexpected error:`, error);
    return new Response(
      JSON.stringify({ 
        sent: false, 
        reason: "server_error", 
        error: "Impossible d'envoyer le code pour le moment. Réessayez dans 1 minute ou contactez Support@nivratelecom.ca",
        request_id: requestId 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
