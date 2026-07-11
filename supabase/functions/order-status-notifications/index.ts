// ============================================================
// Phase 3 — Order status email dispatcher
// ============================================================
// Sends two types of milestone emails:
//   1. "Shipped"   → ONLY for self-install orders (auto / ship_to_home).
//                    Never sent for installation_type = 'technician'.
//   2. "Activated" → Always sent regardless of installation type.
//
// Trigger pattern: invoked from admin UI / triggers when shipment.status
// transitions to 'shipped' or activation_requests.status → 'completed'.
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { queueRenderedEmail } from "../_shared/templateRenderer.ts";
import { writeAccountJournal } from "../_shared/writeAccountJournal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  order_id: string;
  event: "shipped" | "activated";
  // Optional context provided by caller (used for dedup if no order_id present in DB)
  metadata?: Record<string, unknown>;
}

const EVENT_TEMPLATES = {
  shipped: { templateKey: "order_shipped", label: "Commande expédiée" },
  activated: { templateKey: "order_completed", label: "Service activé" },
} as const;

function isSelfInstall(installationType: string | null | undefined): boolean {
  if (installationType == null) return true; // legacy fallback
  return installationType === "auto" || installationType === "ship_to_home";
}

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      return new Response(JSON.stringify({ error: "Service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const body = (await req.json()) as NotificationRequest;
    const { order_id, event } = body;

    if (!order_id || !event || !(event in EVENT_TEMPLATES)) {
      return new Response(JSON.stringify({ error: "Missing or invalid order_id/event" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load order context
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, order_number, user_id, installation_type, customer_email, customer_first_name")
      .eq("id", order_id)
      .maybeSingle();

    if (orderErr || !order) {
      console.error(`[${requestId}] Order not found:`, orderErr);
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============================================================
    // PHASE 3 RULE — Skip "shipped" email for professional installation
    // ============================================================
    if (event === "shipped" && !isSelfInstall(order.installation_type)) {
      console.log(`[${requestId}] Skipping shipped email — pro installation (order=${order.order_number})`);
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: "pro_install_no_shipping_email",
          installation_type: order.installation_type,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve recipient email — prefer order.customer_email, fall back to profiles
    let recipientEmail = order.customer_email as string | null;
    let recipientName = (order.customer_first_name as string | null) || "Client";

    if (!recipientEmail && order.user_id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, first_name")
        .eq("user_id", order.user_id)
        .maybeSingle();
      recipientEmail = profile?.email ?? null;
      if (profile?.first_name) recipientName = profile.first_name;
    }

    if (!recipientEmail) {
      console.warn(`[${requestId}] No recipient email for order ${order.order_number}`);
      return new Response(JSON.stringify({ success: false, reason: "no_recipient_email" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = EVENT_TEMPLATES[event];
    const eventKey = `order_status_${order_id}_${event}`;

    const result = await queueRenderedEmail({
      eventKey,
      templateKey: config.templateKey,
      toEmail: recipientEmail,
      templateVars: {
        client_name: recipientName,
        order_number: order.order_number,
        status_label: config.label,
        portal_path: "/portal/orders",
      },
    });

    console.log(
      `[${requestId}] ${event} email ${result.alreadyQueued ? "already queued" : "queued"} for order ${order.order_number}`,
    );

    // Audit row
    await supabase.from("order_status_history").insert({
      order_id,
      status_domain: "order",
      old_status: null,
      new_status: `email_sent:${event}`,
      actor_role: "system",
      change_reason: `${config.label} notification dispatched`,
      metadata: { event, template: config.templateKey, recipient: recipientEmail, idempotent: result.alreadyQueued },
    });

    return new Response(
      JSON.stringify({
        success: true,
        queued: !result.alreadyQueued,
        template: config.templateKey,
        installation_type: order.installation_type,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(`[${requestId}] Error:`, err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
