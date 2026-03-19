/**
 * FieldAppLayout — Shell layout for the Field Sales portal.
 * Mobile-first: bottom nav on mobile, sidebar on desktop.
 */
import { Outlet } from "react-router-dom";
import FieldSidebar from "./components/FieldSidebar";

export default function FieldAppLayout() {
  return (
    <div className="min-h-screen flex w-full bg-[hsl(225,20%,5%)] text-white">
      <FieldSidebar />
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="max-w-[1000px] mx-auto p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
