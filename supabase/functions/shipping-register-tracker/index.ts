// Registers a tracking number with Ship24 so we start receiving webhook updates.
// Called when an order is marked as shipped in Core.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SHIP24_API = "https://api.ship24.com/public/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("SHIP24_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "SHIP24_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { order_id, tracking_number, courier_code } = await req.json();
    if (!order_id || !tracking_number) {
      return new Response(JSON.stringify({ error: "order_id and tracking_number required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load order for shipping address context (helps Ship24 auto-detect courier)
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("order_number, shipping_postal_code, shipping_country, client_id")
      .eq("id", order_id)
      .maybeSingle();
    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: "Order not found", details: orderErr?.message }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: Record<string, unknown> = {
      trackingNumber: tracking_number,
      orderNumber: order.order_number,
      destinationPostCode: order.shipping_postal_code ?? undefined,
      destinationCountryCode: "CA",
      shipmentReference: order_id,
    };
    if (courier_code) payload.courierCode = [courier_code];

    const resp = await fetch(`${SHIP24_API}/trackers`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const body = await resp.text();
    if (!resp.ok) {
      console.error(`Ship24 register failed [${resp.status}]:`, body);
      return new Response(JSON.stringify({ error: "Ship24 register failed", status: resp.status, details: body }), {
        status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(body);
    const trackerId = parsed?.data?.tracker?.trackerId ?? null;

    // Persist tracker id + normalized tracking url
    const trackingUrl = trackerId ? `https://www.ship24.com/tracking?p=${encodeURIComponent(tracking_number)}` : null;
    await supabase.from("orders").update({
      tracking_number,
      carrier: courier_code ?? null,
      tracking_url: trackingUrl,
      tracking_status: "registered",
      tracking_last_update_at: new Date().toISOString(),
    }).eq("id", order_id);

    return new Response(JSON.stringify({ ok: true, tracker_id: trackerId, tracking_url: trackingUrl }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("shipping-register-tracker error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
