import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface TechnicianProtectedRouteProps {
  children: ReactNode;
}

const TechnicianProtectedRoute = ({ children }: TechnicianProtectedRouteProps) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          navigate("/technician/auth");
          return;
        }

        // Check for technician role
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "technician")
          .maybeSingle();

        if (!roleData) {
          navigate("/technician/auth");
          return;
        }

        setIsAuthorized(true);
      } catch (error) {
        console.error("Auth check error:", error);
        navigate("/technician/auth");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        navigate("/technician/auth");
      }
    });

    return () => subscription.unsubscribe();
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
