/**
 * send-porting-notification
 * Sends email + SMS notifications for number porting events
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSmsNotification, SMS_TEMPLATES, toE164, fetchClientPhone } from "../_shared/smsHelper.ts";
import { sendTemplateEmail, formatDateForTemplate } from "../_shared/resendTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Porting event to template mapping
const PORTING_TEMPLATE_MAP: Record<string, { templateKey: string; label: string }> = {
  porting_initiated: { templateKey: "order_in_progress", label: "Transfert de numéro initié" },
  porting_completed: { templateKey: "order_completed", label: "Transfert de numéro complété" },
  porting_failed: { templateKey: "order_cancelled", label: "Transfert échoué" },
};

interface PortingNotificationRequest {
  event_type: "porting_initiated" | "porting_completed" | "porting_failed";
  client_email: string;
  client_name: string;
  client_phone?: string;
  client_id?: string;
  porting_phone_number: string;
  estimated_date?: string;
  failure_reason?: string;
  order_id?: string;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] send-porting-notification invoked (RESEND TEMPLATE)`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!resendApiKey || !supabaseUrl || !supabaseServiceKey) {
      console.error(`[${requestId}] Missing required environment variables`);
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: PortingNotificationRequest = await req.json();
    const {
      event_type,
      client_email,
      client_name,
      client_phone,
      client_id,
      porting_phone_number,
      estimated_date,
      failure_reason,
      order_id,
    } = body;

    console.log(`[${requestId}] Event: ${event_type}, Number: ${porting_phone_number}`);

    // Check if this event type is configured for emails
    const eventConfig = PORTING_TEMPLATE_MAP[event_type];
    if (!eventConfig) {
      console.log(`[${requestId}] Event type ${event_type} not configured for emails`);
      return new Response(JSON.stringify({ 
        success: true, 
        skipped: true, 
        reason: "Event type not configured" 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const siteBaseUrl = Deno.env.get("SITE_URL") || "https://nivratelecom.ca";
    const firstName = client_name?.split(" ")[0] || "Client";

    // Send email using Resend template
    const emailResult = await sendTemplateEmail({
      resendApiKey,
      templateKey: eventConfig.templateKey as any,
      to: client_email,
      variables: {
        CLIENT_FIRST_NAME: firstName,
        PHONE_NUMBER: porting_phone_number,
        STATUS_LABEL: eventConfig.label,
        ESTIMATED_DATE: estimated_date ? formatDateForTemplate(estimated_date) : "",
        FAILURE_REASON: failure_reason || "",
        PORTAL_LINK: `${siteBaseUrl}/portal`,
      },
      subject: `${eventConfig.label} — ${porting_phone_number} | Nivra Télécom`,
    });

    if (!emailResult.success) {
      console.error(`[${requestId}] Email failed:`, emailResult.error);
    } else {
      console.log(`[${requestId}] Email sent: ${emailResult.id}`);
    }

    // Fetch phone from profiles if not provided
    let phoneForSms = client_phone;
    let clientIdForSms = client_id;

    if (!phoneForSms) {
      const phoneResult = await fetchClientPhone(supabaseUrl, supabaseServiceKey, client_email, client_id);
      phoneForSms = phoneResult.phone || undefined;
      clientIdForSms = phoneResult.clientId || client_id;
    }

    // Send SMS based on event type
    if (phoneForSms && toE164(phoneForSms)) {
      let smsMessage: string;

      switch (event_type) {
        case "porting_initiated":
          smsMessage = SMS_TEMPLATES.portingInitiated({
            clientName: firstName,
            phoneNumber: porting_phone_number,
            estimatedDate: estimated_date,
          });
          break;
        case "porting_completed":
          smsMessage = SMS_TEMPLATES.portingCompleted({
            clientName: firstName,
            phoneNumber: porting_phone_number,
          });
          break;
        case "porting_failed":
          smsMessage = SMS_TEMPLATES.portingFailed({
            clientName: firstName,
            phoneNumber: porting_phone_number,
            reason: failure_reason,
          });
          break;
        default:
          smsMessage = "";
      }

      if (smsMessage) {
        const smsResult = await sendSmsNotification({
          to: phoneForSms,
          message: smsMessage,
          clientId: clientIdForSms,
          eventType: event_type,
          eventKey: `${event_type}_${porting_phone_number}_${order_id || Date.now()}`,
        });
        console.log(`[${requestId}] SMS result:`, JSON.stringify(smsResult));
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      request_id: requestId,
      event_type,
      porting_phone_number,
      email_id: emailResult.id,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    return new Response(JSON.stringify({ 
      error: (error as Error)?.message || "Unknown error",
      request_id: requestId,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
