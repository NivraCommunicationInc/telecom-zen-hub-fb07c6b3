import { useEffect, useState, useRef, useCallback } from "react";
import { Navigate, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEmployeeAuth } from "@/hooks/useEmployeeAuth";
import { employeeClient as employeeSupabase } from "@/integrations/backend/employeeClient";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { toast } from "sonner";

const SESSION_RECHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes for employees

const EmployeeProtectedRoute = () => {
  const { user, signOut, isLoading } = useEmployeeAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [verificationState, setVerificationState] = useState<
    "pending" | "loading" | "verified" | "denied" | "not_authenticated"
  >("pending");
  const hasLoggedBlockedAccess = useRef(false);

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
    enabled: verificationState === "verified",
  });

  useEffect(() => {
    let isMounted = true;

    const verifyStaffRole = async () => {
      // No user in employee session → not authenticated
      if (!user) {
        console.log("[EmployeeProtectedRoute] No user in employee session");
        if (isMounted) setVerificationState("not_authenticated");
        return;
      }

      if (isMounted) setVerificationState("loading");
      console.log(
        "[EmployeeProtectedRoute] Starting verification for user:",
        user.id,
        user.email
      );

      try {
        // Session freshness check
        const now = Date.now();
        const lastCheck = sessionStorage.getItem("employee_last_auth_check");
        const lastCheckTime = lastCheck ? parseInt(lastCheck, 10) : 0;

        if (now - lastCheckTime > SESSION_RECHECK_INTERVAL_MS) {
          const {
            data: { session },
            error: sessionError,
          } = await employeeSupabase.auth.getSession();

          if (sessionError || !session) {
            console.log("[EmployeeProtectedRoute] Session invalid or expired");
            await signOut();
            if (isMounted) setVerificationState("not_authenticated");
            return;
          }

          sessionStorage.setItem("employee_last_auth_check", now.toString());
        }

        // SECURITY: Verify role from database - ONLY employee allowed
        const { data: roleData, error } = await employeeSupabase
          .from("user_roles")
          .select("role, status, is_active")
          .eq("user_id", user.id)
          .eq("role", "employee")
          .maybeSingle();

        console.log("[EmployeeProtectedRoute] Role query result:", { roleData, error });

        if (error) {
          console.error("[EmployeeProtectedRoute] Role lookup error:", error);
          toast.error("Erreur de vérification", {
            description: "Impossible de vérifier vos permissions.",
          });
          await signOut();
          if (isMounted) setVerificationState("not_authenticated");
          return;
        }

        // Not employee role
        if (!roleData || roleData.role !== "employee") {
          console.log(
            "[EmployeeProtectedRoute] Role mismatch. User role:",
            roleData?.role || "none"
          );

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
                  reason: "Non-employee attempted to access /employee/* route",
                  timestamp: new Date().toISOString(),
                },
                target_type: "security",
                target_id: null,
                target_email: user.email,
              });
            } catch (logErr) {
              console.error("[EmployeeProtectedRoute] Audit log error:", logErr);
            }
          }

          toast.error("Accès refusé", {
            description: "Vous n'êtes pas autorisé à accéder au portail employé.",
          });
          await signOut();
          if (isMounted) setVerificationState("denied");
          return;
        }

        // Check status and is_active
        if (roleData.status !== "active" || roleData.is_active === false) {
          console.log(
            "[EmployeeProtectedRoute] Account not active:",
            roleData.status,
            roleData.is_active
          );
          toast.error("Compte désactivé", {
            description: "Votre compte employé est désactivé. Contactez un administrateur.",
          });
          await signOut();
          if (isMounted) setVerificationState("denied");
          return;
        }

        console.log("[EmployeeProtectedRoute] ✓ Verified as employee");
        if (isMounted) setVerificationState("verified");
      } catch (err) {
        console.error("[EmployeeProtectedRoute] Verification error:", err);
        toast.error("Erreur", {
          description: "Une erreur est survenue lors de la vérification.",
        });
        await signOut();
        if (isMounted) setVerificationState("not_authenticated");
      }
    };

    if (!isLoading) {
      verifyStaffRole();
    }

    return () => {
      isMounted = false;
    };
  }, [user, isLoading, signOut, location.pathname]);

  // Loading state (auth loading OR verification in progress)
  if (isLoading || verificationState === "pending" || verificationState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Vérification des accès...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - Navigate to login
  if (verificationState === "not_authenticated" || !user) {
    console.log("[EmployeeProtectedRoute] Navigate to /employee/login (not authenticated)");
    sessionStorage.removeItem("employee_last_auth_check");
    return <Navigate to="/employee/login" replace />;
  }

  // Access denied - Navigate to login
  if (verificationState === "denied") {
    console.log("[EmployeeProtectedRoute] Navigate to /employee/login (access denied)");
    sessionStorage.removeItem("employee_last_auth_check");
    return <Navigate to="/employee/login" replace />;
  }

  // Verified - render nested employee routes
  if (verificationState === "verified") {
    return <Outlet />;
  }

  // Fallback (should never reach here) - Navigate to login
  console.log("[EmployeeProtectedRoute] Fallback Navigate to /employee/login");
  return <Navigate to="/employee/login" replace />;
};

export default EmployeeProtectedRoute;
