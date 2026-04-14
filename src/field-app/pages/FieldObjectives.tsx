/**
 * FieldObjectives — Uses fetchObjectives from service layer. No direct DB queries.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchObjectives } from "@/field-app/lib/fieldServices";
import { Target, Loader2, TrendingUp, DollarSign, Users, Award, Zap, BarChart3, Trophy, Star, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const ICON_MAP: Record<string, typeof Target> = {
  sales_count: Zap, revenue: DollarSign, commissions: Award, leads_created: Users, leads_won: Star, conversion_rate: Target, streets_completed: TrendingUp, doors_knocked: Flame, synced_orders: BarChart3,
};
const COLOR_MAP: Record<string, { color: string; bg: string }> = {
  sales_count: { color: "text-[#22C55E]", bg: "bg-[#DCFCE7]" }, revenue: { color: "text-[#3B82F6]", bg: "bg-[#DBEAFE]" }, commissions: { color: "text-[#F59E0B]", bg: "bg-[#FEF3C7]" }, leads_created: { color: "text-[#8B5CF6]", bg: "bg-[#EDE9FE]" }, leads_won: { color: "text-[#EC4899]", bg: "bg-[#FCE7F3]" }, conversion_rate: { color: "text-[#06B6D4]", bg: "bg-[#CFFAFE]" }, streets_completed: { color: "text-[#16A34A]", bg: "bg-[#DCFCE7]" }, doors_knocked: { color: "text-[#EF4444]", bg: "bg-[#FEE2E2]" }, synced_orders: { color: "text-[#0EA5E9]", bg: "bg-[#E0F2FE]" },
};

export default function FieldObjectives() {
  const { data, isLoading } = useQuery({
    queryKey: ["field-objectives-page"],
    queryFn: fetchObjectives,
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-[#22C55E]" /></div>;

  const kpis = data?.kpis || [];
  const overallProgress = data?.overallProgress ?? 0;
  const achievedCount = data?.achievedCount ?? 0;
  const totalKpis = data?.totalKpis ?? kpis.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#000000] tracking-tight">Objectifs & Cibles</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">{format(new Date(), "MMMM yyyy", { locale: fr })} • {achievedCount}/{totalKpis} atteints • {data?.days_remaining ?? 0}j restants</p>
      </div>

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
          <p className="text-3xl font-bold text-[#000000]">{overallProgress}%</p>
        </div>
        <div className="h-4 rounded-full bg-[#F3F4F6] overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-1000", overallProgress >= 80 ? "bg-[#22C55E]" : overallProgress >= 50 ? "bg-[#F59E0B]" : "bg-[#EF4444]")} style={{ width: `${Math.min(100, overallProgress)}%` }} />
        </div>
      </div>

      <div className="space-y-3">
        {kpis.map((kpi: any) => {
          const Icon = ICON_MAP[kpi.metric] || Target;
          const colors = COLOR_MAP[kpi.metric] || { color: "text-[#6B7280]", bg: "bg-[#F3F4F6]" };
          const achieved = kpi.current >= kpi.target;
          const displayValue = kpi.isCurrency ? `${kpi.current.toFixed(0)} $` : kpi.current;
          const displayTarget = kpi.isCurrency ? `${kpi.target.toFixed(0)} $` : kpi.target;
          return (
            <div key={kpi.metric} className={cn("bg-white border rounded-2xl p-4 transition-colors", achieved ? "border-[#BBF7D0]" : "border-[#E5E7EB]")}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center", colors.bg)}><Icon className={cn("h-5 w-5", colors.color)} /></div>
                  <div>
                    <p className="text-sm font-bold text-[#000000]">{kpi.label}</p>
                    <p className="text-[10px] text-[#9CA3AF]">Cible : {displayTarget} {kpi.unit} {kpi.on_track ? "• ✅ en rythme" : ""}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-[#000000]">{displayValue}</p>
                  <p className={cn("text-[10px] font-bold", achieved ? "text-[#16A34A]" : "text-[#6B7280]")}>{kpi.progress}%{achieved && " ✅"}</p>
                </div>
              </div>
              <div className="h-2.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                <div className={cn("h-full rounded-full transition-all duration-700", achieved ? "bg-[#22C55E]" : kpi.progress >= 60 ? "bg-[#F59E0B]" : "bg-[#EF4444]")} style={{ width: `${kpi.progress}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
