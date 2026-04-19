import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "../_shared/ResendProxy.ts";
import { violetShell } from "../_shared/violetEmailShell.ts";

/**
 * NOTIFY CLIENT UPDATE - Send email notifications to clients for case updates
 * Handles: tickets, orders, channels, billing events with deep-links
 * 
 * SECURITY: Uses deterministic event keys to prevent duplicate notifications.
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
  entity_updated_at?: string; // For idempotency
  subject: string;
  summary: string;
  action_required?: boolean;
  portal_path: string; // e.g., '/portal/tickets/123'
}

const EVENT_TEMPLATES: Record<string, { emoji: string; subject_prefix: string; color: string }> = {
  // Tickets
  ticket_created: { emoji: "🎫", subject_prefix: "Ticket créé", color: "#3b82f6" },
  ticket_reply_received: { emoji: "💬", subject_prefix: "Nouvelle réponse", color: "#8b5cf6" },
  ticket_status_changed: { emoji: "🔄", subject_prefix: "Mise à jour ticket", color: "#06b6d4" },
  ticket_closed: { emoji: "✅", subject_prefix: "Ticket résolu", color: "#22c55e" },
  
  // Orders
  order_created: { emoji: "📦", subject_prefix: "Commande reçue", color: "#22c55e" },
  order_status_changed: { emoji: "📦", subject_prefix: "Mise à jour commande", color: "#f59e0b" },
  order_completed: { emoji: "✅", subject_prefix: "Commande complétée", color: "#22c55e" },
  
  // Channels
  channel_change_requested: { emoji: "📺", subject_prefix: "Demande reçue", color: "#8b5cf6" },
  channel_change_applied: { emoji: "📺", subject_prefix: "Chaînes modifiées", color: "#22c55e" },
  
  // Billing
  invoice_created: { emoji: "🧾", subject_prefix: "Nouvelle facture", color: "#3b82f6" },
  invoice_overdue: { emoji: "⚠️", subject_prefix: "Rappel de paiement", color: "#ef4444" },
  payment_confirmed: { emoji: "✅", subject_prefix: "Paiement confirmé", color: "#22c55e" },
  payment_failed: { emoji: "❌", subject_prefix: "Échec de paiement", color: "#ef4444" },
};

function buildClientEmailHtml(data: NotifyClientRequest, deepLink: string, _loginRedirectUrl: string): string {
  const template = EVENT_TEMPLATES[data.event_type] || { emoji: "📢", subject_prefix: "Mise à jour", color: "#3b82f6" };
  return violetShell({
    preheader: `${template.subject_prefix} — Nivra Telecom`,
    badge: template.subject_prefix.toUpperCase(),
    heroTitle: template.subject_prefix,
    heroSub: data.entity_number ? `Référence #${data.entity_number}` : undefined,
    greeting: data.client_name ? `Bonjour ${data.client_name},` : undefined,
    bodyHtml: data.summary,
    helpHtml: data.action_required
      ? `<strong>Action requise de votre part.</strong> Consultez votre espace client pour les prochaines étapes.`
      : undefined,
    helpVariant: data.action_required ? "warning" : "info",
    ctaPrimaryUrl: deepLink,
    ctaPrimaryLabel: "Voir dans mon compte",
  });
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] notify-client-update invoked`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: NotifyClientRequest = await req.json();
    
    if (!body.client_email || !body.event_type || !body.portal_path) {
      throw new Error("Missing required fields: client_email, event_type, portal_path");
    }

    const templateConfig = EVENT_TEMPLATES[body.event_type];
    if (!templateConfig) {
      console.warn(`[${requestId}] Unknown event type: ${body.event_type}`);
    }

    // Build deep-link URL with redirect support
    const portalBaseUrl = Deno.env.get("PORTAL_BASE_URL") || "https://telecom-zen-hub.lovable.app";
    const deepLink = `${portalBaseUrl}${body.portal_path}`;
    const loginRedirectUrl = `${portalBaseUrl}/portal/login?redirect=${encodeURIComponent(body.portal_path)}`;

    // IDEMPOTENT: Generate deterministic event key (no Date.now())
    // Uses entity_id + portal_path + optional updated_at for versioning
    const versionKey = body.entity_updated_at || body.entity_id;
    const eventKey = `client_${body.event_type}_${body.entity_id}_${body.portal_path.replace(/\//g, "_")}_${versionKey}`;

    console.log(`[${requestId}] Event key: ${eventKey}`);

    // Check for duplicate notification
    const { data: existingNotif } = await supabase
      .from("client_notification_logs")
      .select("id")
      .eq("event_key", eventKey)
      .maybeSingle();

    if (existingNotif) {
      console.log(`[${requestId}] Duplicate notification prevented: ${eventKey}`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "duplicate" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send email directly via Resend if configured
    let emailSent = false;
    let emailId = null;

    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const template = templateConfig || { emoji: "📢", subject_prefix: "Mise à jour", color: "#3b82f6" };
      const subject = `${template.emoji} ${template.subject_prefix}${body.entity_number ? ` #${body.entity_number}` : ""} - Nivra Télécom`;
      const html = buildClientEmailHtml(body, deepLink, loginRedirectUrl);

      const { data: emailData, error: emailError } = await resend.emails.send({
        from: "Nivra Télécom <noreply@nivra-telecom.ca>",
        to: [body.client_email],
        subject: subject,
        html: html,
      });

      if (emailError) {
        console.error(`[${requestId}] Resend error:`, emailError);
      } else {
        emailSent = true;
        emailId = emailData?.id;
        console.log(`[${requestId}] Email sent: ${emailId}`);
      }
    }

    // Log the notification
    await supabase.from("client_notification_logs").insert({
      event_key: eventKey,
      event_type: body.event_type,
      entity_type: body.entity_type,
      entity_id: body.entity_id,
      entity_number: body.entity_number,
      client_email: body.client_email,
      client_name: body.client_name,
      portal_path: body.portal_path,
      email_sent: emailSent,
      email_id: emailId,
    });

    console.log(`[${requestId}] Notification logged for ${body.client_email}`);

    return new Response(
      JSON.stringify({
        success: true,
        event_key: eventKey,
        deep_link: deepLink,
        email_sent: emailSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error(`[${requestId}] Error:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
