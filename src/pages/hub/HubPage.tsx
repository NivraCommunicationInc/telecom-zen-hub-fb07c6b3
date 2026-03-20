/**
 * HubPage — Secure Internal Access Hub — Portal Selection (Public).
 */
import { useNavigate } from "react-router-dom";
import { Terminal, Briefcase, MapPin, Shield, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PortalOption {
  id: string;
  label: string;
  description: string;
  icon: typeof Terminal;
  iconColor: string;
  iconBg: string;
}

const PORTALS: PortalOption[] = [
  {
    id: "core",
    label: "Nivra Core",
    description: "Console d'opérations — Contrôle administratif, facturation, commandes, clients.",
    icon: Terminal,
    iconColor: "text-foreground",
    iconBg: "bg-secondary",
  },
  {
    id: "employee",
    label: "Nivra Employee",
    description: "Espace de travail — Gestion clients, commandes, tickets, rendez-vous, POS.",
    icon: Briefcase,
    iconColor: "text-foreground",
    iconBg: "bg-secondary",
  },
  {
    id: "field",
    label: "Nivra Field",
    description: "Opérations terrain — Ventes porte-à-porte, prospects, commissions.",
    icon: MapPin,
    iconColor: "text-foreground",
    iconBg: "bg-secondary",
  },
];

export default function HubPage() {
  const navigate = useNavigate();

  return (
    <div className="internal-ui min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <span className="font-semibold text-sm tracking-tight text-foreground">Nivra Internal</span>
              <span className="ml-2 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Secure Hub</span>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-10">
            <h1 className="text-2xl font-bold tracking-tight mb-2 text-foreground">Sélectionnez votre espace de travail</h1>
            <p className="text-sm text-muted-foreground">Accès réservé au personnel autorisé Nivra.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PORTALS.map((portal) => (
              <button
                key={portal.id}
                onClick={() => navigate(`/hub/login?portal=${portal.id}`)}
                className={cn(
                  "group relative text-left p-5 rounded-xl border transition-all duration-200",
                  "border-border bg-card hover:bg-secondary",
                  "active:scale-[0.98] shadow-sm"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", portal.iconBg)}>
                    <portal.icon className={cn("h-5 w-5", portal.iconColor)} />
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-base font-semibold mt-4 mb-1 text-foreground">{portal.label}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{portal.description}</p>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
