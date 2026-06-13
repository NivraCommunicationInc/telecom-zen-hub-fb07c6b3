import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "../_shared/ResendProxy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendInviteRequest {
  influencer_id: string;
}

// ============================================================
// NIVRA PROFESSIONAL EMAIL TEMPLATE - Partner Invite
// Design System: #0066CC primary, professional, high-contrast
// ============================================================
const colors = {
  primary: '#0066CC',
  primaryDark: '#004C99',
  primaryLight: '#E6F0FA',
  accent: '#00A3A3',
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
  successBg: '#ECFDF5',
  successBorder: '#A7F3D0',
  success: '#059669',
};

const generatePartnerInviteEmail = (firstName: string, onboardingUrl: string, supportEmail: string): string => {
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
  <title>Invitation partenaire - Nivra Télécom</title>
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
    Bienvenue au programme partenaires Nivra Télécom! &#847; &#847; &#847; &#847; &#847;
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
                    <span style="color: ${colors.textMuted}; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Programme Partenaires</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Status Banner -->
          <tr>
            <td style="padding: 24px 40px; background-color: ${colors.successBg}; border-bottom: 1px solid ${colors.successBorder};">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                <tr>
                  <td style="width: 48px; vertical-align: top;">
                    <div style="width: 40px; height: 40px; border-radius: 50%; background-color: ${colors.white}; text-align: center; line-height: 40px; border: 2px solid ${colors.successBorder};">
                      <span style="font-size: 20px;">🎉</span>
                    </div>
                  </td>
                  <td style="vertical-align: middle; padding-left: 16px;">
                    <h2 style="color: ${colors.success}; font-size: 18px; font-weight: 700; margin: 0 0 4px 0;">Bienvenue ${firstName}!</h2>
                    <p style="color: ${colors.textSecondary}; font-size: 14px; margin: 0;">Vous êtes invité(e) au Programme Partenaires</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td class="content-padding" style="padding: 32px 40px;">
              <p style="color: ${colors.textPrimary}; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
                Bonjour ${firstName},
              </p>
              <p style="color: ${colors.textSecondary}; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
                Vous avez été invité(e) à rejoindre le <strong>Programme Partenaires Nivra Telecom</strong>.
              </p>
              
              <!-- Benefits Section -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin-bottom: 24px; border-bottom: 2px solid ${colors.primary}; padding-bottom: 8px;">
                <tr>
                  <td>
                    <h3 style="color: ${colors.textPrimary}; font-size: 15px; font-weight: 700; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">En tant que partenaire</h3>
                  </td>
                </tr>
              </table>
              
              <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px; background-color: ${colors.bgSection}; border-radius: 12px; margin-bottom: 12px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <span style="font-size: 24px;">💰</span>
                        </td>
                        <td style="padding-left: 16px;">
                          <p style="color: ${colors.textPrimary}; font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">Gagner des commissions</p>
                          <p style="color: ${colors.textMuted}; font-size: 14px; margin: 0;">Sur chaque client référé</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr><td style="height: 12px;"></td></tr>
                <tr>
                  <td style="padding: 16px; background-color: ${colors.bgSection}; border-radius: 12px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <span style="font-size: 24px;">📊</span>
                        </td>
                        <td style="padding-left: 16px;">
                          <p style="color: ${colors.textPrimary}; font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">Suivre vos performances</p>
                          <p style="color: ${colors.textMuted}; font-size: 14px; margin: 0;">Tableau de bord en temps réel</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr><td style="height: 12px;"></td></tr>
                <tr>
                  <td style="padding: 16px; background-color: ${colors.bgSection}; border-radius: 12px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%;">
                      <tr>
                        <td style="width: 40px; vertical-align: top;">
                          <span style="font-size: 24px;">💸</span>
                        </td>
                        <td style="padding-left: 16px;">
                          <p style="color: ${colors.textPrimary}; font-size: 15px; font-weight: 600; margin: 0 0 4px 0;">Demander des retraits</p>
                          <p style="color: ${colors.textMuted}; font-size: 14px; margin: 0;">Processus simple et rapide</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                  <tr>
                    <td style="background-color: ${colors.primary}; border-radius: 6px; text-align: center;">
                      <a href="${onboardingUrl}" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: ${colors.white}; text-decoration: none; font-family: Arial, Helvetica, sans-serif;">
                        Activer mon compte partenaire →
                      </a>
                    </td>
                  </tr>
                </table>
              </div>
              
              <p style="color: ${colors.textMuted}; font-size: 13px; text-align: center; margin: 16px 0;">
                Ce lien expire dans 7 jours. Si vous n'avez pas demandé cette invitation, ignorez cet email.
              </p>
              
              <!-- Help Section -->
              <div style="margin-top: 32px; padding: 24px; background-color: ${colors.bgSection}; border-radius: 8px; text-align: center;">
                <p style="color: ${colors.textPrimary}; font-size: 15px; font-weight: 600; margin: 0 0 8px 0;">Besoin d'aide?</p>
                <p style="color: ${colors.textSecondary}; font-size: 14px; margin: 0 0 16px 0;">Notre équipe est disponible pour vous accompagner</p>
                <a href="mailto:${supportEmail}" style="display: inline-block; padding: 10px 20px; background-color: ${colors.white}; color: ${colors.primary}; font-size: 13px; font-weight: 600; text-decoration: none; border-radius: 6px; border: 1px solid ${colors.borderLight};">
                  ✉️&nbsp;${supportEmail}
                </a>
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

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("[send-partner-invite] RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Email service not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const resend = new Resend(resendApiKey);
    const { influencer_id }: SendInviteRequest = await req.json();

    console.log("[send-partner-invite] Sending invite for influencer:", influencer_id);

    // Create Supabase admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch influencer details
    const { data: influencer, error: influencerError } = await supabase
      .from("influencers")
      .select("id, first_name, last_name, email")
      .eq("id", influencer_id)
      .single();

    if (influencerError || !influencer) {
      console.error("[send-partner-invite] Influencer not found:", influencerError);
      return new Response(
        JSON.stringify({ success: false, error: "Influencer not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch or create invite token
    let inviteData = await supabase
      .from("influencer_invites")
      .select("id, token, expires_at")
      .eq("influencer_id", influencer_id)
      .is("used_at", null)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let inviteToken: string;

    if (!inviteData.data) {
      // Create new invite token
      const token = crypto.randomUUID();
      const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

      const { data: newInvite, error: createError } = await supabase
        .from("influencer_invites")
        .insert({
          influencer_id,
          token,
          expires_at,
        })
        .select()
        .single();

      if (createError || !newInvite) {
        console.error("[send-partner-invite] Failed to create invite:", createError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to create invite" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      inviteToken = newInvite.token;
    } else {
      inviteToken = inviteData.data.token;
    }

    // Build absolute onboarding URL
    const appUrl = Deno.env.get("APP_URL") || Deno.env.get("APP_BASE_URL") || "https://nivra-telecom.ca";
    const onboardingUrl = `${appUrl}/influencer/onboarding?token=${encodeURIComponent(inviteToken)}`;
    const supportEmail = "support@nivra-telecom.ca";

    console.log("[send-partner-invite] Onboarding URL:", onboardingUrl);

    // Send email with professional template
    const emailResponse = await resend.emails.send({
      from: "Nivra Telecom <support@nivra-telecom.ca>",
      to: [influencer.email],
      subject: "Bienvenue au programme partenaires Nivra!",
      html: generatePartnerInviteEmail(influencer.first_name, onboardingUrl, supportEmail),
    });

    console.log("[send-partner-invite] Email sent:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, email_sent: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error("[send-partner-invite] Unexpected error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
