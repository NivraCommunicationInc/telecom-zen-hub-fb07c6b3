import { NavLink } from "react-router-dom";
import {
  Home, CalendarDays, Map, Users, Wrench, Package, MessagesSquare,
  GraduationCap, TrendingUp, Settings, LogOut,
} from "lucide-react";

const NAV = [
  { to: "/tech",               label: "Accueil",        icon: Home,          state: "live" as const },
  { to: "/tech/mission",       label: "Mission Control",icon: TrendingUp,    state: "live" as const },
  { to: "/tech/journee",       label: "Ma journée",     icon: CalendarDays,  state: "live" as const },
  { to: "/tech/intervention",  label: "Intervention",   icon: Wrench,        state: "live" as const },
  { to: "/tech/terrain",       label: "Terrain",        icon: Map,           state: "soon" as const },
  { to: "/tech/clients",       label: "Clients",        icon: Users,         state: "soon" as const },
  { to: "/tech/inventaire",    label: "Inventaire",     icon: Package,       state: "soon" as const },
  { to: "/tech/communication", label: "Communication",  icon: MessagesSquare,state: "soon" as const },
  { to: "/tech/ressources",    label: "Ressources",     icon: GraduationCap, state: "soon" as const },
  { to: "/tech/performance",   label: "Performance",    icon: TrendingUp,    state: "soon" as const },
  { to: "/tech/parametres",    label: "Paramètres",     icon: Settings,      state: "soon" as const },
];


export function TechRail() {
  return (
    <aside className="tk-rail" aria-label="Navigation">
      <div className="tk-rail__label">Plateforme</div>
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.to === "/tech"} className="tk-rail__item">
          <n.icon />
          <span>{n.label}</span>
          {n.state === "soon" && <span className="tk-rail__tag tk-rail__tag--soon">Bientôt</span>}
          {n.state === "live" && <span className="tk-rail__tag" style={{ background: "hsl(var(--tk-ok) / 0.15)", color: "hsl(var(--tk-ok))", borderColor: "hsl(var(--tk-ok) / 0.3)" }}>Actif</span>}
        </NavLink>
      ))}
      <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid hsl(var(--tk-line))" }}>
        <button className="tk-rail__item" style={{ width: "100%", background: "transparent", border: 0, cursor: "pointer" }}>
          <LogOut />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}
