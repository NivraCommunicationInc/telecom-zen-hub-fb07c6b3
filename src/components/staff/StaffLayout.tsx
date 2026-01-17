import { useEffect, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

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
 * 3. Redirects to /staff (not /) when not authenticated or unauthorized
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
