/**
 * network-uptime-check
 *
 * Pings Nivra platform endpoints and logs results to network_uptime_checks.
 * Run via pg_cron every 5 minutes.
 * Also returns live status for the Core Network dashboard.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EndpointDef {
  name: string;
  url: string;
  expectedStatus?: number;
}

const ENDPOINTS: EndpointDef[] = [
  { name: "portal_client",   url: Deno.env.get("PORTAL_URL") || "https://client.nivra-telecom.ca" },
  { name: "portal_core",     url: Deno.env.get("CORE_URL")   || "https://core.nivra-telecom.ca" },
  { name: "website",         url: "https://nivra-telecom.ca" },
  { name: "supabase_api",    url: `${Deno.env.get("SUPABASE_URL")}/rest/v1/`, expectedStatus: 200 },
  { name: "email_resend",    url: "https://api.resend.com/emails", expectedStatus: 405 }, // 405 = no auth, but reachable
];

async function checkEndpoint(ep: EndpointDef): Promise<{
  endpoint_name: string;
  endpoint_url: string;
  is_up: boolean;
  response_time_ms: number;
  http_status: number | null;
  error_message: string | null;
}> {
  const start = Date.now();
  try {
    const res = await fetch(ep.url, {
      method: "HEAD",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Nivra-Uptime-Monitor/1.0" },
    });
    const ms = Date.now() - start;
    const expected = ep.expectedStatus ?? 200;
    const is_up = res.status < 500 || res.status === expected;
    return {
      endpoint_name: ep.name,
      endpoint_url: ep.url,
      is_up,
      response_time_ms: ms,
      http_status: res.status,
      error_message: is_up ? null : `HTTP ${res.status}`,
    };
  } catch (err: unknown) {
    return {
      endpoint_name: ep.name,
      endpoint_url: ep.url,
      is_up: false,
      response_time_ms: Date.now() - start,
      http_status: null,
      error_message: err instanceof Error ? err.message : String(err),
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase    = createClient(supabaseUrl, serviceKey);

  const results = await Promise.all(ENDPOINTS.map(checkEndpoint));
  const checkedAt = new Date().toISOString();

  const rows = results.map((r) => ({ ...r, checked_at: checkedAt }));
  const { error: insertErr } = await supabase
    .from("network_uptime_checks")
    .insert(rows);

  if (insertErr) console.error("[network-uptime-check] insert error:", insertErr.message);

  // If any critical endpoint is down, open/update a network incident
  const criticals = results.filter((r) =>
    !r.is_up && ["portal_client", "portal_core", "supabase_api"].includes(r.endpoint_name)
  );

  if (criticals.length > 0) {
    const names = criticals.map((r) => r.endpoint_name).join(", ");
    const { data: existing } = await supabase
      .from("network_incidents")
      .select("id")
      .eq("status", "investigating")
      .like("title", `%${criticals[0].endpoint_name}%`)
      .maybeSingle();

    if (!existing) {
      await supabase.from("network_incidents").insert({
        title: `Service dégradé — ${names}`,
        incident_type: criticals.length >= 2 ? "partial_outage" : "degraded",
        severity: criticals.length >= 2 ? "high" : "medium",
        affected_services: criticals.map((r) => r.endpoint_name),
        status: "investigating",
      });
      console.warn(`[network-uptime-check] Incident ouvert: ${names}`);
    }
  } else {
    // Auto-resolve open incidents if all critical endpoints are back
    await supabase
      .from("network_incidents")
      .update({ status: "resolved", resolved_at: checkedAt, resolution_notes: "Résolution automatique — tous les endpoints répondent." })
      .eq("status", "investigating")
      .lt("started_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());
  }

  const allUp = results.every((r) => r.is_up);
  const upCount = results.filter((r) => r.is_up).length;

  return new Response(
    JSON.stringify({ ok: true, checked: results.length, up: upCount, down: results.length - upCount, all_up: allUp, results }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
