/**
 * TechAppLayout — Nivra Tech v2 shell.
 * Desktop: sidebar (left) + topbar + workspace.
 * Mobile: topbar + workspace + bottom nav.
 * data-portal="tech" activates tech-core.css semantic tokens.
 */
import { Outlet } from "react-router-dom";
import TechSidebar from "./components/TechSidebar";
import TechShellTopBar from "./components/TechShellTopBar";
import TechBottomNav from "./components/TechBottomNav";
import OfflineIndicator from "./components/OfflineIndicator";

export default function TechAppLayout() {
  return (
    <div data-portal="tech" className="min-h-screen flex" style={{ background: "hsl(var(--background))", color: "hsl(var(--foreground))" }}>
      <TechSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TechShellTopBar />
        <main className="flex-1 pb-[calc(118px+env(safe-area-inset-bottom))] lg:pb-6">
          <Outlet />
        </main>
        <TechBottomNav />
      </div>
      <OfflineIndicator />
    </div>
  );
}
