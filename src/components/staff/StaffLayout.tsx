import { useEffect, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import StaffBackground from "./StaffBackground";

interface StaffLayoutProps {
  children: ReactNode;
  requiredRole: "admin" | "employee" | "technician";
}

/**
 * StaffLayout - Wrapper for staff dashboards
 * 
 * This layout ensures:
 * 1. User is authenticated
 * 2. User has the required staff role
 * 3. Onboarding is complete (for employee/technician)
 * 4. Terms are accepted
 * 5. Redirects to /staff (not /) when not authenticated or unauthorized
 */
export default function StaffLayout({ children, requiredRole }: StaffLayoutProps) {
  const navigate = useNavigate();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          // Not logged in - redirect to staff login
          if (mounted) {
            navigate("/staff", { replace: true });
          }
          return;
        }

        // Check if user has the required staff role
        const { data: hasRole } = await supabase.rpc("has_staff_role", {
          _user_id: session.user.id,
          _role: requiredRole,
        });

        if (!hasRole) {
          // User doesn't have this role - redirect to staff login
          if (mounted) {
            navigate("/staff", { replace: true });
          }
          return;
        }

        // For employee/technician, check onboarding + portal access flags
        if (requiredRole === "employee" || requiredRole === "technician") {
          const { data: roleData, error } = await supabase
            .from("user_roles")
            .select("onboarding_completed_at, terms_accepted_at, staff_pin_hash, is_active, status, can_access_employee, can_access_technician, can_access_field")
            .eq("user_id", session.user.id)
            .eq("role", requiredRole)
            .maybeSingle();

          if (error || !roleData) {
            console.error("[StaffLayout] Error checking role data:", error);
            if (mounted) navigate("/staff", { replace: true });
            return;
          }

          // Check if account is active
          if (!roleData.is_active || roleData.status !== "active") {
            console.warn("[StaffLayout] Account not active");
            if (mounted) navigate("/staff", { replace: true });
            return;
          }

          // Hard enforcement: check portal access flag
          const portalFlag = requiredRole === "employee" ? roleData.can_access_employee : roleData.can_access_technician;
          if (!portalFlag) {
            console.warn("[StaffLayout] User lacks portal access flag for", requiredRole);
            if (mounted) navigate("/hub", { replace: true });
            return;
          }

          // Check if onboarding is required - redirect to setup page
          if (!roleData.onboarding_completed_at || !roleData.terms_accepted_at || !roleData.staff_pin_hash) {
            console.log("[StaffLayout] Onboarding not complete, redirecting to setup");
            if (mounted) navigate("/staff/setup", { replace: true });
            return;
          }
        }

        if (mounted) {
          setIsAuthorized(true);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("[StaffLayout] Access check failed:", error);
        if (mounted) {
          navigate("/staff", { replace: true });
        }
      }
    };

    checkAccess();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        if (event === "SIGNED_OUT" || !session) {
          // User signed out - redirect to staff login, NOT the main site
          navigate("/staff", { replace: true });
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, requiredRole]);

  if (isLoading) {
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
