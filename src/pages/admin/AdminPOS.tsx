/**
 * AdminPOS - Point of Sale for Admin portal
 */
import UnifiedPOSPage from "@/components/pos/UnifiedPOSPage";

export default function AdminPOS() {
  return (
    <UnifiedPOSPage
      portalType="admin"
      backPath="/admin"
      repName="Admin"
    />
  );
}
