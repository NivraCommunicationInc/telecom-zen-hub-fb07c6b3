/**
 * AdminPOS - Point of Sale for Admin portal
 * Wraps the unified POS in AdminLayout for consistent admin design
 */
import AdminLayout from "@/components/admin/AdminLayout";
import UnifiedPOSPage from "@/components/pos/UnifiedPOSPage";

export default function AdminPOS() {
  return (
    <AdminLayout>
      <div className="-mx-4 lg:-mx-8 -my-6 lg:-my-8">
        <UnifiedPOSPage
          portalType="admin"
          backPath="/admin"
          repName="Admin"
        />
      </div>
    </AdminLayout>
  );
}
