/**
 * TechBottomNav — Mobile bottom navigation (5 tabs) for Nivra Tech v2.
 * Uses semantic tokens from tech-core.css. Hidden on desktop.
 */
import { NavLink } from "react-router-dom";
import { LayoutDashboard, CalendarClock, ScanLine, Map, LayoutGrid } from "lucide-react";
import { useAvailableAssignments } from "../lib/useAvailableAssignments";

interface Tab {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  end?: boolean;
  badge?: number;
  center?: boolean;
}

export default function TechBottomNav() {
  const { data: available = [] } = useAvailableAssignments();

  const tabs: Tab[] = [
    { to: "/tech", icon: LayoutDashboard, label: "Dash", end: true },
    { to: "/tech/appointments", icon: CalendarClock, label: "RDV", badge: available.length },
    { to: "/tech/scanner", icon: ScanLine, label: "Scan", center: true },
    { to: "/tech/map", icon: Map, label: "Carte" },
    { to: "/tech/menu", icon: LayoutGrid, label: "Menu" },
  ];

  return (
    <nav
      aria-label="Navigation technicien"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)] tc-bottomnav"
    >
      <ul className="flex items-end px-2 pt-1.5 pb-1 max-w-[560px] mx-auto">
        {tabs.map(({ to, icon: Icon, label, end, badge, center }) => (
          <li key={to} className="flex-1 flex justify-center">
            <NavLink
              to={to}
              end={end}
              aria-label={label}
              className={center ? "flex flex-col items-center gap-1 -mt-5" : "flex flex-col items-center min-h-[56px] py-1.5 gap-1 w-full"}
            >
              {({ isActive }) =>
                center ? (
                  <>
                    <span
                      className="flex items-center justify-center h-12 w-12 rounded-full transition-transform active:scale-95"
                      style={{
                        background: "var(--tc-gradient-primary)",
                        boxShadow: "0 8px 20px hsl(var(--primary) / 0.4), 0 0 0 4px hsl(var(--background))",
                        color: "hsl(var(--primary-foreground))",
                      }}
                    >
                      <Icon className="h-5 w-5" strokeWidth={2.4} />
                    </span>
                    <span className="text-[10px] font-semibold" style={{ color: isActive ? "hsl(var(--primary-glow))" : "hsl(var(--muted-foreground))" }}>
                      {label}
                    </span>
                  </>
                ) : (
                  <>
                    <span
                      className="relative flex items-center justify-center h-8 w-12 rounded-md transition-all"
                      style={{ background: isActive ? "hsl(var(--primary) / 0.14)" : "transparent" }}
                    >
                      <Icon className="h-[19px] w-[19px]" strokeWidth={isActive ? 2.4 : 1.9} style={{ color: isActive ? "hsl(var(--primary-glow))" : "hsl(var(--muted-foreground))" }} />
                      {badge != null && badge > 0 && (
                        <span
                          className="absolute -top-0.5 right-1 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] font-bold flex items-center justify-center leading-none"
                          style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}
                        >
                          {badge > 9 ? "9+" : badge}
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] font-medium leading-none" style={{ color: isActive ? "hsl(var(--foreground))" : "hsl(var(--muted-foreground))" }}>
                      {label}
                    </span>
                  </>
                )
              }
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
