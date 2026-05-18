/**
 * FieldSidebar — Premium dark navy + purple sidebar (Salesforce-grade).
 * Responsive across mobile (bottom tab bar), tablet (collapsed icon rail w/ toggle)
 * and desktop (full 256px rail). Controlled collapse state from FieldAppLayout.
 */
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { fetchSidebarBadges } from "@/field-app/lib/fieldServices";
import {
  LayoutDashboard, UserPlus, Package, Send, TrendingUp,
  DollarSign, User, Lock, LogOut, ShoppingCart,
  Target, Users, Map, Calendar, Tag, Sparkles, Zap,
  ChevronLeft, ChevronRight, LayoutGrid, IdCard,
  GraduationCap, BookOpen, ClipboardList,
} from "lucide-react";
import { useHubUnreadCount } from "@/hooks/useHubUnreadCount";
import { ScrollArea } from "@/components/ui/scroll-area";

const FIELD_BASE = "/field";

const salesNav = [
  { label: "Nouvelle vente", href: `${FIELD_BASE}/sale/new`, icon: ShoppingCart, primary: true },
  { label: "Mes commandes", href: `${FIELD_BASE}/orders`, icon: Package },
  { label: "Soumissions", href: `${FIELD_BASE}/submissions`, icon: Send, badgeKey: "orders" as const },
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
  { label: "Formation", href: `${FIELD_BASE}/training`, icon: GraduationCap },
  { label: "Ressources", href: `${FIELD_BASE}/resources`, icon: BookOpen },
  { label: "Procédures", href: `${FIELD_BASE}/procedures`, icon: ClipboardList },
  { label: "Mon Badge", href: `${FIELD_BASE}/badge`, icon: IdCard },
];

const hubNav = [
  { label: "Nivra Source", href: `${FIELD_BASE}/hub`, icon: LayoutGrid, badgeKey: "hub" as const },
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
  collapsed,
}: {
  title: string;
  items: NavItem[];
  isActive: (h: string) => boolean;
  badges: Record<string, number>;
  collapsed: boolean;
}) {
  return (
    <div className="space-y-1 mt-5 first:mt-0">
      {!collapsed && (
        <p className="px-4 pb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500">
          {title}
        </p>
      )}
      {items.map((item) => {
        const active = isActive(item.href);
        const badge = item.badgeKey ? badges[item.badgeKey] : 0;
        return (
          <Link
            key={item.href}
            to={item.href}
            title={collapsed ? item.label : undefined}
            className={cn(
              "group mx-2 flex items-center rounded-xl text-[13px] font-medium transition-all duration-200",
              collapsed ? "justify-center px-0 py-3" : "justify-between px-3 py-2.5",
              active
                ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                : item.primary
                  ? "bg-violet-600/15 text-white border border-violet-500/40 hover:bg-violet-600/25"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white border border-transparent",
            )}
            style={{ minHeight: 44 }}
          >
            <span className={cn("flex items-center", collapsed ? "" : "gap-3")}>
              <item.icon className={cn("h-5 w-5 shrink-0", active && "drop-shadow-sm")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </span>
            {!collapsed && badge > 0 && (
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
            {collapsed && badge > 0 && (
              <span
                className="absolute mt-[-22px] ml-6 h-2 w-2 rounded-full"
                style={{ background: "hsl(var(--field-accent-glow))" }}
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}

interface FieldSidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export default function FieldSidebar({ collapsed, onToggleCollapsed }: FieldSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: badges } = useBadges();
  const { data: hubUnread = 0 } = useHubUnreadCount();
  const badgeCounts = {
    orders: badges?.orders ?? 0,
    leads: badges?.leads ?? 0,
    clients: badges?.clients ?? 0,
    hub: hubUnread,
  };

  const isActive = (href: string) =>
    location.pathname === href || location.pathname.startsWith(href + "/");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/nivra-secure-hub-2617-internal/login", { replace: true });
  };

  return (
    <>
      {/* DESKTOP & TABLET — Side rail (collapsible on tablet) */}
      <aside
        className={cn(
          "hidden md:flex flex-col shrink-0 sticky top-0 h-screen transition-all duration-200 bg-gray-900 border-r border-gray-700",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo + collapse toggle */}
        <div className="h-16 flex items-center justify-between px-3 bg-gray-900 border-b border-gray-700">
          <Link to={`${FIELD_BASE}/dashboard`} className={cn("flex items-center gap-3", collapsed && "mx-auto")}>
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 bg-violet-600 shadow-md shadow-violet-600/40">
              <Zap className="h-4.5 w-4.5 text-white" />
            </div>
            {!collapsed && (
              <div>
                <div className="font-bold text-[15px] tracking-tight text-white leading-none flex items-center gap-1.5">
                  Nivra <span className="text-violet-400">Field</span>
                </div>
                <div className="text-[10px] font-medium mt-0.5 text-gray-500">
                  Portail terrain
                </div>
              </div>
            )}
          </Link>
          {!collapsed && (
            <button
              onClick={onToggleCollapsed}
              aria-label="Réduire le menu"
              className="hidden md:inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
        </div>

        <ScrollArea className="flex-1 py-3">
          <NavSection title="Ventes" items={salesNav} isActive={isActive} badges={badgeCounts} collapsed={collapsed} />
          <NavSection title="Prospection" items={prospectNav} isActive={isActive} badges={badgeCounts} collapsed={collapsed} />
          <NavSection title="Revenus" items={revenueNav} isActive={isActive} badges={badgeCounts} collapsed={collapsed} />
          <NavSection title="Outils" items={toolsNav} isActive={isActive} badges={{}} collapsed={collapsed} />
          <NavSection title="Nivra Source" items={hubNav} isActive={isActive} badges={badgeCounts} collapsed={collapsed} />
        </ScrollArea>

        {/* Bottom — profile + logout */}
        <div className="px-2 py-3 space-y-1 border-t border-gray-700">
          {bottomItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center mx-1 rounded-xl text-[12px] font-medium transition-colors",
                  collapsed ? "justify-center py-2.5" : "gap-3 px-3 py-2",
                  active ? "bg-violet-600 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white"
                )}
                style={{ minHeight: 44 }}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
          <button
            onClick={() => navigate('/nivra-secure-hub-2617-internal')}
            title={collapsed ? "Changer de portail" : undefined}
            className={cn(
              "w-full flex items-center mx-1 rounded-xl text-[12px] font-medium text-gray-400 hover:bg-gray-700/50 hover:text-white transition-colors border-t border-gray-700 pt-2 mt-2",
              collapsed ? "justify-center py-2.5" : "gap-3 px-3 py-2"
            )}
            style={{ minHeight: 44 }}
          >
            <LayoutGrid className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Changer de portail</span>}
          </button>
          <button
            onClick={handleLogout}
            title={collapsed ? "Déconnexion" : undefined}
            className={cn(
              "w-full flex items-center mx-1 rounded-xl text-[12px] font-medium text-gray-300 hover:bg-gray-800 hover:text-red-400 transition-colors",
              collapsed ? "justify-center py-2.5" : "gap-3 px-3 py-2"
            )}
            style={{ minHeight: 44 }}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Déconnexion</span>}
          </button>
          {collapsed && (
            <button
              onClick={onToggleCollapsed}
              aria-label="Étendre le menu"
              className="w-full flex items-center justify-center py-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              style={{ minHeight: 44 }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </aside>

      {/* MOBILE — Bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-2 py-2 safe-bottom bg-gray-900 border-t border-gray-700"
        style={{ backdropFilter: "blur(12px)" }}
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
                  minHeight: 44,
                  minWidth: 44,
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
