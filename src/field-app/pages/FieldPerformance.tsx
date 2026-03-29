/**
 * FieldPerformance — Analytics & performance dashboard for field agents.
 * Weekly/monthly trends, conversion funnel, top services sold.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { Loader2, TrendingUp, BarChart3, Target, DollarSign, Award, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { format, subDays, startOfWeek, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

type Period = "week" | "month" | "all";

export default function FieldPerformance() {
  const { user } = useStaffUser();
  const [period, setPeriod] = useState<Period>("month");

  const { data, isLoading } = useQuery({
    queryKey: ["field-performance", user?.id, period],
    queryFn: async () => {
      let startDate: string | null = null;
      const now = new Date();
      if (period === "week") startDate = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
      else if (period === "month") startDate = startOfMonth(now).toISOString();

      let ordersQ = supabase.from("field_sales_orders")
        .select("id, total_amount, payment_status, sync_status, services, created_at")
        .eq("salesperson_id", user!.id);
      if (startDate) ordersQ = ordersQ.gte("created_at", startDate);

      let leadsQ = supabase.from("field_leads")
        .select("id, status, created_at")
        .eq("agent_id", user!.id);
      if (startDate) leadsQ = leadsQ.gte("created_at", startDate);

      let commissionsQ = supabase.from("sales_commissions")
        .select("commission_amount, status, created_at")
        .eq("salesperson_id", user!.id);
      if (startDate) commissionsQ = commissionsQ.gte("created_at", startDate);

      const [ordersRes, leadsRes, commissionsRes] = await Promise.all([ordersQ, leadsQ, commissionsQ]);

      const orders = ordersRes.data || [];
      const leads = leadsRes.data || [];
      const commissions = commissionsRes.data || [];

      const totalRevenue = orders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);
      const totalCommissions = commissions.reduce((sum: number, c: any) => sum + Number(c.commission_amount || c.amount || 0), 0);
      const paidOrders = orders.filter((o: any) => o.payment_status === "confirmed").length;
      const syncedOrders = orders.filter((o: any) => o.sync_status === "synced").length;

      // Lead funnel
      const leadsByStatus: Record<string, number> = {};
      leads.forEach((l: any) => { leadsByStatus[l.status] = (leadsByStatus[l.status] || 0) + 1; });

      // Top services
      const serviceCounts: Record<string, number> = {};
      orders.forEach((o: any) => {
        const svcs = Array.isArray(o.services) ? o.services : [];
        svcs.forEach((s: any) => {
          const name = s.name || "Inconnu";
          serviceCounts[name] = (serviceCounts[name] || 0) + 1;
        });
      });
      const topServices = Object.entries(serviceCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

      // Daily breakdown (last 7 days)
      const dailyBreakdown: { date: string; count: number; revenue: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = subDays(new Date(), i);
        const dayStr = format(d, "yyyy-MM-dd");
        const dayOrders = orders.filter((o: any) => o.created_at.startsWith(dayStr));
        dailyBreakdown.push({
          date: format(d, "EEE d", { locale: fr }),
          count: dayOrders.length,
          revenue: dayOrders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0),
        });
      }
      const maxDailyCount = Math.max(1, ...dailyBreakdown.map((d) => d.count));

      return {
        totalOrders: orders.length,
        totalRevenue,
        totalCommissions,
        paidOrders,
        syncedOrders,
        totalLeads: leads.length,
        leadsByStatus,
        topServices,
        dailyBreakdown,
        maxDailyCount,
        avgOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
      };
    },
    enabled: !!user?.id,
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#000000]">Performance</h1>
          <p className="text-sm text-[#6B7280]">Analyse de vos résultats terrain</p>
        </div>
        <div className="flex bg-[#F3F4F6] rounded-lg p-0.5">
          {([["week", "Semaine"], ["month", "Mois"], ["all", "Tout"]] as [Period, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                period === key ? "bg-white text-[#000000] shadow-sm" : "text-[#6B7280] hover:text-[#000000]"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Ventes", value: data?.totalOrders ?? 0, icon: TrendingUp, color: "text-[#22C55E]", bg: "bg-[#DCFCE7]" },
          { label: "Revenu", value: `${(data?.totalRevenue ?? 0).toFixed(0)} $`, icon: DollarSign, color: "text-[#3B82F6]", bg: "bg-[#DBEAFE]" },
          { label: "Panier moyen", value: `${(data?.avgOrderValue ?? 0).toFixed(0)} $`, icon: BarChart3, color: "text-[#8B5CF6]", bg: "bg-[#EDE9FE]" },
          { label: "Commissions", value: `${(data?.totalCommissions ?? 0).toFixed(0)} $`, icon: Award, color: "text-[#F59E0B]", bg: "bg-[#FEF3C7]" },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-[#E5E7EB] rounded-xl p-4">
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-2", c.bg)}>
              <c.icon className={cn("h-4 w-4", c.color)} />
            </div>
            <p className="text-xl font-bold text-[#000000]">{c.value}</p>
            <p className="text-[11px] text-[#6B7280] font-medium">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Daily Bar Chart */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
        <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-4">Ventes — 7 derniers jours</h3>
        <div className="flex items-end gap-2 h-32">
          {data?.dailyBreakdown.map((day, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-[#000000]">{day.count}</span>
              <div
                className={cn("w-full rounded-t-md transition-all", day.count > 0 ? "bg-[#22C55E]" : "bg-[#F3F4F6]")}
                style={{ height: `${Math.max(4, (day.count / (data?.maxDailyCount ?? 1)) * 100)}%` }}
              />
              <span className="text-[9px] text-[#9CA3AF] font-medium">{day.date}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Two columns: Lead Funnel + Top Services */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Lead Funnel */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-3">Entonnoir leads</h3>
          {(data?.totalLeads ?? 0) === 0 ? (
            <p className="text-sm text-[#9CA3AF] text-center py-4">Aucun lead</p>
          ) : (
            <div className="space-y-2">
              {[
                { key: "new", label: "Nouveaux", color: "bg-[#3B82F6]" },
                { key: "contacted", label: "Contactés", color: "bg-[#06B6D4]" },
                { key: "qualified", label: "Qualifiés", color: "bg-[#F59E0B]" },
                { key: "submitted", label: "Soumis", color: "bg-[#8B5CF6]" },
                { key: "won", label: "Gagnés", color: "bg-[#22C55E]" },
                { key: "lost", label: "Perdus", color: "bg-[#EF4444]" },
              ].map((stage) => {
                const count = data?.leadsByStatus[stage.key] || 0;
                const pct = (data?.totalLeads ?? 0) > 0 ? (count / data!.totalLeads) * 100 : 0;
                return (
                  <div key={stage.key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-[#374151]">{stage.label}</span>
                      <span className="text-xs font-bold text-[#000000]">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#F3F4F6] overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", stage.color)} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Services */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider mb-3">Services les plus vendus</h3>
          {(data?.topServices?.length ?? 0) === 0 ? (
            <p className="text-sm text-[#9CA3AF] text-center py-4">Aucune donnée</p>
          ) : (
            <div className="space-y-3">
              {data!.topServices.map(([name, count], i) => (
                <div key={name} className="flex items-center gap-3">
                  <span className={cn(
                    "h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold",
                    i === 0 ? "bg-[#FEF3C7] text-[#D97706]" : "bg-[#F3F4F6] text-[#6B7280]"
                  )}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#000000] truncate">{name}</p>
                  </div>
                  <span className="text-sm font-bold text-[#000000]">{count}x</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
