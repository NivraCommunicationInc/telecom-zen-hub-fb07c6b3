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
  iconColor: string;
  iconBg: string;
}

const PORTALS: PortalOption[] = [
  {
    id: "core",
    label: "Nivra Core",
    description: "Console d'opérations — Contrôle administratif, facturation, commandes, clients.",
    icon: Terminal,
    iconColor: "text-green-600",
    iconBg: "bg-green-50",
  },
  {
    id: "employee",
    label: "Nivra Employee",
    description: "Espace de travail — Gestion clients, commandes, tickets, rendez-vous, POS.",
    icon: Briefcase,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-50",
  },
  {
    id: "field",
    label: "Nivra Field",
    description: "Opérations terrain — Ventes porte-à-porte, prospects, commissions.",
    icon: MapPin,
    iconColor: "text-amber-600",
    iconBg: "bg-amber-50",
  },
];

export default function HubPage() {
  const navigate = useNavigate();

  const handleSelect = (portal: PortalOption) => {
    navigate(`/hub/login?portal=${portal.id}`);
  };

  return (
    <div className="min-h-screen bg-white text-black flex flex-col">
      {/* Header */}
      <header className="border-b border-[#E5E7EB] bg-white">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-green-500 flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="font-semibold text-sm tracking-tight text-black">Nivra Internal</span>
              <span className="ml-2 text-[10px] font-mono text-[#6B7280] uppercase tracking-widest">
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
            <h1 className="text-2xl font-bold tracking-tight mb-2 text-black">
              Sélectionnez votre espace de travail
            </h1>
            <p className="text-sm text-[#374151]">
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
                  "border-[#E5E7EB] hover:border-green-500",
                  "bg-white hover:bg-gray-50",
                  "active:scale-[0.98]",
                  "shadow-sm hover:shadow-md"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", portal.iconBg)}>
                    <portal.icon className={cn("h-5 w-5", portal.iconColor)} />
                  </div>
                  <ChevronRight className="h-5 w-5 text-[#9CA3AF] group-hover:text-green-500 group-hover:translate-x-1 transition-all" />
                </div>
                <h3 className="text-base font-semibold mt-4 mb-1 text-black">{portal.label}</h3>
                <p className="text-xs text-[#374151] leading-relaxed">{portal.description}</p>
              </button>
            ))}
          </div>

          {/* Security footer */}
          <div className="mt-12 text-center">
            <div className="flex items-center justify-center gap-2 text-[#9CA3AF]">
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
