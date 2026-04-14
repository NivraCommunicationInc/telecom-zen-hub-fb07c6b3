/**
 * FieldDailyReport — End-of-day summary for field reps.
 * Uses backend service layer only.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchDailyReport } from "@/field-app/lib/fieldServices";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar, ShoppingCart, UserPlus, DollarSign, TrendingUp, Loader2, CheckCircle2, Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export default function FieldDailyReport() {
  const today = new Date();

  const { data, isLoading } = useQuery({
    queryKey: ["field-daily-report"],
    queryFn: fetchDailyReport,
  });

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  const sales = data?.sales || [];
  const leads = data?.leads || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Rapport du jour</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {format(today, "EEEE d MMMM yyyy", { locale: fr })} — {data?.agentName || "Agent"}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Ventes", value: data?.salesCount ?? 0, icon: ShoppingCart, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Leads créés", value: data?.leadsCount ?? 0, icon: UserPlus, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Revenu", value: `${(data?.totalRevenue ?? 0).toFixed(2)} $`, icon: TrendingUp, color: "text-violet-600", bg: "bg-violet-50" },
          { label: "Commissions", value: `${(data?.totalCommissions ?? 0).toFixed(2)} $`, icon: DollarSign, color: "text-amber-600", bg: "bg-amber-50" },
        ].map((c) => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-4">
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center mb-2", c.bg)}>
              <c.icon className={cn("h-4 w-4", c.color)} />
            </div>
            <p className="text-xl font-bold text-foreground">{c.value}</p>
            <p className="text-[11px] text-muted-foreground font-medium">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Pipeline Status */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Statut pipeline</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-1">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-lg font-bold text-foreground">{data?.paidSales ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">Payées</p>
          </div>
          <div>
            <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-1">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <p className="text-lg font-bold text-foreground">{(data?.salesCount ?? 0) - (data?.paidSales ?? 0)}</p>
            <p className="text-[10px] text-muted-foreground">En attente</p>
          </div>
          <div>
            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-1">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-lg font-bold text-foreground">{data?.syncedSales ?? 0}</p>
            <p className="text-[10px] text-muted-foreground">Synchronisées</p>
          </div>
        </div>
      </div>

      {/* Sales List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ventes du jour ({sales.length})</h3>
        </div>
        {sales.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Aucune vente aujourd'hui</p>
        ) : (
          <div className="divide-y divide-border">
            {sales.map((sale: any) => (
              <div key={sale.id} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{sale.customer_name}</p>
                    {sale.customer_address && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" /> {sale.customer_address}
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-bold text-foreground">{sale.total_amount?.toFixed(2)} $</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Leads List */}
      {leads.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Leads du jour ({leads.length})</h3>
          </div>
          <div className="divide-y divide-border">
            {leads.map((lead: any) => (
              <div key={lead.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{lead.first_name} {lead.last_name}</p>
                  <p className="text-[10px] text-muted-foreground">{lead.service_need || "—"}</p>
                </div>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-secondary text-foreground">{lead.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
