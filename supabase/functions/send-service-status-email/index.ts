import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSmsNotification, SMS_TEMPLATES, toE164, fetchClientPhone } from "../_shared/smsHelper.ts";
import { sendTemplateEmail } from "../_shared/resendTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Service status to template mapping
const STATUS_TEMPLATE_MAP: Record<string, { templateKey: string; label: string }> = {
  active: { templateKey: "order_completed", label: "Service actif" },
  paused: { templateKey: "account_blocked", label: "Service suspendu" },
  cancelled: { templateKey: "service_cancellation", label: "Service annulé" },
  technical_issue: { templateKey: "order_in_progress", label: "Problème technique" },
  resumed: { templateKey: "order_completed", label: "Service rétabli" },
};

interface ServiceStatusEmailRequest {
  client_id: string;
  client_email: string;
  client_first_name?: string;
  client_phone?: string;
  service_instance_id: string;
  service_name: string;
  service_type: string;
  new_status: string;
  old_status?: string;
  reason?: string;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] send-service-status-email invoked (RESEND TEMPLATE)`);

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

    const body: ServiceStatusEmailRequest = await req.json();
    const {
      client_id,
      client_email,
      client_first_name,
      client_phone,
      service_instance_id,
      service_name,
      service_type,
      new_status,
      old_status,
      reason,
    } = body;

    console.log(`[${requestId}] Sending service status email: service=${service_name}, status=${new_status}`);

    if (!client_id || !client_email || !service_instance_id || !service_name || !new_status) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if this status is one we send emails for
    const statusConfig = STATUS_TEMPLATE_MAP[new_status];
    if (!statusConfig) {
      console.log(`[${requestId}] Status ${new_status} not configured for emails, skipping`);
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
    const idempotencyKey = `service_status_${service_instance_id}_${new_status}`;
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
        SERVICE_TYPE: service_type,
        STATUS_LABEL: statusConfig.label,
        REASON: reason || "",
        PORTAL_LINK: `${siteBaseUrl}/portal`,
      },
      subject: `${statusConfig.label} — ${service_name} | Nivra Télécom`,
    });

    if (!emailResult.success) {
      console.error(`[${requestId}] Resend error:`, emailResult.error);
      
      await supabase.from("email_queue").insert({
        event_key: idempotencyKey,
        template_key: "service_status",
        to_email: client_email,
        status: "failed",
        last_error: emailResult.error,
        template_vars: { client_id, service_instance_id, service_name, new_status, old_status },
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
      template_key: "service_status",
      to_email: client_email,
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_message_id: emailResult.id,
      template_vars: { client_id, service_instance_id, service_name, new_status, old_status },
    });

    // Send SMS notification based on status (non-blocking)
    let phoneForSms = client_phone;
    let clientIdForSms = client_id;

    if (!phoneForSms) {
      const phoneResult = await fetchClientPhone(supabaseUrl, supabaseServiceKey, client_email, client_id);
      phoneForSms = phoneResult.phone || undefined;
      clientIdForSms = phoneResult.clientId || client_id;
    }

    if (phoneForSms && toE164(phoneForSms)) {
      const clientName = client_first_name || "Client";
      let smsMessage: string | null = null;

      switch (new_status) {
        case "active":
        case "resumed":
          smsMessage = SMS_TEMPLATES.serviceActivated({
            clientName,
            serviceName: service_name,
          });
          break;
        case "paused":
        case "cancelled":
          smsMessage = SMS_TEMPLATES.serviceSuspended({
            clientName,
            serviceName: service_name,
          });
          break;
      }

      if (smsMessage) {
        const smsResult = await sendSmsNotification({
          to: phoneForSms,
          message: smsMessage,
          clientId: clientIdForSms,
          eventType: `service_${new_status}`,
          eventKey: `service_${service_instance_id}_${new_status}`,
        });
        console.log(`[${requestId}] Service SMS result:`, JSON.stringify(smsResult));
      }
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
