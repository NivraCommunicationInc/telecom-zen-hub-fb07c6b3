import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * NOTIFY CLIENT UPDATE - Send email notifications to clients for case updates
 * Handles: tickets, orders, channels, billing events with deep-links
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifyClientRequest {
  event_type: string;
  client_email: string;
  client_name: string;
  entity_type: string; // 'ticket', 'order', 'channel', 'invoice'
  entity_id: string;
  entity_number?: string;
  subject: string;
  summary: string;
  action_required?: boolean;
  portal_path: string; // e.g., '/portal/tickets/123'
}

const EVENT_TEMPLATES: Record<string, { subject_prefix: string; template_key: string }> = {
  // Tickets
  ticket_created: { subject_prefix: "Ticket créé", template_key: "client_ticket_created" },
  ticket_reply_received: { subject_prefix: "Nouvelle réponse", template_key: "client_ticket_reply" },
  ticket_status_changed: { subject_prefix: "Mise à jour ticket", template_key: "client_ticket_status" },
  ticket_closed: { subject_prefix: "Ticket résolu", template_key: "client_ticket_closed" },
  
  // Orders
  order_created: { subject_prefix: "Commande reçue", template_key: "client_order_created" },
  order_status_changed: { subject_prefix: "Mise à jour commande", template_key: "client_order_status" },
  order_completed: { subject_prefix: "Commande complétée", template_key: "client_order_completed" },
  
  // Channels
  channel_change_requested: { subject_prefix: "Demande reçue", template_key: "client_channel_request" },
  channel_change_applied: { subject_prefix: "Chaînes modifiées", template_key: "client_channel_applied" },
  
  // Billing
  invoice_created: { subject_prefix: "Nouvelle facture", template_key: "client_invoice_created" },
  invoice_overdue: { subject_prefix: "Rappel de paiement", template_key: "client_invoice_overdue" },
  payment_confirmed: { subject_prefix: "Paiement confirmé", template_key: "client_payment_confirmed" },
  payment_failed: { subject_prefix: "Échec de paiement", template_key: "client_payment_failed" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: NotifyClientRequest = await req.json();
    
    if (!body.client_email || !body.event_type || !body.portal_path) {
      throw new Error("Missing required fields: client_email, event_type, portal_path");
    }

    const templateConfig = EVENT_TEMPLATES[body.event_type];
    if (!templateConfig) {
      console.warn(`[notify-client-update] Unknown event type: ${body.event_type}`);
      // Still proceed with generic notification
    }

    // Build deep-link URL with redirect support
    const portalBaseUrl = Deno.env.get("PORTAL_BASE_URL") || "https://telecom-zen-hub.lovable.app";
    const deepLink = `${portalBaseUrl}${body.portal_path}`;
    const loginRedirectUrl = `${portalBaseUrl}/portal/login?redirect=${encodeURIComponent(body.portal_path)}`;

    // Generate unique event key to prevent duplicates
    const eventKey = `client_${body.event_type}_${body.entity_id}_${Date.now()}`;

    // Queue email notification
    const { error: queueError } = await supabase
      .from("email_queue")
      .insert({
        event_key: eventKey,
        template_key: templateConfig?.template_key || "client_generic_update",
        to_email: body.client_email,
        status: "pending",
        template_vars: {
          client_name: body.client_name || "Client",
          event_type: body.event_type,
          entity_type: body.entity_type,
          entity_id: body.entity_id,
          entity_number: body.entity_number,
          subject: body.subject,
          summary: body.summary,
          action_required: body.action_required || false,
          deep_link: deepLink,
          login_redirect_url: loginRedirectUrl,
          portal_path: body.portal_path,
        },
      });

    if (queueError) {
      console.error("[notify-client-update] Queue error:", queueError);
      throw new Error("Failed to queue notification");
    }

    console.log(`[notify-client-update] Queued ${body.event_type} notification for ${body.client_email}`);

    return new Response(
      JSON.stringify({
        success: true,
        event_key: eventKey,
        deep_link: deepLink,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[notify-client-update] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
