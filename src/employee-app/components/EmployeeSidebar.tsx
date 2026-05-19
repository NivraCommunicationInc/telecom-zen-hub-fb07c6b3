/**
 * EmployeeSidebar — Production-grade telecom sidebar.
 * Dense, collapsible, grouped navigation.
 */
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  ListTodo, ShoppingCart, Users, CreditCard,
  ShieldCheck, Zap, Headphones, ScrollText, User, LogOut,
  Briefcase, ChevronLeft, ChevronRight, Calendar, FileText, GraduationCap,
  Package, UserCheck, Wifi, Mail, LayoutGrid, PhoneCall,
} from "lucide-react";
import { useHubUnreadCount } from "@/hooks/useHubUnreadCount";
import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePortalBreakpoint } from "@/hooks/usePortalBreakpoint";
import { useEmployeeSectionBadges } from "@/hooks/useEmployeeSectionBadges";
import { SectionBadge } from "@/components/ui/section-badge";

const EMP_BASE = "/employee";

const navGroups = [
  {
    label: "CLIENTS & COMPTES",
    items: [
      { label: "CRM Prospects", href: `${EMP_BASE}/crm`, icon: PhoneCall },
      { label: "Clients", href: `${EMP_BASE}/clients`, icon: Users, badge: "Nouveau client" },
      { label: "Comptes", href: `${EMP_BASE}/accounts`, icon: Briefcase },
      { label: "File de travail", href: `${EMP_BASE}/work-queue`, icon: ListTodo },
    ],
  },
  {
    label: "VENTES",
    items: [
      { label: "Nouvelle commande", href: `${EMP_BASE}/orders/new`, icon: ShoppingCart },
      { label: "Soumissions", href: `${EMP_BASE}/quotes`, icon: FileText },
      { label: "Paiements", href: `${EMP_BASE}/payments`, icon: CreditCard },
    ],
  },
  {
    label: "SUPPORT",
    items: [
      { label: "Tickets support", href: `${EMP_BASE}/support`, icon: Headphones, badge: "Nouveau" },
      { label: "Tickets Internet", href: `${EMP_BASE}/internet-tickets`, icon: Wifi, badge: "Nouveau" },
      { label: "Rendez-vous", href: `${EMP_BASE}/appointments`, icon: Calendar, badge: "Nouveau" },
    ],
  },
  {
    label: "GESTION",
    items: [
      { label: "Équipement & Retours", href: `${EMP_BASE}/equipment`, icon: Package },
      { label: "KYC & Identité", href: `${EMP_BASE}/kyc`, icon: ShieldCheck },
      { label: "Activations", href: `${EMP_BASE}/activations`, icon: Zap },
    ],
  },
  {
    label: "ADMIN",
    items: [
      { label: "Audit", href: `${EMP_BASE}/audit`, icon: ScrollText },
      { label: "Envoyer un courriel", href: `${EMP_BASE}/email/compose`, icon: Mail },
      { label: "Nivra Academy", href: `${EMP_BASE}/academy`, icon: GraduationCap },
    ],
  },
  {
    label: "NIVRA SOURCE",
    items: [
      { label: "Nivra Source", href: `${EMP_BASE}/hub`, icon: LayoutGrid, badgeKey: "hub" as const },
    ],
  },
];

const bottomItems = [
  { label: "Mon dossier HR", href: "/hr", icon: UserCheck },
  { label: "Mon profil", href: `${EMP_BASE}/profile`, icon: User },
];

export default function EmployeeSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isTablet, isDesktop } = usePortalBreakpoint();
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    typeof window !== "undefined" && window.innerWidth < 1280
  );
  const { badges: sectionBadges } = useEmployeeSectionBadges();
  const { data: hubUnread = 0 } = useHubUnreadCount();

  useEffect(() => {
    if (isTablet) setCollapsed(true);
    else if (isDesktop) setCollapsed(false);
  }, [isTablet, isDesktop]);

  const isActive = (href: string) =>
    location.pathname === href || location.pathname.startsWith(href + "/");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/nivra-secure-hub-2617-internal/login", { replace: true });
  };

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r border-border bg-card transition-all duration-200 shrink-0",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Logo */}
      <div className="h-12 flex items-center justify-between px-2.5 border-b border-border">
        {!collapsed ? (
          <Link to="/employee/dashboard" className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center shrink-0">
              <Briefcase className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <span className="font-bold text-[11px] text-foreground tracking-tight block">NIVRA</span>
              <span className="text-[9px] text-muted-foreground font-medium tracking-widest">ONEVIEW CS</span>
            </div>
          </Link>
        ) : (
          <div className="mx-auto h-7 w-7 rounded-md bg-primary flex items-center justify-center">
            <Briefcase className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </div>

      <ScrollArea className="flex-1 py-1">
        <nav className="px-1.5">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-1">
              {!collapsed && (
                <div className="px-2 pt-3 pb-1 flex items-center justify-between">
                  <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-[0.15em]">
                    {group.label}
                  </span>
                  {sectionBadges[group.label]?.show && (
                    <SectionBadge
                      show
                      variant={sectionBadges[group.label]?.urgent ? "dot-pulse" : "dot"}
                      ariaLabel={`${group.label} nécessite votre attention`}
                    />
                  )}
                </div>
              )}
              {collapsed && sectionBadges[group.label]?.show && (
                <div className="flex justify-center pt-2">
                  <SectionBadge
                    show
                    variant={sectionBadges[group.label]?.urgent ? "dot-pulse" : "dot"}
                    ariaLabel={`${group.label} nécessite votre attention`}
                  />
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                      isActive(item.href)
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                    )}
                  >
                    <item.icon className={cn("h-3.5 w-3.5 shrink-0", isActive(item.href) && "text-primary")} />
                    {!collapsed && <span className="flex-1">{item.label}</span>}
                    {!collapsed && (item as any).badgeKey === "hub" && hubUnread > 0 && (
                      <span className="rounded-full bg-violet-600 text-white px-1.5 py-0.5 text-[9px] font-bold min-w-[18px] text-center">
                        {hubUnread > 99 ? "99+" : hubUnread}
                      </span>
                    )}
                    {!collapsed && (item as any).badge && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-semibold text-primary">{(item as any).badge}</span>}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className="border-t border-border py-1.5 px-1.5 space-y-0.5">
        {bottomItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium transition-colors",
              isActive(item.href)
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            )}
          >
            <item.icon className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span className="flex-1">{item.label}</span>}
                    {!collapsed && (item as any).badge && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[8px] font-semibold text-primary">{(item as any).badge}</span>}
          </Link>
        ))}
        <button
          onClick={() => navigate('/nivra-secure-hub-2617-internal')}
          title={collapsed ? "Changer de portail" : undefined}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors border-t border-border pt-2 mt-2"
        >
          <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
          {!collapsed && <span>Changer de portail</span>}
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </aside>
  );
}
