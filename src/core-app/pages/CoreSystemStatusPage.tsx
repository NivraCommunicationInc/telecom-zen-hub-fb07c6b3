/**
 * CoreSystemStatusPage — Transferred from AdminSystemStatus.tsx
 * System status management, service health, incident reporting
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Radio, Plus, CheckCircle, AlertTriangle, XCircle, RefreshCw, Shield, Activity } from "lucide-react";
import { toast } from "sonner";

const severityColors: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400",
  warning: "bg-amber-500/15 text-amber-400",
  info: "bg-sky-500/15 text-sky-400",
  success: "bg-emerald-500/15 text-emerald-400",
};

export default function CoreSystemStatusPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", message: "", status_type: "incident", severity: "warning", is_banner: false, affected_services: "", show_to_clients: true, show_to_employees: true, show_to_technicians: true });

  const { data: statuses = [], isLoading } = useQuery({
    queryKey: ["core-system-statuses"],
    queryFn: async () => {
      const { data } = await supabase.from("system_status").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: services = [] } = useQuery({
    queryKey: ["core-service-status"],
    queryFn: async () => {
      const { data } = await supabase.from("service_status").select("*").order("display_name");
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("system_status").insert({
        ...form,
        affected_services: form.affected_services ? form.affected_services.split(",").map((s: string) => s.trim()) : [],
        is_active: true,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-system-statuses"] });
      setShowCreate(false);
      toast.success("Statut créé");
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("system_status").update({ is_active: active } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["core-system-statuses"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Statut système</h1>
          <p className="text-sm text-[hsl(var(--core-text-secondary))]">Gestion des incidents et statut des services</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4" /> Nouveau statut
        </Button>
      </div>

      <Tabs defaultValue="status" className="space-y-4">
        <TabsList className="bg-[hsl(220,15%,12%)] border border-[hsl(220,15%,20%)]">
          <TabsTrigger value="status" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Statuts</TabsTrigger>
          <TabsTrigger value="services" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400">Services</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-3">
          {statuses.map((s: any) => (
            <div key={s.id} className="p-4 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge className={severityColors[s.severity] || severityColors.info}>{s.severity}</Badge>
                  <h3 className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">{s.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={s.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: s.id, active: v })} />
                  <span className="text-xs text-[hsl(var(--core-text-label))]">{s.is_active ? "Actif" : "Inactif"}</span>
                </div>
              </div>
              <p className="text-sm text-[hsl(var(--core-text-secondary))]">{s.message}</p>
              <div className="flex gap-2 mt-2">
                {s.is_banner && <Badge className="bg-[hsl(220,15%,16%)] text-[hsl(var(--core-text-label))] border-0 text-[10px]">Bannière</Badge>}
                <Badge className="bg-[hsl(220,15%,16%)] text-[hsl(var(--core-text-label))] border-0 text-[10px]">{s.status_type}</Badge>
              </div>
            </div>
          ))}
          {statuses.length === 0 && !isLoading && (
            <div className="text-center py-12 text-[hsl(var(--core-text-label))]">Aucun statut système</div>
          )}
        </TabsContent>

        <TabsContent value="services" className="space-y-3">
          {services.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)]">
              <div className="flex items-center gap-3">
                {s.status === "operational" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
                <span className="text-sm font-medium text-[hsl(var(--core-text-primary))]">{s.display_name}</span>
              </div>
              <Badge className={s.status === "operational" ? "bg-emerald-600/15 text-emerald-400 border-0" : "bg-amber-500/15 text-amber-400 border-0"}>
                {s.status}
              </Badge>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-[hsl(220,15%,11%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]">
          <DialogHeader><DialogTitle>Nouveau statut système</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Titre</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]" /></div>
            <div><Label>Message</Label><Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Type</Label>
                <Select value={form.status_type} onValueChange={(v) => setForm({ ...form, status_type: v })}>
                  <SelectTrigger className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="incident">Incident</SelectItem><SelectItem value="maintenance">Maintenance</SelectItem><SelectItem value="announcement">Annonce</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Sévérité</Label>
                <Select value={form.severity} onValueChange={(v) => setForm({ ...form, severity: v })}>
                  <SelectTrigger className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)]"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="info">Info</SelectItem><SelectItem value="warning">Warning</SelectItem><SelectItem value="critical">Critical</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.is_banner} onCheckedChange={(v) => setForm({ ...form, is_banner: v })} /><Label>Bannière visible</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)} className="border-[hsl(220,15%,20%)] bg-transparent">Annuler</Button>
            <Button onClick={() => createMutation.mutate()} className="bg-emerald-600 hover:bg-emerald-700 text-white">Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
