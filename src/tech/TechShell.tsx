import { Outlet } from "react-router-dom";
import "./design/tech.css";
import { TechTopbar } from "./components/TechTopbar";
import { TechRail } from "./components/TechRail";
import { TechDock } from "./components/TechDock";

export default function TechShell() {
  return (
    <div className="tech-root">
      <div className="tk-shell">
        <TechTopbar />
        <TechRail />
        <main className="tk-main">
          <Outlet />
        </main>
        <TechDock />
      </div>
    </div>
  );
}
