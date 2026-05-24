/**
 * CoreAcademyPage — Nivra Academy admin console.
 * Tabs: Vue d'ensemble · Modules · Leçons · Quiz · Simulations IA · Whitelist · Agents
 * Full CRUD on training content. Admin-only (RLS enforced server-side).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  GraduationCap, Trophy, Users, BookOpen, Loader2, Plus, Pencil, Trash2,
  ShieldCheck, Sparkles, MessageSquare, FileText, LayoutDashboard,
  AlertTriangle, CheckCircle2, Clock, XCircle, TrendingUp, Search, Download,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/* ============================================================
 *  ROOT
 * ============================================================ */
export default function CoreAcademyPage() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <header className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5"><GraduationCap className="h-6 w-6 text-primary" /></div>
        <div>
          <h1 className="text-2xl font-bold">Nivra Academy — Admin</h1>
          <p className="text-sm text-muted-foreground">Gestion centralisée de la formation Field + OneView CS</p>
        </div>
      </header>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="dashboard"><LayoutDashboard className="h-4 w-4 mr-1.5" />Tableau de bord</TabsTrigger>
          <TabsTrigger value="overview"><BookOpen className="h-4 w-4 mr-1.5" />Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="modules"><FileText className="h-4 w-4 mr-1.5" />Modules</TabsTrigger>
          <TabsTrigger value="lessons">Leçons</TabsTrigger>
          <TabsTrigger value="quiz">Quiz</TabsTrigger>
          <TabsTrigger value="simulations"><Sparkles className="h-4 w-4 mr-1.5" />Simulations IA</TabsTrigger>
          <TabsTrigger value="whitelist"><ShieldCheck className="h-4 w-4 mr-1.5" />Whitelist</TabsTrigger>
          <TabsTrigger value="agents"><Users className="h-4 w-4 mr-1.5" />Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard"><ManagerDashboard /></TabsContent>
        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="modules"><ModulesTab /></TabsContent>
        <TabsContent value="lessons"><LessonsTab /></TabsContent>
        <TabsContent value="quiz"><QuizTab /></TabsContent>
        <TabsContent value="simulations"><SimulationsTab /></TabsContent>
        <TabsContent value="whitelist"><WhitelistTab /></TabsContent>
        <TabsContent value="agents"><AgentsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================================================
 *  MANAGER DASHBOARD — Vue manager RH: qui est en retard / expiré
 * ============================================================ */
type AgentRow = {
  agent_id: string;
  name: string;
  email: string | null;
  portal: "field" | "cs" | "both" | "none";
  modules_total: number;
  modules_done: number;
  modules_in_progress: number;
  modules_failed: number;
  avg_score: number;
  last_activity: string | null;
  cert_status: "valid" | "expiring_soon" | "expired" | "none";
  cert_expires_at: string | null;
  last_exam_passed: boolean | null;
  last_exam_at: string | null;
};

function ManagerDashboard() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [portalFilter, setPortalFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["academy-manager-dashboard"],
    queryFn: async (): Promise<AgentRow[]> => {
      // Pull whitelist + roles for portal scoping
      const [{ data: modules }, { data: progress }, { data: certs }, { data: attempts }, { data: profiles }] = await Promise.all([
        supabase.from("training_modules").select("id, portal, is_mandatory, is_active"),
        supabase.from("training_progress").select("agent_id, module_id, status, score, completed_at, started_at"),
        supabase.from("training_certifications").select("agent_id, portal, expires_at, is_active, issued_at").eq("is_active", true),
        supabase.from("training_exam_attempts").select("agent_id, portal, passed, submitted_at, status").eq("status", "submitted").order("submitted_at", { ascending: false }),
        supabase.from("profiles").select("user_id, full_name, email"),
      ]);

      const mandatoryByPortal = {
        field: (modules || []).filter((m: any) => m.is_active && m.is_mandatory && (m.portal === "field" || m.portal === "both")).map((m: any) => m.id),
        cs: (modules || []).filter((m: any) => m.is_active && m.is_mandatory && (m.portal === "cs" || m.portal === "both")).map((m: any) => m.id),
      };

      const agentIds = new Set<string>();
      (progress || []).forEach((p: any) => agentIds.add(p.agent_id));
      (certs || []).forEach((c: any) => agentIds.add(c.agent_id));
      (attempts || []).forEach((a: any) => agentIds.add(a.agent_id));

      const profMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const now = Date.now();
      const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

      return Array.from(agentIds).map((id) => {
        const agentProgress = (progress || []).filter((p: any) => p.agent_id === id);
        const agentCert = (certs || []).find((c: any) => c.agent_id === id);
        const agentExam = (attempts || []).find((a: any) => a.agent_id === id);
        const portal: AgentRow["portal"] = agentCert?.portal as any || (agentExam?.portal as any) || "none";

        const relevantModules = portal === "field" ? mandatoryByPortal.field
          : portal === "cs" ? mandatoryByPortal.cs
          : [...new Set([...mandatoryByPortal.field, ...mandatoryByPortal.cs])];

        const modProgress = agentProgress.filter((p: any) => relevantModules.includes(p.module_id));
        const done = modProgress.filter((p: any) => p.status === "completed").length;
        const inProg = modProgress.filter((p: any) => p.status === "in_progress").length;
        const failed = modProgress.filter((p: any) => p.status === "failed").length;
        const scores = modProgress.filter((p: any) => p.score > 0).map((p: any) => p.score);
        const avgScore = scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : 0;

        const lastActivityDate = modProgress
          .map((p: any) => p.completed_at || p.started_at)
          .filter(Boolean)
          .sort()
          .pop() || null;

        let certStatus: AgentRow["cert_status"] = "none";
        if (agentCert) {
          if (!agentCert.expires_at) certStatus = "valid";
          else {
            const expMs = new Date(agentCert.expires_at).getTime();
            if (expMs < now) certStatus = "expired";
            else if (expMs - now < THIRTY_DAYS) certStatus = "expiring_soon";
            else certStatus = "valid";
          }
        }

        const prof = profMap.get(id) as any;
        return {
          agent_id: id,
          name: prof?.full_name || "Agent",
          email: prof?.email || null,
          portal,
          modules_total: relevantModules.length,
          modules_done: done,
          modules_in_progress: inProg,
          modules_failed: failed,
          avg_score: avgScore,
          last_activity: lastActivityDate,
          cert_status: certStatus,
          cert_expires_at: agentCert?.expires_at || null,
          last_exam_passed: agentExam?.passed ?? null,
          last_exam_at: agentExam?.submitted_at || null,
        } as AgentRow;
      }).sort((a, b) => {
        // Surface problems first: expired > expiring > in_progress > valid
        const rank = { expired: 0, expiring_soon: 1, none: 2, valid: 3 } as any;
        return rank[a.cert_status] - rank[b.cert_status];
      });
    },
  });

  const filtered = (data || []).filter((r) => {
    if (statusFilter !== "all" && r.cert_status !== statusFilter) return false;
    if (portalFilter !== "all" && r.portal !== portalFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.name.toLowerCase().includes(q) && !(r.email || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const stats = {
    total: data?.length || 0,
    certified: data?.filter((r) => r.cert_status === "valid").length || 0,
    expiring: data?.filter((r) => r.cert_status === "expiring_soon").length || 0,
    expired: data?.filter((r) => r.cert_status === "expired").length || 0,
    in_progress: data?.filter((r) => r.modules_in_progress > 0 && r.cert_status === "none").length || 0,
    failed: data?.filter((r) => r.modules_failed > 0).length || 0,
  };

  const exportCsv = () => {
    const headers = ["Nom", "Email", "Portail", "Modules", "Complétés", "En cours", "Échecs", "Score moyen", "Certification", "Expire le", "Dernière activité"];
    const rows = filtered.map((r) => [
      r.name, r.email || "", r.portal,
      r.modules_total, r.modules_done, r.modules_in_progress, r.modules_failed,
      r.avg_score + "%", r.cert_status,
      r.cert_expires_at ? new Date(r.cert_expires_at).toLocaleDateString("fr-CA") : "",
      r.last_activity ? new Date(r.last_activity).toLocaleDateString("fr-CA") : "",
    ]);
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `academy-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <Spin />;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-6">
        <KpiCard icon={Users} label="Total agents" value={stats.total} tone="neutral" />
        <KpiCard icon={CheckCircle2} label="Certifiés" value={stats.certified} tone="success" />
        <KpiCard icon={Clock} label="Expire <30j" value={stats.expiring} tone="warning" />
        <KpiCard icon={XCircle} label="Expirés" value={stats.expired} tone="danger" />
        <KpiCard icon={TrendingUp} label="En formation" value={stats.in_progress} tone="info" />
        <KpiCard icon={AlertTriangle} label="Avec échec" value={stats.failed} tone="danger" />
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base">Suivi des agents ({filtered.length})</CardTitle>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom ou email..." className="pl-8 w-56" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes certifications</SelectItem>
                <SelectItem value="valid">Valide</SelectItem>
                <SelectItem value="expiring_soon">Expire bientôt</SelectItem>
                <SelectItem value="expired">Expirée</SelectItem>
                <SelectItem value="none">Aucune</SelectItem>
              </SelectContent>
            </Select>
            <Select value={portalFilter} onValueChange={setPortalFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous portails</SelectItem>
                <SelectItem value="field">Field</SelectItem>
                <SelectItem value="cs">OneView CS</SelectItem>
                <SelectItem value="none">Non assigné</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1.5" />Export CSV</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Portail</TableHead>
                  <TableHead>Progression</TableHead>
                  <TableHead>Score moy.</TableHead>
                  <TableHead>Certification</TableHead>
                  <TableHead>Expire le</TableHead>
                  <TableHead>Dernière activité</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">Aucun agent.</TableCell></TableRow>
                )}
                {filtered.map((r) => {
                  const pct = r.modules_total > 0 ? Math.round((r.modules_done / r.modules_total) * 100) : 0;
                  return (
                    <TableRow key={r.agent_id}>
                      <TableCell>
                        <div className="font-medium">{r.name}</div>
                        {r.email && <div className="text-xs text-muted-foreground">{r.email}</div>}
                      </TableCell>
                      <TableCell><Badge variant="outline" className="uppercase text-[10px]">{r.portal}</Badge></TableCell>
                      <TableCell className="min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{r.modules_done}/{r.modules_total}</span>
                        </div>
                        {(r.modules_in_progress > 0 || r.modules_failed > 0) && (
                          <div className="flex gap-1.5 mt-1">
                            {r.modules_in_progress > 0 && <span className="text-[10px] text-sky-600">{r.modules_in_progress} en cours</span>}
                            {r.modules_failed > 0 && <span className="text-[10px] text-red-600">{r.modules_failed} échec</span>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums">{r.avg_score}%</TableCell>
                      <TableCell><CertBadge status={r.cert_status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.cert_expires_at ? new Date(r.cert_expires_at).toLocaleDateString("fr-CA") : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.last_activity ? new Date(r.last_activity).toLocaleDateString("fr-CA") : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: "neutral" | "success" | "warning" | "danger" | "info" }) {
  const tones: Record<string, string> = {
    neutral: "bg-muted text-foreground",
    success: "bg-emerald-500/15 text-emerald-600",
    warning: "bg-amber-500/15 text-amber-600",
    danger: "bg-red-500/15 text-red-600",
    info: "bg-sky-500/15 text-sky-600",
  };
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-2.5">
        <div className={`rounded-lg p-2 ${tones[tone]}`}><Icon className="h-4 w-4" /></div>
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground leading-none">{label}</p>
          <p className="text-xl font-bold tabular-nums mt-0.5">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CertBadge({ status }: { status: AgentRow["cert_status"] }) {
  const map = {
    valid: { label: "Valide", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/25" },
    expiring_soon: { label: "Expire <30j", className: "bg-amber-500/15 text-amber-600 border-amber-500/25" },
    expired: { label: "Expirée", className: "bg-red-500/15 text-red-600 border-red-500/25" },
    none: { label: "Aucune", className: "bg-muted text-muted-foreground border-border" },
  }[status];
  return <Badge variant="outline" className={map.className}>{map.label}</Badge>;
}

/* ============================================================
 *  OVERVIEW
 * ============================================================ */
function OverviewTab() {
  const { data: modules } = useQuery({
    queryKey: ["academy-modules-overview"],
    queryFn: async () => (await supabase.from("training_modules").select("id").eq("is_active", true)).data || [],
  });
  const { data: agents } = useQuery({
    queryKey: ["academy-agents-overview"],
    queryFn: async () => {
      const { data: progress } = await supabase.from("training_progress").select("agent_id, status");
      const { data: certs } = await supabase.from("training_certifications").select("agent_id").eq("is_active", true);
      const total = new Set((progress || []).map((p: any) => p.agent_id));
      return { total: total.size, certified: certs?.length || 0 };
    },
  });

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <StatCard icon={Users} label="Agents en formation" value={agents?.total || 0} />
      <StatCard icon={Trophy} label="Agents certifiés" value={agents?.certified || 0} accent />
      <StatCard icon={BookOpen} label="Modules actifs" value={modules?.length || 0} />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: any) {
  return (
    <Card className={accent ? "border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/10" : ""}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`rounded-lg p-2.5 ${accent ? "bg-amber-500/15" : "bg-primary/10"}`}>
          <Icon className={`h-5 w-5 ${accent ? "text-amber-600" : "text-primary"}`} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============================================================
 *  MODULES
 * ============================================================ */
function ModulesTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);

  const { data: modules, isLoading } = useQuery({
    queryKey: ["academy-modules-edit"],
    queryFn: async () => (await supabase.from("training_modules").select("*").order("order_index")).data || [],
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_modules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Module supprimé"); qc.invalidateQueries({ queryKey: ["academy-modules-edit"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Modules ({modules?.length || 0})</CardTitle>
        <Button size="sm" onClick={() => setEditing({})}><Plus className="h-4 w-4 mr-1.5" />Nouveau</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <Spin /> : (
          <div className="space-y-2">
            {modules?.map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{m.title_fr}</p>
                    <Badge variant="outline">{m.portal}</Badge>
                    {m.is_mandatory && <Badge variant="secondary">Obligatoire</Badge>}
                    {!m.is_active && <Badge variant="destructive">Inactif</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {m.slug || "—"} · catégorie: {m.category} · note min: {m.passing_score}% · ordre: {m.order_index}
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setEditing(m)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => confirm(`Supprimer "${m.title_fr}" ?`) && del.mutate(m.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {editing && <ModuleEditor module={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function ModuleEditor({ module: m, onClose }: { module: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    title_fr: m.title_fr || "",
    title_en: m.title_en || "",
    subtitle_fr: m.subtitle_fr || "",
    subtitle_en: m.subtitle_en || "",
    description_fr: m.description_fr || "",
    description_en: m.description_en || "",
    category: m.category || "general",
    portal: m.portal || "both",
    slug: m.slug || "",
    icon: m.icon || "",
    order_index: m.order_index ?? 0,
    passing_score: m.passing_score ?? 80,
    points_reward: m.points_reward ?? 100,
    estimated_minutes: m.estimated_minutes ?? 30,
    content_type: m.content_type || "mixed",
    is_mandatory: m.is_mandatory ?? true,
    is_active: m.is_active ?? true,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (m.id) {
        const { error } = await supabase.from("training_modules").update(f).eq("id", m.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("training_modules").insert(f);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Module sauvegardé"); qc.invalidateQueries({ queryKey: ["academy-modules-edit"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{m.id ? "Modifier le module" : "Nouveau module"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Titre (FR)"><Input value={f.title_fr} onChange={(e) => setF({ ...f, title_fr: e.target.value })} /></Field>
          <Field label="Titre (EN)"><Input value={f.title_en} onChange={(e) => setF({ ...f, title_en: e.target.value })} /></Field>
          <Field label="Sous-titre (FR)"><Input value={f.subtitle_fr} onChange={(e) => setF({ ...f, subtitle_fr: e.target.value })} /></Field>
          <Field label="Sous-titre (EN)"><Input value={f.subtitle_en} onChange={(e) => setF({ ...f, subtitle_en: e.target.value })} /></Field>
          <Field label="Slug"><Input value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} placeholder="introduction" /></Field>
          <Field label="Catégorie"><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></Field>
          <Field label="Portail">
            <Select value={f.portal} onValueChange={(v) => setF({ ...f, portal: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Both (Field + CS)</SelectItem>
                <SelectItem value="field">Field uniquement</SelectItem>
                <SelectItem value="cs">OneView CS uniquement</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Icône (lucide name)"><Input value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })} placeholder="BookOpen" /></Field>
          <Field label="Ordre"><Input type="number" value={f.order_index} onChange={(e) => setF({ ...f, order_index: Number(e.target.value) })} /></Field>
          <Field label="Note min (%)"><Input type="number" value={f.passing_score} onChange={(e) => setF({ ...f, passing_score: Number(e.target.value) })} /></Field>
          <Field label="Points"><Input type="number" value={f.points_reward} onChange={(e) => setF({ ...f, points_reward: Number(e.target.value) })} /></Field>
          <Field label="Durée estimée (min)"><Input type="number" value={f.estimated_minutes} onChange={(e) => setF({ ...f, estimated_minutes: Number(e.target.value) })} /></Field>
          <Field label="Description (FR)" full><Textarea rows={3} value={f.description_fr} onChange={(e) => setF({ ...f, description_fr: e.target.value })} /></Field>
          <Field label="Description (EN)" full><Textarea rows={3} value={f.description_en} onChange={(e) => setF({ ...f, description_en: e.target.value })} /></Field>
          <div className="flex items-center gap-2"><Switch checked={f.is_mandatory} onCheckedChange={(v) => setF({ ...f, is_mandatory: v })} /><Label>Obligatoire</Label></div>
          <div className="flex items-center gap-2"><Switch checked={f.is_active} onCheckedChange={(v) => setF({ ...f, is_active: v })} /><Label>Actif</Label></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Sauvegarder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 *  LESSONS
 * ============================================================ */
function LessonsTab() {
  const qc = useQueryClient();
  const [moduleId, setModuleId] = useState<string>("");
  const [editing, setEditing] = useState<any | null>(null);

  const { data: modules } = useQuery({
    queryKey: ["academy-modules-min"],
    queryFn: async () => (await supabase.from("training_modules").select("id, title_fr").order("order_index")).data || [],
  });
  const { data: lessons, isLoading } = useQuery({
    queryKey: ["academy-lessons", moduleId],
    enabled: !!moduleId,
    queryFn: async () => (await supabase.from("training_lessons").select("*").eq("module_id", moduleId).order("order_index")).data || [],
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_lessons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Leçon supprimée"); qc.invalidateQueries({ queryKey: ["academy-lessons"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="text-lg">Leçons</CardTitle>
        <div className="flex gap-2 items-center">
          <Select value={moduleId} onValueChange={setModuleId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Choisir un module..." /></SelectTrigger>
            <SelectContent>
              {modules?.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.title_fr}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!moduleId} onClick={() => setEditing({ module_id: moduleId })}>
            <Plus className="h-4 w-4 mr-1.5" />Nouvelle leçon
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!moduleId ? <p className="text-sm text-muted-foreground text-center py-8">Sélectionne un module pour voir ses leçons.</p>
          : isLoading ? <Spin /> : (
          <div className="space-y-2">
            {lessons?.map((l: any) => (
              <div key={l.id} className="flex items-center gap-3 p-3 rounded border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{l.title_fr}</p>
                    <Badge variant="outline">{l.lesson_type}</Badge>
                    {!l.is_published && <Badge variant="destructive">Brouillon</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">Ordre {l.order_index} · {l.duration_minutes} min</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setEditing(l)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => confirm(`Supprimer "${l.title_fr}" ?`) && del.mutate(l.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {lessons?.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Aucune leçon. Crée la première.</p>}
          </div>
        )}
      </CardContent>
      {editing && <LessonEditor lesson={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function LessonEditor({ lesson: l, onClose }: { lesson: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    module_id: l.module_id,
    title_fr: l.title_fr || "",
    title_en: l.title_en || "",
    content_fr: l.content_fr || "",
    content_en: l.content_en || "",
    lesson_type: l.lesson_type || "text",
    video_url: l.video_url || "",
    image_url: l.image_url || "",
    duration_minutes: l.duration_minutes ?? 5,
    order_index: l.order_index ?? 0,
    is_published: l.is_published ?? true,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (l.id) {
        const { error } = await supabase.from("training_lessons").update(f).eq("id", l.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("training_lessons").insert(f);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Leçon sauvegardée"); qc.invalidateQueries({ queryKey: ["academy-lessons"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{l.id ? "Modifier la leçon" : "Nouvelle leçon"}</DialogTitle>
          <DialogDescription>Le contenu accepte du Markdown (titres, listes, gras, liens).</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Titre (FR)"><Input value={f.title_fr} onChange={(e) => setF({ ...f, title_fr: e.target.value })} /></Field>
          <Field label="Titre (EN)"><Input value={f.title_en} onChange={(e) => setF({ ...f, title_en: e.target.value })} /></Field>
          <Field label="Type">
            <Select value={f.lesson_type} onValueChange={(v) => setF({ ...f, lesson_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texte</SelectItem>
                <SelectItem value="video">Vidéo</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="quiz">Quiz</SelectItem>
                <SelectItem value="simulation">Simulation</SelectItem>
                <SelectItem value="interactive">Interactif</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Durée (min)"><Input type="number" value={f.duration_minutes} onChange={(e) => setF({ ...f, duration_minutes: Number(e.target.value) })} /></Field>
          <Field label="Ordre"><Input type="number" value={f.order_index} onChange={(e) => setF({ ...f, order_index: Number(e.target.value) })} /></Field>
          <div className="flex items-center gap-2"><Switch checked={f.is_published} onCheckedChange={(v) => setF({ ...f, is_published: v })} /><Label>Publié</Label></div>
          <Field label="URL vidéo" full><Input value={f.video_url} onChange={(e) => setF({ ...f, video_url: e.target.value })} placeholder="https://..." /></Field>
          <Field label="URL image" full><Input value={f.image_url} onChange={(e) => setF({ ...f, image_url: e.target.value })} placeholder="https://..." /></Field>
          <Field label="Contenu Markdown (FR)" full><Textarea rows={8} className="font-mono text-xs" value={f.content_fr} onChange={(e) => setF({ ...f, content_fr: e.target.value })} /></Field>
          <Field label="Contenu Markdown (EN)" full><Textarea rows={8} className="font-mono text-xs" value={f.content_en} onChange={(e) => setF({ ...f, content_en: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Sauvegarder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 *  QUIZ — schema: options_fr/en jsonb + correct_option index
 * ============================================================ */
function QuizTab() {
  const qc = useQueryClient();
  const [moduleId, setModuleId] = useState<string>("");
  const [editing, setEditing] = useState<any | null>(null);

  const { data: modules } = useQuery({
    queryKey: ["academy-modules-min"],
    queryFn: async () => (await supabase.from("training_modules").select("id, title_fr").order("order_index")).data || [],
  });
  const { data: questions, isLoading } = useQuery({
    queryKey: ["academy-questions", moduleId],
    enabled: !!moduleId,
    queryFn: async () => (await supabase.from("training_questions").select("*").eq("module_id", moduleId).order("order_index")).data || [],
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_questions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Question supprimée"); qc.invalidateQueries({ queryKey: ["academy-questions"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="text-lg">Questions de quiz</CardTitle>
        <div className="flex gap-2 items-center">
          <Select value={moduleId} onValueChange={setModuleId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Choisir un module..." /></SelectTrigger>
            <SelectContent>
              {modules?.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.title_fr}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!moduleId} onClick={() => setEditing({ module_id: moduleId })}>
            <Plus className="h-4 w-4 mr-1.5" />Nouvelle question
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!moduleId ? <p className="text-sm text-muted-foreground text-center py-8">Sélectionne un module.</p>
          : isLoading ? <Spin /> : (
          <div className="space-y-2">
            {questions?.map((q: any) => {
              const opts: string[] = Array.isArray(q.options_fr) ? q.options_fr : [];
              return (
                <div key={q.id} className="p-3 rounded border">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{q.order_index + 1}. {q.question_fr}</p>
                      <ul className="mt-1 text-xs text-muted-foreground space-y-0.5">
                        {opts.map((o, i) => (
                          <li key={i} className={i === q.correct_option ? "text-emerald-600 font-medium" : ""}>
                            {i === q.correct_option ? "✓ " : "· "}{o}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => setEditing(q)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => confirm("Supprimer cette question ?") && del.mutate(q.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {questions?.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Aucune question.</p>}
          </div>
        )}
      </CardContent>
      {editing && <QuestionEditor question={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function QuestionEditor({ question: q, onClose }: { question: any; onClose: () => void }) {
  const qc = useQueryClient();
  const initialOpts = Array.isArray(q.options_fr) && q.options_fr.length ? q.options_fr : ["", ""];
  const initialOptsEn = Array.isArray(q.options_en) && q.options_en.length ? q.options_en : ["", ""];
  const [f, setF] = useState({
    module_id: q.module_id,
    question_fr: q.question_fr || "",
    question_en: q.question_en || "",
    explanation_fr: q.explanation_fr || "",
    explanation_en: q.explanation_en || "",
    points: q.points ?? 20,
    order_index: q.order_index ?? 0,
    correct_option: q.correct_option ?? 0,
  });
  const [optsFr, setOptsFr] = useState<string[]>(initialOpts);
  const [optsEn, setOptsEn] = useState<string[]>(initialOptsEn);

  const setOpt = (i: number, fr: string, en?: string) => {
    setOptsFr(optsFr.map((o, idx) => idx === i ? fr : o));
    if (en !== undefined) setOptsEn(optsEn.map((o, idx) => idx === i ? en : o));
  };
  const addOpt = () => { setOptsFr([...optsFr, ""]); setOptsEn([...optsEn, ""]); };
  const removeOpt = (i: number) => {
    setOptsFr(optsFr.filter((_, idx) => idx !== i));
    setOptsEn(optsEn.filter((_, idx) => idx !== i));
    if (f.correct_option >= i && f.correct_option > 0) setF({ ...f, correct_option: f.correct_option - 1 });
  };

  const save = useMutation({
    mutationFn: async () => {
      const cleanFr = optsFr.filter((o) => o.trim());
      const cleanEn = optsEn.slice(0, cleanFr.length).map((o, i) => o.trim() || cleanFr[i]);
      if (cleanFr.length < 2) throw new Error("Minimum 2 réponses requises");
      if (f.correct_option >= cleanFr.length) throw new Error("La bonne réponse est invalide");
      const payload = { ...f, options_fr: cleanFr, options_en: cleanEn };
      if (q.id) {
        const { error } = await supabase.from("training_questions").update(payload).eq("id", q.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("training_questions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Question sauvegardée"); qc.invalidateQueries({ queryKey: ["academy-questions"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{q.id ? "Modifier la question" : "Nouvelle question"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Question (FR)"><Textarea rows={2} value={f.question_fr} onChange={(e) => setF({ ...f, question_fr: e.target.value })} /></Field>
          <Field label="Question (EN)"><Textarea rows={2} value={f.question_en} onChange={(e) => setF({ ...f, question_en: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Points"><Input type="number" value={f.points} onChange={(e) => setF({ ...f, points: Number(e.target.value) })} /></Field>
            <Field label="Ordre"><Input type="number" value={f.order_index} onChange={(e) => setF({ ...f, order_index: Number(e.target.value) })} /></Field>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Réponses (cocher la bonne)</Label>
              <Button size="sm" variant="outline" onClick={addOpt}><Plus className="h-3 w-3 mr-1" />Ajouter</Button>
            </div>
            {optsFr.map((o, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded border">
                <input type="radio" name="correct" checked={f.correct_option === i} onChange={() => setF({ ...f, correct_option: i })} />
                <Input placeholder="Réponse FR" value={o} onChange={(e) => setOpt(i, e.target.value, optsEn[i])} />
                <Input placeholder="Réponse EN" value={optsEn[i] || ""} onChange={(e) => setOpt(i, o, e.target.value)} />
                <Button size="icon" variant="ghost" onClick={() => removeOpt(i)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>

          <Field label="Explication (FR)"><Textarea rows={2} value={f.explanation_fr} onChange={(e) => setF({ ...f, explanation_fr: e.target.value })} /></Field>
          <Field label="Explication (EN)"><Textarea rows={2} value={f.explanation_en} onChange={(e) => setF({ ...f, explanation_en: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Sauvegarder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 *  SIMULATIONS
 * ============================================================ */
function SimulationsTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);

  const { data: sims, isLoading } = useQuery({
    queryKey: ["academy-sims"],
    queryFn: async () => (await supabase.from("training_simulations").select("*").order("persona_label_fr")).data || [],
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_simulations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Persona supprimé"); qc.invalidateQueries({ queryKey: ["academy-sims"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Personas IA ({sims?.length || 0})</CardTitle>
        <Button size="sm" onClick={() => setEditing({})}><Plus className="h-4 w-4 mr-1.5" />Nouveau</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <Spin /> : (
          <div className="space-y-2">
            {sims?.map((s: any) => (
              <div key={s.id} className="flex items-start gap-3 p-3 rounded border">
                <MessageSquare className="h-4 w-4 mt-1 text-primary" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{s.persona_label_fr}</p>
                    <Badge variant="outline">{s.portal}</Badge>
                    <Badge variant="secondary">{s.difficulty}</Badge>
                    {!s.is_active && <Badge variant="destructive">Inactif</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{s.scenario_fr}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => confirm(`Supprimer "${s.persona_label_fr}" ?`) && del.mutate(s.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {editing && <SimEditor sim={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function SimEditor({ sim: s, onClose }: { sim: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({
    persona_key: s.persona_key || "",
    persona_label_fr: s.persona_label_fr || "",
    persona_label_en: s.persona_label_en || "",
    scenario_fr: s.scenario_fr || "",
    scenario_en: s.scenario_en || "",
    difficulty: s.difficulty || "medium",
    portal: s.portal || "both",
    system_prompt_fr: s.system_prompt_fr || "",
    system_prompt_en: s.system_prompt_en || "",
    evaluation_criteria: JSON.stringify(s.evaluation_criteria || [], null, 2),
    is_active: s.is_active ?? true,
  });

  const save = useMutation({
    mutationFn: async () => {
      let criteria: any = [];
      try { criteria = JSON.parse(f.evaluation_criteria); }
      catch { throw new Error("Évaluation : JSON invalide"); }
      const payload = { ...f, evaluation_criteria: criteria };
      if (s.id) {
        const { error } = await supabase.from("training_simulations").update(payload).eq("id", s.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("training_simulations").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Persona sauvegardé"); qc.invalidateQueries({ queryKey: ["academy-sims"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{s.id ? "Modifier le persona" : "Nouveau persona IA"}</DialogTitle>
          <DialogDescription>Le system_prompt définit le comportement du client simulé.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Clé persona"><Input value={f.persona_key} onChange={(e) => setF({ ...f, persona_key: e.target.value })} placeholder="marie_sceptique" /></Field>
          <Field label="Portail">
            <Select value={f.portal} onValueChange={(v) => setF({ ...f, portal: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Both</SelectItem>
                <SelectItem value="field">Field</SelectItem>
                <SelectItem value="cs">CS</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Label (FR)"><Input value={f.persona_label_fr} onChange={(e) => setF({ ...f, persona_label_fr: e.target.value })} /></Field>
          <Field label="Label (EN)"><Input value={f.persona_label_en} onChange={(e) => setF({ ...f, persona_label_en: e.target.value })} /></Field>
          <Field label="Difficulté">
            <Select value={f.difficulty} onValueChange={(v) => setF({ ...f, difficulty: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Facile</SelectItem>
                <SelectItem value="medium">Moyen</SelectItem>
                <SelectItem value="hard">Difficile</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-center gap-2"><Switch checked={f.is_active} onCheckedChange={(v) => setF({ ...f, is_active: v })} /><Label>Actif</Label></div>
          <Field label="Scénario (FR)" full><Textarea rows={2} value={f.scenario_fr} onChange={(e) => setF({ ...f, scenario_fr: e.target.value })} /></Field>
          <Field label="Scénario (EN)" full><Textarea rows={2} value={f.scenario_en} onChange={(e) => setF({ ...f, scenario_en: e.target.value })} /></Field>
          <Field label="System prompt (FR)" full><Textarea rows={5} className="font-mono text-xs" value={f.system_prompt_fr} onChange={(e) => setF({ ...f, system_prompt_fr: e.target.value })} /></Field>
          <Field label="System prompt (EN)" full><Textarea rows={5} className="font-mono text-xs" value={f.system_prompt_en} onChange={(e) => setF({ ...f, system_prompt_en: e.target.value })} /></Field>
          <Field label="Critères d'évaluation (JSON array)" full>
            <Textarea rows={4} className="font-mono text-xs" value={f.evaluation_criteria}
              onChange={(e) => setF({ ...f, evaluation_criteria: e.target.value })}
              placeholder='["Salutation professionnelle", "Identification du besoin", ...]' />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Sauvegarder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 *  WHITELIST (certification bypass)
 * ============================================================ */
function WhitelistTab() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("Test / Pilot");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["academy-whitelist"],
    queryFn: async () => {
      const { data } = await supabase.from("training_certification_whitelist").select("*").order("created_at", { ascending: false });
      const ids = (data || []).map((r: any) => r.user_id);
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
      const map = new Map((profs || []).map((p: any) => [p.id, p]));
      return (data || []).map((r: any) => ({ ...r, profile: map.get(r.user_id) }));
    },
  });

  const { data: searchResults } = useQuery({
    queryKey: ["whitelist-user-search", search],
    enabled: search.length >= 2,
    queryFn: async () => {
      const { data } = await supabase.from("profiles")
        .select("id, full_name, email")
        .or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
        .limit(8);
      return data || [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!selectedUser) throw new Error("Sélectionne un utilisateur");
      const { error } = await supabase.from("training_certification_whitelist")
        .insert({ user_id: selectedUser.id, reason });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ajouté à la whitelist");
      qc.invalidateQueries({ queryKey: ["academy-whitelist"] });
      setShowAdd(false); setSelectedUser(null); setSearch(""); setReason("Test / Pilot");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_certification_whitelist").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Retiré de la whitelist"); qc.invalidateQueries({ queryKey: ["academy-whitelist"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-amber-600" />Whitelist certification</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Utilisateurs exemptés du blocage strict (peuvent vendre sans avoir complété la formation).</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1.5" />Ajouter</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <Spin /> : (
          <div className="space-y-2">
            {rows?.map((r: any) => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{r.profile?.full_name || "Employé"}</p>
                  <p className="text-xs text-muted-foreground">{r.profile?.email} · {r.reason}</p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => confirm("Retirer de la whitelist ?") && remove.mutate(r.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            {rows?.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Whitelist vide.</p>}
          </div>
        )}
      </CardContent>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter à la whitelist</DialogTitle>
            <DialogDescription>Cherche un utilisateur par nom ou courriel.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Recherche"><Input value={search} onChange={(e) => { setSearch(e.target.value); setSelectedUser(null); }} placeholder="Nom ou courriel..." /></Field>
            {search.length >= 2 && !selectedUser && (
              <div className="border rounded max-h-48 overflow-y-auto">
                {searchResults?.map((u: any) => (
                  <button key={u.id} onClick={() => { setSelectedUser(u); setSearch(u.full_name || u.email); }}
                    className="w-full text-left p-2 hover:bg-muted text-sm border-b last:border-0">
                    <p className="font-medium">{u.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </button>
                ))}
                {searchResults?.length === 0 && <p className="text-sm text-muted-foreground p-3">Aucun résultat.</p>}
              </div>
            )}
            {selectedUser && (
              <div className="p-2 rounded bg-primary/5 text-sm">
                Sélectionné : <strong>{selectedUser.full_name}</strong> ({selectedUser.email})
              </div>
            )}
            <Field label="Raison"><Input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAdd(false)}>Annuler</Button>
            <Button onClick={() => add.mutate()} disabled={!selectedUser || add.isPending}>
              {add.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ============================================================
 *  AGENTS (read-only progress dashboard)
 * ============================================================ */
function AgentsTab() {
  const { data: modules } = useQuery({
    queryKey: ["academy-modules-min2"],
    queryFn: async () => (await supabase.from("training_modules").select("id").eq("is_active", true).eq("is_mandatory", true)).data || [],
  });
  const { data: agents, isLoading } = useQuery({
    queryKey: ["academy-agents-full"],
    queryFn: async () => {
      const { data: progress } = await supabase.from("training_progress").select("agent_id, status, score");
      const { data: certs } = await supabase.from("training_certifications").select("agent_id, issued_at").eq("is_active", true);
      const ids = Array.from(new Set([...(progress || []).map((p: any) => p.agent_id), ...(certs || []).map((c: any) => c.agent_id)]));
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
      const profMap = new Map((profs || []).map((p: any) => [p.id, p]));
      const certMap = new Map((certs || []).map((c: any) => [c.agent_id, c]));
      const byAgent = new Map<string, any[]>();
      (progress || []).forEach((p: any) => {
        const arr = byAgent.get(p.agent_id) || [];
        arr.push(p); byAgent.set(p.agent_id, arr);
      });
      return ids.map((id) => ({
        id, profile: profMap.get(id), progress: byAgent.get(id) || [],
        cert: certMap.get(id),
      }));
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Suivi des agents</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <Spin /> : (
          <div className="space-y-2">
            {agents?.map((a: any) => {
              const done = a.progress.filter((p: any) => p.status === "completed").length;
              const total = modules?.length || 1;
              const pct = Math.round((done / total) * 100);
              return (
                <div key={a.id} className="grid grid-cols-12 gap-3 items-center p-3 rounded-lg border">
                  <div className="col-span-4">
                    <p className="text-sm font-medium truncate">{a.profile?.full_name || "Employé"}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.profile?.email}</p>
                  </div>
                  <div className="col-span-5">
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className="h-2 flex-1" />
                      <span className="text-xs tabular-nums w-10 text-right">{pct}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{done}/{total} modules obligatoires</p>
                  </div>
                  <div className="col-span-3 text-right">
                    {a.cert ? (
                      <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/40">
                        <Trophy className="h-3 w-3 mr-1" /> Certifié
                      </Badge>
                    ) : <Badge variant="outline">En cours</Badge>}
                  </div>
                </div>
              );
            })}
            {agents?.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">Aucun agent encore en formation.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ============================================================
 *  Helpers
 * ============================================================ */
function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1.5 ${full ? "md:col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
function Spin() {
  return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
}
