/**
 * TechBottomNav — Mobile field command dock.
 * Primary tabs stay one-tap; the center button opens a real bottom tools menu.
 */
import { Link, NavLink, useLocation } from "react-router-dom";
import type { ComponentType } from "react";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  ChevronDown,
  ClipboardCheck,
  Compass,
  Gauge,
  GraduationCap,
  Headphones,
  LayoutDashboard,
  Map,
  MessageSquare,
  Package,
  ScanLine,
  ShieldCheck,
  Stethoscope,
  Ticket,
  Truck,
  UserRound,
  UserSquare2,
  Wrench,
  Zap,
} from "lucide-react";
import { useAvailableAssignments } from "../lib/useAvailableAssignments";

interface Tab {
  to: string;
  icon: ComponentType<any>;
  label: string;
  end?: boolean;
  badge?: number;
}

interface ToolItem {
  to: string;
  icon: ComponentType<any>;
  label: string;
  eyebrow: string;
  urgent?: boolean;
}

const TOOL_GROUPS: { title: string; items: ToolItem[] }[] = [
  {
    title: "Mission terrain",
    items: [
      { to: "/tech/active", icon: Zap, label: "Mission active", eyebrow: "Route · arrivée · activation", urgent: true },
      { to: "/tech/workorder", icon: ClipboardCheck, label: "Bon de travail", eyebrow: "Signature · photos · PDF" },
      { to: "/tech/scanner", icon: ScanLine, label: "Scanner", eyebrow: "Série · MAC · IMEI" },
      { to: "/tech/diagnostics", icon: Stethoscope, label: "Diagnostics", eyebrow: "Internet · WiFi · TV" },
    ],
  },
  {
    title: "Support client",
    items: [
      { to: "/tech/client360", icon: UserSquare2, label: "Client 360", eyebrow: "Services · factures · notes" },
      { to: "/tech/chat", icon: MessageSquare, label: "Chat live", eyebrow: "Client · Core · dispatch" },
      { to: "/tech/tickets", icon: Ticket, label: "Tickets", eyebrow: "SAV · escalade" },
      { to: "/tech/stock", icon: Package, label: "Stock véhicule", eyebrow: "Bornes · TV · POD" },
    ],
  },
  {
    title: "Ops & conformité",
    items: [
      { to: "/tech/schedule", icon: CalendarClock, label: "Horaire", eyebrow: "Punch · semaine" },
      { to: "/tech/vehicle", icon: Truck, label: "Véhicule", eyebrow: "Inspection · incidents" },
      { to: "/tech/training", icon: GraduationCap, label: "Formation", eyebrow: "Guides · certifications" },
      { to: "/tech/performance", icon: BarChart3, label: "Performance", eyebrow: "Installations · qualité" },
    ],
  },
];

export default function TechBottomNav() {
  const { data: available = [] } = useAvailableAssignments();
  const location = useLocation();
  const [toolsOpen, setToolsOpen] = useState(false);

  const tabs: Tab[] = useMemo(() => [
    { to: "/tech", icon: LayoutDashboard, label: "Accueil", end: true },
    { to: "/tech/appointments", icon: CalendarClock, label: "RDV", badge: available.length },
    { to: "/tech/active", icon: Wrench, label: "Mission" },
    { to: "/tech/map", icon: Map, label: "Carte" },
    { to: "/tech/profile", icon: UserRound, label: "Profil" },
  ], [available.length]);

  const currentSection = TOOL_GROUPS.flatMap((g) => g.items).find((item) => location.pathname.startsWith(item.to));

  return (
    <>
      {toolsOpen && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menu outils technicien">
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Fermer le menu"
            onClick={() => setToolsOpen(false)}
          />
          <section className="tc-tools-drawer fixed inset-x-0 bottom-0 max-h-[82vh] overflow-y-auto px-4 pt-3 pb-[calc(96px+env(safe-area-inset-bottom))]">
            <div className="mx-auto h-1.5 w-12 rounded-full mb-4" style={{ background: "hsl(var(--border))" }} />
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--primary-glow))" }}>Centre d'actions</p>
                <h2 className="text-[22px] font-bold tracking-tight">Outils terrain</h2>
                <p className="text-[12.5px] mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>
                  Accès direct aux fonctions qui manquaient dans le menu bas.
                </p>
              </div>
              <button type="button" onClick={() => setToolsOpen(false)} className="tc-icon-btn" aria-label="Réduire le menu">
                <ChevronDown className="h-5 w-5" />
              </button>
            </div>

            <Link to="/tech/assignments" onClick={() => setToolsOpen(false)} className="tc-dispatch-strip mb-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "hsl(var(--primary) / 0.16)", color: "hsl(var(--primary-glow))" }}>
                <Compass className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold">Dispatch disponible</span>
                <span className="block text-[12px] truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{available.length} mission{available.length > 1 ? "s" : ""} à prendre dans la file</span>
              </span>
              {available.length > 0 && <span className="tc-live-badge">{available.length > 9 ? "9+" : available.length}</span>}
            </Link>

            <div className="space-y-5">
              {TOOL_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>{group.title}</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link key={item.to} to={item.to} onClick={() => setToolsOpen(false)} className={`tc-tool-tile ${item.urgent ? "is-urgent" : ""}`}>
                          <Icon className="h-5 w-5" />
                          <span className="min-w-0">
                            <span className="block text-[13px] font-semibold truncate">{item.label}</span>
                            <span className="block text-[10.5px] truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{item.eyebrow}</span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <Link to="/tech/menu" onClick={() => setToolsOpen(false)} className="tc-secondary-action"><Gauge className="h-4 w-4" /> Tous les modules</Link>
              <Link to="/tech/tickets" onClick={() => setToolsOpen(false)} className="tc-secondary-action is-danger"><Headphones className="h-4 w-4" /> Assistance</Link>
            </div>
          </section>
        </div>
      )}

      <nav aria-label="Navigation technicien" className="lg:hidden fixed bottom-0 left-0 right-0 z-50 tc-bottomnav">
        {currentSection && !toolsOpen && (
          <div className="mx-3 -mt-12 mb-2 tc-context-chip">
            <ShieldCheck className="h-4 w-4" />
            <span className="truncate">{currentSection.label}</span>
          </div>
        )}
        <div className="mx-auto max-w-[560px] px-2 pt-2 pb-[calc(0.55rem+env(safe-area-inset-bottom))]">
          <ul className="grid grid-cols-[1fr_1fr_72px_1fr_1fr] items-end gap-1">
            {tabs.slice(0, 2).map(({ to, icon: Icon, label, end, badge }) => (
              <li key={to}>
                <NavLink to={to} end={end} aria-label={label} className={({ isActive }) => `tc-dock-tab ${isActive ? "is-active" : ""}`}>
                  <span className="tc-dock-icon"><Icon className="h-[19px] w-[19px]" />{badge != null && badge > 0 && <span className="tc-live-badge">{badge > 9 ? "9+" : badge}</span>}</span>
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}

            <li className="flex justify-center">
              <button type="button" onClick={() => setToolsOpen(true)} aria-label="Ouvrir les outils" className="tc-dock-tools">
                <span className="tc-dock-tools-icon"><Zap className="h-6 w-6" /></span>
                <span>Outils</span>
              </button>
            </li>

            {tabs.slice(2).map(({ to, icon: Icon, label, end, badge }) => (
              <li key={to}>
                <NavLink to={to} end={end} aria-label={label} className={({ isActive }) => `tc-dock-tab ${isActive ? "is-active" : ""}`}>
                  <span className="tc-dock-icon"><Icon className="h-[19px] w-[19px]" />{badge != null && badge > 0 && <span className="tc-live-badge">{badge > 9 ? "9+" : badge}</span>}</span>
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </>
  );
}
