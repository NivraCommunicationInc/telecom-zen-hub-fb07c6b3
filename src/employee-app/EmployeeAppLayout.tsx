/**
 * EmployeeAppLayout — Shell layout for the Employee operational portal.
 * Sidebar + header with omni-search + notification bell + main content area.
 */
import { Outlet } from "react-router-dom";
import EmployeeSidebar from "./components/EmployeeSidebar";
import EmployeeNotificationBell from "./components/EmployeeNotificationBell";
import EmployeeOmniSearch from "./components/EmployeeOmniSearch";
import { cn } from "@/lib/utils";
import { useInternalTheme } from "@/hooks/useInternalTheme";
import InternalThemeToggle from "@/components/internal/InternalThemeToggle";
import { useDocumentJobWorker } from "@/hooks/useDocumentJobWorker";

export default function EmployeeAppLayout() {
  const { theme, themeClass, toggleTheme } = useInternalTheme();
  // Background worker: claims pending document jobs, generates PDFs in browser,
  // uploads to Storage, then triggers send-client-document. (Strategy C)
  useDocumentJobWorker();

  return (
    <div className={cn("internal-ui min-h-screen flex w-full bg-background text-foreground", themeClass)}>
      <EmployeeSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-12 flex items-center justify-between gap-3 px-6 border-b border-border bg-card shrink-0">
          <EmployeeOmniSearch />
          <div className="flex items-center gap-2 shrink-0">
            <InternalThemeToggle theme={theme} onToggle={toggleTheme} />
            <EmployeeNotificationBell />
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="max-w-[1400px] mx-auto p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
