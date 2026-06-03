/**
 * agent-analytics — collects business metrics, runs Gemini 2.5 Pro
 * analysis, stores report in analytics_reports, and (for weekly)
 * queues an email digest to nivratelecom@gmail.com.
 *
 * Body: { report_type: "daily" | "weekly" | "monthly" }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const ALERT_EMAIL = "nivratelecom@gmail.com";

type ReportType = "daily" | "weekly" | "monthly" | "custom";

function periodFor(type: ReportType): { start: string; end: string; days: number } {
  const end = new Date();
  const start = new Date(end);
  const days = type === "daily" ? 1 : type === "weekly" ? 7 : type === "monthly" ? 30 : 7;
  start.setDate(start.getDate() - days);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10), days };
}

async function collectMetrics(supabase: ReturnType<typeof createClient>, days: number) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const prevSince = new Date(Date.now() - 2 * days * 86_400_000).toISOString();

  const [activeAccounts, newAccounts, newOrders, paidPayments, complaints, mrrRows] = await Promise.all([
    supabase.from("accounts").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("accounts").select("id", { count: "exact", head: true }).gte("created_at", since),
    supabase.from("orders").select("id,total,status,created_at,plan_name", { count: "exact" }).gte("created_at", since),
    supabase.from("payments").select("amount").eq("status", "succeeded").gte("created_at", since),
    supabase.from("complaints").select("id,category,created_at,resolved_at").gte("created_at", since),
    supabase.from("billing_subscriptions").select("monthly_amount").eq("status", "active"),
  ]);

  const mrr = ((mrrRows.data ?? []) as Array<{ monthly_amount: number | null }>).reduce(
    (s, r) => s + Number(r.monthly_amount ?? 0), 0,
  );
  const revenue = ((paidPayments.data ?? []) as Array<{ amount: number | null }>).reduce(
    (s, r) => s + Number(r.amount ?? 0), 0,
  );

  const ordersByPlan: Record<string, number> = {};
  for (const o of ((newOrders.data ?? []) as Array<{ plan_name?: string | null }>)) {
    const k = o.plan_name ?? "Inconnu";
    ordersByPlan[k] = (ordersByPlan[k] ?? 0) + 1;
  }

  const complaintsByCategory: Record<string, number> = {};
  let resolvedCount = 0;
  let resolutionTotalMs = 0;
  for (const c of ((complaints.data ?? []) as Array<{ category?: string | null; created_at: string; resolved_at?: string | null }>)) {
    const cat = c.category ?? "Autre";
    complaintsByCategory[cat] = (complaintsByCategory[cat] ?? 0) + 1;
    if (c.resolved_at) {
      resolvedCount++;
      resolutionTotalMs += new Date(c.resolved_at).getTime() - new Date(c.created_at).getTime();
    }
  }

  return {
    period_days: days,
    mrr: Number(mrr.toFixed(2)),
    revenue_period: Number(revenue.toFixed(2)),
    active_clients: activeAccounts.count ?? 0,
    new_clients: newAccounts.count ?? 0,
    new_orders: newOrders.count ?? 0,
    orders_by_plan: ordersByPlan,
    total_complaints: complaints.data?.length ?? 0,
    complaints_by_category: complaintsByCategory,
    avg_resolution_hours: resolvedCount > 0 ? Number((resolutionTotalMs / resolvedCount / 3600_000).toFixed(1)) : 0,
    prev_period_marker: prevSince,
  };
}

async function geminiAnalyze(metrics: Record<string, unknown>) {
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{
          role: "user",
          content: `Tu es l'analyste business de Nivra Telecom. Métriques:\n${JSON.stringify(metrics, null, 2)}\n\nFournis STRICTEMENT en JSON: { "summary": "résumé exécutif 3-5 phrases", "positives": ["..."], "concerns": ["..."], "recommendations": ["3 actions prioritaires"], "forecast": "prévision MRR prochain mois", "actions": ["actions immédiates"] }`,
        }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const _auth = req.headers.get("Authorization") ?? "";
  const _agentSecret = Deno.env.get("AGENT_SECRET");
  if (_auth !== `Bearer ${SERVICE_KEY}` && (!_agentSecret || _auth !== `Bearer ${_agentSecret}`)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  const startedAt = Date.now();
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    let body: { report_type?: ReportType } = {};
    try { body = await req.json(); } catch { /* empty body ok */ }
    const reportType: ReportType = body.report_type ?? "weekly";
    const period = periodFor(reportType);

    const metrics = await collectMetrics(supabase, period.days);
    const ai = await geminiAnalyze(metrics);

    const { data: inserted } = await supabase.from("analytics_reports").insert({
      report_type: reportType,
      period_start: period.start,
      period_end: period.end,
      metrics,
      ai_analysis: ai?.summary ?? null,
      ai_recommendations: ai ?? null,
    }).select("id").maybeSingle();

    // Queue email for weekly + daily
    if (reportType === "weekly" || reportType === "daily") {
      const tplKey = reportType === "weekly" ? "weekly_analytics_report" : "daily_analytics_report";
      await supabase.from("email_queue").insert({
        to_email: ALERT_EMAIL,
        template_key: tplKey,
        subject: reportType === "weekly"
          ? `Rapport hebdomadaire Nivra — ${period.end}`
          : `Rapport quotidien Nivra — ${period.end}`,
        template_vars: {
          client_name: "Équipe Nivra",
          period_start: period.start,
          period_end: period.end,
          mrr: metrics.mrr,
          revenue: metrics.revenue_period,
          active_clients: metrics.active_clients,
          new_clients: metrics.new_clients,
          new_orders: metrics.new_orders,
          total_complaints: metrics.total_complaints,
          ai_summary: ai?.summary ?? "Rapport généré.",
          recommendations: ai?.recommendations ?? [],
        },
        status: "queued",
      });
    }

    await supabase.from("agent_audit_log").insert({
      agent_name: "agent-analytics",
      action: reportType,
      result: "success",
      execution_time_ms: Date.now() - startedAt,
      details: { report_id: (inserted as { id?: string } | null)?.id, metrics },
    });

    return new Response(
      JSON.stringify({ ok: true, report_id: (inserted as { id?: string } | null)?.id, metrics, ai }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    await supabase.from("agent_audit_log").insert({
      agent_name: "agent-analytics",
      action: "report",
      result: "failure",
      error_message: String(e),
      execution_time_ms: Date.now() - startedAt,
    });
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
