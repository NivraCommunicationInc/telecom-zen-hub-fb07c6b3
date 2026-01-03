import { ReactNode, useEffect, useState, useRef } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

const ProtectedRoute = ({ children, requireAdmin = false }: ProtectedRouteProps) => {
  const { user, signOut, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const hasLoggedBlockedAccess = useRef(false);

  useEffect(() => {
    const verifyAdminRole = async () => {
      if (!user) {
        setIsVerifying(false);
        return;
      }

      try {
        // SECURITY: Always verify admin role from database - never trust client state
        const { data: roleData, error } = await supabase
          .from("user_roles")
          .select("role, status")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (error) {
          console.error("Error verifying admin role:", error);
          await signOut();
          navigate("/employee/login", { replace: true });
          return;
        }

        // SECURITY: Non-admin attempting to access /admin/*
        if (!roleData || roleData.role !== "admin") {
          console.warn("SECURITY: Non-admin user attempted to access admin route:", user.email, location.pathname);
          
          // Log blocked access attempt to audit log (only once per mount)
          if (!hasLoggedBlockedAccess.current) {
            hasLoggedBlockedAccess.current = true;
            try {
              await supabase.from("admin_audit_log").insert({
                admin_user_id: user.id,
                admin_email: user.email,
                action: "admin_access_blocked",
                details: {
                  attempted_path: location.pathname,
                  user_role: roleData?.role || "unknown",
                  reason: "Non-admin attempted to access /admin/* route",
                  timestamp: new Date().toISOString(),
                },
                target_type: "security",
                target_id: null,
                target_email: user.email,
              });
            } catch (logErr) {
              console.error("Failed to log blocked access:", logErr);
            }
          }
          
          // Sign out immediately and redirect
          await signOut();
          navigate("/employee/login", { replace: true });
          return;
        }

        // Check status - only active admins allowed
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
  }, [user, isLoading, signOut, navigate, location.pathname]);

  // SECURITY: Show nothing while verifying - prevent any admin UI flash
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

  // SECURITY: Not verified as admin - render nothing (already redirecting)
  if (requireAdmin && !isAdminVerified) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
