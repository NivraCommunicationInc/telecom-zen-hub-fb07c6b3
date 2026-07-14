import { NavLink } from "react-router-dom";
import { FIELD_DOMAINS } from "./navigation";
import { ScanLine } from "lucide-react";

type Props = { onOpenScanner: () => void };

export function FieldDock({ onOpenScanner }: Props) {
  const dockItems = FIELD_DOMAINS.filter((d) => d.mobileDock);
  const [a, b, c, d] = dockItems;
  return (
    <nav className="field-dock" aria-label="Navigation principale">
      <NavLink to={a.path} end className="field-dock__item"><a.icon /><span>{a.label}</span></NavLink>
      <NavLink to={b.path} className="field-dock__item"><b.icon /><span>{b.label}</span></NavLink>
      <button className="field-dock__more" onClick={onOpenScanner} aria-label="Scanner universel">
        <ScanLine size={26} />
      </button>
      <NavLink to={c.path} className="field-dock__item"><c.icon /><span>{c.label}</span></NavLink>
      <NavLink to={d.path} className="field-dock__item"><d.icon /><span>{d.label}</span></NavLink>
    </nav>
  );
}
