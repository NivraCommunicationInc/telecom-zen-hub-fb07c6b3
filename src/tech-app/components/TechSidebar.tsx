/**
 * TechSidebar — Desktop sidebar (compact rail with labels) for Nivra Tech v2.
 * Uses semantic tokens from tech-core.css. Hidden on mobile (BottomNav takes over).
 */
import { NavLink } from "react-router-dom";
import type { ComponentType } from "react";
import {
  LayoutDashboard, CalendarClock, Map, UserSquare2, Wrench, Stethoscope,
  Package, Ticket, MessageSquare, BarChart3, Truck, GraduationCap, Sparkles,
  User, ScanLine,
} from "lucide-react";

interface NavItem { to: string; label: string; icon: ComponentType<any>; end?: boolean }

const MAIN: NavItem[] = [
  { to: "/tech", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/tech/appointments", label: "Rendez-vous", icon: CalendarClock },
  { to: "/tech/map", label: "Carte", icon: Map },
  { to: "/tech/assignments", label: "Dispatch", icon: Wrench },
];
const FIELD: NavItem[] = [
  { to: "/tech/client360", label: "Clients", icon: UserSquare2 },
  { to: "/tech/scanner", label: "Scanner", icon: ScanLine },
  { to: "/tech/stock", label: "Inventaire", icon: Package },
  { to: "/tech/workorder", label: "Bon de travail", icon: Wrench },
];
const OPS: NavItem[] = [
  { to: "/tech/tickets", label: "Tickets", icon: Ticket },
  { to: "/tech/chat", label: "Messages", icon: MessageSquare },
];
const PERF: NavItem[] = [
  { to: "/tech/performance", label: "Performance", icon: BarChart3 },
  { to: "/tech/vehicle", label: "Véhicule", icon: Truck },
  { to: "/tech/training", label: "Formation", icon: GraduationCap },
];

function Item({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) => `tc-nav-item ${isActive ? "is-active" : ""}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

export default function TechSidebar() {
  return (
    <aside
      aria-label="Navigation technicien"
      className="hidden lg:flex flex-col w-[248px] shrink-0 h-screen sticky top-0"
      style={{ background: "hsl(var(--tc-sidebar))", borderRight: "1px solid hsl(var(--border))" }}
    >
      {/* Brand */}
      <div className="h-[60px] px-4 flex items-center gap-2.5 border-b" style={{ borderColor: "hsl(var(--border))" }}>
        <div
          className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold text-[15px]"
          style={{ background: "var(--tc-gradient-primary)" }}
        >
          N
        </div>
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold leading-none tracking-tight">Nivra Tech</p>
          <p className="text-[10.5px] mt-1 uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>Field Ops</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        <p className="tc-nav-section-label">Opérations</p>
        {MAIN.map((i) => <Item key={i.to} item={i} />)}
        <p className="tc-nav-section-label">Terrain</p>
        {FIELD.map((i) => <Item key={i.to} item={i} />)}
        <p className="tc-nav-section-label">Support</p>
        {OPS.map((i) => <Item key={i.to} item={i} />)}
        <p className="tc-nav-section-label">Performance</p>
        {PERF.map((i) => <Item key={i.to} item={i} />)}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t" style={{ borderColor: "hsl(var(--border))" }}>
        <NavLink to="/tech/profile" className={({ isActive }) => `tc-nav-item ${isActive ? "is-active" : ""}`}>
          <User className="h-4 w-4" />
          <span>Profil</span>
        </NavLink>
        <button
          type="button"
          className="tc-nav-item w-full mt-0.5"
          style={{ color: "hsl(var(--primary-glow))" }}
          onClick={() => window.dispatchEvent(new CustomEvent("tech:open-ai"))}
        >
          <Sparkles className="h-4 w-4" />
          <span>Assistant IA</span>
          <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded" style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}>⌘I</kbd>
        </button>
      </div>
    </aside>
  );
}
