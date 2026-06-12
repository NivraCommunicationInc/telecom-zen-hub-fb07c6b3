/**
 * TechBottomNav — Fixed bottom bar for the technician PWA.
 * Active tab: filled violet pill behind icon + thicker stroke.
 * Missions tab shows a badge when dispatch jobs are available.
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
      className="fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]"
      style={{
        background: "rgba(10,10,18,0.96)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <ul className="flex px-2">
        {tabs.map(({ to, icon: Icon, label, end, ...rest }) => {
          const badge = (rest as any).badge as number | undefined;
          const urgent = (rest as any).urgent as boolean | undefined;
          return (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className="flex flex-col items-center justify-center min-h-[58px] py-2 gap-[3px]"
              >
                {({ isActive }) => (
                  <>
                    <span className={`relative flex items-center justify-center h-9 w-14 rounded-[14px] transition-all duration-150 ${
                      isActive ? "bg-violet-500/14" : "active:bg-white/5"
                    }`}>
                      <Icon
                        className={`h-[22px] w-[22px] transition-colors duration-150 ${isActive ? "text-violet-400" : "text-slate-500"}`}
                        strokeWidth={isActive ? 2.5 : 2}
                      />
                      {badge != null && badge > 0 && (
                        <span
                          className={`absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-[4px] rounded-full text-[9px] font-black flex items-center justify-center leading-none ${
                            urgent ? "bg-red-500 text-white animate-pulse" : "bg-orange-500 text-black"
                          }`}
                        >
                          {badge > 9 ? "9+" : badge}
                        </span>
                      )}
                    </span>
                    <span className={`text-[10px] font-semibold leading-none transition-colors duration-150 ${
                      isActive ? "text-violet-400" : "text-slate-600"
                    }`}>
                      {label}
                    </span>
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
