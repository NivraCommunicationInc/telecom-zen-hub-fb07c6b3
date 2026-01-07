import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
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
  const { shouldShowMaintenance, maintenanceConfig } = useMaintenanceMode();

  if (shouldShowMaintenance) {
    return (
      <MaintenancePage
        eta={maintenanceConfig?.eta}
        messageFr={maintenanceConfig?.message_fr}
        messageEn={maintenanceConfig?.message_en}
      />
    );
  }

  return <>{children}</>;
};

export default MaintenanceGuard;
