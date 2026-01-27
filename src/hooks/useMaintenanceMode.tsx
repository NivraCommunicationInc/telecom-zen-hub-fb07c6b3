import { useQuery } from "@tanstack/react-query";
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

export const useMaintenanceMode = () => {
  const location = useLocation();

  const { data: maintenanceConfig } = useQuery({
    queryKey: ["maintenance-mode"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value_json")
        .eq("key", "maintenance_mode")
        .maybeSingle();

      if (error || !data) {
        return { enabled: false, eta: null, message_fr: "", message_en: "" };
      }

      return data.value_json as unknown as MaintenanceConfig;
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: allowedRoutes } = useQuery({
    queryKey: ["maintenance-allowed-routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value_json")
        .eq("key", "maintenance_allowed_routes")
        .maybeSingle();

      if (error || !data) {
        return { routes: ["/", "/contact", "/aide", "/portal/auth"] };
      }

      return data.value_json as unknown as AllowedRoutes;
    },
    staleTime: 30000,
  });

  const isMaintenanceActive = maintenanceConfig?.enabled ?? false;
  
  // Admin routes are always accessible
  const isAdminRoute = location.pathname.startsWith("/admin");
  
  // Check if current route is allowed
  const isRouteAllowed = allowedRoutes?.routes?.some(route => {
    if (route === location.pathname) return true;
    if (route.endsWith("*") && location.pathname.startsWith(route.slice(0, -1))) return true;
    return false;
  }) ?? false;

  const shouldShowMaintenance = isMaintenanceActive && !isAdminRoute && !isRouteAllowed;

  return {
    isMaintenanceActive,
    shouldShowMaintenance,
    maintenanceConfig,
    allowedRoutes: allowedRoutes?.routes ?? [],
  };
};
