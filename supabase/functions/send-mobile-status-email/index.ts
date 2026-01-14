import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSmsNotification, SMS_TEMPLATES, toE164, fetchClientPhone } from "../_shared/smsHelper.ts";
import { sendTemplateEmail } from "../_shared/resendTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mobile status to template mapping
const STATUS_TEMPLATE_MAP: Record<string, { templateKey: string; label: string }> = {
  number_assigned: { templateKey: "order_processing", label: "Numéro attribué" },
  port_in_initiated: { templateKey: "order_in_progress", label: "Transfert de numéro initié" },
  port_in_completed: { templateKey: "order_completed", label: "Transfert de numéro complété" },
  sim_shipped: { templateKey: "order_processing", label: "Carte SIM expédiée" },
  sim_delivered: { templateKey: "order_processing", label: "Carte SIM livrée" },
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
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] send-mobile-status-email invoked (RESEND TEMPLATE)`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!resendApiKey || !supabaseUrl || !supabaseServiceKey) {
      console.error(`[${requestId}] Missing required environment variables`);
      return new Response(JSON.stringify({ error: "Service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: MobileStatusEmailRequest = await req.json();
    const {
      client_id,
      client_email,
      client_first_name,
      client_phone,
      order_id,
      order_number,
      phone_number,
      status,
      carrier,
      tracking_number,
      estimated_delivery,
    } = body;

    console.log(`[${requestId}] Sending mobile status email: order=${order_number}, status=${status}`);

    if (!client_id || !client_email || !order_id || !order_number || !status) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if this status is one we send emails for
    const statusConfig = STATUS_TEMPLATE_MAP[status];
    if (!statusConfig) {
      console.log(`[${requestId}] Status ${status} not configured for emails, skipping`);
      return new Response(JSON.stringify({ 
        success: true, 
        skipped: true, 
        reason: "Status not configured for email notification" 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency check
    const idempotencyKey = `mobile_status_${order_id}_${status}`;
    const { data: existingEmail } = await supabase
      .from("email_queue")
      .select("id, sent_at")
      .eq("event_key", idempotencyKey)
      .eq("status", "sent")
      .maybeSingle();

    if (existingEmail) {
      console.log(`[${requestId}] Email already sent for this status change`);
      return new Response(JSON.stringify({ 
        success: true, 
        already_sent: true, 
        sent_at: existingEmail.sent_at 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const siteBaseUrl = Deno.env.get("SITE_URL") || "https://nivratelecom.ca";

    // Send email using Resend template
    const emailResult = await sendTemplateEmail({
      resendApiKey,
      templateKey: statusConfig.templateKey as any,
      to: client_email,
      variables: {
        CLIENT_FIRST_NAME: client_first_name || "Client",
        ORDER_NUMBER: order_number,
        STATUS_LABEL: statusConfig.label,
        PHONE_NUMBER: phone_number || "",
        CARRIER: carrier || "",
        TRACKING_NUMBER: tracking_number || "",
        ESTIMATED_DELIVERY: estimated_delivery || "",
        PORTAL_LINK: `${siteBaseUrl}/portal`,
      },
      subject: `${statusConfig.label} — Commande #${order_number} | Nivra Télécom`,
    });

    if (!emailResult.success) {
      console.error(`[${requestId}] Resend error:`, emailResult.error);
      
      await supabase.from("email_queue").insert({
        event_key: idempotencyKey,
        template_key: "mobile_status",
        to_email: client_email,
        status: "failed",
        last_error: emailResult.error,
        template_vars: { client_id, order_id, order_number, status, phone_number },
      });

      return new Response(JSON.stringify({ 
        success: false, 
        error: "Email sending failed" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${requestId}] Email sent successfully: ${emailResult.id}`);

    // Log successful send
    await supabase.from("email_queue").insert({
      event_key: idempotencyKey,
      template_key: "mobile_status",
      to_email: client_email,
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_message_id: emailResult.id,
      template_vars: { client_id, order_id, order_number, status, phone_number },
    });

    // Send SMS for activated status (non-blocking)
    let phoneForSms = client_phone;
    let clientIdForSms = client_id;

    if (!phoneForSms) {
      const phoneResult = await fetchClientPhone(supabaseUrl, supabaseServiceKey, client_email, client_id);
      phoneForSms = phoneResult.phone || undefined;
      clientIdForSms = phoneResult.clientId || client_id;
    }

    if (phoneForSms && toE164(phoneForSms) && status === "activated") {
      const clientName = client_first_name || "Client";
      const smsResult = await sendSmsNotification({
        to: phoneForSms,
        message: SMS_TEMPLATES.mobileActivated({
          clientName,
          phoneNumber: phone_number,
        }),
        clientId: clientIdForSms,
        eventType: "mobile_activated",
        eventKey: `mobile_${order_id}_activated`,
      });
      console.log(`[${requestId}] Mobile SMS result:`, JSON.stringify(smsResult));
    }

    return new Response(JSON.stringify({ 
      success: true,
      message_id: emailResult.id,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    return new Response(JSON.stringify({ 
      error: "An unexpected error occurred",
      request_id: requestId,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
