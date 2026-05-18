/**
 * HubProtectedRoute — Auth gate for /hub/* routes.
 * Ensures user is authenticated and has at least one internal staff role.
 * Redirects to /hub/login if not.
 */
import { useEffect, useState } from "react";
import { Navigate, useLocation, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Loader2 } from "lucide-react";

const INTERNAL_ROLES = [
  "admin", "employee", "technician", "supervisor",
  "sales", "kyc_agent", "billing_admin", "techops", "support", "field_sales"
];

export default function HubProtectedRoute() {
  const [state, setState] = useState<"loading" | "authorized" | "unauthorized">("loading");
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const verify = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          if (mounted) setState("unauthorized");
          return;
        }

        const { data: roleData, error } = await supabase
          .from("user_roles")
          .select("role, status, is_active")
          .eq("user_id", session.user.id)
          .eq("status", "active")
          .in("role", INTERNAL_ROLES)
          .maybeSingle();

        if (error || !roleData || !roleData.is_active) {
          if (mounted) setState("unauthorized");
          return;
        }

        if (mounted) setState("authorized");
      } catch {
        if (mounted) setState("unauthorized");
      }
    };

    verify();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && mounted) setState("unauthorized");
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && mounted) verify();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(220,20%,6%)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-emerald-600 flex items-center justify-center">
            <Shield className="h-5 w-5 text-white animate-pulse" />
          </div>
          <p className="text-sm text-[hsl(220,10%,45%)]">Vérification de la session…</p>
        </div>
      </div>
    );
  }

  if (state === "unauthorized") {
    return <Navigate to="/nivra-secure-hub-2617-internal/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
