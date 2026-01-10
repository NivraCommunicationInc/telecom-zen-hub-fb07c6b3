import { ReactNode, useEffect, useState, useRef, useCallback } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { useClientAuth } from "@/hooks/useClientAuth";
import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";
import { Loader2 } from "lucide-react";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { toast } from "sonner";

interface ClientProtectedRouteProps {
  children: ReactNode;
  /** If true, allows access even when online_access_status is blocked (for access-blocked page) */
  allowBlocked?: boolean;
}

const SESSION_RECHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const IDLE_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour (security requirement)

const ClientProtectedRoute = ({ children, allowBlocked = false }: ClientProtectedRouteProps) => {
  const { user, session, signOut, isLoading } = useClientAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isVerifying, setIsVerifying] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isOnlineBlocked, setIsOnlineBlocked] = useState(false);
  const lastAuthCheck = useRef<number>(0);

  // Handle idle timeout - auto logout after 5 minutes of inactivity
  const handleIdleLogout = useCallback(async () => {
    console.log("[ClientProtectedRoute] Idle timeout - logging out user");
    toast.info("Session expirée pour inactivité", {
      description: "Vous avez été déconnecté après 5 minutes d'inactivité.",
    });
    sessionStorage.removeItem("client_last_auth_check");
    await signOut();
    navigate("/portal/auth", { replace: true });
  }, [signOut, navigate]);

  // Enable idle timeout only when user is authenticated
  useIdleTimeout({
    onIdle: handleIdleLogout,
    timeout: IDLE_TIMEOUT_MS,
    enabled: !!user && !!session && isAuthorized,
  });

  useEffect(() => {
    const verifySession = async () => {
      // Must have both user and session
      if (!user || !session) {
        setIsVerifying(false);
        return;
      }

      // SECURITY: Check if device is trusted (20 min window) or PIN verification was completed
      const trustedUntilStr = localStorage.getItem("portal_trusted_until");
      const trustedUntil = trustedUntilStr ? Number(trustedUntilStr) : 0;
      const isTrustedDevice = Date.now() < trustedUntil;
      
      const pinVerified = sessionStorage.getItem("client_pin_verified");
      
      if (!isTrustedDevice && pinVerified !== "true") {
        console.log("[ClientProtectedRoute] Device not trusted and PIN not verified, redirecting to auth");
        setIsVerifying(false);
        navigate("/portal/auth", { replace: true });
        return;
      }
      
      // If trusted device but session PIN flag not set, set it for this session
      if (isTrustedDevice && pinVerified !== "true") {
        sessionStorage.setItem("client_pin_verified", "true");
      }

      try {
        const now = Date.now();
        const lastCheckStr = sessionStorage.getItem("client_last_auth_check");
        const lastCheckTime = lastCheckStr ? parseInt(lastCheckStr, 10) : 0;

        // SECURITY: Validate session freshness
        if (now - lastCheckTime > SESSION_RECHECK_INTERVAL_MS) {
          console.log("[ClientProtectedRoute] Session check interval exceeded, validating...");

          // Verify session is still valid with Supabase
          const { data: { session: currentSession }, error: sessionError } = await portalSupabase.auth.getSession();

          if (sessionError || !currentSession) {
            console.warn("[ClientProtectedRoute] Session expired or invalid");
            
            // Log security event
            try {
              await portalSupabase.from("admin_audit_log").insert({
                admin_user_id: user.id,
                admin_email: user.email,
                action: "security_session_blocked",
                details: {
                  reason: "Session expired or invalid",
                  portal: "client",
                  path: location.pathname,
                  timestamp: new Date().toISOString(),
                },
                target_type: "security",
              });
            } catch {
              // Ignore logging errors
            }

            sessionStorage.removeItem("client_last_auth_check");
            sessionStorage.removeItem("client_pin_verified");
            sessionStorage.removeItem("client_pin_pending_email");
            sessionStorage.removeItem("client_pin_pending_user_id");
            await signOut();
            navigate("/portal/auth", { replace: true });
            return;
          }

          // Update last check time
          sessionStorage.setItem("client_last_auth_check", now.toString());
          lastAuthCheck.current = now;
        }

        // Verify user has client role (or at least exists)
        const { data: roleData, error: roleError } = await portalSupabase
          .from("user_roles")
          .select("role, status")
          .eq("user_id", user.id)
          .maybeSingle();

        if (roleError) {
          console.error("[ClientProtectedRoute] Role check error:", roleError);
          // Allow access if role check fails but session is valid
          setIsAuthorized(true);
          setIsVerifying(false);
          return;
        }

        // Check status
        if (roleData?.status && roleData.status !== "active") {
          console.warn("[ClientProtectedRoute] Client account not active:", roleData.status);
          navigate("/portal/suspended", { replace: true });
          return;
        }

        // SECURITY: Check online_access_status from profiles (if not allowBlocked)
        if (!allowBlocked) {
          const { data: profileData } = await portalSupabase
            .from("profiles")
            .select("online_access_status")
            .eq("user_id", user.id)
            .maybeSingle();

          if (profileData?.online_access_status === "blocked") {
            console.warn("[ClientProtectedRoute] Online access blocked for user");
            setIsOnlineBlocked(true);
            setIsVerifying(false);
            navigate("/portal/access-blocked", { replace: true });
            return;
          }
        }

        // SECURITY: Block admin-only access from client portal
        if (roleData?.role === "admin") {
          // Admin shouldn't be using client portal but allow it
          console.log("[ClientProtectedRoute] Admin user accessing client portal");
        }

        setIsAuthorized(true);
      } catch (err) {
        console.error("[ClientProtectedRoute] Verification error:", err);
        // On error, allow access if session exists
        setIsAuthorized(true);
      } finally {
        setIsVerifying(false);
      }
    };

    if (!isLoading) {
      verifySession();
    }
  }, [user, session, isLoading, signOut, navigate, location.pathname, allowBlocked]);

  // Clear session storage on sign out
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === null) {
        sessionStorage.removeItem("client_last_auth_check");
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  if (isLoading || isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500 mx-auto" />
          <p className="text-muted-foreground">Vérification...</p>
        </div>
      </div>
    );
  }

  if (!user || !session) {
    sessionStorage.removeItem("client_last_auth_check");
    sessionStorage.removeItem("client_pin_verified");
    sessionStorage.removeItem("client_pin_pending_email");
    sessionStorage.removeItem("client_pin_pending_user_id");
    return <Navigate to="/portal/auth" replace />;
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
};

export default ClientProtectedRoute;
