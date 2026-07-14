import { NavLink } from "react-router-dom";
import {
  Activity, CalendarDays, Map, Users, Wrench, MessagesSquare,
  GraduationCap, TrendingUp, Settings, LogOut, Boxes, RadioTower,
} from "lucide-react";

const NAV = [
  { to: "/tech",               label: "Mission Control",icon: Activity,      state: "live" as const },
  { to: "/tech/journee",       label: "Ma journée",     icon: CalendarDays,  state: "live" as const },
  { to: "/tech/terrain",       label: "Terrain",        icon: Map,           state: "live" as const },
  { to: "/tech/clients",       label: "Client 360",     icon: Users,         state: "live" as const },
  { to: "/tech/intervention",  label: "Intervention",   icon: Wrench,        state: "live" as const },
  { to: "/tech/inventaire",    label: "Inventaire",     icon: Boxes,         state: "live" as const },
  { to: "/tech/communication", label: "Communication",  icon: MessagesSquare,state: "live" as const },
  { to: "/tech/ressources",    label: "Ressources",     icon: GraduationCap, state: "live" as const },
  { to: "/tech/performance",   label: "Performance",    icon: TrendingUp,    state: "live" as const },
  { to: "/tech/parametres",    label: "Paramètres",     icon: Settings,      state: "live" as const },
];


export function TechRail() {
  return (
    <aside className="tk-rail" aria-label="Navigation">
      <div className="tk-rail__label"><RadioTower size={12} /> Opérations terrain</div>
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.to === "/tech"} className="tk-rail__item">
          <n.icon />
          <span>{n.label}</span>
          {n.state === "live" && <span className="tk-rail__tag">Live</span>}
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
