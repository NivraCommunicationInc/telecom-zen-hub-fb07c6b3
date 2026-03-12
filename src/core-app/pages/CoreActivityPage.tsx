/**
 * CoreActivityPage — Transferred from AdminActivityLogs.tsx
 * Activity log viewer for all admin/staff actions
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Activity, User, Clock, FileText, Shield, AlertTriangle, Search, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const actionLabels: Record<string, string> = {
  create: "a créé", update: "a modifié", delete: "a supprimé",
  payment: "a traité un paiement sur", notification_resent: "a renvoyé une notification pour",
  technician_assigned: "a assigné un technicien à", status_change: "a changé le statut de",
  id_verification: "a vérifié l'identité pour",
};
const entityLabels: Record<string, string> = {
  order: "commande", invoice: "facture", client: "client", ticket: "ticket",
  technician: "technicien", appointment: "rendez-vous", billing: "facturation",
  subscription: "abonnement", promotion: "promotion",
};

export default function CoreActivityPage() {
  const [search, setSearch] = useState("");
  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["core-activity-logs"],
    queryFn: async () => {
      const res = await supabase.get("/rest/v1/activity_logs?select=*&order=created_at.desc&limit=200");
      return Array.isArray(res) ? res : [];
    },
  });

  const filtered = logs.filter((l: any) =>
    !search || [l.actor_name, l.actor_email, l.action, l.entity_type, l.entity_id]
      .filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Journal d'activité</h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">{logs.length} actions enregistrées</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 border-[hsl(220,15%,20%)] bg-transparent text-[hsl(var(--core-text-secondary))] hover:bg-[hsl(220,15%,14%)]">
          <RefreshCw className="w-3.5 h-3.5" /> Actualiser
        </Button>
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--core-text-label))]" />
        <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]" />
      </div>
      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center py-12 text-[hsl(var(--core-text-label))]">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-[hsl(var(--core-text-label))]">Aucune activité</div>
        ) : (
          filtered.map((log: any) => (
            <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
              <div className="h-8 w-8 rounded-full bg-emerald-600/15 flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[hsl(var(--core-text-primary))]">
                  <span className="font-medium">{log.actor_name || log.actor_email || "Système"}</span>{" "}
                  <span className="text-[hsl(var(--core-text-secondary))]">{actionLabels[log.action] || log.action}</span>{" "}
                  <span className="text-[hsl(var(--core-text-secondary))]">{entityLabels[log.entity_type] || log.entity_type}</span>
                  {log.entity_id && <span className="text-emerald-400 ml-1">#{log.entity_id.slice(0, 8)}</span>}
                </p>
                {log.reason && <p className="text-xs text-[hsl(var(--core-text-label))] mt-0.5">Raison: {log.reason}</p>}
                <p className="text-[11px] text-[hsl(var(--core-text-label))] mt-1">
                  {format(new Date(log.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                </p>
              </div>
              {log.actor_role && (
                <Badge className="bg-[hsl(220,15%,16%)] text-[hsl(var(--core-text-secondary))] border-0 text-[10px]">{log.actor_role}</Badge>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
