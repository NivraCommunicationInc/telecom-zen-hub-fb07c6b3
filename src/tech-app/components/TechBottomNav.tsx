/**
 * TechBottomNav — Fixed bottom navigation for the technician PWA.
 * 4 large tabs, thumb-friendly, always visible. Mobile-first dark violet theme.
 */
import { NavLink } from "react-router-dom";
import { Home, ClipboardList, Wrench, User } from "lucide-react";

const tabs = [
  { to: "/tech", icon: Home, label: "Accueil", end: true },
  { to: "/tech/assignments", icon: ClipboardList, label: "Missions", end: false },
  { to: "/tech/active", icon: Wrench, label: "En cours", end: false },
  { to: "/tech/profile", icon: User, label: "Profil", end: false },
];

export default function TechBottomNav() {
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur border-t border-violet-900/40 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex">
        {tabs.map(({ to, icon: Icon, label, end }) => (
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
                  <Icon className={`h-6 w-6 ${isActive ? "stroke-[2.5]" : ""}`} />
                  <span>{label}</span>
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-10 rounded-full bg-violet-500" />
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
