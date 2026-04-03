/**
 * FieldObjectives — Monthly KPI targets with progress bars.
 * Sales targets, revenue goals, conversion rates, commission milestones.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import {
  Target, Loader2, TrendingUp, DollarSign, Users, Award,
  Zap, BarChart3, Trophy, Star, Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { startOfMonth, format } from "date-fns";
import { fr } from "date-fns/locale";

interface KPI {
  label: string;
  current: number;
  target: number;
  icon: typeof Target;
  color: string;
  bg: string;
  unit: string;
  isCurrency?: boolean;
}

export default function FieldObjectives() {
  const { user } = useStaffUser();

  const { data, isLoading } = useQuery({
    queryKey: ["field-objectives-page", user?.id],
    queryFn: async () => {
      const monthStart = startOfMonth(new Date()).toISOString();

      const [ordersRes, leadsRes, commissionsRes, streetsRes] = await Promise.all([
        supabase.from("field_sales_orders")
          .select("id, total_amount, payment_status, sync_status, created_at")
          .eq("salesperson_id", user!.id)
          .gte("created_at", monthStart),
        supabase.from("field_leads")
          .select("id, status")
          .eq("agent_id", user!.id)
          .gte("created_at", monthStart),
        supabase.from("sales_commissions")
          .select("commission_amount, status")
          .eq("salesperson_id", user!.id)
          .gte("created_at", monthStart),
        supabase.from("field_territory_streets")
          .select("id, status, doors_knocked, doors_sold")
          .eq("agent_id", user!.id),
      ]);

      const orders = ordersRes.data || [];
      const leads = leadsRes.data || [];
      const commissions = commissionsRes.data || [];
      const streets = streetsRes.data || [];

      const totalRevenue = orders.reduce((s, o: any) => s + Number(o.total_amount || 0), 0);
      const confirmedOrders = orders.filter((o: any) => o.payment_status === "confirmed").length;
      const syncedOrders = orders.filter((o: any) => o.sync_status === "synced").length;
      const totalCommissions = commissions.reduce((s, c: any) => s + Number(c.commission_amount || 0), 0);
      const leadsWon = leads.filter((l: any) => l.status === "won").length;
      const leadsTotal = leads.length;
      const conversionRate = leadsTotal > 0 ? Math.round((leadsWon / leadsTotal) * 100) : 0;
      const streetsCompleted = streets.filter((s: any) => s.status === "completed").length;
      const totalDoors = streets.reduce((s, st: any) => s + (st.doors_knocked || 0), 0);

      return {
        totalSales: orders.length,
        confirmedOrders,
        syncedOrders,
        totalRevenue,
        totalCommissions,
        leadsCreated: leadsTotal,
        leadsWon,
        conversionRate,
        streetsCompleted,
        totalDoors,
      };
    },
    enabled: !!user?.id,
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" /></div>;

  const kpis: KPI[] = [
    { label: "Ventes ce mois", current: data?.totalSales ?? 0, target: 20, icon: Zap, color: "text-[#22C55E]", bg: "bg-[#DCFCE7]", unit: "ventes" },
    { label: "Revenus générés", current: data?.totalRevenue ?? 0, target: 5000, icon: DollarSign, color: "text-[#3B82F6]", bg: "bg-[#DBEAFE]", unit: "$", isCurrency: true },
    { label: "Commissions gagnées", current: data?.totalCommissions ?? 0, target: 1500, icon: Award, color: "text-[#F59E0B]", bg: "bg-[#FEF3C7]", unit: "$", isCurrency: true },
    { label: "Leads créés", current: data?.leadsCreated ?? 0, target: 50, icon: Users, color: "text-[#8B5CF6]", bg: "bg-[#EDE9FE]", unit: "leads" },
    { label: "Leads convertis", current: data?.leadsWon ?? 0, target: 10, icon: Star, color: "text-[#EC4899]", bg: "bg-[#FCE7F3]", unit: "convertis" },
    { label: "Taux de conversion", current: data?.conversionRate ?? 0, target: 40, icon: Target, color: "text-[#06B6D4]", bg: "bg-[#CFFAFE]", unit: "%" },
    { label: "Rues complétées", current: data?.streetsCompleted ?? 0, target: 15, icon: TrendingUp, color: "text-[#16A34A]", bg: "bg-[#DCFCE7]", unit: "rues" },
    { label: "Portes cognées", current: data?.totalDoors ?? 0, target: 500, icon: Flame, color: "text-[#EF4444]", bg: "bg-[#FEE2E2]", unit: "portes" },
    { label: "Commandes synchronisées", current: data?.syncedOrders ?? 0, target: data?.totalSales || 1, icon: BarChart3, color: "text-[#0EA5E9]", bg: "bg-[#E0F2FE]", unit: "sync" },
  ];

  const overallProgress = kpis.reduce((sum, k) => sum + Math.min(100, (k.current / Math.max(k.target, 1)) * 100), 0) / kpis.length;
  const achievedCount = kpis.filter((k) => k.current >= k.target).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#000000] tracking-tight">Objectifs & Cibles</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">{format(new Date(), "MMMM yyyy", { locale: fr })} • {achievedCount}/{kpis.length} atteints</p>
      </div>

      {/* Overall Progress */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", overallProgress >= 80 ? "bg-[#DCFCE7]" : "bg-[#FEF3C7]")}>
              {overallProgress >= 80 ? <Trophy className="h-5 w-5 text-[#16A34A]" /> : <Target className="h-5 w-5 text-[#D97706]" />}
            </div>
            <div>
              <p className="text-sm font-bold text-[#000000]">Progression globale</p>
              <p className="text-[10px] text-[#9CA3AF]">{achievedCount} objectif{achievedCount !== 1 ? "s" : ""} atteint{achievedCount !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <p className="text-3xl font-bold text-[#000000]">{Math.round(overallProgress)}%</p>
        </div>
        <div className="h-4 rounded-full bg-[#F3F4F6] overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-1000", overallProgress >= 80 ? "bg-[#22C55E]" : overallProgress >= 50 ? "bg-[#F59E0B]" : "bg-[#EF4444]")}
            style={{ width: `${Math.min(100, overallProgress)}%` }}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="space-y-3">
        {kpis.map((kpi) => {
          const pct = Math.min(100, Math.round((kpi.current / Math.max(kpi.target, 1)) * 100));
          const achieved = kpi.current >= kpi.target;
          const displayValue = kpi.isCurrency ? `${kpi.current.toFixed(0)} $` : kpi.current;
          const displayTarget = kpi.isCurrency ? `${kpi.target.toFixed(0)} $` : kpi.target;

          return (
            <div key={kpi.label} className={cn("bg-white border rounded-2xl p-4 transition-colors", achieved ? "border-[#BBF7D0]" : "border-[#E5E7EB]")}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", kpi.bg)}>
                    <kpi.icon className={cn("h-5 w-5", kpi.color)} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#000000]">{kpi.label}</p>
                    <p className="text-[10px] text-[#9CA3AF]">Cible : {displayTarget} {kpi.unit}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-[#000000]">{displayValue}</p>
                  <p className={cn("text-[10px] font-bold", achieved ? "text-[#16A34A]" : "text-[#6B7280]")}>{pct}%{achieved && " ✅"}</p>
                </div>
              </div>
              <div className="h-2.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-700", achieved ? "bg-[#22C55E]" : pct >= 60 ? "bg-[#F59E0B]" : "bg-[#EF4444]")}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}