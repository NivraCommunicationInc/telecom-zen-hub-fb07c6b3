// ============================================================
// weekly-sales-report — Sends weekly sales digest email (Mondays 8am)
// Triggered by pg_cron job 'weekly-sales-report'.
// Also callable on-demand from Core analytics page.
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPPORT_EMAIL = Deno.env.get("SUPPORT_EMAIL") || "support@nivra-telecom.ca";

function fmtCAD(n: number): string {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n || 0);
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prevWeekStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Last 7 days orders
    const { data: weekOrders } = await supabase
      .from("orders")
      .select("id, total_amount, source, status, created_at")
      .gte("created_at", weekStart.toISOString())
      .lt("created_at", now.toISOString());

    const { data: prevOrders } = await supabase
      .from("orders")
      .select("id, total_amount")
      .gte("created_at", prevWeekStart.toISOString())
      .lt("created_at", weekStart.toISOString());

    const totalOrders = weekOrders?.length || 0;
    const totalRevenue = (weekOrders || []).reduce((s, o: any) => s + (Number(o.total_amount) || 0), 0);
    const prevRevenue = (prevOrders || []).reduce((s, o: any) => s + (Number(o.total_amount) || 0), 0);
    const revenueDeltaPct = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    // Commissions earned this week
    const { data: commissions } = await supabase
      .from("agent_commissions")
      .select("amount, agent_user_id")
      .gte("created_at", weekStart.toISOString())
      .lt("created_at", now.toISOString());
    const totalCommissions = (commissions || []).reduce((s, c: any) => s + (Number(c.amount) || 0), 0);

    // Top 3 agents (by commission total)
    const agentTotals = new Map<string, { sales: number; commission: number }>();
    for (const c of commissions || []) {
      const k = (c as any).agent_user_id || "—";
      const cur = agentTotals.get(k) || { sales: 0, commission: 0 };
      cur.sales += 1;
      cur.commission += Number((c as any).amount) || 0;
      agentTotals.set(k, cur);
    }
    const topAgentIds = [...agentTotals.entries()]
      .sort((a, b) => b[1].commission - a[1].commission)
      .slice(0, 3)
      .map(([id]) => id);
    const { data: agentProfiles } = topAgentIds.length
      ? await supabase.from("profiles").select("user_id, full_name").in("user_id", topAgentIds)
      : { data: [] as any[] };
    const nameOf = (id: string) =>
      (agentProfiles || []).find((p: any) => p.user_id === id)?.full_name || "Agent inconnu";

    const topAgentsRows = topAgentIds.map((id, idx) => {
      const t = agentTotals.get(id)!;
      return `<tr><td style="padding:8px;border-bottom:1px solid #eee">${idx + 1}. ${nameOf(id)}</td><td style="padding:8px;text-align:right;border-bottom:1px solid #eee">${t.sales}</td><td style="padding:8px;text-align:right;border-bottom:1px solid #eee">${fmtCAD(t.commission)}</td></tr>`;
    }).join("");

    // Plan breakdown via billing_subscriptions created this week
    const { data: weekSubs } = await supabase
      .from("billing_subscriptions")
      .select("plan_name, plan_price")
      .gte("created_at", weekStart.toISOString())
      .lt("created_at", now.toISOString());
    const planCounts = new Map<string, number>();
    for (const s of weekSubs || []) {
      const k = (s as any).plan_name || "—";
      planCounts.set(k, (planCounts.get(k) || 0) + 1);
    }
    const planRows = [...planCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([n, c]) => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${n}</td><td style="padding:8px;text-align:right;border-bottom:1px solid #eee">${c}</td></tr>`)
      .join("") || `<tr><td colspan="2" style="padding:8px;color:#888">Aucun nouvel abonnement</td></tr>`;

    const subject = `Rapport hebdomadaire Nivra — Semaine du ${fmtDate(weekStart)}`;

    // Enqueue email via existing pipeline
    await supabase.rpc("enqueue_email", {
      p_to: SUPPORT_EMAIL,
      p_template_key: "weekly_sales_report",
      p_variables: {
        period_start: fmtDate(weekStart),
        period_end: fmtDate(now),
        total_orders: totalOrders,
        total_revenue: fmtCAD(totalRevenue),
        total_commissions: fmtCAD(totalCommissions),
        revenue_delta_pct: revenueDeltaPct.toFixed(1),
        revenue_trend_label: revenueDeltaPct >= 0 ? `+${revenueDeltaPct.toFixed(1)}%` : `${revenueDeltaPct.toFixed(1)}%`,
        top_agents_rows_html: topAgentsRows || `<tr><td colspan="3" style="padding:8px;color:#888">Aucune vente</td></tr>`,
        plan_breakdown_rows_html: planRows,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      period: { start: weekStart.toISOString(), end: now.toISOString() },
      stats: { totalOrders, totalRevenue, totalCommissions, revenueDeltaPct, top: topAgentIds.length, plans: planCounts.size },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[weekly-sales-report] error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
