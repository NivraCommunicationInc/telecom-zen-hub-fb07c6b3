/**
 * marketing-stats — Returns dashboard KPIs for the Marketing Hub.
 * Admin-only.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey);
    const { data: { user } } = await userClient.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const now = new Date();
    const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
    const startWeek = new Date(now); startWeek.setDate(now.getDate() - 7);
    const startMonth = new Date(now); startMonth.setDate(now.getDate() - 30);

    const [
      activeToday,
      smsToday,
      smsWeek,
      smsMonth,
      inboundWeek,
      outboundWeek,
      saleClosed,
      waitingHuman,
      discountStats,
      revenue,
    ] = await Promise.all([
      admin.from("marketing_conversations").select("id", { count: "exact", head: true })
        .gte("last_message_at", startToday.toISOString()),
      admin.from("telephony_logs").select("id", { count: "exact", head: true })
        .eq("action", "sms").eq("direction", "outbound").gte("created_at", startToday.toISOString()),
      admin.from("telephony_logs").select("id", { count: "exact", head: true })
        .eq("action", "sms").eq("direction", "outbound").gte("created_at", startWeek.toISOString()),
      admin.from("telephony_logs").select("id", { count: "exact", head: true })
        .eq("action", "sms").eq("direction", "outbound").gte("created_at", startMonth.toISOString()),
      admin.from("telephony_logs").select("id", { count: "exact", head: true })
        .eq("action", "sms").eq("direction", "inbound").gte("created_at", startWeek.toISOString()),
      admin.from("telephony_logs").select("id", { count: "exact", head: true })
        .eq("action", "sms").eq("direction", "outbound").gte("created_at", startWeek.toISOString()),
      admin.from("marketing_conversations").select("id, sale_amount", { count: "exact" })
        .eq("sale_closed", true).gte("updated_at", startMonth.toISOString()),
      admin.from("marketing_conversations").select("id", { count: "exact", head: true })
        .eq("status", "waiting"),
      admin.from("marketing_conversations").select("discount_offered, discount_accepted"),
      admin.from("marketing_conversations").select("sale_amount").eq("sale_closed", true),
    ]);

    const responseRate = (inboundWeek.count || 0) > 0
      ? Math.round(((outboundWeek.count || 0) / (inboundWeek.count || 1)) * 100)
      : 0;

    const discountBreakdown: Record<string, { offered: number; accepted: number }> = {
      none: { offered: 0, accepted: 0 },
      "5_per_month": { offered: 0, accepted: 0 },
      "10_per_month": { offered: 0, accepted: 0 },
      free_installation: { offered: 0, accepted: 0 },
    };
    (discountStats.data || []).forEach((r: any) => {
      const key = r.discount_offered || "none";
      if (!discountBreakdown[key]) discountBreakdown[key] = { offered: 0, accepted: 0 };
      discountBreakdown[key].offered++;
      if (r.discount_accepted) discountBreakdown[key].accepted++;
    });

    const totalRevenue = (revenue.data || []).reduce((sum: number, r: any) => sum + (Number(r.sale_amount) || 0), 0);

    return new Response(JSON.stringify({
      success: true,
      stats: {
        active_conversations_today: activeToday.count || 0,
        sms_today: smsToday.count || 0,
        sms_week: smsWeek.count || 0,
        sms_month: smsMonth.count || 0,
        response_rate_pct: responseRate,
        sales_closed: saleClosed.count || 0,
        waiting_human: waitingHuman.count || 0,
        discount_breakdown: discountBreakdown,
        revenue_total: totalRevenue,
      },
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
