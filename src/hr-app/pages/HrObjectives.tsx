/**
 * HrObjectives — Reads canonical sales_targets (set by Core admin) for the
 * current period and counts the employee's actual sales this week / this
 * month from field_sales_orders. Shows weekly + monthly progress and next
 * bonus tier.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { format, startOfWeek, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { Target, DollarSign, TrendingUp, Loader2, AlertCircle, Award } from "lucide-react";
import { usePortalRealtime } from "@/hooks/usePortalRealtime";

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n || 0);

export default function HrObjectives() {
  usePortalRealtime(["sales_targets", "field_sales_orders"], [["rh-objectives"]]);

  const { data, isLoading } = useQuery({
    queryKey: ["rh-objectives"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
      const monthStart = startOfMonth(now).toISOString();

      const { data: targets = [] } = await supabase
        .from("sales_targets")
        .select("service_type, target_count, target_amount, bonus_amount, notes")
        .eq("employee_id", user.id)
        .eq("period_year", year)
        .eq("period_month", month);

      const totalRow = (targets || []).find((t: any) => t.service_type === "total_sales");
      const revenueRow = (targets || []).find((t: any) => t.service_type === "revenue");

      const monthlyTarget = Number(totalRow?.target_count ?? 0);
      const weeklyTarget = monthlyTarget > 0 ? Math.max(1, Math.ceil(monthlyTarget / 4)) : 0;
      const revenueTarget = Number(revenueRow?.target_amount ?? 0);
      const bonusAmount = Number(totalRow?.bonus_amount ?? revenueRow?.bonus_amount ?? 0);

      const [weekRes, monthRes] = await Promise.all([
        supabase.from("field_sales_orders").select("id, total_amount", { count: "exact" })
          .eq("salesperson_id", user.id).gte("created_at", weekStart),
        supabase.from("field_sales_orders").select("id, total_amount", { count: "exact" })
          .eq("salesperson_id", user.id).gte("created_at", monthStart),
      ]);

      const weeklyCurrent = weekRes.count ?? (weekRes.data?.length || 0);
      const monthlyCurrent = monthRes.count ?? (monthRes.data?.length || 0);
      const monthlyRevenue = (monthRes.data || []).reduce(
        (s: number, o: any) => s + Number(o.total_amount || 0), 0);

      return {
        hasTargets: (targets || []).length > 0,
        weeklyTarget, weeklyCurrent, monthlyTarget, monthlyCurrent,
        revenueTarget, monthlyRevenue, bonusAmount,
        notes: totalRow?.notes ?? null,
      };
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const d = data;
  const weeklyPct = d && d.weeklyTarget > 0 ? Math.min(100, (d.weeklyCurrent / d.weeklyTarget) * 100) : 0;
  const monthlyPct = d && d.monthlyTarget > 0 ? Math.min(100, (d.monthlyCurrent / d.monthlyTarget) * 100) : 0;
  const revenuePct = d && d.revenueTarget > 0 ? Math.min(100, (d.monthlyRevenue / d.revenueTarget) * 100) : 0;
  const bonusRemaining = d ? Math.max(0, d.monthlyTarget - d.monthlyCurrent) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" />
          Mes objectifs
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {format(new Date(), "MMMM yyyy", { locale: fr })} — Progression hebdomadaire et mensuelle
        </p>
      </div>

      {!d?.hasTargets ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
            <p>Aucun objectif défini pour ce mois.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Weekly */}
          <Card className="border-2 border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Cette semaine
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ventes</span>
                <span className="font-bold text-foreground">{d.weeklyCurrent} / {d.weeklyTarget}</span>
              </div>
              <Progress value={weeklyPct} className="h-3" />
              <p className="text-xs text-muted-foreground">{Math.round(weeklyPct)}% atteint</p>
            </CardContent>
          </Card>

          {/* Monthly */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Ce mois
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Ventes</span>
                  <span className="font-bold text-foreground">{d.monthlyCurrent} / {d.monthlyTarget}</span>
                </div>
                <Progress value={monthlyPct} className="h-3" />
                <p className="text-xs text-muted-foreground mt-1">{Math.round(monthlyPct)}% atteint</p>
              </div>

              {d.revenueTarget > 0 && (
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Revenus</span>
                    <span className="font-bold text-foreground">{fmt(d.monthlyRevenue)} / {fmt(d.revenueTarget)}</span>
                  </div>
                  <Progress value={revenuePct} className="h-3" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Next bonus tier */}
          {d.bonusAmount > 0 && (
            <Card className="border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="flex items-center gap-3 py-4">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-white/70">
                  <Award className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Prochain bonus</p>
                  {bonusRemaining > 0 ? (
                    <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                      Encore <span className="font-bold">{bonusRemaining} vente{bonusRemaining > 1 ? "s" : ""}</span> pour <span className="font-bold">{fmt(d.bonusAmount)}</span>
                    </p>
                  ) : (
                    <p className="text-xs font-bold text-emerald-700 mt-0.5">✅ Bonus de {fmt(d.bonusAmount)} atteint !</p>
                  )}
                </div>
                <DollarSign className="h-5 w-5 text-amber-600" />
              </CardContent>
            </Card>
          )}

          {d.notes && (
            <p className="text-xs text-muted-foreground italic px-1">{d.notes}</p>
          )}
        </>
      )}
    </div>
  );
}
