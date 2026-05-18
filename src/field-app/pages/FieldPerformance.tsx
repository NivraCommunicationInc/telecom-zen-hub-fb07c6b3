/**
 * FieldPerformance — Analytics page using backend service layer.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, BarChart3, DollarSign, Download, Loader2, Target, TrendingUp } from "lucide-react";
import { fetchPerformanceData } from "@/field-app/lib/fieldServices";
import { cn } from "@/lib/utils";
import { FieldEmptyState, FieldMetricCard, FieldPageHeader, FieldPanel } from "@/field-app/components/FieldUI";
import { exportToCSV } from "@/core-app/lib/exportUtils";

type Period = "week" | "month" | "all";

export default function FieldPerformance() {
  const [period, setPeriod] = useState<Period>("month");

  const { data, isLoading } = useQuery({
    queryKey: ["field-performance", period],
    queryFn: () => fetchPerformanceData(period),
  });

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <FieldPageHeader
        eyebrow="Performance"
        title="Pilotage des résultats"
        description="Lecture claire des ventes, conversion et valeur commerciale."
        actions={
          <div className="inline-flex rounded-2xl border border-border bg-card p-1 shadow-card">
            {([["week", "7 jours"], ["month", "Ce mois"], ["all", "Historique"]] as [Period, string][]).map(([value, label]) => (
              <button key={value} onClick={() => setPeriod(value)}
                className={cn("rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  period === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}>
                {label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FieldMetricCard label="Ventes" value={data?.totalOrders ?? 0} hint={`${data?.confirmedOrders ?? 0} payées`} icon={TrendingUp} tone="success" />
        <FieldMetricCard label="Revenu" value={`${(data?.totalRevenue ?? 0).toFixed(0)} $`} hint={`${(data?.avgOrderValue ?? 0).toFixed(0)} $ panier moyen`} icon={DollarSign} tone="premium" />
        <FieldMetricCard label="Commissions" value={`${(data?.totalCommissions ?? 0).toFixed(0)} $`} hint={`${data?.syncedOrders ?? 0} synchronisées`} icon={Award} tone="warning" />
        <FieldMetricCard label="Conversion" value={`${data?.conversionRate ?? 0}%`} hint={`${data?.wonLeads ?? 0} leads gagnés`} icon={Target} tone="info" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <FieldPanel title="Rythme des 7 derniers jours" description="Le rythme commercial en un coup d'œil.">
          <div className="flex h-48 items-end gap-3">
            {(data?.dailyBreakdown || []).map((day: any) => (
              <div key={day.label} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-xs font-semibold text-foreground">{day.count}</span>
                <div className="flex h-36 w-full items-end rounded-[1rem] bg-secondary px-2 pb-2">
                  <div className="w-full rounded-[0.8rem] bg-primary transition-all"
                    style={{ height: `${Math.max(8, (day.count / Math.max(data?.maxDailyCount ?? 1, 1)) * 100)}%` }} />
                </div>
                <span className="text-[11px] text-muted-foreground">{day.label}</span>
              </div>
            ))}
          </div>
        </FieldPanel>

        <FieldPanel title="Services qui ferment le mieux" description="Les offres les plus vendues guident votre pitch.">
          {(data?.topServices?.length ?? 0) === 0 ? (
            <FieldEmptyState icon={BarChart3} title="Pas assez de données" description="Les services performants apparaîtront ici après vos premières ventes." />
          ) : (
            <div className="space-y-3">
              {data?.topServices.map(([name, count]: [string, number], index: number) => (
                <div key={name} className="flex items-center gap-3 rounded-[1.25rem] border border-border bg-card px-4 py-3 shadow-card">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-secondary text-sm font-semibold text-foreground">{index + 1}</div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{name}</p></div>
                  <span className="text-sm font-semibold text-foreground">{count}x</span>
                </div>
              ))}
            </div>
          )}
        </FieldPanel>
      </div>
    </div>
  );
}
