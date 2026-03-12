/** CoreCareersPage — Transferred from AdminCareers.tsx */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Briefcase, Plus, Pencil, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";

export default function CoreCareersPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", department: "", location: "", type: "full-time", description: "", is_active: true });
  const { data: jobs = [] } = useQuery({ queryKey: ["core-careers"], queryFn: async () => { const { data } = await supabase.from("job_postings" as any).select("*").order("created_at", { ascending: false }); return (data as any[]) || []; } });
  const createJob = useMutation({ mutationFn: async () => { await supabase.from("job_postings" as any).insert(form as any); }, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["core-careers"] }); setShowCreate(false); toast.success("Poste créé"); } });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><div><h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Carrières</h1><p className="text-sm text-[hsl(var(--core-text-secondary))]">Gestion des offres d'emploi</p></div>
        <Button onClick={() => setShowCreate(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"><Plus className="w-4 h-4" /> Nouveau poste</Button></div>
      <div className="space-y-2">{jobs.length === 0 ? <div className="text-center py-12 text-[hsl(var(--core-text-label))]">Aucune offre d'emploi</div> : jobs.map((j: any) => (
        <div key={j.id} className="p-4 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
          <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">{j.title}</h3><Badge className={j.is_active ? "bg-emerald-600/15 text-emerald-400 border-0" : "bg-[hsl(220,15%,16%)] text-[hsl(var(--core-text-label))] border-0"}>{j.is_active ? "Actif" : "Inactif"}</Badge></div>
          <div className="flex items-center gap-3 mt-1 text-xs text-[hsl(var(--core-text-secondary))]"><span className="flex items-center gap-1"><Briefcase className="w-3 h-3" />{j.department || "—"}</span><span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{j.location || "—"}</span><span className="flex items-center gap-1"><Clock className="w-3 h-3" />{j.type}</span></div>
        </div>
      ))}</div>
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-[hsl(220,15%,11%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]"><DialogHeader><DialogTitle>Nouveau poste</DialogTitle></DialogHeader>
          <div className="space-y-3"><div><Label>Titre</Label><Input value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]" /></div><div className="grid grid-cols-2 gap-3"><div><Label>Département</Label><Input value={form.department} onChange={(e) => setForm({...form, department: e.target.value})} className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]" /></div><div><Label>Lieu</Label><Input value={form.location} onChange={(e) => setForm({...form, location: e.target.value})} className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]" /></div></div><div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]" /></div></div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCreate(false)} className="border-[hsl(220,15%,20%)] bg-transparent">Annuler</Button><Button onClick={() => createJob.mutate()} className="bg-emerald-600 hover:bg-emerald-700 text-white">Créer</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}
