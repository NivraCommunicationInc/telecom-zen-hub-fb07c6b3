/**
 * TechBottomNav — Fixed bottom navigation for the technician PWA.
 * 4 large tabs, thumb-friendly, always visible. Mobile-first.
 */
import { NavLink } from "react-router-dom";
import { Home, ClipboardList, ScanLine, User } from "lucide-react";

const tabs = [
  { to: "/tech", icon: Home, label: "Accueil" },
  { to: "/tech/assignments", icon: ClipboardList, label: "Missions" },
  { to: "/tech/scanner", icon: ScanLine, label: "Vérifier" },
  { to: "/tech/profile", icon: User, label: "Profil" },
];

export default function TechBottomNav() {
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex">
        {tabs.map(({ to, icon: Icon, label }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 py-3 min-h-[64px] text-xs font-medium transition-colors ${
                  isActive ? "text-violet-400" : "text-slate-400"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`h-6 w-6 ${isActive ? "stroke-[2.5]" : ""}`} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
