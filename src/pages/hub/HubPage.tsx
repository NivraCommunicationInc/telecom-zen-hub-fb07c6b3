/**
 * HubPage — Secure Internal Access Hub — Portal Selection (Public).
 * NoIndex enforced at page-level + via _headers + robots.txt.
 */
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Terminal, Briefcase, MapPin, Shield, ChevronRight, UserCheck, Megaphone, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInternalTheme } from "@/hooks/useInternalTheme";
import InternalThemeToggle from "@/components/internal/InternalThemeToggle";

function useNoIndexMeta() {
  useEffect(() => {
    const tags: HTMLMetaElement[] = [];
    const add = (name: string, content: string) => {
      const m = document.createElement("meta");
      m.name = name;
      m.content = content;
      document.head.appendChild(m);
      tags.push(m);
    };
    add("robots", "noindex, nofollow, noarchive, nosnippet");
    add("googlebot", "noindex, nofollow, noarchive, nosnippet");
    const prevTitle = document.title;
    document.title = "Nivra Internal";
    return () => {
      tags.forEach((t) => t.remove());
      document.title = prevTitle;
    };
  }, []);
}

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
    label: "Nivra OneView CS",
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
  {
    id: "rh",
    label: "Nivra HR",
    description: "Dossier employé — Fiches de paie, documents fiscaux, horaires, lettres d'emploi.",
    icon: UserCheck,
    iconColor: "text-foreground",
    iconBg: "bg-secondary",
  },
  {
    id: "technician",
    label: "Nivra Technician",
    description: "Portail mobile installation — Assignations, étapes, tests réseau, scanner.",
    icon: Wrench,
    iconColor: "text-foreground",
    iconBg: "bg-secondary",
  },
  {
    id: "marketing",
    label: "Marketing Hub",
    description: "CRM · Campagnes SMS/Email · Agent IA · Live Chat — Réservé aux administrateurs.",
    icon: Megaphone,
    iconColor: "text-foreground",
    iconBg: "bg-secondary",
  },
];

export default function HubPage() {
  const navigate = useNavigate();
  const { theme, themeClass, toggleTheme } = useInternalTheme();
  useNoIndexMeta();

  return (
    <div className={cn("internal-ui min-h-screen bg-background text-foreground flex flex-col", themeClass)}>
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
          <div className="ml-auto">
            <InternalThemeToggle theme={theme} onToggle={toggleTheme} />
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
                onClick={() => navigate(`/nivra-secure-hub-2617-internal/login?portal=${portal.id}`)}
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
