/** CoreMaintenancePage — Transferred from AdminMaintenance.tsx */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Wrench, Save } from "lucide-react";
import { toast } from "sonner";

export default function CoreMaintenancePage() {
  const [config, setConfig] = useState({ enabled: false, eta: "", message_fr: "", message_en: "" });
  const { data } = useQuery({ queryKey: ["core-maintenance"], queryFn: async () => { const { data } = await supabase.from("site_settings" as any).select("value_json").eq("key", "maintenance_mode").maybeSingle(); if (data?.value_json) setConfig(data.value_json as any); return data; } });
  const save = useMutation({ mutationFn: async () => { await supabase.from("site_settings" as any).upsert({ key: "maintenance_mode", value_json: config } as any); }, onSuccess: () => toast.success("Configuration sauvegardée") });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><div><h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">Maintenance</h1><p className="text-sm text-[hsl(var(--core-text-secondary))]">Mode maintenance du site</p></div>
        <Button onClick={() => save.mutate()} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"><Save className="w-4 h-4" /> Sauvegarder</Button></div>
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] p-6 space-y-4">
        <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">Mode maintenance</h2><p className="text-xs text-[hsl(var(--core-text-secondary))]">Active la page de maintenance pour tous les visiteurs</p></div><Switch checked={config.enabled} onCheckedChange={(v) => setConfig({...config, enabled: v})} /></div>
        <div><Label className="text-[hsl(var(--core-text-secondary))]">ETA (estimation)</Label><Input value={config.eta || ""} onChange={(e) => setConfig({...config, eta: e.target.value})} placeholder="Ex: 2h" className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]" /></div>
        <div><Label className="text-[hsl(var(--core-text-secondary))]">Message FR</Label><Textarea value={config.message_fr} onChange={(e) => setConfig({...config, message_fr: e.target.value})} className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]" /></div>
        <div><Label className="text-[hsl(var(--core-text-secondary))]">Message EN</Label><Textarea value={config.message_en} onChange={(e) => setConfig({...config, message_en: e.target.value})} className="bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]" /></div>
      </div>
    </div>
  );
}
