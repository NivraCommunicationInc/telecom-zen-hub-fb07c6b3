/**
 * EmployeeSidebar — Production-grade telecom sidebar.
 * Dense, collapsible, grouped navigation.
 */
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, ListTodo, ShoppingCart, Users, CreditCard,
  ShieldCheck, Zap, Headphones, ScrollText, User, LogOut,
  Briefcase, ChevronLeft, ChevronRight, Calendar, FileText,
  Package, Settings, UserCheck,
} from "lucide-react";
import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePortalBreakpoint } from "@/hooks/usePortalBreakpoint";
import { useEmployeeSectionBadges } from "@/hooks/useEmployeeSectionBadges";
import { SectionBadge } from "@/components/ui/section-badge";

const EMP_BASE = "/employee";

const navGroups = [
  {
    label: "Opérations",
    items: [
      { label: "Tableau de bord", href: `${EMP_BASE}/dashboard`, icon: LayoutDashboard },
      { label: "File de travail", href: `${EMP_BASE}/work-queue`, icon: ListTodo },
      { label: "Activations", href: `${EMP_BASE}/activations`, icon: Zap },
    ],
  },
  {
    label: "Ventes",
    items: [
      { label: "Soumissions", href: `${EMP_BASE}/quotes`, icon: FileText },
    ],
  },
  {
    label: "Service client",
    items: [
      { label: "Clients", href: `${EMP_BASE}/clients`, icon: Users },
      { label: "Comptes", href: `${EMP_BASE}/accounts`, icon: Briefcase },
      { label: "Commandes", href: `${EMP_BASE}/orders`, icon: ShoppingCart },
      { label: "Paiements", href: `${EMP_BASE}/payments`, icon: CreditCard },
      { label: "Support", href: `${EMP_BASE}/support`, icon: Headphones },
    ],
  },
  {
    label: "Planification",
    items: [
      { label: "Rendez-vous", href: `${EMP_BASE}/appointments`, icon: Calendar },
      { label: "Équipement", href: `${EMP_BASE}/equipment`, icon: Package },
    ],
  },
  {
    label: "Vérification",
    items: [
      { label: "KYC", href: `${EMP_BASE}/kyc`, icon: ShieldCheck },
      { label: "Audit", href: `${EMP_BASE}/audit`, icon: ScrollText },
    ],
  },
];

const bottomItems = [
  { label: "Mon dossier RH", href: "/rh", icon: UserCheck },
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

  useEffect(() => {
    if (isTablet) setCollapsed(true);
    else if (isDesktop) setCollapsed(false);
  }, [isTablet, isDesktop]);

  const isActive = (href: string) =>
    location.pathname === href || location.pathname.startsWith(href + "/");

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/hub/login", { replace: true });
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
              <span className="text-[9px] text-muted-foreground font-medium tracking-widest">EMPLOYEE</span>
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
                    {!collapsed && <span>{item.label}</span>}
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
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
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
