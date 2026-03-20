/**
 * send-ticket-notification
 * Queues email + sends SMS notifications for ticket events
 * Uses email_queue for professional templates from process-email-queue
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSmsNotification, SMS_TEMPLATES, toE164, fetchClientPhone } from "../_shared/smsHelper.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

const STATUS_LABELS: Record<string, string> = {
  open: "Ouvert",
  pending: "En attente",
  in_progress: "En traitement",
  resolved: "Résolu",
  closed: "Fermé",
  cancelled: "Annulé",
};

interface TicketNotificationRequest {
  event_type: "ticket_created" | "ticket_status_update" | "ticket_resolved";
  ticket_id: string;
  ticket_number: string;
  subject: string;
  client_email: string;
  client_name: string;
  client_phone?: string;
  client_id?: string;
  new_status?: string;
  old_status?: string;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] send-ticket-notification invoked (EMAIL_QUEUE)`);

  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;
  
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error(`[${requestId}] Supabase not configured`);
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: TicketNotificationRequest = await req.json();
    const {
      event_type,
      ticket_id,
      ticket_number,
      subject,
      client_email,
      client_name,
      client_phone,
      client_id,
      new_status,
    } = body;

    console.log(`[${requestId}] Event: ${event_type}, Ticket: ${ticket_number}`);

    const siteBaseUrl = Deno.env.get("SITE_URL") || "https://nivra-telecom.ca";
    const firstName = client_name?.split(" ")[0] || "Client";

    // Map event type to template key
    const templateKeyMap: Record<string, string> = {
      ticket_created: "ticket_created",
      ticket_status_update: "ticket_status_update",
      ticket_resolved: "ticket_resolved",
    };

    const templateKey = templateKeyMap[event_type];
    
    if (templateKey) {
      // Idempotency check
      const eventKey = `${event_type}_${ticket_id}_${new_status || "created"}`;
      
      const { data: existingEmail } = await supabase
        .from("email_queue")
        .select("id")
        .eq("event_key", eventKey)
        .in("status", ["sent", "pending", "processing"])
        .maybeSingle();

      if (!existingEmail) {
        // Queue email for professional template processing
        const { error: queueError } = await supabase
          .from("email_queue")
          .insert({
            event_key: eventKey,
            template_key: templateKey,
            to_email: client_email,
            status: "pending",
            template_vars: {
              client_name: firstName,
              ticket_number,
              subject: subject || "Demande de support",
              new_status,
              status_label: STATUS_LABELS[new_status || ""] || new_status,
              portal_path: `/portal/tickets/${ticket_id}`,
            },
          });

        if (queueError) {
          console.error(`[${requestId}] Failed to queue email:`, queueError);
        } else {
          console.log(`[${requestId}] Email queued with template: ${templateKey}`);
        }
      } else {
        console.log(`[${requestId}] Email already queued/sent for this event`);
      }
    }

    // Fetch phone from profiles if not provided
    let phoneForSms = client_phone;
    let clientIdForSms = client_id;

    if (!phoneForSms) {
      console.log(`[${requestId}] No phone provided, fetching from profiles...`);
      const phoneResult = await fetchClientPhone(supabaseUrl, supabaseServiceKey, client_email, client_id);
      phoneForSms = phoneResult.phone || undefined;
      clientIdForSms = phoneResult.clientId || client_id;
      if (phoneForSms) {
        console.log(`[${requestId}] Found phone from profile`);
      }
    }

    // Send SMS based on event type
    if (phoneForSms && toE164(phoneForSms)) {
      let smsMessage: string;

      switch (event_type) {
        case "ticket_created":
          smsMessage = SMS_TEMPLATES.ticketCreated({
            clientName: firstName,
            ticketNumber: ticket_number,
            subject: subject?.substring(0, 50) || "Demande de support",
          });
          break;

        case "ticket_status_update":
          smsMessage = SMS_TEMPLATES.ticketStatusUpdate({
            clientName: firstName,
            ticketNumber: ticket_number,
            newStatus: new_status || "updated",
            statusLabel: STATUS_LABELS[new_status || ""] || new_status || "Mis à jour",
          });
          break;

        case "ticket_resolved":
          smsMessage = SMS_TEMPLATES.ticketResolved({
            clientName: firstName,
            ticketNumber: ticket_number,
          });
          break;

        default:
          console.log(`[${requestId}] Unknown event type: ${event_type}`);
          smsMessage = "";
      }

      if (smsMessage) {
        console.log(`[${requestId}] Sending SMS...`);
        const smsResult = await sendSmsNotification({
          to: phoneForSms,
          message: smsMessage,
          clientId: clientIdForSms,
          eventType: event_type,
          eventKey: `${event_type}_${ticket_id}_${new_status || "created"}`,
        });
        console.log(`[${requestId}] SMS result:`, JSON.stringify(smsResult));
      }
    } else {
      console.log(`[${requestId}] No valid phone for SMS`);
    }

    return new Response(JSON.stringify({ 
      success: true,
      request_id: requestId,
      event_type,
      ticket_number,
      queued: true,
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
