/**
 * TechAppLayout — Root shell for the Nivra Tech portal.
 * True black background, sticky header + glass bottom nav, safe-area aware.
 */
import { Outlet } from "react-router-dom";
import TechBottomNav from "./components/TechBottomNav";

export default function TechAppLayout() {
  return (
    <div className="min-h-screen text-slate-100 flex flex-col" style={{ background: "#0A0A12" }}>
      <main className="flex-1 pb-[calc(58px+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <TechBottomNav />
    </div>
  );
}
