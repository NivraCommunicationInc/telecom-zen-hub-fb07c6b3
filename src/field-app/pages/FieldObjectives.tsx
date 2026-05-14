/**
 * FieldObjectives — Reads canonical sales_targets (set by Core admin) for the
 * current period and counts the agent's actual sales this week / this month
 * from field_sales_orders. Shows weekly + monthly progress bars and the next
 * bonus tier remaining.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Target, TrendingUp, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfWeek, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n || 0);

export default function FieldObjectives() {
  const { data, isLoading } = useQuery({
    queryKey: ["field-objectives-summary"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
      const monthStart = startOfMonth(now).toISOString();

      // 1) Canonical targets from sales_targets (written by Core admin)
      const { data: targets = [] } = await supabase
        .from("sales_targets")
        .select("service_type, target_count, target_amount, bonus_amount")
        .eq("employee_id", user.id)
        .eq("period_year", year)
        .eq("period_month", month);

      const totalRow = (targets || []).find((t: any) => t.service_type === "total_sales");
      const revenueRow = (targets || []).find((t: any) => t.service_type === "revenue");

      const monthlyTarget = Number(totalRow?.target_count ?? 0);
      const weeklyTarget = monthlyTarget > 0 ? Math.max(1, Math.ceil(monthlyTarget / 4)) : 0;
      const revenueTarget = Number(revenueRow?.target_amount ?? 0);
      const bonusAmount = Number(totalRow?.bonus_amount ?? revenueRow?.bonus_amount ?? 0);

      // 2) Current sales counts from field_sales_orders
      const [weekRes, monthRes] = await Promise.all([
        supabase
          .from("field_sales_orders")
          .select("id, total_amount", { count: "exact" })
          .eq("salesperson_id", user.id)
          .gte("created_at", weekStart),
        supabase
          .from("field_sales_orders")
          .select("id, total_amount", { count: "exact" })
          .eq("salesperson_id", user.id)
          .gte("created_at", monthStart),
      ]);

      const weeklyCurrent = weekRes.count ?? (weekRes.data?.length || 0);
      const monthlyCurrent = monthRes.count ?? (monthRes.data?.length || 0);
      const monthlyRevenue = (monthRes.data || []).reduce(
        (s: number, o: any) => s + Number(o.total_amount || 0),
        0,
      );

      return {
        weeklyTarget,
        weeklyCurrent,
        monthlyTarget,
        monthlyCurrent,
        revenueTarget,
        monthlyRevenue,
        bonusAmount,
        hasTargets: (targets || []).length > 0,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-[#7C3AED]" />
      </div>
    );
  }

  const d = data;
  const weeklyPct = d && d.weeklyTarget > 0 ? Math.min(100, Math.round((d.weeklyCurrent / d.weeklyTarget) * 100)) : 0;
  const monthlyPct = d && d.monthlyTarget > 0 ? Math.min(100, Math.round((d.monthlyCurrent / d.monthlyTarget) * 100)) : 0;
  const revenuePct = d && d.revenueTarget > 0 ? Math.min(100, Math.round((d.monthlyRevenue / d.revenueTarget) * 100)) : 0;
  const bonusRemaining = d ? Math.max(0, d.monthlyTarget - d.monthlyCurrent) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#000000] tracking-tight">Objectifs &amp; Cibles</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">{format(new Date(), "MMMM yyyy", { locale: fr })}</p>
      </div>

      {!d?.hasTargets && (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 text-center">
          <Target className="h-8 w-8 mx-auto mb-3 text-[#9CA3AF]" />
          <p className="text-sm text-[#6B7280]">Aucun objectif défini pour ce mois. Contactez votre superviseur.</p>
        </div>
      )}

      {d?.hasTargets && (
        <>
          {/* Weekly */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-[#EDE9FE]">
                  <TrendingUp className="h-5 w-5 text-[#7C3AED]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#000000]">Cette semaine</p>
                  <p className="text-[10px] text-[#9CA3AF]">Objectif hebdomadaire</p>
                </div>
              </div>
              <p className="text-xl font-bold text-[#000000]">{d.weeklyCurrent} / {d.weeklyTarget} ventes</p>
            </div>
            <div className="h-3 rounded-full bg-[#F3F4F6] overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-700", weeklyPct >= 100 ? "bg-[#22C55E]" : weeklyPct >= 50 ? "bg-[#7C3AED]" : "bg-[#F59E0B]")}
                style={{ width: `${weeklyPct}%` }}
              />
            </div>
            <p className="text-[10px] text-[#9CA3AF] mt-1.5">{weeklyPct}% atteint</p>
          </div>

          {/* Monthly */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-[#DBEAFE]">
                  <Target className="h-5 w-5 text-[#3B82F6]" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#000000]">Ce mois</p>
                  <p className="text-[10px] text-[#9CA3AF]">Objectif mensuel</p>
                </div>
              </div>
              <p className="text-xl font-bold text-[#000000]">{d.monthlyCurrent} / {d.monthlyTarget} ventes</p>
            </div>
            <div className="h-3 rounded-full bg-[#F3F4F6] overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-700", monthlyPct >= 100 ? "bg-[#22C55E]" : monthlyPct >= 50 ? "bg-[#3B82F6]" : "bg-[#F59E0B]")}
                style={{ width: `${monthlyPct}%` }}
              />
            </div>
            <p className="text-[10px] text-[#9CA3AF] mt-1.5">{monthlyPct}% atteint</p>
          </div>

          {/* Revenue (optional) */}
          {d.revenueTarget > 0 && (
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-[#000000]">Revenus ce mois</p>
                <p className="text-sm font-bold text-[#000000]">{fmtMoney(d.monthlyRevenue)} / {fmtMoney(d.revenueTarget)}</p>
              </div>
              <div className="h-2.5 rounded-full bg-[#F3F4F6] overflow-hidden">
                <div className="h-full rounded-full bg-[#22C55E] transition-all duration-700" style={{ width: `${revenuePct}%` }} />
              </div>
            </div>
          )}

          {/* Next bonus tier */}
          {d.bonusAmount > 0 && (
            <div className="bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] border border-[#F59E0B]/30 rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-white/70">
                  <Award className="h-5 w-5 text-[#D97706]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-[#78350F]">Prochain bonus</p>
                  {bonusRemaining > 0 ? (
                    <p className="text-xs text-[#92400E] mt-0.5">
                      Encore <span className="font-bold">{bonusRemaining} vente{bonusRemaining > 1 ? "s" : ""}</span> pour <span className="font-bold">{fmtMoney(d.bonusAmount)}</span>
                    </p>
                  ) : (
                    <p className="text-xs text-[#065F46] mt-0.5 font-bold">✅ Bonus de {fmtMoney(d.bonusAmount)} atteint !</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
