/**
 * CoreAutomationPage — Order Automation Engine monitoring console.
 * Shows automation logs, subscription creation, equipment reservation, and installation job status.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Zap, Search, RefreshCw, Package, Wrench, FileText,
  CheckCircle2, AlertTriangle, Clock, ArrowRight
} from "lucide-react";
import { Link } from "react-router-dom";
import { corePath } from "@/core-app/lib/corePaths";

interface AutomationLog {
  id: string;
  order_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any>;
  created_at: string;
  order_number?: string | null;
}

const ACTION_META: Record<string, { label: string; icon: typeof Zap; color: string }> = {
  subscription_created: { label: "Abonnement créé", icon: FileText, color: "text-emerald-400" },
  equipment_reserved: { label: "Équipement réservé", icon: Package, color: "text-blue-400" },
  installation_job_created: { label: "Job installation créé", icon: Wrench, color: "text-amber-400" },
};

export default function CoreAutomationPage() {
  const [search, setSearch] = useState("");

  const { data: logs = [], isLoading, refetch } = useQuery<AutomationLog[]>({
    queryKey: ["order-automation-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_automation_log")
        .select("id, order_id, action, entity_type, entity_id, details, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      if (!data?.length) return [];

      // Join order_number
      const orderIds = [...new Set(data.map(l => l.order_id))];
      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_number")
        .in("id", orderIds);
      const orderMap = new Map((orders || []).map(o => [o.id, o.order_number]));

      return data.map(l => ({
        ...l,
        details: (l.details as Record<string, any>) || {},
        order_number: orderMap.get(l.order_id) ?? null,
      }));
    },
  });

  // KPIs
  const subCount = logs.filter(l => l.action === "subscription_created").length;
  const equipCount = logs.filter(l => l.action === "equipment_reserved").length;
  const jobCount = logs.filter(l => l.action === "installation_job_created").length;

  const filtered = search
    ? logs.filter(l =>
        l.order_number?.toLowerCase().includes(search.toLowerCase()) ||
        l.action.toLowerCase().includes(search.toLowerCase()) ||
        JSON.stringify(l.details).toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10">
            <Zap className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Moteur d'automatisation</h1>
            <p className="text-xs text-muted-foreground">
              Suivi des actions automatiques déclenchées à la confirmation des commandes
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Rafraîchir
        </Button>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Abonnements créés", count: subCount, icon: FileText, color: "text-emerald-400 bg-emerald-500/10" },
          { label: "Équipements réservés", count: equipCount, icon: Package, color: "text-blue-400 bg-blue-500/10" },
          { label: "Jobs installation", count: jobCount, icon: Wrench, color: "text-amber-400 bg-amber-500/10" },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${kpi.color.split(" ")[1]}`}>
              <kpi.icon className={`h-4 w-4 ${kpi.color.split(" ")[0]}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{kpi.count}</p>
              <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Rechercher par commande, action…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9 text-xs bg-card border-border"
        />
      </div>

      {/* Log Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-2.5 text-left text-muted-foreground font-medium">Date</th>
              <th className="px-4 py-2.5 text-left text-muted-foreground font-medium">Commande</th>
              <th className="px-4 py-2.5 text-left text-muted-foreground font-medium">Action</th>
              <th className="px-4 py-2.5 text-left text-muted-foreground font-medium">Détails</th>
              <th className="px-4 py-2.5 text-right text-muted-foreground font-medium">Lien</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12">
                  <Clock className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">Aucune action automatique enregistrée</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Les actions apparaîtront lorsqu'une commande passera au statut « confirmé »
                  </p>
                </td>
              </tr>
            ) : (
              filtered.map(log => {
                const meta = ACTION_META[log.action] || { label: log.action, icon: Zap, color: "text-muted-foreground" };
                const Icon = meta.icon;
                return (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        to={corePath(`/orders/${log.order_id}`)}
                        className="text-primary hover:underline font-mono"
                      >
                        {log.order_number || log.order_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 ${meta.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground max-w-[300px] truncate">
                      {log.details.category && <Badge variant="outline" className="mr-1 text-[10px]">{log.details.category}</Badge>}
                      {log.details.service_type && <span>{log.details.service_type}</span>}
                      {log.details.plan_name && <span className="ml-1">— {log.details.plan_name}</span>}
                      {log.details.monthly_price != null && <span className="ml-1 text-emerald-400">{Number(log.details.monthly_price).toFixed(2)} $</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {log.entity_type === "subscription" && log.entity_id && (
                        <Link to={corePath(`/subscriptions/${log.entity_id}`)} className="text-primary hover:underline inline-flex items-center gap-1">
                          Voir <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                      {log.entity_type === "installation_job" && log.entity_id && (
                        <Link to={corePath("/installations")} className="text-primary hover:underline inline-flex items-center gap-1">
                          Voir <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                      {log.entity_type === "equipment_inventory" && log.entity_id && (
                        <Link to={corePath("/equipment")} className="text-primary hover:underline inline-flex items-center gap-1">
                          Voir <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
