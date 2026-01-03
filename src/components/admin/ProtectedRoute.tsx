import { ReactNode, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

const ProtectedRoute = ({ children, requireAdmin = false }: ProtectedRouteProps) => {
  const { user, signOut, isLoading } = useAuth();
  const navigate = useNavigate();
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAdminVerified, setIsAdminVerified] = useState(false);

  useEffect(() => {
    const verifyAdminRole = async () => {
      if (!user) {
        setIsVerifying(false);
        return;
      }

      try {
        // Always verify admin role from database for /admin routes
        const { data: roleData, error } = await supabase
          .from("user_roles")
          .select("role, status")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (error) {
          console.error("Error verifying admin role:", error);
          // On error, sign out and redirect
          await signOut();
          navigate("/employee/login", { replace: true });
          return;
        }

        if (!roleData || roleData.role !== "admin") {
          // Not an admin - sign out immediately and redirect
          console.warn("Non-admin user attempted to access admin route:", user.email);
          await signOut();
          navigate("/employee/login", { replace: true });
          return;
        }

        // Check status
        if (roleData.status !== "active") {
          console.warn("Admin account not active:", user.email, roleData.status);
          await signOut();
          navigate("/admin/login", { replace: true });
          return;
        }

        setIsAdminVerified(true);
      } catch (err) {
        console.error("Admin verification error:", err);
        await signOut();
        navigate("/employee/login", { replace: true });
      } finally {
        setIsVerifying(false);
      }
    };

    if (!isLoading) {
      verifyAdminRole();
    }
  }, [user, isLoading, signOut, navigate]);

  // Show loading while auth or verification is in progress
  if (isLoading || isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Vérification des accès...</p>
        </div>
      </div>
    );
  }

  // Not logged in - redirect to admin login
  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  // Not verified as admin - don't render anything (already redirecting)
  if (requireAdmin && !isAdminVerified) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;