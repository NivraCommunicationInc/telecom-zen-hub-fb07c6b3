import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "../_shared/ResendProxy.ts";

/**
 * NOTIFY ADMIN ALERT - Send email alerts to admins for attention-required events
 * Respects admin_notification_settings for ON/OFF and rate limiting
 * 
 * SECURITY: Uses deterministic event keys to prevent duplicate notifications.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AdminAlertRequest {
  alert_type: string; // matches setting_key in admin_notification_settings
  title: string;
  summary: string;
  entity_type: string;
  entity_id: string;
  entity_number?: string;
  entity_updated_at?: string; // For idempotency
  admin_path: string; // e.g., '/admin/tickets/123'
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  client_info?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

const ALERT_TEMPLATES: Record<string, { emoji: string; subject_prefix: string; color: string; priority: string }> = {
  // Tickets
  ticket_created: { emoji: "🎫", subject_prefix: "Nouveau ticket", color: "#3b82f6", priority: "normal" },
  ticket_reply_client: { emoji: "💬", subject_prefix: "Réponse client", color: "#8b5cf6", priority: "high" },
  ticket_escalated: { emoji: "⚠️", subject_prefix: "Ticket escaladé", color: "#ef4444", priority: "urgent" },
  
  // Orders
  order_created: { emoji: "📦", subject_prefix: "Nouvelle commande", color: "#22c55e", priority: "high" },
  order_status_changed: { emoji: "📦", subject_prefix: "Commande mise à jour", color: "#f59e0b", priority: "low" },
  
  // Billing
  invoice_overdue: { emoji: "💳", subject_prefix: "Facture impayée", color: "#ef4444", priority: "urgent" },
  payment_failed: { emoji: "❌", subject_prefix: "Échec paiement", color: "#ef4444", priority: "urgent" },
  payment_confirmed: { emoji: "✅", subject_prefix: "Paiement confirmé", color: "#22c55e", priority: "low" },
  
  // Channels
  channel_change_requested: { emoji: "📺", subject_prefix: "Demande modification chaînes", color: "#8b5cf6", priority: "normal" },
  
  // Employees
  employee_blocked: { emoji: "🔒", subject_prefix: "Employé bloqué", color: "#ef4444", priority: "urgent" },
  employee_pending: { emoji: "👤", subject_prefix: "Compte en attente", color: "#f59e0b", priority: "high" },
  
  // Partners
  partner_cashout_requested: { emoji: "💰", subject_prefix: "Demande retrait", color: "#22c55e", priority: "high" },
  partner_signup: { emoji: "🤝", subject_prefix: "Nouveau partenaire", color: "#3b82f6", priority: "normal" },
  
  // Replacements
  replacement_request: { emoji: "🔄", subject_prefix: "Demande remplacement", color: "#f59e0b", priority: "high" },
};

function buildAdminAlertHtml(data: AdminAlertRequest, adminLink: string, template: typeof ALERT_TEMPLATES[string]): string {
  const priorityColors: Record<string, string> = {
    low: "#22c55e",
    normal: "#f59e0b", 
    high: "#f97316",
    urgent: "#ef4444",
  };
  const priorityLabels: Record<string, string> = {
    low: "Basse",
    normal: "Normale",
    high: "Haute",
    urgent: "Urgente",
  };
  const priorityColor = priorityColors[data.priority || template.priority];
  const priorityLabel = priorityLabels[data.priority || template.priority];

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${template.emoji} ${data.title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse;">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${template.color} 0%, ${template.color}dd 100%); padding: 24px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">
                ${template.emoji} ${template.subject_prefix}
              </h1>
            </td>
          </tr>
          
          <!-- Priority Badge -->
          <tr>
            <td style="background-color: #ffffff; padding: 20px 30px 0; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
              <span style="display: inline-block; background-color: ${priorityColor}22; color: ${priorityColor}; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600;">
                Priorité ${priorityLabel}
              </span>
              ${data.entity_number ? `
              <span style="display: inline-block; background-color: #f3f4f6; color: #374151; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 600; margin-left: 8px;">
                #${data.entity_number}
              </span>
              ` : ""}
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="background-color: #ffffff; padding: 20px 30px 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
              
              <!-- Title -->
              <h2 style="margin: 0 0 16px; color: #111827; font-size: 18px; font-weight: 600;">
                ${data.title}
              </h2>
              
              <!-- Summary -->
              <div style="background-color: #f9fafb; border-left: 4px solid ${template.color}; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
                <p style="margin: 0; color: #374151; font-size: 15px; line-height: 1.6;">
                  ${data.summary}
                </p>
              </div>
              
              ${data.client_info ? `
              <!-- Client Info -->
              <table role="presentation" style="width: 100%; background-color: #f9fafb; border-radius: 8px; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 16px;">
                    <h3 style="margin: 0 0 12px; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
                      👤 Client
                    </h3>
                    ${data.client_info.name ? `<p style="margin: 0 0 4px; color: #111827; font-size: 15px; font-weight: 600;">${data.client_info.name}</p>` : ""}
                    ${data.client_info.email ? `<p style="margin: 0 0 4px; color: #6b7280; font-size: 14px;">📧 ${data.client_info.email}</p>` : ""}
                    ${data.client_info.phone ? `<p style="margin: 0; color: #6b7280; font-size: 14px;">📞 ${data.client_info.phone}</p>` : ""}
                  </td>
                </tr>
              </table>
              ` : ""}
              
              <!-- CTA Button -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <a href="${adminLink}" style="display: inline-block; background-color: ${template.color}; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                      Voir dans le portail admin →
                    </a>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #1f2937; padding: 20px; text-align: center; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                Notification automatique - Nivra Télécom Admin
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

serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] notify-admin-alert invoked`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: AdminAlertRequest = await req.json();
    
    if (!body.alert_type || !body.admin_path) {
      throw new Error("Missing required fields: alert_type, admin_path");
    }

    // Check if this notification type is enabled
    const { data: setting } = await supabase
      .from("admin_notification_settings")
      .select("*")
      .eq("setting_key", body.alert_type)
      .maybeSingle();

    if (setting && !setting.is_enabled) {
      console.log(`[${requestId}] Alert type ${body.alert_type} is disabled, skipping`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // IDEMPOTENT: Generate deterministic event key (no Date.now())
    const versionKey = body.entity_updated_at || body.entity_id;
    const eventKey = `admin_${body.alert_type}_${body.entity_id}_${body.admin_path.replace(/\//g, "_")}_${versionKey}`;

    console.log(`[${requestId}] Event key: ${eventKey}`);

    // Check for duplicate (in admin_notification_logs)
    const { data: existingNotif } = await supabase
      .from("admin_notification_logs")
      .select("id")
      .eq("event_id", eventKey)
      .maybeSingle();

    if (existingNotif) {
      console.log(`[${requestId}] Duplicate notification prevented: ${eventKey}`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "duplicate" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get admin recipients
    let recipients = setting?.email_recipients || [];
    
    if (recipients.length === 0) {
      // Fallback: get all active admin emails
      const { data: admins } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("is_active", true);
      
      if (admins && admins.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("email")
          .in("user_id", admins.map(a => a.user_id));
        
        recipients = profiles?.map(p => p.email).filter(Boolean) || [];
      }
    }

    // Rate limiting check
    if (setting?.rate_limit_per_hour) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("admin_notification_logs")
        .select("*", { count: "exact", head: true })
        .eq("event_type", body.alert_type)
        .gte("created_at", oneHourAgo);

      if (count && count >= setting.rate_limit_per_hour) {
        console.log(`[${requestId}] Rate limit exceeded for ${body.alert_type}`);
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "rate_limited" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (recipients.length === 0) {
      console.warn(`[${requestId}] No admin recipients found`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "no_recipients" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build admin deep-link
    const adminBaseUrl = Deno.env.get("ADMIN_BASE_URL") || "https://telecom-zen-hub.lovable.app";
    const adminLink = `${adminBaseUrl}${body.admin_path}`;

    const template = ALERT_TEMPLATES[body.alert_type] || {
      emoji: "📢",
      subject_prefix: "Alerte",
      color: "#3b82f6",
      priority: "normal",
    };

    // Send emails via Resend
    let emailsSent = 0;
    if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const priorityPrefix = body.priority === "urgent" ? "🔴 URGENT: " : 
                            body.priority === "high" ? "🟠 " : "";
      const subject = `${priorityPrefix}${template.emoji} ${template.subject_prefix}${body.entity_number ? ` #${body.entity_number}` : ""}`;
      const html = buildAdminAlertHtml(body, adminLink, template);

      for (const email of recipients) {
        try {
          await resend.emails.send({
            from: "Nivra Admin <admin@nivra-telecom.ca>",
            to: [email],
            subject: subject,
            html: html,
          });
          emailsSent++;
        } catch (emailErr) {
          console.error(`[${requestId}] Failed to send to ${email}:`, emailErr);
        }
      }
    }

    // Log the notification
    await supabase.from("admin_notification_logs").insert({
      event_type: body.alert_type,
      event_id: eventKey,
      event_number: body.entity_number,
      client_name: body.client_info?.name,
      client_email: body.client_info?.email,
      sent_to: recipients.join(", "),
      priority: body.priority || template.priority,
    });

    console.log(`[${requestId}] Sent ${emailsSent} admin alerts for ${body.alert_type}`);

    return new Response(
      JSON.stringify({
        success: true,
        event_key: eventKey,
        recipients_count: recipients.length,
        emails_sent: emailsSent,
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
