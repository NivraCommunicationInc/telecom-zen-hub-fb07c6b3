import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { clearHubSession, hasValidHubSession, touchHubSession } from "@/lib/security/hubSession";

export default function MarketingProtectedRoute() {
  const [state, setState] = useState<"loading" | "authorized" | "unauthorized" | "no_hub">("loading");
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const verify = async () => {
      if (!hasValidHubSession()) {
        clearHubSession();
        await supabase.auth.signOut();
        if (mounted) setState("no_hub");
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          if (mounted) setState("no_hub");
          return;
        }

        const { data: roleData, error } = await supabase
          .from("user_roles")
          .select("role, status, can_access_core")
          .eq("user_id", session.user.id)
          .eq("status", "active")
          .eq("role", "admin")
          .maybeSingle();

        if (error || !roleData || !roleData.can_access_core) {
          if (mounted) setState("unauthorized");
          return;
        }

        touchHubSession();
        if (mounted) setState("authorized");
      } catch {
        if (mounted) setState("unauthorized");
      }
    };

    verify();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && mounted) {
        clearHubSession();
        setState("no_hub");
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (!hasValidHubSession()) {
          clearHubSession();
          supabase.auth.signOut();
          if (mounted) setState("no_hub");
          return;
        }

        if (mounted) verify();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="internal-ui min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <Megaphone className="h-5 w-5 text-primary-foreground animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground">Vérification de la session…</p>
        </div>
      </div>
    );
  }

  if (state === "no_hub" || state === "unauthorized") {
    return <Navigate to="/nivra-secure-hub-2617-internal" state={{ from: location }} replace />;
  }

  return <Outlet />;
}