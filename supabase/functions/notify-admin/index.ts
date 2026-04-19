/**
 * notify-admin
 * Centralized edge function to send email notifications to admins
 * for new orders, tickets, appointments, channel requests, etc.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "../_shared/ResendProxy.ts";
import { EMAIL_SENDER, formatDateTimeForTemplate } from "../_shared/resendTemplates.ts";
import { getCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { violetEsc, violetShell } from "../_shared/violetEmailShell.ts";

const ADMIN_NOTIFICATION_EMAIL = "support@nivra-telecom.ca";

type NotificationEventType =
  | "new_order"
  | "new_ticket"
  | "new_appointment"
  | "channel_change_request"
  | "plan_change_request"
  | "new_contact_request"
  | "cancellation_request"
  | "payment_dispute"
  | "new_replacement_request";

interface AdminNotificationRequest {
  event_type: NotificationEventType;
  event_id?: string;
  event_number?: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  summary?: string;
  details?: Record<string, unknown>;
  priority?: "low" | "normal" | "high" | "urgent";
  admin_portal_link?: string;
}

const EVENT_CONFIG: Record<NotificationEventType, { emoji: string; label: string; color: string }> = {
  new_order: { emoji: "🛒", label: "Nouvelle Commande", color: "#22c55e" },
  new_ticket: { emoji: "🎫", label: "Nouveau Ticket", color: "#3b82f6" },
  new_appointment: { emoji: "📅", label: "Nouveau Rendez-vous", color: "#8b5cf6" },
  channel_change_request: { emoji: "📺", label: "Demande Changement Chaînes", color: "#f59e0b" },
  plan_change_request: { emoji: "📱", label: "Demande Changement Forfait", color: "#06b6d4" },
  new_contact_request: { emoji: "📩", label: "Nouvelle Demande Contact", color: "#ec4899" },
  cancellation_request: { emoji: "⚠️", label: "Demande Annulation", color: "#ef4444" },
  payment_dispute: { emoji: "💳", label: "Contestation Paiement", color: "#f97316" },
  new_replacement_request: { emoji: "🔄", label: "Demande Remplacement", color: "#14b8a6" },
};

const PRIORITY_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  low: { emoji: "🟢", label: "Basse", color: "#22c55e" },
  normal: { emoji: "🟡", label: "Normale", color: "#f59e0b" },
  high: { emoji: "🟠", label: "Haute", color: "#f97316" },
  urgent: { emoji: "🔴", label: "Urgente", color: "#ef4444" },
};

function stringifyDetailValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildAdminEmailHtml(data: AdminNotificationRequest): string {
  const eventConfig = EVENT_CONFIG[data.event_type];
  const priorityConfig = PRIORITY_CONFIG[data.priority || "normal"];
  const timestamp = formatDateTimeForTemplate(new Date());

  const introBits = [
    data.client_name ? `Client: <strong>${violetEsc(data.client_name)}</strong>` : null,
    data.client_email ? `Courriel: <strong>${violetEsc(data.client_email)}</strong>` : null,
    data.client_phone ? `Téléphone: <strong>${violetEsc(data.client_phone)}</strong>` : null,
    `Horodatage: <strong>${violetEsc(timestamp)}</strong>`,
  ].filter(Boolean);

  const cardRows: Array<[string, string]> = [
    ["Priorité", `${priorityConfig.emoji} ${priorityConfig.label}`],
    ...(data.event_number ? [["Référence", `#${data.event_number}`] as [string, string]] : []),
    ...(data.event_id ? [["Event ID", data.event_id] as [string, string]] : []),
    ...Object.entries(data.details || {}).map(([key, value]) => [key, stringifyDetailValue(value)] as [string, string]),
  ];

  return violetShell({
    preheader: `${eventConfig.label}${data.event_number ? ` #${data.event_number}` : ""}`,
    badge: `${eventConfig.emoji} ADMIN`,
    heroTitle: eventConfig.label,
    heroSub: `Priorité ${priorityConfig.label.toLowerCase()} · Notification interne Nivra`,
    greeting: "Bonjour équipe Nivra,",
    bodyHtml: `
      <p style="margin:0 0 12px;">Une nouvelle notification administrative a été générée par le système.</p>
      ${data.summary ? `<p style="margin:0 0 12px;"><strong>Résumé:</strong> ${violetEsc(data.summary)}</p>` : ""}
      ${introBits.length ? `<p style="margin:0;">${introBits.join("<br>")}</p>` : ""}
    `,
    cardTitle: "Détails",
    cardRows,
    ctaPrimaryUrl: data.admin_portal_link,
    ctaPrimaryLabel: data.admin_portal_link ? "Voir dans le portail admin" : undefined,
    helpHtml: `Notification automatique du système Nivra Télécom.<br>Ce message interne a été envoyé à <strong>${violetEsc(ADMIN_NOTIFICATION_EMAIL)}</strong>.`,
  });
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] notify-admin invoked`);

  // Get CORS headers based on request origin (secure)
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  // Handle CORS preflight
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error(`[${requestId}] RESEND_API_KEY not configured`);
      return new Response(
        JSON.stringify({ success: false, error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);
    const body: AdminNotificationRequest = await req.json();
    
    console.log(`[${requestId}] Event type: ${body.event_type}`);
    console.log(`[${requestId}] Event ID: ${body.event_id || "N/A"}`);

    const eventConfig = EVENT_CONFIG[body.event_type];
    if (!eventConfig) {
      console.error(`[${requestId}] Unknown event type: ${body.event_type}`);
      return new Response(
        JSON.stringify({ success: false, error: "Unknown event type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build subject line
    const priorityPrefix = body.priority === "urgent" ? "🔴 URGENT: " : 
                          body.priority === "high" ? "🟠 " : "";
    const subject = `${priorityPrefix}${eventConfig.emoji} ${eventConfig.label}${body.event_number ? ` #${body.event_number}` : ""}${body.client_name ? ` - ${body.client_name}` : ""}`;

    // Build HTML email
    const html = buildAdminEmailHtml(body);

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: EMAIL_SENDER.from,
      to: [ADMIN_NOTIFICATION_EMAIL],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error(`[${requestId}] Resend error:`, error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[${requestId}] Admin notification sent successfully: ${data?.id}`);

    // Log the notification in the database (optional)
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase.from("admin_notification_logs").insert({
          event_type: body.event_type,
          event_id: body.event_id,
          event_number: body.event_number,
          client_name: body.client_name,
          client_email: body.client_email,
          priority: body.priority || "normal",
          email_id: data?.id,
          sent_to: ADMIN_NOTIFICATION_EMAIL,
        });
      }
    } catch (logError) {
      // Non-critical, just log it
      console.warn(`[${requestId}] Failed to log notification:`, logError);
    }

    return new Response(
      JSON.stringify({ success: true, email_id: data?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
