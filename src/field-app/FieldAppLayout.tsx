/**
 * FieldAppLayout — Shell layout for the Field Sales portal.
 * Mobile-first: bottom nav on mobile, sidebar on desktop.
 * LIGHT THEME — white bg, black text, green accent.
 */
import { Outlet } from "react-router-dom";
import FieldSidebar from "./components/FieldSidebar";
import { cn } from "@/lib/utils";
import { useInternalTheme } from "@/hooks/useInternalTheme";
import InternalThemeToggle from "@/components/internal/InternalThemeToggle";

export default function FieldAppLayout() {
  const { theme, themeClass, toggleTheme } = useInternalTheme();

  return (
    <div className={cn("internal-ui min-h-screen flex w-full bg-background text-foreground", themeClass)}>
      <div className="fixed right-3 top-3 z-40">
        <InternalThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>
      <FieldSidebar />
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="max-w-[1000px] mx-auto p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
