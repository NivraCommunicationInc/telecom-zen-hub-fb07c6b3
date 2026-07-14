import { Link } from "react-router-dom";
import type { ComponentType } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  Camera,
  ChevronRight,
  ClipboardCheck,
  Compass,
  FileSignature,
  Gauge,
  GraduationCap,
  Headphones,
  Map,
  MessageSquare,
  Package,
  Radio,
  Route,
  ScanLine,
  ShieldCheck,
  Stethoscope,
  Ticket,
  Truck,
  UserSquare2,
  Wrench,
} from "lucide-react";
import TechPageHeader from "../components/TechPageHeader";

interface Tile {
  to: string;
  icon: ComponentType<any>;
  label: string;
  hint?: string;
  tone?: "primary" | "warning" | "success" | "danger";
}

const OPS: Tile[] = [
  { to: "/tech", icon: Gauge, label: "Command center", hint: "Vue terrain", tone: "primary" },
  { to: "/tech/appointments", icon: CalendarClock, label: "Rendez-vous", hint: "Agenda installations" },
  { to: "/tech/assignments", icon: Radio, label: "Dispatch", hint: "Missions disponibles", tone: "warning" },
  { to: "/tech/schedule", icon: CalendarClock, label: "Horaire & Punch", hint: "Semaine · pointage GPS" },
  { to: "/tech/chat", icon: MessageSquare, label: "Chat & Dispatch", hint: "Client · Core · équipe" },
  { to: "/tech/tickets", icon: Ticket, label: "Tickets & SAV", hint: "Ouvrir · escalader" },
];
const TERRAIN: Tile[] = [
  { to: "/tech/active", icon: Route, label: "Installation active", hint: "Route · arrivée · service", tone: "success" },
  { to: "/tech/workorder", icon: FileSignature, label: "Bon de travail", hint: "Signature · photos · PDF" },
  { to: "/tech/client360", icon: UserSquare2, label: "Client 360", hint: "Services · factures · paiement" },
  { to: "/tech/scanner", icon: ScanLine, label: "Scan équipement", hint: "Série · MAC · IMEI" },
  { to: "/tech/diagnostics", icon: Stethoscope, label: "Diagnostics", hint: "Signal · WiFi · TV" },
  { to: "/tech/map", icon: Map, label: "Carte terrain", hint: "Techs · adresses · route" },
  { to: "/tech/stock", icon: Package, label: "Stock véhicule", hint: "Bornes · TV · POD" },
];
const KNOWLEDGE: Tile[] = [
  { to: "/tech/training", icon: GraduationCap, label: "Formation", hint: "Guides · vidéos · certifications" },
  { to: "/tech/tickets", icon: Headphones, label: "Support terrain", hint: "Aide dispatcher" },
  { to: "/tech/workorder", icon: Camera, label: "Preuves photo", hint: "Avant · après · signal" },
];
const PERF: Tile[] = [
  { to: "/tech/performance", icon: BarChart3, label: "Performance", hint: "Installs · taux · commissions" },
  { to: "/tech/vehicle", icon: Truck, label: "Véhicule & EHS", hint: "Check-list · incidents" },
  { to: "/tech/training", icon: ShieldCheck, label: "Conformité", hint: "Certifications requises" },
];
const QUICK: Tile[] = [
  { to: "/tech/active", icon: Wrench, label: "Mission" },
  { to: "/tech/assignments", icon: Compass, label: "Dispatch" },
  { to: "/tech/chat", icon: Headphones, label: "Assistance" },
  { to: "/tech/scanner", icon: ScanLine, label: "Scanner" },
];

function Section({ title, tiles, wide = false }: { title: string; tiles: Tile[]; wide?: boolean }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--muted-foreground))" }}>{title}</h2>
        <div className="h-px flex-1" style={{ background: "hsl(var(--border))" }} />
      </div>
      <div className={wide ? "grid gap-3 lg:grid-cols-3" : "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"}>
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`tc-command-card ${t.tone ? `is-${t.tone}` : ""}`}
            >
              <span className="tc-command-icon">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold leading-tight truncate">{t.label}</span>
                <span className="block text-[12px] mt-1 truncate" style={{ color: "hsl(var(--muted-foreground))" }}>{t.hint}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0" style={{ color: "hsl(var(--muted-foreground))" }} />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function TechMenu() {
  return (
    <>
      <TechPageHeader title="Menu technicien" subtitle="Command center terrain" />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-7 space-y-6">
        <section className="tc-menu-hero">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "hsl(var(--primary-glow))" }}>Nivra Field Ops</p>
            <h1 className="mt-2 text-[30px] sm:text-[42px] font-bold tracking-tight leading-none">Console technicien</h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="tc-pill is-route"><span className="tc-pill-dot" />Mission</span>
              <span className="tc-pill"><span className="tc-pill-dot" />Client</span>
              <span className="tc-pill"><span className="tc-pill-dot" />Stock</span>
              <span className="tc-pill"><span className="tc-pill-dot" />Support</span>
            </div>
          </div>
          <div className="tc-menu-hero-panel">
            <AlertTriangle className="h-5 w-5" style={{ color: "hsl(var(--warning))" }} />
            <div>
              <p className="text-[13px] font-semibold">Actions terrain critiques</p>
              <p className="text-[12px] mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>Route, arrivée, photos, signature, WiFi et messages client.</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {QUICK.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className="tc-quick-action"
              >
                <Icon className="h-5 w-5" />
                <span>{t.label}</span>
              </Link>
            );
          })}
        </section>

        <Section title="Opérations quotidiennes" tiles={OPS} />
        <Section title="Sur le terrain" tiles={TERRAIN} wide />
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Formation & procédures" tiles={KNOWLEDGE} />
          <Section title="Performance & véhicule" tiles={PERF} />
        </div>
      </main>
    </>
  );
}
