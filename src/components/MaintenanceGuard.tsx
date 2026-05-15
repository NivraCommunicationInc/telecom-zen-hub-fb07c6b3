import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { supabase } from "@/integrations/supabase/client";
import MaintenancePage from "./MaintenancePage";

interface MaintenanceGuardProps {
  children: ReactNode;
}

/**
 * MaintenanceGuard - Wraps routes to show maintenance page when maintenance mode is active
 * 
 * Rules:
 * - /admin/* routes are ALWAYS accessible (admins must be able to manage the site)
 * - Routes in the allowed_routes list (from site_settings) are accessible
 * - Supports wildcards: "/portal/*" matches all /portal/... routes
 * - All other routes show the maintenance page
 */
const MaintenanceGuard = ({ children }: MaintenanceGuardProps) => {
  const location = useLocation();
  const { shouldShowMaintenance, maintenanceConfig, allowedRoutes } = useMaintenanceMode();
  const [fallbackConfig, setFallbackConfig] = useState({
    enabled: false,
    eta: null as string | null,
    message_fr: "",
    message_en: "",
  });

  useEffect(() => {
    let isMounted = true;

    const readMaintenanceMode = async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value_json")
        .eq("key", "maintenance_mode")
        .maybeSingle();

      const raw = (data?.value_json ?? {}) as {
        enabled?: boolean | string;
        eta?: string | null;
        message_fr?: string;
        message_en?: string;
      };

      if (!isMounted) return;

      setFallbackConfig({
        enabled: raw.enabled === true || raw.enabled === "true",
        eta: raw.eta ?? null,
        message_fr: raw.message_fr ?? "",
        message_en: raw.message_en ?? "",
      });
    };

    readMaintenanceMode();
    const interval = window.setInterval(readMaintenanceMode, 2000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const isInternalRoute =
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/core") ||
    location.pathname.startsWith("/employee") ||
    location.pathname.startsWith("/field") ||
    location.pathname.startsWith("/hr") ||
    location.pathname.startsWith("/rh") ||
    location.pathname.startsWith("/hub");

  const isFallbackAllowedRoute = allowedRoutes.some((route) => {
    if (route === location.pathname) return true;
    if (route.endsWith("*") && location.pathname.startsWith(route.slice(0, -1))) return true;
    return false;
  });

  const effectiveConfig = fallbackConfig.enabled ? { ...maintenanceConfig, ...fallbackConfig } : maintenanceConfig;
  const shouldForceMaintenance = fallbackConfig.enabled && !isInternalRoute && !isFallbackAllowedRoute;

  if (shouldShowMaintenance || shouldForceMaintenance) {
    return (
      <MaintenancePage
        eta={effectiveConfig?.eta}
        messageFr={effectiveConfig?.message_fr}
        messageEn={effectiveConfig?.message_en}
      />
    );
  }

  return <>{children}</>;
};

export default MaintenanceGuard;
