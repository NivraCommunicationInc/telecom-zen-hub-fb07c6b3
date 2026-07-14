/**
 * TechMenu — Hub central du portail technicien.
 * Grille de tuiles vers tous les modules (Ops, Terrain, Formation, Perf).
 */
import { Link } from "react-router-dom";
import {
  CalendarClock, MessageSquare, Ticket, FileSignature,
  UserSquare2, GraduationCap, BarChart3, Truck,
  User, ChevronRight, ClipboardList, Map, Package, ScanLine,
} from "lucide-react";
import TechHeader from "../components/TechHeader";

interface Tile {
  to: string;
  icon: React.ComponentType<any>;
  label: string;
  hint?: string;
}

const OPS: Tile[] = [
  { to: "/tech/schedule", icon: CalendarClock, label: "Horaire & Punch", hint: "Semaine · pointage GPS" },
  { to: "/tech/chat", icon: MessageSquare, label: "Chat & Dispatch", hint: "Client · Core · équipe" },
  { to: "/tech/tickets", icon: Ticket, label: "Tickets & SAV", hint: "Ouvrir · escalader" },
];
const TERRAIN: Tile[] = [
  { to: "/tech/workorder", icon: FileSignature, label: "Bon de travail", hint: "Signature · photos · PDF" },
  { to: "/tech/client360", icon: UserSquare2, label: "Client 360", hint: "Services · factures · paiement" },
];
const KNOWLEDGE: Tile[] = [
  { to: "/tech/training", icon: GraduationCap, label: "Formation", hint: "Guides · vidéos · certifications" },
];
const PERF: Tile[] = [
  { to: "/tech/performance", icon: BarChart3, label: "Performance", hint: "Installs · taux · commissions" },
  { to: "/tech/vehicle", icon: Truck, label: "Véhicule & EHS", hint: "Check-list · incidents" },
];
const QUICK: Tile[] = [
  { to: "/tech", icon: ClipboardList, label: "Missions" },
  { to: "/tech/map", icon: Map, label: "Carte" },
  { to: "/tech/scanner", icon: ScanLine, label: "Scanner" },
  { to: "/tech/stock", icon: Package, label: "Stock" },
  { to: "/tech/profile", icon: User, label: "Profil" },
];

function Section({ title, tiles }: { title: string; tiles: Tile[] }) {
  return (
    <section className="px-4 mt-5">
      <h2 className="tp-italic-label text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-2">{title}</h2>
      <div className="space-y-2">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className="flex items-center gap-3 p-3 rounded-xl bg-white border border-zinc-200 hover:border-amber-400 transition-colors"
            >
              <span className="h-11 w-11 rounded-lg flex items-center justify-center bg-zinc-900">
                <Icon className="h-5 w-5" style={{ color: "#fbbf24" }} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-black italic uppercase text-zinc-900 leading-tight">{t.label}</span>
                <span className="block text-[11px] text-zinc-500 font-medium truncate">{t.hint}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-zinc-400" />
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
      <TechHeader title="Menu" subtitle="Toutes les fonctions" />
      <Section title="Opérations quotidiennes" tiles={OPS} />
      <Section title="Sur le terrain" tiles={TERRAIN} />
      <Section title="Formation & procédures" tiles={KNOWLEDGE} />
      <Section title="Performance & véhicule" tiles={PERF} />

      <section className="px-4 mt-5 mb-8">
        <h2 className="tp-italic-label text-[11px] font-black uppercase tracking-widest text-zinc-500 mb-2">Accès rapide</h2>
        <div className="grid grid-cols-5 gap-2">
          {QUICK.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white border border-zinc-200"
              >
                <Icon className="h-5 w-5 text-zinc-900" />
                <span className="text-[9px] font-black italic uppercase text-zinc-700 leading-none">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
