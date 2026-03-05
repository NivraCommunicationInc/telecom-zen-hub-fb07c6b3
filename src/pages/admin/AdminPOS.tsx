/**
 * AdminPOS - Point of Sale for Admin portal
 * Full-width workspace layout — no card boxing
 */
import AdminLayout from "@/components/admin/AdminLayout";
import UnifiedPOSPage from "@/components/pos/UnifiedPOSPage";

export default function AdminPOS() {
  return (
    <AdminLayout>
      <div className="-mx-4 lg:-mx-6 -my-4 lg:-my-5">
        <UnifiedPOSPage
          portalType="admin"
          backPath="/admin"
          repName="Admin"
        />
      </div>
    </AdminLayout>
  );
}
