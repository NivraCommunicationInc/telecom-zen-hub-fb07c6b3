import { useEffect, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInternalTheme } from "@/hooks/useInternalTheme";
import InternalThemeToggle from "@/components/internal/InternalThemeToggle";

interface StaffLayoutProps {
  children: ReactNode;
  requiredRole: "admin" | "employee" | "technician";
}

/**
 * StaffLayout - Wrapper for staff dashboards
 */
export default function StaffLayout({ children, requiredRole }: StaffLayoutProps) {
  const navigate = useNavigate();
  const { themeClass } = useInternalTheme();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          if (mounted) navigate("/staff", { replace: true });
          return;
        }

        const { data: hasRole } = await supabase.rpc("has_staff_role", {
          _user_id: session.user.id,
          _role: requiredRole,
        });

        if (!hasRole) {
          if (mounted) navigate("/staff", { replace: true });
          return;
        }

        if (requiredRole === "employee" || requiredRole === "technician") {
          const { data: roleData, error } = await supabase
            .from("user_roles")
            .select("onboarding_completed_at, terms_accepted_at, staff_pin_hash, is_active, status, can_access_employee, can_access_technician")
            .eq("user_id", session.user.id)
            .eq("role", requiredRole)
            .maybeSingle();

          if (error || !roleData) {
            if (mounted) navigate("/staff", { replace: true });
            return;
          }

          if (!roleData.is_active || roleData.status !== "active") {
            if (mounted) navigate("/staff", { replace: true });
            return;
          }

          const portalFlag = requiredRole === "employee" ? roleData.can_access_employee : roleData.can_access_technician;
          if (!portalFlag) {
            if (mounted) navigate("/hub", { replace: true });
            return;
          }

          if (!roleData.onboarding_completed_at || !roleData.terms_accepted_at || !roleData.staff_pin_hash) {
            if (mounted) navigate("/staff/setup", { replace: true });
            return;
          }
        }

        if (mounted) {
          setIsAuthorized(true);
          setIsLoading(false);
        }
      } catch {
        if (mounted) navigate("/staff", { replace: true });
      }
    };

    checkAccess();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT" || !session) navigate("/staff", { replace: true });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, requiredRole]);

  if (isLoading) {
    return (
      <div className={cn("internal-ui min-h-screen flex items-center justify-center bg-background", themeClass)}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Vérification de l'accès...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className={cn("internal-ui min-h-screen bg-background text-foreground", themeClass)}>
      <div className="fixed right-3 top-3 z-40">
        <InternalThemeToggle />
      </div>
      {children}
    </div>
  );
}
