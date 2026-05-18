/**
 * CoreMaintenancePage — Rebuilt for full operational control
 * Sections:
 *   A) Bannière d'annonce (quick_announcement)
 *   B) Mode maintenance + routes autorisées
 *   C) État des services (live realtime CRUD on service_status)
 *   D) Historique des incidents (service_incidents)
 */
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Megaphone,
  Wrench,
  Activity,
  History,
  Save,
  Eye,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr as frLocale } from "date-fns/locale";
import MaintenanceNotifyButton from "@/core-app/components/MaintenanceNotifyButton";

const CARD = "rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,15%,11%)] p-6";
const INPUT_CLS =
  "bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]";
const LABEL_CLS = "text-[hsl(var(--core-text-secondary))]";

// ============= TYPES =============
type AnnouncementType = "info" | "warning" | "error" | "success";
type ServiceStatus = "operational" | "degraded" | "partial_outage" | "major_outage" | "maintenance";

interface QuickAnnouncementConfig {
  active: boolean;
  message_fr: string;
  message_en: string;
  type: AnnouncementType;
  link: string;
  link_text_fr: string;
  link_text_en: string;
}

interface MaintenanceConfig {
  enabled: boolean;
  eta: string | null;
  message_fr: string;
  message_en: string;
}

interface AllowedRoutesConfig {
  routes: string[];
}

const DEFAULT_ROUTES = ["/contact", "/aide", "/portal/auth", "/status"];
const TOGGLEABLE_ROUTES: { key: string; label: string; description: string }[] = [
  { key: "/contact", label: "Contact", description: "Page de contact / formulaire" },
  { key: "/aide", label: "Aide / FAQ", description: "Centre d'aide" },
  { key: "/portal/auth", label: "Portail client (login)", description: "Connexion clients existants" },
  { key: "/status", label: "Page Status", description: "Toujours recommandé pour transparence" },
];

const normalizeMaintenanceConfig = (value: unknown): MaintenanceConfig => {
  const raw = (value ?? {}) as Partial<MaintenanceConfig>;
  const rawEnabled = (value as { enabled?: unknown } | null)?.enabled;

  return {
    enabled: rawEnabled === true || rawEnabled === "true",
    eta: raw.eta ?? "",
    message_fr: raw.message_fr ?? "",
    message_en: raw.message_en ?? "",
  };
};

const normalizeAllowedRoutes = (routes: string[] | undefined) =>
  Array.from(new Set((routes ?? DEFAULT_ROUTES).filter((route) => route !== "/")));

const TYPE_PREVIEW: Record<AnnouncementType, { bg: string; text: string; icon: string }> = {
  info: { bg: "#EFF6FF", text: "#1E40AF", icon: "ℹ️" },
  warning: { bg: "#FFFBEB", text: "#92400E", icon: "⚠️" },
  error: { bg: "#FEF2F2", text: "#991B1B", icon: "🔴" },
  success: { bg: "#F0FDF4", text: "#166534", icon: "✅" },
};

const SERVICE_STATUS_META: Record<
  ServiceStatus,
  { label: string; icon: typeof CheckCircle; color: string }
> = {
  operational: { label: "Opérationnel", icon: CheckCircle, color: "bg-emerald-600/15 text-emerald-400" },
  degraded: { label: "Dégradé", icon: AlertTriangle, color: "bg-amber-500/15 text-amber-400" },
  partial_outage: { label: "Interruption partielle", icon: AlertCircle, color: "bg-orange-500/15 text-orange-400" },
  major_outage: { label: "Interruption majeure", icon: XCircle, color: "bg-red-500/15 text-red-400" },
  maintenance: { label: "Maintenance", icon: Wrench, color: "bg-sky-500/15 text-sky-400" },
};

export default function CoreMaintenancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[hsl(var(--core-text-primary))]">
          Maintenance & Annonces
        </h1>
        <p className="text-sm text-[hsl(var(--core-text-secondary))]">
          Bannière d'annonce, mode maintenance, état des services et historique d'incidents — tout est synchronisé en temps réel sur le site public.
        </p>
      </div>

      <Tabs defaultValue="announcement" className="space-y-4">
        <TabsList className="bg-[hsl(220,15%,12%)] border border-[hsl(220,15%,20%)]">
          <TabsTrigger value="announcement" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400 gap-2">
            <Megaphone className="w-4 h-4" /> Bannière d'annonce
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400 gap-2">
            <Wrench className="w-4 h-4" /> Mode maintenance
          </TabsTrigger>
          <TabsTrigger value="services" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400 gap-2">
            <Activity className="w-4 h-4" /> État des services
          </TabsTrigger>
          <TabsTrigger value="incidents" className="data-[state=active]:bg-emerald-600/20 data-[state=active]:text-emerald-400 gap-2">
            <History className="w-4 h-4" /> Historique
          </TabsTrigger>
        </TabsList>

        <TabsContent value="announcement"><AnnouncementSection /></TabsContent>
        <TabsContent value="maintenance"><MaintenanceSection /></TabsContent>
        <TabsContent value="services"><ServicesSection /></TabsContent>
        <TabsContent value="incidents"><IncidentsSection /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============= SECTION A — ANNONCE =============
function AnnouncementSection() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<QuickAnnouncementConfig>({
    active: false,
    message_fr: "",
    message_en: "",
    type: "info",
    link: "",
    link_text_fr: "",
    link_text_en: "",
  });
  const [hydrated, setHydrated] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["core-quick-announcement"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value_json")
        .eq("key", "quick_announcement")
        .maybeSingle();
      return (data?.value_json as unknown as QuickAnnouncementConfig) ?? null;
    },
  });

  useEffect(() => {
    if (data && !hydrated) {
      setConfig((c) => ({ ...c, ...data }));
      setHydrated(true);
    }
  }, [data, hydrated]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("site_settings")
        .update({ value_json: config as any })
        .eq("key", "quick_announcement");
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bannière mise à jour — visible sur le site immédiatement.");
      queryClient.invalidateQueries({ queryKey: ["core-quick-announcement"] });
      queryClient.invalidateQueries({ queryKey: ["site-settings", "quick_announcement"] });
    },
    onError: (e: any) => toast.error(`Erreur : ${e.message}`),
  });

  const preview = TYPE_PREVIEW[config.type];

  return (
    <div className={CARD + " space-y-5"}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-[hsl(var(--core-text-primary))]">
            Bannière d'annonce globale
          </h2>
          <p className="text-xs text-[hsl(var(--core-text-secondary))]">
            Affichée tout en haut de chaque page publique du site.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={config.active}
            onCheckedChange={(v) => setConfig({ ...config, active: v })}
            aria-label="Activer la bannière"
          />
          <span className="text-xs text-[hsl(var(--core-text-label))] min-w-[60px]">
            {config.active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className={LABEL_CLS}>Message (Français) — max 200</Label>
          <Textarea
            maxLength={200}
            value={config.message_fr}
            onChange={(e) => setConfig({ ...config, message_fr: e.target.value })}
            className={INPUT_CLS}
            rows={3}
          />
          <p className="text-[11px] text-[hsl(var(--core-text-label))] mt-1">
            {config.message_fr.length}/200
          </p>
        </div>
        <div>
          <Label className={LABEL_CLS}>Message (English) — optional</Label>
          <Textarea
            maxLength={200}
            value={config.message_en}
            onChange={(e) => setConfig({ ...config, message_en: e.target.value })}
            className={INPUT_CLS}
            rows={3}
          />
          <p className="text-[11px] text-[hsl(var(--core-text-label))] mt-1">
            {config.message_en.length}/200
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label className={LABEL_CLS}>Type</Label>
          <Select value={config.type} onValueChange={(v) => setConfig({ ...config, type: v as AnnouncementType })}>
            <SelectTrigger className={INPUT_CLS}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="info">🔵 Info</SelectItem>
              <SelectItem value="warning">⚠️ Avertissement</SelectItem>
              <SelectItem value="error">🔴 Erreur</SelectItem>
              <SelectItem value="success">✅ Succès</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className={LABEL_CLS}>Lien optionnel (URL)</Label>
          <Input
            placeholder="https://…"
            value={config.link}
            onChange={(e) => setConfig({ ...config, link: e.target.value })}
            className={INPUT_CLS}
          />
        </div>
        <div>
          <Label className={LABEL_CLS}>Texte du lien (FR / EN)</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="En savoir plus"
              value={config.link_text_fr}
              onChange={(e) => setConfig({ ...config, link_text_fr: e.target.value })}
              className={INPUT_CLS}
            />
            <Input
              placeholder="Learn more"
              value={config.link_text_en}
              onChange={(e) => setConfig({ ...config, link_text_en: e.target.value })}
              className={INPUT_CLS}
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      <div>
        <Label className={LABEL_CLS}>
          <Eye className="w-3 h-3 inline mr-1" /> Aperçu (FR)
        </Label>
        <div
          className="mt-2 rounded border"
          style={{
            background: preview.bg,
            color: preview.text,
            borderColor: preview.text + "33",
            padding: "10px 16px",
            textAlign: "center",
            fontSize: 14,
            fontWeight: 500,
          }}
        >
          <span aria-hidden>{preview.icon}</span> {config.message_fr || "(aucun message)"}
          {config.link && (
            <a href={config.link} className="ml-2 underline font-bold" style={{ color: preview.text }}>
              {config.link_text_fr || "En savoir plus"}
            </a>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending || isLoading}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Sauvegarder
        </Button>
      </div>
    </div>
  );
}

// ============= SECTION B — MAINTENANCE =============
function MaintenanceSection() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<MaintenanceConfig>({
    enabled: false,
    eta: "",
    message_fr: "",
    message_en: "",
  });
  const [routes, setRoutes] = useState<string[]>(DEFAULT_ROUTES);
  const [hydrated, setHydrated] = useState(false);

  const { data: cfgData } = useQuery({
    queryKey: ["core-maintenance-mode"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value_json")
        .eq("key", "maintenance_mode")
        .maybeSingle();
      return (data?.value_json as unknown as MaintenanceConfig) ?? null;
    },
  });

  const { data: routesData } = useQuery({
    queryKey: ["core-maintenance-routes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value_json")
        .eq("key", "maintenance_allowed_routes")
        .maybeSingle();
      return (data?.value_json as unknown as AllowedRoutesConfig) ?? null;
    },
  });

  useEffect(() => {
    if (!hydrated && (cfgData || routesData)) {
      if (cfgData) setConfig(normalizeMaintenanceConfig(cfgData));
      if (routesData?.routes) setRoutes(normalizeAllowedRoutes(routesData.routes));
      setHydrated(true);
    }
  }, [cfgData, routesData, hydrated]);

  const save = useMutation({
    mutationFn: async () => {
      const sanitizedRoutes = normalizeAllowedRoutes(routes);

      const { error: e1 } = await supabase
        .from("site_settings")
        .update({
          value_json: {
            enabled: Boolean(config.enabled),
            eta: config.eta || null,
            message_fr: config.message_fr,
            message_en: config.message_en,
          } as any,
        })
        .eq("key", "maintenance_mode");
      if (e1) throw e1;

      const { error: e2 } = await supabase
        .from("site_settings")
        .update({ value_json: { routes: sanitizedRoutes } as any })
        .eq("key", "maintenance_allowed_routes");
      if (e2) throw e2;

      setRoutes(sanitizedRoutes);
    },
    onSuccess: () => {
      toast.success(
        config.enabled
          ? "Mode maintenance ACTIVÉ. Le site public affiche maintenant la page maintenance."
          : "Configuration sauvegardée. Site en fonctionnement normal.",
      );
      queryClient.invalidateQueries({ queryKey: ["core-maintenance-mode"] });
      queryClient.invalidateQueries({ queryKey: ["core-maintenance-routes"] });
      queryClient.invalidateQueries({ queryKey: ["site-settings", "maintenance_mode"] });
      queryClient.invalidateQueries({ queryKey: ["site-settings", "maintenance_allowed_routes"] });
    },
    onError: (e: any) => toast.error(`Erreur : ${e.message}`),
  });

  const toggleRoute = (key: string) => {
    setRoutes((prev) => (prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]));
  };

  return (
    <div className={CARD + " space-y-5"}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-[hsl(var(--core-text-primary))]">
            Mode maintenance
          </h2>
          <p className="text-xs text-[hsl(var(--core-text-secondary))]">
            Quand activé, le site public affiche immédiatement la page maintenance. Les portails internes (Core, Employee, Field, RH, Hub) restent toujours accessibles.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={config.enabled}
            onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
            aria-label="Activer la maintenance"
          />
          <span className={`text-xs font-semibold min-w-[70px] ${config.enabled ? "text-amber-400" : "text-[hsl(var(--core-text-label))]"}`}>
            {config.enabled ? "ACTIVÉ" : "Désactivé"}
          </span>
        </div>
      </div>

      <div>
        <Label className={LABEL_CLS}>ETA — heure estimée de rétablissement</Label>
        <Input
          placeholder="Ex: 14h30 ou Dans 2 heures"
          value={config.eta || ""}
          onChange={(e) => setConfig({ ...config, eta: e.target.value })}
          className={INPUT_CLS}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className={LABEL_CLS}>Message (Français)</Label>
          <Textarea
            value={config.message_fr}
            onChange={(e) => setConfig({ ...config, message_fr: e.target.value })}
            className={INPUT_CLS}
            rows={4}
            placeholder="Nous effectuons une maintenance planifiée. Le service sera rétabli sous peu."
          />
        </div>
        <div>
          <Label className={LABEL_CLS}>Message (English)</Label>
          <Textarea
            value={config.message_en}
            onChange={(e) => setConfig({ ...config, message_en: e.target.value })}
            className={INPUT_CLS}
            rows={4}
            placeholder="We are performing scheduled maintenance. Service will be restored shortly."
          />
        </div>
      </div>

      <div>
        <Label className={LABEL_CLS}>Routes accessibles pendant la maintenance</Label>
        <p className="text-[11px] text-[hsl(var(--core-text-label))] mb-2">
          Les routes cochées resteront accessibles pour les visiteurs publics même quand la maintenance est active.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
          {TOGGLEABLE_ROUTES.map((r) => (
            <label
              key={r.key}
              className="flex items-start gap-3 p-3 rounded border border-[hsl(220,15%,18%)] bg-[hsl(220,15%,13%)] cursor-pointer hover:bg-[hsl(220,15%,15%)]"
            >
              <input
                type="checkbox"
                checked={routes.includes(r.key)}
                onChange={() => toggleRoute(r.key)}
                className="mt-1 accent-emerald-500"
              />
              <div>
                <div className="text-sm font-medium text-[hsl(var(--core-text-primary))]">
                  {r.label} <span className="text-[11px] text-[hsl(var(--core-text-label))]">({r.key})</span>
                </div>
                <div className="text-[11px] text-[hsl(var(--core-text-secondary))]">{r.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={() => window.open("/?_preview=maintenance", "_blank")}
          className="gap-2 bg-transparent border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]"
        >
          <Eye className="w-4 h-4" /> Aperçu site public
        </Button>
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className={`gap-2 text-white ${config.enabled ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
        >
          {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {config.enabled ? "Activer la maintenance" : "Sauvegarder"}
        </Button>
      </div>
    </div>
  );
}

// ============= SECTION C — SERVICES =============
function ServicesSection() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Record<string, any>>({});

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["core-service-status-mgmt"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_status")
        .select("*")
        .order("display_name");
      return data ?? [];
    },
  });

  // Realtime sync
  useEffect(() => {
    const ch = supabase
      .channel("core_service_status_mgmt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_status" },
        () => queryClient.invalidateQueries({ queryKey: ["core-service-status-mgmt"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [queryClient]);

  const update = useMutation({
    mutationFn: async ({ id, patch, prevStatus, displayName, serviceName }: any) => {
      const { error } = await supabase
        .from("service_status")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;

      // Auto-log to service_incidents on status transition
      const newStatus = patch.status as ServiceStatus | undefined;
      if (newStatus && newStatus !== prevStatus) {
        if (prevStatus === "operational" && newStatus !== "operational") {
          await supabase.from("service_incidents").insert({
            service_name: serviceName,
            service_display_name: displayName,
            status_at_incident: newStatus,
            incident_title: `${SERVICE_STATUS_META[newStatus].label} — ${displayName}`,
            incident_message: patch.incident_message ?? null,
          } as any);
        } else if (newStatus === "operational" && prevStatus !== "operational") {
          // Resolve open incidents for this service
          await supabase
            .from("service_incidents")
            .update({ resolved_at: new Date().toISOString() })
            .eq("service_name", serviceName)
            .is("resolved_at", null);
        }
      }
    },
    onSuccess: (_d, vars: any) => {
      toast.success(`${vars.displayName} mis à jour.`);
      queryClient.invalidateQueries({ queryKey: ["core-service-status-mgmt"] });
      queryClient.invalidateQueries({ queryKey: ["core-incidents"] });
      setEditing((e) => {
        const next = { ...e };
        delete next[vars.id];
        return next;
      });
    },
    onError: (e: any) => toast.error(`Erreur : ${e.message}`),
  });

  const startEdit = (s: any) => {
    setEditing((e) => ({
      ...e,
      [s.id]: {
        status: s.status,
        incident_message: s.incident_message ?? s.status_message ?? "",
        estimated_resolution: s.estimated_resolution ?? "",
      },
    }));
  };

  return (
    <div className="space-y-3">
      {isLoading && (
        <div className={CARD + " text-center text-[hsl(var(--core-text-label))]"}>
          <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Chargement…
        </div>
      )}

      {services.map((s: any) => {
        const meta = SERVICE_STATUS_META[s.status as ServiceStatus] ?? SERVICE_STATUS_META.operational;
        const Icon = meta.icon;
        const draft = editing[s.id];
        const isEditing = !!draft;

        return (
          <div key={s.id} className={CARD + " space-y-3"}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5" />
                <div>
                  <div className="text-sm font-semibold text-[hsl(var(--core-text-primary))]">
                    {s.display_name}
                  </div>
                  <div className="text-[11px] text-[hsl(var(--core-text-label))]">
                    {s.service_name}
                  </div>
                </div>
                <Badge className={`${meta.color} border-0 ml-2`}>{meta.label}</Badge>
              </div>
              {!isEditing && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startEdit(s)}
                  className="bg-transparent border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]"
                >
                  Modifier
                </Button>
              )}
            </div>

            {s.incident_message && !isEditing && (
              <div className="text-xs p-2 rounded bg-[hsl(220,15%,8%)] border border-[hsl(220,15%,18%)] text-[hsl(var(--core-text-secondary))]">
                {s.incident_message}
              </div>
            )}

            {isEditing && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-[hsl(220,15%,18%)]">
                <div>
                  <Label className={LABEL_CLS}>Statut</Label>
                  <Select
                    value={draft.status}
                    onValueChange={(v) => setEditing((e) => ({ ...e, [s.id]: { ...draft, status: v } }))}
                  >
                    <SelectTrigger className={INPUT_CLS}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SERVICE_STATUS_META) as ServiceStatus[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {SERVICE_STATUS_META[k].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label className={LABEL_CLS}>Message d'incident (visible publiquement)</Label>
                  <Input
                    value={draft.incident_message}
                    onChange={(e) =>
                      setEditing((es) => ({
                        ...es,
                        [s.id]: { ...draft, incident_message: e.target.value },
                      }))
                    }
                    className={INPUT_CLS}
                    placeholder="Description courte du problème ou de la maintenance"
                  />
                </div>
                <div>
                  <Label className={LABEL_CLS}>Rétablissement estimé</Label>
                  <Input
                    type="datetime-local"
                    value={draft.estimated_resolution ? draft.estimated_resolution.slice(0, 16) : ""}
                    onChange={(e) =>
                      setEditing((es) => ({
                        ...es,
                        [s.id]: {
                          ...draft,
                          estimated_resolution: e.target.value
                            ? new Date(e.target.value).toISOString()
                            : "",
                        },
                      }))
                    }
                    className={INPUT_CLS}
                  />
                </div>
                <div className="md:col-span-3 flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditing((e) => {
                        const n = { ...e };
                        delete n[s.id];
                        return n;
                      })
                    }
                    className="bg-transparent border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]"
                  >
                    Annuler
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      update.mutate({
                        id: s.id,
                        prevStatus: s.status,
                        displayName: s.display_name,
                        serviceName: s.service_name,
                        patch: {
                          status: draft.status,
                          incident_message: draft.incident_message || null,
                          status_message: draft.incident_message || null,
                          estimated_resolution: draft.estimated_resolution || null,
                        },
                      })
                    }
                    disabled={update.isPending}
                    className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {update.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Sauvegarder
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {!isLoading && services.length === 0 && (
        <div className={CARD + " text-center text-[hsl(var(--core-text-label))]"}>
          Aucun service configuré.
        </div>
      )}
    </div>
  );
}

// ============= SECTION D — INCIDENTS HISTORY =============
function IncidentsSection() {
  const queryClient = useQueryClient();

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ["core-incidents"],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_incidents")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("service_incidents")
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Incident marqué comme résolu.");
      queryClient.invalidateQueries({ queryKey: ["core-incidents"] });
    },
  });

  return (
    <div className="space-y-3">
      <div className={CARD + " p-0 overflow-hidden"}>
        <div className="grid grid-cols-12 px-4 py-2 bg-[hsl(220,15%,8%)] text-[11px] font-semibold uppercase text-[hsl(var(--core-text-label))]">
          <div className="col-span-2">Début</div>
          <div className="col-span-2">Service</div>
          <div className="col-span-2">Statut</div>
          <div className="col-span-1">Durée</div>
          <div className="col-span-3">Description</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {isLoading && (
          <div className="px-4 py-6 text-sm text-center text-[hsl(var(--core-text-label))]">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Chargement…
          </div>
        )}

        {!isLoading && incidents.length === 0 && (
          <div className="px-4 py-8 text-sm text-center text-[hsl(var(--core-text-label))]">
            Aucun incident enregistré. Les incidents apparaîtront ici automatiquement quand vous changez le statut d'un service.
          </div>
        )}

        {incidents.map((i: any) => {
          const isResolved = !!i.resolved_at;
          const meta = SERVICE_STATUS_META[i.status_at_incident as ServiceStatus] ?? SERVICE_STATUS_META.operational;
          const dur =
            i.duration_minutes != null
              ? i.duration_minutes >= 60
                ? `${Math.floor(i.duration_minutes / 60)}h ${i.duration_minutes % 60}m`
                : `${i.duration_minutes}m`
              : "—";
          return (
            <div
              key={i.id}
              className="grid grid-cols-12 px-4 py-3 border-t border-[hsl(220,15%,16%)] text-sm items-center"
            >
              <div className="col-span-2 text-[hsl(var(--core-text-secondary))] text-xs">
                {format(new Date(i.started_at), "dd MMM HH:mm", { locale: frLocale })}
              </div>
              <div className="col-span-2 text-[hsl(var(--core-text-primary))] text-xs font-medium">
                {i.service_display_name ?? i.service_name}
              </div>
              <div className="col-span-2">
                <Badge className={`${meta.color} border-0 text-[10px]`}>{meta.label}</Badge>
              </div>
              <div className="col-span-1 text-xs text-[hsl(var(--core-text-secondary))]">{dur}</div>
              <div className="col-span-3 text-xs text-[hsl(var(--core-text-secondary))] truncate" title={i.incident_message ?? ""}>
                {i.incident_message ?? i.incident_title}
              </div>
              <div className="col-span-2 text-right flex justify-end gap-1">
                {isResolved ? (
                  <Badge className="bg-emerald-600/15 text-emerald-400 border-0 text-[10px] gap-1">
                    <CheckCircle className="w-3 h-3" /> Résolu
                  </Badge>
                ) : (
                  <>
                    <MaintenanceNotifyButton incidentId={i.id} label="Notifier" />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolve.mutate(i.id)}
                      disabled={resolve.isPending}
                      className="gap-1 h-7 text-xs bg-transparent border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))]"
                    >
                      <RotateCcw className="w-3 h-3" /> Résoudre
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
