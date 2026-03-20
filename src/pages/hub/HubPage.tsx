/**
 * HubPage — Secure Internal Access Hub — Portal Selection (Public).
 * This is the FIRST screen staff sees. No login required here.
 * User picks a workspace → redirected to /hub/login?portal=xxx → auth + MFA → portal.
 */
import { useNavigate } from "react-router-dom";
import { Terminal, Briefcase, MapPin, Shield, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PortalOption {
  id: string;
  label: string;
  description: string;
  icon: typeof Terminal;
  color: string;
  bgColor: string;
  borderColor: string;
}

const PORTALS: PortalOption[] = [
  {
    id: "core",
    label: "Nivra Core",
    description: "Console d'opérations — Contrôle administratif, facturation, commandes, clients.",
    icon: Terminal,
    color: "text-emerald-400",
    bgColor: "bg-emerald-600/10",
    borderColor: "border-emerald-600/20 hover:border-emerald-500/40",
  },
  {
    id: "employee",
    label: "Nivra Employee",
    description: "Espace de travail — Gestion clients, commandes, tickets, rendez-vous, POS.",
    icon: Briefcase,
    color: "text-blue-400",
    bgColor: "bg-blue-600/10",
    borderColor: "border-blue-600/20 hover:border-blue-500/40",
  },
  {
    id: "field",
    label: "Nivra Field",
    description: "Opérations terrain — Ventes porte-à-porte, prospects, commissions.",
    icon: MapPin,
    color: "text-amber-400",
    bgColor: "bg-amber-600/10",
    borderColor: "border-amber-600/20 hover:border-amber-500/40",
  },
];

export default function HubPage() {
  const navigate = useNavigate();

  const handleSelect = (portal: PortalOption) => {
    navigate(`/hub/login?portal=${portal.id}`);
  };

  return (
    <div className="min-h-screen bg-[hsl(220,20%,6%)] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-[hsl(220,15%,12%)] bg-[hsl(220,20%,7%)]/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="font-semibold text-sm tracking-tight">Nivra Internal</span>
              <span className="ml-2 text-[10px] font-mono text-[hsl(220,10%,40%)] uppercase tracking-widest">
                Secure Hub
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-3xl">
          <div className="text-center mb-10">
            <h1 className="text-2xl font-bold tracking-tight mb-2">Sélectionnez votre espace de travail</h1>
            <p className="text-sm text-[hsl(220,10%,45%)]">
              Accès réservé au personnel autorisé Nivra.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PORTALS.map((portal) => (
              <button
                key={portal.id}
                onClick={() => handleSelect(portal)}
                className={cn(
                  "group relative text-left p-5 rounded-xl border transition-all duration-200",
                  portal.borderColor,
                  "bg-[hsl(220,20%,8%)] hover:bg-[hsl(220,20%,10%)]"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", portal.bgColor)}>
                    <portal.icon className={cn("h-5 w-5", portal.color)} />
                  </div>
                  <ChevronRight className="h-5 w-5 text-[hsl(220,10%,30%)] group-hover:translate-x-1 transition-transform" />
                </div>
                <h3 className="text-base font-semibold mt-4 mb-1">{portal.label}</h3>
                <p className="text-xs text-[hsl(220,10%,45%)] leading-relaxed">{portal.description}</p>
              </button>
            ))}
          </div>

          {/* Security footer */}
          <div className="mt-12 text-center">
            <div className="flex items-center justify-center gap-2 text-[hsl(220,10%,25%)]">
              <Shield className="h-3.5 w-3.5" />
              <span className="text-[10px] uppercase tracking-widest font-medium">
                Réservé au personnel autorisé · Accès audité
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
