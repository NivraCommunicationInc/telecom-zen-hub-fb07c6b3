import { useEffect, useState, ReactNode, useCallback } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { portalClient as portalSupabase } from "@/integrations/backend";
import { useClientAuth } from "@/hooks/useClientAuth";
import { Loader2 } from "lucide-react";

interface ClientSecurityCheckProps {
  children: ReactNode;
}

const ClientSecurityCheck = ({ children }: ClientSecurityCheckProps) => {
  const { user, isLoading: authLoading } = useClientAuth();
  const location = useLocation();
  const [securityStatus, setSecurityStatus] = useState<string | null>(null);
  const [accountStatus, setAccountStatus] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  const checkSecurityStatus = useCallback(async () => {
    if (!user) {
      setIsChecking(false);
      return;
    }

    try {
      const { data, error } = await portalSupabase
        .from("profiles")
        .select("security_status, account_status")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error checking security status:", error);
        setSecurityStatus("active");
        setAccountStatus("active");
      } else {
        setSecurityStatus(data?.security_status || "active");
        setAccountStatus(data?.account_status || "active");
      }
    } catch (err) {
      console.error("Error in security check:", err);
      setSecurityStatus("active");
      setAccountStatus("active");
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

    const channel = portalSupabase
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
          const newSecurityStatus = payload.new?.security_status;
          const newAccountStatus = payload.new?.account_status;
          if (newSecurityStatus) {
            setSecurityStatus(newSecurityStatus);
          }
          if (newAccountStatus) {
            setAccountStatus(newAccountStatus);
          }
        }
      )
      .subscribe();

    return () => {
      portalSupabase.removeChannel(channel);
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

  // Block if suspended OR on hold
  if (securityStatus === "suspended" || accountStatus === "hold") {
    return <Navigate to="/portal/suspended" replace />;
  }

  return <>{children}</>;
};

export default ClientSecurityCheck;
