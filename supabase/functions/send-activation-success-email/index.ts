// Send "service activated" email when activation_request transitions to completed.
// Uses the EXACT same premium template as send-order-confirmation.
// BCC: support@nivra-telecom.ca + nivratelecom@gmail.com

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "../_shared/ResendProxy.ts";
import { escapeHtml } from "../_shared/emailTemplates/components.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const BUSINESS_EMAILS = ["support@nivra-telecom.ca", "nivratelecom@gmail.com"];
const SUPPORT_EMAIL = "support@nivra-telecom.ca";
const PORTAL_LINK = "https://nivra-telecom.ca/portail";

interface RequestBody {
  activation_request_id: string;
  override_recipient?: string; // Test mode — redirect to this address
}

type ClientLang = "fr" | "en";

function resolveClientLanguage(profile: { preferred_language?: string | null } | null | undefined): ClientLang {
  return profile?.preferred_language === "fr" ? "fr" : "en";
}

function buildHtml(firstName: string, wifiName: string, lang: ClientLang): string {
  const isFr = lang === "fr";
  const preheader = isFr ? `Bienvenue chez Nivra — votre service Internet est actif.` : `Welcome to Nivra — your Internet service is now active.`;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<title>${isFr ? "Votre service Nivra est activé" : "Your Nivra service is now active"}</title>
<style>*{box-sizing:border-box}body{margin:0;padding:0;-webkit-text-size-adjust:100%}</style>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden">${escapeHtml(preheader)}</div>

<div style="background:#f0f2f5;padding:24px;font-family:Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0">

<!-- HEADER -->
<div style="background:#0057B8;padding:28px 32px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="vertical-align:middle">
      <div style="color:#fff;font-size:22px;font-weight:700;letter-spacing:-0.5px">Nivra Telecom</div>
      <div style="color:rgba(255,255,255,0.6);font-size:11px;letter-spacing:2px;margin-top:2px">TÉLÉCOMMUNICATIONS</div>
    </td>
    <td style="text-align:right;vertical-align:middle">
      <div style="width:44px;height:44px;background:rgba(255,255,255,0.15);border-radius:50%;display:inline-block;line-height:44px;text-align:center">
        <span style="color:#fff;font-size:20px;font-weight:700">N</span>
      </div>
    </td>
  </tr></table>
</div>

<!-- BANNER -->
<div style="background:#f8fffe;border-bottom:3px solid #00B37D;padding:32px;text-align:center">
  <div style="width:56px;height:56px;background:#00B37D;border-radius:50%;margin:0 auto 16px;line-height:56px;text-align:center">
    <span style="color:#fff;font-size:26px;font-weight:700">✓</span>
  </div>
  <div style="font-size:24px;font-weight:700;color:#0d1f3c;margin-bottom:6px">${isFr ? "Service activé" : "Service activated"}</div>
  <div style="font-size:15px;color:#555;line-height:1.5">${isFr ? `Bonjour <strong>${escapeHtml(firstName)}</strong>,<br>Votre service Internet Nivra est maintenant actif.` : `Hello <strong>${escapeHtml(firstName)}</strong>,<br>Your Nivra Internet service is now active.`}</div>
</div>

<!-- WIFI NETWORK -->
<div style="padding:24px 32px">
  <div style="font-size:10px;color:#999;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #f0f0f0">${isFr ? "Votre réseau WiFi" : "Your WiFi network"}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9ff;border-radius:8px;border:1px solid #e8ecff"><tr>
    <td style="padding:18px 20px;vertical-align:middle">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:40px;height:40px;background:#0057B8;border-radius:8px;text-align:center;vertical-align:middle">
          <span style="color:#fff;font-size:16px">📡</span>
        </td>
        <td style="padding-left:14px">
          <div style="font-size:11px;color:#999;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:2px">${isFr ? "Nom du réseau" : "Network name"}</div>
          <div style="font-size:18px;font-weight:700;color:#0d1f3c;font-family:'Courier New',Courier,monospace">${escapeHtml(wifiName)}</div>
        </td>
      </tr></table>
    </td>
  </tr></table>
  <div style="font-size:13px;color:#666;line-height:1.7;margin-top:16px">${isFr ? "Vous pouvez maintenant connecter tous vos appareils à votre réseau WiFi." : "You can now connect all your devices to your WiFi network."}</div>
</div>

<!-- INFO CARDS -->
<div style="padding:0 32px 24px">
  <div style="font-size:10px;color:#999;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #f0f0f0">${isFr ? "Bon à savoir" : "Good to know"}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="width:50%;padding-right:6px;vertical-align:top">
      <div style="padding:16px;background:#fafafa;border-radius:8px;border:1px solid #eee">
        <div style="font-size:13px;font-weight:700;color:#0d1f3c;margin-bottom:6px">${isFr ? "Gestion en ligne" : "Online management"}</div>
        <div style="font-size:12px;color:#666;line-height:1.6">${isFr ? "Gérez votre forfait, vos paiements et vos préférences depuis votre espace client." : "Manage your plan, payments, and preferences from your client portal."}</div>
      </div>
    </td>
    <td style="width:50%;padding-left:6px;vertical-align:top">
      <div style="padding:16px;background:#fafafa;border-radius:8px;border:1px solid #eee">
        <div style="font-size:13px;font-weight:700;color:#0d1f3c;margin-bottom:6px">${isFr ? "Support 7j/7" : "7-day support"}</div>
        <div style="font-size:12px;color:#666;line-height:1.6">${isFr ? "Notre équipe est disponible par courriel pour toute question technique ou facturation." : "Our team is available by email for any technical or billing questions."}</div>
      </div>
    </td>
  </tr></table>
</div>

<!-- CTA -->
<div style="padding:0 32px 32px;text-align:center">
  <a href="${PORTAL_LINK}" style="display:inline-block;background:#0057B8;color:#fff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:50px;text-decoration:none;letter-spacing:0.3px">${isFr ? "Accéder à mon espace client" : "Access my client portal"} →</a>
</div>

<!-- SUPPORT -->
<div style="padding:20px 32px;background:#f5f7fa;border-top:1px solid #eee;text-align:center">
  <div style="font-size:14px;font-weight:700;color:#0d1f3c;margin-bottom:4px">${isFr ? "Une question? Notre équipe est là." : "Questions? Our team is here."}</div>
  <div style="font-size:13px;color:#888;margin-bottom:12px">${isFr ? "Disponible 7 jours sur 7, de 8 h à 20 h (HE)" : "Available 7 days a week, 8 AM to 8 PM ET"}</div>
  <a href="mailto:${SUPPORT_EMAIL}" style="display:inline-block;background:#0d1f3c;color:#fff;font-size:13px;font-weight:600;padding:10px 24px;border-radius:50px;text-decoration:none">${SUPPORT_EMAIL}</a>
</div>

<!-- FOOTER -->
<div style="background:#0d1f3c;padding:28px 32px;text-align:center">
  <div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:4px">Nivra Telecom</div>
  <div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:16px">${isFr ? "Fournisseur de services Internet et TV sans contrat au Québec" : "No-contract Internet and TV provider in Quebec"}</div>
  <div style="margin-bottom:16px">
    <a href="https://nivra-telecom.ca" style="font-size:12px;color:rgba(255,255,255,0.55);text-decoration:none">Site web</a>
    <span style="color:rgba(255,255,255,0.2)"> | </span>
    <a href="https://nivra-telecom.ca/plans" style="font-size:12px;color:rgba(255,255,255,0.55);text-decoration:none">${isFr ? "Forfaits" : "Plans"}</a>
    <span style="color:rgba(255,255,255,0.2)"> | </span>
    <a href="https://nivra-telecom.ca/faq" style="font-size:12px;color:rgba(255,255,255,0.55);text-decoration:none">FAQ</a>
    <span style="color:rgba(255,255,255,0.2)"> | </span>
    <a href="https://nivra-telecom.ca/privacy" style="font-size:12px;color:rgba(255,255,255,0.55);text-decoration:none">${isFr ? "Confidentialité" : "Privacy"}</a>
    <span style="color:rgba(255,255,255,0.2)"> | </span>
    <a href="https://nivra-telecom.ca/terms" style="font-size:12px;color:rgba(255,255,255,0.55);text-decoration:none">${isFr ? "Conditions" : "Terms"}</a>
  </div>
  <div style="font-size:11px;color:rgba(255,255,255,0.25)">© 2025 Nivra Communications Inc. ${isFr ? "Tous droits réservés." : "All rights reserved."}</div>
</div>

</div>
</div>
</body>
</html>`;
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
      .select("email, full_name, first_name, preferred_language")
      .eq("user_id", ar.client_id)
      .maybeSingle();

    const email = profile?.email;
    if (!email && !body.override_recipient) throw new Error("Client email not found");
    const firstName = profile?.first_name || (profile?.full_name ? profile.full_name.split(" ")[0] : "client");
    const clientLang = resolveClientLanguage(profile);

    const recipientEmail = body.override_recipient || email!;
    const isTest = !!body.override_recipient;

    const html = buildHtml(firstName, ar.wifi_network_name || "Nivra-WiFi", clientLang);

    const sendResp = await resend.emails.send({
      from: "Nivra Telecom <noreply@nivra-telecom.ca>",
      to: [recipientEmail],
      bcc: isTest ? [] : BUSINESS_EMAILS,
      reply_to: SUPPORT_EMAIL,
      subject: `${isTest ? "[TEST] " : ""}${clientLang === "fr" ? "✅ Votre service Nivra est activé — Bienvenue!" : "✅ Your Nivra service is now active — Welcome!"}`,
      html,
      headers: { "X-Entity-Ref-ID": `activation-success-${ar.id}${isTest ? '-test-' + Date.now() : ''}` },
    });

    console.log(`[send-activation-success-email] Sent to ${recipientEmail} for activation ${ar.id}${isTest ? ' [TEST MODE]' : ''}`);

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
