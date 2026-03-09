import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { Resend } from "../_shared/ResendProxy.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from "../_shared/rateLimit.ts";

type ClientPasswordResetSendRequest = {
  email: string;
  redirect_origin?: string;
};

const normalizeBaseUrl = (url: string) => url.replace(/\/+$/, "");

const getAllowedOrigins = (): string[] => {
  const allowedOriginsEnv = Deno.env.get("ALLOWED_ORIGINS");
  if (allowedOriginsEnv && allowedOriginsEnv.trim() !== "" && allowedOriginsEnv !== "ALLOWED_ORIGINS") {
    return allowedOriginsEnv.split(",").map((o) => o.trim()).filter(Boolean);
  }

  const appBaseUrl = (Deno.env.get("APP_BASE_URL") || "").split(",")[0]?.trim();
  if (appBaseUrl) return [appBaseUrl];

  return ["https://nivra-telecom.ca"];
};

const isOriginAllowed = (origin: string, allowedOrigins: string[]): boolean => {
  if (!origin) return false;
  if (allowedOrigins.includes(origin)) return true;
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
  // Default to the primary public domain (avoid legacy domains that may not be verified at the sender).
  const supportEmailRaw = (Deno.env.get("SUPPORT_EMAIL") || "support@nivra-telecom.ca").trim();
  const supportEmail = supportEmailRaw.toLowerCase();
  const domain = supportEmail.split("@")[1] || "";

  // Only keep domains we actually want to send from.
  // (If an unverified domain is used in the From header, the sender provider rejects the message.)
  const VERIFIED_DOMAINS = ["nivra-telecom.ca", "nivra.ca"];
  const fallback = "support@nivra-telecom.ca";
  const fromEmail = VERIFIED_DOMAINS.some((d) => domain.endsWith(d)) ? supportEmail : fallback;

  return {
    from: `Nivra Télécom <${fromEmail}>`,
    replyTo: fromEmail,
  };
};

// ============================================================
// NIVRA PROFESSIONAL EMAIL TEMPLATE - Password Reset
// Design System: #0066CC primary, professional, high-contrast
// ============================================================
const colors = {
  primary: '#0066CC',
  primaryDark: '#004C99',
  primaryLight: '#E6F0FA',
  textPrimary: '#1A1A1A',
  textSecondary: '#4A4A4A',
  textMuted: '#6B7280',
  textLight: '#9CA3AF',
  white: '#FFFFFF',
  bgLight: '#F8FAFB',
  bgSection: '#F3F4F6',
  borderLight: '#E5E7EB',
  footerBg: '#1F2937',
  footerText: '#D1D5DB',
  footerLink: '#9CA3AF',
  infoBg: '#EFF6FF',
  infoBorder: '#BFDBFE',
  info: '#2563EB',
  warningBg: '#FFFBEB',
  warningBorder: '#FCD34D',
  warning: '#D97706',
};

const generatePasswordResetEmail = (resetLink: string, supportEmail: string): string => {
  const currentYear = new Date().getFullYear();
  
  return `
<!DOCTYPE html>
<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no, address=no, email=no, date=no">
  <title>Réinitialisation de mot de passe - Nivra Télécom</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <style>
    table { border-collapse: collapse; }
    td { font-family: Arial, sans-serif; }
  </style>
  <![endif]-->
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
      background-color: ${colors.bgLight};
    }
    table { 
      border-collapse: collapse !important; 
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
      -ms-interpolation-mode: bicubic;
    }
    a {
      color: ${colors.primary};
      text-decoration: underline;
    }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; }
      .content-padding { padding: 24px 16px !important; }
      .header-padding { padding: 20px 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${colors.bgLight}; font-family: Arial, Helvetica, 'Segoe UI', sans-serif; color: ${colors.textPrimary};">
  <!-- Preheader -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    Réinitialisez votre mot de passe Nivra Télécom &#847; &#847; &#847; &#847; &#847;
  </div>
  
  <!-- Wrapper -->
  <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; background-color: ${colors.bgLight};">
    <tr>
      <td style="padding: 32px 16px;">
        <!-- Main Container -->
        <table role="presentation" cellpadding="0" cellspacing="0" class="container" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: ${colors.white}; border: 1px solid ${colors.borderLight}; border-radius: 8px;">
          
          <!-- Header -->
          <tr>
            <td class="header-padding" style="padding: 28px 40px; border-bottom: 3px solid ${colors.primary}; background-color: ${colors.white};">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                  <td style="text-align: left;">
                    <h1 style="margin: 0; font-size: 26px; font-weight: 700; color: ${colors.primary}; font-family: Arial, Helvetica, sans-serif;">Nivra Telecom</h1>
                  </td>
                  <td style="text-align: right; vertical-align: middle;">
                    <span style="color: ${colors.textMuted}; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Télécommunications</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Status Banner -->
          <tr>
            <td style="padding: 24px 40px; background-color: ${colors.infoBg}; border-bottom: 1px solid ${colors.infoBorder};">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                  <td style="width: 48px; vertical-align: top;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background-color: ${colors.white}; text-align: center; line-height: 40px; border: 2px solid ${colors.infoBorder};">
                      <span style="font-size: 20px;">🔑</span>
                    </div>
                  </td>
                  <td style="vertical-align: middle; padding-left: 16px;">
                    <h2 style="color: ${colors.info}; font-size: 18px; font-weight: 700; margin: 0 0 4px 0;">Réinitialisation de mot de passe</h2>
                    <p style="color: ${colors.textSecondary}; font-size: 14px; margin: 0;">Demande reçue</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td class="content-padding" style="padding: 32px 40px;">
              <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                Bonjour,
              </p>
              <p style="color: ${colors.textSecondary}; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
                Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte Nivra Télécom.
              </p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                  <tr>
                    <td style="background-color: ${colors.primary}; border-radius: 6px; text-align: center;">
                      <a href="${resetLink}" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: ${colors.white}; text-decoration: none; font-family: Arial, Helvetica, sans-serif;">
                        Réinitialiser mon mot de passe →
                      </a>
                    </td>
                  </tr>
                </table>
              </div>
              
              <p style="color: ${colors.textMuted}; font-size: 13px; text-align: center; margin-top: 16px;">
                Ou copiez ce lien dans votre navigateur:<br>
                <a href="${resetLink}" style="color: ${colors.primary}; word-break: break-all; font-size: 12px;">${resetLink}</a>
              </p>
              
              <!-- Warning Alert -->
              <div style="background-color: ${colors.warningBg}; border: 1px solid ${colors.warningBorder}; border-left: 4px solid ${colors.warning}; border-radius: 4px; padding: 16px; margin: 24px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                  <tr>
                    <td style="width: 32px; vertical-align: top; padding-right: 12px;">
                      <span style="font-size: 20px;">⏰</span>
                    </td>
                    <td>
                      <p style="color: ${colors.warning}; font-size: 14px; font-weight: 600; margin: 0 0 4px 0;">Lien valide 24 heures</p>
                      <p style="color: ${colors.textSecondary}; font-size: 13px; margin: 0; line-height: 1.5;">Ce lien expirera bientôt. Si vous n'avez pas demandé cette réinitialisation, ignorez cet email et votre mot de passe restera inchangé.</p>
                    </td>
                  </tr>
                </table>
              </div>
              
              <!-- Help Section -->
              <div style="margin-top: 32px; padding: 24px; background-color: ${colors.bgSection}; border-radius: 8px; text-align: center;">
                <p style="color: ${colors.textPrimary}; font-size: 15px; font-weight: 600; margin: 0 0 8px 0;">Besoin d'aide?</p>
                <p style="color: ${colors.textSecondary}; font-size: 14px; margin: 0 0 16px 0;">Notre équipe est disponible via chat ou tickets (réponse sous 1h à 24h)</p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                  <tr>
                    <td style="padding: 0 8px;">
                      <a href="https://nivra-telecom.ca/portal" style="display: inline-block; padding: 10px 20px; background-color: ${colors.primary}; color: ${colors.white}; font-size: 13px; font-weight: 600; text-decoration: none; border-radius: 6px; white-space: nowrap;">
                        💬&nbsp;Chat / Tickets
                      </a>
                    </td>
                    <td style="padding: 0 8px;">
                      <a href="mailto:${supportEmail}" style="display: inline-block; padding: 10px 20px; background-color: ${colors.white}; color: ${colors.primary}; font-size: 13px; font-weight: 600; text-decoration: none; border-radius: 6px; border: 1px solid ${colors.borderLight}; white-space: nowrap;">
                        ✉️&nbsp;${supportEmail}
                      </a>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: ${colors.footerBg}; padding: 32px 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                  <td style="text-align: center; padding-bottom: 20px;">
                    <h4 style="color: ${colors.white}; font-size: 18px; font-weight: 700; margin: 0;">Nivra Telecom</h4>
                    <p style="color: ${colors.footerText}; font-size: 13px; margin: 8px 0 0 0;">
                      Fournisseur de services de télécommunications prépayés au Québec
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; padding-bottom: 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                      <tr>
                        <td style="padding: 0 12px; white-space: nowrap;">
                          <a href="https://nivra-telecom.ca/portal" style="color: ${colors.footerLink}; font-size: 13px; text-decoration: none; white-space: nowrap;">💬&nbsp;Chat / Tickets</a>
                        </td>
                        <td style="padding: 0 12px; white-space: nowrap;">
                          <a href="mailto:${supportEmail}" style="color: ${colors.footerLink}; font-size: 13px; text-decoration: none; white-space: nowrap;">✉️&nbsp;${supportEmail}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; padding-bottom: 16px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                      <tr>
                        <td style="padding: 0 8px;"><a href="https://nivra-telecom.ca" style="color: ${colors.footerLink}; font-size: 12px; text-decoration: none;">Site web</a></td>
                        <td style="color: ${colors.footerText};">|</td>
                        <td style="padding: 0 8px;"><a href="https://nivra-telecom.ca/privacy" style="color: ${colors.footerLink}; font-size: 12px; text-decoration: none;">Confidentialité</a></td>
                        <td style="color: ${colors.footerText};">|</td>
                        <td style="padding: 0 8px;"><a href="https://nivra-telecom.ca/terms" style="color: ${colors.footerLink}; font-size: 12px; text-decoration: none;">Conditions</a></td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="border-top: 1px solid #374151; padding-top: 16px; text-align: center;">
                    <p style="color: ${colors.textLight}; font-size: 11px; margin: 0;">
                      © ${currentYear} Nivra Telecom Inc. Tous droits réservés.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
};

Deno.serve(async (req: Request): Promise<Response> => {
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
    // Rate limit: 3 password resets per 60 min per IP
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateCheck = await checkRateLimit({ key: `pwd_reset:${clientIp}`, ...RATE_LIMITS.PASSWORD_RESET });
    if (!rateCheck.allowed) {
      return rateLimitResponse(rateCheck, corsHeaders, "fr");
    }

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
    const html = generatePasswordResetEmail(resetLink, replyTo);
    const text = `Nivra Télécom — Réinitialisation de mot de passe\n\nOuvrez ce lien pour réinitialiser votre mot de passe:\n${resetLink}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`;

    const emailResponse = await resend.emails.send({
      from,
      to: [email],
      subject,
      html,
      text,
      reply_to: replyTo,
    });

    console.log("[client-password-reset-send] Email send response:", emailResponse);

    // If sender domain isn't verified, Resend rejects with 403.
    // We keep enumeration-protection behavior (always success) but we retry with a guaranteed sender.
    if ((emailResponse as any)?.error?.statusCode === 403) {
      console.warn("[client-password-reset-send] Primary sender rejected, retrying with resend.dev sender");
      const retry = await resend.emails.send({
        from: "Nivra Télécom <onboarding@resend.dev>",
        to: [email],
        subject,
        html,
        text,
        reply_to: replyTo,
      });
      console.log("[client-password-reset-send] Retry send response:", retry);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("[client-password-reset-send] Unexpected error:", error);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
