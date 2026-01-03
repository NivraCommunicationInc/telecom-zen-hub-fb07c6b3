import { ReactNode, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";

interface TechnicianProtectedRouteProps {
  children: ReactNode;
}

const SESSION_MAX_AGE_HOURS = 8;
const SESSION_RECHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

const TechnicianProtectedRoute = ({ children }: TechnicianProtectedRouteProps) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const lastAuthCheck = useRef<number>(0);

  useEffect(() => {
    const checkSession = () => {
      try {
        const storedSession = localStorage.getItem("nivra_technician_session");

        if (!storedSession) {
          console.log("[TechnicianProtectedRoute] No session found");
          navigate("/technician/auth", { replace: true });
          return;
        }

        const session = JSON.parse(storedSession);

        // Check if session is still valid (within max age)
        const authenticatedAt = new Date(session.authenticated_at);
        const hoursElapsed = (Date.now() - authenticatedAt.getTime()) / (1000 * 60 * 60);

        if (hoursElapsed > SESSION_MAX_AGE_HOURS) {
          console.log("[TechnicianProtectedRoute] Session expired (age)");
          localStorage.removeItem("nivra_technician_session");
          navigate("/technician/auth", { replace: true });
          return;
        }

        if (!session.token || !session.id) {
          console.log("[TechnicianProtectedRoute] Invalid session data");
          localStorage.removeItem("nivra_technician_session");
          navigate("/technician/auth", { replace: true });
          return;
        }

        // SECURITY: Check for recent auth verification (last_auth_check gate)
        const lastCheckStr = session.lastAuthCheck;
        const lastCheckTime = lastCheckStr ? new Date(lastCheckStr).getTime() : 0;
        const now = Date.now();

        if (now - lastCheckTime > SESSION_RECHECK_INTERVAL_MS) {
          console.log("[TechnicianProtectedRoute] Auth check interval exceeded - session needs revalidation");
          localStorage.removeItem("nivra_technician_session");
          navigate("/technician/auth", { replace: true });
          return;
        }

        lastAuthCheck.current = now;
        setIsAuthorized(true);
      } catch (error) {
        console.error("[TechnicianProtectedRoute] Session check error:", error);
        localStorage.removeItem("nivra_technician_session");
        navigate("/technician/auth", { replace: true });
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();

    // Periodic recheck
    const intervalId = setInterval(() => {
      checkSession();
    }, SESSION_RECHECK_INTERVAL_MS);

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "nivra_technician_session" && !e.newValue) {
        navigate("/technician/auth", { replace: true });
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(intervalId);
    };
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-primary" />
          <p className="text-muted-foreground">Vérification...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
};

export default TechnicianProtectedRoute;
