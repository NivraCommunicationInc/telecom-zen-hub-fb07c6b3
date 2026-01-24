import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * NOTIFY ADMIN ALERT - Send email alerts to admins for attention-required events
 * Respects admin_notification_settings for ON/OFF and rate limiting
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
  admin_path: string; // e.g., '/admin/tickets/123'
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  client_info?: {
    name?: string;
    email?: string;
  };
}

const ALERT_TEMPLATES: Record<string, { subject_prefix: string; priority: string }> = {
  // Tickets
  ticket_created: { subject_prefix: "🎫 Nouveau ticket", priority: "normal" },
  ticket_reply_client: { subject_prefix: "💬 Réponse client", priority: "high" },
  ticket_escalated: { subject_prefix: "⚠️ Ticket escaladé", priority: "urgent" },
  
  // Orders
  order_created: { subject_prefix: "📦 Nouvelle commande", priority: "high" },
  order_status_changed: { subject_prefix: "📦 Commande mise à jour", priority: "low" },
  
  // Billing
  invoice_overdue: { subject_prefix: "💳 Facture impayée", priority: "urgent" },
  payment_failed: { subject_prefix: "❌ Échec paiement", priority: "urgent" },
  payment_confirmed: { subject_prefix: "✅ Paiement confirmé", priority: "low" },
  
  // Channels
  channel_change_requested: { subject_prefix: "📺 Demande modification chaînes", priority: "normal" },
  
  // Employees
  employee_blocked: { subject_prefix: "🔒 Employé bloqué", priority: "urgent" },
  employee_pending: { subject_prefix: "👤 Compte en attente", priority: "high" },
  
  // Partners
  partner_cashout_requested: { subject_prefix: "💰 Demande retrait", priority: "high" },
  partner_signup: { subject_prefix: "🤝 Nouveau partenaire", priority: "normal" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
      .single();

    if (!setting?.is_enabled) {
      console.log(`[notify-admin-alert] Alert type ${body.alert_type} is disabled, skipping`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get admin recipients (from settings or default admin emails)
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
          .in("id", admins.map(a => a.user_id));
        
        recipients = profiles?.map(p => p.email).filter(Boolean) || [];
      }
    }

    if (recipients.length === 0) {
      console.warn("[notify-admin-alert] No admin recipients found");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "no_recipients" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build admin deep-link
    const adminBaseUrl = Deno.env.get("ADMIN_BASE_URL") || "https://telecom-zen-hub.lovable.app";
    const adminLink = `${adminBaseUrl}${body.admin_path}`;

    const templateConfig = ALERT_TEMPLATES[body.alert_type] || {
      subject_prefix: "📢 Alerte",
      priority: "normal",
    };

    // Generate unique event key
    const eventKey = `admin_${body.alert_type}_${body.entity_id}_${Date.now()}`;

    // Queue emails for each recipient
    const emailInserts = recipients.map((email: string) => ({
      event_key: `${eventKey}_${email}`,
      template_key: "admin_alert",
      to_email: email,
      status: "pending",
      template_vars: {
        alert_type: body.alert_type,
        title: body.title,
        summary: body.summary,
        entity_type: body.entity_type,
        entity_id: body.entity_id,
        entity_number: body.entity_number,
        admin_link: adminLink,
        priority: body.priority || templateConfig.priority,
        client_name: body.client_info?.name,
        client_email: body.client_info?.email,
        subject_prefix: templateConfig.subject_prefix,
      },
    }));

    const { error: queueError } = await supabase
      .from("email_queue")
      .insert(emailInserts);

    if (queueError) {
      console.error("[notify-admin-alert] Queue error:", queueError);
      throw new Error("Failed to queue admin notifications");
    }

    // Log the notification
    await supabase.from("admin_notification_logs").insert({
      event_type: body.alert_type,
      event_id: body.entity_id,
      event_number: body.entity_number,
      client_name: body.client_info?.name,
      client_email: body.client_info?.email,
      sent_to: recipients.join(", "),
      priority: body.priority || templateConfig.priority,
    });

    console.log(`[notify-admin-alert] Queued ${body.alert_type} alert to ${recipients.length} admins`);

    return new Response(
      JSON.stringify({
        success: true,
        event_key: eventKey,
        recipients_count: recipients.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[notify-admin-alert] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
