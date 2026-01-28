import AdminNotifications from "@/pages/admin/AdminNotifications";
import StaffBackground from "@/components/staff/StaffBackground";
import { StaffSidebar } from "@/components/staff/StaffSidebar";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function StaffNotifications() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnexion réussie");
    navigate("/staff");
  };

  return (
    <div className="min-h-screen relative flex">
      <StaffBackground />
      <StaffSidebar onSignOut={handleLogout} />
      <div className="flex-1">
        <AdminNotifications basePath="/staff" />
      </div>
    </div>
  );
}
