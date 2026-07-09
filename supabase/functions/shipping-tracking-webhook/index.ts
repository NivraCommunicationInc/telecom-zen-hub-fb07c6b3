// Ship24 webhook receiver.
// Ship24 POSTs tracking events; we map their status to our internal states
// and let the DB trigger trg_orders_tracking_status_notify fire the bilingual email.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Ship24 statuses: pending, info_received, in_transit, out_for_delivery,
// failed_attempt, available_for_pickup, exception, delivered, expired
function mapStatus(s: string | undefined): string {
  switch ((s || "").toLowerCase()) {
    case "info_received": return "label_created";
    case "in_transit": return "in_transit";
    case "out_for_delivery": return "out_for_delivery";
    case "available_for_pickup": return "available_for_pickup";
    case "failed_attempt": return "delivery_attempt";
    case "delivered": return "delivered";
    case "exception": return "exception";
    case "expired": return "expired";
    default: return "pending";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json();
    console.log("Ship24 webhook payload:", JSON.stringify(payload).slice(0, 500));

    // Ship24 v1 webhook: { event, tracker: {...}, trackings: [{ shipment: {...}, statusMilestone, statusCategory, events: [...] }] }
    const tracker = payload?.tracker ?? payload?.data?.tracker;
    const trackings = payload?.trackings ?? payload?.data?.trackings ?? [];
    const first = Array.isArray(trackings) ? trackings[0] : trackings;

    const trackingNumber = tracker?.trackingNumber ?? first?.tracker?.trackingNumber;
    const shipmentRef = tracker?.shipmentReference ?? first?.shipment?.shipmentReference;
    const status = first?.statusMilestone ?? first?.shipment?.statusMilestone;
    const courier = first?.shipment?.recipient?.courierCode ?? first?.events?.[0]?.courierCode ?? null;

    if (!trackingNumber && !shipmentRef) {
      return new Response(JSON.stringify({ ok: true, ignored: "no tracking id" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Prefer shipmentReference (our order UUID); fall back to tracking_number
    let query = supabase.from("orders").select("id, tracking_status");
    if (shipmentRef) query = query.eq("id", shipmentRef);
    else query = query.eq("tracking_number", trackingNumber);
    const { data: order } = await query.maybeSingle();

    if (!order) {
      console.warn("Order not found for webhook", { trackingNumber, shipmentRef });
      return new Response(JSON.stringify({ ok: true, ignored: "order not found" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mapped = mapStatus(status);

    // Only update if status actually changed, so the notify trigger doesn't refire.
    if (order.tracking_status === mapped) {
      return new Response(JSON.stringify({ ok: true, unchanged: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updates: Record<string, unknown> = {
      tracking_status: mapped,
      tracking_last_update_at: new Date().toISOString(),
    };
    if (courier) updates.carrier = courier;
    if (trackingNumber) updates.tracking_number = trackingNumber;

    const { error: updErr } = await supabase.from("orders").update(updates).eq("id", order.id);
    if (updErr) {
      console.error("Order update failed:", updErr);
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, order_id: order.id, status: mapped }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("shipping-tracking-webhook error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
