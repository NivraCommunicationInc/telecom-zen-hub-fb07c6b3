/**
 * FieldAppLayout — Shell layout for the Field Sales portal.
 * Mobile-first: bottom nav on mobile, sidebar on desktop.
 * LIGHT THEME — white bg, black text, green accent.
 */
import { Outlet } from "react-router-dom";
import FieldSidebar from "./components/FieldSidebar";

export default function FieldAppLayout() {
  return (
    <div className="admin-light min-h-screen flex w-full bg-[#FAFAFA] text-black">
      <FieldSidebar />
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="max-w-[1000px] mx-auto p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
