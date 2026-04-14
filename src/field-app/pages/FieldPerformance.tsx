/**
 * FieldPerformance — Polished analytics page for field reps.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, startOfWeek, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import { Award, BarChart3, DollarSign, Loader2, Target, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import { cn } from "@/lib/utils";
import { FieldEmptyState, FieldMetricCard, FieldPageHeader, FieldPanel } from "@/field-app/components/FieldUI";

type Period = "week" | "month" | "all";

export default function FieldPerformance() {
  const { user } = useStaffUser();
  const [period, setPeriod] = useState<Period>("month");

  const { data, isLoading } = useQuery({
    queryKey: ["field-performance", user?.id, period],
    queryFn: async () => {
      const now = new Date();
      const startDate = period === "week" ? startOfWeek(now, { weekStartsOn: 1 }).toISOString() : period === "month" ? startOfMonth(now).toISOString() : null;

      let ordersQuery = supabase
        .from("field_sales_orders")
        .select("id, total_amount, payment_status, sync_status, services, created_at")
        .eq("salesperson_id", user!.id);
      if (startDate) ordersQuery = ordersQuery.gte("created_at", startDate);

      let leadsQuery = supabase.from("field_leads").select("id, status, created_at").eq("agent_id", user!.id);
      if (startDate) leadsQuery = leadsQuery.gte("created_at", startDate);

      let commissionsQuery = supabase.from("sales_commissions").select("commission_amount, status, created_at").eq("salesperson_id", user!.id);
      if (startDate) commissionsQuery = commissionsQuery.gte("created_at", startDate);

      const [ordersRes, leadsRes, commissionsRes] = await Promise.all([ordersQuery, leadsQuery, commissionsQuery]);
      const orders = ordersRes.data || [];
      const leads = leadsRes.data || [];
      const commissions = commissionsRes.data || [];

      const totalRevenue = orders.reduce((sum: number, order: any) => sum + Number(order.total_amount || 0), 0);
      const totalCommissions = commissions.reduce((sum: number, commission: any) => sum + Number(commission.commission_amount || 0), 0);
      const confirmedOrders = orders.filter((order: any) => order.payment_status === "confirmed").length;
      const syncedOrders = orders.filter((order: any) => order.sync_status === "synced").length;
      const wonLeads = leads.filter((lead: any) => lead.status === "won").length;
      const conversionRate = leads.length > 0 ? Math.round((wonLeads / leads.length) * 100) : 0;

      const serviceCounts: Record<string, number> = {};
      for (const order of orders) {
        const services = Array.isArray((order as any).services) ? (order as any).services : [];
        for (const service of services) {
          const name = service.name || "Inconnu";
          serviceCounts[name] = (serviceCounts[name] || 0) + 1;
        }
      }

      const topServices = Object.entries(serviceCounts)
        .sort(([, a], [, b]) => Number(b) - Number(a))
        .slice(0, 5);

      const dailyBreakdown = Array.from({ length: 7 }).map((_, index) => {
        const day = subDays(new Date(), 6 - index);
        const key = format(day, "yyyy-MM-dd");
        const dayOrders = orders.filter((order: any) => order.created_at.startsWith(key));
        return {
          label: format(day, "EEE d", { locale: fr }),
          count: dayOrders.length,
          revenue: dayOrders.reduce((sum: number, order: any) => sum + Number(order.total_amount || 0), 0),
        };
      });

      return {
        totalOrders: orders.length,
        totalRevenue,
        totalCommissions,
        confirmedOrders,
        syncedOrders,
        totalLeads: leads.length,
        wonLeads,
        conversionRate,
        topServices,
        dailyBreakdown,
        maxDailyCount: Math.max(1, ...dailyBreakdown.map((item) => item.count)),
        avgOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
      };
    },
    enabled: !!user?.id,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FieldPageHeader
        eyebrow="Performance"
        title="Pilotage des résultats"
        description="Une lecture claire des ventes, de la conversion et de la valeur commerciale, sans effet dashboard générique."
        actions={
          <div className="inline-flex rounded-2xl border border-border bg-card p-1 shadow-card">
            {([ ["week", "7 jours"], ["month", "Ce mois"], ["all", "Historique"] ] as [Period, string][]).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setPeriod(value)}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                  period === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <FieldMetricCard label="Ventes" value={data?.totalOrders ?? 0} hint={`${data?.confirmedOrders ?? 0} payées`} icon={TrendingUp} tone="success" />
        <FieldMetricCard label="Revenu" value={`${(data?.totalRevenue ?? 0).toFixed(0)} $`} hint={`${(data?.avgOrderValue ?? 0).toFixed(0)} $ panier moyen`} icon={DollarSign} tone="premium" />
        <FieldMetricCard label="Commissions" value={`${(data?.totalCommissions ?? 0).toFixed(0)} $`} hint={`${data?.syncedOrders ?? 0} commandes synchronisées`} icon={Award} tone="warning" />
        <FieldMetricCard label="Conversion" value={`${data?.conversionRate ?? 0}%`} hint={`${data?.wonLeads ?? 0} leads gagnés`} icon={Target} tone="info" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <FieldPanel title="Rythme des 7 derniers jours" description="Le rythme commercial doit être lisible en un coup d'œil.">
          <div className="flex h-48 items-end gap-3">
            {data?.dailyBreakdown.map((day) => (
              <div key={day.label} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-xs font-semibold text-foreground">{day.count}</span>
                <div className="flex h-36 w-full items-end rounded-[1rem] bg-secondary px-2 pb-2">
                  <div
                    className="w-full rounded-[0.8rem] bg-primary transition-all"
                    style={{ height: `${Math.max(8, (day.count / Math.max(data?.maxDailyCount ?? 1, 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground">{day.label}</span>
              </div>
            ))}
          </div>
        </FieldPanel>

        <FieldPanel title="Services qui ferment le mieux" description="Les offres qui reviennent le plus peuvent guider votre pitch terrain.">
          {(data?.topServices.length ?? 0) === 0 ? (
            <FieldEmptyState
              icon={BarChart3}
              title="Pas assez de données"
              description="Dès que des ventes seront confirmées, les services les plus performants apparaîtront ici."
            />
          ) : (
            <div className="space-y-3">
              {data?.topServices.map(([name, count], index) => (
                <div key={name} className="flex items-center gap-3 rounded-[1.25rem] border border-border bg-card px-4 py-3 shadow-card">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-secondary text-sm font-semibold text-foreground">{index + 1}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                  </div>
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
