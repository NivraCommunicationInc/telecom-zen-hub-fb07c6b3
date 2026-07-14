/**
 * TechMenu — Hub central du portail technicien.
 * Grille de tuiles vers tous les modules (Ops, Terrain, Formation, Perf).
 */
import { Link } from "react-router-dom";
import type { ComponentType } from "react";
import {
  CalendarClock, MessageSquare, Ticket, FileSignature,
  UserSquare2, GraduationCap, BarChart3, Truck,
  ChevronRight, ClipboardList, Map, Package, ScanLine,
  Gauge, Radio, ShieldCheck, Route, Camera, Headphones,
} from "lucide-react";
import TechHeader from "../components/TechHeader";

interface Tile {
  to: string;
  icon: ComponentType<any>;
  label: string;
  hint?: string;
}

const OPS: Tile[] = [
  { to: "/tech", icon: Gauge, label: "Dashboard ops", hint: "Vue command center" },
  { to: "/tech/appointments", icon: CalendarClock, label: "Rendez-vous", hint: "Liste installations" },
  { to: "/tech/assignments", icon: Radio, label: "Dispatch disponible", hint: "Prendre une mission" },
  { to: "/tech/schedule", icon: CalendarClock, label: "Horaire & Punch", hint: "Semaine · pointage GPS" },
  { to: "/tech/chat", icon: MessageSquare, label: "Chat & Dispatch", hint: "Client · Core · équipe" },
  { to: "/tech/tickets", icon: Ticket, label: "Tickets & SAV", hint: "Ouvrir · escalader" },
];
const TERRAIN: Tile[] = [
  { to: "/tech/appointments", icon: Route, label: "Installation active", hint: "Route · arrivée · service" },
  { to: "/tech/workorder", icon: FileSignature, label: "Bon de travail", hint: "Signature · photos · PDF" },
  { to: "/tech/client360", icon: UserSquare2, label: "Client 360", hint: "Services · factures · paiement" },
  { to: "/tech/scanner", icon: ScanLine, label: "Scan équipement", hint: "Série · MAC · IMEI" },
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
  { to: "/tech", icon: Gauge, label: "Dash" },
  { to: "/tech/appointments", icon: CalendarClock, label: "RDV" },
  { to: "/tech/assignments", icon: ClipboardList, label: "Jobs" },
  { to: "/tech/map", icon: Map, label: "Carte" },
  { to: "/tech/scanner", icon: ScanLine, label: "Scanner" },
];

function Section({ title, tiles }: { title: string; tiles: Tile[] }) {
  return (
    <section className="mt-5">
      <div className="tp-section-title"><h2 className="text-[16px] font-black italic uppercase">{title}</h2></div>
      <div className="tp-module-grid">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className="tp-module-tile"
            >
              <span className="tp-module-icon">
                <Icon className="h-5 w-5" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-black italic uppercase leading-tight">{t.label}</span>
                <span className="block text-[11px] font-medium truncate" style={{ color: "var(--tp-text-dim)" }}>{t.hint}</span>
              </span>
              <ChevronRight className="h-4 w-4" style={{ color: "var(--tp-text-dim)" }} />
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
      <TechHeader title="Menu Ops" subtitle="Toutes les fonctions terrain" />
      <main className="tp-page">
      <section className="tp-ops-hero p-5">
        <p className="text-[11px] font-black uppercase" style={{ color: "var(--tp-primary)" }}>Centre de contrôle technicien</p>
        <h1 className="text-[34px] font-black italic uppercase leading-none" style={{ color: "var(--tp-dark-text)" }}>Modules terrain</h1>
        <p className="mt-2 text-[13px]" style={{ color: "var(--tp-dark-text-dim)" }}>Rendez-vous, dispatch, installation, stock, client, formation, performance.</p>
      </section>
      <Section title="Opérations quotidiennes" tiles={OPS} />
      <Section title="Sur le terrain" tiles={TERRAIN} />
      <Section title="Formation & procédures" tiles={KNOWLEDGE} />
      <Section title="Performance & véhicule" tiles={PERF} />

      <section className="mt-5 mb-8">
        <div className="tp-section-title"><h2 className="text-[16px] font-black italic uppercase">Accès rapide</h2></div>
        <div className="grid grid-cols-5 gap-2">
          {QUICK.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className="flex flex-col items-center gap-1 p-2 rounded-md"
                style={{ background: "var(--tp-panel)", border: "1px solid var(--tp-border)", color: "var(--tp-text)" }}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[9px] font-black italic uppercase leading-none">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </section>
      </main>
    </>
  );
}
