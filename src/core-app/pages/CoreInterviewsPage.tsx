/**
 * CoreInterviewsPage — AI Interview System dashboard.
 * Manages job_applicants: invites candidates (bulk + individual),
 * 4-tab detail view (Profil / Entrevue / Emails / Actions),
 * CSV export, accept/reject decisions.
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Brain, Send, Loader2, Mail, CheckCircle2, XCircle, Eye, AlertTriangle, Copy,
  Download, ExternalLink, Save, User, MessageSquare, FileText,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  new: { label: "Nouveau", color: "bg-slate-500/15 text-slate-600 border-slate-500/30" },
  invited: { label: "Invité", color: "bg-sky-500/15 text-sky-600 border-sky-500/30" },
  interview_started: { label: "Entrevue en cours", color: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  interview_completed: { label: "Entrevue complétée", color: "bg-violet-500/15 text-violet-600 border-violet-500/30" },
  accepted: { label: "Accepté", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  rejected: { label: "Refusé", color: "bg-red-500/15 text-red-600 border-red-500/30" },
  hired: { label: "Embauché", color: "bg-emerald-600/15 text-emerald-700 border-emerald-600/30" },
};

const REC_COLOR: Record<string, string> = {
  hire: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  interview_human: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  reject: "bg-red-500/15 text-red-600 border-red-500/30",
};

const csvEscape = (v: any) => {
  if (v == null) return "";
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
};

export default function CoreInterviewsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<any | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [notesDraft, setNotesDraft] = useState("");

  const { data: applicants = [], isLoading } = useQuery({
    queryKey: ["job-applicants-interviews"],
    queryFn: async () => {
      const { data } = await supabase
        .from("job_applicants")
        .select("*")
        .order("applied_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
  });

  const { data: answers = [] } = useQuery({
    enabled: !!selected,
    queryKey: ["interview-answers", selected?.id],
    queryFn: async () => {
      if (!selected) return [];
      const { data } = await supabase
        .from("interview_answers")
        .select("*, interview_questions(question_fr, question_en, category)")
        .eq("applicant_id", selected.id)
        .order("answered_at");
      return data ?? [];
    },
  });

  const { data: applicantEmails = [] } = useQuery({
    enabled: !!selected,
    queryKey: ["applicant-emails", selected?.id],
    queryFn: async () => {
      if (!selected) return [];
      const { data } = await supabase
        .from("applicant_emails")
        .select("*")
        .eq("applicant_id", selected.id)
        .order("sent_at", { ascending: false });
      return data ?? [];
    },
  });

  const sendInvite = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.functions.invoke("interview-send-invitations", {
        body: { applicant_ids: ids },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { sent: number; errors: string[] };
    },
    onSuccess: (data) => {
      toast.success(`${data.sent} invitation(s) envoyée(s)`);
      if (data.errors?.length) toast.warning("Quelques erreurs", { description: data.errors.slice(0, 3).join("\n") });
      qc.invalidateQueries({ queryKey: ["job-applicants-interviews"] });
      setSelectedIds(new Set());
    },
    onError: (e: any) => toast.error("Erreur envoi", { description: e.message }),
  });

  const saveNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase.from("job_applicants").update({ notes }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notes sauvegardées");
      qc.invalidateQueries({ queryKey: ["job-applicants-interviews"] });
    },
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });

  const decision = useMutation({
    mutationFn: async ({ id, decision }: { id: string; decision: "accept" | "reject" }) => {
      const status = decision === "accept" ? "accepted" : "rejected";
      const { data: a } = await supabase
        .from("job_applicants")
        .select("first_name, last_name, email, interview_language")
        .eq("id", id).single();
      if (!a) throw new Error("Candidat introuvable");

      const { error } = await supabase
        .from("job_applicants")
        .update({ status, [`${decision === "accept" ? "accepted" : "rejected"}_at`]: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;

      await supabase.from("email_queue").insert({
        event_key: `applicant_${decision}_${id}_${Date.now()}`,
        to_email: a.email,
        template_key: decision === "accept" ? "applicant_accepted" : "applicant_rejected",
        template_vars: { first_name: a.first_name, last_name: a.last_name },
        language: a.interview_language || "fr",
        status: "queued",
      });
      await supabase.from("applicant_emails").insert({
        applicant_id: id,
        email_type: decision === "accept" ? "applicant_accepted" : "applicant_rejected",
        sent_to: a.email,
        status: "queued",
        subject: decision === "accept"
          ? "Félicitations — Bienvenue chez Nivra"
          : "Suite à votre candidature chez Nivra",
      });
    },
    onSuccess: () => {
      toast.success("Décision enregistrée et courriel envoyé");
      qc.invalidateQueries({ queryKey: ["job-applicants-interviews"] });
      setSelected(null);
    },
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });

  const filtered = useMemo(() => {
    return applicants.filter((a: any) => {
      if (statusFilter !== "all" && (a.status || "new") !== statusFilter) return false;
      if (!search) return true;
      const s = search.toLowerCase();
      return (a.first_name || "").toLowerCase().includes(s)
        || (a.last_name || "").toLowerCase().includes(s)
        || (a.email || "").toLowerCase().includes(s);
    });
  }, [applicants, search, statusFilter]);

  const stats = useMemo(() => {
    const c = { total: applicants.length, new: 0, invited: 0, completed: 0, accepted: 0, rejected: 0 };
    applicants.forEach((a: any) => {
      const s = a.status || "new";
      if (s === "new") c.new++;
      else if (s === "invited" || s === "interview_started") c.invited++;
      else if (s === "interview_completed") c.completed++;
      else if (s === "accepted" || s === "hired") c.accepted++;
      else if (s === "rejected") c.rejected++;
    });
    return c;
  }, [applicants]);

  const sendAllNew = async () => {
    const ids = applicants.filter((a: any) => (a.status || "new") === "new" && !a.invitation_sent_at).map((a: any) => a.id);
    if (ids.length === 0) { toast.info("Aucun nouveau candidat à inviter"); return; }
    setBulkSending(true);
    try { await sendInvite.mutateAsync(ids); } finally { setBulkSending(false); }
  };

  const sendBulkSelected = async () => {
    if (selectedIds.size === 0) return;
    setBulkSending(true);
    try { await sendInvite.mutateAsync(Array.from(selectedIds)); } finally { setBulkSending(false); }
  };

  const copyInterviewLink = (a: any) => {
    const url = `${window.location.origin}/entrevue/${a.interview_token}`;
    navigator.clipboard.writeText(url);
    toast.success("Lien copié");
  };

  const exportCSV = () => {
    const header = [
      "Nom", "Email", "Téléphone", "Ville", "Statut",
      "Score", "Recommandation", "Date candidature",
      "Date entrevue", "Date invitation",
    ];
    const rows = applicants.map((a: any) => [
      `${a.first_name || ""} ${a.last_name || ""}`.trim(),
      a.email || "",
      a.phone || "",
      a.city || "",
      STATUS_LABEL[a.status || "new"]?.label || a.status || "",
      a.interview_score ?? "",
      a.interview_recommendation || "",
      a.applied_at ? format(new Date(a.applied_at), "yyyy-MM-dd HH:mm") : "",
      a.interview_completed_at ? format(new Date(a.interview_completed_at), "yyyy-MM-dd HH:mm") : "",
      a.invitation_sent_at ? format(new Date(a.invitation_sent_at), "yyyy-MM-dd HH:mm") : "",
    ]);
    const csv = [header, ...rows].map(r => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `candidats-nivra-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} candidat(s) exporté(s)`);
  };

  const toggleRow = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((a: any) => a.id)));
  };

  const openDetail = (a: any) => {
    setSelected(a);
    setNotesDraft(a.notes || "");
  };

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Entrevues IA — Agents commerciaux
          </h1>
          <p className="text-xs text-muted-foreground">
            Système d'entrevue automatisé. Évaluation IA + décision humaine.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5 mr-1" /> Exporter CSV
          </Button>
          <Button size="sm" onClick={sendAllNew} disabled={bulkSending || sendInvite.isPending}>
            {bulkSending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
            Inviter tous les nouveaux ({stats.new})
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {[
          { k: "all", l: "Total", v: stats.total, color: "bg-slate-500/10 text-slate-700" },
          { k: "new", l: "Nouveaux", v: stats.new, color: "bg-blue-500/10 text-blue-700" },
          { k: "invited", l: "Invités", v: stats.invited, color: "bg-amber-500/10 text-amber-700" },
          { k: "interview_completed", l: "Complétés", v: stats.completed, color: "bg-violet-500/10 text-violet-700" },
          { k: "accepted", l: "Acceptés", v: stats.accepted, color: "bg-emerald-500/10 text-emerald-700" },
          { k: "rejected", l: "Refusés", v: stats.rejected, color: "bg-red-500/10 text-red-700" },
        ].map(s => (
          <button
            key={s.k}
            onClick={() => setStatusFilter(s.k)}
            className={`p-2 rounded border text-left transition ${s.color} ${statusFilter === s.k ? "ring-2 ring-primary/40" : "opacity-80 hover:opacity-100"}`}
          >
            <div className="text-[10px] uppercase font-bold tracking-wide">{s.l}</div>
            <div className="text-lg font-bold">{s.v}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Rechercher par nom ou courriel…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 text-sm max-w-md"
        />
        {filtered.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox
              checked={selectedIds.size === filtered.length && filtered.length > 0}
              onCheckedChange={toggleAll}
            />
            Tout sélectionner ({filtered.length})
          </label>
        )}
      </div>

      {selectedIds.size > 0 && (
        <Card className="p-3 flex items-center justify-between bg-primary/5 border-primary/30">
          <div className="text-sm font-medium">
            {selectedIds.size} candidat(s) sélectionné(s)
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())}>
              Désélectionner
            </Button>
            <Button size="sm" onClick={sendBulkSelected} disabled={bulkSending || sendInvite.isPending}>
              {bulkSending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
              Envoyer invitations ({selectedIds.size} sélectionnés)
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">Aucun candidat trouvé.</p>
          ) : filtered.map((a: any) => {
            const st = STATUS_LABEL[a.status || "new"] || STATUS_LABEL.new;
            return (
              <Card key={a.id} className="p-3 flex items-center gap-3 hover:border-primary/40 transition-colors">
                <Checkbox
                  checked={selectedIds.has(a.id)}
                  onCheckedChange={() => toggleRow(a.id)}
                  aria-label={`Sélectionner ${a.first_name} ${a.last_name}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{a.first_name} {a.last_name}</p>
                    <Badge className={`text-[10px] ${st.color}`} variant="outline">{st.label}</Badge>
                    {a.interview_score != null && (
                      <Badge className={`text-[10px] ${REC_COLOR[a.interview_recommendation] || ""}`} variant="outline">
                        {a.interview_score}/100 • {a.interview_recommendation}
                      </Badge>
                    )}
                    {a.interview_red_flags?.length > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-700 border-red-500/30">
                        <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                        {a.interview_red_flags.length} flag(s)
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{a.email} • {a.phone || "—"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Postulé {format(new Date(a.applied_at), "d MMM yyyy", { locale: fr })}
                    {a.invitation_sent_at && ` • Invité ${format(new Date(a.invitation_sent_at), "d MMM", { locale: fr })}`}
                    {a.interview_completed_at && ` • Complété ${format(new Date(a.interview_completed_at), "d MMM", { locale: fr })}`}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => copyInterviewLink(a)} title="Copier lien">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  {(a.status || "new") === "new" && !a.invitation_sent_at && (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]"
                      disabled={sendInvite.isPending}
                      onClick={() => sendInvite.mutate([a.id])}>
                      <Send className="h-3 w-3 mr-1" /> Inviter
                    </Button>
                  )}
                  {a.invitation_sent_at && !a.interview_completed_at && (
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]"
                      disabled={sendInvite.isPending}
                      onClick={() => sendInvite.mutate([a.id])} title="Renvoyer l'invitation">
                      <Mail className="h-3 w-3 mr-1" /> Relancer
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]"
                    onClick={() => openDetail(a)}>
                    <Eye className="h-3 w-3 mr-1" /> Voir
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail dialog with 4 tabs */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              {selected?.first_name} {selected?.last_name}
              {selected?.status && (
                <Badge className={`ml-2 ${STATUS_LABEL[selected.status]?.color || ""}`} variant="outline">
                  {STATUS_LABEL[selected.status]?.label || selected.status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selected && (
            <Tabs defaultValue="profil" className="w-full">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="profil"><User className="h-3.5 w-3.5 mr-1" />Profil</TabsTrigger>
                <TabsTrigger value="entrevue"><MessageSquare className="h-3.5 w-3.5 mr-1" />Entrevue</TabsTrigger>
                <TabsTrigger value="emails"><Mail className="h-3.5 w-3.5 mr-1" />Emails</TabsTrigger>
                <TabsTrigger value="actions"><FileText className="h-3.5 w-3.5 mr-1" />Actions</TabsTrigger>
              </TabsList>

              {/* TAB: Profil */}
              <TabsContent value="profil" className="space-y-3 mt-3">
                <Card className="p-3">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Informations personnelles</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Email:</span> {selected.email}</div>
                    <div><span className="text-muted-foreground">Téléphone:</span> {selected.phone || "—"}</div>
                    <div><span className="text-muted-foreground">Ville:</span> {selected.city || "—"}</div>
                    <div><span className="text-muted-foreground">Code postal:</span> {selected.postal_code || "—"}</div>
                    <div><span className="text-muted-foreground">Langue:</span> {selected.interview_language?.toUpperCase() || "FR"}</div>
                    <div><span className="text-muted-foreground">Postulé:</span> {format(new Date(selected.applied_at), "d MMM yyyy", { locale: fr })}</div>
                  </div>
                </Card>

                <Card className="p-3">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-2">Territoire</div>
                  <div className="text-sm">
                    {selected.assigned_territory || (selected.territories?.length ? selected.territories.join(", ") : "—")}
                  </div>
                </Card>

                <Card className="p-3">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground mb-2">CV / Résumé</div>
                  {selected.resume_url ? (
                    <a href={selected.resume_url} target="_blank" rel="noopener noreferrer"
                       className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                      <ExternalLink className="h-3.5 w-3.5" /> Ouvrir le CV
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucun CV fourni</p>
                  )}
                </Card>

                <Card className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground">Notes internes (éditable)</div>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]"
                      disabled={saveNotes.isPending || notesDraft === (selected.notes || "")}
                      onClick={() => saveNotes.mutate({ id: selected.id, notes: notesDraft })}>
                      {saveNotes.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                      Sauvegarder
                    </Button>
                  </div>
                  <Textarea
                    rows={4}
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    placeholder="Notes du recruteur…"
                    className="text-sm"
                  />
                </Card>
              </TabsContent>

              {/* TAB: Entrevue */}
              <TabsContent value="entrevue" className="space-y-3 mt-3">
                <div className="grid grid-cols-3 gap-2">
                  <Card className="p-3 text-center">
                    <div className="text-[10px] uppercase text-muted-foreground">Score IA</div>
                    <div className="text-3xl font-bold text-primary">
                      {selected.interview_score ?? "—"}<span className="text-sm text-muted-foreground">/100</span>
                    </div>
                  </Card>
                  <Card className="p-3 text-center">
                    <div className="text-[10px] uppercase text-muted-foreground">Recommandation</div>
                    <Badge className={`mt-2 ${REC_COLOR[selected.interview_recommendation] || ""}`} variant="outline">
                      {selected.interview_recommendation || "—"}
                    </Badge>
                  </Card>
                  <Card className="p-3 text-center">
                    <div className="text-[10px] uppercase text-muted-foreground">Complétée</div>
                    <div className="text-sm font-medium mt-1">
                      {selected.interview_completed_at
                        ? format(new Date(selected.interview_completed_at), "d MMM yyyy", { locale: fr })
                        : "—"}
                    </div>
                  </Card>
                </div>

                {selected.interview_notes && (
                  <Card className="p-3">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Résumé IA</div>
                    <p className="text-sm">{selected.interview_notes}</p>
                  </Card>
                )}

                <div className="grid md:grid-cols-3 gap-3">
                  {selected.interview_strengths?.length > 0 && (
                    <Card className="p-3 border-emerald-500/30">
                      <div className="text-[10px] uppercase font-bold text-emerald-700 mb-1.5">Forces</div>
                      <ul className="text-xs space-y-1 list-disc pl-4">
                        {selected.interview_strengths.map((s: string, i: number) => <li key={i}>{s}</li>)}
                      </ul>
                    </Card>
                  )}
                  {selected.interview_concerns?.length > 0 && (
                    <Card className="p-3 border-amber-500/30">
                      <div className="text-[10px] uppercase font-bold text-amber-700 mb-1.5">Préoccupations</div>
                      <ul className="text-xs space-y-1 list-disc pl-4">
                        {selected.interview_concerns.map((s: string, i: number) => <li key={i}>{s}</li>)}
                      </ul>
                    </Card>
                  )}
                  {selected.interview_red_flags?.length > 0 && (
                    <Card className="p-3 border-red-500/30">
                      <div className="text-[10px] uppercase font-bold text-red-700 mb-1.5 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Drapeaux rouges
                      </div>
                      <ul className="text-xs space-y-1 list-disc pl-4">
                        {selected.interview_red_flags.map((s: string, i: number) => <li key={i}>{s}</li>)}
                      </ul>
                    </Card>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">Transcript Q&A ({answers.length})</div>
                  {answers.length === 0 && (
                    <p className="text-sm text-muted-foreground italic">Aucune réponse encore.</p>
                  )}
                  {answers.map((ans: any, i: number) => (
                    <Card key={ans.id} className="p-3">
                      <div className="text-[10px] uppercase text-muted-foreground mb-1">
                        Q{i + 1} • {ans.interview_questions?.category}
                      </div>
                      <p className="text-xs font-medium mb-1.5">
                        {(selected.interview_language === "en"
                          ? ans.interview_questions?.question_en
                          : ans.interview_questions?.question_fr) || "—"}
                      </p>
                      <p className="text-sm whitespace-pre-wrap text-foreground/90">{ans.answer_text}</p>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              {/* TAB: Emails */}
              <TabsContent value="emails" className="space-y-2 mt-3">
                <div className="text-[10px] uppercase font-bold text-muted-foreground">
                  Historique des courriels ({applicantEmails.length})
                </div>
                {applicantEmails.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-6 text-center">Aucun courriel envoyé.</p>
                ) : (
                  applicantEmails.map((e: any) => (
                    <Card key={e.id} className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline" className="text-[10px]">{e.email_type}</Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {e.sent_at ? format(new Date(e.sent_at), "d MMM yyyy HH:mm", { locale: fr }) : "—"}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{e.subject || "—"}</p>
                      <p className="text-xs text-muted-foreground">À: {e.sent_to} • Statut: {e.status || "sent"}</p>
                    </Card>
                  ))
                )}
              </TabsContent>

              {/* TAB: Actions */}
              <TabsContent value="actions" className="space-y-3 mt-3">
                <Card className="p-4 space-y-3">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground">Actions de recrutement</div>

                  <div className="grid grid-cols-1 gap-2">
                    <Button variant="outline" onClick={() => copyInterviewLink(selected)}>
                      <Copy className="h-4 w-4 mr-2" /> Copier le lien d'entrevue
                    </Button>

                    {!selected.invitation_sent_at && (
                      <Button variant="outline"
                        disabled={sendInvite.isPending}
                        onClick={() => sendInvite.mutate([selected.id])}>
                        <Send className="h-4 w-4 mr-2" /> Envoyer l'invitation
                      </Button>
                    )}

                    {selected.invitation_sent_at && !selected.interview_completed_at && (
                      <Button variant="outline"
                        disabled={sendInvite.isPending}
                        onClick={() => sendInvite.mutate([selected.id])}>
                        <Mail className="h-4 w-4 mr-2" /> Renvoyer l'invitation
                      </Button>
                    )}

                    {selected.status === "interview_completed" && (
                      <>
                        <Button
                          className="bg-emerald-600 hover:bg-emerald-700"
                          disabled={decision.isPending}
                          onClick={() => decision.mutate({ id: selected.id, decision: "accept" })}>
                          <CheckCircle2 className="h-4 w-4 mr-2" /> Accepter le candidat
                        </Button>
                        <Button
                          variant="destructive"
                          disabled={decision.isPending}
                          onClick={() => decision.mutate({ id: selected.id, decision: "reject" })}>
                          <XCircle className="h-4 w-4 mr-2" /> Refuser le candidat
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
