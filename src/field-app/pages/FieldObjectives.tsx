/**
 * FieldObjectives — Always shows weekly/monthly sales counts and bonus tier
 * progression for the agent (from field_commissions). The canonical monthly
 * target from sales_targets is shown when present, otherwise an info card.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Target, TrendingUp, Award, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfWeek, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { usePortalRealtime } from "@/hooks/usePortalRealtime";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(n || 0);

const BONUS_TIERS: Array<{ count: number; bonus: number }> = [
  { count: 10, bonus: 100 },
  { count: 20, bonus: 250 },
  { count: 30, bonus: 450 },
  { count: 50, bonus: 750 },
];

export default function FieldObjectives() {
  usePortalRealtime(
    ["sales_targets", "field_commissions", "orders"],
    [["field-objectives-summary"]],
  );
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
      const targetBonusAmount = Number(totalRow?.bonus_amount ?? 0);
      const monthlyRevenueTarget = Number(revenueRow?.target_amount ?? 0);

      // 2) Counts: orders + field_payment_intents (both count as a sale)
      const [
        weekOrdersRes,
        monthOrdersRes,
        weekIntentsRes,
        monthIntentsRes,
        monthRevenueRes,
      ] = await Promise.all([
        supabase.from("orders")
          .select("id", { count: "exact", head: true })
          .eq("created_by_agent_id", user.id)
          .eq("source", "field_sales")
          .neq("status", "cancelled")
          .gte("created_at", weekStart),
        supabase.from("orders")
          .select("id", { count: "exact", head: true })
          .eq("created_by_agent_id", user.id)
          .eq("source", "field_sales")
          .neq("status", "cancelled")
          .gte("created_at", monthStart),
        supabase.from("field_payment_intents")
          .select("id", { count: "exact", head: true })
          .eq("agent_id", user.id)
          .neq("status", "cancelled")
          .gte("created_at", weekStart),
        supabase.from("field_payment_intents")
          .select("id", { count: "exact", head: true })
          .eq("agent_id", user.id)
          .neq("status", "cancelled")
          .gte("created_at", monthStart),
        supabase.from("orders")
          .select("total_amount")
          .eq("created_by_agent_id", user.id)
          .eq("source", "field_sales")
          .neq("status", "cancelled")
          .gte("created_at", monthStart),
      ]);

      const weekSales = (weekOrdersRes.count ?? 0) + (weekIntentsRes.count ?? 0);
      const monthSales = (monthOrdersRes.count ?? 0) + (monthIntentsRes.count ?? 0);
      const monthRevenue = (monthRevenueRes.data || [])
        .reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);

      return {
        weekSales,
        monthSales,
        monthlyTarget,
        targetBonusAmount,
        monthRevenue,
        monthlyRevenueTarget,
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

  const monthSales = data?.monthSales ?? 0;
  const weekSales = data?.weekSales ?? 0;
  const monthlyTarget = data?.monthlyTarget ?? 0;
  const monthlyPct = monthlyTarget > 0 ? Math.min(100, Math.round((monthSales / monthlyTarget) * 100)) : 0;
  const monthlyRemaining = Math.max(0, monthlyTarget - monthSales);
  const weeklyTarget = monthlyTarget > 0 ? Math.ceil(monthlyTarget / 4) : 0;
  const monthRevenue = data?.monthRevenue ?? 0;
  const monthlyRevenueTarget = data?.monthlyRevenueTarget ?? 0;
  const revenuePct = monthlyRevenueTarget > 0
    ? Math.min(100, Math.round((monthRevenue / monthlyRevenueTarget) * 100))
    : 0;

  // Bonus tier logic
  const currentTier = [...BONUS_TIERS].reverse().find((t) => monthSales >= t.count);
  const nextTier = BONUS_TIERS.find((t) => monthSales < t.count);
  const nextTierRemaining = nextTier ? nextTier.count - monthSales : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#000000] tracking-tight">Objectifs &amp; Cibles</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">{format(new Date(), "MMMM yyyy", { locale: fr })}</p>
      </div>

      {/* SECTION 1 — Ce mois-ci */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#1A1A2E] border border-[#E5E7EB] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-[#DBEAFE]">
              <Calendar className="h-5 w-5 text-[#3B82F6]" />
            </div>
            <p className="text-xs font-medium text-[#6B7280]">Ce mois</p>
          </div>
          <p className="text-3xl font-bold text-[#000000]">{monthSales}</p>
          <p className="text-xs text-[#9CA3AF] mt-1">vente{monthSales !== 1 ? "s" : ""}</p>
        </div>
        <div className="bg-[#1A1A2E] border border-[#E5E7EB] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-[#EDE9FE]">
              <TrendingUp className="h-5 w-5 text-[#7C3AED]" />
            </div>
            <p className="text-xs font-medium text-[#6B7280]">Cette semaine</p>
          </div>
          <p className="text-3xl font-bold text-[#000000]">{weekSales}</p>
          <p className="text-xs text-[#9CA3AF] mt-1">vente{weekSales !== 1 ? "s" : ""}</p>
        </div>
      </div>

      {weeklyTarget > 0 && (
        <div className="bg-[#EDE9FE] border border-[#7C3AED]/20 rounded-2xl p-4">
          <p className="text-xs font-semibold text-[#5B21B6]">
            Objectif hebdomadaire : {weeklyTarget} vente{weeklyTarget > 1 ? "s" : ""}{" "}
            <span className="text-[#7C3AED]/80 font-normal">
              (mensuel ÷ 4 = {monthlyTarget} ÷ 4 → {weeklyTarget}/semaine)
            </span>
          </p>
        </div>
      )}

      {/* Revenu total généré ce mois (chiffre d'affaires) */}
      <div className="bg-[#1A1A2E] border border-[#E5E7EB] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-[#DCFCE7]">
              <TrendingUp className="h-5 w-5 text-[#15803D]" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#000000]">Revenu total généré</p>
              <p className="text-[10px] text-[#9CA3AF]">Chiffre d'affaires ce mois</p>
            </div>
          </div>
          <p className="text-xl font-bold text-[#000000]">
            {fmtMoney(monthRevenue)}
            {monthlyRevenueTarget > 0 && (
              <span className="text-xs font-normal text-[#6B7280]"> / {fmtMoney(monthlyRevenueTarget)}</span>
            )}
          </p>
        </div>
        {monthlyRevenueTarget > 0 && (
          <div className="h-3 rounded-full bg-[#F3F4F6] overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-700", revenuePct >= 100 ? "bg-[#22C55E]" : "bg-[#15803D]")}
              style={{ width: `${revenuePct}%` }}
            />
          </div>
        )}
      </div>

      {/* SECTION 4 — Objectif mensuel (if assigned) */}
      {data?.hasTargets && monthlyTarget > 0 ? (
        <div className="bg-[#1A1A2E] border border-[#E5E7EB] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-[#DBEAFE]">
                <Target className="h-5 w-5 text-[#3B82F6]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#000000]">Objectif du mois</p>
                <p className="text-[10px] text-[#9CA3AF]">Assigné par votre gestionnaire</p>
              </div>
            </div>
            <p className="text-xl font-bold text-[#000000]">{monthSales} / {monthlyTarget}</p>
          </div>
          <div className="h-3 rounded-full bg-[#F3F4F6] overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-700", monthlyPct >= 100 ? "bg-[#22C55E]" : monthlyPct >= 50 ? "bg-[#3B82F6]" : "bg-[#F59E0B]")}
              style={{ width: `${monthlyPct}%` }}
            />
          </div>
          <p className="text-[11px] text-[#6B7280] mt-2">
            {monthlyRemaining > 0
              ? `${monthlyRemaining} vente${monthlyRemaining > 1 ? "s" : ""} restante${monthlyRemaining > 1 ? "s" : ""} pour atteindre votre objectif`
              : "✅ Objectif atteint !"}
          </p>
          <p className={cn(
            "text-xs font-semibold mt-2 text-center",
            monthlyPct >= 100 ? "text-[#15803D]" :
            monthlyPct >= 76 ? "text-[#D97706]" :
            monthlyPct >= 51 ? "text-[#3B82F6]" :
            monthlyPct >= 26 ? "text-[#7C3AED]" : "text-[#6B7280]"
          )}>
            {monthlyPct >= 100 ? "🏆 Objectif atteint ! Félicitations !" :
             monthlyPct >= 76 ? "Presque là ! Encore un effort !" :
             monthlyPct >= 51 ? "Excellent ! Vous êtes sur la bonne voie !" :
             monthlyPct >= 26 ? "Bon départ ! Continuez comme ça !" :
             "Bonne chance ! Vous pouvez le faire !"}
          </p>
        </div>
      ) : (
        <div className="bg-[#1A1A2E] border border-[#E5E7EB] rounded-2xl p-5 text-center">
          <Target className="h-8 w-8 mx-auto mb-3 text-[#9CA3AF]" />
          <p className="text-sm text-[#6B7280]">
            Aucun objectif assigné pour ce mois.<br />
            Votre gestionnaire vous assignera des objectifs prochainement.
          </p>
        </div>
      )}

      {/* SECTION 3 — Progression vers le bonus (always shown) */}
      <div className="bg-[#1A1A2E] border border-[#E5E7EB] rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-[#FEF3C7]">
            <Award className="h-5 w-5 text-[#D97706]" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#000000]">Progression vers le bonus</p>
            <p className="text-[10px] text-[#9CA3AF]">Bonus mensuels Nivra</p>
          </div>
        </div>

        <div className="space-y-2">
          {BONUS_TIERS.map((tier) => {
            const reached = monthSales >= tier.count;
            const isNext = nextTier?.count === tier.count;
            return (
              <div
                key={tier.count}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border transition-all",
                  reached ? "bg-[#DCFCE7] border-[#22C55E]/40" : isNext ? "bg-[#FEF3C7] border-[#F59E0B]/40" : "bg-[#F9FAFB] border-[#E5E7EB]",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn("h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold", reached ? "bg-[#22C55E] text-white" : isNext ? "bg-[#F59E0B] text-white" : "bg-[#E5E7EB] text-[#6B7280]")}>
                    {reached ? "✓" : tier.count}
                  </span>
                  <span className="text-sm font-medium text-[#111827]">{tier.count} ventes</span>
                </div>
                <span className={cn("text-sm font-bold", reached ? "text-[#15803D]" : "text-[#111827]")}>{fmtMoney(tier.bonus)}</span>
              </div>
            );
          })}
        </div>

        {nextTier && (
          <p className="text-xs text-[#6B7280] mt-3 text-center">
            Encore <span className="font-bold text-[#7C3AED]">{nextTierRemaining} vente{nextTierRemaining > 1 ? "s" : ""}</span> pour atteindre <span className="font-bold">{fmtMoney(nextTier.bonus)}</span>
          </p>
        )}
        {!nextTier && currentTier && (
          <p className="text-xs text-[#15803D] mt-3 text-center font-bold">
            ✅ Bonus maximum atteint : {fmtMoney(currentTier.bonus)}
          </p>
        )}
      </div>
    </div>
  );
}
