/**
 * send-installation-status-email
 * Queues email + sends SMS notifications for installation status changes
 * Uses email_queue for professional templates from process-email-queue
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSmsNotification, SMS_TEMPLATES, toE164, fetchClientPhone } from "../_shared/smsHelper.ts";
import { queueRenderedEmail } from "../_shared/templateRenderer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Status to template mapping
const STATUS_TEMPLATE_MAP: Record<string, string> = {
  installation_scheduled: "installation_scheduled",
  technician_en_route: "technician_en_route",
  installation_in_progress: "installation_in_progress",
  installation_completed: "installation_completed",
  completed: "installation_completed",
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
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] send-installation-status-email invoked (EMAIL_QUEUE)`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
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
    const templateKey = STATUS_TEMPLATE_MAP[new_status];
    if (!templateKey) {
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
    const eventKey = `installation_status_${order_id}_${new_status}`;
    
    const { data: existingEmail } = await supabase
      .from("email_queue")
      .select("id, sent_at")
      .eq("event_key", eventKey)
      .in("status", ["sent", "pending", "processing"])
      .maybeSingle();

    if (existingEmail) {
      console.log(`[${requestId}] Email already queued/sent for this status change`);
      return new Response(JSON.stringify({ 
        success: true, 
        already_queued: true, 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Render template and enqueue to pgmq for delivery
    const templateVars = {
      client_name: client_first_name || "Client",
      order_number,
      service_address,
      scheduled_date_time,
      technician_name,
      portal_path: `/portal/orders/${order_id}`,
    };

    const queueResult = await queueRenderedEmail({
      eventKey,
      templateKey,
      toEmail: client_email,
      templateVars,
    });

    if (!queueResult.success) {
      console.error(`[${requestId}] Failed to queue email:`, queueResult.error);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Failed to queue email" 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${requestId}] Email queued to pgmq with template: ${templateKey}`);

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
          eventKey: `sms_installation_${order_id}_${new_status}`,
        });
        console.log(`[${requestId}] SMS result:`, JSON.stringify(smsResult));
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      queued: true,
      template: templateKey,
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
