/**
 * usePortalBreakpoint — Shared responsive breakpoint detection for internal portals.
 *
 * Breakpoints:
 *   - mobile : <  768px
 *   - tablet : 768px – 1279px (iPad / iPad Pro)
 *   - desktop: >= 1280px
 *
 * Used by Field/RH/Employee/Core portal layouts to set sensible sidebar
 * defaults: hidden on mobile (bottom nav instead), collapsed on tablet,
 * fully expanded on desktop. Updates automatically on resize / rotation.
 */
import { useEffect, useState } from "react";

const TABLET_MIN = 768;
const DESKTOP_MIN = 1280;

export type PortalBreakpoint = "mobile" | "tablet" | "desktop";

function readBreakpoint(): PortalBreakpoint {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < TABLET_MIN) return "mobile";
  if (w < DESKTOP_MIN) return "tablet";
  return "desktop";
}

export function usePortalBreakpoint() {
  const [bp, setBp] = useState<PortalBreakpoint>(() => readBreakpoint());

  useEffect(() => {
    const onResize = () => setBp(readBreakpoint());
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  return {
    breakpoint: bp,
    isMobile: bp === "mobile",
    isTablet: bp === "tablet",
    isDesktop: bp === "desktop",
  };
}
