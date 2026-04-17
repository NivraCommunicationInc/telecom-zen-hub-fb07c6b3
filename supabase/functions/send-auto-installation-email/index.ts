// Send auto-installation shipment email with installation PDFs attached.
// Uses the existing locked Nivra corporate email template.
// BCC: support@nivra-telecom.ca + nivratelecom@gmail.com
// Also sends a separate business notification email to the same two addresses.

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
const BUCKET = "installation-guides";

const TV_KEYWORDS = ["terminal", "tv", "télé", "tele", "television", "télévision"];

interface RequestBody {
  order_id: string;
}

function isTvOrder(items: Array<{ plan_name?: string | null; service_type?: string | null; description?: string | null }>, planName?: string | null): boolean {
  const haystack = [
    ...items.flatMap(i => [i.plan_name, i.service_type, i.description]),
    planName,
  ]
    .filter(Boolean)
    .map(s => String(s).toLowerCase());
  return haystack.some(s => TV_KEYWORDS.some(k => s.includes(k)));
}

function buildClientHtml(firstName: string): string {
  const content = `
    ${header()}
    <tr>
      <td class="content-padding" style="padding: 32px 40px; font-family: ${fonts.primary}; color: ${colors.textPrimary};">
        <h2 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: ${colors.textPrimary};">
          Bonjour ${escapeHtml(firstName)},
        </h2>
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: ${colors.textSecondary};">
          Merci pour votre commande Nivra Telecom!
        </p>
        <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: ${colors.textSecondary};">
          Votre équipement sera expédié sous peu. Pour préparer votre installation, nous avons joint à ce courriel vos guides d'installation complets.
        </p>

        <div style="background-color: ${colors.primaryLight}; border-left: 4px solid ${colors.primary}; padding: 20px 24px; margin: 0 0 24px; border-radius: 6px;">
          <h3 style="margin: 0 0 14px; font-size: 16px; font-weight: 700; color: ${colors.primaryDark};">
            ÉTAPES À SUIVRE À LA RÉCEPTION DE VOTRE ÉQUIPEMENT
          </h3>
          <ol style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8; color: ${colors.textPrimary};">
            <li>Installez votre <strong>Borne Nivra WiFi</strong> en suivant le guide joint</li>
            <li>Attendez que le voyant lumineux soit <strong>BLANC FIXE</strong> (jusqu'à 20 minutes)</li>
            <li>Connectez-vous à votre espace client : <a href="https://nivra-telecom.ca/portail" style="color: ${colors.primary};">nivra-telecom.ca/portail</a></li>
            <li>Cliquez sur <strong>« Activation WiFi »</strong> et remplissez le formulaire</li>
            <li>Notre équipe active votre service en <strong>10 à 30 minutes</strong></li>
          </ol>
        </div>

        <div style="background-color: ${colors.warningBg}; border: 1px solid ${colors.warningBorder}; padding: 16px 20px; margin: 0 0 24px; border-radius: 6px;">
          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: ${colors.warningText};">
            <strong>📺 Terminal Nivra TV :</strong> Si vous avez commandé un Terminal Nivra TV, installez-le <strong>SEULEMENT après l'activation</strong> de votre WiFi. Suivez le guide « Terminal Nivra TV » joint à ce courriel.
          </p>
        </div>

        <p style="margin: 24px 0 0; font-size: 14px; line-height: 1.6; color: ${colors.textSecondary};">
          Des questions ? Contactez-nous à
          <a href="mailto:support@nivra-telecom.ca" style="color: ${colors.primary};">support@nivra-telecom.ca</a>
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px 40px; background-color: ${colors.gray50}; border-top: 1px solid ${colors.borderLight}; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: ${colors.textMuted};">
          Nivra Telecom · Québec, Canada · <a href="mailto:support@nivra-telecom.ca" style="color: ${colors.primary};">support@nivra-telecom.ca</a>
        </p>
      </td>
    </tr>
  `;
  return emailDocument(
    "Votre équipement Nivra est en route",
    "Guide d'installation inclus — étapes pour activer votre service",
    content,
  );
}

function buildBusinessNotifHtml(params: {
  fullName: string;
  email: string;
  orderNumber: string;
  equipment: string[];
  guides: string[];
}): string {
  const content = `
    ${header()}
    <tr>
      <td class="content-padding" style="padding: 32px 40px; font-family: ${fonts.primary}; color: ${colors.textPrimary};">
        <h2 style="margin: 0 0 12px; font-size: 20px; font-weight: 700;">📦 Auto-installation — équipement expédié</h2>
        <p style="margin: 0 0 16px; font-size: 14px; color: ${colors.textSecondary};">
          Une commande avec auto-installation vient d'être traitée.
        </p>
        <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: ${colors.textMuted}; width: 140px;">Client</td><td style="padding: 6px 0; font-weight: 600;">${escapeHtml(params.fullName)}</td></tr>
          <tr><td style="padding: 6px 0; color: ${colors.textMuted};">Courriel</td><td style="padding: 6px 0;">${escapeHtml(params.email)}</td></tr>
          <tr><td style="padding: 6px 0; color: ${colors.textMuted};">Commande</td><td style="padding: 6px 0; font-family: monospace;">#${escapeHtml(params.orderNumber)}</td></tr>
          <tr><td style="padding: 6px 0; color: ${colors.textMuted}; vertical-align: top;">Équipement</td><td style="padding: 6px 0;">${params.equipment.map(e => escapeHtml(e)).join("<br>") || "—"}</td></tr>
          <tr><td style="padding: 6px 0; color: ${colors.textMuted}; vertical-align: top;">Guides envoyés</td><td style="padding: 6px 0; font-family: monospace; font-size: 12px;">${params.guides.map(g => escapeHtml(g)).join("<br>")}</td></tr>
        </table>
      </td>
    </tr>
  `;
  return emailDocument(
    "Auto-installation — équipement expédié",
    `Commande #${params.orderNumber}`,
    content,
  );
}

async function downloadGuide(supabase: ReturnType<typeof createClient>, filename: string): Promise<{ filename: string; content: string; contentType: string } | null> {
  const { data, error } = await supabase.storage.from(BUCKET).download(filename);
  if (error || !data) {
    console.error(`[send-auto-installation-email] Failed to download ${filename}:`, error?.message);
    return null;
  }
  const buf = await data.arrayBuffer();
  // base64 encode
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return { filename, content: base64, contentType: "application/pdf" };
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

    // Fetch order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, order_number, user_id, client_email, client_first_name, client_last_name, installation_type, confirmation_email_sent_at")
      .eq("id", body.order_id)
      .maybeSingle();

    if (orderErr || !order) {
      throw new Error(`Order not found: ${orderErr?.message || body.order_id}`);
    }

    // Resolve client info
    let email = order.client_email;
    let firstName = order.client_first_name || "";
    let fullName = [order.client_first_name, order.client_last_name].filter(Boolean).join(" ").trim();

    if ((!email || !firstName) && order.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name, first_name")
        .eq("user_id", order.user_id)
        .maybeSingle();
      if (profile) {
        email = email || profile.email;
        firstName = firstName || profile.first_name || (profile.full_name ? profile.full_name.split(" ")[0] : "");
        fullName = fullName || profile.full_name || "";
      }
    }

    if (!email) throw new Error("Client email not found");
    if (!firstName) firstName = "client";
    if (!fullName) fullName = email;

    // Fetch order items to detect TV
    const { data: items = [] } = await supabase
      .from("order_items")
      .select("plan_name, service_type, description")
      .eq("order_id", order.id);

    const hasTv = isTvOrder(items || [], null);

    // Build attachment list
    const guideFiles = ["guide-borne-nivra-wifi-fr.pdf", "guide-borne-nivra-wifi-en.pdf"];
    if (hasTv) {
      guideFiles.push("guide-terminal-nivra-tv-fr.pdf", "guide-terminal-nivra-tv-en.pdf");
    }

    const attachments = (await Promise.all(guideFiles.map(f => downloadGuide(supabase, f))))
      .filter((a): a is NonNullable<typeof a> => a !== null);

    if (attachments.length === 0) {
      throw new Error("No installation guides could be loaded from storage");
    }

    // Send to client (BCC business)
    const html = buildClientHtml(firstName);
    const sendResp = await resend.emails.send({
      from: "Nivra Telecom <noreply@nivra-telecom.ca>",
      to: [email],
      bcc: BUSINESS_EMAILS,
      replyTo: "support@nivra-telecom.ca",
      subject: "Votre équipement Nivra est en route — Guide d'installation inclus",
      html,
      attachments,
      headers: {
        "X-Entity-Ref-ID": `auto-install-${order.id}`,
      },
    });

    console.log(`[send-auto-installation-email] Sent to ${email} (order ${order.order_number}) with ${attachments.length} guides`);

    // Business notification (separate email, plain TO)
    const equipmentList = (items || []).map(i => i.plan_name || i.service_type || i.description || "Item").filter(Boolean) as string[];
    const notifHtml = buildBusinessNotifHtml({
      fullName,
      email,
      orderNumber: order.order_number || order.id.slice(0, 8),
      equipment: equipmentList,
      guides: guideFiles,
    });

    await resend.emails.send({
      from: "Nivra Telecom <noreply@nivra-telecom.ca>",
      to: BUSINESS_EMAILS,
      subject: `📦 Auto-installation — ${fullName} — Équipement expédié`,
      html: notifHtml,
      headers: {
        "X-Entity-Ref-ID": `auto-install-notif-${order.id}`,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      message_id: sendResp.data?.id,
      order_id: order.id,
      attachments: guideFiles,
      has_tv: hasTv,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-auto-installation-email] Error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
