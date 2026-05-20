/**
 * CoreCareersPage — Recruitment hub.
 * Sections:
 *  1. Active job postings table (CRUD + status + applications count)
 *  2. Application pipeline kanban (per posting) with stage transitions
 *  3. Application detail panel (CV download, notes, hire/reject actions)
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Briefcase, Plus, Pencil, MapPin, Users, X, Loader2, Pause, Play,
  Eye, Download, Calendar, UserPlus, Mail, FileText, MessageSquare,
  ExternalLink, Brain, Globe, ClipboardList, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { corePath } from "@/core-app/lib/corePaths";

// ─── Static labels ──────────────────────────────────────────────────────────
const TYPE_LABEL: Record<string, string> = {
  "full-time": "Temps plein",
  "part-time": "Temps partiel",
  "field-agent": "Agent terrain",
  "technician": "Technicien",
  "internship": "Stage",
  "contract": "Contractuel",
};

const DEPARTMENTS = ["Ventes", "Support", "Opérations", "Administration", "Terrain", "Technique"];
const LOCATIONS = ["Montréal", "Québec", "Remote", "Hybride"];

const STAGES = [
  { key: "new", label: "Nouveau", tone: "bg-blue-500" },
  { key: "reviewing", label: "En révision", tone: "bg-amber-500" },
  { key: "interview", label: "Entrevue", tone: "bg-purple-500" },
  { key: "offer", label: "Offre envoyée", tone: "bg-cyan-500" },
  { key: "hired", label: "Embauché", tone: "bg-green-600" },
  { key: "rejected", label: "Refusé", tone: "bg-red-500" },
] as const;

// ─── Types ──────────────────────────────────────────────────────────────────
type JobForm = {
  title: string;
  department: string;
  location: string;
  type: string;
  description: string;
  requirements: string;
  salary_min: string;
  salary_max: string;
  expires_at: string;
  is_active: boolean;
};

const EMPTY_FORM: JobForm = {
  title: "", department: "", location: "", type: "full-time",
  description: "", requirements: "", salary_min: "", salary_max: "",
  expires_at: "", is_active: true,
};

type Job = {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  type: string;
  description: string | null;
  requirements: string | null;
  salary_min: number | null;
  salary_max: number | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

type Application = {
  id: string;
  job_id: string | null;
  position: string;
  full_name: string;
  email: string;
  phone: string;
  message: string | null;
  cv_path: string | null;
  cv_filename: string | null;
  stage: string;
  status: string;
  interview_date: string | null;
  rejection_reason: string | null;
  hired_employee_id: string | null;
  created_at: string;
};

type HireForm = {
  email: string;
  full_name: string;
  phone: string;
  role: string;
  department: string;
  start_date: string;
  hourly_rate: string;
};

// ─── Utils ──────────────────────────────────────────────────────────────────
function jobStatus(j: Job): "active" | "paused" | "closed" {
  if (!j.is_active) return "closed";
  if (j.expires_at && new Date(j.expires_at) < new Date()) return "closed";
  return "active";
}

function salaryRange(j: Job): string {
  if (j.salary_min && j.salary_max) return `${j.salary_min}$ – ${j.salary_max}$`;
  if (j.salary_min) return `Dès ${j.salary_min}$`;
  if (j.salary_max) return `Jusqu'à ${j.salary_max}$`;
  return "—";
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function CoreCareersPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [form, setForm] = useState<JobForm>(EMPTY_FORM);

  // Pipeline view state
  const [pipelineJob, setPipelineJob] = useState<Job | null>(null);
  const [openApp, setOpenApp] = useState<Application | null>(null);
  const [newNote, setNewNote] = useState("");

  // Reject / interview / hire dialogs
  const [rejectFor, setRejectFor] = useState<Application | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [interviewFor, setInterviewFor] = useState<Application | null>(null);
  const [interviewDate, setInterviewDate] = useState("");
  const [hireFor, setHireFor] = useState<Application | null>(null);
  const [hireForm, setHireForm] = useState<HireForm>({
    email: "", full_name: "", phone: "", role: "employee", department: "",
    start_date: format(new Date(), "yyyy-MM-dd"), hourly_rate: "",
  });

  // ─── Queries ─────────────────────────────────────────────────────────────
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["core-careers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Job[];
    },
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["core-careers-app-counts", jobs.map((j) => j.id).join(",")],
    enabled: jobs.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("job_applications")
        .select("job_id")
        .in("job_id", jobs.map((j) => j.id));
      const map: Record<string, number> = {};
      for (const a of data ?? []) {
        if (a.job_id) map[a.job_id] = (map[a.job_id] ?? 0) + 1;
      }
      return map;
    },
  });

  const { data: applications = [], isLoading: loadingApps } = useQuery({
    queryKey: ["core-careers-apps", pipelineJob?.id],
    enabled: !!pipelineJob,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_applications")
        .select("*")
        .eq("job_id", pipelineJob!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Application[];
    },
  });

  const { data: notes = [] } = useQuery({
    queryKey: ["core-careers-notes", openApp?.id],
    enabled: !!openApp,
    queryFn: async () => {
      const { data } = await supabase
        .from("job_application_notes")
        .select("*")
        .eq("application_id", openApp!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // ─── Mutations: jobs CRUD ────────────────────────────────────────────────
  const saveJob = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title: form.title,
        department: form.department || null,
        location: form.location || null,
        type: form.type,
        description: form.description || null,
        requirements: form.requirements || null,
        salary_min: form.salary_min ? Number(form.salary_min) : null,
        salary_max: form.salary_max ? Number(form.salary_max) : null,
        expires_at: form.expires_at || null,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase.from("jobs").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("jobs").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Poste mis à jour" : "Poste créé");
      qc.invalidateQueries({ queryKey: ["core-careers"] });
      setShowForm(false); setEditing(null); setForm(EMPTY_FORM);
    },
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });

  const togglePause = useMutation({
    mutationFn: async (j: Job) => {
      const { error } = await supabase.from("jobs").update({ is_active: !j.is_active }).eq("id", j.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Statut mis à jour");
      qc.invalidateQueries({ queryKey: ["core-careers"] });
    },
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });

  const closeJob = useMutation({
    mutationFn: async (j: Job) => {
      const { error } = await supabase
        .from("jobs")
        .update({ is_active: false, expires_at: format(new Date(), "yyyy-MM-dd") })
        .eq("id", j.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Poste fermé");
      qc.invalidateQueries({ queryKey: ["core-careers"] });
    },
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });

  // ─── Mutations: pipeline ─────────────────────────────────────────────────
  const updateStage = useMutation({
    mutationFn: async (vars: { app: Application; stage: string }) => {
      const { error } = await supabase
        .from("job_applications")
        .update({
          stage: vars.stage,
          status: vars.stage,
          stage_changed_at: new Date().toISOString(),
        })
        .eq("id", vars.app.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Étape mise à jour");
      qc.invalidateQueries({ queryKey: ["core-careers-apps"] });
      setOpenApp(null);
    },
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });

  const scheduleInterview = useMutation({
    mutationFn: async () => {
      if (!interviewFor || !interviewDate) throw new Error("Date requise");
      const { error } = await supabase
        .from("job_applications")
        .update({
          interview_date: new Date(interviewDate).toISOString(),
          stage: "interview",
          status: "interview",
          stage_changed_at: new Date().toISOString(),
        })
        .eq("id", interviewFor.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entrevue planifiée");
      qc.invalidateQueries({ queryKey: ["core-careers-apps"] });
      setInterviewFor(null); setInterviewDate("");
    },
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });

  const sendOffer = useMutation({
    mutationFn: async (app: Application) => {
      const { error } = await supabase
        .from("job_applications")
        .update({ stage: "offer", status: "offer", stage_changed_at: new Date().toISOString() })
        .eq("id", app.id);
      if (error) throw error;
      // Best-effort notification (transactional email pipeline if available)
      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "job-offer-sent",
            recipientEmail: app.email,
            idempotencyKey: `job-offer-${app.id}`,
            templateData: { name: app.full_name, position: app.position },
          },
        });
      } catch { /* non-blocking */ }
    },
    onSuccess: () => {
      toast.success("Offre envoyée");
      qc.invalidateQueries({ queryKey: ["core-careers-apps"] });
    },
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });

  const rejectApp = useMutation({
    mutationFn: async () => {
      if (!rejectFor) throw new Error("Aucune candidature");
      const { error } = await supabase
        .from("job_applications")
        .update({
          stage: "rejected",
          status: "rejected",
          rejection_reason: rejectReason || null,
          stage_changed_at: new Date().toISOString(),
        })
        .eq("id", rejectFor.id);
      if (error) throw error;
      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "job-application-rejected",
            recipientEmail: rejectFor.email,
            idempotencyKey: `job-reject-${rejectFor.id}`,
            templateData: { name: rejectFor.full_name, reason: rejectReason },
          },
        });
      } catch { /* non-blocking */ }
    },
    onSuccess: () => {
      toast.success("Candidat refusé");
      qc.invalidateQueries({ queryKey: ["core-careers-apps"] });
      setRejectFor(null); setRejectReason("");
    },
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });

  const hire = useMutation({
    mutationFn: async () => {
      if (!hireFor) throw new Error("Aucune candidature");
      const { data: emp, error } = await supabase
        .from("employee_records")
        .insert({
          email: hireForm.email,
          full_name: hireForm.full_name,
          phone: hireForm.phone || null,
          role: hireForm.role,
          department: hireForm.department || null,
          start_date: hireForm.start_date,
          hourly_rate: hireForm.hourly_rate ? Number(hireForm.hourly_rate) : null,
          status: "active",
        })
        .select("id")
        .single();
      if (error) throw error;
      await supabase
        .from("job_applications")
        .update({
          stage: "hired",
          status: "hired",
          hired_employee_id: emp!.id,
          stage_changed_at: new Date().toISOString(),
        })
        .eq("id", hireFor.id);
      try {
        await supabase.functions.invoke("resend-employee-invite", {
          body: { employee_id: emp!.id, email: hireForm.email },
        });
      } catch { /* non-blocking */ }
      return emp!.id;
    },
    onSuccess: () => {
      toast.success("Candidat embauché");
      qc.invalidateQueries({ queryKey: ["core-careers-apps"] });
      setHireFor(null);
    },
    onError: (e: any) => toast.error("Erreur d'embauche", { description: e.message }),
  });

  const addNote = useMutation({
    mutationFn: async () => {
      if (!openApp || !newNote.trim()) throw new Error("Note vide");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("job_application_notes").insert({
        application_id: openApp.id,
        note: newNote.trim(),
        created_by: u.user?.id ?? null,
        created_by_name: u.user?.email ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewNote("");
      qc.invalidateQueries({ queryKey: ["core-careers-notes"] });
      toast.success("Note ajoutée");
    },
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });

  // ─── CV download ─────────────────────────────────────────────────────────
  const downloadCv = async (app: Application) => {
    if (!app.cv_path) {
      toast.error("Aucun CV joint");
      return;
    }
    const { data, error } = await supabase.storage
      .from("job-applications")
      .createSignedUrl(app.cv_path, 600);
    if (error || !data?.signedUrl) {
      toast.error("Lien indisponible");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null); setForm(EMPTY_FORM); setShowForm(true);
  };
  const openEdit = (j: Job) => {
    setEditing(j);
    setForm({
      title: j.title ?? "",
      department: j.department ?? "",
      location: j.location ?? "",
      type: j.type ?? "full-time",
      description: j.description ?? "",
      requirements: j.requirements ?? "",
      salary_min: j.salary_min?.toString() ?? "",
      salary_max: j.salary_max?.toString() ?? "",
      expires_at: j.expires_at ?? "",
      is_active: j.is_active ?? true,
    });
    setShowForm(true);
  };

  const openHire = (app: Application) => {
    setHireFor(app);
    setHireForm({
      email: app.email,
      full_name: app.full_name,
      phone: app.phone,
      role: "employee",
      department: pipelineJob?.department ?? "",
      start_date: format(new Date(), "yyyy-MM-dd"),
      hourly_rate: "",
    });
  };

  // Group applications by stage for kanban
  const grouped = useMemo(() => {
    const map: Record<string, Application[]> = {};
    for (const s of STAGES) map[s.key] = [];
    for (const a of applications) (map[a.stage] ??= []).push(a);
    return map;
  }, [applications]);

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            Recrutement — Postes ouverts
          </h1>
          <p className="text-xs text-muted-foreground">{jobs.length} poste(s) au total</p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Nouveau poste
        </Button>
      </div>

      {/* ─── SECTION 1 — Postings table ────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : jobs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Aucune offre d'emploi.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Titre</TableHead>
                  <TableHead className="text-[10px]">Dept.</TableHead>
                  <TableHead className="text-[10px]">Type</TableHead>
                  <TableHead className="text-[10px]">Lieu</TableHead>
                  <TableHead className="text-[10px]">Salaire</TableHead>
                  <TableHead className="text-[10px]">Publié</TableHead>
                  <TableHead className="text-[10px]">Expire</TableHead>
                  <TableHead className="text-[10px]">Cand.</TableHead>
                  <TableHead className="text-[10px]">Statut</TableHead>
                  <TableHead className="text-[10px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => {
                  const st = jobStatus(j);
                  return (
                    <TableRow key={j.id}>
                      <TableCell className="text-xs font-medium">{j.title}</TableCell>
                      <TableCell className="text-xs">{j.department || "—"}</TableCell>
                      <TableCell className="text-xs">{TYPE_LABEL[j.type] || j.type}</TableCell>
                      <TableCell className="text-xs">
                        {j.location ? (
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{j.location}</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{salaryRange(j)}</TableCell>
                      <TableCell className="text-[10px]">{format(new Date(j.created_at), "d MMM yyyy", { locale: fr })}</TableCell>
                      <TableCell className="text-[10px]">{j.expires_at ? format(new Date(j.expires_at), "d MMM yyyy", { locale: fr }) : "—"}</TableCell>
                      <TableCell className="text-xs">
                        <button
                          className="text-primary hover:underline flex items-center gap-1"
                          onClick={() => setPipelineJob(j)}
                        >
                          <Users className="h-3 w-3" />{counts[j.id] ?? 0}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={st === "active" ? "default" : st === "paused" ? "secondary" : "outline"}
                          className="text-[10px]"
                        >
                          {st === "active" ? "Actif" : st === "paused" ? "Pausé" : "Fermé"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Voir candidatures"
                            onClick={() => setPipelineJob(j)}>
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" title="Modifier"
                            onClick={() => openEdit(j)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                            title={j.is_active ? "Pauser" : "Activer"}
                            disabled={togglePause.isPending}
                            onClick={() => togglePause.mutate(j)}>
                            {j.is_active ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                          </Button>
                          {st !== "closed" && (
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive"
                              title="Fermer"
                              disabled={closeJob.isPending}
                              onClick={() => closeJob.mutate(j)}>
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ─── Job CRUD dialog ───────────────────────────────────────────────── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le poste" : "Nouveau poste"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Titre *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-8 text-xs" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Département</Label>
                <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABEL).map(([k, l]) => (
                      <SelectItem key={k} value={k}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Lieu</Label>
                <Select value={form.location} onValueChange={(v) => setForm({ ...form, location: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Salaire min ($)</Label>
                <Input type="number" value={form.salary_min} onChange={(e) => setForm({ ...form, salary_min: e.target.value })} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Salaire max ($)</Label>
                <Input type="number" value={form.salary_max} onChange={(e) => setForm({ ...form, salary_max: e.target.value })} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Expire le</Label>
                <Input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className="h-8 text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className="text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Exigences</Label>
              <Textarea value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} rows={3} className="text-xs" />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox" id="active"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              <Label htmlFor="active" className="text-xs cursor-pointer">Visible sur le site /emplois</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Annuler</Button>
            <Button size="sm" disabled={!form.title || saveJob.isPending} onClick={() => saveJob.mutate()}>
              {saveJob.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (editing ? "Enregistrer" : "Créer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── SECTION 2 — Application pipeline ────────────────────────────── */}
      <Dialog open={!!pipelineJob} onOpenChange={(o) => !o && setPipelineJob(null)}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Pipeline — {pipelineJob?.title}
            </DialogTitle>
            <DialogDescription>{applications.length} candidature(s)</DialogDescription>
          </DialogHeader>
          {loadingApps ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {STAGES.map((s) => (
                <div key={s.key} className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${s.tone}`} />
                    <h3 className="text-[11px] font-bold text-foreground uppercase tracking-wide">{s.label}</h3>
                    <Badge variant="outline" className="text-[9px] ml-auto">{grouped[s.key]?.length ?? 0}</Badge>
                  </div>
                  <div className="space-y-2 min-h-[80px]">
                    {(grouped[s.key] ?? []).map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setOpenApp(a)}
                        className="w-full text-left p-2 rounded-md border bg-card hover:bg-accent transition-colors"
                      >
                        <p className="text-xs font-medium truncate">{a.full_name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{a.email}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(a.created_at), "d MMM", { locale: fr })}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── SECTION 3 — Application detail panel ─────────────────────────── */}
      <Sheet open={!!openApp} onOpenChange={(o) => !o && setOpenApp(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {openApp && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4" />{openApp.full_name}
                </SheetTitle>
                <SheetDescription>{openApp.position}</SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                {/* Contact */}
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2"><Mail className="h-3 w-3 text-muted-foreground" /> {openApp.email}</div>
                  <div className="flex items-center gap-2"><Mail className="h-3 w-3 text-muted-foreground" /> {openApp.phone}</div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    Soumis le {format(new Date(openApp.created_at), "d MMM yyyy", { locale: fr })}
                  </div>
                  {openApp.interview_date && (
                    <div className="flex items-center gap-2 text-purple-600">
                      <Calendar className="h-3 w-3" />
                      Entrevue: {format(new Date(openApp.interview_date), "d MMM yyyy HH:mm", { locale: fr })}
                    </div>
                  )}
                </div>

                {/* Stage selector */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Étape</Label>
                  <Select
                    value={openApp.stage}
                    onValueChange={(v) => updateStage.mutate({ app: openApp, stage: v })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Cover letter */}
                {openApp.message && (
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Lettre de motivation</Label>
                    <p className="text-xs whitespace-pre-wrap rounded-md border p-2 bg-muted/30">{openApp.message}</p>
                  </div>
                )}

                {/* CV */}
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => downloadCv(openApp)}>
                  <Download className="h-3.5 w-3.5" />
                  {openApp.cv_filename ? `CV: ${openApp.cv_filename}` : "Télécharger le CV"}
                </Button>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                  <Button size="sm" variant="outline" className="gap-1.5"
                    onClick={() => { setInterviewFor(openApp); setInterviewDate(""); }}>
                    <Calendar className="h-3.5 w-3.5" /> Planifier entrevue
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5"
                    disabled={sendOffer.isPending}
                    onClick={() => sendOffer.mutate(openApp)}>
                    <Mail className="h-3.5 w-3.5" /> Envoyer offre
                  </Button>
                  <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700"
                    onClick={() => openHire(openApp)}>
                    <UserPlus className="h-3.5 w-3.5" /> Embaucher
                  </Button>
                  <Button size="sm" variant="destructive" className="gap-1.5"
                    onClick={() => { setRejectFor(openApp); setRejectReason(""); }}>
                    <X className="h-3.5 w-3.5" /> Refuser
                  </Button>
                </div>

                {/* Internal notes */}
                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-xs flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Notes de l'équipe (internes)
                  </Label>
                  <div className="flex gap-2">
                    <Textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Ajouter une note interne…"
                      rows={2}
                      className="text-xs"
                    />
                    <Button size="sm" disabled={!newNote.trim() || addNote.isPending} onClick={() => addNote.mutate()}>
                      Ajouter
                    </Button>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {notes.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic">Aucune note.</p>
                    ) : (
                      notes.map((n: any) => (
                        <div key={n.id} className="text-[11px] p-2 rounded border bg-muted/30">
                          <p className="whitespace-pre-wrap">{n.note}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {n.created_by_name ?? "Admin"} — {format(new Date(n.created_at), "d MMM HH:mm", { locale: fr })}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ─── Reject dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!rejectFor} onOpenChange={(o) => !o && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser la candidature</DialogTitle>
            <DialogDescription>{rejectFor?.full_name} — {rejectFor?.position}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">Raison (envoyée au candidat)</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="Profil ne correspondant pas aux exigences actuelles…"
              className="text-xs"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRejectFor(null)}>Annuler</Button>
            <Button variant="destructive" size="sm" disabled={rejectApp.isPending} onClick={() => rejectApp.mutate()}>
              Confirmer le refus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Schedule interview dialog ───────────────────────────────────── */}
      <Dialog open={!!interviewFor} onOpenChange={(o) => !o && setInterviewFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Planifier une entrevue</DialogTitle>
            <DialogDescription>{interviewFor?.full_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">Date et heure</Label>
            <Input
              type="datetime-local"
              value={interviewDate}
              onChange={(e) => setInterviewDate(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setInterviewFor(null)}>Annuler</Button>
            <Button size="sm" disabled={!interviewDate || scheduleInterview.isPending} onClick={() => scheduleInterview.mutate()}>
              Planifier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Hire dialog ──────────────────────────────────────────────────── */}
      <Dialog open={!!hireFor} onOpenChange={(o) => !o && setHireFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Embaucher — créer un employé</DialogTitle>
            <DialogDescription>Pré-rempli depuis la candidature</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nom complet</Label>
                <Input value={hireForm.full_name} onChange={(e) => setHireForm({ ...hireForm, full_name: e.target.value })} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input value={hireForm.email} onChange={(e) => setHireForm({ ...hireForm, email: e.target.value })} className="h-8 text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Téléphone</Label>
                <Input value={hireForm.phone} onChange={(e) => setHireForm({ ...hireForm, phone: e.target.value })} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rôle</Label>
                <Select value={hireForm.role} onValueChange={(v) => setHireForm({ ...hireForm, role: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employé</SelectItem>
                    <SelectItem value="supervisor">Superviseur</SelectItem>
                    <SelectItem value="field_sales">Agent terrain</SelectItem>
                    <SelectItem value="technician">Technicien</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Département</Label>
                <Input value={hireForm.department} onChange={(e) => setHireForm({ ...hireForm, department: e.target.value })} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date de début</Label>
                <Input type="date" value={hireForm.start_date} onChange={(e) => setHireForm({ ...hireForm, start_date: e.target.value })} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Salaire (h)</Label>
                <Input type="number" value={hireForm.hourly_rate} onChange={(e) => setHireForm({ ...hireForm, hourly_rate: e.target.value })} className="h-8 text-xs" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setHireFor(null)}>Annuler</Button>
            <Button size="sm" disabled={!hireForm.email || !hireForm.full_name || hire.isPending} onClick={() => hire.mutate()}>
              {hire.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Embaucher"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
