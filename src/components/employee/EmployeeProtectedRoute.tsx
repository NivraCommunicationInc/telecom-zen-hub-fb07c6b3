import { ReactNode, useEffect, useState, useRef, useCallback } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { toast } from "sonner";

interface EmployeeProtectedRouteProps {
  children: ReactNode;
}

const SESSION_RECHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes for employees

const EmployeeProtectedRoute = ({ children }: EmployeeProtectedRouteProps) => {
  const { user, signOut, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isVerifying, setIsVerifying] = useState(true);
  const [isStaffVerified, setIsStaffVerified] = useState(false);
  const hasLoggedBlockedAccess = useRef(false);
  const lastAuthCheck = useRef<number>(0);

  // Handle idle timeout
  const handleIdleLogout = useCallback(async () => {
    toast.info("Session expirée pour inactivité", {
      description: "Vous avez été déconnecté après 10 minutes d'inactivité.",
    });
    sessionStorage.removeItem("employee_last_auth_check");
    await signOut();
    navigate("/employee/login", { replace: true });
  }, [signOut, navigate]);

  useIdleTimeout({
    onIdle: handleIdleLogout,
    timeout: IDLE_TIMEOUT_MS,
    enabled: !!user && isStaffVerified,
  });

  useEffect(() => {
    const verifyStaffRole = async () => {
      if (!user) {
        setIsVerifying(false);
        return;
      }

      try {
        // Session freshness check
        const now = Date.now();
        const lastCheck = sessionStorage.getItem("employee_last_auth_check");
        const lastCheckTime = lastCheck ? parseInt(lastCheck, 10) : 0;
        
        if (now - lastCheckTime > SESSION_RECHECK_INTERVAL_MS) {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError || !session) {
            await signOut();
            navigate("/employee/login", { replace: true });
            return;
          }
          
          sessionStorage.setItem("employee_last_auth_check", now.toString());
          lastAuthCheck.current = now;
        }

        // SECURITY: Verify role from database - allow employee OR admin
        const { data: roleData, error } = await supabase
          .from("user_roles")
          .select("role, status")
          .eq("user_id", user.id)
          .in("role", ["employee", "admin"])
          .maybeSingle();

        if (error) {
          await signOut();
          navigate("/employee/login", { replace: true });
          return;
        }

        // Not employee or admin
        if (!roleData || !["employee", "admin"].includes(roleData.role)) {
          if (!hasLoggedBlockedAccess.current) {
            hasLoggedBlockedAccess.current = true;
            try {
              await supabase.from("admin_audit_log").insert({
                admin_user_id: user.id,
                admin_email: user.email,
                action: "employee_access_blocked",
                details: {
                  attempted_path: location.pathname,
                  user_role: roleData?.role || "unknown",
                  reason: "Non-staff attempted to access /employee/* route",
                  timestamp: new Date().toISOString(),
                },
                target_type: "security",
                target_id: null,
                target_email: user.email,
              });
            } catch (logErr) {
              // Ignore logging errors
            }
          }
          
          await signOut();
          navigate("/employee/login", { replace: true });
          return;
        }

        // Check status
        if (roleData.status !== "active") {
          await signOut();
          navigate("/employee/login", { replace: true });
          return;
        }

        setIsStaffVerified(true);
      } catch (err) {
        await signOut();
        navigate("/employee/login", { replace: true });
      } finally {
        setIsVerifying(false);
      }
    };

    if (!isLoading) {
      verifyStaffRole();
    }
  }, [user, isLoading, signOut, navigate, location.pathname]);

  // Loading state
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

  // Not logged in
  if (!user) {
    sessionStorage.removeItem("employee_last_auth_check");
    return <Navigate to="/employee/login" replace />;
  }

  // Not verified
  if (!isStaffVerified) {
    return null;
  }

  return <>{children}</>;
};

export default EmployeeProtectedRoute;
