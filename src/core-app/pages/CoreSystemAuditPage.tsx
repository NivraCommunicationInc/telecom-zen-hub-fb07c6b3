/**
 * CoreSystemAuditPage — System-level audit & billing automation runs.
 * Mirrors old admin AdminSystemAudit.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Search, Eye, RefreshCcw, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function CoreSystemAuditPage() {
  const [tab, setTab] = useState("automation");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any>(null);

  const { data: automationRuns = [], isLoading: l1, refetch } = useQuery({
    queryKey: ["core-billing-automation-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_automation_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: systemAlerts = [], isLoading: l2 } = useQuery({
    queryKey: ["core-billing-system-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_system_alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const filterList = (list: any[]) =>
    list.filter((l) => {
      if (!search.trim()) return true;
      return JSON.stringify(l).toLowerCase().includes(search.toLowerCase());
    });

  const statusIcon = (status: string) => {
    if (status === "completed") return <CheckCircle className="h-3 w-3 text-emerald-400" />;
    if (status === "failed") return <AlertTriangle className="h-3 w-3 text-red-400" />;
    return <Clock className="h-3 w-3 text-yellow-400" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald-400" />
          <h1 className="text-lg font-semibold text-white">System Audit</h1>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} className="border-[hsl(220,15%,20%)] text-[hsl(220,10%,60%)] hover:text-white">
          <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> Actualiser
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Runs total", value: automationRuns.length },
          { label: "Réussis", value: automationRuns.filter((r: any) => r.status === "completed").length, color: "text-emerald-400" },
          { label: "Échoués", value: automationRuns.filter((r: any) => r.status === "failed").length, color: "text-red-400" },
          { label: "Alertes", value: systemAlerts.filter((a: any) => !a.resolved).length, color: "text-amber-400" },
        ].map((s, i) => (
          <div key={i} className="bg-[hsl(220,15%,12%)] rounded-lg border border-[hsl(220,15%,16%)] p-3">
            <p className="text-[10px] text-[hsl(220,10%,50%)] uppercase">{s.label}</p>
            <p className={`text-xl font-bold ${s.color || "text-white"}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(220,10%,40%)]" />
        <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="pl-8 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-white text-xs" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-[hsl(220,15%,12%)] border border-[hsl(220,15%,18%)]">
          <TabsTrigger value="automation">Automation Runs ({automationRuns.length})</TabsTrigger>
          <TabsTrigger value="alerts">Alertes système ({systemAlerts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="automation">
          <div className="rounded-lg border border-[hsl(220,15%,16%)] overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[hsl(220,15%,12%)]">
                <tr className="text-[hsl(220,10%,50%)]">
                  <th className="text-left p-2.5 font-medium">Type</th>
                  <th className="text-left p-2.5 font-medium">Statut</th>
                  <th className="text-left p-2.5 font-medium">Renouvellements</th>
                  <th className="text-left p-2.5 font-medium">Rappels</th>
                  <th className="text-left p-2.5 font-medium">Erreurs</th>
                  <th className="text-left p-2.5 font-medium">Démarré</th>
                  <th className="text-right p-2.5 font-medium">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(220,15%,14%)]">
                {l1 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-[hsl(220,10%,40%)]">Chargement…</td></tr>
                ) : filterList(automationRuns).length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-[hsl(220,10%,40%)]">Aucun run</td></tr>
                ) : (
                  filterList(automationRuns).slice(0, 100).map((r: any) => (
                    <tr key={r.id} className="hover:bg-[hsl(220,15%,12%)]">
                      <td className="p-2.5 text-white">{r.run_type}</td>
                      <td className="p-2.5 flex items-center gap-1">
                        {statusIcon(r.status)}
                        <Badge className={`text-[10px] ${r.status === "completed" ? "bg-emerald-500/20 text-emerald-400" : r.status === "failed" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"}`}>
                          {r.status}
                        </Badge>
                      </td>
                      <td className="p-2.5 text-emerald-400 font-mono">{r.renewals_generated ?? 0}</td>
                      <td className="p-2.5 text-blue-400 font-mono">{r.reminders_queued ?? 0}</td>
                      <td className="p-2.5 text-red-400 font-mono">{r.errors_count ?? 0}</td>
                      <td className="p-2.5 text-[hsl(220,10%,50%)]">
                        {r.started_at ? format(new Date(r.started_at), "dd MMM HH:mm", { locale: fr }) : "—"}
                      </td>
                      <td className="p-2.5 text-right">
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setSelected(r)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="alerts">
          <div className="rounded-lg border border-[hsl(220,15%,16%)] overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-[hsl(220,15%,12%)]">
                <tr className="text-[hsl(220,10%,50%)]">
                  <th className="text-left p-2.5 font-medium">Type</th>
                  <th className="text-left p-2.5 font-medium">Entité</th>
                  <th className="text-left p-2.5 font-medium">Résolu</th>
                  <th className="text-left p-2.5 font-medium">Date</th>
                  <th className="text-right p-2.5 font-medium">Détails</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(220,15%,14%)]">
                {l2 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-[hsl(220,10%,40%)]">Chargement…</td></tr>
                ) : filterList(systemAlerts).length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-[hsl(220,10%,40%)]">Aucune alerte</td></tr>
                ) : (
                  filterList(systemAlerts).slice(0, 100).map((a: any) => (
                    <tr key={a.id} className="hover:bg-[hsl(220,15%,12%)]">
                      <td className="p-2.5 text-white">{a.alert_type}</td>
                      <td className="p-2.5 text-[hsl(220,10%,70%)]">{a.entity_type} {a.entity_id ? `(${a.entity_id.slice(0, 8)})` : ""}</td>
                      <td className="p-2.5">
                        <Badge className={`text-[10px] ${a.resolved ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                          {a.resolved ? "Résolu" : "Non résolu"}
                        </Badge>
                      </td>
                      <td className="p-2.5 text-[hsl(220,10%,50%)]">
                        {a.created_at ? format(new Date(a.created_at), "dd MMM HH:mm", { locale: fr }) : "—"}
                      </td>
                      <td className="p-2.5 text-right">
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setSelected(a)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-white max-w-lg">
          <DialogHeader><DialogTitle className="text-sm">Détails</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-xs">
              {selected.summary && <p className="text-white">{selected.summary}</p>}
              {(selected.details || selected.errors || selected.processed_items) && (
                <pre className="bg-[hsl(220,15%,8%)] rounded p-3 overflow-auto max-h-[300px] text-[10px] text-emerald-300">
                  {JSON.stringify(selected.details || selected.errors || selected.processed_items, null, 2)}
                </pre>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
