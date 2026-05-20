/**
 * CoreApplicationsPage — Recruitment pipeline: kanban-style stages with hire workflow.
 * Phase 8 rebuild — move stage, reject, hire (creates employee_records).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Search, Loader2, Download, ArrowRight, Check, X, Mail, Phone, Briefcase, Calendar, FileText, Eye } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

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

export default function CoreApplicationsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [hireApp, setHireApp] = useState<any | null>(null);
  const [detailApp, setDetailApp] = useState<any | null>(null);
  const [hireForm, setHireForm] = useState({
    first_name: "", last_name: "", work_email: "",
    job_title: "", department: "", hire_date: format(new Date(), "yyyy-MM-dd"),
    employment_type: "full-time", hourly_rate: "",
  });

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["core-applications-pipeline"],
    queryFn: async () => {
      const { data } = await supabase
        .from("job_applications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["core-applications-jobs"],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("id, title");
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

  const hireMut = useMutation({
    mutationFn: async () => {
      if (!hireApp) throw new Error("Pas d'application sélectionnée");
      const { data: emp, error: empErr } = await supabase
        .from("employee_records")
        .insert({
          first_name: hireForm.first_name,
          last_name: hireForm.last_name,
          work_email: hireForm.work_email || null,
          personal_email: hireApp.email,
          phone: hireApp.phone || null,
          job_title: hireForm.job_title || null,
          department: hireForm.department || null,
          hire_date: hireForm.hire_date,
          employment_type: hireForm.employment_type,
          hourly_rate: hireForm.hourly_rate ? Number(hireForm.hourly_rate) : null,
          salary_type: hireForm.hourly_rate ? "hourly" : "salary",
          status: "active",
        })
        .select("id")
        .single();
      if (empErr) throw empErr;

      const { data: { user } } = await supabase.auth.getUser();
      const { error: appErr } = await supabase
        .from("job_applications")
        .update({
          stage: "hired",
          status: "hired",
          hired_employee_id: emp.id,
          stage_changed_at: new Date().toISOString(),
          stage_changed_by: user?.id ?? null,
        })
        .eq("id", hireApp.id);
      if (appErr) throw appErr;
    },
    onSuccess: () => {
      toast.success("Candidat embauché — fiche employé créée");
      qc.invalidateQueries({ queryKey: ["core-applications-pipeline"] });
      setHireApp(null);
    },
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });

  const filtered = apps.filter((a: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (a.full_name || "").toLowerCase().includes(s)
      || (a.email || "").toLowerCase().includes(s)
      || (a.position || "").toLowerCase().includes(s);
  });

  const byStage = (stage: string) => filtered.filter((a: any) => (a.stage || a.status || "new") === stage);

  const downloadCv = async (path: string) => {
    if (!path) return;
    const { data } = await supabase.storage.from("cv-uploads").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
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
    });
    setHireApp(a);
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
                    <Card key={a.id} className="p-2 hover:border-primary/40 transition-colors">
                      <p className="text-xs font-medium text-foreground truncate">{a.full_name || "Anonyme"}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{a.email}</p>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {a.position || jobMap[a.job_id] || "—"}
                      </p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        {format(new Date(a.created_at), "d MMM", { locale: fr })}
                      </p>
                      <div className="flex gap-1 mt-1.5">
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
              <Label className="text-xs">Courriel travail</Label>
              <Input type="email" value={hireForm.work_email} onChange={(e) => setHireForm({ ...hireForm, work_email: e.target.value })} className="h-8 text-xs" />
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
            <Button size="sm" disabled={!hireForm.first_name || !hireForm.last_name || hireMut.isPending}
              onClick={() => hireMut.mutate()}>
              {hireMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1" />Embaucher</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
