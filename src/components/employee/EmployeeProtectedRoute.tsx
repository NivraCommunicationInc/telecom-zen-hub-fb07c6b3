import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";

interface EmployeeProtectedRouteProps {
  children: ReactNode;
}

const EmployeeProtectedRoute = ({ children }: EmployeeProtectedRouteProps) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const checkSession = () => {
      try {
        const storedSession = localStorage.getItem("nivra_employee_session");
        
        if (!storedSession) {
          navigate("/employee/login");
          return;
        }

        const session = JSON.parse(storedSession);
        
        // Check if session is still valid (within 8 hours)
        const loginAt = new Date(session.loginAt);
        const hoursElapsed = (Date.now() - loginAt.getTime()) / (1000 * 60 * 60);
        
        if (hoursElapsed > 8) {
          localStorage.removeItem("nivra_employee_session");
          navigate("/employee/login");
          return;
        }

        if (!session.token || !session.employeeId) {
          localStorage.removeItem("nivra_employee_session");
          navigate("/employee/login");
          return;
        }

        setIsAuthorized(true);
      } catch (error) {
        console.error("Session check error:", error);
        localStorage.removeItem("nivra_employee_session");
        navigate("/employee/login");
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "nivra_employee_session" && !e.newValue) {
        navigate("/employee/login");
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
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

export default EmployeeProtectedRoute;
