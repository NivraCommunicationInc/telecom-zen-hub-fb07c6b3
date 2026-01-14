import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSmsNotification, SMS_TEMPLATES, toE164, fetchClientPhone } from "../_shared/smsHelper.ts";
import { sendTemplateEmail, formatDateTimeForTemplate } from "../_shared/resendTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Status to template mapping
const STATUS_TEMPLATE_MAP: Record<string, { templateKey: string; label: string }> = {
  installation_scheduled: { templateKey: "order_processing", label: "Installation planifiée" },
  technician_en_route: { templateKey: "order_in_progress", label: "Technicien en route" },
  installation_in_progress: { templateKey: "order_in_progress", label: "Installation en cours" },
  installation_completed: { templateKey: "order_completed", label: "Installation terminée" },
  completed: { templateKey: "order_completed", label: "Commande complétée" },
};

interface InstallationStatusEmailRequest {
  order_id: string;
  client_email: string;
  client_first_name?: string;
  client_phone?: string;
  client_id?: string;
  order_number: string;
  new_status: string;
  old_status?: string;
  service_address?: string;
  scheduled_date_time?: string;
  technician_name?: string;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] send-installation-status-email invoked (RESEND TEMPLATE)`);

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

    const body: InstallationStatusEmailRequest = await req.json();
    const {
      order_id,
      client_email,
      client_first_name,
      client_phone,
      client_id,
      order_number,
      new_status,
      old_status,
      service_address,
      scheduled_date_time,
      technician_name,
    } = body;

    console.log(`[${requestId}] Sending installation status email: order=${order_number}, status=${new_status}`);

    if (!order_id || !client_email || !order_number || !new_status) {
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
    const idempotencyKey = `installation_status_${order_id}_${new_status}`;
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
        SERVICE_ADDRESS: service_address || "",
        SCHEDULED_DATE_TIME: scheduled_date_time || "",
        TECHNICIAN_NAME: technician_name || "",
        PORTAL_LINK: `${siteBaseUrl}/portal`,
      },
      subject: `${statusConfig.label} — Commande #${order_number} | Nivra Télécom`,
    });

    if (!emailResult.success) {
      console.error(`[${requestId}] Resend error:`, emailResult.error);
      
      await supabase.from("email_queue").insert({
        event_key: idempotencyKey,
        template_key: "installation_status",
        to_email: client_email,
        status: "failed",
        last_error: emailResult.error,
        template_vars: { order_id, order_number, new_status, old_status },
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
      template_key: "installation_status",
      to_email: client_email,
      status: "sent",
      sent_at: new Date().toISOString(),
      provider_message_id: emailResult.id,
      template_vars: { order_id, order_number, new_status, old_status },
    });

    // Send SMS notification based on status (non-blocking)
    let phoneForSms = client_phone;
    let clientIdForSms = client_id;

    if (!phoneForSms) {
      const phoneResult = await fetchClientPhone(supabaseUrl, supabaseServiceKey, client_email);
      phoneForSms = phoneResult.phone || undefined;
      clientIdForSms = phoneResult.clientId || client_id;
    }

    if (phoneForSms && toE164(phoneForSms)) {
      let smsMessage: string | null = null;
      const clientName = client_first_name || "Client";

      switch (new_status) {
        case "installation_scheduled":
          smsMessage = SMS_TEMPLATES.installationScheduled({
            orderNumber: order_number,
            clientName,
            dateTime: scheduled_date_time,
          });
          break;
        case "technician_en_route":
          smsMessage = SMS_TEMPLATES.technicianEnRoute({
            clientName,
            technicianName: technician_name,
          });
          break;
        case "installation_completed":
        case "completed":
          smsMessage = SMS_TEMPLATES.installationCompleted({ clientName });
          break;
      }

      if (smsMessage) {
        const smsResult = await sendSmsNotification({
          to: phoneForSms,
          message: smsMessage,
          clientId: clientIdForSms,
          eventType: `installation_${new_status}`,
          eventKey: `installation_${order_id}_${new_status}`,
        });
        console.log(`[${requestId}] SMS result:`, JSON.stringify(smsResult));
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
