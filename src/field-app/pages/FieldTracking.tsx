/**
 * FieldTracking — Uses fetchTrackingSummary from service layer. No direct DB queries.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchTrackingSummary } from "@/field-app/lib/fieldServices";
import { TrendingUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const LEAD_PIPELINE = [
  { key: "new", label: "Leads nouveaux", color: "bg-blue-500" },
  { key: "contacted", label: "Leads contactés", color: "bg-cyan-500" },
  { key: "qualified", label: "Leads qualifiés", color: "bg-amber-500" },
];
const ORDER_PIPELINE = [
  { key: "pending", label: "Paiement en attente", color: "bg-amber-500" },
  { key: "confirmed", label: "Paiement reçu", color: "bg-emerald-500" },
  { key: "cancelled", label: "Annulées", color: "bg-red-500" },
];
const SYNC_PIPELINE = [
  { key: "synced", label: "Envoyées à Core", color: "bg-emerald-500" },
  { key: "pending", label: "Sync en attente", color: "bg-amber-500" },
  { key: "error", label: "Erreurs sync", color: "bg-red-500" },
];

export default function FieldTracking() {
  const { data, isLoading } = useQuery({
    queryKey: ["field-tracking-v3"],
    queryFn: fetchTrackingSummary,
  });

  const totalLeads = data?.totalLeads ?? 0;
  const totalOrders = data?.totalOrders ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Suivi opérationnel</h1>
        <p className="text-sm text-muted-foreground">{totalOrders} commande{totalOrders !== 1 ? "s" : ""} • {totalLeads} lead{totalLeads !== 1 ? "s" : ""}</p>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : totalOrders === 0 && totalLeads === 0 ? (
        <div className="text-center py-12"><TrendingUp className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">Aucune donnée de vente</p></div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card border border-border rounded-xl p-4 text-center"><p className="text-[11px] text-muted-foreground font-medium">Commandes</p><p className="text-2xl font-bold text-foreground mt-1">{totalOrders}</p></div>
            <div className="bg-card border border-border rounded-xl p-4 text-center"><p className="text-[11px] text-muted-foreground font-medium">Payées</p><p className="text-2xl font-bold text-emerald-600 mt-1">{data?.paymentCounts?.confirmed || 0}</p></div>
            <div className="bg-card border border-border rounded-xl p-4 text-center"><p className="text-[11px] text-muted-foreground font-medium">Sync Core</p><p className="text-2xl font-bold text-emerald-600 mt-1">{data?.syncCounts?.synced || 0}</p></div>
          </div>
          {totalOrders > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Statut paiement</h3>
              <div className="space-y-2">{ORDER_PIPELINE.map((stage) => { const count = data?.paymentCounts?.[stage.key] || 0; const pct = totalOrders > 0 ? (count / totalOrders) * 100 : 0; return (<div key={stage.key} className="p-3 rounded-xl border border-border bg-card"><div className="flex items-center justify-between mb-1.5"><span className="text-sm font-medium text-foreground">{stage.label}</span><span className="text-lg font-bold text-foreground">{count}</span></div><div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className={cn("h-full rounded-full transition-all", stage.color)} style={{ width: `${pct}%` }} /></div></div>); })}</div>
            </div>
          )}
          {totalOrders > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Synchronisation Core</h3>
              <div className="space-y-2">{SYNC_PIPELINE.map((stage) => { const count = data?.syncCounts?.[stage.key] || 0; const pct = totalOrders > 0 ? (count / totalOrders) * 100 : 0; return (<div key={`sync-${stage.key}`} className="p-3 rounded-xl border border-border bg-card"><div className="flex items-center justify-between mb-1.5"><span className="text-sm font-medium text-foreground">{stage.label}</span><span className="text-lg font-bold text-foreground">{count}</span></div><div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className={cn("h-full rounded-full transition-all", stage.color)} style={{ width: `${pct}%` }} /></div></div>); })}</div>
            </div>
          )}
          {totalLeads > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pipeline leads</h3>
              <div className="space-y-2">{LEAD_PIPELINE.map((stage) => { const count = data?.leadCounts?.[stage.key] || 0; const pct = totalLeads > 0 ? (count / totalLeads) * 100 : 0; return (<div key={stage.key} className="p-3 rounded-xl border border-border bg-card"><div className="flex items-center justify-between mb-1.5"><span className="text-sm font-medium text-foreground">{stage.label}</span><span className="text-lg font-bold text-foreground">{count}</span></div><div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className={cn("h-full rounded-full transition-all", stage.color)} style={{ width: `${pct}%` }} /></div></div>); })}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
