// Send "service activated" email when activation_request transitions to completed.
// Uses the existing locked Nivra corporate email template.
// BCC: support@nivra-telecom.ca + nivratelecom@gmail.com

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "../_shared/ResendProxy.ts";
import {
  emailDocument,
  header,
  colors,
  fonts,
  escapeHtml,
} from "../_shared/emailTemplates/components.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const BUSINESS_EMAILS = ["support@nivra-telecom.ca", "nivratelecom@gmail.com"];

interface RequestBody {
  activation_request_id: string;
}

function buildHtml(firstName: string, wifiName: string): string {
  const content = `
    ${header()}
    <tr>
      <td class="content-padding" style="padding: 32px 40px; font-family: ${fonts.primary}; color: ${colors.textPrimary};">
        <div style="background-color: ${colors.successBg}; border: 1px solid ${colors.successBorder}; padding: 16px 20px; margin: 0 0 24px; border-radius: 6px; text-align: center;">
          <p style="margin: 0; font-size: 16px; font-weight: 700; color: ${colors.successText};">✅ Votre service Nivra est activé</p>
        </div>

        <h2 style="margin: 0 0 16px; font-size: 22px; font-weight: 700;">Bonjour ${escapeHtml(firstName)},</h2>
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: ${colors.textSecondary};">
          Bonne nouvelle — votre service Internet Nivra est maintenant <strong>actif</strong> !
        </p>

        <div style="background-color: ${colors.primaryLight}; border-left: 4px solid ${colors.primary}; padding: 18px 22px; margin: 0 0 24px; border-radius: 6px;">
          <p style="margin: 0 0 6px; font-size: 12px; color: ${colors.textMuted}; text-transform: uppercase; letter-spacing: 1px;">Votre réseau WiFi</p>
          <p style="margin: 0; font-size: 18px; font-weight: 700; color: ${colors.primaryDark}; font-family: monospace;">${escapeHtml(wifiName)}</p>
        </div>

        <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: ${colors.textSecondary};">
          Vous pouvez maintenant connecter tous vos appareils à votre réseau WiFi.
        </p>

        <p style="margin: 0 0 12px; font-size: 14px; color: ${colors.textSecondary};">
          Gérez votre compte en tout temps depuis votre espace client :
        </p>
        <p style="margin: 0 0 24px;">
          <a href="https://nivra-telecom.ca/portail" style="display: inline-block; background-color: ${colors.primary}; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px;">Accéder à mon espace</a>
        </p>

        <p style="margin: 24px 0 0; font-size: 14px; color: ${colors.textSecondary};">
          Merci de faire confiance à Nivra Telecom !
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px 40px; background-color: ${colors.gray50}; border-top: 1px solid ${colors.borderLight}; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: ${colors.textMuted};">
          Nivra Telecom · <a href="mailto:support@nivra-telecom.ca" style="color: ${colors.primary};">support@nivra-telecom.ca</a>
        </p>
      </td>
    </tr>
  `;
  return emailDocument(
    "Votre service Nivra est activé",
    "Bienvenue chez Nivra — votre WiFi est en ligne",
    content,
  );
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
    const resend = new Resend(RESEND_API_KEY);
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = (await req.json()) as RequestBody;
    if (!body?.activation_request_id) {
      return new Response(JSON.stringify({ error: "activation_request_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ar, error: arErr } = await supabase
      .from("activation_requests")
      .select("id, client_id, wifi_network_name, status")
      .eq("id", body.activation_request_id)
      .maybeSingle();
    if (arErr || !ar) throw new Error(`Activation request not found: ${arErr?.message}`);

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name, first_name")
      .eq("user_id", ar.client_id)
      .maybeSingle();

    const email = profile?.email;
    if (!email) throw new Error("Client email not found");
    const firstName = profile?.first_name || (profile?.full_name ? profile.full_name.split(" ")[0] : "client");

    const html = buildHtml(firstName, ar.wifi_network_name || "Nivra-WiFi");

    const sendResp = await resend.emails.send({
      from: "Nivra Telecom <noreply@nivra-telecom.ca>",
      to: [email],
      bcc: BUSINESS_EMAILS,
      replyTo: "support@nivra-telecom.ca",
      subject: "✅ Votre service Nivra est activé — Bienvenue!",
      html,
      headers: { "X-Entity-Ref-ID": `activation-success-${ar.id}` },
    });

    console.log(`[send-activation-success-email] Sent to ${email} for activation ${ar.id}`);

    return new Response(JSON.stringify({
      success: true, message_id: sendResp.data?.id, activation_request_id: ar.id,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-activation-success-email] Error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
