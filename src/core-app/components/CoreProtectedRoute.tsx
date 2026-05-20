/**
 * CoreProtectedRoute — Auth gate for Nivra Core /core/* routes.
 * Enforces: hub session → authenticated → active role → can_access_core.
 * Redirects to /hub if not entered through the hub.
 * 
 * SECURITY: On TOKEN_REFRESHED, re-validates hub session inactivity.
 * If hub session expired (inactivity/TTL), signs user out fully
 * to prevent silent auto-relogin via refresh tokens.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { Navigate, useLocation, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { hasValidHubSession, touchHubSession, clearHubSession } from "@/lib/security/hubSession";
import { Terminal } from "lucide-react";

type InternalRole = "admin" | "employee" | "technician";
const ALLOWED_ROLES: InternalRole[] = ["admin", "employee", "technician"];

// Track user activity events for inactivity detection
const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart"] as const;
// Throttle activity tracking to once per minute
const ACTIVITY_THROTTLE_MS = 60_000;

export default function CoreProtectedRoute() {
  const [state, setState] = useState<"loading" | "authorized" | "unauthorized" | "no_hub">("loading");
  const location = useLocation();
  const lastActivityRef = useRef(Date.now());
  const requestedPath = `${location.pathname}${location.search}${location.hash}`;
  const coreLoginPath = `/nivra-secure-hub-2617-internal/login?portal=core&redirect=${encodeURIComponent(requestedPath)}`;

  // Track user activity and update hub session
  const handleActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS) return;
    lastActivityRef.current = now;
    touchHubSession();
  }, []);

  useEffect(() => {
    let mounted = true;

    const verify = async () => {
      // CRITICAL: Must have entered through /hub AND session not expired
      if (!hasValidHubSession()) {
        // Hub session expired (inactivity or absolute TTL)
        // Sign out fully to prevent silent re-auth via refresh tokens
        console.warn("[CoreGuard] Hub session invalid/expired — forcing sign-out");
        clearHubSession();
        await supabase.auth.signOut();
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

        // Record activity on successful verification
        touchHubSession();
        if (mounted) setState("authorized");
      } catch (err) {
        console.error("[CoreGuard] Auth check failed:", err);
        if (mounted) setState("unauthorized");
      }
    };

    verify();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && mounted) {
        clearHubSession();
        setState("no_hub");
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        // SECURITY: Before accepting a token refresh, verify hub session
        // is still valid (not expired by inactivity/TTL).
        // This prevents silent auto-relogin after long idle periods.
        if (!hasValidHubSession()) {
          console.warn(`[CoreGuard] ${event} blocked — hub session expired. Forcing sign-out.`);
          clearHubSession();
          supabase.auth.signOut();
          if (mounted) setState("no_hub");
          return;
        }
        if (mounted) verify();
      }
    });

    // Set up activity tracking
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, handleActivity, { passive: true });
    }

    // Periodic inactivity check every 5 minutes
    const inactivityInterval = setInterval(() => {
      if (!hasValidHubSession()) {
        console.warn("[CoreGuard] Periodic check: hub session expired — signing out");
        clearHubSession();
        supabase.auth.signOut();
        if (mounted) setState("no_hub");
      }
    }, 5 * 60 * 1000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, handleActivity);
      }
      clearInterval(inactivityInterval);
    };
  }, [handleActivity]);

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
    return <Navigate to={coreLoginPath} state={{ from: location }} replace />;
  }

  if (state === "unauthorized") {
    return <Navigate to={coreLoginPath} state={{ from: location }} replace />;
  }

  return <Outlet />;
}
