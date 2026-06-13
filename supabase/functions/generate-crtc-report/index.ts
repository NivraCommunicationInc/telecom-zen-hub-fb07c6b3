// generate-crtc-report — CRTC quarterly compliance report generator
// Requires service role authorization.
// Body: { year: number, quarter: 1|2|3|4 }

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = req.headers.get("Authorization") ?? "";
  const _svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (_auth !== `Bearer ${_svcKey}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, _svcKey);

  let year: number, quarter: 1 | 2 | 3 | 4;
  try {
    const body = await req.json();
    year = Number(body.year);
    quarter = Number(body.quarter) as 1 | 2 | 3 | 4;
    if (!year || ![1, 2, 3, 4].includes(quarter)) {
      return new Response(JSON.stringify({ error: "year and quarter (1–4) required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (_e) {
    return new Response(JSON.stringify({ error: "invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec
  const qStart = new Date(year, (quarter - 1) * 3, 1).toISOString();
  const qEnd = new Date(year, quarter * 3, 0, 23, 59, 59).toISOString();

  // Collect metrics in parallel
  const [activeClients, newClients, cancellations, complaints] = await Promise.all([
    supabase.from("accounts").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("accounts").select("id", { count: "exact", head: true }).gte("created_at", qStart).lte("created_at", qEnd),
    supabase.from("accounts").select("id", { count: "exact", head: true }).eq("status", "cancelled").gte("updated_at", qStart).lte("updated_at", qEnd),
    supabase.from("complaints").select("id, category, status", { count: "exact" }).gte("created_at", qStart).lte("created_at", qEnd),
  ]);

  const metrics = {
    period: `${year}-Q${quarter}`,
    period_start: qStart,
    period_end: qEnd,
    active_clients: activeClients.count ?? 0,
    new_clients: newClients.count ?? 0,
    cancellations: cancellations.count ?? 0,
    total_complaints: complaints.count ?? 0,
    complaint_breakdown: (complaints.data ?? []).reduce((acc: Record<string, number>, c: any) => {
      const key = c.category || "other";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
  };

  // Persist to crtc_compliance_reports (best-effort — don't fail the response on insert error)
  await supabase.from("crtc_compliance_reports").insert({
    year,
    quarter,
    metrics,
    generated_at: new Date().toISOString(),
    status: "generated",
  }).catch((e: unknown) => {
    console.warn("[generate-crtc-report] insert into crtc_compliance_reports failed:", (e as Error)?.message);
  });

  return new Response(JSON.stringify({ ok: true, metrics }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
