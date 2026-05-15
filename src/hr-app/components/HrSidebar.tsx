/**
 * HrSidebar — Navigation for the Nivra HR employee portal.
 * Clean professional design with indigo/violet accent.
 */
import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard, FileText, Receipt, Mail, Clock,
  DollarSign, Bell, User, LogOut, ChevronLeft, ChevronRight,
  Briefcase, Target, Inbox, Upload, LayoutGrid,
} from "lucide-react";
import { useHubUnreadCount } from "@/hooks/useHubUnreadCount";
import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePortalBreakpoint } from "@/hooks/usePortalBreakpoint";

const HR_BASE = "/hr";

const navGroups = [
  {
    label: "Mon dossier",
    items: [
      { label: "Tableau de bord", href: `${HR_BASE}/dashboard`, icon: LayoutDashboard },
      { label: "Mon profil", href: `${HR_BASE}/profil`, icon: User },
    ],
  },
  {
    label: "Rémunération",
    items: [
      { label: "Fiches de paie", href: `${HR_BASE}/paie`, icon: Receipt },
      { label: "Commissions", href: `${HR_BASE}/commissions`, icon: DollarSign },
      { label: "Objectifs", href: `${HR_BASE}/objectifs`, icon: Target },
    ],
  },
  {
    label: "Documents",
    items: [
      { label: "Documents fiscaux", href: `${HR_BASE}/documents-fiscaux`, icon: FileText },
      { label: "Mes documents RH", href: `${HR_BASE}/documents`, icon: Upload },
      { label: "Lettres d'emploi", href: `${HR_BASE}/lettres`, icon: Mail },
    ],
  },
  {
    label: "Temps",
    items: [
      { label: "Horaire & Punch", href: `${HR_BASE}/horaire`, icon: Clock },
    ],
  },
  {
    label: "Demandes",
    items: [
      { label: "Mes demandes", href: `${HR_BASE}/demandes`, icon: Inbox },
    ],
  },
  {
    label: "Communication",
    items: [
      { label: "Notifications RH", href: `${HR_BASE}/notifications`, icon: Bell },
    ],
  },
  {
    label: "Nivra Source",
    items: [
      { label: "Nivra Source", href: `${HR_BASE}/hub`, icon: LayoutGrid, badgeKey: "hub" as const },
    ],
  },
];

export default function HrSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isTablet, isDesktop } = usePortalBreakpoint();
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    typeof window !== "undefined" && window.innerWidth < 1280
  );

  // Auto-adjust on viewport changes (rotation, resize)
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
    <>
      {/* Tablet & desktop sidebar (collapsible on tablet) */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-border bg-card transition-all duration-200 shrink-0",
          collapsed ? "w-14" : "w-56"
        )}
      >
        {/* Logo */}
        <div className="h-12 flex items-center justify-between px-2.5 border-b border-border">
          {!collapsed ? (
            <Link to={`${HR_BASE}/dashboard`} className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-violet-600 flex items-center justify-center shrink-0">
                <Briefcase className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="leading-tight">
                <span className="font-bold text-[11px] text-foreground tracking-tight block">NIVRA</span>
                <span className="text-[9px] text-muted-foreground font-medium tracking-widest">RH</span>
              </div>
            </Link>
          ) : (
            <div className="mx-auto h-7 w-7 rounded-md bg-violet-600 flex items-center justify-center">
              <Briefcase className="h-3.5 w-3.5 text-white" />
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
                  <div className="px-2 pt-3 pb-1">
                    <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-[0.15em]">
                      {group.label}
                    </span>
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
                          ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                      )}
                    >
                      <item.icon className={cn("h-3.5 w-3.5 shrink-0", isActive(item.href) && "text-violet-600 dark:text-violet-400")} />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>

        <div className="border-t border-border py-1.5 px-1.5 space-y-0.5">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card px-1 py-1 safe-bottom">
        <div className="flex items-center justify-around">
          {[
            { href: `${HR_BASE}/dashboard`, icon: LayoutDashboard, label: "Accueil" },
            { href: `${HR_BASE}/paie`, icon: Receipt, label: "Paie" },
            { href: `${HR_BASE}/documents-fiscaux`, icon: FileText, label: "Fiscaux" },
            { href: `${HR_BASE}/horaire`, icon: Clock, label: "Horaire" },
            { href: `${HR_BASE}/profil`, icon: User, label: "Profil" },
          ].map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-lg text-[10px] font-medium transition-colors",
                isActive(item.href) ? "text-violet-600" : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="truncate max-w-[56px]">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
