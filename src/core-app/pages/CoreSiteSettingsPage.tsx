/**
 * CoreSiteSettingsPage — Site settings management.
 * Mirrors old admin AdminSite.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, Save, RefreshCcw, Globe, Shield, AlertTriangle, Wrench } from "lucide-react";
import { toast } from "sonner";

export default function CoreSiteSettingsPage() {
  const [tab, setTab] = useState("general");
  const queryClient = useQueryClient();

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["core-site-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .order("key");
      if (error) throw error;
      return data || [];
    },
  });

  const [edits, setEdits] = useState<Record<string, string>>({});

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from("site_settings")
        .update({ value_text: value, updated_at: new Date().toISOString() })
        .eq("key", key);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Paramètre mis à jour");
      queryClient.invalidateQueries({ queryKey: ["core-site-settings"] });
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const getSetting = (key: string) => {
    const s = settings.find((s: any) => s.key === key);
    return edits[key] ?? s?.value_text ?? "";
  };

  const setEdit = (key: string, value: string) => {
    setEdits((prev) => ({ ...prev, [key]: value }));
  };

  const saveSetting = (key: string) => {
    const value = edits[key];
    if (value !== undefined) {
      updateMutation.mutate({ key, value });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const generalKeys = ["support_email", "support_phone", "business_hours", "address"];
  const bannerKeys = ["outage_banner_enabled", "outage_banner_message_fr", "outage_banner_message_en"];
  const maintenanceKeys = ["maintenance_enabled", "maintenance_message_fr", "maintenance_message_en", "maintenance_eta", "maintenance_allowed_routes"];
  const lockdownKeys = ["lockdown_enabled", "lockdown_message_fr", "lockdown_message_en"];

  const SettingRow = ({ k, label }: { k: string; label: string }) => {
    const isBool = k.endsWith("_enabled");
    const val = getSetting(k);

    if (isBool) {
      return (
        <div className="flex items-center justify-between py-2 border-b border-[hsl(220,15%,14%)]">
          <Label className="text-xs text-[hsl(220,10%,70%)]">{label}</Label>
          <Switch
            checked={val === "true"}
            onCheckedChange={(checked) => {
              updateMutation.mutate({ key: k, value: String(checked) });
            }}
          />
        </div>
      );
    }

    return (
      <div className="py-2 border-b border-[hsl(220,15%,14%)] space-y-1.5">
        <Label className="text-xs text-[hsl(220,10%,70%)]">{label}</Label>
        <div className="flex gap-2">
          {val.length > 80 ? (
            <Textarea
              value={val}
              onChange={(e) => setEdit(k, e.target.value)}
              className="flex-1 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-white text-xs min-h-[60px]"
            />
          ) : (
            <Input
              value={val}
              onChange={(e) => setEdit(k, e.target.value)}
              className="flex-1 bg-[hsl(220,15%,12%)] border-[hsl(220,15%,20%)] text-white text-xs"
            />
          )}
          {edits[k] !== undefined && (
            <Button size="sm" onClick={() => saveSetting(k)} className="bg-emerald-600 hover:bg-emerald-700 text-white h-8">
              <Save className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  const labelMap: Record<string, string> = {
    support_email: "Email de support",
    support_phone: "Téléphone de support",
    business_hours: "Heures d'ouverture",
    address: "Adresse",
    outage_banner_enabled: "Bannière de panne activée",
    outage_banner_message_fr: "Message panne (FR)",
    outage_banner_message_en: "Message panne (EN)",
    maintenance_enabled: "Mode maintenance activé",
    maintenance_message_fr: "Message maintenance (FR)",
    maintenance_message_en: "Message maintenance (EN)",
    maintenance_eta: "ETA maintenance",
    maintenance_allowed_routes: "Routes autorisées",
    lockdown_enabled: "Lockdown activé",
    lockdown_message_fr: "Message lockdown (FR)",
    lockdown_message_en: "Message lockdown (EN)",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-emerald-400" />
          <h1 className="text-lg font-semibold text-white">Paramètres du site</h1>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["core-site-settings"] })}
          className="border-[hsl(220,15%,20%)] text-[hsl(220,10%,60%)] hover:text-white"
        >
          <RefreshCcw className="h-3.5 w-3.5 mr-1.5" /> Actualiser
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-[hsl(220,10%,40%)]">Chargement…</div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="bg-[hsl(220,15%,12%)] border border-[hsl(220,15%,18%)]">
            <TabsTrigger value="general"><Globe className="h-3 w-3 mr-1" /> Général</TabsTrigger>
            <TabsTrigger value="banner"><AlertTriangle className="h-3 w-3 mr-1" /> Bannière</TabsTrigger>
            <TabsTrigger value="maintenance"><Wrench className="h-3 w-3 mr-1" /> Maintenance</TabsTrigger>
            <TabsTrigger value="lockdown"><Shield className="h-3 w-3 mr-1" /> Lockdown</TabsTrigger>
            <TabsTrigger value="all">Tous ({settings.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="bg-[hsl(220,15%,10%)] rounded-lg border border-[hsl(220,15%,16%)] p-4">
            {generalKeys.map((k) => <SettingRow key={k} k={k} label={labelMap[k] || k} />)}
          </TabsContent>

          <TabsContent value="banner" className="bg-[hsl(220,15%,10%)] rounded-lg border border-[hsl(220,15%,16%)] p-4">
            {bannerKeys.map((k) => <SettingRow key={k} k={k} label={labelMap[k] || k} />)}
          </TabsContent>

          <TabsContent value="maintenance" className="bg-[hsl(220,15%,10%)] rounded-lg border border-[hsl(220,15%,16%)] p-4">
            {maintenanceKeys.map((k) => <SettingRow key={k} k={k} label={labelMap[k] || k} />)}
          </TabsContent>

          <TabsContent value="lockdown" className="bg-[hsl(220,15%,10%)] rounded-lg border border-[hsl(220,15%,16%)] p-4">
            {lockdownKeys.map((k) => <SettingRow key={k} k={k} label={labelMap[k] || k} />)}
          </TabsContent>

          <TabsContent value="all" className="bg-[hsl(220,15%,10%)] rounded-lg border border-[hsl(220,15%,16%)] p-4">
            {settings.map((s: any) => (
              <SettingRow key={s.key} k={s.key} label={labelMap[s.key] || s.key} />
            ))}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
