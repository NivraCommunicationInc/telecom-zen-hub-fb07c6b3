import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

type ClientPasswordResetSendRequest = {
  email: string;
  redirect_origin?: string; // window.location.origin from the portal (used only if allowed)
};

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, "");

const getAllowedOrigins = (): string[] => {
  const allowedOriginsEnv = Deno.env.get("ALLOWED_ORIGINS");
  if (allowedOriginsEnv && allowedOriginsEnv.trim() !== "" && allowedOriginsEnv !== "ALLOWED_ORIGINS") {
    return allowedOriginsEnv.split(",").map((o) => o.trim()).filter(Boolean);
  }

  const appBaseUrl = (Deno.env.get("APP_BASE_URL") || "").split(",")[0]?.trim();
  if (appBaseUrl) return [appBaseUrl];

  // Hard fallback (should be overridden via secrets)
  return ["https://nivra-telecom.ca"];
};

const isOriginAllowed = (origin: string, allowedOrigins: string[]): boolean => {
  if (!origin) return false;
  if (allowedOrigins.includes(origin)) return true;

  // Always allow Lovable preview domains
  if (origin.endsWith(".lovableproject.com")) return true;
  if (origin.endsWith(".lovable.app")) return true;

  return false;
};

const resolveRedirectBaseUrl = (requestedOrigin: string | undefined): string => {
  const allowedOrigins = getAllowedOrigins();
  const fallback = allowedOrigins[0] || "https://nivra-telecom.ca";

  if (requestedOrigin && isOriginAllowed(requestedOrigin, allowedOrigins)) {
    return normalizeBaseUrl(requestedOrigin);
  }
  return normalizeBaseUrl(fallback);
};

const pickFromEmail = (): { from: string; replyTo: string } => {
  const supportEmailRaw = (Deno.env.get("SUPPORT_EMAIL") || "support@nivratelecom.ca").trim();
  const supportEmail = supportEmailRaw.toLowerCase();
  const domain = supportEmail.split("@")[1] || "";

  // Keep this strict to avoid Resend errors when a non-verified domain is configured.
  const VERIFIED_DOMAINS = ["nivratelecom.ca", "nivra.ca", "nivra-telecom.ca"];
  const fallback = "support@nivratelecom.ca";
  const fromEmail = VERIFIED_DOMAINS.some((d) => domain.endsWith(d)) ? supportEmail : fallback;

  return {
    from: `Nivra Télécom <${fromEmail}>`,
    replyTo: fromEmail,
  };
};

serve(async (req: Request): Promise<Response> => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body: ClientPasswordResetSendRequest = await req.json();
    const email = (body.email || "").trim().toLowerCase();

    if (!email) {
      return new Response(JSON.stringify({ success: false, error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[client-password-reset-send] Request for: ${email}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error("[client-password-reset-send] RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ success: false, error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Use caller origin only if it matches ALLOWED_ORIGINS (prevents open redirects)
    const redirectBaseUrl = resolveRedirectBaseUrl(body.redirect_origin);
    const redirectTo = `${redirectBaseUrl}/portal/reset-password`;

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    // Prevent user enumeration: always respond success.
    if (linkError || !linkData?.properties?.action_link) {
      console.warn("[client-password-reset-send] generateLink failed (returning success anyway):", linkError);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resetLink = linkData.properties.action_link;
    const { from, replyTo } = pickFromEmail();
    const resend = new Resend(resendApiKey);

    const subject = "Réinitialisation de mot de passe — Nivra Télécom";
    const html = `
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:28px 16px;">
      <div style="background:#ffffff;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,0.08);overflow:hidden;">
        <div style="padding:22px 26px;border-bottom:1px solid #eef0f3;">
          <div style="font-size:14px;color:#6b7280;">Nivra Télécom</div>
          <div style="font-size:22px;font-weight:700;color:#111827;margin-top:6px;">Réinitialiser votre mot de passe</div>
        </div>
        <div style="padding:22px 26px;">
          <p style="margin:0 0 14px 0;color:#111827;font-size:15px;line-height:1.6;">
            Vous avez demandé la réinitialisation du mot de passe de votre compte.
          </p>
          <p style="margin:0 0 18px 0;color:#111827;font-size:15px;line-height:1.6;">
            Cliquez sur le bouton ci‑dessous pour choisir un nouveau mot de passe.
          </p>

          <div style="text-align:center;margin:22px 0 18px 0;">
            <a href="${resetLink}" target="_blank" rel="noopener noreferrer"
               style="display:inline-block;padding:14px 22px;border-radius:10px;background:#0b5cff;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;">
              Réinitialiser mon mot de passe
            </a>
          </div>

          <p style="margin:0 0 10px 0;color:#6b7280;font-size:13px;line-height:1.6;">
            Si le bouton ne fonctionne pas, copiez/collez ce lien dans votre navigateur :
          </p>
          <p style="margin:0 0 18px 0;color:#111827;font-size:13px;line-height:1.6;word-break:break-all;">
            <a href="${resetLink}" target="_blank" rel="noopener noreferrer" style="color:#0b5cff;">${resetLink}</a>
          </p>

          <p style="margin:0;color:#6b7280;font-size:13px;line-height:1.6;">
            Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
          </p>
        </div>
        <div style="padding:16px 26px;border-top:1px solid #eef0f3;color:#6b7280;font-size:12px;line-height:1.6;">
          Besoin d'aide? Répondez à cet email ou contactez-nous: <a href="mailto:${replyTo}" style="color:#0b5cff;text-decoration:none;">${replyTo}</a>
        </div>
      </div>
      <div style="text-align:center;color:#9ca3af;font-size:12px;margin-top:14px;">
        © ${new Date().getFullYear()} Nivra Télécom
      </div>
    </div>
  </body>
</html>`;

    const text = `Nivra Télécom — Réinitialisation de mot de passe\n\nOuvrez ce lien pour réinitialiser votre mot de passe:\n${resetLink}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`;

    // Send via Resend
    const emailResponse = await resend.emails.send({
      from,
      to: [email],
      subject,
      html,
      text,
      reply_to: replyTo,
    });

    console.log("[client-password-reset-send] Email send response:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[client-password-reset-send] Unexpected error:", error);
    // Prevent enumeration on unexpected errors too
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
