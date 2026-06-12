/**
 * TechBottomNav — Fixed bottom navigation for the technician PWA.
 * 4 large tabs, thumb-friendly, always visible. Mobile-first dark violet theme.
 * Missions tab shows a badge when dispatch jobs are available (orange for urgent).
 */
import { NavLink } from "react-router-dom";
import { Home, ClipboardList, Wrench, User } from "lucide-react";
import { useAvailableAssignments } from "../lib/useAvailableAssignments";

export default function TechBottomNav() {
  const { data: available = [] } = useAvailableAssignments();
  const urgentCount = available.filter((j) => j.dispatch_priority === "urgent").length;
  const totalAvailable = available.length;

  const tabs = [
    { to: "/tech", icon: Home, label: "Accueil", end: true },
    { to: "/tech/assignments", icon: ClipboardList, label: "Missions", end: false, badge: totalAvailable, urgent: urgentCount > 0 },
    { to: "/tech/active", icon: Wrench, label: "En cours", end: false },
    { to: "/tech/profile", icon: User, label: "Profil", end: false },
  ] as const;

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur border-t border-violet-900/40 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex">
        {tabs.map(({ to, icon: Icon, label, end, ...rest }) => {
          const badge = (rest as any).badge as number | undefined;
          const urgent = (rest as any).urgent as boolean | undefined;
          return (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-1 py-2.5 min-h-[64px] text-[11px] font-semibold transition-colors relative ${
                    isActive ? "text-violet-400" : "text-slate-500"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className="relative">
                      <Icon className={`h-6 w-6 ${isActive ? "stroke-[2.5]" : ""}`} />
                      {badge != null && badge > 0 && (
                        <span className={`absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-black flex items-center justify-center leading-none ${
                          urgent ? "bg-red-500 text-white animate-pulse" : "bg-orange-500 text-black"
                        }`}>
                          {badge > 9 ? "9+" : badge}
                        </span>
                      )}
                    </span>
                    <span>{label}</span>
                    {isActive && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-10 rounded-full bg-violet-500" />
                    )}
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
