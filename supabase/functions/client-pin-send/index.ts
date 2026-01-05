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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    const { email, user_id } = await req.json();

    if (!email || !user_id) {
      return new Response(
        JSON.stringify({ error: "Email and user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[client-pin-send] Processing request for email: ${email}`);

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
      console.error("[client-pin-send] Error checking rate limit:", checkError);
      return new Response(
        JSON.stringify({ error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (recentPins && recentPins.length > 0) {
      console.log(`[client-pin-send] Rate limited for email: ${email}`);
      return new Response(
        JSON.stringify({ sent: false, reason: "rate_limited", retry_after_seconds: 60 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate PIN and hash it
    const pin = generatePin();
    const pinHash = await hashPin(pin);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    console.log(`[client-pin-send] Generated PIN for ${email}, expires: ${expiresAt}`);

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
      console.error("[client-pin-send] Error storing PIN:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create verification PIN" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email with PIN
    const { error: emailError } = await resend.emails.send({
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
              <p>Nivra Telecom © ${new Date().getFullYear()}</p>
              <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (emailError) {
      console.error("[client-pin-send] Error sending email:", emailError);
      // Delete the PIN record since email failed
      await supabase.from("client_login_pins").delete().eq("pin_hash", pinHash);
      return new Response(
        JSON.stringify({ error: "Failed to send verification email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[client-pin-send] PIN email sent successfully to ${email}`);

    return new Response(
      JSON.stringify({ sent: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[client-pin-send] Unexpected error:", error);
    // Only return 500 for actual server errors
    return new Response(
      JSON.stringify({ sent: false, reason: "server_error", error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
