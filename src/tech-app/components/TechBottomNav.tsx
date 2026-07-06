/**
 * TechBottomNav — 5 tabs with a raised central Scanner button.
 * Tabs: Jobs · Carte · Scanner (center) · Stock · Profil
 * Uses design tokens from tech-portal.css.
 */
import { NavLink } from "react-router-dom";
import { ClipboardList, Map, ScanLine, Package, User } from "lucide-react";
import { useAvailableAssignments } from "../lib/useAvailableAssignments";

interface Tab {
  to: string;
  icon: typeof ClipboardList;
  label: string;
  end?: boolean;
  badge?: number;
  urgent?: boolean;
  center?: boolean;
}

export default function TechBottomNav() {
  const { data: available = [] } = useAvailableAssignments();
  const urgentCount = available.filter((j) => j.dispatch_priority === "urgent").length;

  const tabs: Tab[] = [
    { to: "/tech", icon: ClipboardList, label: "Jobs", end: true, badge: available.length, urgent: urgentCount > 0 },
    { to: "/tech/map", icon: Map, label: "Carte" },
    { to: "/tech/scanner", icon: ScanLine, label: "Scanner", center: true },
    { to: "/tech/stock", icon: Package, label: "Stock" },
    { to: "/tech/profile", icon: User, label: "Profil" },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]"
      style={{
        background: "rgba(15,15,26,0.94)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        borderTop: "1px solid var(--tp-border)",
      }}
    >
      <ul className="flex items-end px-2 pt-2 pb-1">
        {tabs.map((tab) => {
          const { to, icon: Icon, label, end, badge, urgent, center } = tab;
          return (
            <li key={to} className="flex-1 flex justify-center">
              <NavLink
                to={to}
                end={end}
                className={
                  center
                    ? "flex flex-col items-center gap-1 -mt-6"
                    : "flex flex-col items-center justify-center min-h-[60px] py-2 gap-1 w-full"
                }
                aria-label={label}
              >
                {({ isActive }) =>
                  center ? (
                    <>
                      <span
                        className="tp-nav-scanner relative flex items-center justify-center h-14 w-14 rounded-full transition-transform duration-150 active:scale-95"
                      >
                        <Icon className="h-6 w-6 text-white" strokeWidth={2.4} />
                      </span>
                      <span
                        className={`text-[10px] font-bold leading-none ${
                          isActive ? "text-[color:var(--tp-primary-glow)]" : "text-[color:var(--tp-text-dim)]"
                        }`}
                      >
                        {label}
                      </span>
                    </>
                  ) : (
                    <>
                      <span
                        className="relative flex items-center justify-center h-9 w-14 rounded-[14px] transition-all duration-150"
                        style={{
                          background: isActive ? "var(--tp-primary-soft)" : "transparent",
                        }}
                      >
                        <Icon
                          className="h-[22px] w-[22px] transition-colors duration-150"
                          style={{
                            color: isActive ? "var(--tp-primary-glow)" : "var(--tp-text-dim)",
                          }}
                          strokeWidth={isActive ? 2.5 : 2}
                        />
                        {badge != null && badge > 0 && (
                          <span
                            className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-[4px] rounded-full text-[9px] font-black flex items-center justify-center leading-none ${
                              urgent ? "bg-red-500 text-white animate-pulse" : "bg-[color:var(--tp-warning)] text-black"
                            }`}
                          >
                            {badge > 9 ? "9+" : badge}
                          </span>
                        )}
                      </span>
                      <span
                        className="text-[10px] font-bold leading-none"
                        style={{
                          color: isActive ? "var(--tp-primary-glow)" : "var(--tp-text-dim)",
                        }}
                      >
                        {label}
                      </span>
                    </>
                  )
                }
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
