/**
 * JobListings — Public careers page at /emplois.
 * Shows active jobs (is_active=true, expires_at > today) with filters
 * and an in-page application form (CV upload to job-applications bucket).
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Briefcase, MapPin, Loader2, Upload, CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const TYPE_LABEL: Record<string, string> = {
  "full-time": "Temps plein",
  "part-time": "Temps partiel",
  "field-agent": "Agent terrain",
  "technician": "Technicien",
  "internship": "Stage",
  "contract": "Contractuel",
};

const ALL = "__all__";

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
};

type AppForm = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  message: string;
  consent: boolean;
  cv: File | null;
};

const EMPTY: AppForm = {
  first_name: "", last_name: "", email: "", phone: "", message: "",
  consent: false, cv: null,
};

function salaryRange(j: Job) {
  if (j.salary_min && j.salary_max) return `${j.salary_min}$ – ${j.salary_max}$`;
  if (j.salary_min) return `Dès ${j.salary_min}$`;
  if (j.salary_max) return `Jusqu'à ${j.salary_max}$`;
  return null;
}

export default function JobListings() {
  const qc = useQueryClient();
  const [dept, setDept] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [loc, setLoc] = useState(ALL);
  const [applyJob, setApplyJob] = useState<Job | null>(null);
  const [form, setForm] = useState<AppForm>(EMPTY);
  const [submitted, setSubmitted] = useState(false);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["public-jobs"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("is_active", true)
        .or(`expires_at.is.null,expires_at.gte.${today}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Job[];
    },
  });

  const filtered = useMemo(() => jobs.filter((j) =>
    (dept === ALL || j.department === dept) &&
    (type === ALL || j.type === type) &&
    (loc === ALL || j.location === loc)
  ), [jobs, dept, type, loc]);

  const departments = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.department).filter(Boolean))) as string[],
    [jobs],
  );
  const types = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.type).filter(Boolean))) as string[],
    [jobs],
  );
  const locations = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.location).filter(Boolean))) as string[],
    [jobs],
  );

  const handleFile = (f: File | null) => {
    if (!f) { setForm({ ...form, cv: null }); return; }
    if (f.size > 5 * 1024 * 1024) {
      toast.error("CV trop volumineux (max 5 MB)");
      return;
    }
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Le CV doit être un PDF");
      return;
    }
    setForm({ ...form, cv: f });
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!applyJob) throw new Error("Aucun poste sélectionné");
      let cv_path: string | null = null;
      let cv_filename: string | null = null;
      if (form.cv) {
        const ts = Date.now();
        const safeName = form.cv.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${applyJob.id}/${ts}_${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("job-applications")
          .upload(path, form.cv, { contentType: form.cv.type || "application/pdf" });
        if (upErr) throw upErr;
        cv_path = path;
        cv_filename = form.cv.name;
      }
      const { error } = await supabase.from("job_applications").insert({
        job_id: applyJob.id,
        position: applyJob.title,
        full_name: `${form.first_name} ${form.last_name}`.trim(),
        email: form.email,
        phone: form.phone,
        message: form.message || null,
        cv_path,
        cv_filename,
        stage: "new",
        status: "new",
      });
      if (error) throw error;

      // Best-effort transactional emails (won't block submission if unavailable)
      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "job-application-received",
            recipientEmail: form.email,
            idempotencyKey: `job-app-${applyJob.id}-${form.email}-${Date.now()}`,
            templateData: {
              name: form.first_name,
              position: applyJob.title,
            },
          },
        });
      } catch { /* non-blocking */ }
    },
    onSuccess: () => {
      setSubmitted(true);
      qc.invalidateQueries({ queryKey: ["public-jobs"] });
    },
    onError: (e: any) => toast.error("Erreur lors de l'envoi", { description: e.message }),
  });

  const closeApply = () => {
    setApplyJob(null); setForm(EMPTY); setSubmitted(false);
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pt-16">
      <section className="border-b bg-card">
        <div className="container max-w-6xl mx-auto px-4 py-12 md:py-16 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
            <Briefcase className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">Joignez l'équipe Nivra</h1>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Découvrez nos opportunités de carrière au Québec.
          </p>
        </div>
      </section>

      <section className="container max-w-6xl mx-auto px-4 py-8">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger><SelectValue placeholder="Tous les départements" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les départements</SelectItem>
              {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue placeholder="Tous les types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les types</SelectItem>
              {types.map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t] ?? t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={loc} onValueChange={setLoc}>
            <SelectTrigger><SelectValue placeholder="Tous les lieux" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les lieux</SelectItem>
              {locations.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Jobs grid */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Aucun poste disponible pour ces critères. Revenez bientôt !
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((j) => {
              const sal = salaryRange(j);
              return (
                <Card key={j.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-bold text-lg text-foreground leading-tight">{j.title}</h2>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {j.department && <Badge variant="secondary">{j.department}</Badge>}
                      <Badge variant="outline">{TYPE_LABEL[j.type] ?? j.type}</Badge>
                      {j.location && (
                        <Badge variant="outline" className="gap-1">
                          <MapPin className="h-3 w-3" />{j.location}
                        </Badge>
                      )}
                      {sal && <Badge variant="outline">{sal}</Badge>}
                    </div>
                    {j.description && (
                      <p className="text-sm text-muted-foreground line-clamp-3">{j.description}</p>
                    )}
                    <Button className="w-full gap-1.5" onClick={() => { setApplyJob(j); setSubmitted(false); setForm(EMPTY); }}>
                      <Send className="h-4 w-4" /> Postuler maintenant
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Apply dialog */}
      <Dialog open={!!applyJob} onOpenChange={(o) => !o && closeApply()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {submitted ? (
            <div className="py-8 text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
              <h2 className="text-xl font-bold">Candidature reçue !</h2>
              <p className="text-sm text-muted-foreground">
                Merci pour votre intérêt. Nous reviendrons vers vous bientôt.
              </p>
              <Button onClick={closeApply}>Fermer</Button>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Postuler — {applyJob?.title}</DialogTitle>
                <DialogDescription>{applyJob?.department} · {applyJob && (TYPE_LABEL[applyJob.type] ?? applyJob.type)}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Prénom *</Label>
                    <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nom *</Label>
                    <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Courriel *</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Téléphone *</Label>
                  <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Poste visé</Label>
                  <Input value={applyJob?.title ?? ""} readOnly disabled />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Lettre de motivation (optionnel)</Label>
                  <Textarea
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    rows={4}
                    placeholder="Présentez-vous brièvement…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Upload className="h-3.5 w-3.5" /> CV (PDF, max 5 MB)
                  </Label>
                  <Input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  />
                  {form.cv && <p className="text-[11px] text-muted-foreground">📄 {form.cv.name}</p>}
                </div>
                <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.consent}
                    onChange={(e) => setForm({ ...form, consent: e.target.checked })}
                    className="mt-0.5"
                  />
                  <span>
                    J'accepte que Nivra Telecom utilise mes données pour l'évaluation
                    de ma candidature, conformément à la Loi 25.
                  </span>
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeApply}>Annuler</Button>
                <Button
                  disabled={
                    !form.first_name || !form.last_name || !form.email ||
                    !form.phone || !form.consent || submit.isPending
                  }
                  onClick={() => submit.mutate()}
                >
                  {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Envoyer ma candidature"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      </main>
      <Footer />
    </>
  );
}
