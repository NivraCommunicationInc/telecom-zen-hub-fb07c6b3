/**
 * notify-admin
 * Centralized edge function to send email notifications to admins
 * for new orders, tickets, appointments, channel requests, etc.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { EMAIL_SENDER, formatCurrencyForTemplate, formatDateTimeForTemplate } from "../_shared/resendTemplates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Admin notification email address
const ADMIN_NOTIFICATION_EMAIL = "support@nivratelecom.ca";

// Event types that trigger admin notifications
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

// Event configuration with emoji, subject, and color
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

// Priority configuration
const PRIORITY_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  low: { emoji: "🟢", label: "Basse", color: "#22c55e" },
  normal: { emoji: "🟡", label: "Normale", color: "#f59e0b" },
  high: { emoji: "🟠", label: "Haute", color: "#f97316" },
  urgent: { emoji: "🔴", label: "Urgente", color: "#ef4444" },
};

function buildAdminEmailHtml(data: AdminNotificationRequest): string {
  const eventConfig = EVENT_CONFIG[data.event_type];
  const priorityConfig = PRIORITY_CONFIG[data.priority || "normal"];
  const timestamp = formatDateTimeForTemplate(new Date());
  
  const detailsHtml = data.details 
    ? Object.entries(data.details)
        .map(([key, value]) => `
          <tr>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; width: 40%;">${key}</td>
            <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #111827; font-size: 14px;">${value}</td>
          </tr>
        `)
        .join("")
    : "";

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${eventConfig.emoji} ${eventConfig.label}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${eventConfig.color} 0%, ${eventConfig.color}dd 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                ${eventConfig.emoji} ${eventConfig.label}
              </h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                ${timestamp}
              </p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="background-color: #ffffff; padding: 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
              
              <!-- Priority Badge -->
              <table role="presentation" style="width: 100%; margin-bottom: 20px;">
                <tr>
                  <td>
                    <span style="display: inline-block; background-color: ${priorityConfig.color}22; color: ${priorityConfig.color}; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600;">
                      ${priorityConfig.emoji} Priorité ${priorityConfig.label}
                    </span>
                    ${data.event_number ? `
                    <span style="display: inline-block; background-color: #f3f4f6; color: #374151; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-left: 8px;">
                      #${data.event_number}
                    </span>
                    ` : ""}
                  </td>
                </tr>
              </table>
              
              <!-- Client Info -->
              ${data.client_name || data.client_email || data.client_phone ? `
              <table role="presentation" style="width: 100%; background-color: #f9fafb; border-radius: 8px; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 16px;">
                    <h3 style="margin: 0 0 12px; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
                      👤 Informations Client
                    </h3>
                    ${data.client_name ? `<p style="margin: 0 0 6px; color: #111827; font-size: 16px; font-weight: 600;">${data.client_name}</p>` : ""}
                    ${data.client_email ? `<p style="margin: 0 0 4px; color: #6b7280; font-size: 14px;">📧 ${data.client_email}</p>` : ""}
                    ${data.client_phone ? `<p style="margin: 0; color: #6b7280; font-size: 14px;">📞 ${data.client_phone}</p>` : ""}
                  </td>
                </tr>
              </table>
              ` : ""}
              
              <!-- Summary -->
              ${data.summary ? `
              <table role="presentation" style="width: 100%; margin-bottom: 20px;">
                <tr>
                  <td style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 0 8px 8px 0;">
                    <p style="margin: 0; color: #92400e; font-size: 15px; line-height: 1.6;">
                      ${data.summary}
                    </p>
                  </td>
                </tr>
              </table>
              ` : ""}
              
              <!-- Details Table -->
              ${detailsHtml ? `
              <table role="presentation" style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                <tr>
                  <th colspan="2" style="background-color: #f9fafb; padding: 12px; text-align: left; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
                    📋 Détails
                  </th>
                </tr>
                ${detailsHtml}
              </table>
              ` : ""}
              
              <!-- CTA Button -->
              ${data.admin_portal_link ? `
              <table role="presentation" style="width: 100%; margin-top: 30px;">
                <tr>
                  <td align="center">
                    <a href="${data.admin_portal_link}" style="display: inline-block; background-color: ${eventConfig.color}; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                      Voir dans le portail admin →
                    </a>
                  </td>
                </tr>
              </table>
              ` : ""}
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #1f2937; padding: 24px; text-align: center; border-radius: 0 0 12px 12px;">
              <p style="margin: 0 0 8px; color: #9ca3af; font-size: 13px;">
                Notification automatique du système Nivra Télécom
              </p>
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                Cet email a été envoyé automatiquement. Ne pas répondre.
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] notify-admin invoked`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
