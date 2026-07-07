import { createClient } from "npm:@supabase/supabase-js@2";
import { violetShell } from "../_shared/violetEmailShell.ts";

// Allowed origins whitelist (secure, not "*")
const ALLOWED_ORIGINS = [
  "https://nivra-telecom.ca",
  "https://www.nivra-telecom.ca",
  "https://telecom-zen-hub.lovable.app",
];

function getSupportEmail(): string {
  const raw = (Deno.env.get("SUPPORT_EMAIL") || "support@nivra-telecom.ca").trim().toLowerCase();
  const domain = raw.split("@")[1] || "";
  const VERIFIED_DOMAINS = ["nivra-telecom.ca", "send.nivra-telecom.ca", "nivra.ca"];
  const ok = VERIFIED_DOMAINS.some((d) => domain.endsWith(d));
  return ok ? raw : "support@nivra-telecom.ca";
}

function buildPinHtml(pin: string): string {
  return violetShell({
    badge: "VÉRIFICATION / VERIFICATION",
    heroTitle: "Votre code de vérification",
    bodyHtml: `Voici votre code pour accéder à votre Portail Client Nivra.<br/><em style="color:#6B7280;">Here is your verification code to access your Nivra Client Portal.</em>`,
    extraBodyHtml: `
      <div style="background-color:#E6F0FA;border:2px solid #0066CC;border-radius:8px;padding:24px;text-align:center;margin:0 0 20px;">
        <p style="margin:0 0 8px;font-size:13px;color:#6B7280;text-transform:uppercase;letter-spacing:1px;">Code de vérification</p>
        <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:8px;color:#0066CC;font-family:monospace;">${pin}</p>
      </div>`,
    helpHtml: `⏱️ Ce code expire dans <strong>10 minutes</strong>. / <em>This code expires in 10 minutes.</em><br/>🔒 Si vous n'avez pas demandé ce code, ignorez cet email. / <em>If you did not request this code, ignore this email.</em>`,
    helpVariant: "warning",
  });
}

function buildPrimaryFromEmail(): string {
  // Prefer a verified domain derived from SUPPORT_EMAIL.
  // IMPORTANT: do NOT force the `send.` subdomain if the verified domain is the root domain.
  const support = getSupportEmail().toLowerCase();
  const supportDomain = support.split("@")[1] || "";

  // Keep this list aligned with getSupportEmail()'s allowlist.
  const VERIFIED_DOMAINS = ["nivra-telecom.ca", "send.nivra-telecom.ca", "nivra.ca"];

  // Pick the best candidate domain in priority order.
  const candidates = [
    supportDomain,
    "nivra-telecom.ca",
    "send.nivra-telecom.ca",
  ].filter(Boolean);

  const fromDomain =
    candidates.find((d) => VERIFIED_DOMAINS.some((v) => d.endsWith(v))) ||
    "nivra-telecom.ca";

  return `Nivra Telecom <noreply@${fromDomain}>`;
}

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

// PBKDF2-SHA256 with per-record random salt (100k iterations).
// Replaces the legacy SHA-256(pin + service_role_key) scheme.
const PBKDF2_ITERATIONS = 100_000;

function generatePinSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

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

// Route through the Lovable connector gateway. `RESEND_API_KEY` is now the
// connector-gateway connection key (managed by standard_connectors), NOT a raw
// Resend API key — direct calls to api.resend.com return 401 "API key is invalid".
// See: https://docs.lovable.dev — Connector Gateway.
const RESEND_GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

async function sendEmailWithRetry(
  connectionApiKey: string,
  emailConfig: { from: string; to: string[]; subject: string; html: string; text?: string; reply_to?: string },
  maxRetries = 3,
): Promise<{ success: boolean; error?: string; statusCode?: number }> {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableApiKey) {
    return { success: false, error: "LOVABLE_API_KEY not configured (required for connector gateway)" };
  }
  const delays = [500, 2000, 5000];
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const body: Record<string, unknown> = {
        from: emailConfig.from,
        to: emailConfig.to,
        subject: emailConfig.subject,
        html: emailConfig.html,
      };
      if (emailConfig.text) body.text = emailConfig.text;
      if (emailConfig.reply_to) body.reply_to = emailConfig.reply_to;
      const r = await fetch(`${RESEND_GATEWAY_URL}/emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableApiKey}`,
          "X-Connection-Api-Key": connectionApiKey,
        },
        body: JSON.stringify(body),
      });
      if (r.ok) return { success: true };
      const statusCode = r.status;
      const errText = await r.text();
      console.error(`[client-pin-send] attempt ${attempt + 1} failed: ${statusCode} ${errText.slice(0, 300)}`);
      if (statusCode === 403 || statusCode === 422) return { success: false, error: errText, statusCode };
      if (attempt < maxRetries - 1) await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    } catch (err) {
      console.error(`[client-pin-send] attempt ${attempt + 1} exception:`, err);
      if (attempt < maxRetries - 1) await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    }
  }
  return { success: false, error: "Failed to send email after multiple attempts" };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
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
          error: `Email service not configured. Contact ${getSupportEmail()}` 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Invalidate any previous active codes for this email.
    // This prevents confusion (old email arrives late/spam) and avoids verifying against the wrong "latest" record.
    const nowIso = new Date().toISOString();
    const { error: invalidateError } = await supabase
      .from("client_login_pins")
      .update({ used: true })
      .eq("email", email.toLowerCase())
      .eq("used", false)
      .gt("expires_at", nowIso);

    if (invalidateError) {
      console.error(`[client-pin-send][${requestId}] Failed to invalidate previous pins:`, invalidateError);
      // Non-bloquant: on continue à générer/envoyer le nouveau code.
    }

    // Generate PIN, per-record salt, and PBKDF2 hash
    const pin = generatePin();
    const pinSalt = generatePinSalt();
    const pinHash = await hashPin(pin, pinSalt);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    console.log(`[client-pin-send][${requestId}] Generated PIN, expires: ${expiresAt}`);

    // Store hashed PIN
    const { error: insertError } = await supabase
      .from("client_login_pins")
      .insert({
        user_id,
        email: email.toLowerCase(),
        pin_hash: pinHash,
        pin_salt: pinSalt,
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

    // Send email with PIN using retry logic - Professional Blue Design
    const fromEmail = buildPrimaryFromEmail();
    console.log(`[client-pin-send][${requestId}] Sending email from: ${fromEmail}`);

    const emailResult = await sendEmailWithRetry(resendApiKey, {
      from: fromEmail,
      to: [email],
      subject: "Votre code de vérification Nivra",
      reply_to: getSupportEmail(),
      text: `Votre code de vérification Nivra: ${pin}\n\nCe code expire dans 10 minutes. Si vous n'avez pas demandé ce code, ignorez cet email.\n\nSupport: ${getSupportEmail()}`,
      html: buildPinHtml(pin),
    });

    // If sender domain isn't verified, Resend rejects with 403.
    // Retry once with a guaranteed sender domain.
    if (!emailResult.success && emailResult.statusCode === 403) {
      console.warn(`[client-pin-send][${requestId}] Primary sender rejected (403), retrying with resend.dev sender`);
      try {
        const retryR = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
          body: JSON.stringify({
            from: "Nivra Telecom <onboarding@resend.dev>",
          to: [email],
          subject: "Votre code de vérification Nivra",
          reply_to: getSupportEmail(),
          text: `Votre code de vérification Nivra: ${pin}\n\nCe code expire dans 10 minutes. Si vous n'avez pas demandé ce code, ignorez cet email.\n\nSupport: ${getSupportEmail()}`,
          html: buildPinHtml(pin),
          }),
        });
        if (retryR.ok) {
          console.log(`[client-pin-send][${requestId}] SUCCESS - fallback sender`);
          return new Response(JSON.stringify({ sent: true, request_id: requestId }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        console.error(`[client-pin-send][${requestId}] Fallback send failed: ${retryR.status}`);
      } catch (retryErr) {
        console.error(`[client-pin-send][${requestId}] Fallback exception:`, retryErr);
      }
    }

    if (!emailResult.success) {
      console.error(`[client-pin-send][${requestId}] Email send failed: ${emailResult.error}`);
      // Delete the PIN record since email failed
      await supabase.from("client_login_pins").delete().eq("pin_hash", pinHash);
      return new Response(
        JSON.stringify({
          sent: false,
          reason: "email_failed",
          error: `Impossible d'envoyer le code pour le moment. Réessayez dans 1 minute ou contactez ${getSupportEmail()}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[client-pin-send][${requestId}] SUCCESS - email sent to ${maskedEmail}`);

    return new Response(
      JSON.stringify({ sent: true, request_id: requestId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[client-pin-send][${requestId}] Unexpected error:`, error);
    return new Response(
      JSON.stringify({ 
        sent: false, 
        reason: "server_error", 
        error: `Impossible d'envoyer le code pour le moment. Réessayez dans 1 minute ou contactez ${getSupportEmail()}`,
        request_id: requestId 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
