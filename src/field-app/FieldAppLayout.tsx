/**
 * FieldAppLayout — Shell layout for the Field Sales portal.
 * Premium dark navy theme with purple accents (Salesforce/HubSpot mobile feel).
 *
 * Responsive defaults via usePortalBreakpoint:
 *   - mobile  (<768px) : sidebar hidden, bottom tab bar shown
 *   - tablet  (768-1279px) : sidebar collapsed to 64px icon rail, hamburger expands
 *   - desktop (>=1280px) : sidebar fully expanded (240px)
 */
import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import FieldSidebar from "./components/FieldSidebar";
import InternalPortalGate from "@/components/shared/InternalPortalGate";
import StaffAssistanceBanner from "@/components/StaffAssistanceBanner";
import { usePortalBreakpoint } from "@/hooks/usePortalBreakpoint";
import { Menu } from "lucide-react";
// Mode assistance — staff_assistance banner mounted below for admin silent-view sessions.
import "./styles/field-portal.css";

export default function FieldAppLayout() {
  const location = useLocation();
  const { isMobile, isTablet, isDesktop } = usePortalBreakpoint();
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 1280; // collapsed on tablet, open on desktop
  });

  // When breakpoint flips (e.g. iPad rotation), realign the default state
  // unless the user just toggled it manually for the same session.
  useEffect(() => {
    if (isTablet) setSidebarCollapsed(true);
    else if (isDesktop) setSidebarCollapsed(false);
  }, [isTablet, isDesktop]);

  // Smooth scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  return (
    <InternalPortalGate>
      <StaffAssistanceBanner />
      <div
        data-field-portal
        className="internal-ui min-h-screen flex w-full"
        style={{ background: "hsl(var(--field-bg))" }}
      >
        {!isMobile && (
          <FieldSidebar
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
          />
        )}
        {isMobile && (
          /* Bottom tab bar lives inside FieldSidebar — render it without rail */
          <FieldSidebar collapsed={false} onToggleCollapsed={() => {}} />
        )}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Tablet header with hamburger to expand sidebar */}
          {isTablet && sidebarCollapsed && (
            <header
              className="h-14 flex items-center px-4 shrink-0"
              style={{
                background: "hsl(var(--field-bg-elevated))",
                borderBottom: "1px solid hsl(var(--field-border) / 0.15)",
              }}
            >
              <button
                onClick={() => setSidebarCollapsed(false)}
                aria-label="Ouvrir le menu"
                className="inline-flex items-center justify-center rounded-lg text-white hover:bg-white/10 transition-colors"
                style={{ minHeight: 44, minWidth: 44 }}
              >
                <Menu className="h-5 w-5" />
              </button>
              <span className="ml-3 text-sm font-semibold text-white">Nivra Field</span>
            </header>
          )}
          <main className="flex-1 overflow-auto pb-24 md:pb-0">
            <div
              key={location.pathname}
              className="max-w-[1200px] mx-auto p-4 md:p-6 field-page-enter"
            >
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </InternalPortalGate>
  );
}
