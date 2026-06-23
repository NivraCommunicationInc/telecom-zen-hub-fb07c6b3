import { useEffect, useState, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

const STORAGE_KEY = "nivra_app_mode";

type AppMode = "staff" | "client";

const isStandalonePwa = () => {
  // Chrome/Edge/Android
  const standaloneMatchMedia = window.matchMedia?.("(display-mode: standalone)")?.matches;
  // iOS Safari
  const standaloneIOS = (window.navigator as any).standalone === true;
  return Boolean(standaloneMatchMedia || standaloneIOS);
};

// Staff PWA is allowed to access both /staff/* and /admin/*
const isStaffAreaPath = (path: string) =>
  path.startsWith("/staff") ||
  path.startsWith("/admin") ||
  path.startsWith("/hr") ||
  path.startsWith("/rh") ||
  path.startsWith("/core") ||
  path.startsWith("/field") ||
  path.startsWith("/employee") ||
  path.startsWith("/hub");

interface AppModeGateProps {
  children?: ReactNode;
}

/**
 * AppModeGate
 *
 * Problem: the PWA manifest start_url is "/", so installing from /staff still launches at /.
 * Fix: remember which area the user installed/used (staff vs client) and, when running as an
 * installed app (standalone), force the user back to the correct area.
 *
 * IMPORTANT: This component now BLOCKS rendering until the redirect is complete for staff PWA mode.
 */
export function AppModeGate({ children }: AppModeGateProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isReady, setIsReady] = useState(false);

  // On mount, check if we need to redirect BEFORE anything else renders
  useEffect(() => {
    const isPwa = isStandalonePwa();
    const mode = localStorage.getItem(STORAGE_KEY) as AppMode | null;
    const currentPath = location.pathname;

    console.log("[AppModeGate] Checking mode:", { isPwa, mode, currentPath });

    // If we're in PWA mode as staff but NOT on a staff area path, redirect immediately
    if (isPwa && mode === "staff" && !isStaffAreaPath(currentPath)) {
      console.log("[AppModeGate] Redirecting to /staff");
      navigate("/staff", { replace: true });
      // Set ready after navigation is initiated
      setTimeout(() => setIsReady(true), 50);
    } else {
      // No redirect needed, ready immediately
      setIsReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only on mount

  // Persist last "mode" based on navigation.
  useEffect(() => {
    const path = location.pathname;

    // Any path starting with /staff OR /admin is staff mode
    if (isStaffAreaPath(path)) {
      localStorage.setItem(STORAGE_KEY, "staff");
      return;
    }

    // Client portal paths
    if (path.startsWith("/portal")) {
      localStorage.setItem(STORAGE_KEY, "client");
    }
  }, [location.pathname]);

  // When running as a PWA, keep the user inside the chosen area.
  useEffect(() => {
    if (!isStandalonePwa()) return;

    const mode = localStorage.getItem(STORAGE_KEY) as AppMode | null;

    if (mode === "staff" && !isStaffAreaPath(location.pathname)) {
      navigate("/staff", { replace: true });
    }
  }, [location.pathname, navigate]);

  // Show loading screen while determining correct mode
  if (!isReady) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
          <p className="text-slate-400 text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  // Render children if provided, otherwise return null
  return children ? <>{children}</> : null;
}
