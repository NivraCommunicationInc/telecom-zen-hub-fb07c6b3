/**
 * send-porting-notification
 * Queues email + sends SMS notifications for number porting events via pgmq
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSmsNotification, SMS_TEMPLATES, toE164, fetchClientPhone } from "../_shared/smsHelper.ts";
import { queueRenderedEmail } from "../_shared/templateRenderer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: PortingNotificationRequest = await req.json();
    const { event_type, client_email, client_name, client_phone, client_id, porting_phone_number, estimated_date, failure_reason, order_id } = body;

    console.log(`[${requestId}] Event: ${event_type}, Number: ${porting_phone_number}`);

    const firstName = client_name?.split(" ")[0] || "Client";
    const eventKey = `${event_type}_${porting_phone_number}_${order_id || Date.now()}`;

    const result = await queueRenderedEmail({
      eventKey,
      templateKey: event_type,
      toEmail: client_email,
      templateVars: {
        client_name: firstName,
        phone_number: porting_phone_number,
        estimated_date,
        failure_reason,
        portal_path: order_id ? `/portal/orders/${order_id}` : "/portal/orders",
      },
    });

    console.log(`[${requestId}] Email ${result.alreadyQueued ? "already queued" : "queued"} template: ${event_type}`);

    // SMS
    let phoneForSms = client_phone;
    let clientIdForSms = client_id;

    if (!phoneForSms) {
      const phoneResult = await fetchClientPhone(supabaseUrl!, supabaseServiceKey!, client_email, client_id);
      phoneForSms = phoneResult.phone || undefined;
      clientIdForSms = phoneResult.clientId || client_id;
    }

    if (phoneForSms && toE164(phoneForSms)) {
      let smsMessage: string;
      switch (event_type) {
        case "porting_initiated":
          smsMessage = SMS_TEMPLATES.portingInitiated({ clientName: firstName, phoneNumber: porting_phone_number, estimatedDate: estimated_date });
          break;
        case "porting_completed":
          smsMessage = SMS_TEMPLATES.portingCompleted({ clientName: firstName, phoneNumber: porting_phone_number });
          break;
        case "porting_failed":
          smsMessage = SMS_TEMPLATES.portingFailed({ clientName: firstName, phoneNumber: porting_phone_number, reason: failure_reason });
          break;
        default:
          smsMessage = "";
      }

      if (smsMessage) {
        const smsResult = await sendSmsNotification({ to: phoneForSms, message: smsMessage, clientId: clientIdForSms, eventType: event_type, eventKey: `sms_${eventKey}` });
        console.log(`[${requestId}] SMS result:`, JSON.stringify(smsResult));
      }
    }

    return new Response(JSON.stringify({ success: true, request_id: requestId, event_type, porting_phone_number, queued: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    return new Response(JSON.stringify({ error: (error as Error)?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
