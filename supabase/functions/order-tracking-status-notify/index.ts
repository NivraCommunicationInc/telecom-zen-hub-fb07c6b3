// ============================================================================
// ORDER TRACKING STATUS NOTIFY — Nivra Telecom
// Sends a branded email to the client when the shipping tracking status
// transitions to "in_transit" or "out_for_delivery". Uses the client's
// preferred_language (fr | en) with fallback to fr.
//
// Includes: carrier + tracking number + carrier tracking URL button,
// WiFi router setup instructions (coax + power → white light) and reminder
// to fill the "Activer WiFi" form in the online portal.
//
// Triggered by:
//   - the shipping-tracking-webhook when carrier posts an update
//   - the DB trigger trg_orders_tracking_status_notify on orders
//   - manual invocation from Core
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendResendEmail } from "../_shared/resendGateway.ts";
import { violetShell } from "../_shared/violetEmailShell.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM_ADDRESS = "Nivra Telecom <support@nivra-telecom.ca>";
const REPLY_TO = "support@nivra-telecom.ca";
const SUPPORT_EMAIL = "support@nivra-telecom.ca";
const PORTAL_ACTIVATION_URL = "https://nivra-telecom.ca/portal/activation";

interface RequestBody {
  order_id: string;
  tracking_status?: string; // in_transit | out_for_delivery | delivered | ...
  carrier?: string;
  tracking_number?: string;
  tracking_url?: string;
  estimated_delivery?: string;
  force?: boolean; // bypass idempotency
}

function carrierUrl(carrier?: string, tracking?: string, override?: string): string {
  if (override && override.trim()) return override.trim();
  if (!tracking) return "";
  const enc = encodeURIComponent(tracking.trim());
  const k = (carrier || "").trim().toLowerCase();
  if (k.includes("canada") || k.includes("poste") || k === "cpc") {
    return `https://www.canadapost-postescanada.ca/track-reperage/fr#/details/${enc}`;
  }
  if (k.includes("puro")) return `https://www.purolator.com/fr/expedition/suivi-de-colis?pin=${enc}`;
  if (k.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${enc}`;
  if (k.includes("ups")) return `https://www.ups.com/track?loc=fr_CA&tracknum=${enc}`;
  if (k.includes("dhl")) return `https://www.dhl.com/ca-fr/home/suivi.html?tracking-id=${enc}`;
  return "";
}

function carrierLabelFor(carrier: string | undefined, lang: "fr" | "en"): string {
  const k = (carrier || "").trim().toLowerCase();
  if (!k) return lang === "fr" ? "Transporteur" : "Carrier";
  if (k.includes("canada") || k.includes("poste") || k === "cpc") {
    return lang === "fr" ? "Postes Canada" : "Canada Post";
  }
  if (k.includes("puro")) return "Purolator";
  if (k.includes("fedex")) return "FedEx";
  if (k.includes("ups")) return "UPS";
  if (k.includes("dhl")) return "DHL";
  return carrier || (lang === "fr" ? "Transporteur" : "Carrier");
}

type TrackingKind = "in_transit" | "out_for_delivery";

function normalizeStatus(s?: string): TrackingKind | null {
  const k = (s || "").toLowerCase().trim();
  if (!k) return null;
  if (["out_for_delivery", "out-for-delivery", "delivering", "en_livraison"].includes(k)) return "out_for_delivery";
  if (["in_transit", "in-transit", "shipped", "en_route", "picked_up", "accepted"].includes(k)) return "in_transit";
  return null;
}

function buildEmail(opts: {
  lang: "fr" | "en";
  status: TrackingKind;
  clientName: string;
  orderNumber: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
  estimatedDelivery?: string;
}) {
  const { lang, status, clientName, orderNumber, carrier, trackingNumber, trackingUrl, estimatedDelivery } = opts;
  const isOFD = status === "out_for_delivery";

  if (lang === "en") {
    const subject = isOFD
      ? `Out for delivery — order #${orderNumber}`
      : `Your equipment is on the way — order #${orderNumber}`;
    const heroTitle = isOFD ? "Your package is out for delivery" : "Your equipment is on the way";
    const preheader = isOFD
      ? `${carrier} is delivering your order #${orderNumber} today.`
      : `Order #${orderNumber} shipped via ${carrier}.`;
    const bodyHtml = `
      <p>${isOFD
        ? `Great news — <strong>${carrier}</strong> is out to deliver your Nivra equipment today.`
        : `Your Nivra equipment was picked up by <strong>${carrier}</strong> and is on its way to your address.`}</p>
      <p><strong>What to do once you receive the package:</strong></p>
      <ol style="padding-left:20px;margin:12px 0;">
        <li>Plug the coaxial cable into your WiFi router.</li>
        <li>Plug the power adapter and turn it on.</li>
        <li>Wait up to 5 minutes — the status light must turn <strong>white</strong>.</li>
        <li>Log into your online portal and fill out the <strong>"Activate WiFi"</strong> form.</li>
      </ol>
      <p>Once the form is submitted, service activation can take up to <strong>1–6 hours</strong>. If a cable is damaged or missing, contact us right away.</p>
    `;
    return {
      subject,
      html: violetShell({
        preheader,
        badge: isOFD ? "OUT FOR DELIVERY" : "SHIPMENT IN TRANSIT",
        heroTitle,
        heroSub: `Order #${orderNumber}`,
        greeting: `Hi ${clientName},`,
        bodyHtml,
        cardTitle: "Shipment details",
        cardRows: [
          ["Order", `#${orderNumber}`],
          ["Carrier", carrier],
          ["Tracking number", trackingNumber],
          ...(estimatedDelivery ? [["Estimated delivery", new Date(estimatedDelivery).toLocaleDateString("en-CA")] as [string, string]] : []),
        ],
        ctaPrimaryUrl: trackingUrl || PORTAL_ACTIVATION_URL,
        ctaPrimaryLabel: trackingUrl ? "Track my package" : "Open portal",
        ctaSecondaryUrl: PORTAL_ACTIVATION_URL,
        ctaSecondaryLabel: "Activate WiFi",
        helpHtml: `Need help? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#0066CC;">${SUPPORT_EMAIL}</a>.`,
      }),
    };
  }

  // Default: French
  const subject = isOFD
    ? `En livraison aujourd'hui — commande #${orderNumber}`
    : `Votre équipement est en route — commande #${orderNumber}`;
  const heroTitle = isOFD ? "Votre colis est en livraison" : "Votre équipement est en route";
  const preheader = isOFD
    ? `${carrier} livre votre commande #${orderNumber} aujourd'hui.`
    : `Commande #${orderNumber} expédiée via ${carrier}.`;
  const bodyHtml = `
    <p>${isOFD
      ? `Bonne nouvelle — <strong>${carrier}</strong> est en route pour livrer votre équipement Nivra aujourd'hui.`
      : `Votre équipement Nivra a été remis à <strong>${carrier}</strong> et est en route vers votre adresse.`}</p>
    <p><strong>Quoi faire dès la réception du colis :</strong></p>
    <ol style="padding-left:20px;margin:12px 0;">
      <li>Branchez le câble coaxial dans votre borne WiFi.</li>
      <li>Branchez l'adaptateur d'alimentation.</li>
      <li>Attendez jusqu'à 5 minutes — la lumière doit devenir <strong>blanche</strong>.</li>
      <li>Connectez-vous à votre portail en ligne et remplissez le formulaire <strong>« Activer WiFi »</strong>.</li>
    </ol>
    <p>Une fois le formulaire soumis, l'activation du service peut prendre jusqu'à <strong>1 à 6 heures</strong>. Si un câble est endommagé ou manquant, contactez-nous immédiatement.</p>
  `;
  return {
    subject,
    html: violetShell({
      preheader,
      badge: isOFD ? "EN LIVRAISON" : "EN ROUTE",
      heroTitle,
      heroSub: `Commande #${orderNumber}`,
      greeting: `Bonjour ${clientName},`,
      bodyHtml,
      cardTitle: "Détails de l'expédition",
      cardRows: [
        ["Commande", `#${orderNumber}`],
        ["Transporteur", carrier],
        ["Numéro de suivi", trackingNumber],
        ...(estimatedDelivery ? [["Livraison estimée", new Date(estimatedDelivery).toLocaleDateString("fr-CA")] as [string, string]] : []),
      ],
      ctaPrimaryUrl: trackingUrl || PORTAL_ACTIVATION_URL,
      ctaPrimaryLabel: trackingUrl ? "Suivre mon colis" : "Ouvrir le portail",
      ctaSecondaryUrl: PORTAL_ACTIVATION_URL,
      ctaSecondaryLabel: "Activer WiFi",
      helpHtml: `Une question ? Écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#0066CC;">${SUPPORT_EMAIL}</a>.`,
    }),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as RequestBody;
    if (!body?.order_id) throw new Error("order_id required");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id, order_number, user_id, account_id, client_email, client_first_name, client_last_name, carrier, tracking_number, tracking_url, tracking_status")
      .eq("id", body.order_id)
      .maybeSingle();
    if (orderErr) throw orderErr;
    if (!order) throw new Error(`Order ${body.order_id} not found`);

    const recipient = order.client_email;
    if (!recipient) {
      return new Response(JSON.stringify({ success: false, skipped: "no_recipient" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const statusKind = normalizeStatus(body.tracking_status || (order as any).tracking_status);
    if (!statusKind) {
      return new Response(JSON.stringify({ success: false, skipped: "status_not_notifiable" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve preferred language from profile
    let lang: "fr" | "en" = "fr";
    if (order.user_id) {
      const { data: profile } = await admin
        .from("profiles")
        .select("preferred_language")
        .eq("user_id", order.user_id)
        .maybeSingle();
      const pl = (profile?.preferred_language || "").toLowerCase();
      if (pl === "en" || pl === "en-ca" || pl === "en-us") lang = "en";
    }

    const carrier = carrierLabelFor(body.carrier || order.carrier, lang);
    const trackingNumber = (body.tracking_number || order.tracking_number || "").trim();
    const trackingUrl = carrierUrl(body.carrier || order.carrier, trackingNumber, body.tracking_url || order.tracking_url);
    const clientName = [order.client_first_name, order.client_last_name].filter(Boolean).join(" ")
      || (lang === "fr" ? "Client Nivra" : "Nivra client");

    // Idempotency: don't resend same status for same order unless force=true
    const idempKey = `order_${order.order_number}_tracking_${statusKind}`;
    if (!body.force) {
      const { data: prior } = await admin
        .from("client_notification_logs")
        .select("id")
        .eq("event_key", idempKey)
        .maybeSingle();
      if (prior) {
        return new Response(JSON.stringify({ success: true, skipped: "already_sent", event_key: idempKey }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const email = buildEmail({
      lang,
      status: statusKind,
      clientName,
      orderNumber: order.order_number,
      carrier,
      trackingNumber: trackingNumber || "—",
      trackingUrl,
      estimatedDelivery: body.estimated_delivery,
    });

    const send = await sendResendEmail({
      from: FROM_ADDRESS,
      to: [recipient],
      reply_to: REPLY_TO,
      subject: email.subject,
      html: email.html,
    });

    if (!send.ok) {
      console.warn("[order-tracking-status-notify] send failed:", send.error);
      return new Response(JSON.stringify({ success: false, error: String(send.error) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailId = (send.data as any)?.id || null;

    // Log for idempotency + audit
    try {
      await admin.from("client_notification_logs").insert({
        client_id: order.user_id,
        account_id: order.account_id,
        event_key: idempKey,
        channel: "email",
        template: "order_tracking_status",
        subject: email.subject,
        recipient,
        message_id: emailId,
        metadata: {
          order_id: order.id,
          order_number: order.order_number,
          tracking_status: statusKind,
          carrier,
          tracking_number: trackingNumber,
          tracking_url: trackingUrl,
          language: lang,
        },
      });
    } catch (e) {
      console.warn("[order-tracking-status-notify] log insert failed", e);
    }

    return new Response(JSON.stringify({
      success: true,
      email_id: emailId,
      language: lang,
      tracking_status: statusKind,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[order-tracking-status-notify] error:", err);
    return new Response(JSON.stringify({
      success: false, error: err instanceof Error ? err.message : String(err),
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
