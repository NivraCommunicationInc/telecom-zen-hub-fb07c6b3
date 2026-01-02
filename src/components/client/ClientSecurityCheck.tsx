import { useEffect, useState, ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface ClientSecurityCheckProps {
  children: ReactNode;
}

const ClientSecurityCheck = ({ children }: ClientSecurityCheckProps) => {
  const { user, isLoading: authLoading } = useAuth();
  const [securityStatus, setSecurityStatus] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkSecurityStatus = async () => {
      if (!user) {
        setIsChecking(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("security_status")
          .eq("user_id", user.id)
          .single();

        if (error) {
          console.error("Error checking security status:", error);
          setSecurityStatus("active"); // Default to active if error
        } else {
          setSecurityStatus(data?.security_status || "active");
        }
      } catch (err) {
        console.error("Error in security check:", err);
        setSecurityStatus("active");
      } finally {
        setIsChecking(false);
      }
    };

    if (!authLoading) {
      checkSecurityStatus();
    }
  }, [user, authLoading]);

  if (authLoading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/portal/auth" replace />;
  }

  if (securityStatus === "suspended") {
    return <Navigate to="/portal/suspended" replace />;
  }

  return <>{children}</>;
};

export default ClientSecurityCheck;
