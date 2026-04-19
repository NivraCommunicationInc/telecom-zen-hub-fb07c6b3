/**
 * CoreCareersPage — Recruitment module: list, create, edit, close job postings.
 * Phase 8 rebuild — full CRUD with applications counts and pipeline link.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Briefcase, Plus, Pencil, MapPin, Clock, Users, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { corePath } from "@/core-app/lib/corePaths";

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

const TYPE_LABEL: Record<string, string> = {
  "full-time": "Temps plein",
  "part-time": "Temps partiel",
  "field-agent": "Agent terrain",
  "technician": "Technicien",
  "internship": "Stage",
};

export default function CoreCareersPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<JobForm>(EMPTY_FORM);

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["core-careers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["core-careers-app-counts", jobs.map((j: any) => j.id).join(",")],
    enabled: jobs.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("job_applications")
        .select("job_id")
        .in("job_id", jobs.map((j: any) => j.id));
      const map: Record<string, number> = {};
      for (const a of data ?? []) {
        map[a.job_id] = (map[a.job_id] ?? 0) + 1;
      }
      return map;
    },
  });

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
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
    },
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });

  const closeJob = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("jobs").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Poste fermé");
      qc.invalidateQueries({ queryKey: ["core-careers"] });
    },
    onError: (e: any) => toast.error("Erreur", { description: e.message }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };
  const openEdit = (j: any) => {
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

  return (
    <div className="space-y-4 max-w-6xl">
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
                  <TableHead className="text-[10px]">Département</TableHead>
                  <TableHead className="text-[10px]">Type</TableHead>
                  <TableHead className="text-[10px]">Lieu</TableHead>
                  <TableHead className="text-[10px]">Publié</TableHead>
                  <TableHead className="text-[10px]">Candidatures</TableHead>
                  <TableHead className="text-[10px]">Statut</TableHead>
                  <TableHead className="text-[10px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j: any) => (
                  <TableRow key={j.id}>
                    <TableCell className="text-xs font-medium">{j.title}</TableCell>
                    <TableCell className="text-xs">{j.department || "—"}</TableCell>
                    <TableCell className="text-xs">{TYPE_LABEL[j.type] || j.type}</TableCell>
                    <TableCell className="text-xs">
                      {j.location ? (
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{j.location}</span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-[10px]">
                      {format(new Date(j.created_at), "d MMM yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Link to={corePath("/hr/applications")} className="text-primary hover:underline flex items-center gap-1">
                        <Users className="h-3 w-3" />{counts[j.id] ?? 0}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={j.is_active ? "default" : "secondary"} className="text-[10px]">
                        {j.is_active ? "Actif" : "Fermé"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openEdit(j)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        {j.is_active && (
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive"
                            disabled={closeJob.isPending}
                            onClick={() => closeJob.mutate(j.id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le poste" : "Nouveau poste"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Titre *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-8 text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Département</Label>
                <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-time">Temps plein</SelectItem>
                    <SelectItem value="part-time">Temps partiel</SelectItem>
                    <SelectItem value="field-agent">Agent terrain</SelectItem>
                    <SelectItem value="technician">Technicien</SelectItem>
                    <SelectItem value="internship">Stage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Lieu</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="h-8 text-xs" />
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
                type="checkbox"
                id="active"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              <Label htmlFor="active" className="text-xs cursor-pointer">Actif (visible publiquement)</Label>
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
    </div>
  );
}
