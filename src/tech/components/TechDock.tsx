import { NavLink } from "react-router-dom";
import { Home, Wrench, Map, Users, Menu } from "lucide-react";

export function TechDock() {
  return (
    <nav className="tk-dock" aria-label="Menu mobile">
      <NavLink to="/tech" end className="tk-dock__item"><Home /><span>Accueil</span></NavLink>
      <NavLink to="/tech/intervention" className="tk-dock__item"><Wrench /><span>Intervention</span></NavLink>
      <NavLink to="/tech/terrain" className="tk-dock__item"><Map /><span>Terrain</span></NavLink>
      <NavLink to="/tech/clients" className="tk-dock__item"><Users /><span>Clients</span></NavLink>
      <NavLink to="/tech/parametres" className="tk-dock__item"><Menu /><span>Plus</span></NavLink>
    </nav>
  );
}
