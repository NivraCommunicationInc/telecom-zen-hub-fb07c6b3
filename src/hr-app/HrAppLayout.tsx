/**
 * HrAppLayout — Shell layout for the Nivra HR employee portal.
 * Sidebar + header with notification bell + main content area.
 */
import { Outlet } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import HrSidebar from "./components/HrSidebar";
import HrNotificationBell from "./components/HrNotificationBell";
import { cn } from "@/lib/utils";
import { useInternalTheme } from "@/hooks/useInternalTheme";
import InternalThemeToggle from "@/components/internal/InternalThemeToggle";
import StaffAssistanceBanner from "@/components/StaffAssistanceBanner";
// Mode assistance — staff_assistance banner mounted below for admin silent-view sessions.

export default function HrAppLayout() {
  const { theme, themeClass, toggleTheme } = useInternalTheme();

  return (
    <div className={cn("internal-ui min-h-screen flex flex-col w-full bg-background text-foreground", themeClass)}>
      <Helmet><title>Nivra HR — Human Resources</title></Helmet>
      <StaffAssistanceBanner />
      <div className="flex flex-1 overflow-hidden">
        <HrSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="h-12 flex items-center justify-between gap-3 px-6 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Mon espace RH</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <InternalThemeToggle theme={theme} onToggle={toggleTheme} />
              <HrNotificationBell />
            </div>
          </header>
          <main className="flex-1 overflow-auto pb-20 lg:pb-0">
            <div className="max-w-[1200px] mx-auto p-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
