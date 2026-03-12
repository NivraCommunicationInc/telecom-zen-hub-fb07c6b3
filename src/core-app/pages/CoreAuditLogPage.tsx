/**
 * CoreAuditLogPage — Admin audit log viewer.
 * Mirrors old admin AdminAuditLog.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { History, Search, Eye, RefreshCcw } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function CoreAuditLogPage() {
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [selected, setSelected] = useState<any>(null);

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["core-audit-log", actionFilter],
    queryFn: async () => {
      let q = supabase
        .from("admin_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (actionFilter !== "all") q = q.eq("action", actionFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: activityLogs = [] } = useQuery({
    queryKey: ["core-activity-logs-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const allLogs = [
    ...logs.map((l: any) => ({ ...l, source: "admin_audit" })),
    ...activityLogs.map((l: any) => ({ ...l, source: "activity" })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 500);

  const filtered = allLogs.filter((l) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      l.action?.toLowerCase().includes(q) ||
      l.admin_email?.toLowerCase().includes(q) ||
      l.actor_email?.toLowerCase().includes(q) ||
      l.target_email?.toLowerCase().includes(q) ||
      l.entity_type?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-emerald-400" />
          <h1 className="text-lg font-semibold text-white">Journal d'audit</h1>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} className="border-[hsl(220,15%,20%)] text-[hsl(220,10%,60%)] hover:text-white">
          <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> Actualiser
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(220,10%,40%)]" />
          <Input
            placeholder="Rechercher par action, email, entité…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-white text-xs"
          />
        </div>
      </div>

      <div className="rounded-lg border border-[hsl(220,15%,16%)] overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-[hsl(220,15%,12%)]">
            <tr className="text-[hsl(220,10%,50%)]">
              <th className="text-left p-2.5 font-medium">Source</th>
              <th className="text-left p-2.5 font-medium">Action</th>
              <th className="text-left p-2.5 font-medium">Acteur</th>
              <th className="text-left p-2.5 font-medium">Cible</th>
              <th className="text-left p-2.5 font-medium">Date</th>
              <th className="text-right p-2.5 font-medium">Détails</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(220,15%,14%)]">
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-8 text-[hsl(220,10%,40%)]">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-[hsl(220,10%,40%)]">Aucun log</td></tr>
            ) : (
              filtered.slice(0, 200).map((log, idx) => (
                <tr key={`${log.id}-${idx}`} className="hover:bg-[hsl(220,15%,12%)]">
                  <td className="p-2.5">
                    <Badge variant="outline" className="text-[10px]">
                      {log.source === "admin_audit" ? "Admin" : "Activité"}
                    </Badge>
                  </td>
                  <td className="p-2.5 text-white font-medium">{log.action}</td>
                  <td className="p-2.5 text-[hsl(220,10%,70%)] font-mono text-[10px]">
                    {log.admin_email || log.actor_email || log.actor_name || "—"}
                  </td>
                  <td className="p-2.5 text-[hsl(220,10%,60%)]">
                    {log.target_email || log.entity_type || "—"}
                  </td>
                  <td className="p-2.5 text-[hsl(220,10%,50%)]">
                    {log.created_at ? format(new Date(log.created_at), "dd MMM HH:mm", { locale: fr }) : "—"}
                  </td>
                  <td className="p-2.5 text-right">
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => setSelected(log)}>
                      <Eye className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-white max-w-lg">
          <DialogHeader><DialogTitle className="text-sm">Détail audit</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-[hsl(220,10%,50%)]">Action :</span> <span className="text-white">{selected.action}</span></div>
                <div><span className="text-[hsl(220,10%,50%)]">Source :</span> <span className="text-white">{selected.source}</span></div>
              </div>
              {selected.details && (
                <div>
                  <span className="text-[hsl(220,10%,50%)]">Détails :</span>
                  <pre className="mt-1 bg-[hsl(220,15%,8%)] rounded p-2 overflow-auto max-h-[200px] text-[10px] text-emerald-300">
                    {JSON.stringify(selected.details, null, 2)}
                  </pre>
                </div>
              )}
              {selected.changed_field && (
                <div className="grid grid-cols-3 gap-2">
                  <div><span className="text-[hsl(220,10%,50%)]">Champ :</span> <span className="text-white">{selected.changed_field}</span></div>
                  <div><span className="text-[hsl(220,10%,50%)]">Ancien :</span> <span className="text-red-400">{selected.old_value || "—"}</span></div>
                  <div><span className="text-[hsl(220,10%,50%)]">Nouveau :</span> <span className="text-emerald-400">{selected.new_value || "—"}</span></div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
