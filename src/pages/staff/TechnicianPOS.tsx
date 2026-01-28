/**
 * TechnicianPOS - Point of Sale for Technician portal
 */
import UnifiedPOSPage from "@/components/pos/UnifiedPOSPage";

export default function TechnicianPOS() {
  return (
    <UnifiedPOSPage
      portalType="technician"
      backPath="/staff/technician"
      repName="Technicien"
    />
  );
}
