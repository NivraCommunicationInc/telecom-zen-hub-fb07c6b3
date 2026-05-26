// Send auto-installation shipment email with installation PDFs attached.
// Uses the EXACT same premium template as send-order-confirmation.
// BCC: support@nivra-telecom.ca + nivratelecom@gmail.com
// Also sends a separate business notification email to the same two addresses.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { escapeHtml } from "../_shared/emailTemplates/components.ts";
import { violetShell } from "../_shared/violetEmailShell.ts";

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
  const steps = isFr
    ? [
        "1. Installez votre Borne Nivra WiFi (suivez le guide PDF joint).",
        "2. Attendez le voyant BLANC FIXE (jusqu'à 20 minutes).",
        "3. Connectez-vous à votre espace client.",
        "4. Cliquez sur « Activation WiFi » et remplissez le formulaire.",
        "5. Service activé en 10 à 30 minutes.",
      ]
    : [
        "1. Install your Nivra WiFi router (follow attached PDF).",
        "2. Wait for the SOLID WHITE light (up to 20 min).",
        "3. Log in to your client portal.",
        '4. Click "WiFi Activation" and complete the form.',
        "5. Service activated in 10 to 30 minutes.",
      ];
  const tvNote = hasTv
    ? (isFr
        ? "<br><br>📺 <strong>Terminal Nivra TV :</strong> installez-le SEULEMENT après l'activation de votre WiFi. Suivez le guide « Terminal Nivra TV » joint."
        : "<br><br>📺 <strong>Nivra TV terminal:</strong> install ONLY after your WiFi is activated. Follow the attached \"Nivra TV terminal\" guide.")
    : "";
  return violetShell({
    preheader: isFr ? "Votre équipement Nivra est en route." : "Your Nivra equipment is on its way.",
    badge: isFr ? "EN LIVRAISON" : "SHIPPING",
    heroTitle: isFr ? "Votre équipement est en route" : "Your equipment is on its way",
    heroSub: isFr ? "Suivez le guide d'installation pour activer votre service." : "Follow the installation guide to activate your service.",
    greeting: isFr ? `Bonjour ${escapeHtml(firstName)},` : `Hello ${escapeHtml(firstName)},`,
    bodyHtml: (isFr ? "Voici les étapes à suivre dès la réception de votre équipement :" : "Here are the steps to follow once your equipment arrives:") + "<br><br>" + steps.join("<br>") + tvNote,
    cardTitle: isFr ? "Commande" : "Order",
    cardRows: [
      [isFr ? "N° commande" : "Order #", `#${escapeHtml(orderNumber)}`],
      [isFr ? "Documents joints" : "Attachments", isFr ? `Guide d'installation PDF${hasTv ? " · Guide Terminal Nivra TV PDF" : ""}` : `PDF installation guide${hasTv ? " · Nivra TV terminal PDF" : ""}`],
    ],
    ctaPrimaryUrl: PORTAL_LINK,
    ctaPrimaryLabel: isFr ? "Mon espace client" : "My client portal",
  });
}


// ============================================================
// BUSINESS NOTIFICATION — same template, condensed body
// ============================================================
function buildBusinessNotifHtml(params: {
  fullName: string; email: string; orderNumber: string; equipment: string[]; guides: string[];
}): string {
  return violetShell({
    preheader: `Auto-installation expédiée — ${params.fullName}`,
    badge: "NOTIFICATION INTERNE",
    heroTitle: "Auto-installation — équipement expédié",
    cardTitle: "Détails",
    cardRows: [
      ["Client", params.fullName],
      ["Courriel", params.email],
      ["Commande", `#${params.orderNumber}`],
      ["Équipement", params.equipment.join(" · ") || "—"],
      ["Guides", params.guides.join(" · ") || "—"],
    ],
  });
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
      subject: `${isTest ? "[TEST] " : ""}${clientLang === "fr" ? "Votre équipement Nivra est expédié" : "Your Nivra equipment is on its way"}`,
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
        subject: `Auto-installation — ${fullName} — équipement expédié`,
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
