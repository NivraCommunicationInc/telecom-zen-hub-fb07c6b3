import { NavLink } from "react-router-dom";
import { FIELD_DOMAINS } from "./navigation";
import { LogOut } from "lucide-react";

export function FieldRail() {
  return (
    <aside className="field-rail" aria-label="Domaines">
      <div className="field-rail__section">Plateforme</div>
      {FIELD_DOMAINS.slice(0, 4).map((d) => (
        <NavLink key={d.id} to={d.path} end={d.path === "/technicien"} className="field-rail__item">
          <d.icon />
          <span>{d.label}</span>
        </NavLink>
      ))}
      <div className="field-rail__section">Opérations</div>
      {FIELD_DOMAINS.slice(4, 8).map((d) => (
        <NavLink key={d.id} to={d.path} className="field-rail__item">
          <d.icon />
          <span>{d.label}</span>
        </NavLink>
      ))}
      <div className="field-rail__section">Compte</div>
      {FIELD_DOMAINS.slice(8).map((d) => (
        <NavLink key={d.id} to={d.path} className="field-rail__item">
          <d.icon />
          <span>{d.label}</span>
        </NavLink>
      ))}
      <div className="field-rail__footer">
        <button className="field-rail__item" style={{ width: "100%", background: "transparent", border: 0, cursor: "pointer" }}>
          <LogOut />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}
