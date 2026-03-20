/**
 * EmployeeAppLayout — Shell layout for the Employee operational portal.
 * Sidebar + header with notification bell + main content area.
 * LIGHT THEME — white bg, black text, green accent.
 */
import { Outlet } from "react-router-dom";
import EmployeeSidebar from "./components/EmployeeSidebar";
import EmployeeNotificationBell from "./components/EmployeeNotificationBell";
import { cn } from "@/lib/utils";
import { useInternalTheme } from "@/hooks/useInternalTheme";
import InternalThemeToggle from "@/components/internal/InternalThemeToggle";

export default function EmployeeAppLayout() {
  const { themeClass } = useInternalTheme();

  return (
    <div className={cn("internal-ui min-h-screen flex w-full bg-background text-foreground", themeClass)}>
      <EmployeeSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-12 flex items-center justify-end gap-2 px-6 border-b border-border bg-card shrink-0">
          <InternalThemeToggle />
          <EmployeeNotificationBell />
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
