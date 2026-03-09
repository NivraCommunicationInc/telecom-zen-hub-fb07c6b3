/**
 * CoreProtectedRoute — Auth gate for Nivra Core /core/* routes.
 * Checks Supabase session + verifies user has an internal role (admin, employee, technician).
 * Redirects unauthenticated users to /core/login.
 */
import { useEffect, useState } from "react";
import { Navigate, useLocation, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { corePath } from "@/core-app/lib/corePaths";
import { Terminal } from "lucide-react";

type InternalRole = "admin" | "employee" | "technician";
const ALLOWED_ROLES: InternalRole[] = ["admin", "employee", "technician"];

export default function CoreProtectedRoute() {
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

        // Verify the user holds an internal role
        const { data: roleData, error } = await supabase
          .from("user_roles")
          .select("role, status")
          .eq("user_id", session.user.id)
          .eq("status", "active")
          .in("role", ALLOWED_ROLES)
          .maybeSingle();

        if (error || !roleData) {
          console.warn("[CoreGuard] No valid internal role found");
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

    // Listen for auth changes (logout elsewhere, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        if (mounted) setState("unauthorized");
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        verify();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(220,20%,8%)]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-emerald-600 flex items-center justify-center">
            <Terminal className="h-5 w-5 text-white animate-pulse" />
          </div>
          <p className="text-sm text-[hsl(220,10%,50%)]">Vérification de la session…</p>
        </div>
      </div>
    );
  }

  if (state === "unauthorized") {
    return <Navigate to={corePath("/login")} state={{ from: location }} replace />;
  }

  return <Outlet />;
}
