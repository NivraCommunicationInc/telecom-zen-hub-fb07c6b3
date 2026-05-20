/**
 * CoreApplicationsPage — Recruitment pipeline: kanban-style stages with hire workflow.
 * Phase 8 rebuild — move stage, reject, hire (creates employee_records).
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus, Search, Loader2, Download, ArrowRight, Check, X, Mail, Phone, Briefcase,
  Calendar, FileText, Eye, AlertCircle, ClipboardCheck, CalendarPlus, Send, UserCheck,
  MailCheck, CheckCircle2, ExternalLink, RotateCcw,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { corePath } from "@/core-app/lib/corePaths";

const STAGES = [
  { key: "new", label: "Nouvelles", color: "bg-sky-500/15 text-sky-600 border-sky-500/30" },
  { key: "reviewing", label: "Examen", color: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
  { key: "interview", label: "Entrevue", color: "bg-violet-500/15 text-violet-600 border-violet-500/30" },
  { key: "offer", label: "Offre", color: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  { key: "hired", label: "Embauché", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  { key: "rejected", label: "Refusé", color: "bg-red-500/15 text-red-600 border-red-500/30" },
];

const NEXT_STAGE: Record<string, string | null> = {
  new: "reviewing",
  reviewing: "interview",
  interview: "offer",
  offer: "hired",
  hired: null,
  rejected: null,
};

const WORKFLOW_STEPS = [
  { stage: "reviewing", title: "1. Examen RH", text: "Lire le formulaire, CV, notes et qualifier le candidat.", icon: ClipboardCheck },
  { stage: "interview", title: "2. Entrevue", text: "Planifier l'entrevue et garder la date au dossier.", icon: CalendarPlus },
  { stage: "offer", title: "3. Offre", text: "Préparer l'offre et confirmer les conditions avant embauche.", icon: Send },
  { stage: "hired", title: "4. Embauche", text: "Créer l'employé, son rôle et envoyer l'invitation portail.", icon: UserCheck },
];

const getStageKey = (app: any) => app?.stage || app?.status || "new";

const mergeTags = (tags: string[] | null | undefined, next: string) => {
  const current = Array.isArray(tags) ? tags : [];
  return current.includes(next) ? current : [...current, next];
};

export default function CoreApplicationsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [hireApp, setHireApp] = useState<any | null>(null);
  const [detailApp, setDetailApp] = useState<any | null>(null);
  const [workflowApp, setWorkflowApp] = useState<any | null>(null);
  const [workflowAction, setWorkflowAction] = useState<"interview" | "offer" | "reject" | null>(null);
  const [workflowForm, setWorkflowForm] = useState({
    interview_date: "",
    offer_note: "",
    rejection_reason: "",
  });
  const [hireForm, setHireForm] = useState({
    first_name: "", last_name: "", work_email: "",
    job_title: "", department: "", hire_date: format(new Date(), "yyyy-MM-dd"),
    employment_type: "full-time", hourly_rate: "",
    role: "employee" as "employee" | "admin" | "field_sales",
  });

  const { data: apps = [], isLoading, isError, error } = useQuery({
    queryKey: ["core-applications-pipeline"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_applications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["core-applications-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("jobs").select("id, title");
      if (error) throw error;
      return data ?? [];
    },
  });
  const jobMap = Object.fromEntries(jobs.map((j: any) => [j.id, j.title]));

  const moveStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("job_applications")
        .update({
          stage,
          status: stage,
          stage_changed_at: new Date().toISOString(),
          stage_changed_by: user?.id ?? null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Étape mise à jour");
      qc.invalidateQueries({ queryKey: ["core-applications-pipeline"] });
    },
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });

  const workflowMut = useMutation({
    mutationFn: async ({ app, action }: { app: any; action: "interview" | "offer" | "reject" }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const baseUpdate: Record<string, any> = {
        stage_changed_at: new Date().toISOString(),
        stage_changed_by: user?.id ?? null,
      };

      if (action === "interview") {
        if (!workflowForm.interview_date) throw new Error("Choisis une date d'entrevue.");
        Object.assign(baseUpdate, {
          stage: "interview",
          status: "interview",
          interview_date: new Date(workflowForm.interview_date).toISOString(),
          tags: mergeTags(app.tags, "entrevue_planifiee"),
        });
      }

      if (action === "offer") {
        Object.assign(baseUpdate, {
          stage: "offer",
          status: "offer",
          message: workflowForm.offer_note?.trim()
            ? `${app.message || ""}\n\n[Note RH - offre]\n${workflowForm.offer_note.trim()}`.trim()
            : app.message,
          tags: mergeTags(app.tags, "offre_a_envoyer"),
        });
      }

      if (action === "reject") {
        if (!workflowForm.rejection_reason.trim()) throw new Error("Ajoute un motif de refus.");
        Object.assign(baseUpdate, {
          stage: "rejected",
          status: "rejected",
          rejection_reason: workflowForm.rejection_reason.trim(),
        });
      }

      const { error } = await supabase.from("job_applications").update(baseUpdate).eq("id", app.id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      const labels = {
        interview: "Entrevue planifiée",
        offer: "Candidat passé en offre",
        reject: "Candidature refusée",
      } as const;
      toast.success(labels[variables.action]);
      qc.invalidateQueries({ queryKey: ["core-applications-pipeline"] });
      setWorkflowApp(null);
      setWorkflowAction(null);
    },
    onError: (e: any) => toast.error("Action impossible", { description: e.message }),
  });

  const hireMut = useMutation({
    mutationFn: async () => {
      if (!hireApp) throw new Error("Pas d'application sélectionnée");
      if (!hireForm.work_email?.trim()) {
        throw new Error("Email professionnel requis pour créer le compte portail");
      }

      // Map UI employment_type → backend enum
      const empTypeMap: Record<string, string> = {
        "full-time": "full_time",
        "part-time": "part_time",
        "contractor": "contractor",
      };

      const { data, error } = await supabase.functions.invoke("hr-create-employee", {
        body: {
          first_name: hireForm.first_name,
          last_name: hireForm.last_name,
          work_email: hireForm.work_email.trim().toLowerCase(),
          phone: hireApp.phone || undefined,
          job_title: hireForm.job_title || undefined,
          department: hireForm.department || undefined,
          hire_date: hireForm.hire_date,
          employment_type: empTypeMap[hireForm.employment_type] || "full_time",
          salary_type: hireForm.hourly_rate ? "hourly" : "salary",
          hourly_rate: hireForm.hourly_rate ? Number(hireForm.hourly_rate) : undefined,
          roles: [hireForm.role],
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Échec de la création de l'employé");

      // Link the application to the new employee record
      const { data: { user } } = await supabase.auth.getUser();
      await supabase
        .from("job_applications")
        .update({
          stage: "hired",
          status: "hired",
          hired_employee_id: data.employee.id,
          stage_changed_at: new Date().toISOString(),
          stage_changed_by: user?.id ?? null,
        })
        .eq("id", hireApp.id);

      return data.employee;
    },
    onSuccess: (emp: any) => {
      toast.success("Candidat embauché", {
        description: `Employé ${emp?.employee_number || ""} créé · invitation portail envoyée à ${emp?.email || ""}`,
      });
      qc.invalidateQueries({ queryKey: ["core-applications-pipeline"] });
      setHireApp(null);
    },
    onError: (e: any) => toast.error("Erreur d'embauche", { description: e.message }),
  });

  const filtered = apps.filter((a: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (a.full_name || "").toLowerCase().includes(s)
      || (a.email || "").toLowerCase().includes(s)
      || (a.position || "").toLowerCase().includes(s);
  });

  const byStage = (stage: string) => filtered.filter((a: any) => (a.stage || a.status || "new") === stage);

  const stats = useMemo(() => {
    const active = filtered.filter((a: any) => !["hired", "rejected"].includes(getStageKey(a))).length;
    const interviews = filtered.filter((a: any) => getStageKey(a) === "interview" || a.interview_date).length;
    const offers = filtered.filter((a: any) => getStageKey(a) === "offer").length;
    const hired = filtered.filter((a: any) => getStageKey(a) === "hired").length;
    return { active, interviews, offers, hired };
  }, [filtered]);

  const downloadCv = async (path: string) => {
    if (!path) return;
    const { data, error } = await supabase.storage.from("job-applications").createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Impossible d'ouvrir le CV", { description: error?.message });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const startHire = (a: any) => {
    const [first, ...rest] = (a.full_name || "").split(" ");
    setHireForm({
      first_name: first || "",
      last_name: rest.join(" ") || "",
      work_email: "",
      job_title: a.position || jobMap[a.job_id] || "",
      department: "",
      hire_date: format(new Date(), "yyyy-MM-dd"),
      employment_type: "full-time",
      hourly_rate: "",
      role: "employee",
    });
    setHireApp(a);
  };

  const openWorkflow = (app: any, action: "interview" | "offer" | "reject") => {
    const currentInterviewDate = app.interview_date
      ? format(new Date(app.interview_date), "yyyy-MM-dd'T'HH:mm")
      : "";
    setWorkflowForm({
      interview_date: currentInterviewDate,
      offer_note: "",
      rejection_reason: app.rejection_reason || "",
    });
    setWorkflowApp(app);
    setWorkflowAction(action);
  };

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Pipeline candidatures
          </h1>
          <p className="text-xs text-muted-foreground">{apps.length} candidature(s) au total</p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-xs" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <Card className="border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Impossible de charger les candidatures</p>
              <p className="text-xs text-muted-foreground">
                Ton compte doit avoir un rôle interne actif avec accès Nivra Core/RH. Détail: {(error as Error)?.message || "accès refusé"}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {STAGES.map((stage) => {
            const items = byStage(stage.key);
            return (
              <div key={stage.key} className="space-y-2">
                <div className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded border ${stage.color}`}>
                  {stage.label} ({items.length})
                </div>
                <div className="space-y-1.5 min-h-[100px]">
                  {items.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground text-center py-3">—</p>
                  ) : items.map((a: any) => (
                    <Card
                      key={a.id}
                      className="p-2 hover:border-primary/40 transition-colors cursor-pointer"
                      onClick={() => setDetailApp(a)}
                    >
                      <p className="text-xs font-medium text-foreground truncate">{a.full_name || "Anonyme"}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{a.email}</p>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {a.position || jobMap[a.job_id] || "—"}
                      </p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        {format(new Date(a.created_at), "d MMM", { locale: fr })}
                      </p>
                      <div className="flex gap-1 mt-1.5" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" className="h-5 w-5 p-0"
                          onClick={() => setDetailApp(a)} title="Voir le formulaire">
                          <Eye className="h-3 w-3" />
                        </Button>
                        {a.cv_path && (
                          <Button size="sm" variant="ghost" className="h-5 w-5 p-0"
                            onClick={() => downloadCv(a.cv_path)} title="CV">
                            <Download className="h-3 w-3" />
                          </Button>
                        )}
                        {NEXT_STAGE[stage.key] && (
                          <Button size="sm" variant="ghost" className="h-5 px-1 text-[9px] gap-0.5"
                            disabled={moveStage.isPending}
                            onClick={() => {
                              if (NEXT_STAGE[stage.key] === "hired") startHire(a);
                              else moveStage.mutate({ id: a.id, stage: NEXT_STAGE[stage.key]! });
                            }}>
                            <ArrowRight className="h-2.5 w-2.5" />
                            {NEXT_STAGE[stage.key] === "hired" ? "Embaucher" : "Suivant"}
                          </Button>
                        )}
                        {stage.key !== "rejected" && stage.key !== "hired" && (
                          <Button size="sm" variant="ghost" className="h-5 w-5 p-0 text-destructive"
                            disabled={moveStage.isPending}
                            onClick={() => moveStage.mutate({ id: a.id, stage: "rejected" })}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail dialog — voir le formulaire complet */}
      <Dialog open={!!detailApp} onOpenChange={(o) => !o && setDetailApp(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              {detailApp?.full_name || "Candidature"}
            </DialogTitle>
            <DialogDescription>
              Formulaire soumis le{" "}
              {detailApp && format(new Date(detailApp.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
            </DialogDescription>
          </DialogHeader>

          {detailApp && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  Étape : {STAGES.find(s => s.key === (detailApp.stage || detailApp.status))?.label || detailApp.stage || detailApp.status}
                </Badge>
                {detailApp.source && <Badge variant="secondary">Source : {detailApp.source}</Badge>}
                {detailApp.score != null && <Badge>Score : {detailApp.score}</Badge>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border p-3 bg-muted/30">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" /> Courriel
                  </Label>
                  <a href={`mailto:${detailApp.email}`} className="text-sm text-primary hover:underline break-all">
                    {detailApp.email}
                  </a>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3 w-3" /> Téléphone
                  </Label>
                  <a href={`tel:${detailApp.phone}`} className="text-sm text-foreground">
                    {detailApp.phone || "—"}
                  </a>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                    <Briefcase className="h-3 w-3" /> Poste visé
                  </Label>
                  <p className="text-sm text-foreground">
                    {detailApp.position || jobMap[detailApp.job_id] || "Candidature spontanée"}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Soumise
                  </Label>
                  <p className="text-sm text-foreground">
                    {format(new Date(detailApp.created_at), "d MMM yyyy, HH:mm", { locale: fr })}
                  </p>
                </div>
              </div>

              {detailApp.message && (
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground">Message du candidat</Label>
                  <div className="rounded-lg border p-3 bg-background text-sm whitespace-pre-wrap text-foreground">
                    {detailApp.message}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Curriculum Vitae
                </Label>
                {detailApp.cv_path ? (
                  <Button variant="outline" size="sm" onClick={() => downloadCv(detailApp.cv_path)}>
                    <Download className="h-3.5 w-3.5 mr-2" />
                    Télécharger {detailApp.cv_filename || "le CV"}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Aucun CV fourni</p>
                )}
              </div>

              {detailApp.rejection_reason && (
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase text-destructive">Motif de refus</Label>
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">
                    {detailApp.rejection_reason}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setDetailApp(null)}>Fermer</Button>
            {detailApp && NEXT_STAGE[detailApp.stage || detailApp.status || "new"] && (
              <Button size="sm" disabled={moveStage.isPending}
                onClick={() => {
                  const next = NEXT_STAGE[detailApp.stage || detailApp.status || "new"]!;
                  if (next === "hired") { startHire(detailApp); setDetailApp(null); }
                  else { moveStage.mutate({ id: detailApp.id, stage: next }); setDetailApp(null); }
                }}>
                <ArrowRight className="h-3.5 w-3.5 mr-1" />
                Passer à : {STAGES.find(s => s.key === NEXT_STAGE[detailApp.stage || detailApp.status || "new"])?.label}
              </Button>
            )}
            {detailApp && detailApp.stage !== "rejected" && detailApp.stage !== "hired" && (
              <Button variant="destructive" size="sm" disabled={moveStage.isPending}
                onClick={() => { moveStage.mutate({ id: detailApp.id, stage: "rejected" }); setDetailApp(null); }}>
                <X className="h-3.5 w-3.5 mr-1" />
                Refuser
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hire dialog */}
      <Dialog open={!!hireApp} onOpenChange={(o) => !o && setHireApp(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Embaucher {hireApp?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Prénom *</Label>
                <Input value={hireForm.first_name} onChange={(e) => setHireForm({ ...hireForm, first_name: e.target.value })} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Nom *</Label>
                <Input value={hireForm.last_name} onChange={(e) => setHireForm({ ...hireForm, last_name: e.target.value })} className="h-8 text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Courriel professionnel * <span className="text-muted-foreground font-normal">(utilisé pour l'invitation portail)</span></Label>
              <Input type="email" required value={hireForm.work_email} onChange={(e) => setHireForm({ ...hireForm, work_email: e.target.value })} className="h-8 text-xs" placeholder="prenom.nom@nivra-telecom.ca" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Rôle / Portail d'accès *</Label>
              <Select value={hireForm.role} onValueChange={(v: any) => setHireForm({ ...hireForm, role: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employé — portail Employé + RH</SelectItem>
                  <SelectItem value="field_sales">Représentant terrain — portail Field</SelectItem>
                  <SelectItem value="admin">Administrateur — accès Core complet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Poste</Label>
                <Input value={hireForm.job_title} onChange={(e) => setHireForm({ ...hireForm, job_title: e.target.value })} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Département</Label>
                <Input value={hireForm.department} onChange={(e) => setHireForm({ ...hireForm, department: e.target.value })} className="h-8 text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Date d'embauche *</Label>
                <Input type="date" value={hireForm.hire_date} onChange={(e) => setHireForm({ ...hireForm, hire_date: e.target.value })} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={hireForm.employment_type} onValueChange={(v) => setHireForm({ ...hireForm, employment_type: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-time">Plein temps</SelectItem>
                    <SelectItem value="part-time">Temps partiel</SelectItem>
                    <SelectItem value="contractor">Contractuel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Taux horaire ($)</Label>
                <Input type="number" step="0.01" value={hireForm.hourly_rate} onChange={(e) => setHireForm({ ...hireForm, hourly_rate: e.target.value })} className="h-8 text-xs" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setHireApp(null)}>Annuler</Button>
            <Button size="sm" disabled={!hireForm.first_name || !hireForm.last_name || !hireForm.work_email || hireMut.isPending}
              onClick={() => hireMut.mutate()}>
              {hireMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1" />Embaucher</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
