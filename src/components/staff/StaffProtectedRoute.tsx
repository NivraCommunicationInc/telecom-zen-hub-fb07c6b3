/**
 * StaffProtectedRoute - Guards staff routes for employees/technicians
 * Blocks admin-only users and redirects unauthorized users
 */
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface StaffProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ("employee" | "technician" | "admin")[];
}

export function StaffProtectedRoute({ 
  children, 
  allowedRoles = ["employee", "technician"] 
}: StaffProtectedRouteProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          setIsAuthorized(false);
          setIsLoading(false);
          return;
        }

        // Check user role
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role, status, onboarding_completed_at, terms_accepted_at")
          .eq("user_id", session.user.id)
          .eq("status", "active")
          .maybeSingle();

        if (roleError || !roleData) {
          console.error("Role check failed:", roleError);
          setIsAuthorized(false);
          setIsLoading(false);
          return;
        }

        // Check if role is allowed
        if (!allowedRoles.includes(roleData.role as any)) {
          console.log("User role not allowed:", roleData.role);
          setIsAuthorized(false);
          setIsLoading(false);
          return;
        }

        // Check onboarding status (skip if already on setup page)
        if (!location.pathname.startsWith("/staff/setup")) {
          if (!roleData.onboarding_completed_at || !roleData.terms_accepted_at) {
            setNeedsOnboarding(true);
            setIsLoading(false);
            return;
          }
        }

        setIsAuthorized(true);
        setIsLoading(false);
      } catch (error) {
        console.error("Auth check error:", error);
        setIsAuthorized(false);
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [allowedRoles, location.pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
      </div>
    );
  }

  if (needsOnboarding) {
    return <Navigate to="/staff/setup" replace />;
  }

  if (!isAuthorized) {
    return <Navigate to="/staff" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
