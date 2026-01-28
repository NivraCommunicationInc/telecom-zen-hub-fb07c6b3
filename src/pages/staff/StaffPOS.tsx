/**
 * StaffPOS - Point of Sale for Employee portal
 */
import UnifiedPOSPage from "@/components/pos/UnifiedPOSPage";

export default function StaffPOS() {
  return (
    <UnifiedPOSPage
      portalType="staff"
      backPath="/staff"
      repName="Employé"
    />
  );
}
