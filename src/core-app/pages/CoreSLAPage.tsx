/**
 * CoreSLAPage — Feature 4: SLA dashboard for Nivra Core.
 * Reads from employee_work_items (sla_status / sla_deadline_at).
 * Realtime invalidation on table changes; auto-refresh every 30s.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Clock, CheckCircle2, AlertOctagon, Timer } from "lucide-react";
import { Link } from "react-router-dom";

interface WorkItem {
  id: string;
  item_type: string;
  source_reference: string | null;
  client_name: string | null;
  assigned_to_name: string | null;
  status: string;
  sla_status: "on_time" | "at_risk" | "breached" | null;
  sla_deadline_at: string | null;
  sla_breached_at: string | null;
  created_at: string;
  completed_at: string | null;
}

function frDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" });
}

function timeRemaining(deadline: string | null): { label: string; breached: boolean; hours: number } {
  if (!deadline) return { label: "—", breached: false, hours: 0 };
  const ms = new Date(deadline).getTime() - Date.now();
  const hours = Math.floor(Math.abs(ms) / 3_600_000);
  const mins = Math.floor((Math.abs(ms) % 3_600_000) / 60_000);
  if (ms < 0) return { label: `DÉPASSÉ ${hours}h${mins.toString().padStart(2, "0")}`, breached: true, hours };
  return { label: `${hours}h${mins.toString().padStart(2, "0")}`, breached: false, hours };
}

export default function CoreSLAPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["core-sla-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_work_items")
        .select("id,item_type,source_reference,client_name,assigned_to_name,status,sla_status,sla_deadline_at,sla_breached_at,created_at,completed_at")
        .not("sla_deadline_at", "is", null)
        .not("status", "in", '("completed","cancelled")')
        .order("sla_deadline_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data || []) as WorkItem[];
    },
    refetchInterval: 30_000,
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("core-sla-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_work_items" },
        () => queryClient.invalidateQueries({ queryKey: ["core-sla-items"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  const stats = useMemo(() => {
    const items = data || [];
    const onTime = items.filter((i) => i.sla_status === "on_time").length;
    const atRisk = items.filter((i) => i.sla_status === "at_risk").length;
    const breached = items.filter((i) => i.sla_status === "breached").length;

    // Avg resolution: from completed items in last 30d
    return {
      total: items.length,
      onTime,
      atRisk,
      breached,
    };
  }, [data]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Suivi SLA</h1>
        <p className="text-muted-foreground mt-1">
          Surveillance en temps réel des engagements de service.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Timer className="w-4 h-4" /> Total actifs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="border-emerald-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-600 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Dans les temps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-600">{stats.onTime}</div>
          </CardContent>
        </Card>
        <Card className="border-orange-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-600 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Bientôt
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{stats.atRisk}</div>
          </CardContent>
        </Card>
        <Card className="border-red-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
              <AlertOctagon className="w-4 h-4" /> Dépassés
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.breached}</div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Éléments avec SLA actif
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Chargement…</p>
          ) : (data || []).length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucun élément avec SLA actif.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Assigné</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead>Restant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data || []).map((it) => {
                    const tr = timeRemaining(it.sla_deadline_at);
                    const status = it.sla_status || "on_time";
                    const badgeColor =
                      status === "breached" ? "bg-red-500/15 text-red-600 border-red-500/40"
                      : status === "at_risk" ? "bg-orange-500/15 text-orange-600 border-orange-500/40"
                      : "bg-emerald-500/15 text-emerald-600 border-emerald-500/40";
                    const badgeLabel =
                      status === "breached" ? "🚨 DÉPASSÉ"
                      : status === "at_risk" ? "⚠️ Bientôt"
                      : "À temps";
                    return (
                      <TableRow key={it.id}>
                        <TableCell className="font-medium uppercase text-xs">{it.item_type}</TableCell>
                        <TableCell className="font-mono text-xs">{it.source_reference || "—"}</TableCell>
                        <TableCell>{it.assigned_to_name || "(non assigné)"}</TableCell>
                        <TableCell>{it.client_name || "—"}</TableCell>
                        <TableCell className="text-xs">{frDate(it.sla_deadline_at)}</TableCell>
                        <TableCell className={tr.breached ? "text-red-600 font-semibold" : ""}>
                          {tr.label}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={badgeColor}>{badgeLabel}</Badge>
                        </TableCell>
                        <TableCell>
                          <Link to={`/core/work-queue?item=${it.id}`}>
                            <Button variant="ghost" size="sm">Ouvrir</Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
