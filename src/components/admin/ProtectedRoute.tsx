import { ReactNode, useEffect, useState, useRef, useCallback } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { toast } from "sonner";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

const SESSION_RECHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const ProtectedRoute = ({ children, requireAdmin = false }: ProtectedRouteProps) => {
  const { user, session, signOut, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const hasLoggedBlockedAccess = useRef(false);
  const lastAuthCheck = useRef<number>(0);

  // DEBUG: Log guard state
  console.log("[AdminGuard] state", { 
    loading: isLoading, 
    hasUser: !!user, 
    hasSession: !!session,
    isVerifying,
    isAdminVerified,
    path: location.pathname 
  });

  // Handle idle timeout - auto logout after 5 minutes of inactivity
  const handleIdleLogout = useCallback(async () => {
    console.log("[ProtectedRoute] Idle timeout - logging out admin");
    toast.info("Session expirée pour inactivité", {
      description: "Vous avez été déconnecté après 5 minutes d'inactivité.",
    });
    sessionStorage.removeItem("admin_last_auth_check");
    await signOut();
    navigate("/admin/login", { replace: true });
  }, [signOut, navigate]);

  // Enable idle timeout only when user is authenticated and verified
  useIdleTimeout({
    onIdle: handleIdleLogout,
    timeout: IDLE_TIMEOUT_MS,
    enabled: !!user && isAdminVerified,
  });

  useEffect(() => {
    const verifyAdminRole = async () => {
      console.log("[AdminGuard] verifyAdminRole called", { 
        hasUser: !!user, 
        hasSession: !!session,
        isLoading 
      });

      // CRITICAL: Wait for auth to finish loading before making any decisions
      if (isLoading) {
        console.log("[AdminGuard] Auth still loading, waiting...");
        return; // Keep isVerifying true, don't make any decisions yet
      }

      // Only after auth is done loading, check for user/session
      if (!user || !session) {
        console.log("[AdminGuard] No user or session after auth loaded");
        setIsVerifying(false);
        return;
      }

      try {
        // SECURITY: Check session freshness - require re-auth if stale
        const now = Date.now();
        const lastCheck = sessionStorage.getItem("admin_last_auth_check");
        const lastCheckTime = lastCheck ? parseInt(lastCheck, 10) : 0;
        
        if (now - lastCheckTime > SESSION_RECHECK_INTERVAL_MS) {
          console.log("[AdminGuard] Session check interval exceeded, validating with backend...");
          
          // Verify session is still valid with Supabase
          const { data: { session: freshSession }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError || !freshSession) {
            console.warn("[AdminGuard] SECURITY: Session expired or invalid");
            await signOut();
            
            // Log security event
            try {
              await supabase.from("admin_audit_log").insert({
                admin_user_id: user.id,
                admin_email: user.email,
                action: "security_session_blocked",
                details: {
                  reason: "Session expired or invalid",
                  portal: "admin",
                  path: location.pathname,
                  timestamp: new Date().toISOString(),
                },
                target_type: "security",
                target_id: null,
                target_email: user.email,
              });
            } catch (logErr) {
              console.error("Failed to log session block:", logErr);
            }
            
            navigate("/admin/login", { replace: true });
            return;
          }
          
          // Update last check time
          sessionStorage.setItem("admin_last_auth_check", now.toString());
          lastAuthCheck.current = now;
        }

        // SECURITY: Verify admin OR employee role from database - never trust client state
        console.log("[AdminGuard] Checking role for user:", user.id);
        const { data: roleData, error } = await supabase
          .from("user_roles")
          .select("role, status")
          .eq("user_id", user.id)
          .in("role", ["admin", "employee"])
          .maybeSingle();

        console.log("[AdminGuard] Role query result:", { roleData, error: error?.message });

        if (error) {
          console.error("[AdminGuard] Error verifying role:", error);
          // Don't signOut on query error - might be transient
          setIsVerifying(false);
          setIsAdminVerified(false);
          return;
        }

        // SECURITY: Non-admin/employee attempting to access /admin/*
        if (!roleData || !["admin", "employee"].includes(roleData.role)) {
          console.warn("[AdminGuard] SECURITY: Unauthorized role:", roleData?.role || "none");
          
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
                  reason: "Unauthorized user attempted to access /admin/* route",
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
          
          // DON'T signOut here - just deny access
          // The user might have a valid session but wrong role
          setIsVerifying(false);
          setIsAdminVerified(false);
          return;
        }

        // Check status - only active admins allowed
        if (roleData.status !== "active") {
          console.warn("[AdminGuard] Admin account not active:", roleData.status);
          setIsVerifying(false);
          setIsAdminVerified(false);
          return;
        }

        console.log("[AdminGuard] Role verified successfully:", roleData.role);
        setIsAdminVerified(true);
      } catch (err) {
        console.error("[AdminGuard] Admin verification error:", err);
        setIsVerifying(false);
        setIsAdminVerified(false);
      } finally {
        setIsVerifying(false);
      }
    };

    if (!isLoading) {
      verifyAdminRole();
    }
  }, [user, session, isLoading, signOut, navigate, location.pathname]);

  // Clear session storage on sign out
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === null) {
        // Storage was cleared
        sessionStorage.removeItem("admin_last_auth_check");
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

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
  if (!user || !session) {
    console.log("[AdminGuard] No user/session, redirecting to login");
    sessionStorage.removeItem("admin_last_auth_check");
    return <Navigate to="/admin/login" replace />;
  }

  // SECURITY: Not verified as admin - show access denied instead of redirect loop
  if (requireAdmin && !isAdminVerified) {
    console.log("[AdminGuard] Admin not verified, showing access denied");
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md p-8">
          <div className="text-destructive text-6xl">⛔</div>
          <h1 className="text-2xl font-bold text-foreground">Accès refusé</h1>
          <p className="text-muted-foreground">
            Vous n'avez pas les permissions nécessaires pour accéder à cette page.
          </p>
          <button
            onClick={async () => {
              await signOut();
              navigate("/admin/login", { replace: true });
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
