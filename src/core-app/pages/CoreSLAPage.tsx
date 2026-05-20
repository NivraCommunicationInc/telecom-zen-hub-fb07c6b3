/**
 * CoreSLAPage — SLA dashboard for Nivra Core.
 * Reads from employee_work_items (sla_status / sla_deadline_at).
 * Realtime invalidation + auto-refresh every 30s.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertTriangle, Clock, CheckCircle2, AlertOctagon, Timer, Loader2,
  UserCheck, Search, Download, ChevronLeft, ChevronRight, RefreshCw,
} from "lucide-react";
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

interface AgentOpt { user_id: string; full_name: string }

function frDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" });
}

function remaining(deadline: string | null) {
  if (!deadline) return { label: "—", tone: "muted" as const, hours: 0, breached: false };
  const ms = new Date(deadline).getTime() - Date.now();
  const absH = Math.floor(Math.abs(ms) / 3_600_000);
  const absM = Math.floor((Math.abs(ms) % 3_600_000) / 60_000);
  if (ms < 0) return { label: `DÉPASSÉ — ${absH}h${absM.toString().padStart(2, "0")} de retard`, tone: "red" as const, hours: absH, breached: true };
  if (absH < 24) return { label: `${absH}h${absM.toString().padStart(2, "0")} restantes`, tone: "orange" as const, hours: absH, breached: false };
  const days = Math.floor(absH / 24);
  return { label: `${days}j ${absH % 24}h`, tone: "green" as const, hours: absH, breached: false };
}

const statusLabels: Record<string, string> = {
  open: "Ouvert",
  assigned: "Assigné",
  in_progress: "En cours",
  escalated: "Escaladé",
  completed: "Complété",
};

const typeColors: Record<string, string> = {
  installation: "bg-blue-500/15 text-blue-600 border-blue-500/40",
  support: "bg-purple-500/15 text-purple-600 border-purple-500/40",
  rma: "bg-amber-500/15 text-amber-600 border-amber-500/40",
  resiliation: "bg-rose-500/15 text-rose-600 border-rose-500/40",
};

const PAGE_SIZE = 10;

export default function CoreSLAPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"all" | "on_time" | "at_risk" | "breached">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<WorkItem | null>(null);
  const [note, setNote] = useState("");
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalateReason, setEscalateReason] = useState("");
  const [escalateTo, setEscalateTo] = useState<string>("");
  const [reassignTo, setReassignTo] = useState<string>("");

  // Active items
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["core-sla-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_work_items")
        .select("id,item_type,source_id,source_reference,client_name,client_email,priority,assigned_to_id,assigned_to_name,status,notes,sla_status,sla_deadline_at,sla_breached_at,created_at,completed_at")
        .not("sla_deadline_at", "is", null)
        .in("status", ["open", "assigned", "in_progress", "escalated"])
        .order("sla_deadline_at", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data || []) as WorkItem[];
    },
    refetchInterval: 30_000,
  });

  // Resolved this month
  const { data: resolvedMonth = 0 } = useQuery({
    queryKey: ["core-sla-resolved-month"],
    queryFn: async () => {
      const start = new Date();
      start.setDate(1); start.setHours(0, 0, 0, 0);
      const { count, error } = await supabase
        .from("employee_work_items")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed")
        .gte("completed_at", start.toISOString());
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });

  // Agent list
  const { data: agents = [] } = useQuery({
    queryKey: ["core-sla-agents"],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("admin_list_staff_profiles");
      if (Array.isArray(data)) return data.map((d: any) => ({ user_id: d.user_id, full_name: d.full_name || d.email })) as AgentOpt[];
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").limit(200);
      return ((profs as any[]) || []).map((p) => ({ user_id: p.user_id, full_name: p.full_name || "—" })) as AgentOpt[];
    },
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("core-sla-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_work_items" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["core-sla-items"] });
          queryClient.invalidateQueries({ queryKey: ["core-sla-resolved-month"] });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  // Tick for countdowns
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const update = useMutation({
    mutationFn: async ({ item, patch, appendNote }: { item: WorkItem; patch: Record<string, any>; appendNote?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const finalPatch: Record<string, any> = { ...patch, updated_at: new Date().toISOString() };
      if (patch.status === "completed") finalPatch.completed_at = new Date().toISOString();
      if (appendNote && appendNote.trim()) {
        const stamp = new Date().toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" });
        finalPatch.notes = [item.notes, `[${stamp}] ${appendNote.trim()}`].filter(Boolean).join("\n");
      }
      const { error } = await supabase.from("employee_work_items").update(finalPatch).eq("id", item.id);
      if (error) throw error;
      // Queue email best-effort
      if (patch.status === "completed" && item.client_email) {
        await (supabase as any).rpc("enqueue_email", {
          p_purpose: "transactional",
          p_template: "complaint_resolved",
          p_to_email: item.client_email,
          p_variables: { reference: item.source_reference || item.id.slice(0, 8) },
        }).catch(() => null);
      }
      void user;
    },
    onSuccess: () => {
      toast.success("Mis à jour");
      queryClient.invalidateQueries({ queryKey: ["core-sla-items"] });
      queryClient.invalidateQueries({ queryKey: ["core-sla-resolved-month"] });
      setSelected(null); setNote(""); setEscalateOpen(false); setEscalateReason(""); setEscalateTo(""); setReassignTo("");
    },
    onError: (e: any) => toast.error(e?.message || "Erreur"),
  });

  // Stats
  const stats = useMemo(() => {
    const onTime = items.filter((i) => {
      const r = remaining(i.sla_deadline_at);
      return !r.breached && r.hours >= 24;
    }).length;
    const atRisk = items.filter((i) => {
      const r = remaining(i.sla_deadline_at);
      return !r.breached && r.hours < 24;
    }).length;
    const breached = items.filter((i) => remaining(i.sla_deadline_at).breached).length;
    return { total: items.length, onTime, atRisk, breached };
  }, [items]);

  // Filtered + paginated
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      const r = remaining(i.sla_deadline_at);
      if (tab === "on_time" && !(r.hours >= 24 && !r.breached)) return false;
      if (tab === "at_risk" && !(r.hours < 24 && !r.breached)) return false;
      if (tab === "breached" && !r.breached) return false;
      if (typeFilter !== "all" && (i.item_type || "").toLowerCase() !== typeFilter) return false;
      if (agentFilter !== "all" && i.assigned_to_id !== agentFilter) return false;
      if (dateFrom && new Date(i.created_at) < new Date(dateFrom)) return false;
      if (dateTo && new Date(i.created_at) > new Date(dateTo + "T23:59:59")) return false;
      if (q) {
        const hay = `${i.source_reference || ""} ${i.client_name || ""} ${i.client_email || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, tab, typeFilter, agentFilter, dateFrom, dateTo, search]);

  useEffect(() => { setPage(1); }, [tab, typeFilter, agentFilter, dateFrom, dateTo, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const exportCsv = () => {
    const head = ["Ticket", "Client", "Email", "Type", "Cree", "Deadline SLA", "Statut", "Assigne", "Resolu le"];
    const rows = filtered.map((i) => [
      i.source_reference || i.id.slice(0, 8),
      i.client_name || "",
      i.client_email || "",
      i.item_type,
      frDate(i.created_at),
      frDate(i.sla_deadline_at),
      statusLabels[i.status] || i.status,
      i.assigned_to_name || "",
      frDate(i.completed_at),
    ]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sla_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const tabs = [
    { k: "all", label: "Tous", n: stats.total, tone: "" },
    { k: "on_time", label: "Dans les délais", n: stats.onTime, tone: "text-emerald-600" },
    { k: "at_risk", label: "À risque", n: stats.atRisk, tone: "text-orange-600" },
    { k: "breached", label: "En retard", n: stats.breached, tone: "text-red-600" },
  ] as const;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Suivi SLA</h1>
          <p className="text-muted-foreground mt-1 text-sm">Surveillance temps réel des engagements de service · auto-refresh 30s</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["core-sla-items"] })}>
            <RefreshCw className="h-4 w-4 mr-2" /> Rafraîchir
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground flex items-center gap-2"><Timer className="w-4 h-4" /> Total actifs</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{stats.total}</div></CardContent>
        </Card>
        <Card className="border-emerald-500/30">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-emerald-600 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Dans les délais</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-emerald-600">{stats.onTime}</div></CardContent>
        </Card>
        <Card className="border-orange-500/30">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-orange-600 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> À risque (&lt;24h)</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-orange-600">{stats.atRisk}</div></CardContent>
        </Card>
        <Card className="border-red-500/30">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-red-600 flex items-center gap-2"><AlertOctagon className="w-4 h-4" /> En retard</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-red-600">{stats.breached}</div></CardContent>
        </Card>
        <Card className="border-primary/30">
          <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-primary flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Résolus ce mois</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-primary">{resolvedMonth}</div></CardContent>
        </Card>
      </div>

      {/* Tabs + filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => (
              <Button key={t.k} variant={tab === t.k ? "default" : "outline"} size="sm" onClick={() => setTab(t.k as any)}>
                <span className={tab === t.k ? "" : t.tone}>{t.label}</span>
                <Badge variant="secondary" className="ml-2">{t.n}</Badge>
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Recherche : ticket, nom, email…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                <SelectItem value="installation">Installation</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="rma">RMA</SelectItem>
                <SelectItem value="resiliation">Résiliation</SelectItem>
              </SelectContent>
            </Select>
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger><SelectValue placeholder="Assigné" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous agents</SelectItem>
                {agents.map((a) => <SelectItem key={a.user_id} value={a.user_id}>{a.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-1">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="text-xs" />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="text-xs" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-5 h-5" /> Tickets ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement…</div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-12">Aucun ticket selon les filtres.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Créé le</TableHead>
                    <TableHead>Délai SLA</TableHead>
                    <TableHead>Temps restant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Assigné à</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((it) => {
                    const r = remaining(it.sla_deadline_at);
                    const toneCls = r.tone === "red" ? "text-red-600 font-semibold animate-pulse" : r.tone === "orange" ? "text-orange-600 font-medium" : r.tone === "green" ? "text-emerald-600" : "";
                    const typeCls = typeColors[(it.item_type || "").toLowerCase()] || "bg-muted text-muted-foreground border-border";
                    return (
                      <TableRow key={it.id} className="cursor-pointer" onClick={() => setSelected(it)}>
                        <TableCell className="font-mono text-xs">{it.source_reference || `WI-${it.id.slice(0, 6).toUpperCase()}`}</TableCell>
                        <TableCell>
                          <div className="text-sm">{it.client_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{it.client_email || ""}</div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className={typeCls}>{it.item_type}</Badge></TableCell>
                        <TableCell className="text-xs">{frDate(it.created_at)}</TableCell>
                        <TableCell className="text-xs">{frDate(it.sla_deadline_at)}</TableCell>
                        <TableCell className={`text-xs ${toneCls}`}>{r.label}</TableCell>
                        <TableCell><Badge variant="outline">{statusLabels[it.status] || it.status}</Badge></TableCell>
                        <TableCell className="text-sm">{it.assigned_to_name || <span className="text-muted-foreground italic">non assigné</span>}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="outline" onClick={() => setSelected(it)}>Gérer</Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-4 text-sm">
                <span className="text-muted-foreground">Page {page} / {totalPages} · {filtered.length} ticket(s)</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail / actions dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setNote(""); setReassignTo(""); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détail SLA — {selected?.source_reference || selected?.id.slice(0, 8)}</DialogTitle>
          </DialogHeader>
          {selected && (() => {
            const r = remaining(selected.sla_deadline_at);
            const createdMs = new Date(selected.created_at).getTime();
            const deadlineMs = selected.sla_deadline_at ? new Date(selected.sla_deadline_at).getTime() : 0;
            const total = Math.max(1, deadlineMs - createdMs);
            const elapsed = Math.min(total, Date.now() - createdMs);
            const pct = Math.min(100, Math.round((elapsed / total) * 100));
            const barCls = r.breached ? "bg-red-500" : r.hours < 24 ? "bg-orange-500" : "bg-emerald-500";
            return (
              <div className="space-y-4">
                <div className="rounded-lg border p-3 text-sm space-y-1">
                  <div><strong>{selected.client_name || "Client non défini"}</strong> · {selected.client_email || "—"}</div>
                  <div className="text-muted-foreground">Type: {selected.item_type} · Priorité: {selected.priority} · Statut: {statusLabels[selected.status] || selected.status}</div>
                  <div className="text-muted-foreground">Assigné: {selected.assigned_to_name || "non assigné"}</div>
                  <div className="text-muted-foreground">Créé: {frDate(selected.created_at)} · Échéance: {frDate(selected.sla_deadline_at)}</div>
                </div>

                {/* SLA timeline */}
                <div>
                  <div className="text-xs uppercase text-muted-foreground mb-1">Chronologie SLA — {pct}% écoulé</div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full ${barCls} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>Créé {frDate(selected.created_at)}</span>
                    <span>Échéance {frDate(selected.sla_deadline_at)}</span>
                  </div>
                </div>

                {/* Notes / history */}
                {selected.notes && (
                  <div>
                    <div className="text-xs uppercase text-muted-foreground mb-1">Historique des notes</div>
                    <div className="rounded-md border bg-muted/30 p-2 text-xs whitespace-pre-wrap max-h-32 overflow-auto">{selected.notes}</div>
                  </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => update.mutate({ item: selected, patch: { status: "completed", sla_status: r.breached ? "breached" : "on_time" } })} disabled={update.isPending}>
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Résoudre
                  </Button>
                  <Button variant="outline" onClick={() => setEscalateOpen(true)}>
                    <AlertOctagon className="mr-2 h-4 w-4" /> Escalader
                  </Button>
                </div>

                {/* Reassign */}
                <div className="space-y-1">
                  <div className="text-xs uppercase text-muted-foreground">Réassigner</div>
                  <div className="flex gap-2">
                    <Select value={reassignTo} onValueChange={setReassignTo}>
                      <SelectTrigger><SelectValue placeholder="Choisir un agent…" /></SelectTrigger>
                      <SelectContent>
                        {agents.map((a) => <SelectItem key={a.user_id} value={a.user_id}>{a.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" disabled={!reassignTo || update.isPending} onClick={() => {
                      const ag = agents.find((a) => a.user_id === reassignTo);
                      update.mutate({ item: selected, patch: { assigned_to_id: reassignTo, assigned_to_name: ag?.full_name || "Agent", status: selected.status === "open" ? "assigned" : selected.status } });
                    }}><UserCheck className="mr-2 h-4 w-4" /> Réassigner</Button>
                  </div>
                </div>

                {/* Add note */}
                <div className="space-y-1">
                  <div className="text-xs uppercase text-muted-foreground">Ajouter une note</div>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Note interne…" />
                  <div className="flex justify-end">
                    <Button size="sm" disabled={!note.trim() || update.isPending} onClick={() => update.mutate({ item: selected, patch: {}, appendNote: note })}>
                      {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enregistrer la note
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Escalation dialog */}
      <Dialog open={escalateOpen} onOpenChange={setEscalateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Escalader le ticket</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs uppercase text-muted-foreground">Motif d'escalade</label>
              <Select value={escalateReason} onValueChange={setEscalateReason}>
                <SelectTrigger><SelectValue placeholder="Choisir un motif…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="delai_depasse">Délai dépassé</SelectItem>
                  <SelectItem value="client_urgent">Client urgent / VIP</SelectItem>
                  <SelectItem value="probleme_complexe">Problème complexe</SelectItem>
                  <SelectItem value="resource_manquante">Ressources manquantes</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs uppercase text-muted-foreground">Assigner à un agent senior</label>
              <Select value={escalateTo} onValueChange={setEscalateTo}>
                <SelectTrigger><SelectValue placeholder="Choisir un agent…" /></SelectTrigger>
                <SelectContent>
                  {agents.map((a) => <SelectItem key={a.user_id} value={a.user_id}>{a.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEscalateOpen(false)}>Annuler</Button>
            <Button disabled={!escalateReason || update.isPending} onClick={() => {
              if (!selected) return;
              const ag = agents.find((a) => a.user_id === escalateTo);
              update.mutate({
                item: selected,
                patch: {
                  status: "escalated",
                  priority: "urgent",
                  assigned_to_id: escalateTo || selected.assigned_to_id,
                  assigned_to_name: ag?.full_name || selected.assigned_to_name,
                },
                appendNote: `Escaladé — motif: ${escalateReason}${ag ? ` → ${ag.full_name}` : ""}`,
              });
            }}>Escalader</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
