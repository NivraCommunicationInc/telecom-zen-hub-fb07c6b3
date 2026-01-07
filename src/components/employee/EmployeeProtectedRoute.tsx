import { ReactNode, useEffect, useState, useRef, useCallback } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { useEmployeeAuth } from "@/hooks/useEmployeeAuth";
import { employeeSupabase } from "@/integrations/supabase/employeeClient";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { toast } from "sonner";

interface EmployeeProtectedRouteProps {
  children: ReactNode;
}

const SESSION_RECHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes for employees

const EmployeeProtectedRoute = ({ children }: EmployeeProtectedRouteProps) => {
  const { user, signOut, isLoading, role } = useEmployeeAuth();
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
    let isMounted = true;
    
    const verifyStaffRole = async () => {
      // No user in employee session → redirect to login
      if (!user) {
        console.log("[EmployeeProtectedRoute] No user in employee session → redirect to login");
        if (isMounted) setIsVerifying(false);
        return;
      }
      
      console.log("[EmployeeProtectedRoute] Starting verification for user:", user.id, user.email);

      try {
        // Session freshness check
        const now = Date.now();
        const lastCheck = sessionStorage.getItem("employee_last_auth_check");
        const lastCheckTime = lastCheck ? parseInt(lastCheck, 10) : 0;
        
        if (now - lastCheckTime > SESSION_RECHECK_INTERVAL_MS) {
          const { data: { session }, error: sessionError } = await employeeSupabase.auth.getSession();
          
          if (sessionError || !session) {
            console.log("[EmployeeProtectedRoute] Session invalid or expired → signOut");
            await signOut();
            navigate("/employee/login", { replace: true });
            return;
          }
          
          sessionStorage.setItem("employee_last_auth_check", now.toString());
          lastAuthCheck.current = now;
        }

        // SECURITY: Verify role from database - ONLY employee allowed
        const { data: roleData, error } = await employeeSupabase
          .from("user_roles")
          .select("role, status, is_active")
          .eq("user_id", user.id)
          .eq("role", "employee")
          .maybeSingle();

        if (error) {
          console.error("[EmployeeProtectedRoute] Role lookup error:", error);
          await signOut();
          navigate("/employee/login", { replace: true });
          return;
        }

        // Not employee role
        if (!roleData || roleData.role !== "employee") {
          console.log("[EmployeeProtectedRoute] Role mismatch → signOut. User role:", roleData?.role || "none");
          
          if (!hasLoggedBlockedAccess.current) {
            hasLoggedBlockedAccess.current = true;
            try {
              await employeeSupabase.from("admin_audit_log").insert({
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
          
          toast.error("Accès refusé", {
            description: "Vous n'êtes pas autorisé à accéder au portail employé.",
          });
          await signOut();
          navigate("/employee/login", { replace: true });
          return;
        }

        // Check status and is_active
        if (roleData.status !== "active" || roleData.is_active === false) {
          console.log("[EmployeeProtectedRoute] Account not active → signOut");
          toast.error("Compte désactivé", {
            description: "Votre compte employé est désactivé. Contactez un administrateur.",
          });
          await signOut();
          navigate("/employee/login", { replace: true });
          return;
        }

        console.log("[EmployeeProtectedRoute] Verified as:", roleData.role);
        if (isMounted) setIsStaffVerified(true);
      } catch (err) {
        console.error("[EmployeeProtectedRoute] Verification error:", err);
        await signOut();
        navigate("/employee/login", { replace: true });
      } finally {
        if (isMounted) setIsVerifying(false);
      }
    };

    if (!isLoading) {
      verifyStaffRole();
    }
    
    return () => {
      isMounted = false;
    };
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
    console.log("[EmployeeProtectedRoute] No user → Navigate to /employee/login");
    return <Navigate to="/employee/login" replace />;
  }

  // Not verified - should not happen if verification completed correctly
  // But if we get here, show a loading/redirect state instead of blank page
  if (!isStaffVerified) {
    console.log("[EmployeeProtectedRoute] Not verified after loading - redirecting to login");
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Redirection en cours...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default EmployeeProtectedRoute;
