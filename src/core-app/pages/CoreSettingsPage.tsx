/**
 * CoreSettingsPage — Platform Configuration Console
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Building, CreditCard, Shield, AlertTriangle, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

const TABS = [
  { id: "general", label: "Général", icon: Building },
  { id: "billing", label: "Facturation", icon: CreditCard },
  { id: "security", label: "Sécurité", icon: Shield },
  { id: "system", label: "Système", icon: AlertTriangle },
] as const;

type TabId = typeof TABS[number]["id"];

export default function CoreSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const queryClient = useQueryClient();

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["core-site-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("*").order("key");
      if (error) throw error;
      return data || [];
    },
  });

  const getSetting = (key: string) => settings.find((s: any) => s.key === key);

  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const existing = getSetting(key);
      if (existing) {
        const { error } = await supabase.from("site_settings").update({ value_json: value, updated_at: new Date().toISOString() }).eq("key", key);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_settings").insert({ key, value_json: value });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["core-site-settings"] });
      toast.success("Paramètre mis à jour");
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#F8FAFC]">Paramètres système</h1>
          <p className="text-xs text-[#94A3B8]">Configuration centrale de la plateforme</p>
        </div>
        <Settings className="h-5 w-5 text-emerald-400" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 border-b border-[hsl(220,15%,16%)] pb-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium rounded-t-md transition-colors ${
              activeTab === tab.id
                ? "bg-[hsl(220,20%,11%)] text-emerald-400 border border-[hsl(220,15%,16%)] border-b-transparent -mb-px"
                : "text-[#94A3B8] hover:text-[#CBD5E1]"
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-[#64748B]" />
          </div>
        ) : activeTab === "general" ? (
          <GeneralSettings settings={settings} onSave={(k, v) => updateMutation.mutate({ key: k, value: v })} />
        ) : activeTab === "billing" ? (
          <BillingSettings settings={settings} onSave={(k, v) => updateMutation.mutate({ key: k, value: v })} />
        ) : activeTab === "security" ? (
          <SecuritySettings settings={settings} onSave={(k, v) => updateMutation.mutate({ key: k, value: v })} />
        ) : (
          <SystemSettings settings={settings} onSave={(k, v) => updateMutation.mutate({ key: k, value: v })} />
        )}
      </div>
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-[hsl(220,15%,14%)] last:border-0">
      <div className="flex-1 mr-4">
        <p className="text-[13px] text-[#F8FAFC] font-medium">{label}</p>
        {description && <p className="text-[11px] text-[#94A3B8] mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ToggleSwitch({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`w-10 h-5 rounded-full transition-colors ${enabled ? "bg-emerald-600" : "bg-[hsl(220,15%,20%)]"}`}>
      <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-0.5 ${enabled ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

function GeneralSettings({ settings, onSave }: { settings: any[]; onSave: (k: string, v: any) => void }) {
  const company = settings.find((s: any) => s.key === "company_info")?.value_json || {};
  return (
    <div>
      <h3 className="text-[13px] text-[#CBD5E1] font-medium mb-3">Informations de l'entreprise</h3>
      <SettingRow label="Nom de l'entreprise" description="Affiché sur les factures et documents">
        <span className="text-[12px] text-[#CBD5E1]">{company.name || "Nivra Telecom"}</span>
      </SettingRow>
      <SettingRow label="Fuseau horaire" description="Utilisé pour le calcul des cycles">
        <span className="text-[12px] text-[#CBD5E1]">{company.timezone || "America/Toronto"}</span>
      </SettingRow>
      <SettingRow label="TPS (%)" description="Taxe sur produits et services">
        <span className="text-[12px] text-[#CBD5E1]">5%</span>
      </SettingRow>
      <SettingRow label="TVQ (%)" description="Taxe de vente du Québec">
        <span className="text-[12px] text-[#CBD5E1]">9.975%</span>
      </SettingRow>
    </div>
  );
}

function BillingSettings({ settings, onSave }: { settings: any[]; onSave: (k: string, v: any) => void }) {
  const billing = settings.find((s: any) => s.key === "billing_config")?.value_json || {};
  return (
    <div>
      <h3 className="text-[13px] text-[#CBD5E1] font-medium mb-3">Configuration de facturation</h3>
      <SettingRow label="Jours avant renouvellement" description="Génération anticipée des factures">
        <span className="text-[12px] text-[#CBD5E1]">{billing.renewal_lead_days || 3} jours</span>
      </SettingRow>
      <SettingRow label="Modèle prépayé" description="Facturation avant service">
        <ToggleSwitch enabled={billing.prepaid !== false} onToggle={() => onSave("billing_config", { ...billing, prepaid: !billing.prepaid })} />
      </SettingRow>
      <SettingRow label="Frais de retard" description="Application automatique des pénalités">
        <ToggleSwitch enabled={!!billing.late_fees_enabled} onToggle={() => onSave("billing_config", { ...billing, late_fees_enabled: !billing.late_fees_enabled })} />
      </SettingRow>
    </div>
  );
}

function SecuritySettings({ settings, onSave }: { settings: any[]; onSave: (k: string, v: any) => void }) {
  const security = settings.find((s: any) => s.key === "security_config")?.value_json || {};
  return (
    <div>
      <h3 className="text-[13px] text-[#CBD5E1] font-medium mb-3">Paramètres de sécurité</h3>
      <SettingRow label="Durée session admin" description="Expiration automatique des sessions">
        <span className="text-[12px] text-[#CBD5E1]">{security.session_ttl_minutes || 60} min</span>
      </SettingRow>
      <SettingRow label="2FA obligatoire" description="Authentification à deux facteurs pour le personnel">
        <ToggleSwitch enabled={!!security.require_2fa} onToggle={() => onSave("security_config", { ...security, require_2fa: !security.require_2fa })} />
      </SettingRow>
    </div>
  );
}

function SystemSettings({ settings, onSave }: { settings: any[]; onSave: (k: string, v: any) => void }) {
  const maintenance = settings.find((s: any) => s.key === "maintenance_mode")?.value_json || {};
  const lockdown = settings.find((s: any) => s.key === "total_lockdown")?.value_json || {};
  return (
    <div>
      <h3 className="text-[13px] text-[#CBD5E1] font-medium mb-3">Drapeaux système</h3>
      <SettingRow label="Mode maintenance" description="Affiche une page de maintenance aux visiteurs">
        <ToggleSwitch enabled={!!maintenance.enabled} onToggle={() => onSave("maintenance_mode", { ...maintenance, enabled: !maintenance.enabled })} />
      </SettingRow>
      <SettingRow label="Verrouillage total" description="Bloque toutes les opérations client">
        <ToggleSwitch enabled={!!lockdown.enabled} onToggle={() => onSave("total_lockdown", { ...lockdown, enabled: !lockdown.enabled })} />
      </SettingRow>
    </div>
  );
}
