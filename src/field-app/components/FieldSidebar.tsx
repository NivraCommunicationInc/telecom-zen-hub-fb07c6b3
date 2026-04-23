/**
 * FieldSidebar — Premium dark navy + purple sidebar (Salesforce-grade).
 * Mobile-first with bottom tab bar, desktop side rail.
 */
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { fetchSidebarBadges } from "@/field-app/lib/fieldServices";
import {
  LayoutDashboard, UserPlus, Package, Send, TrendingUp,
  DollarSign, User, Lock, LogOut, MapPin, ShoppingCart,
  Target, Users, Map, Calendar, Tag, Sparkles, Zap,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const FIELD_BASE = "/field";

const salesNav = [
  { label: "Nouvelle vente", href: `${FIELD_BASE}/sale/new`, icon: ShoppingCart, primary: true },
  { label: "Mes commandes", href: `${FIELD_BASE}/submissions`, icon: Send, badgeKey: "orders" as const },
  { label: "Suivi pipeline", href: `${FIELD_BASE}/tracking`, icon: TrendingUp },
];

const prospectNav = [
  { label: "Leads", href: `${FIELD_BASE}/leads`, icon: UserPlus, badgeKey: "leads" as const },
  { label: "Territoire & rues", href: `${FIELD_BASE}/territory`, icon: Map },
  { label: "Clients", href: `${FIELD_BASE}/clients`, icon: Users, badgeKey: "clients" as const },
];

const revenueNav = [
  { label: "Commissions", href: `${FIELD_BASE}/commissions`, icon: DollarSign },
  { label: "Mes rabais", href: `${FIELD_BASE}/offers`, icon: Tag },
];

const toolsNav = [
  { label: "Catalogue offres", href: `${FIELD_BASE}/offers`, icon: Package },
  { label: "Objectifs & cibles", href: `${FIELD_BASE}/objectives`, icon: Target },
  { label: "Rapport du jour", href: `${FIELD_BASE}/daily-report`, icon: Calendar },
];

const bottomItems = [
  { label: "Mon profil", href: `${FIELD_BASE}/profile`, icon: User },
  { label: "Sécurité", href: `${FIELD_BASE}/security`, icon: Lock },
];

function useBadges() {
  return useQuery({
    queryKey: ["field-sidebar-badges"],
    queryFn: fetchSidebarBadges,
    staleTime: 1000 * 60 * 3,
  });
}

interface NavItem {
  label: string;
  href: string;
  icon: any;
  badgeKey?: string;
  primary?: boolean;
}

function NavSection({
  title,
  items,
  isActive,
  badges,
}: {
  title: string;
  items: NavItem[];
  isActive: (h: string) => boolean;
  badges: Record<string, number>;
}) {
  return (
    <div className="space-y-1 mt-5 first:mt-0">
      <p className="px-4 pb-1.5 text-[10px] font-bold uppercase tracking-[0.15em]"
         style={{ color: "hsl(var(--field-text-dim))" }}>
        {title}
      </p>
      {items.map((item) => {
        const active = isActive(item.href);
        const badge = item.badgeKey ? badges[item.badgeKey] : 0;
        return (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "group mx-2 flex items-center justify-between rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200",
              active && "field-glow",
              item.primary && !active && "text-white",
            )}
            style={{
              background: active
                ? "linear-gradient(135deg, hsl(var(--field-accent)) 0%, hsl(var(--field-accent-glow)) 100%)"
                : item.primary
                  ? "hsl(var(--field-accent) / 0.15)"
                  : "transparent",
              color: active ? "white" : "hsl(var(--field-text-muted))",
              border: item.primary && !active
                ? "1px solid hsl(var(--field-accent) / 0.4)"
                : "1px solid transparent",
            }}
            onMouseEnter={(e) => {
              if (!active) {
                e.currentTarget.style.background = "hsl(var(--field-card-hover))";
                e.currentTarget.style.color = "white";
              }
            }}
            onMouseLeave={(e) => {
              if (!active) {
                e.currentTarget.style.background = item.primary ? "hsl(var(--field-accent) / 0.15)" : "transparent";
                e.currentTarget.style.color = item.primary ? "white" : "hsl(var(--field-text-muted))";
              }
            }}
          >
            <span className="flex items-center gap-3">
              <item.icon className={cn("h-4 w-4 shrink-0", active && "drop-shadow-sm")} />
              <span className="truncate">{item.label}</span>
            </span>
            {badge > 0 && (
              <span
                className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
                style={{
                  background: active ? "rgba(255,255,255,0.25)" : "hsl(var(--field-accent))",
                  color: "white",
                }}
              >
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export default function FieldSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: badges } = useBadges();
  const badgeCounts = {
    orders: badges?.orders ?? 0,
    leads: badges?.leads ?? 0,
    clients: badges?.clients ?? 0,
  };

  const isActive = (href: string) =>
    location.pathname === href || location.pathname.startsWith(href + "/");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/hub/login", { replace: true });
  };

  return (
    <>
      {/* DESKTOP — Side rail */}
      <aside
        className="hidden md:flex flex-col w-64 shrink-0 sticky top-0 h-screen"
        style={{
          background: "linear-gradient(180deg, hsl(var(--field-bg-elevated)) 0%, hsl(var(--field-bg)) 100%)",
          borderRight: "1px solid hsl(var(--field-border) / 0.15)",
        }}
      >
        {/* Logo */}
        <div
          className="h-16 flex items-center px-5"
          style={{ borderBottom: "1px solid hsl(var(--field-border) / 0.12)" }}
        >
          <Link to={`${FIELD_BASE}/dashboard`} className="flex items-center gap-3">
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center field-glow"
              style={{
                background: "linear-gradient(135deg, hsl(var(--field-accent)) 0%, hsl(var(--field-accent-glow)) 100%)",
              }}
            >
              <Zap className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <div className="font-bold text-[15px] tracking-tight text-white leading-none flex items-center gap-1.5">
                Nivra <span style={{ color: "hsl(var(--field-accent-glow))" }}>Field</span>
              </div>
              <div
                className="text-[10px] font-medium mt-0.5"
                style={{ color: "hsl(var(--field-text-dim))" }}
              >
                Portail terrain
              </div>
            </div>
          </Link>
        </div>

        <ScrollArea className="flex-1 py-3">
          <NavSection title="Ventes" items={salesNav} isActive={isActive} badges={badgeCounts} />
          <NavSection title="Prospection" items={prospectNav} isActive={isActive} badges={badgeCounts} />
          <NavSection title="Revenus" items={revenueNav} isActive={isActive} badges={badgeCounts} />
          <NavSection title="Outils" items={toolsNav} isActive={isActive} badges={{}} />
        </ScrollArea>

        {/* Bottom — profile + logout */}
        <div
          className="px-2 py-3 space-y-1"
          style={{ borderTop: "1px solid hsl(var(--field-border) / 0.12)" }}
        >
          {bottomItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 mx-1 rounded-xl px-3 py-2 text-[12px] font-medium transition-colors",
                )}
                style={{
                  background: active ? "hsl(var(--field-accent) / 0.2)" : "transparent",
                  color: active ? "white" : "hsl(var(--field-text-muted))",
                }}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 mx-1 rounded-xl px-3 py-2 text-[12px] font-medium transition-colors hover:text-red-400"
            style={{ color: "hsl(var(--field-text-muted))" }}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* MOBILE — Bottom tab bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-2 py-2 safe-bottom"
        style={{
          background: "hsl(var(--field-bg-elevated))",
          borderTop: "1px solid hsl(var(--field-border) / 0.15)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center justify-around">
          {[
            { href: `${FIELD_BASE}/dashboard`, icon: LayoutDashboard, label: "Accueil" },
            { href: `${FIELD_BASE}/submissions`, icon: Send, label: "Commandes" },
            { href: `${FIELD_BASE}/sale/new`, icon: Sparkles, label: "Vendre", primary: true },
            { href: `${FIELD_BASE}/leads`, icon: UserPlus, label: "Leads" },
            { href: `${FIELD_BASE}/commissions`, icon: DollarSign, label: "Pay" },
          ].map((item: any) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                className="flex flex-col items-center gap-0.5 py-1.5 px-2 transition-all"
                style={{
                  color: active ? "hsl(var(--field-accent-glow))" : "hsl(var(--field-text-muted))",
                }}
              >
                {item.primary ? (
                  <div
                    className="h-12 w-12 rounded-2xl flex items-center justify-center -mt-5 field-glow-strong"
                    style={{
                      background: "linear-gradient(135deg, hsl(var(--field-accent)) 0%, hsl(var(--field-accent-glow)) 100%)",
                    }}
                  >
                    <item.icon className="h-6 w-6 text-white" />
                  </div>
                ) : (
                  <>
                    <item.icon className={cn("h-5 w-5 transition-transform", active && "scale-110")} />
                    <span className="text-[10px] font-semibold truncate max-w-[60px]">{item.label}</span>
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
