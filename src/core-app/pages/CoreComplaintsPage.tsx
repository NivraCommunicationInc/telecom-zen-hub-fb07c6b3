/**
 * CoreComplaintsPage — Nivra Core admin view of all client complaints.
 * Stats, filters, table, detail dialog with conversation + admin actions.
 */
import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { AlertCircle, Search, Loader2, Eye, Send, ShieldAlert, CheckCircle2, XCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNowStrict } from "date-fns";
import { fr } from "date-fns/locale";
import { useProfileName, ProfileName } from "@/hooks/useProfileName";
import { cn } from "@/lib/utils";

type Complaint = {
  id: string;
  ticket_number: string;
  account_id: string | null;
  submitted_by_user_id: string | null;
  submitted_by_name: string | null;
  submitted_by_email: string;
  submitted_by_phone: string | null;
  category: string;
  priority: "urgent" | "high" | "normal" | "low";
  status: "new" | "in_progress" | "waiting_client" | "resolved" | "closed" | "escalated";
  subject: string;
  description: string;
  assigned_to: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  escalated_at: string | null;
  sla_deadline: string | null;
  created_at: string;
  updated_at: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  technique: "🔧 Technique",
  facturation: "💳 Facturation",
  service_client: "👤 Service client",
  installation: "🔌 Installation",
  equipement: "📦 Équipement",
  resiliation: "❌ Résiliation",
  autre: "📝 Autre",
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgent",
  high: "Élevée",
  normal: "Normale",
  low: "Faible",
};

const STATUS_LABELS: Record<string, string> = {
  new: "Nouvelle",
  in_progress: "En cours",
  waiting_client: "Attente client",
  resolved: "Résolue",
  closed: "Fermée",
  escalated: "Escaladée",
};

function priorityClass(p: string) {
  switch (p) {
    case "urgent": return "bg-red-100 text-red-700 border-red-300 animate-pulse";
    case "high": return "bg-orange-100 text-orange-700 border-orange-300";
    case "normal": return "bg-yellow-100 text-yellow-700 border-yellow-300";
    case "low": return "bg-emerald-100 text-emerald-700 border-emerald-300";
    default: return "";
  }
}

function statusClass(s: string) {
  switch (s) {
    case "new": return "bg-blue-100 text-blue-700";
    case "in_progress": return "bg-amber-100 text-amber-700";
    case "waiting_client": return "bg-purple-100 text-purple-700";
    case "resolved": return "bg-emerald-100 text-emerald-700";
    case "closed": return "bg-gray-200 text-gray-700";
    case "escalated": return "bg-red-100 text-red-700";
    default: return "bg-gray-100 text-gray-600";
  }
}

function SlaCell({ deadline, resolved }: { deadline: string | null; resolved: boolean }) {
  if (!deadline) return <span className="text-xs text-muted-foreground">—</span>;
  if (resolved) return <span className="text-xs text-emerald-600">✓ Résolue</span>;
  const d = new Date(deadline);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0) {
    const over = formatDistanceToNowStrict(d, { locale: fr });
    return <span className="text-xs font-semibold text-red-600">DÉPASSÉ — {over} de retard</span>;
  }
  const left = formatDistanceToNowStrict(d, { locale: fr });
  const cls = diff < 24 * 3600 * 1000 ? "text-orange-600" : "text-emerald-600";
  return <span className={cn("text-xs font-medium", cls)}>{left} restant</span>;
}

export default function CoreComplaintsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"all" | "new" | "in_progress" | "waiting_client" | "resolved" | "closed" | "escalated">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ["core-complaints"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("complaints" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as unknown as Complaint[];
    },
    refetchInterval: 30_000,
  });

  const stats = useMemo(() => {
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
    const now = new Date();
    return {
      new: complaints.filter((c) => c.status === "new").length,
      in_progress: complaints.filter((c) => c.status === "in_progress").length,
      sla_risk: complaints.filter((c) => c.sla_deadline && new Date(c.sla_deadline) < now && !["resolved", "closed"].includes(c.status)).length,
      resolved_month: complaints.filter((c) => c.resolved_at && new Date(c.resolved_at) >= start).length,
      total: complaints.length,
    };
  }, [complaints]);

  const filtered = useMemo(() => {
    return complaints.filter((c) => {
      if (tab !== "all" && c.status !== tab) return false;
      if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
      if (priorityFilter !== "all" && c.priority !== priorityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const blob = `${c.ticket_number} ${c.submitted_by_name ?? ""} ${c.submitted_by_email} ${c.subject}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [complaints, tab, categoryFilter, priorityFilter, search]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const exportCsv = () => {
    const header = ["Ticket", "Client", "Email", "Catégorie", "Priorité", "Statut", "Assigné", "Créé le", "Résolu le"];
    const rows = filtered.map((c) => [
      c.ticket_number, c.submitted_by_name ?? "", c.submitted_by_email,
      CATEGORY_LABELS[c.category] ?? c.category, PRIORITY_LABELS[c.priority],
      STATUS_LABELS[c.status], c.assigned_to ?? "",
      format(new Date(c.created_at), "yyyy-MM-dd HH:mm"),
      c.resolved_at ? format(new Date(c.resolved_at), "yyyy-MM-dd HH:mm") : "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `plaintes_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <Helmet><title>Plaintes — Nivra Core</title></Helmet>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-red-500" />
            Plaintes clients
          </h1>
          <p className="text-sm text-muted-foreground">Gestion des plaintes avec SLA et escalade.</p>
        </div>
        <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-2" />Exporter CSV</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Nouvelles", value: stats.new, color: "text-blue-600" },
          { label: "En cours", value: stats.in_progress, color: "text-amber-600" },
          { label: "SLA à risque", value: stats.sla_risk, color: "text-red-600" },
          { label: "Résolues (mois)", value: stats.resolved_month, color: "text-emerald-600" },
          { label: "Total", value: stats.total, color: "text-foreground" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className={cn("text-2xl font-bold mt-1", s.color)}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Tabs value={tab} onValueChange={(v) => { setTab(v as any); setPage(0); }}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="all">Toutes</TabsTrigger>
          <TabsTrigger value="new">Nouvelles</TabsTrigger>
          <TabsTrigger value="in_progress">En cours</TabsTrigger>
          <TabsTrigger value="waiting_client">Attente client</TabsTrigger>
          <TabsTrigger value="resolved">Résolues</TabsTrigger>
          <TabsTrigger value="closed">Fermées</TabsTrigger>
          <TabsTrigger value="escalated">Escaladées</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap gap-2 items-center">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Catégorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Priorité" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes priorités</SelectItem>
            {Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Recherche ticket, client, email, sujet…"
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Priorité</TableHead>
                <TableHead>Sujet</TableHead>
                <TableHead>Assigné</TableHead>
                <TableHead>SLA</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Créé</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : paginated.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Aucune plainte</TableCell></TableRow>
              ) : paginated.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelected(c)}>
                  <TableCell className="font-mono text-xs font-semibold">{c.ticket_number}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{c.submitted_by_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{c.submitted_by_email}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{CATEGORY_LABELS[c.category] ?? c.category}</Badge></TableCell>
                  <TableCell><Badge className={cn("border", priorityClass(c.priority))}>{PRIORITY_LABELS[c.priority]}</Badge></TableCell>
                  <TableCell className="max-w-[260px] truncate">{c.subject}</TableCell>
                  <TableCell className="text-sm">
                    {c.assigned_to ? <ProfileName userId={c.assigned_to} /> : <span className="text-muted-foreground">Non assigné</span>}
                  </TableCell>
                  <TableCell><SlaCell deadline={c.sla_deadline} resolved={["resolved", "closed"].includes(c.status)} /></TableCell>
                  <TableCell><Badge className={statusClass(c.status)}>{STATUS_LABELS[c.status]}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(c.created_at), "dd MMM HH:mm", { locale: fr })}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelected(c); }}><Eye className="w-4 h-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">{filtered.length} plainte(s)</div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Précédent</Button>
          <span>{page + 1} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Suivant</Button>
        </div>
      </div>

      {selected && (
        <ComplaintDetailDialog
          complaint={selected}
          onClose={() => setSelected(null)}
          onChange={() => queryClient.invalidateQueries({ queryKey: ["core-complaints"] })}
          adminMode
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- */
/* Detail dialog (shared between Core/Field/Employee via props)         */
/* -------------------------------------------------------------------- */

export function ComplaintDetailDialog({
  complaint,
  onClose,
  onChange,
  adminMode = false,
  allowInternalNotes = true,
  allowResolveOnly = false,
}: {
  complaint: Complaint;
  onClose: () => void;
  onChange: () => void;
  adminMode?: boolean;
  allowInternalNotes?: boolean;
  allowResolveOnly?: boolean;
}) {
  const { user } = useAuth();
  const myName = useProfileName(user?.id || "", "Agent");
  const [responseText, setResponseText] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusDraft, setStatusDraft] = useState(complaint.status);
  const [assignDraft, setAssignDraft] = useState(complaint.assigned_to ?? "");

  const { data: responses = [] } = useQuery({
    queryKey: ["complaint-responses", complaint.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("complaint_responses" as any)
        .select("*")
        .eq("complaint_id", complaint.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ["complaint-attachments", complaint.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("complaint_attachments" as any)
        .select("*")
        .eq("complaint_id", complaint.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const queueEmail = async (template_key: string, vars: Record<string, any>, suffix = "") => {
    await supabase.from("email_queue").insert({
      event_key: `${template_key}_${complaint.id}_${suffix || Date.now()}`,
      to_email: complaint.submitted_by_email,
      template_key,
      template_vars: {
        first_name: (complaint.submitted_by_name ?? "Client").split(" ")[0],
        ticket_number: complaint.ticket_number,
        portal_url: typeof window !== "undefined" ? `${window.location.origin}/plainte` : "/plainte",
        ...vars,
      },
      status: "queued",
    } as any);
  };

  const sendResponse = async () => {
    if (!responseText.trim()) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("complaint_responses" as any).insert({
        complaint_id: complaint.id,
        author_id: user?.id ?? null,
        author_name: myName || "Agent Nivra",
        response_text: responseText.trim(),
        is_internal: isInternal,
      } as any);
      if (error) throw error;
      if (!isInternal) {
        await queueEmail("complaint_response", { response_preview: responseText.trim() });
      }
      await supabase.from("complaints" as any).update({ updated_at: new Date().toISOString() }).eq("id", complaint.id);
      setResponseText("");
      toast.success(isInternal ? "Note interne enregistrée" : "Réponse envoyée");
      onChange();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const updateStatus = async (newStatus: string) => {
    setBusy(true);
    try {
      const patch: any = { status: newStatus };
      if (newStatus === "resolved") patch.resolved_at = new Date().toISOString();
      if (newStatus === "closed") patch.closed_at = new Date().toISOString();
      if (newStatus === "escalated") {
        patch.escalated_at = new Date().toISOString();
        patch.escalated_by = user?.id ?? null;
      }
      const { error } = await supabase.from("complaints" as any).update(patch).eq("id", complaint.id);
      if (error) throw error;

      if (newStatus === "resolved") {
        await queueEmail("complaint_resolved", {
          resolved_date: format(new Date(), "dd MMM yyyy HH:mm", { locale: fr }),
          resolution_summary: "Notre équipe a résolu votre plainte.",
        }, "resolved");
      } else if (newStatus === "escalated") {
        await supabase.from("email_queue").insert({
          event_key: `complaint_escalated_${complaint.id}_${Date.now()}`,
          to_email: "nivratelecom@gmail.com",
          template_key: "complaint_escalated",
          template_vars: {
            ticket_number: complaint.ticket_number,
            client_name: complaint.submitted_by_name,
            submitted_by_email: complaint.submitted_by_email,
            submitted_by_phone: complaint.submitted_by_phone || "—",
            category_label: CATEGORY_LABELS[complaint.category],
            priority_label: PRIORITY_LABELS[complaint.priority],
            subject: complaint.subject,
            description: complaint.description,
            core_complaint_url: typeof window !== "undefined" ? `${window.location.origin}/core/complaints` : "/core/complaints",
          },
          status: "queued",
        } as any);
      } else {
        await queueEmail("complaint_status_update", {
          new_status_label: STATUS_LABELS[newStatus] ?? newStatus,
        }, `status_${newStatus}`);
      }

      toast.success("Statut mis à jour");
      onChange();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const downloadAttachment = async (path: string) => {
    const { data, error } = await supabase.storage.from("complaint-attachments").createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) { toast.error("Lien indisponible"); return; }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="font-mono">{complaint.ticket_number}</span>
            <Badge className={cn("border", priorityClass(complaint.priority))}>{PRIORITY_LABELS[complaint.priority]}</Badge>
            <Badge className={statusClass(complaint.status)}>{STATUS_LABELS[complaint.status]}</Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="conv">
          <TabsList>
            <TabsTrigger value="conv">Conversation</TabsTrigger>
            <TabsTrigger value="info">Informations</TabsTrigger>
            <TabsTrigger value="files">Pièces jointes ({attachments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="conv" className="space-y-3 mt-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">
                  {complaint.submitted_by_name} · {format(new Date(complaint.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
                </div>
                <div className="font-medium mb-1">{complaint.subject}</div>
                <div className="text-sm whitespace-pre-wrap">{complaint.description}</div>
              </CardContent>
            </Card>

            {responses.map((r) => (
              <Card key={r.id} className={r.is_internal ? "border-amber-300 bg-amber-50/50" : ""}>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
                    <span className="font-medium text-foreground">{r.author_name}</span>
                    <span>· {format(new Date(r.created_at), "dd MMM HH:mm", { locale: fr })}</span>
                    {r.is_internal && <Badge variant="outline" className="text-amber-700 border-amber-400">Note interne</Badge>}
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{r.response_text}</div>
                </CardContent>
              </Card>
            ))}

            <div className="space-y-2 pt-2">
              <Textarea
                placeholder="Écrire une réponse…"
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                rows={4}
              />
              <div className="flex items-center justify-between">
                {allowInternalNotes ? (
                  <label className="flex items-center gap-2 text-sm">
                    <Switch checked={isInternal} onCheckedChange={setIsInternal} />
                    {isInternal ? "Note interne (cachée client)" : "Réponse au client"}
                  </label>
                ) : <span />}
                <Button onClick={sendResponse} disabled={busy || !responseText.trim()}>
                  <Send className="w-4 h-4 mr-2" />Envoyer
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="info" className="space-y-3 mt-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-muted-foreground">Catégorie</span><div>{CATEGORY_LABELS[complaint.category]}</div></div>
              <div><span className="text-muted-foreground">Priorité</span><div>{PRIORITY_LABELS[complaint.priority]}</div></div>
              <div><span className="text-muted-foreground">Courriel</span><div>{complaint.submitted_by_email}</div></div>
              <div><span className="text-muted-foreground">Téléphone</span><div>{complaint.submitted_by_phone || "—"}</div></div>
              <div><span className="text-muted-foreground">Créée</span><div>{format(new Date(complaint.created_at), "dd MMM yyyy HH:mm", { locale: fr })}</div></div>
              <div><span className="text-muted-foreground">SLA</span><div><SlaCell deadline={complaint.sla_deadline} resolved={["resolved", "closed"].includes(complaint.status)} /></div></div>
              <div><span className="text-muted-foreground">Assigné à</span><div>{complaint.assigned_to ? <ProfileName userId={complaint.assigned_to} /> : "Non assigné"}</div></div>
            </div>
            {adminMode && (
              <div className="border-t pt-3 space-y-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label>Statut</Label>
                    <Select value={statusDraft} onValueChange={(v) => setStatusDraft(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => updateStatus(statusDraft)} disabled={busy || statusDraft === complaint.status}>Appliquer</Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="files" className="mt-4 space-y-2">
            {attachments.length === 0 ? (
              <div className="text-sm text-muted-foreground">Aucune pièce jointe.</div>
            ) : attachments.map((a) => (
              <div key={a.id} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <div className="text-sm font-medium">{a.file_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {Math.round((a.file_size ?? 0) / 1024)} Ko · {a.file_type}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => downloadAttachment(a.file_path)}>
                  <Download className="w-4 h-4 mr-2" />Télécharger
                </Button>
              </div>
            ))}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => updateStatus("resolved")} disabled={busy || complaint.status === "resolved"}>
            <CheckCircle2 className="w-4 h-4 mr-2" />Résoudre
          </Button>
          {!allowResolveOnly && (
            <>
              <Button variant="outline" onClick={() => updateStatus("closed")} disabled={busy || complaint.status === "closed"}>
                <XCircle className="w-4 h-4 mr-2" />Fermer
              </Button>
              <Button variant="destructive" onClick={() => updateStatus("escalated")} disabled={busy || complaint.status === "escalated"}>
                <ShieldAlert className="w-4 h-4 mr-2" />Escalader
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
