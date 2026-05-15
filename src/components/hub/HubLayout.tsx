/**
 * HubLayout — Nivra Source shared layout.
 * 6 navigation tabs accessible from any internal portal (Field/Employee/RH).
 * The basePath prop controls the route prefix per portal.
 */
import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Megaphone, BookOpen, ShoppingBag, Trophy, Calendar, ClipboardList } from "lucide-react";

interface HubLayoutProps {
  basePath: string; // e.g. "/field/hub" | "/employee/hub" | "/rh/hub"
}

const TABS = [
  { key: "annonces",     label: "Annonces",      icon: Megaphone },
  { key: "documents",    label: "Documents",     icon: BookOpen },
  { key: "boutique",     label: "Boutique Nivra",icon: ShoppingBag },
  { key: "leaderboard",  label: "Leaderboard",   icon: Trophy },
  { key: "calendrier",   label: "Calendrier",    icon: Calendar },
  { key: "formulaires",  label: "Formulaires",   icon: ClipboardList },
];

export default function HubLayout({ basePath }: HubLayoutProps) {
  return (
    <div className="min-h-full">
      <div className="border-b border-border bg-card">
        <div className="px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-xl bg-violet-600 flex items-center justify-center">
              <Megaphone className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold text-foreground tracking-tight">Nivra Source</h1>
              <p className="text-[11px] text-muted-foreground">Hub interne — annonces, documents, boutique, équipe</p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-1.5">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <NavLink
                  key={t.key}
                  to={`${basePath}/${t.key}`}
                  className={({ isActive }) => cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors min-h-[44px] sm:min-h-0",
                    isActive
                      ? "bg-violet-600 text-white"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>
      <div className="p-4 sm:p-6">
        <Outlet />
      </div>
    </div>
  );
}
