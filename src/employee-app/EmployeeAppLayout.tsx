/**
 * EmployeeAppLayout — Shell layout for the Employee operational portal.
 * Sidebar + main content area. Dark, minimal, professional.
 */
import { Outlet } from "react-router-dom";
import EmployeeSidebar from "./components/EmployeeSidebar";

export default function EmployeeAppLayout() {
  return (
    <div className="min-h-screen flex w-full bg-[hsl(220,20%,6%)] text-white">
      <EmployeeSidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-[1400px] mx-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
