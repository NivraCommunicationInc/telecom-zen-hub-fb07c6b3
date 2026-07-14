import { NavLink } from "react-router-dom";
import { Activity, CalendarDays, Map, ScanLine, Users, Wrench } from "lucide-react";

export function TechDock() {
  return (
    <nav className="tk-dock" aria-label="Menu mobile">
      <NavLink to="/tech" end className="tk-dock__item"><Activity /><span>Control</span></NavLink>
      <NavLink to="/tech/journee" className="tk-dock__item"><CalendarDays /><span>Jour</span></NavLink>
      <NavLink to="/tech/terrain" className="tk-dock__item"><Map /><span>Carte</span></NavLink>
      <NavLink to="/tech/intervention" className="tk-dock__item tk-dock__item--core"><Wrench /><ScanLine className="tk-dock__scan" /><span>Run</span></NavLink>
      <NavLink to="/tech/clients" className="tk-dock__item"><Users /><span>360</span></NavLink>
    </nav>
  );
}
