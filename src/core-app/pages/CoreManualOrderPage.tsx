import EmployeeCreateOrder from "@/employee-app/pages/EmployeeCreateOrder";
import { corePath } from "@/core-app/lib/corePaths";

export default function CoreManualOrderPage() {
  return (
    <EmployeeCreateOrder
      portal="core"
      pathBuilder={corePath}
      subtitle="Nivra Core — commande manuelle"
      source="nivra_core_manual_order"
      allowCustomCredit
    />
  );
}