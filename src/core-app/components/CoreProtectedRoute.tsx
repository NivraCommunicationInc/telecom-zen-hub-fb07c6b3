/**
 * CoreProtectedRoute — Auth gate for Nivra Core /core/* routes.
 * Enforces: hub session → authenticated → active role → can_access_core.
 * Redirects to /hub if not entered through the hub.
 */
import { useEffect, useState } from "react";
import { Navigate, useLocation, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { hasValidHubSession } from "@/lib/security/hubSession";
import { Terminal } from "lucide-react";

type InternalRole = "admin" | "employee" | "technician";
const ALLOWED_ROLES: InternalRole[] = ["admin", "employee", "technician"];

export default function CoreProtectedRoute() {
  const [state, setState] = useState<"loading" | "authorized" | "unauthorized" | "no_hub">("loading");
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const verify = async () => {
      // CRITICAL: Must have entered through /hub
      if (!hasValidHubSession()) {
        if (mounted) setState("no_hub");
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          if (mounted) setState("no_hub");
          return;
        }

        const { data: roleData, error } = await supabase
          .from("user_roles")
          .select("role, status, can_access_core")
          .eq("user_id", session.user.id)
          .eq("status", "active")
          .in("role", ALLOWED_ROLES)
          .maybeSingle();

        if (error || !roleData || !roleData.can_access_core) {
          if (mounted) setState("unauthorized");
          return;
        }

        if (mounted) setState("authorized");
      } catch (err) {
        console.error("[CoreGuard] Auth check failed:", err);
        if (mounted) setState("unauthorized");
      }
    };

    verify();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && mounted) setState("no_hub");
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && mounted) verify();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="internal-ui min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <Terminal className="h-5 w-5 text-primary-foreground animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground">Vérification de la session…</p>
        </div>
      </div>
    );
  }

  if (state === "no_hub") {
    return <Navigate to="/hub" state={{ from: location }} replace />;
  }

  if (state === "unauthorized") {
    return <Navigate to="/hub" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
