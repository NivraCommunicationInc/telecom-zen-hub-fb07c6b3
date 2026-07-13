/**
 * tech-map-data — Returns active service addresses + technician map positions.
 * Technicians use live GPS when available, otherwise their current assignment
 * service address so they remain visible once they accept installation work.
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
    const mapboxToken = Deno.env.get("MAPBOX_PUBLIC_TOKEN") || Deno.env.get("VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN");

    // Load addresses that have at least one active subscription
    const { data: subs, error: subsErr } = await supabase
      .from("subscriptions")
      .select("id, plan_name, service_type, status, service_address_id, account_id")
      .in("status", ["active", "pending_activation", "provisioning"])
      .not("service_address_id", "is", null);
    if (subsErr) throw subsErr;

    const addressIds = Array.from(new Set((subs || []).map((s: any) => s.service_address_id).filter(Boolean)));

    let addrs: any[] = [];
    if (addressIds.length > 0) {
      const { data, error: addrErr } = await supabase
        .from("service_addresses")
        .select("id, account_id, label, address_line, city, province, postal_code, latitude, longitude")
        .in("id", addressIds);
      if (addrErr) throw addrErr;
      addrs = data || [];
    }

    // Geocode missing coords
    const toGeocode = addrs.filter((a: any) => !a.latitude || !a.longitude);
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

    const servicePoints = addrs
      .filter((a: any) => a.latitude && a.longitude)
      .map((a: any) => ({
        id: a.id,
        kind: "service_address",
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

    const activeAssignmentStatuses = ["accepted", "assigned", "en_route", "arrived", "in_progress", "scheduled", "pending_scheduling"];
    const { data: techRows } = await supabase
      .from("technicians")
      .select("id, user_id, full_name, status")
      .in("status", ["active", "available", "busy", "on_route", "on_job"]);

    const techIds = Array.from(new Set((techRows || []).map((t: any) => t.id).filter(Boolean)));
    const techUserIds = Array.from(new Set((techRows || []).map((t: any) => t.user_id).filter(Boolean)));
    const allTechnicianKeys = Array.from(new Set([...techIds, ...techUserIds]));
    let liveRows: any[] = [];
    let assignmentRows: any[] = [];
    if (allTechnicianKeys.length > 0) {
      const { data: locs } = await supabase
        .from("technician_locations")
        .select("technician_id, latitude, longitude, accuracy_meters, recorded_at, updated_at")
        .in("technician_id", allTechnicianKeys)
        .order("updated_at", { ascending: false });
      liveRows = locs || [];

      const { data: assignments } = await supabase
        .from("technician_assignments")
        .select("id, technician_id, status, service_address_id, live_location")
        .in("technician_id", allTechnicianKeys)
        .in("status", activeAssignmentStatuses)
        .order("scheduled_date", { ascending: true });
      assignmentRows = assignments || [];
    }

    const latestLiveByTech = new Map<string, any>();
    for (const loc of liveRows) {
      if (loc.latitude && loc.longitude) {
        latestLiveByTech.set(loc.technician_id, loc);
      }
    }

    const assignmentByTech = new Map<string, any>();
    const fallbackAddressIds = new Set<string>();
    for (const assignment of assignmentRows) {
      if (!assignmentByTech.has(assignment.technician_id)) assignmentByTech.set(assignment.technician_id, assignment);
      if (assignment.service_address_id) fallbackAddressIds.add(assignment.service_address_id);
    }

    let fallbackAddresses: any[] = [];
    if (fallbackAddressIds.size > 0) {
      const { data: fallback } = await supabase
        .from("service_addresses")
        .select("id, account_id, label, address_line, city, province, postal_code, latitude, longitude")
        .in("id", Array.from(fallbackAddressIds));
      fallbackAddresses = fallback || [];
    }
    const fallbackById = new Map(fallbackAddresses.map((a: any) => [a.id, a]));

    const technicianPoints = (techRows || []).flatMap((tech: any) => {
      const live = latestLiveByTech.get(tech.user_id) || latestLiveByTech.get(tech.id);
      const assignment = assignmentByTech.get(tech.user_id) || assignmentByTech.get(tech.id);
      const fallback = assignment?.service_address_id ? fallbackById.get(assignment.service_address_id) : null;
      const assignmentLive = assignment?.live_location && typeof assignment.live_location === "object" ? assignment.live_location : null;
      const lat = live?.latitude ?? assignmentLive?.lat ?? fallback?.latitude;
      const lng = live?.longitude ?? assignmentLive?.lng ?? fallback?.longitude;
      if (!lat || !lng) return [];
      return [{
        id: `tech-${tech.user_id || tech.id}`,
        kind: "technician",
        account_id: fallback?.account_id || "",
        label: tech.full_name || "Technicien",
        address_line: fallback?.address_line || "Position technicien",
        city: fallback?.city || null,
        province: fallback?.province || null,
        postal_code: fallback?.postal_code || null,
        lat: Number(lat),
        lng: Number(lng),
        services: [],
        technician_id: tech.user_id || tech.id,
        technician_profile_id: tech.id,
        technician_name: tech.full_name || "Technicien",
        technician_status: tech.status || null,
        assignment_status: assignment?.status || null,
        location_source: live ? "live_gps" : assignmentLive ? "assignment_live" : "assignment_address",
      }];
    });

    const points = [...servicePoints, ...technicianPoints];

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
