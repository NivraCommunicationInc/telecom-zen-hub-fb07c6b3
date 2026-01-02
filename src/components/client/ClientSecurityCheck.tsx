import { useEffect, useState, ReactNode, useCallback } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface ClientSecurityCheckProps {
  children: ReactNode;
}

const ClientSecurityCheck = ({ children }: ClientSecurityCheckProps) => {
  const { user, isLoading: authLoading } = useAuth();
  const location = useLocation();
  const [securityStatus, setSecurityStatus] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  const checkSecurityStatus = useCallback(async () => {
    if (!user) {
      setIsChecking(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("security_status")
        .eq("user_id", user.id)
        .maybeSingle();

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
  }, [user]);

  // Check on mount and route changes
  useEffect(() => {
    if (!authLoading) {
      setIsChecking(true);
      checkSecurityStatus();
    }
  }, [user, authLoading, location.pathname, checkSecurityStatus]);

  // Subscribe to realtime changes for this user's profile
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`security-check-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newStatus = payload.new?.security_status;
          if (newStatus) {
            setSecurityStatus(newStatus);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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
