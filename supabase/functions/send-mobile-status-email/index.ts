import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSmsNotification, SMS_TEMPLATES, toE164, fetchClientPhone } from "../_shared/smsHelper.ts";
import { queueRenderedEmail } from "../_shared/templateRenderer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STATUS_TEMPLATE_MAP: Record<string, { templateKey: string; label: string }> = {
  number_assigned: { templateKey: "order_processed", label: "Numéro attribué" },
  port_in_initiated: { templateKey: "porting_initiated", label: "Transfert de numéro initié" },
  port_in_completed: { templateKey: "porting_completed", label: "Transfert de numéro complété" },
  sim_shipped: { templateKey: "order_shipped", label: "Carte SIM expédiée" },
  sim_delivered: { templateKey: "order_processed", label: "Carte SIM livrée" },
  activated: { templateKey: "order_completed", label: "Ligne activée" },
};

interface MobileStatusEmailRequest {
  client_id: string;
  client_email: string;
  client_first_name?: string;
  client_phone?: string;
  order_id: string;
  order_number: string;
  phone_number?: string;
  status: string;
  carrier?: string;
  tracking_number?: string;
  estimated_delivery?: string;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: MobileStatusEmailRequest = await req.json();
    const { client_id, client_email, client_first_name, client_phone, order_id, order_number, phone_number, status, tracking_number } = body;

    console.log(`[${requestId}] Mobile status email: order=${order_number}, status=${status}`);

    if (!client_id || !client_email || !order_id || !order_number || !status) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const statusConfig = STATUS_TEMPLATE_MAP[status];
    if (!statusConfig) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "Status not configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventKey = `mobile_status_${order_id}_${status}`;

    // FIX 5: attach order summary PDF for shipment / activation events (non-blocking)
    let attachments: Array<{ filename: string; content: string; contentType: string }> | undefined;
    if (status === "sim_shipped" || status === "sim_delivered" || status === "activated") {
      try {
        const { buildSummaryPdfAttachment } = await import("../_shared/pdfFromDb.ts");
        const prefix = status === "sim_shipped" ? "expedition" : status === "activated" ? "confirmation-activation" : "sommaire-commande";
        const pdf = await buildSummaryPdfAttachment(order_id, prefix);
        if (pdf) attachments = [pdf];
      } catch (e) {
        console.warn(`[${requestId}] Mobile summary PDF generation failed:`, e);
      }
    }

    const result = await queueRenderedEmail({
      eventKey,
      templateKey: statusConfig.templateKey,
      toEmail: client_email,
      templateVars: {
        client_name: client_first_name || "Client",
        order_number,
        status_label: statusConfig.label,
        phone_number: phone_number || "",
        tracking_number: tracking_number || "",
        portal_path: "/portal/orders",
      },
      attachments,
    });

    console.log(`[${requestId}] Email ${result.alreadyQueued ? "already queued" : "queued"} template: ${statusConfig.templateKey}${attachments ? " (with summary PDF)" : ""}`);

    // SMS for activated
    let phoneForSms = client_phone;
    if (!phoneForSms) {
      const phoneResult = await fetchClientPhone(supabaseUrl, supabaseServiceKey, client_email, client_id);
      phoneForSms = phoneResult.phone || undefined;
    }

    if (phoneForSms && toE164(phoneForSms) && status === "activated") {
      const smsResult = await sendSmsNotification({
        to: phoneForSms, message: SMS_TEMPLATES.mobileActivated({ clientName: client_first_name || "Client", phoneNumber: phone_number }),
        clientId: client_id, eventType: "mobile_activated", eventKey: `mobile_${order_id}_activated`,
      });
      console.log(`[${requestId}] SMS result:`, JSON.stringify(smsResult));
    }

    return new Response(JSON.stringify({ success: true, queued: true, template: statusConfig.templateKey }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
