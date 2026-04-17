// Send auto-installation shipment email with installation PDFs attached.
// Uses the EXACT same premium template as send-order-confirmation.
// BCC: support@nivra-telecom.ca + nivratelecom@gmail.com
// Also sends a separate business notification email to the same two addresses.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
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
const BUCKET = "installation-guides";
const SUPPORT_EMAIL = "support@nivra-telecom.ca";
const PORTAL_LINK = "https://nivra-telecom.ca/portail";

const TV_KEYWORDS = ["terminal", "tv", "télé", "tele", "television", "télévision"];

interface RequestBody {
  order_id: string;
  override_recipient?: string; // Test mode — redirect client email to this address
  force_lang?: ClientLang;     // Test mode — force language (fr/en)
}

type ClientLang = "fr" | "en";

function resolveClientLanguage(profile: { preferred_language?: string | null } | null | undefined): ClientLang {
  return profile?.preferred_language === "fr" ? "fr" : "en";
}

function isTvOrder(items: Array<{ plan_name?: string | null; service_type?: string | null; description?: string | null }>): boolean {
  const haystack = items
    .flatMap(i => [i.plan_name, i.service_type, i.description])
    .filter(Boolean)
    .map(s => String(s).toLowerCase());
  return haystack.some(s => TV_KEYWORDS.some(k => s.includes(k)));
}

// ============================================================
// CLIENT EMAIL — premium template (cloned from send-order-confirmation)
// ============================================================
function buildClientHtml(params: { firstName: string; orderNumber: string; hasTv: boolean; lang: ClientLang }): string {
  const { firstName, orderNumber, hasTv, lang } = params;
  const isFr = lang === "fr";
  const preheader = isFr
    ? `Votre équipement Nivra est en route. Guide d'installation inclus.`
    : `Your Nivra equipment is on its way. Installation guide included.`;

  const tvBlock = hasTv ? `
    <div style="padding:0 32px 24px">
      <div style="background:#fff5e6;border-left:4px solid #FF9500;border-radius:8px;padding:16px 20px">
        <div style="font-size:13px;font-weight:700;color:#B36200;margin-bottom:6px">📺 ${isFr ? "Terminal Nivra TV" : "Nivra TV terminal"}</div>
        <div style="font-size:13px;color:#7A4500;line-height:1.7">${isFr ? "Si vous avez commandé un Terminal Nivra TV, installez-le <strong>SEULEMENT après l'activation de votre WiFi</strong>. Suivez le guide « Terminal Nivra TV » joint à ce courriel." : "If you ordered a Nivra TV terminal, install it <strong>ONLY after your WiFi is activated</strong>. Follow the attached \"Nivra TV terminal\" guide."}</div>
      </div>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<title>${isFr ? "Votre équipement est en route" : "Your equipment is on its way"}</title>
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
    <span style="color:#fff;font-size:26px;font-weight:700">📦</span>
  </div>
  <div style="font-size:24px;font-weight:700;color:#0d1f3c;margin-bottom:6px">${isFr ? "Votre équipement est en route" : "Your equipment is on its way"}</div>
  <div style="font-size:15px;color:#555;line-height:1.5">${isFr ? `Bonjour <strong>${escapeHtml(firstName)}</strong>,<br>Merci pour votre commande. Voici votre guide d'activation.` : `Hello <strong>${escapeHtml(firstName)}</strong>,<br>Thank you for your order. Your installation guide is attached.`}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px auto 0;background:#fff;border-radius:6px;border:1px solid #e8e8e8"><tr>
    <td style="padding:10px 20px;text-align:left">
      <div style="font-size:10px;color:#999;letter-spacing:1.5px;text-transform:uppercase">${isFr ? "Commande" : "Order"}</div>
      <div style="font-size:13px;font-weight:700;color:#0d1f3c">#${escapeHtml(orderNumber)}</div>
    </td>
  </tr></table>
</div>

<!-- STEPS SECTION -->
<div style="padding:24px 32px">
  <div style="font-size:10px;color:#999;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #f0f0f0">${isFr ? "Étapes à suivre à la réception" : "Steps when your order arrives"}</div>
  <div style="background:#f8f9ff;border-radius:8px;padding:20px;border:1px solid #e8ecff">

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px"><tr>
      <td style="width:32px;vertical-align:top;padding-top:2px">
        <div style="width:26px;height:26px;background:#0057B8;color:#fff;border-radius:50%;text-align:center;line-height:26px;font-size:13px;font-weight:700">1</div>
      </td>
      <td style="padding-left:10px">
        <div style="font-size:14px;font-weight:700;color:#0d1f3c;margin-bottom:2px">${isFr ? "Installez votre Borne Nivra WiFi" : "Install your Nivra WiFi router"}</div>
        <div style="font-size:13px;color:#555;line-height:1.6">${isFr ? "Suivez le guide d'installation joint à ce courriel." : "Follow the installation guide attached to this email."}</div>
      </td>
    </tr></table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px"><tr>
      <td style="width:32px;vertical-align:top;padding-top:2px">
        <div style="width:26px;height:26px;background:#0057B8;color:#fff;border-radius:50%;text-align:center;line-height:26px;font-size:13px;font-weight:700">2</div>
      </td>
      <td style="padding-left:10px">
        <div style="font-size:14px;font-weight:700;color:#0d1f3c;margin-bottom:2px">${isFr ? "Attendez le voyant BLANC FIXE" : "Wait for the SOLID WHITE light"}</div>
        <div style="font-size:13px;color:#555;line-height:1.6">${isFr ? "Le démarrage prend jusqu'à 20 minutes." : "Startup can take up to 20 minutes."}</div>
      </td>
    </tr></table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px"><tr>
      <td style="width:32px;vertical-align:top;padding-top:2px">
        <div style="width:26px;height:26px;background:#0057B8;color:#fff;border-radius:50%;text-align:center;line-height:26px;font-size:13px;font-weight:700">3</div>
      </td>
      <td style="padding-left:10px">
        <div style="font-size:14px;font-weight:700;color:#0d1f3c;margin-bottom:2px">${isFr ? "Connectez-vous à votre espace client" : "Log in to your client portal"}</div>
        <div style="font-size:13px;color:#555;line-height:1.6"><a href="${PORTAL_LINK}" style="color:#0057B8;text-decoration:none;font-weight:600">nivra-telecom.ca/portail</a></div>
      </td>
    </tr></table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px"><tr>
      <td style="width:32px;vertical-align:top;padding-top:2px">
        <div style="width:26px;height:26px;background:#0057B8;color:#fff;border-radius:50%;text-align:center;line-height:26px;font-size:13px;font-weight:700">4</div>
      </td>
      <td style="padding-left:10px">
        <div style="font-size:14px;font-weight:700;color:#0d1f3c;margin-bottom:2px">${isFr ? "Cliquez sur « Activation WiFi »" : 'Click "WiFi Activation"'}</div>
        <div style="font-size:13px;color:#555;line-height:1.6">${isFr ? "Remplissez le formulaire d'activation." : "Complete the activation form."}</div>
      </td>
    </tr></table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="width:32px;vertical-align:top;padding-top:2px">
        <div style="width:26px;height:26px;background:#00B37D;color:#fff;border-radius:50%;text-align:center;line-height:26px;font-size:13px;font-weight:700">5</div>
      </td>
      <td style="padding-left:10px">
        <div style="font-size:14px;font-weight:700;color:#0d1f3c;margin-bottom:2px">${isFr ? "Service activé en 10 à 30 minutes" : "Service activated in 10 to 30 minutes"}</div>
        <div style="font-size:13px;color:#555;line-height:1.6">${isFr ? "Notre équipe active votre service rapidement." : "Our team will activate your service quickly."}</div>
      </td>
    </tr></table>

  </div>
</div>

${tvBlock}

<!-- INFO CARDS -->
<div style="padding:0 32px 24px">
  <div style="font-size:10px;color:#999;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #f0f0f0">${isFr ? "Documents joints" : "Attachments"}</div>
  <div style="padding:16px;background:#fafafa;border-radius:8px;border:1px solid #eee">
    <div style="font-size:13px;color:#666;line-height:1.7">📎 ${isFr ? "Guide d'installation PDF" : "PDF installation guide"}${hasTv ? `<br>📎 ${isFr ? "Guide Terminal Nivra TV PDF" : "Nivra TV terminal PDF guide"}` : ''}</div>
  </div>
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

// ============================================================
// BUSINESS NOTIFICATION — same template, condensed body
// ============================================================
function buildBusinessNotifHtml(params: {
  fullName: string; email: string; orderNumber: string; equipment: string[]; guides: string[];
}): string {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>Auto-installation</title></head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,Helvetica,sans-serif">
<div style="background:#f0f2f5;padding:24px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0">

<div style="background:#0057B8;padding:24px 32px">
  <div style="color:#fff;font-size:20px;font-weight:700">📦 Auto-installation — équipement expédié</div>
  <div style="color:rgba(255,255,255,0.7);font-size:12px;margin-top:4px">Notification interne Nivra Telecom</div>
</div>

<div style="padding:24px 32px">
  <table width="100%" style="font-size:14px;border-collapse:collapse">
    <tr><td style="padding:8px 0;color:#999;width:140px;font-size:11px;text-transform:uppercase;letter-spacing:1px">Client</td><td style="padding:8px 0;font-weight:600;color:#0d1f3c">${escapeHtml(params.fullName)}</td></tr>
    <tr><td style="padding:8px 0;color:#999;font-size:11px;text-transform:uppercase;letter-spacing:1px">Courriel</td><td style="padding:8px 0;color:#0057B8">${escapeHtml(params.email)}</td></tr>
    <tr><td style="padding:8px 0;color:#999;font-size:11px;text-transform:uppercase;letter-spacing:1px">Commande</td><td style="padding:8px 0;font-family:'Courier New',monospace;font-weight:700;color:#0d1f3c">#${escapeHtml(params.orderNumber)}</td></tr>
    <tr><td style="padding:8px 0;color:#999;font-size:11px;text-transform:uppercase;letter-spacing:1px;vertical-align:top">Équipement</td><td style="padding:8px 0;color:#333">${params.equipment.map(e => escapeHtml(e)).join("<br>") || "—"}</td></tr>
    <tr><td style="padding:8px 0;color:#999;font-size:11px;text-transform:uppercase;letter-spacing:1px;vertical-align:top">Guides</td><td style="padding:8px 0;font-family:'Courier New',monospace;font-size:12px;color:#555">${params.guides.map(g => escapeHtml(g)).join("<br>")}</td></tr>
  </table>
</div>

<div style="background:#0d1f3c;padding:16px 32px;text-align:center">
  <div style="font-size:12px;color:rgba(255,255,255,0.5)">© Nivra Communications Inc.</div>
</div>

</div></div></body></html>`;
}

async function downloadGuide(supabase: ReturnType<typeof createClient>, filename: string): Promise<{ filename: string; content: string; type: string; disposition: "attachment" } | null> {
  const { data, error } = await supabase.storage.from(BUCKET).download(filename);
  if (error || !data) {
    console.error(`[send-auto-installation-email] Failed to download ${filename}:`, error?.message);
    return null;
  }
  const buf = await data.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return { filename, content: base64, type: "application/pdf", disposition: "attachment" };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
    const resend = new Resend(RESEND_API_KEY);
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const body = (await req.json()) as RequestBody;
    if (!body?.order_id) {
      return new Response(JSON.stringify({ error: "order_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, order_number, user_id, client_email, client_first_name, client_last_name, installation_type")
      .eq("id", body.order_id)
      .maybeSingle();

    if (orderErr || !order) throw new Error(`Order not found: ${orderErr?.message || body.order_id}`);

    let email = order.client_email;
    let firstName = order.client_first_name || "";
    let fullName = [order.client_first_name, order.client_last_name].filter(Boolean).join(" ").trim();
    let clientLang: ClientLang = "en";

    if ((!email || !firstName) && order.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name, first_name, preferred_language")
        .eq("user_id", order.user_id)
        .maybeSingle();
      if (profile) {
        email = email || profile.email;
        firstName = firstName || profile.first_name || (profile.full_name ? profile.full_name.split(" ")[0] : "");
        fullName = fullName || profile.full_name || "";
        clientLang = resolveClientLanguage(profile);
      }
    }

    if (!email) throw new Error("Client email not found");
    if (!firstName) firstName = "client";
    if (!fullName) fullName = email;

    // Test mode: force language override
    if (body.force_lang === "fr" || body.force_lang === "en") {
      clientLang = body.force_lang;
    }

    const { data: items = [] } = await supabase
      .from("order_items")
      .select("plan_name, service_type, description")
      .eq("order_id", order.id);

    const hasTv = isTvOrder(items || []);

    const guideFiles = [clientLang === "fr" ? "guide-borne-nivra-wifi-fr.pdf" : "guide-borne-nivra-wifi-en.pdf"];
    if (hasTv) guideFiles.push(clientLang === "fr" ? "guide-terminal-nivra-tv-fr.pdf" : "guide-terminal-nivra-tv-en.pdf");

    const attachments = (await Promise.all(guideFiles.map(f => downloadGuide(supabase, f))))
      .filter((a): a is NonNullable<typeof a> => a !== null);

    if (attachments.length === 0) throw new Error("No installation guides could be loaded from storage");

    const orderNumber = order.order_number || order.id.slice(0, 8);
    const html = buildClientHtml({ firstName, orderNumber, hasTv, lang: clientLang });

    const recipientEmail = body.override_recipient || email;
    const isTest = !!body.override_recipient;

    const sendResp = await resend.emails.send({
      from: "Nivra Telecom <noreply@nivra-telecom.ca>",
      to: [recipientEmail],
      bcc: isTest ? [] : BUSINESS_EMAILS,
      reply_to: SUPPORT_EMAIL,
      subject: `${isTest ? "[TEST] " : ""}${clientLang === "fr" ? "📦 Votre équipement Nivra est en route — Guide d'installation inclus" : "📦 Your Nivra equipment is on its way — Installation guide included"}`,
      html,
      attachments,
      headers: { "X-Entity-Ref-ID": `auto-install-${order.id}${isTest ? '-test-' + Date.now() : ''}` },
    });

    console.log(`[send-auto-installation-email] Sent to ${recipientEmail} (order ${orderNumber}) with ${attachments.length} guides${isTest ? ' [TEST MODE]' : ''}`);

    if (!isTest) {
      const equipmentList = (items || []).map(i => i.plan_name || i.service_type || i.description || "Item").filter(Boolean) as string[];
      const notifHtml = buildBusinessNotifHtml({ fullName, email, orderNumber, equipment: equipmentList, guides: guideFiles });

      await resend.emails.send({
        from: "Nivra Telecom <noreply@nivra-telecom.ca>",
        to: BUSINESS_EMAILS,
        subject: `📦 Auto-installation — ${fullName} — Équipement expédié`,
        html: notifHtml,
        headers: { "X-Entity-Ref-ID": `auto-install-notif-${order.id}` },
      });
    }

    return new Response(JSON.stringify({
      success: true, message_id: sendResp.data?.id, order_id: order.id, attachments: guideFiles, has_tv: hasTv,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-auto-installation-email] Error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
