/**
 * send-ticket-notification
 * Sends email + SMS notifications for ticket events:
 * - ticket_created: New ticket created
 * - ticket_status_update: Status changed
 * - ticket_resolved: Ticket resolved/closed
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { sendSmsNotification, SMS_TEMPLATES, toE164 } from "../_shared/smsHelper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  console.log(`[${requestId}] send-ticket-notification invoked`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error(`[${requestId}] Supabase not configured`);
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Fetch phone from profiles if not provided
    let phoneForSms = client_phone;
    let clientIdForSms = client_id;

    if (!phoneForSms && client_email) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, phone")
        .eq("email", client_email)
        .maybeSingle();

      if (profile?.phone) {
        phoneForSms = profile.phone;
        clientIdForSms = profile.id;
        console.log(`[${requestId}] Found phone from profile`);
      }
    }

    // Send SMS based on event type
    if (phoneForSms && toE164(phoneForSms)) {
      let smsMessage: string;
      const firstName = client_name?.split(" ")[0] || "Client";

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

    // TODO: Add email sending here if needed (similar to order confirmation)

    return new Response(JSON.stringify({ 
      success: true,
      request_id: requestId,
      event_type,
      ticket_number,
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
