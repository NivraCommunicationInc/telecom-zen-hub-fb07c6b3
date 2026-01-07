import { ReactNode } from "react";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import MaintenancePage from "./MaintenancePage";

interface MaintenanceGuardProps {
  children: ReactNode;
}

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
