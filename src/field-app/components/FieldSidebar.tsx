/**
 * FieldSidebar — Pro-level navigation for Field Sales portal.
 * Clean light UI with grouped sections and badges.
 */
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useStaffUser } from "@/lib/hooks/useStaffUser";
import {
  LayoutDashboard, UserPlus, Package, Send, TrendingUp,
  DollarSign, User, Lock, LogOut, MapPin, ShoppingCart,
  BarChart3, Bell, Search, BookOpen, Calendar, Target,
  Briefcase, Users, Map,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const FIELD_BASE = "/field";

const mainNav = [
  { label: "Tableau de bord", href: `${FIELD_BASE}/dashboard`, icon: LayoutDashboard },
  { label: "Nouvelle vente", href: `${FIELD_BASE}/sale/new`, icon: ShoppingCart, highlight: true },
];

const salesNav = [
  { label: "Mes commandes", href: `${FIELD_BASE}/submissions`, icon: Send, badgeKey: "orders" as const },
  { label: "Suivi pipeline", href: `${FIELD_BASE}/tracking`, icon: TrendingUp },
  { label: "Commissions", href: `${FIELD_BASE}/commissions`, icon: DollarSign },
];

const prospectNav = [
  { label: "Clients", href: `${FIELD_BASE}/clients`, icon: Users, badgeKey: "clients" as const },
  { label: "Territoire & Rues", href: `${FIELD_BASE}/territory`, icon: Map },
  { label: "Leads", href: `${FIELD_BASE}/leads`, icon: UserPlus, badgeKey: "leads" as const },
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
  const { user } = useStaffUser();
  return useQuery({
    queryKey: ["field-sidebar-badges", user?.id],
    queryFn: async () => {
      const [ordersRes, leadsRes, clientsRes] = await Promise.all([
        supabase.from("field_sales_orders").select("id", { count: "exact", head: true })
          .eq("salesperson_id", user!.id).eq("payment_status", "pending"),
        supabase.from("field_leads").select("id", { count: "exact", head: true })
          .eq("agent_id", user!.id).not("status", "in", '("won","lost")'),
        supabase.from("field_sales_orders").select("id", { count: "exact", head: true })
          .eq("salesperson_id", user!.id),
      ]);
      return { orders: ordersRes.count ?? 0, leads: leadsRes.count ?? 0, clients: clientsRes.count ?? 0 };
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 3,
  });
}

function NavSection({ title, items, isActive, badges }: { title: string; items: { label: string; href: string; icon: any; badgeKey?: string }[]; isActive: (h: string) => boolean; badges: Record<string, number> }) {
  return (
    <div className="space-y-0.5">
      <p className="px-3 pt-3 pb-1 text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">{title}</p>
      {items.map((item) => {
        const badge = item.badgeKey ? badges[item.badgeKey] : 0;
        return (
          <Link
            key={item.href}
            to={item.href}
            className={cn(
              "flex items-center justify-between px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors mx-1",
              isActive(item.href)
                ? "bg-[#F0FDF4] text-[#16A34A]"
                : "text-[#6B7280] hover:text-[#000000] hover:bg-[#F9FAFB]"
            )}
          >
            <span className="flex items-center gap-2.5">
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </span>
            {badge > 0 && (
              <span className="text-[10px] font-bold bg-[#22C55E] text-white rounded-full h-5 min-w-[20px] flex items-center justify-center px-1">
                {badge}
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
  const badgeCounts = { orders: badges?.orders ?? 0, leads: badges?.leads ?? 0, clients: badges?.clients ?? 0 };

  const isActive = (href: string) =>
    location.pathname === href || location.pathname.startsWith(href + "/");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/hub/login", { replace: true });
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 border-r border-[#E5E7EB] bg-white">
        <div className="h-14 flex items-center px-4 border-b border-[#E5E7EB]">
          <Link to={`${FIELD_BASE}/dashboard`} className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#22C55E] flex items-center justify-center shadow-sm">
              <MapPin className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="font-bold text-sm text-[#000000] tracking-tight block leading-tight">Nivra Field</span>
              <span className="text-[9px] text-[#9CA3AF] font-medium">Portail terrain</span>
            </div>
          </Link>
        </div>

        <ScrollArea className="flex-1 py-1">
          {/* Main */}
          <div className="px-1 space-y-0.5 pt-2">
            {mainNav.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors mx-1",
                  item.highlight && !isActive(item.href)
                    ? "text-[#16A34A] bg-[#F0FDF4] hover:bg-[#DCFCE7]"
                    : isActive(item.href)
                      ? "bg-[#F0FDF4] text-[#16A34A]"
                      : "text-[#6B7280] hover:text-[#000000] hover:bg-[#F9FAFB]"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          <NavSection title="Ventes" items={salesNav} isActive={isActive} badges={badgeCounts} />
          <NavSection title="Prospection" items={prospectNav} isActive={isActive} badges={badgeCounts} />
          <NavSection title="Outils" items={toolsNav} isActive={isActive} badges={{}} />
        </ScrollArea>

        <div className="border-t border-[#E5E7EB] py-2 px-2 space-y-0.5">
          {bottomItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors",
                isActive(item.href)
                  ? "bg-[#F0FDF4] text-[#16A34A]"
                  : "text-[#6B7280] hover:text-[#000000] hover:bg-[#F9FAFB]"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          ))}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-[#6B7280] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-[#E5E7EB] bg-white px-1 py-1 safe-bottom">
        <div className="flex items-center justify-around">
          {[
            { href: `${FIELD_BASE}/dashboard`, icon: LayoutDashboard, label: "Accueil" },
            { href: `${FIELD_BASE}/submissions`, icon: Send, label: "Commandes" },
            { href: `${FIELD_BASE}/sale/new`, icon: ShoppingCart, label: "Vendre", primary: true },
            { href: `${FIELD_BASE}/leads`, icon: UserPlus, label: "Leads" },
            { href: `${FIELD_BASE}/objectives`, icon: Target, label: "Objectifs" },
          ].map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-lg text-[10px] font-medium transition-colors",
                item.primary
                  ? "text-white bg-[#22C55E] rounded-full px-4 py-2 -mt-3 shadow-lg"
                  : isActive(item.href) ? "text-[#16A34A]" : "text-[#6B7280]"
              )}
            >
              <item.icon className={cn("h-5 w-5", item.primary && "h-5 w-5")} />
              {!item.primary && <span className="truncate max-w-[56px]">{item.label}</span>}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}