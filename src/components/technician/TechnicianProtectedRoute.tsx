import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface TechnicianProtectedRouteProps {
  children: ReactNode;
}

const TechnicianProtectedRoute = ({ children }: TechnicianProtectedRouteProps) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const checkSession = () => {
      try {
        const storedSession = localStorage.getItem("nivra_technician_session");
        
        if (!storedSession) {
          navigate("/technician/auth");
          return;
        }

        const session = JSON.parse(storedSession);
        
        // Check if session is still valid (within 8 hours)
        const authenticatedAt = new Date(session.authenticated_at);
        const hoursElapsed = (Date.now() - authenticatedAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursElapsed > 8) {
          localStorage.removeItem("nivra_technician_session");
          navigate("/technician/auth");
          return;
        }

        setIsAuthorized(true);
      } catch (error) {
        console.error("Session check error:", error);
        localStorage.removeItem("nivra_technician_session");
        navigate("/technician/auth");
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();

    // Listen for storage changes (e.g., logout in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "nivra_technician_session" && !e.newValue) {
        navigate("/technician/auth");
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center mx-auto animate-pulse">
            <span className="text-navy-900 font-bold text-xl">N</span>
          </div>
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
