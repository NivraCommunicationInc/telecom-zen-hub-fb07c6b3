import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";

interface MaintenanceConfig {
  enabled: boolean;
  eta: string | null;
  message_fr: string;
  message_en: string;
}

interface AllowedRoutes {
  routes: string[];
}

const DEFAULT_CONFIG: MaintenanceConfig = {
  enabled: false,
  eta: null,
  message_fr: "",
  message_en: "",
};

const DEFAULT_ROUTES = ["/", "/contact", "/aide", "/portal/auth", "/status"];

export const useMaintenanceMode = () => {
  const location = useLocation();
  const queryClient = useQueryClient();

  const { data: maintenanceConfig } = useQuery({
    queryKey: ["site-settings", "maintenance_mode"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value_json")
        .eq("key", "maintenance_mode")
        .maybeSingle();
      if (error || !data?.value_json) return DEFAULT_CONFIG;
      return { ...DEFAULT_CONFIG, ...(data.value_json as unknown as MaintenanceConfig) };
    },
    staleTime: 15_000,
  });

  const { data: allowedRoutes } = useQuery({
    queryKey: ["site-settings", "maintenance_allowed_routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value_json")
        .eq("key", "maintenance_allowed_routes")
        .maybeSingle();
      if (error || !data?.value_json) return { routes: DEFAULT_ROUTES };
      return data.value_json as unknown as AllowedRoutes;
    },
    staleTime: 30_000,
  });

  // Realtime: invalidate caches when admin updates either key
  useEffect(() => {
    const channel = supabase
      .channel("maintenance_mode_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_settings", filter: "key=eq.maintenance_mode" },
        () => queryClient.invalidateQueries({ queryKey: ["site-settings", "maintenance_mode"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "site_settings", filter: "key=eq.maintenance_allowed_routes" },
        () => queryClient.invalidateQueries({ queryKey: ["site-settings", "maintenance_allowed_routes"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const isMaintenanceActive = maintenanceConfig?.enabled ?? false;

  // Internal portals always accessible
  const isInternalRoute =
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/core") ||
    location.pathname.startsWith("/employee") ||
    location.pathname.startsWith("/field") ||
    location.pathname.startsWith("/rh") ||
    location.pathname.startsWith("/hub");

  const isRouteAllowed = allowedRoutes?.routes?.some((route) => {
    if (route === location.pathname) return true;
    if (route.endsWith("*") && location.pathname.startsWith(route.slice(0, -1))) return true;
    return false;
  }) ?? false;

  const shouldShowMaintenance = isMaintenanceActive && !isInternalRoute && !isRouteAllowed;

  return {
    isMaintenanceActive,
    shouldShowMaintenance,
    maintenanceConfig: maintenanceConfig ?? DEFAULT_CONFIG,
    allowedRoutes: allowedRoutes?.routes ?? DEFAULT_ROUTES,
  };
};
