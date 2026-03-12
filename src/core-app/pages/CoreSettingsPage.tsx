/**
 * CoreSettingsPage — Platform Configuration Console
 * Enhanced with all tabs: General, Billing, Security, System, Notifications, Admin Access
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Building, CreditCard, Shield, AlertTriangle, Bell, Users, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

const TABS = [
  { id: "general", label: "Général", icon: Building },
  { id: "billing", label: "Facturation", icon: CreditCard },
  { id: "security", label: "Sécurité", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "access", label: "Limites d'accès", icon: Users },
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

  const { data: notifSettings = [] } = useQuery({
    queryKey: ["core-notif-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_notification_settings").select("*").order("category");
      if (error) return [];
      return data || [];
    },
  });

  const { data: accessLimits } = useQuery({
    queryKey: ["core-access-limits"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_access_limits").select("*").limit(1).maybeSingle();
      if (error) return null;
      return data;
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["core-site-settings"] }); toast.success("Paramètre mis à jour"); },
    onError: () => toast.error("Erreur"),
  });

  const toggleNotifMutation = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: string; is_enabled: boolean }) => {
      const { error } = await supabase.from("admin_notification_settings").update({ is_enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["core-notif-settings"] }); toast.success("Notification mise à jour"); },
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
      <div className="flex gap-1.5 border-b border-[hsl(220,15%,16%)] pb-0 flex-wrap">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium rounded-t-md transition-colors ${
              activeTab === tab.id
                ? "bg-[hsl(220,20%,11%)] text-emerald-400 border border-[hsl(220,15%,16%)] border-b-transparent -mb-px"
                : "text-[#94A3B8] hover:text-[#CBD5E1]"
            }`}>
            <tab.icon className="h-3.5 w-3.5" />{tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,11%)] p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-[#64748B]" /></div>
        ) : activeTab === "general" ? (
          <SettingsSection title="Informations de l'entreprise">
            <SettingRow label="Nom de l'entreprise" description="Affiché sur factures et documents"><Val>{(getSetting("company_info")?.value_json as any)?.name || "Nivra Telecom"}</Val></SettingRow>
            <SettingRow label="Fuseau horaire" description="Calcul des cycles de facturation"><Val>{(getSetting("company_info")?.value_json as any)?.timezone || "America/Toronto"}</Val></SettingRow>
            <SettingRow label="TPS (%)" description="Taxe sur produits et services"><Val>5%</Val></SettingRow>
            <SettingRow label="TVQ (%)" description="Taxe de vente du Québec"><Val>9.975%</Val></SettingRow>
            <SettingRow label="Devise" description="Devise de facturation"><Val>CAD ($)</Val></SettingRow>
            <SettingRow label="Langue par défaut" description="Interface et communications"><Val>Français (fr-CA)</Val></SettingRow>
          </SettingsSection>
        ) : activeTab === "billing" ? (
          <SettingsSection title="Configuration de facturation">
            {(() => { const b = (getSetting("billing_config")?.value_json as any) || {}; return (<>
              <SettingRow label="Jours avant renouvellement" description="Génération anticipée des factures"><Val>{b.renewal_lead_days || 3} jours</Val></SettingRow>
              <SettingRow label="Modèle prépayé" description="Facturation avant service">
                <Toggle enabled={b.prepaid !== false} onToggle={() => updateMutation.mutate({ key: "billing_config", value: { ...b, prepaid: !b.prepaid } })} />
              </SettingRow>
              <SettingRow label="Frais de retard" description="Application automatique des pénalités">
                <Toggle enabled={!!b.late_fees_enabled} onToggle={() => updateMutation.mutate({ key: "billing_config", value: { ...b, late_fees_enabled: !b.late_fees_enabled } })} />
              </SettingRow>
              <SettingRow label="Rabais automatique nouveaux clients" description="Réduction pour première commande">
                <Toggle enabled={b.new_customer_discount !== false} onToggle={() => updateMutation.mutate({ key: "billing_config", value: { ...b, new_customer_discount: !b.new_customer_discount } })} />
              </SettingRow>
              <SettingRow label="Facturation automatique" description="Génération automatique des factures de renouvellement">
                <Toggle enabled={b.auto_billing !== false} onToggle={() => updateMutation.mutate({ key: "billing_config", value: { ...b, auto_billing: !b.auto_billing } })} />
              </SettingRow>
            </>); })()}
          </SettingsSection>
        ) : activeTab === "security" ? (
          <SettingsSection title="Paramètres de sécurité">
            {(() => { const s = (getSetting("security_config")?.value_json as any) || {}; return (<>
              <SettingRow label="Durée session admin" description="Expiration automatique des sessions"><Val>{s.session_ttl_minutes || 60} min</Val></SettingRow>
              <SettingRow label="2FA obligatoire" description="Authentification à deux facteurs pour le personnel">
                <Toggle enabled={!!s.require_2fa} onToggle={() => updateMutation.mutate({ key: "security_config", value: { ...s, require_2fa: !s.require_2fa } })} />
              </SettingRow>
              <SettingRow label="Journalisation d'accès" description="Enregistrement de toutes les actions administratives">
                <Toggle enabled={s.access_logging !== false} onToggle={() => updateMutation.mutate({ key: "security_config", value: { ...s, access_logging: !s.access_logging } })} />
              </SettingRow>
              <SettingRow label="Verrouillage après tentatives" description="Blocage après 5 tentatives échouées">
                <Toggle enabled={s.lockout_enabled !== false} onToggle={() => updateMutation.mutate({ key: "security_config", value: { ...s, lockout_enabled: !s.lockout_enabled } })} />
              </SettingRow>
              <SettingRow label="PIN requis pour employés" description="Accès POS avec code PIN">
                <Toggle enabled={!!s.require_pin} onToggle={() => updateMutation.mutate({ key: "security_config", value: { ...s, require_pin: !s.require_pin } })} />
              </SettingRow>
            </>); })()}
          </SettingsSection>
        ) : activeTab === "notifications" ? (
          <SettingsSection title="Notifications administratives">
            {notifSettings.length === 0 ? (
              <p className="text-[12px] text-[#64748B]">Aucune configuration de notification trouvée</p>
            ) : (
              notifSettings.map((n: any) => (
                <SettingRow key={n.id} label={n.setting_label} description={`${n.category} • ${n.setting_key}`}>
                  <Toggle enabled={n.is_enabled} onToggle={() => toggleNotifMutation.mutate({ id: n.id, is_enabled: !n.is_enabled })} />
                </SettingRow>
              ))
            )}
          </SettingsSection>
        ) : activeTab === "access" ? (
          <SettingsSection title="Limites d'accès du personnel">
            <SettingRow label="Maximum d'administrateurs" description="Nombre maximum de comptes admin autorisés">
              <Val>{accessLimits?.max_admins || "—"}</Val>
            </SettingRow>
            <SettingRow label="Maximum d'employés" description="Nombre maximum de comptes staff autorisés">
              <Val>{accessLimits?.max_staff || "—"}</Val>
            </SettingRow>
          </SettingsSection>
        ) : (
          <SettingsSection title="Drapeaux système">
            {(() => {
              const m = (getSetting("maintenance_mode")?.value_json as any) || {};
              const l = (getSetting("total_lockdown")?.value_json as any) || {};
              return (<>
                <SettingRow label="Mode maintenance" description="Affiche une page de maintenance aux visiteurs">
                  <Toggle enabled={!!m.enabled} onToggle={() => updateMutation.mutate({ key: "maintenance_mode", value: { ...m, enabled: !m.enabled } })} />
                </SettingRow>
                <SettingRow label="Verrouillage total" description="Bloque toutes les opérations client">
                  <Toggle enabled={!!l.enabled} onToggle={() => updateMutation.mutate({ key: "total_lockdown", value: { ...l, enabled: !l.enabled } })} />
                </SettingRow>
                <SettingRow label="Inscriptions désactivées" description="Bloque les nouvelles inscriptions">
                  <Toggle enabled={!!(getSetting("disable_signups")?.value_json as any)?.enabled} onToggle={() => updateMutation.mutate({ key: "disable_signups", value: { enabled: !(getSetting("disable_signups")?.value_json as any)?.enabled } })} />
                </SettingRow>
              </>);
            })()}
          </SettingsSection>
        )}
      </div>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[13px] text-[#CBD5E1] font-medium mb-3">{title}</h3>
      <div>{children}</div>
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

function Val({ children }: { children: React.ReactNode }) {
  return <span className="text-[12px] text-[#CBD5E1]">{children}</span>;
}

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className={`w-10 h-5 rounded-full transition-colors ${enabled ? "bg-emerald-600" : "bg-[hsl(220,15%,20%)]"}`}>
      <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-0.5 ${enabled ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}
