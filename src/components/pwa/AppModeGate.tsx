import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const STORAGE_KEY = "nivra_app_mode";

type AppMode = "staff" | "client";

const isStandalonePwa = () => {
  // Chrome/Edge/Android
  const standaloneMatchMedia = window.matchMedia?.("(display-mode: standalone)")?.matches;
  // iOS Safari
  const standaloneIOS = (window.navigator as any).standalone === true;
  return Boolean(standaloneMatchMedia || standaloneIOS);
};

/**
 * AppModeGate
 * 
 * Problem: the PWA manifest start_url is "/", so installing from /staff still launches at /.
 * Fix: remember which area the user installed/used (staff vs client) and, when running as an
 * installed app (standalone), force the user back to the correct area.
 */
export function AppModeGate() {
  const location = useLocation();
  const navigate = useNavigate();

  // Persist last "mode" based on navigation.
  useEffect(() => {
    const path = location.pathname;

    // Any path starting with /staff is staff mode
    if (path.startsWith("/staff")) {
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

    if (mode === "staff" && !location.pathname.startsWith("/staff")) {
      navigate("/staff", { replace: true });
    }
  }, [location.pathname, navigate]);

  return null;
}
