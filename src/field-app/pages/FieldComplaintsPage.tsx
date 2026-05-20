/**
 * FieldComplaintsPage — Field agent's restricted complaints view.
 * Shows complaints where assigned_to = current user OR submitted by them.
 * Limited actions: respond (no internal notes), mark resolved only.
 * Can submit a complaint on behalf of a client account.
 */
import { useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { AlertCircle, Search, Loader2, Eye, Plus, Send, Loader, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNowStrict } from "date-fns";
import { fr } from "date-fns/locale";
import { ComplaintDetailDialog } from "@/core-app/pages/CoreComplaintsPage";
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

export const CATEGORY_LABELS_FIELD: Record<string, string> = {
  technique: "🔧 Technique",
  facturation: "💳 Facturation",
  service_client: "👤 Service client",
  installation: "🔌 Installation",
  equipement: "📦 Équipement",
  resiliation: "❌ Résiliation",
  autre: "📝 Autre",
};
const PRIORITY_LABELS: Record<string, string> = { urgent: "Urgent", high: "Élevée", normal: "Normale", low: "Faible" };
const STATUS_LABELS: Record<string, string> = {
  new: "Nouvelle", in_progress: "En cours", waiting_client: "Attente client",
  resolved: "Résolue", closed: "Fermée", escalated: "Escaladée",
};

function priorityClass(p: string) {
  switch (p) {
    case "urgent": return "bg-red-100 text-red-700 border-red-300";
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
  if (resolved) return <span className="text-xs text-emerald-600">✓</span>;
  const d = new Date(deadline);
  const diff = d.getTime() - Date.now();
  if (diff < 0) return <span className="text-xs font-semibold text-red-600">DÉPASSÉ</span>;
  const left = formatDistanceToNowStrict(d, { locale: fr });
  const cls = diff < 24 * 3600 * 1000 ? "text-orange-600" : "text-emerald-600";
  return <span className={cn("text-xs font-medium", cls)}>{left}</span>;
}

export default function FieldComplaintsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"all" | "new" | "in_progress" | "resolved">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  const { data: complaints = [], isLoading } = useQuery({
    queryKey: ["field-complaints", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("complaints" as any)
        .select("*")
        .or(`assigned_to.eq.${user.id},submitted_by_user_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as unknown as Complaint[];
    },
    enabled: !!user?.id,
    refetchInterval: 30_000,
  });

  const stats = useMemo(() => ({
    assigned: complaints.filter((c) => c.assigned_to === user?.id && !["resolved", "closed"].includes(c.status)).length,
    in_progress: complaints.filter((c) => c.status === "in_progress").length,
    resolved: complaints.filter((c) => c.status === "resolved").length,
  }), [complaints, user?.id]);

  const filtered = useMemo(() => complaints.filter((c) => {
    if (tab === "new" && c.status !== "new") return false;
    if (tab === "in_progress" && c.status !== "in_progress") return false;
    if (tab === "resolved" && c.status !== "resolved") return false;
    if (search) {
      const q = search.toLowerCase();
      const blob = `${c.ticket_number} ${c.submitted_by_name ?? ""} ${c.submitted_by_email}`.toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  }), [complaints, tab, search]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <Helmet><title>Plaintes clients — Nivra Field</title></Helmet>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-red-500" />
            Plaintes clients
          </h1>
          <p className="text-sm text-muted-foreground">Plaintes qui vous sont assignées ou que vous avez soumises.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />Soumettre une plainte client
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Assignées</div><div className="text-2xl font-bold mt-1 text-blue-600">{stats.assigned}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">En cours</div><div className="text-2xl font-bold mt-1 text-amber-600">{stats.in_progress}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Résolues</div><div className="text-2xl font-bold mt-1 text-emerald-600">{stats.resolved}</div></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as any); setPage(0); }}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="all">Toutes</TabsTrigger>
          <TabsTrigger value="new">Nouvelles</TabsTrigger>
          <TabsTrigger value="in_progress">En cours</TabsTrigger>
          <TabsTrigger value="resolved">Résolues</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Rechercher (ticket #, nom client)…"
          className="pl-10"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Priorité</TableHead>
                <TableHead>SLA</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : paginated.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucune plainte</TableCell></TableRow>
              ) : paginated.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelected(c)}>
                  <TableCell className="font-mono text-xs font-semibold">{c.ticket_number}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{c.submitted_by_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{c.submitted_by_email}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{CATEGORY_LABELS_FIELD[c.category] ?? c.category}</Badge></TableCell>
                  <TableCell><Badge className={cn("border", priorityClass(c.priority))}>{PRIORITY_LABELS[c.priority]}</Badge></TableCell>
                  <TableCell><SlaCell deadline={c.sla_deadline} resolved={["resolved", "closed"].includes(c.status)} /></TableCell>
                  <TableCell><Badge className={statusClass(c.status)}>{STATUS_LABELS[c.status]}</Badge></TableCell>
                  <TableCell className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelected(c); }}><Eye className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelected(c); }}><Send className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
          complaint={selected as any}
          onClose={() => setSelected(null)}
          onChange={() => qc.invalidateQueries({ queryKey: ["field-complaints"] })}
          adminMode={false}
          allowInternalNotes={false}
          allowResolveOnly
        />
      )}

      {createOpen && (
        <SubmitComplaintForClientDialog
          onClose={() => setCreateOpen(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ["field-complaints"] })}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Submit a complaint on behalf of a client account                   */
/* ------------------------------------------------------------------ */

export function SubmitComplaintForClientDialog({
  onClose, onCreated,
}: { onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<any | null>(null);
  const [category, setCategory] = useState("autre");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: results = [] } = useQuery({
    queryKey: ["complaint-account-search", search],
    queryFn: async () => {
      if (search.trim().length < 2) return [];
      const term = `%${search.trim()}%`;
      const { data } = await supabase
        .from("accounts")
        .select("id, account_number, account_name, client_id, profiles!accounts_client_id_fkey(user_id, full_name, email, phone)")
        .or(`account_name.ilike.${term},account_number.ilike.${term}`)
        .limit(10);
      return (data || []) as any[];
    },
    enabled: search.trim().length >= 2 && !picked,
  });

  const submit = async () => {
    if (!picked || !subject.trim() || description.trim().length < 20) {
      toast.error("Sélectionne un client, ajoute un sujet et une description (≥ 20 caractères).");
      return;
    }
    setBusy(true);
    try {
      const prof = picked.profiles;
      const { data: created, error } = await supabase.from("complaints" as any).insert({
        account_id: picked.id,
        submitted_by_user_id: user?.id ?? null,
        submitted_by_name: prof?.full_name ?? picked.account_name,
        submitted_by_email: prof?.email ?? "",
        submitted_by_phone: prof?.phone ?? null,
        category,
        priority: "normal",
        status: "new",
        subject: subject.trim(),
        description: description.trim(),
      } as any).select("id, ticket_number").single();
      if (error) throw error;

      // Confirmation to client
      if (prof?.email) {
        await supabase.from("email_queue").insert({
          event_key: `complaint_confirmation_${(created as any).id}`,
          to_email: prof.email,
          template_key: "complaint_confirmation",
          template_vars: {
            first_name: (prof.full_name ?? "Client").split(" ")[0],
            ticket_number: (created as any).ticket_number,
            subject: subject.trim(),
            category_label: category,
          },
          status: "queued",
        } as any);
      }
      toast.success(`Plainte ${(created as any).ticket_number} créée`);
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Soumettre une plainte client</DialogTitle></DialogHeader>

        {!picked ? (
          <div className="space-y-2">
            <Label>Rechercher un compte client (nom ou n° compte)</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ex: Jean Tremblay, ACC-12345…" autoFocus />
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {results.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">{search.length < 2 ? "Tape au moins 2 caractères" : "Aucun résultat"}</div>
              ) : results.map((r) => (
                <button key={r.id} onClick={() => setPicked(r)} className="w-full text-left p-3 hover:bg-muted border-b last:border-0">
                  <div className="font-medium text-sm">{r.account_name}</div>
                  <div className="text-xs text-muted-foreground">{r.account_number} · {r.profiles?.email ?? "—"}</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Card className="bg-muted/40"><CardContent className="p-3 text-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{picked.account_name}</div>
                  <div className="text-xs text-muted-foreground">{picked.account_number} · {picked.profiles?.email ?? "—"}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>Changer</Button>
              </div>
            </CardContent></Card>

            <div>
              <Label>Catégorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS_FIELD).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sujet</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} />
            </div>
            <div>
              <Label>Description ({description.length}/2000)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} maxLength={2000} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={submit} disabled={busy || !picked}>
            {busy ? <Loader className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Créer la plainte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
