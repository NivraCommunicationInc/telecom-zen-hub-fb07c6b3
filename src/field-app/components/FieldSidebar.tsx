/**
 * FieldSidebar — Mobile-first navigation for Field Sales portal.
 */
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, UserPlus, Package, Send, TrendingUp,
  DollarSign, User, Lock, LogOut, MapPin,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const FIELD_BASE = "/field";

const navItems = [
  { label: "Tableau de bord", href: `${FIELD_BASE}/dashboard`, icon: LayoutDashboard },
  { label: "Leads", href: `${FIELD_BASE}/leads`, icon: UserPlus },
  { label: "Offres approuvées", href: `${FIELD_BASE}/offers`, icon: Package },
  { label: "Soumissions", href: `${FIELD_BASE}/submissions`, icon: Send },
  { label: "Suivi ventes", href: `${FIELD_BASE}/tracking`, icon: TrendingUp },
  { label: "Commissions", href: `${FIELD_BASE}/commissions`, icon: DollarSign },
];

const bottomItems = [
  { label: "Mon profil", href: `${FIELD_BASE}/profile`, icon: User },
  { label: "Sécurité", href: `${FIELD_BASE}/security`, icon: Lock },
];

export default function FieldSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (href: string) =>
    location.pathname === href || location.pathname.startsWith(href + "/");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/hub/login", { replace: true });
  };

  return (
    <>
      <aside className="hidden md:flex flex-col w-56 border-r border-border bg-sidebar">
        <div className="h-14 flex items-center px-4 border-b border-border">
          <Link to={`${FIELD_BASE}/dashboard`} className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
              <MapPin className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm text-foreground tracking-tight">Nivra Field</span>
          </Link>
        </div>

        <ScrollArea className="flex-1 py-2">
          <nav className="px-2 space-y-0.5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </ScrollArea>

        <div className="border-t border-border py-2 px-2 space-y-0.5">
          {bottomItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors",
                isActive(item.href)
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          ))}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-sidebar px-1 py-1 safe-bottom">
        <div className="flex items-center justify-around">
          {navItems.slice(0, 5).map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-lg text-[10px] font-medium transition-colors",
                isActive(item.href) ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-4.5 w-4.5" />
              <span className="truncate max-w-[56px]">{item.label.split(" ")[0]}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
