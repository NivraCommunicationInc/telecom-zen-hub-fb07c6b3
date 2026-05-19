/**
 * CoreSLAPage — Feature 4: SLA dashboard for Nivra Core.
 * Reads from employee_work_items (sla_status / sla_deadline_at).
 * Realtime invalidation on table changes; auto-refresh every 30s.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Clock, CheckCircle2, AlertOctagon, Timer, Loader2, UserCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface WorkItem {
  id: string;
  item_type: string;
  source_id: string;
  source_reference: string | null;
  client_email: string | null;
  client_name: string | null;
  priority: string;
  assigned_to_id: string | null;
  assigned_to_name: string | null;
  status: string;
  notes: string | null;
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

const statusLabels: Record<string, string> = {
  open: "Ouvert",
  assigned: "Assigné",
  in_progress: "En cours",
  escalated: "Escaladé",
  completed: "Complété",
};

export default function CoreSLAPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("active");
  const [slaFilter, setSlaFilter] = useState("all");
  const [selected, setSelected] = useState<WorkItem | null>(null);
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["core-sla-items", statusFilter, slaFilter],
    queryFn: async () => {
      let q = supabase
        .from("employee_work_items")
        .select("id,item_type,source_id,source_reference,client_name,client_email,priority,assigned_to_id,assigned_to_name,status,notes,sla_status,sla_deadline_at,sla_breached_at,created_at,completed_at")
        .not("sla_deadline_at", "is", null)
        .order("sla_deadline_at", { ascending: true })
        .limit(500);
      if (statusFilter === "active") q = q.in("status", ["open", "assigned", "in_progress", "escalated"]);
      else if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (slaFilter !== "all") q = q.eq("sla_status", slaFilter);
      const { data, error } = await q;
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

  const updateItem = useMutation({
    mutationFn: async ({ item, patch }: { item: WorkItem; patch: Record<string, any> }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = user
        ? await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle()
        : { data: null };
      const finalPatch: Record<string, any> = { ...patch, updated_at: new Date().toISOString() };
      if (patch.status === "assigned" || patch.status === "in_progress") {
        finalPatch.assigned_to_id = user?.id ?? item.assigned_to_id;
        finalPatch.assigned_to_name = profile?.full_name ?? user?.email ?? item.assigned_to_name ?? "Core";
      }
      if (patch.status === "completed") finalPatch.completed_at = new Date().toISOString();
      const { error } = await supabase.from("employee_work_items").update(finalPatch).eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("SLA mis à jour");
      queryClient.invalidateQueries({ queryKey: ["core-sla-items"] });
      setSelected(null);
      setNote("");
    },
    onError: (e: any) => toast.error(e?.message || "Erreur SLA"),
  });

  const appendNote = () => {
    if (!selected || !note.trim()) return;
    const stamp = new Date().toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" });
    updateItem.mutate({ item: selected, patch: { notes: [selected.notes, `[${stamp}] ${note.trim()}`].filter(Boolean).join("\n") } });
  };

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

      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="open">Ouverts</SelectItem>
                <SelectItem value="assigned">Assignés</SelectItem>
                <SelectItem value="in_progress">En cours</SelectItem>
                <SelectItem value="escalated">Escaladés</SelectItem>
                <SelectItem value="completed">Complétés</SelectItem>
              </SelectContent>
            </Select>
            <Select value={slaFilter} onValueChange={setSlaFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous SLA</SelectItem>
                <SelectItem value="breached">Dépassés</SelectItem>
                <SelectItem value="at_risk">À risque</SelectItem>
                <SelectItem value="on_time">À temps</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["core-sla-items"] })}>Rafraîchir</Button>
        </CardContent>
      </Card>

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
                    <TableHead>Priorité</TableHead>
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
                        <TableCell><div>{it.client_name || "—"}</div><div className="text-xs text-muted-foreground">{it.client_email || ""}</div></TableCell>
                        <TableCell><Badge variant="outline">{it.priority}</Badge></TableCell>
                        <TableCell className="text-xs">{frDate(it.sla_deadline_at)}</TableCell>
                        <TableCell className={tr.breached ? "text-red-600 font-semibold" : ""}>
                          {tr.label}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1"><Badge variant="outline" className={badgeColor}>{badgeLabel}</Badge><span className="text-xs text-muted-foreground">{statusLabels[it.status] || it.status}</span></div>
                        </TableCell>
                        <TableCell className="space-x-1 whitespace-nowrap">
                          <Link to={`/core/work-queue?item=${it.id}`}>
                            <Button variant="ghost" size="sm">Ouvrir</Button>
                          </Link>
                          <Button variant="outline" size="sm" onClick={() => setSelected(it)}>Gérer</Button>
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
