import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Construction, Save, X, Plus, AlertTriangle } from "lucide-react";

interface MaintenanceConfig {
  enabled: boolean;
  eta: string | null;
  message_fr: string;
  message_en: string;
}

interface AllowedRoutes {
  routes: string[];
}

const AdminMaintenance = () => {
  const queryClient = useQueryClient();
  const [newRoute, setNewRoute] = useState("");
  
  // Local state for form fields
  const [localEta, setLocalEta] = useState("");
  const [localMessageFr, setLocalMessageFr] = useState("");
  const [localMessageEn, setLocalMessageEn] = useState("");
  const [hasConfigChanges, setHasConfigChanges] = useState(false);

  const { data: maintenanceConfig, isLoading: loadingConfig } = useQuery({
    queryKey: ["admin-maintenance-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .eq("key", "maintenance_mode")
        .single();

      if (error) throw error;
      return {
        id: data.id,
        config: data.value_json as unknown as MaintenanceConfig,
      };
    },
  });

  const { data: allowedRoutesData, isLoading: loadingRoutes } = useQuery({
    queryKey: ["admin-maintenance-routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .eq("key", "maintenance_allowed_routes")
        .single();

      if (error) throw error;
      return {
        id: data.id,
        routes: (data.value_json as unknown as AllowedRoutes).routes,
      };
    },
  });

  // Sync local state with fetched data
  useEffect(() => {
    if (maintenanceConfig?.config) {
      setLocalEta(maintenanceConfig.config.eta || "");
      setLocalMessageFr(maintenanceConfig.config.message_fr || "");
      setLocalMessageEn(maintenanceConfig.config.message_en || "");
      setHasConfigChanges(false);
    }
  }, [maintenanceConfig]);

  // Track changes
  useEffect(() => {
    if (!maintenanceConfig?.config) return;
    const config = maintenanceConfig.config;
    const changed = 
      localEta !== (config.eta || "") ||
      localMessageFr !== (config.message_fr || "") ||
      localMessageEn !== (config.message_en || "");
    setHasConfigChanges(changed);
  }, [localEta, localMessageFr, localMessageEn, maintenanceConfig]);

  const updateConfigMutation = useMutation({
    mutationFn: async (config: MaintenanceConfig) => {
      const { error } = await supabase
        .from("site_settings")
        .update({ value_json: config as any })
        .eq("key", "maintenance_mode");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-maintenance-config"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-mode"] });
      toast.success("Configuration sauvegardée");
      setHasConfigChanges(false);
    },
    onError: () => {
      toast.error("Erreur lors de la sauvegarde");
    },
  });

  const updateRoutesMutation = useMutation({
    mutationFn: async (routes: string[]) => {
      const { error } = await supabase
        .from("site_settings")
        .update({ value_json: { routes } as any })
        .eq("key", "maintenance_allowed_routes");

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-maintenance-routes"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-allowed-routes"] });
      toast.success("Routes mises à jour");
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour");
    },
  });

  const handleToggleMaintenance = () => {
    if (!maintenanceConfig) return;
    updateConfigMutation.mutate({
      ...maintenanceConfig.config,
      enabled: !maintenanceConfig.config.enabled,
    });
  };

  const handleSaveConfig = () => {
    if (!maintenanceConfig) return;
    updateConfigMutation.mutate({
      ...maintenanceConfig.config,
      eta: localEta || null,
      message_fr: localMessageFr,
      message_en: localMessageEn,
    });
  };

  const handleAddRoute = () => {
    if (!newRoute.trim() || !allowedRoutesData) return;
    const routes = [...allowedRoutesData.routes, newRoute.trim()];
    updateRoutesMutation.mutate(routes);
    setNewRoute("");
  };

  const handleRemoveRoute = (route: string) => {
    if (!allowedRoutesData) return;
    const routes = allowedRoutesData.routes.filter((r) => r !== route);
    updateRoutesMutation.mutate(routes);
  };

  if (loadingConfig || loadingRoutes) {
    return (
      <AdminLayout>
        <div className="p-6">Chargement...</div>
      </AdminLayout>
    );
  }

  const config = maintenanceConfig?.config;
  const routes = allowedRoutesData?.routes ?? [];

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Construction className="w-6 h-6" />
              Mode Maintenance
            </h1>
            <p className="text-muted-foreground">
              Gérer le mode maintenance et les sections accessibles
            </p>
          </div>
        </div>

        {/* Status Card */}
        <Card className={config?.enabled ? "border-destructive" : ""}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  Statut du mode maintenance
                  {config?.enabled && (
                    <Badge variant="destructive" className="ml-2">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      ACTIF
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {config?.enabled
                    ? "Le site est actuellement en maintenance"
                    : "Le site fonctionne normalement"}
                </CardDescription>
              </div>
              <Switch
                checked={config?.enabled}
                onCheckedChange={handleToggleMaintenance}
                disabled={updateConfigMutation.isPending}
              />
            </div>
          </CardHeader>
        </Card>

        {/* Configuration Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Configuration</CardTitle>
                <CardDescription>
                  Messages et ETA affichés pendant la maintenance
                </CardDescription>
              </div>
              <Button 
                onClick={handleSaveConfig}
                disabled={!hasConfigChanges || updateConfigMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                {updateConfigMutation.isPending ? "Sauvegarde..." : "Enregistrer"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>ETA (optionnel)</Label>
              <Input
                placeholder="ex: 15h00, 2 heures..."
                value={localEta}
                onChange={(e) => setLocalEta(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Message (Français)</Label>
              <Textarea
                placeholder="Message affiché aux visiteurs francophones"
                value={localMessageFr}
                onChange={(e) => setLocalMessageFr(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Message (English)</Label>
              <Textarea
                placeholder="Message shown to English visitors"
                value={localMessageEn}
                onChange={(e) => setLocalMessageEn(e.target.value)}
              />
            </div>

            {hasConfigChanges && (
              <p className="text-sm text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                Vous avez des modifications non sauvegardées
              </p>
            )}
          </CardContent>
        </Card>

        {/* Allowed Routes Card */}
        <Card>
          <CardHeader>
            <CardTitle>Sections accessibles</CardTitle>
            <CardDescription>
              Ces routes restent accessibles même pendant la maintenance.
              Le portail admin (/admin/*) est toujours accessible.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="/contact, /aide, /portal/auth..."
                value={newRoute}
                onChange={(e) => setNewRoute(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddRoute()}
              />
              <Button onClick={handleAddRoute} disabled={updateRoutesMutation.isPending}>
                <Plus className="w-4 h-4 mr-1" />
                Ajouter
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {routes.map((route) => (
                <Badge
                  key={route}
                  variant="secondary"
                  className="flex items-center gap-1 px-3 py-1"
                >
                  {route}
                  <button
                    onClick={() => handleRemoveRoute(route)}
                    className="ml-1 hover:text-destructive"
                    disabled={updateRoutesMutation.isPending}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              Astuce: Utilisez * pour les wildcards (ex: /portal/* pour toutes les pages du portail)
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminMaintenance;
