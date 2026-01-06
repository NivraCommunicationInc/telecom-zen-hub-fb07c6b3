import { ReactNode, useEffect, useState, useRef, useCallback } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { toast } from "sonner";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

const SESSION_RECHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const ProtectedRoute = ({ children, requireAdmin = false }: ProtectedRouteProps) => {
  const { user, signOut, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  const hasLoggedBlockedAccess = useRef(false);
  const lastAuthCheck = useRef<number>(0);

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
      if (!user) {
        setIsVerifying(false);
        return;
      }

      try {
        // SECURITY: Check session freshness - require re-auth if stale
        const now = Date.now();
        const lastCheck = sessionStorage.getItem("admin_last_auth_check");
        const lastCheckTime = lastCheck ? parseInt(lastCheck, 10) : 0;
        
        if (now - lastCheckTime > SESSION_RECHECK_INTERVAL_MS) {
          console.log("[ProtectedRoute] Session check interval exceeded, validating with backend...");
          
          // Verify session is still valid with Supabase
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError || !session) {
            console.warn("SECURITY: Session expired or invalid");
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
          console.warn("SECURITY: Non-admin user attempted to access admin route:", user.id, location.pathname);
          
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
          console.warn("Admin account not active:", user.id, roleData.status);
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
  if (!user) {
    // Clear any stale session data
    sessionStorage.removeItem("admin_last_auth_check");
    return <Navigate to="/admin/login" replace />;
  }

  // SECURITY: Not verified as admin - render nothing (already redirecting)
  if (requireAdmin && !isAdminVerified) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
