/**
 * TechAppLayout — Root layout for the Nivra Technician portal.
 * Mobile-first dark violet theme, sticky header + bottom navigation, safe-area aware.
 */
import { Outlet } from "react-router-dom";
import TechBottomNav from "./components/TechBottomNav";

export default function TechAppLayout() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <main className="flex-1 pb-24">
        <Outlet />
      </main>
      <TechBottomNav />
    </div>
  );
}
