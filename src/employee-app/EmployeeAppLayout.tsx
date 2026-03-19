/**
 * EmployeeAppLayout — Shell layout for the Employee operational portal.
 * Sidebar + header with notification bell + main content area.
 */
import { Outlet } from "react-router-dom";
import EmployeeSidebar from "./components/EmployeeSidebar";
import EmployeeNotificationBell from "./components/EmployeeNotificationBell";

export default function EmployeeAppLayout() {
  return (
    <div className="min-h-screen flex w-full bg-[hsl(220,20%,6%)] text-white">
      <EmployeeSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar with notifications */}
        <header className="h-12 flex items-center justify-end px-6 border-b border-[hsl(220,15%,10%)] bg-[hsl(220,20%,7%)] shrink-0">
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
