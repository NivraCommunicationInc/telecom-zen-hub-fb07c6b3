/**
 * TechAppLayout — Root shell for the Nivra Tech portal.
 * data-portal="tech" activates tech-portal.css tokens + Figtree/Outfit fonts.
 */
import { Outlet } from "react-router-dom";
import TechBottomNav from "./components/TechBottomNav";

export default function TechAppLayout() {
  return (
    <div
      data-portal="tech"
      className="min-h-screen flex flex-col"
      style={{ background: "var(--tp-bg)" }}
    >
      <main className="flex-1 pb-[calc(72px+env(safe-area-inset-bottom))]">
        <Outlet />
      </main>
      <TechBottomNav />
    </div>
  );
}
