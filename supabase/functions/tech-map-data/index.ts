/**
 * tech-map-data — Returns all service addresses with active subscriptions
 * for the tech map. Auto-geocodes any missing coordinates via Mapbox and
 * persists them back to service_addresses.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const mapboxToken = Deno.env.get("MAPBOX_PUBLIC_TOKEN");

    // Load addresses that have at least one active subscription
    const { data: subs, error: subsErr } = await supabase
      .from("subscriptions")
      .select("id, plan_name, service_type, status, service_address_id, account_id")
      .in("status", ["active", "pending_activation", "provisioning"])
      .not("service_address_id", "is", null);
    if (subsErr) throw subsErr;

    const addressIds = Array.from(new Set((subs || []).map((s: any) => s.service_address_id).filter(Boolean)));
    if (addressIds.length === 0) {
      return new Response(JSON.stringify({ token: mapboxToken, points: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: addrs, error: addrErr } = await supabase
      .from("service_addresses")
      .select("id, account_id, label, address_line, city, province, postal_code, latitude, longitude")
      .in("id", addressIds);
    if (addrErr) throw addrErr;

    // Geocode missing coords
    const toGeocode = (addrs || []).filter((a: any) => !a.latitude || !a.longitude);
    if (toGeocode.length && mapboxToken) {
      for (const a of toGeocode) {
        const q = [a.address_line, a.city, a.province, a.postal_code, "Canada"].filter(Boolean).join(", ");
        try {
          const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?country=ca&limit=1&access_token=${mapboxToken}`;
          const res = await fetch(url);
          const json = await res.json();
          const feat = json?.features?.[0];
          if (feat?.center) {
            const [lng, lat] = feat.center;
            a.longitude = lng;
            a.latitude = lat;
            await supabase.from("service_addresses").update({ latitude: lat, longitude: lng }).eq("id", a.id);
          }
        } catch (_e) { /* skip */ }
      }
    }

    // Group services per address
    const svcByAddr = new Map<string, any[]>();
    for (const s of subs || []) {
      const list = svcByAddr.get(s.service_address_id) || [];
      list.push({ id: s.id, plan_name: s.plan_name, service_type: s.service_type, status: s.status });
      svcByAddr.set(s.service_address_id, list);
    }

    const points = (addrs || [])
      .filter((a: any) => a.latitude && a.longitude)
      .map((a: any) => ({
        id: a.id,
        account_id: a.account_id,
        label: a.label,
        address_line: a.address_line,
        city: a.city,
        province: a.province,
        postal_code: a.postal_code,
        lat: Number(a.latitude),
        lng: Number(a.longitude),
        services: svcByAddr.get(a.id) || [],
      }));

    return new Response(JSON.stringify({ token: mapboxToken, points }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
