import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSmsNotification, SMS_TEMPLATES, toE164, fetchClientPhone } from "../_shared/smsHelper.ts";
import { sendTemplateEmail } from "../_shared/resendTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Streaming status to template mapping
const STATUS_TEMPLATE_MAP: Record<string, { templateKey: string; label: string }> = {
  link_sent: { templateKey: "order_processing", label: "Lien d'activation envoyé" },
  link_reissued: { templateKey: "order_processing", label: "Lien réémis" },
  activated: { templateKey: "order_completed", label: "Service activé" },
  expired: { templateKey: "order_cancelled", label: "Lien expiré" },
};

interface StreamingActivationEmailRequest {
  client_id: string;
  client_email: string;
  client_first_name?: string;
  client_phone?: string;
  token_id: string;
  service_name: string;
  status: string;
  activation_link?: string;
  promo_code?: string;
  expires_at?: string;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] send-streaming-activation-email invoked (RESEND TEMPLATE)`);

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

    const body: StreamingActivationEmailRequest = await req.json();
    const {
      client_id,
      client_email,
      client_first_name,
      client_phone,
      token_id,
      service_name,
      status,
      activation_link,
      promo_code,
      expires_at,
    } = body;

    console.log(`[${requestId}] Sending streaming activation email: service=${service_name}, status=${status}`);

    if (!client_id || !client_email || !token_id || !service_name || !status) {
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
    const idempotencyKey = `streaming_activation_${token_id}_${status}`;
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
        SERVICE_NAME: service_name,
        STATUS_LABEL: statusConfig.label,
        ACTIVATION_LINK: activation_link || "",
        PROMO_CODE: promo_code || "",
        EXPIRES_AT: expires_at || "",
        PORTAL_LINK: `${siteBaseUrl}/portal`,
      },
      subject: `${statusConfig.label} — ${service_name} | Nivra Télécom`,
    });

    if (!emailResult.success) {
      console.error(`[${requestId}] Resend error:`, emailResult.error);
      
      await supabase.from("email_queue").insert({
        event_key: idempotencyKey,
        template_key: "streaming_activation",
        to_email: client_email,
        status: "failed",
        last_error: emailResult.error,
        template_vars: { client_id, token_id, service_name, status, promo_code },
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
      template_key: "streaming_activation",
      to_email: client_email,
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_message_id: emailResult.id,
      template_vars: { client_id, token_id, service_name, status, promo_code },
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
        message: SMS_TEMPLATES.streamingActivated({
          clientName,
          serviceName: service_name,
        }),
        clientId: clientIdForSms,
        eventType: "streaming_activated",
        eventKey: `streaming_${token_id}_activated`,
      });
      console.log(`[${requestId}] Streaming SMS result:`, JSON.stringify(smsResult));
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
