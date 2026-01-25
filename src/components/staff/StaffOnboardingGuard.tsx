import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import StaffBackground from "./StaffBackground";

interface StaffOnboardingGuardProps {
  children: React.ReactNode;
  requiredRole: "employee" | "technician";
}

export default function StaffOnboardingGuard({ 
  children, 
  requiredRole 
}: StaffOnboardingGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          navigate("/staff", { replace: true });
          return;
        }

        // Check user role and onboarding status
        const { data: roleData, error } = await supabase
          .from("user_roles")
          .select("role, status, is_active, onboarding_completed_at, terms_accepted_at, require_onboarding")
          .eq("user_id", session.user.id)
          .eq("role", requiredRole)
          .maybeSingle();

        if (error) {
          console.error("[StaffOnboardingGuard] Error checking role:", error);
          navigate("/staff", { replace: true });
          return;
        }

        if (!roleData) {
          // User doesn't have this role
          console.warn("[StaffOnboardingGuard] User doesn't have role:", requiredRole);
          navigate("/staff", { replace: true });
          return;
        }

        // Check if account is active
        if (!roleData.is_active || roleData.status !== "active") {
          console.warn("[StaffOnboardingGuard] Account not active");
          navigate("/staff", { replace: true });
          return;
        }

        // Check if onboarding is complete
        if (roleData.require_onboarding || !roleData.onboarding_completed_at) {
          console.log("[StaffOnboardingGuard] Onboarding required");
          // Don't redirect if we're already on setup page
          if (!location.pathname.includes("/setup")) {
            navigate("/staff/setup", { replace: true });
          }
          return;
        }

        // Check if terms accepted
        if (!roleData.terms_accepted_at) {
          console.log("[StaffOnboardingGuard] Terms acceptance required");
          if (!location.pathname.includes("/setup")) {
            navigate("/staff/setup", { replace: true });
          }
          return;
        }

        // All checks passed
        setIsAuthorized(true);
      } catch (error) {
        console.error("[StaffOnboardingGuard] Unexpected error:", error);
        navigate("/staff", { replace: true });
      } finally {
        setIsChecking(false);
      }
    };

    checkOnboarding();
  }, [navigate, requiredRole, location.pathname]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <StaffBackground />
        <div className="flex flex-col items-center gap-4 z-10">
          <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
          <p className="text-slate-400">Vérification de l'accès...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
