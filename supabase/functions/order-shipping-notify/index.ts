// ============================================================================
// ORDER SHIPPING NOTIFY — Nivra Telecom
// Fires when a Core operator marks an order as "shipped" with carrier +
// tracking number. Generates the delivery-slip PDF, persists it to the
// client-documents bucket + client_auto_documents (so it shows up in the
// portal client → Mes documents AND Core → client profile → Documents),
// and sends the client the corporate-blue email with the PDF attached and
// a "Suivre mon colis" button pointing to the carrier tracking page.
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { dispatchAutoDocument } from "../_shared/pdf/dispatcher.ts";
import { sendResendEmail } from "../_shared/resendGateway.ts";
import { violetShell } from "../_shared/violetEmailShell.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "client-documents";
const FROM_ADDRESS = "Nivra Telecom <noreply@nivra-telecom.ca>";
const REPLY_TO = "support@nivra-telecom.ca";
const SUPPORT_EMAIL = "support@nivra-telecom.ca";

interface RequestBody {
  order_id: string;
  carrier?: string;
  tracking_number: string;
  tracking_url?: string;
  estimated_delivery?: string;
}

// --------------------------------------------------------------------------
// Carrier tracking URL builder (mirror of src/lib/carrierTracking.ts).
// --------------------------------------------------------------------------
function buildTrackingUrl(carrier?: string, tracking?: string, override?: string): string {
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

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as any);
  }
  return btoa(bin);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as RequestBody;
    if (!body?.order_id) throw new Error("order_id required");
    if (!body?.tracking_number) throw new Error("tracking_number required");

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // 1. Fetch order
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id, order_number, account_id, user_id, client_email, client_first_name, client_last_name, client_phone, shipping_address, shipping_city, shipping_province, shipping_postal_code")
      .eq("id", body.order_id)
      .maybeSingle();
    if (orderErr) throw orderErr;
    if (!order) throw new Error(`Order ${body.order_id} not found`);

    const clientName = [order.client_first_name, order.client_last_name].filter(Boolean).join(" ") || "Client Nivra";
    const recipient = order.client_email;

    // 2. Load equipment items to list on the slip
    const { data: itemsData } = await admin
      .from("order_items")
      .select("name, description, quantity, sku")
      .eq("order_id", order.id);
    const items = (itemsData || [])
      .filter((it: any) => {
        const s = `${it.name || ""} ${it.description || ""}`.toLowerCase();
        // Skip pure recurring plan lines — the slip only lists physical items
        return !s.includes("mensuel") && !s.includes("plan internet") && !s.includes("plan tv") && !s.includes("plan mobile");
      })
      .map((it: any) => ({
        description: it.name || it.description || "Équipement",
        serial_number: undefined,
        quantity: Number(it.quantity || 1),
      }));

    // 3. Generate PDF
    const slipNumber = `BL-${order.order_number}`;
    const trackingUrl = buildTrackingUrl(body.carrier, body.tracking_number, body.tracking_url);
    const carrierLabel = body.carrier || "Transporteur";

    const dispatch = await dispatchAutoDocument("delivery_slip", {
      client_id: order.user_id,
      account_id: order.account_id,
      client_name: clientName,
      client_email: recipient || "",
      client_phone: order.client_phone || "",
      slip_number: slipNumber,
      issue_date: new Date().toISOString(),
      account_number: (order as any).account_number || "",
      order_number: order.order_number,
      carrier: carrierLabel,
      tracking_number: body.tracking_number,
      estimated_delivery: body.estimated_delivery,
      delivery_address: order.shipping_address || "",
      delivery_city: order.shipping_city || "",
      delivery_province: order.shipping_province || "QC",
      delivery_postal: order.shipping_postal_code || "",
      items,
    });

    // 4. Upload PDF to client-documents
    const scopeId = order.account_id || order.user_id || "unknown";
    const storagePath = `${scopeId}/orders/${order.order_number}/order_shipping_slip.pdf`;
    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(storagePath, dispatch.bytes, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    // 5. Register in client_auto_documents (idempotent per order+doc_type)
    const idempKey = `order_${order.order_number}_order_shipping_slip`;
    await admin.from("client_auto_documents").upsert(
      {
        account_id: order.account_id,
        client_id: order.user_id,
        doc_type: "order_shipping_slip",
        doc_number: slipNumber,
        event_type: "order_shipped",
        idempotency_key: idempKey,
        storage_path: storagePath,
        file_size_bytes: dispatch.fileSizeBytes,
        email_sent: false,
        recipient_email: recipient,
        metadata: {
          order_id: order.id,
          order_number: order.order_number,
          carrier: carrierLabel,
          tracking_number: body.tracking_number,
          tracking_url: trackingUrl,
        },
      },
      { onConflict: "idempotency_key" },
    );

    // 6. Send email (corporate blue) with PDF attached + tracking button
    let emailId: string | null = null;
    if (recipient) {
      const pdfB64 = bytesToBase64(dispatch.bytes);
      const html = violetShell({
        preheader: `Votre commande #${order.order_number} est en route`,
        badge: "COMMANDE EXPÉDIÉE",
        heroTitle: "Votre équipement est en route",
        heroSub: `Commande #${order.order_number}`,
        greeting: `Bonjour ${clientName},`,
        bodyHtml: `Bonne nouvelle — votre équipement a été remis à <strong>${carrierLabel}</strong> et est maintenant en route vers l'adresse de livraison indiquée sur votre commande. Le bordereau de livraison est joint à ce courriel et disponible en tout temps dans votre portail client.`,
        cardTitle: "Détails de l'expédition",
        cardRows: [
          ["Numéro de commande", `#${order.order_number}`],
          ["Transporteur", carrierLabel],
          ["Numéro de suivi", body.tracking_number],
          ...(body.estimated_delivery ? [["Livraison estimée", new Date(body.estimated_delivery).toLocaleDateString("fr-CA")] as [string, string]] : []),
        ],
        ctaPrimaryUrl: trackingUrl || "https://nivra-telecom.ca/portal",
        ctaPrimaryLabel: trackingUrl ? "Suivre mon colis" : "Accéder au portail",
        ctaSecondaryUrl: "https://nivra-telecom.ca/portal/documents",
        ctaSecondaryLabel: "Mes documents",
        helpHtml: `Une question ? Écrivez-nous à <a href="mailto:${SUPPORT_EMAIL}" style="color:#0066CC;">${SUPPORT_EMAIL}</a>.`,
      });

      const send = await sendResendEmail({
        from: FROM_ADDRESS,
        to: [recipient],
        reply_to: REPLY_TO,
        subject: `Votre commande #${order.order_number} est en route — Nivra Telecom`,
        html,
        attachments: [{ filename: `Bon_Livraison_${slipNumber}.pdf`, content: pdfB64 }],
      });
      if (send.ok) {
        emailId = (send.data as any)?.id || null;
        await admin
          .from("client_auto_documents")
          .update({ email_sent: true, email_sent_at: new Date().toISOString(), email_message_id: emailId })
          .eq("idempotency_key", idempKey);
      } else {
        console.warn("[order-shipping-notify] email send failed:", send.error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        storage_path: storagePath,
        slip_number: slipNumber,
        tracking_url: trackingUrl,
        email_sent: !!emailId,
        email_id: emailId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[order-shipping-notify] error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
