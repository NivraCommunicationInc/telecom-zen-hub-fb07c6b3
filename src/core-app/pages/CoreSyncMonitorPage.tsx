/**
 * CoreSyncMonitorPage — Agent 10 dashboard.
 * Reads from sync_audit_log: stats bar, tabs, table, detail drawer, 30-day chart.
 * Admin-only (route already gated by CoreProtectedRoute).
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { getInvokeErrorMessage } from "@/lib/functionsInvokeError";

interface SyncRow {
  id: string;
  sync_type: string;
  source_portal: string | null;
  record_id: string;
  record_reference: string | null;
  sync_status: "ok" | "warning" | "missing_data" | "error" | "fixed";
  issues_found: Array<{ code: string; severity: string; detail: string }>;
  auto_fixed: boolean;
  fix_description: string | null;
  requires_manual_review: boolean;
  checked_at: string;
  created_at: string;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ok: "secondary",
  warning: "default",
  missing_data: "outline",
  error: "destructive",
  fixed: "secondary",
};

const TYPE_LABEL: Record<string, string> = {
  order: "Commande",
  ticket: "Ticket",
  complaint: "Plainte",
  plan_change: "Changement",
  suspension: "Suspension",
  cancellation: "Annulation",
  crm_sale: "Vente CRM",
  profile: "Profil",
};

export default function CoreSyncMonitorPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>("all");
  const [selected, setSelected] = useState<SyncRow | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["sync-audit-log"],
    refetchInterval: 30 * 60_000,
    queryFn: async (): Promise<SyncRow[]> => {
      const { data, error } = await supabase
        .from("sync_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as SyncRow[];
    },
  });

  const runScan = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("agent-sync", { body: {} });
      if (error) throw new Error(await getInvokeErrorMessage(error));
    },
    onSuccess: () => {
      toast.success("Vérification de synchronisation lancée.");
      setTimeout(() => qc.invalidateQueries({ queryKey: ["sync-audit-log"] }), 2500);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const today = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return rows.filter((r) => new Date(r.created_at) >= start);
  }, [rows]);

  const stats = useMemo(() => ({
    today: today.length,
    issues: today.filter((r) => r.sync_status !== "ok" && r.sync_status !== "fixed").length,
    fixed: today.filter((r) => r.auto_fixed).length,
    manual: today.filter((r) => r.requires_manual_review).length,
  }), [today]);

  const filtered = useMemo(() => {
    if (tab === "all") return rows;
    return rows.filter((r) => {
      if (tab === "orders") return r.sync_type === "order";
      if (tab === "complaints") return r.sync_type === "complaint";
      if (tab === "profiles") return r.sync_type === "profile";
      if (tab === "crm") return r.sync_type === "crm_sale";
      if (tab === "suspensions") return r.sync_type === "suspension" || r.sync_type === "cancellation";
      return true;
    });
  }, [rows, tab]);

  const chartData = useMemo(() => {
    const buckets: Record<string, { date: string; issues: number; fixed: number }> = {};
    const now = Date.now();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86_400_000);
      const k = d.toISOString().slice(0, 10);
      buckets[k] = { date: k.slice(5), issues: 0, fixed: 0 };
    }
    for (const r of rows) {
      const k = new Date(r.created_at).toISOString().slice(0, 10);
      if (!buckets[k]) continue;
      if (r.auto_fixed) buckets[k].fixed++;
      if (r.sync_status !== "ok") buckets[k].issues++;
    }
    return Object.values(buckets);
  }, [rows]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-primary" /> Sync Monitor
          </h1>
          <p className="text-sm text-muted-foreground">Agent 10 — Synchronisation cross-portail.</p>
        </div>
        <Button onClick={() => runScan.mutate()} disabled={runScan.isPending}>
          {runScan.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Lancer une vérification
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Vérifications aujourd'hui</p>
          <p className="text-2xl font-bold">{stats.today}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Problèmes détectés</p>
          <p className="text-2xl font-bold text-destructive">{stats.issues}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Auto-corrigés</p>
          <p className="text-2xl font-bold text-primary">{stats.fixed}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <p className="text-xs text-muted-foreground">Révision manuelle</p>
          <p className="text-2xl font-bold">{stats.manual}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Historique (30 derniers jours)</CardTitle></CardHeader>
        <CardContent style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Bar dataKey="issues" fill="hsl(var(--destructive))" name="Problèmes" />
              <Bar dataKey="fixed" fill="hsl(var(--primary))" name="Corrigés" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="all">Tous</TabsTrigger>
              <TabsTrigger value="orders">Commandes</TabsTrigger>
              <TabsTrigger value="complaints">Plaintes</TabsTrigger>
              <TabsTrigger value="profiles">Profils</TabsTrigger>
              <TabsTrigger value="crm">CRM</TabsTrigger>
              <TabsTrigger value="suspensions">Suspensions</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucune entrée.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Portail</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Problèmes</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 200).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell><Badge variant="outline">{TYPE_LABEL[r.sync_type] ?? r.sync_type}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{r.source_portal ?? "—"}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{r.record_reference ?? r.record_id.slice(0, 8)}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-wrap gap-1">
                        {r.issues_found.slice(0, 3).map((i, idx) => (
                          <Badge key={idx} variant="outline" className="text-[10px]">{i.code}</Badge>
                        ))}
                        {r.issues_found.length > 3 && <span className="text-muted-foreground">+{r.issues_found.length - 3}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={STATUS_VARIANT[r.sync_status] ?? "outline"}>{r.sync_status}</Badge>
                        {r.auto_fixed && <Badge variant="secondary" className="text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" />auto</Badge>}
                        {r.requires_manual_review && <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />manuel</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("fr-CA")}</TableCell>
                    <TableCell><Button size="sm" variant="outline" onClick={() => setSelected(r)}>Voir</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader><SheetTitle>Détail de la vérification</SheetTitle></SheetHeader>
          {selected && (
            <div className="space-y-4 mt-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-xs text-muted-foreground">Type</p><p>{TYPE_LABEL[selected.sync_type] ?? selected.sync_type}</p></div>
                <div><p className="text-xs text-muted-foreground">Portail</p><p>{selected.source_portal ?? "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Référence</p><p className="font-mono text-xs">{selected.record_reference ?? "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Statut</p><Badge variant={STATUS_VARIANT[selected.sync_status]}>{selected.sync_status}</Badge></div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-2">Problèmes trouvés ({selected.issues_found.length})</p>
                <ul className="space-y-2">
                  {selected.issues_found.map((i, idx) => (
                    <li key={idx} className="border rounded p-2">
                      <div className="flex items-center justify-between">
                        <code className="text-xs">{i.code}</code>
                        <Badge variant={i.severity === "critical" ? "destructive" : i.severity === "warning" ? "default" : "outline"}>{i.severity}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{i.detail}</p>
                    </li>
                  ))}
                </ul>
              </div>
              {selected.auto_fixed && (
                <div className="border border-primary/30 bg-primary/5 rounded p-3">
                  <p className="text-xs font-medium text-primary mb-1">Correction automatique appliquée</p>
                  <p className="text-xs">{selected.fix_description}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">ID enregistrement</p>
                <code className="text-xs">{selected.record_id}</code>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
