/**
 * CoreAppLayout — Nivra Core internal operations console shell.
 * Light modal-style layout with grouped sidebar navigation.
 */
import { useState, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { CoreGlobalSearch } from "./components/CoreGlobalSearch";
import { supabase } from "@/integrations/supabase/client";
import { corePath, isCorePathActive } from "@/core-app/lib/corePaths";
import {
  LayoutDashboard, ListTodo, ShoppingCart, Users, UserCircle,
  FileText, CreditCard, RefreshCcw, Calendar, LogOut, ChevronLeft,
  ChevronRight, Terminal, Receipt, Package, Shield, Settings, Tv,
  Boxes, Headphones, Tag, Activity, Radio, MessageSquare, MessageCircle, Upload,
  MonitorPlay, Lock, Wifi, FileX, MapPin,
  DollarSign, AlertTriangle, Gavel, Film, Megaphone, Trophy, Send, Gift,
  Handshake, Briefcase, UserPlus, Bell, Wrench, Mail, ExternalLink,
  History, HardDrive, Ticket, Search, X, ChevronDown, Zap, Smartphone, RotateCcw, Banknote, LayoutGrid, PhoneCall, GraduationCap, Brain,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import InternalThemeToggle from "@/components/internal/InternalThemeToggle";
import { useInternalTheme } from "@/hooks/useInternalTheme";
import { usePortalBreakpoint } from "@/hooks/usePortalBreakpoint";

import { useIsCoreAdmin } from "@/core-app/hooks/useIsCoreAdmin";
import {
  useCoreSectionBadges,
  markSectionAsRead,
  SECTION_TO_TYPES,
  type CoreBadgeKey,
} from "@/core-app/hooks/useCoreSectionBadges";

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  adminOnly?: boolean;
  badgeKey?: CoreBadgeKey;
}

/** Maps sidebar item hrefs to their badge counter source. */
const HREF_TO_BADGE: Record<string, CoreBadgeKey> = {
  "/orders": "orders",
  "/invoices": "invoices",
  "/payments": "payments",
  "/subscriptions": "subscriptions",
  "/support": "support",
  "/wifi-requests": "activations",
  "/notifications": "notifications",
  "/hr/careers": "careers",
  "/hr/applications": "careers",
  "/hr/interviews": "careers",
};

interface NavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
      { icon: Brain, label: "Nivra AI Console", href: "/ai-console" },
      { icon: Activity, label: "Activity", href: "/activity" },
      { icon: Radio, label: "Live Activity", href: "/live-activity" },
      { icon: HardDrive, label: "System Status", href: "/system-status" },
      { icon: Activity, label: "Analytics", href: "/analytics" },
      { icon: Activity, label: "Finance", href: "/finance" },
      { icon: FileText, label: "SOPs", href: "/sops" },
      { icon: Activity, label: "Support Metrics", href: "/support-metrics" },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    icon: FileText,
    items: [
      { icon: PhoneCall, label: "CRM Call Center", href: "/crm" },
      { icon: FileText, label: "Soumissions", href: "/quotes" },
      { icon: Tag, label: "Rabais agents", href: "/agent-discounts" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: ListTodo,
    items: [
      { icon: ListTodo, label: "Work Queue", href: "/work-queue" },
      { icon: AlertTriangle, label: "Suivi SLA", href: "/sla" },
      { icon: Package, label: "Orders", href: "/orders" },
      { icon: Receipt, label: "POS", href: "/pos" },
      { icon: Shield, label: "KYC", href: "/kyc" },
      { icon: Wifi, label: "Demandes WiFi", href: "/wifi-requests" },
      { icon: Calendar, label: "Appointments", href: "/appointments" },
      { icon: MessageSquare, label: "Requests", href: "/requests" },
      { icon: Wrench, label: "Techniciens", href: "/technician" },
      { icon: MapPin, label: "Carte techniciens", href: "/technicians/map" },
      { icon: MapPin, label: "Couverture réseau", href: "/coverage" },
      { icon: FileX, label: "Résiliations", href: "/cancellations" },
      { icon: RefreshCcw, label: "Changements forfait", href: "/plan-changes" },
      { icon: Lock, label: "Suspensions", href: "/pause-requests" },
      { icon: RefreshCcw, label: "RMA", href: "/rma" },
      { icon: RotateCcw, label: "Retours (legacy)", href: "/returns", adminOnly: true },
      { icon: Lock, label: "Comptes Fournisseur", href: "/supplier-accounts", adminOnly: true },
    ],
  },
  {
    id: "phones",
    label: "Téléphones",
    icon: Smartphone,
    items: [
      { icon: ShoppingCart, label: "Commandes téléphones", href: "/phones" },
      { icon: Boxes, label: "Inventaire téléphones", href: "/phones/inventory" },
    ],
  },
  {
    id: "customers",
    label: "Customers",
    icon: Users,
    items: [
      { icon: Users, label: "Customers", href: "/clients" },
      { icon: UserCircle, label: "Accounts", href: "/accounts" },
      { icon: Upload, label: "Documents", href: "/documents" },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    icon: CreditCard,
    items: [
      { icon: CreditCard, label: "Billing", href: "/billing" },
      { icon: FileText, label: "Invoices", href: "/invoices" },
      { icon: DollarSign, label: "Payments", href: "/payments" },
      { icon: Activity, label: "Transactions", href: "/transactions" },
      { icon: RefreshCcw, label: "Subscriptions", href: "/subscriptions" },
      { icon: FileText, label: "PDF Templates", href: "/pdf-templates" },
      { icon: AlertTriangle, label: "Collections", href: "/recouvrement" },
      { icon: Gavel, label: "Disputes", href: "/contested-payments" },
    ],
  },
  {
    id: "catalog",
    label: "Catalog",
    icon: Boxes,
    items: [
      { icon: Settings, label: "Services", href: "/services" },
      { icon: Boxes, label: "Catalog", href: "/catalog" },
      { icon: MonitorPlay, label: "TV sur mesure", href: "/tv-sur-mesure" },
      { icon: Tv, label: "TV Channels", href: "/channels" },
      { icon: Film, label: "Streaming+", href: "/streaming" },
      { icon: FileText, label: "Contracts", href: "/contracts" },
      { icon: Package, label: "Equipment", href: "/equipment" },
      { icon: Boxes, label: "Inventory", href: "/stock" },
    ],
  },
  {
    id: "support",
    label: "Support",
    icon: Headphones,
    items: [
      { icon: Ticket, label: "Customer Tickets", href: "/support" },
      { icon: MessageCircle, label: "Live Chat", href: "/support/live-chat" },
      { icon: MessageSquare, label: "Internal Tickets", href: "/internal-tickets" },
      { icon: Mail, label: "Web Forms", href: "/web-forms" },
      { icon: Headphones, label: "Telephony", href: "/telephony" },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    items: [
      { icon: LayoutDashboard, label: "Marketing Hub", href: "/marketing" },
      { icon: MessageSquare, label: "Conversations IA", href: "/marketing/conversations" },
      { icon: Zap, label: "Agent IA Config", href: "/marketing/ai-config" },
      { icon: Send, label: "Campagnes SMS", href: "/marketing/sms-campaigns" },
      { icon: Mail, label: "Campagnes Email", href: "/marketing/email-campaigns" },
      { icon: Settings, label: "Paramètres Marketing", href: "/marketing/settings" },
      { icon: Tag, label: "Promotions", href: "/promotions" },
      { icon: Trophy, label: "Concours", href: "/contests" },
      { icon: Megaphone, label: "Email Marketing", href: "/email-marketing" },
      { icon: Send, label: "Email Comm.", href: "/communication-email" },
      { icon: MessageSquare, label: "SMS Comm.", href: "/communication-sms" },
    ],
  },
  {
    id: "field",
    label: "Field Sales",
    icon: Send,
    items: [
      { icon: Users, label: "Agents terrain", href: "/field-agents" },
      { icon: Send, label: "Soumissions terrain", href: "/field-submissions" },
      { icon: DollarSign, label: "Grille de commission", href: "/commissions/grille" },
    ],
  },
  {
    id: "hr",
    label: "Nivra HR & Payroll",
    icon: Briefcase,
    items: [
      { icon: LayoutDashboard, label: "Tableau de bord HR", href: "/hr" },
      { icon: Users, label: "Employés", href: "/hr/employees" },
      { icon: UserPlus, label: "Onboarding", href: "/hr/onboarding" },
      { icon: DollarSign, label: "Paie & Salaires", href: "/hr/payroll-runs" },
      { icon: Banknote, label: "Paiements émis", href: "/hr/paiements" },
      { icon: Tag, label: "Commissions", href: "/hr/commissions" },
      { icon: Activity, label: "Temps & Punch", href: "/hr/time" },
      { icon: Calendar, label: "Horaires", href: "/hr/schedules" },
      { icon: FileText, label: "Documents HR", href: "/hr/documents" },
      { icon: FileText, label: "Docs fiscaux", href: "/hr/tax-documents" },
      { icon: MessageSquare, label: "Demandes HR", href: "/hr/requests" },
      { icon: Briefcase, label: "Recrutement (postes)", href: "/hr/careers", badgeKey: "careers" },
      { icon: UserPlus, label: "Applications / Candidatures", href: "/hr/applications", badgeKey: "careers" },
      { icon: Brain, label: "Entrevues IA", href: "/hr/interviews" },
      { icon: Mail, label: "Templates emails", href: "/hr/email-templates" },
      { icon: History, label: "Audit HR", href: "/hr/audit" },
      { icon: GraduationCap, label: "Nivra Academy", href: "/academy" },
    ],
  },
  {
    id: "hub",
    label: "Nivra Source",
    icon: Megaphone,
    items: [
      { icon: LayoutDashboard, label: "Gestion du Hub", href: "/nivra-secure-hub-2617-internal" },
      { icon: Mail, label: "Envoyer un courriel", href: "/email/compose" },
    ],
  },
  {
    id: "system",
    label: "System",
    icon: Settings,
    items: [
      { icon: Settings, label: "Settings", href: "/settings" },
      { icon: ExternalLink, label: "Site", href: "/site-settings" },
      { icon: Users, label: "Users", href: "/users-access" },
      { icon: Bell, label: "Notifications", href: "/notifications" },
      { icon: Wrench, label: "Maintenance", href: "/maintenance" },
      { icon: Shield, label: "Security", href: "/security-events" },
      { icon: Shield, label: "Guardian", href: "/security-guardian" },
      { icon: History, label: "Audit Log", href: "/audit-log" },
      { icon: Activity, label: "System Audit", href: "/system-audit" },
      { icon: Mail, label: "Email Activity", href: "/email-activity" },
      { icon: UserCircle, label: "My Account", href: "/my-account" },
    ],
  },
];

const STORAGE_KEY = "core_sidebar_groups_state";

const CoreAppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, themeClass, toggleTheme } = useInternalTheme();
  const { isAdmin, isLoading: isAdminLoading } = useIsCoreAdmin();
  const { badges } = useCoreSectionBadges();
  const { isTablet, isDesktop } = usePortalBreakpoint();
  // Document generation is now 100% server-side autonomous via the
  // process-document-jobs edge function (cron every 60s). No browser worker needed.
  const isDarkTheme = themeClass === "theme-dark";
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    typeof window !== "undefined" && window.innerWidth < 1280
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Auto-collapse on tablet, expand on desktop (handles iPad rotation)
  useEffect(() => {
    if (isTablet) setCollapsed(true);
    else if (isDesktop) setCollapsed(false);
  }, [isTablet, isDesktop]);

  // Aggregate group-level badge: sum of all child item badges
  const groupBadge = useMemo(() => {
    const map: Record<string, number> = {};
    for (const g of NAV_GROUPS) {
      let count = 0;
      for (const it of g.items) {
        const key = HREF_TO_BADGE[it.href];
        if (key) count += badges[key] ?? 0;
      }
      map[g.id] = count;
    }
    return map;
  }, [badges]);

  // Mark related notifications as read when entering a section
  useEffect(() => {
    const key = HREF_TO_BADGE[
      Object.keys(HREF_TO_BADGE).find((h) =>
        isCorePathActive(location.pathname, h),
      ) ?? ""
    ];
    if (!key) return;
    const types = SECTION_TO_TYPES[key];
    if (types.length > 0) {
      void markSectionAsRead(types);
    }
  }, [location.pathname]);

  // Filter out admin-only items for non-admins.
  // While the role query is loading, show admin-only items optimistically
  // (server-side RLS still enforces access) so they don't flash hidden.
  const visibleGroups = useMemo<NavGroup[]>(
    () =>
      NAV_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((it) => !it.adminOnly || isAdmin || isAdminLoading),
      })).filter((g) => g.items.length > 0),
    [isAdmin, isAdminLoading]
  );

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups));
  }, [openGroups]);

  // Auto-open group containing active route
  useEffect(() => {
    for (const group of visibleGroups) {
      if (group.items.some((item) => isCorePathActive(location.pathname, item.href))) {
        if (!openGroups[group.id]) {
          setOpenGroups((prev) => ({ ...prev, [group.id]: true }));
        }
        break;
      }
    }
  }, [location.pathname, visibleGroups]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return visibleGroups;
    const q = searchQuery.toLowerCase().trim();
    return visibleGroups
      .map((group) => {
        const groupMatch = group.label.toLowerCase().includes(q);
        const matchingItems = group.items.filter((item) =>
          item.label.toLowerCase().includes(q)
        );
        if (groupMatch) return group;
        if (matchingItems.length > 0) return { ...group, items: matchingItems };
        return null;
      })
      .filter((g): g is NavGroup => g !== null);
  }, [searchQuery, visibleGroups]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const newOpen: Record<string, boolean> = {};
      filteredGroups.forEach((g) => { newOpen[g.id] = true; });
      setOpenGroups((prev) => ({ ...prev, ...newOpen }));
    }
  }, [searchQuery, filteredGroups]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const isActive = (href: string) => isCorePathActive(location.pathname, href);
  const isGroupActive = (group: NavGroup) =>
    group.items.some((item) => isActive(item.href));

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate(corePath("/login"), { replace: true });
  };

  return (
    <div className={cn("internal-ui min-h-screen flex bg-background text-foreground", themeClass, isDarkTheme && "core-console")}>
      <Helmet><title>Nivra Core — Administration</title></Helmet>
      {/* ═══ SIDEBAR ═══ */}
        <aside
          className={cn(
            "flex flex-col shrink-0 border-r border-border bg-sidebar transition-all duration-200",
            collapsed ? "w-14" : "w-[220px]"
          )}
        >
        {/* Brand */}
          <div className="h-12 flex items-center gap-2 px-3 border-b border-border">
            <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center shrink-0">
              <Terminal className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          {!collapsed && (
              <span className="font-semibold text-sm tracking-tight text-foreground whitespace-nowrap">
              Nivra Core
            </span>
          )}
        </div>

        {/* Search filter */}
        {!collapsed && (
          <div className="px-2 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(var(--core-text-label))]" />
              <Input
                type="text"
                placeholder="Filtrer…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-7 text-xs bg-background border-border text-foreground placeholder:text-muted-foreground"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation groups */}
        <nav className="flex-1 overflow-y-auto py-1 px-1.5 space-y-0.5 core-scrollbar">
          {collapsed ? (
            /* Collapsed: show only group icons */
            visibleGroups.map((group) => {
              const gCount = groupBadge[group.id] ?? 0;
              return (
                <button
                  key={group.id}
                  onClick={() => {
                    setCollapsed(false);
                    setOpenGroups((prev) => ({ ...prev, [group.id]: true }));
                  }}
                  title={`${group.label}${gCount > 0 ? ` (${gCount})` : ""}`}
                  className={cn(
                    "relative w-full flex items-center justify-center py-2 rounded-md transition-colors",
                    isGroupActive(group)
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <group.icon className="h-4 w-4" />
                  {gCount > 0 && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive ring-2 ring-sidebar" />
                  )}
                </button>
              );
            })
          ) : (
            filteredGroups.length === 0 ? (
              <div className="text-center py-6 text-[hsl(var(--core-text-label))] text-xs">
                Aucun résultat
              </div>
            ) : (
              filteredGroups.map((group) => {
                const isOpen = openGroups[group.id] ?? false;
                const hasActive = isGroupActive(group);
                const gCount = groupBadge[group.id] ?? 0;
                return (
                  <div key={group.id}>
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className={cn(
                        "flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-colors",
                        hasActive
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <group.icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{group.label}</span>
                        {!isOpen && gCount > 0 && (
                          <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                        )}
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-3 h-3 shrink-0 transition-transform duration-200",
                          !isOpen && "-rotate-90"
                        )}
                      />
                    </button>
                    {isOpen && (
                      <div className="ml-3.5 pl-2.5 border-l border-border space-y-0.5 py-0.5">
                        {group.items.map((item) => {
                          const active = isActive(item.href);
                          const itemBadge =
                            HREF_TO_BADGE[item.href]
                              ? badges[HREF_TO_BADGE[item.href]] ?? 0
                              : 0;
                          return (
                            <Link
                              key={item.href}
                              to={corePath(item.href)}
                              className={cn(
                                "flex items-center justify-between gap-2 px-2.5 py-[5px] rounded-md text-[12px] transition-colors",
                                active
                                  ? "bg-primary/15 text-primary font-medium"
                                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                              )}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <item.icon className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">{item.label}</span>
                              </div>
                              {itemBadge > 0 && (
                                <span className="shrink-0 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold leading-none">
                                  {itemBadge > 99 ? "99+" : itemBadge}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )
          )}
        </nav>

        {/* Portal switcher + collapse toggle */}
        <div className="border-t border-border p-1.5 space-y-1">
          <button
            onClick={() => navigate('/nivra-secure-hub-2617-internal')}
            title={collapsed ? "Changer de portail" : undefined}
            className={cn(
              "w-full flex items-center rounded-md text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors",
              collapsed ? "justify-center py-1.5" : "gap-2 px-2 py-1.5"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span>Changer de portail</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* ═══ MAIN AREA ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-40 h-12 flex items-center justify-between px-4 border-b border-border bg-background/95 backdrop-blur">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Internal Operations Console
          </span>
          <div className="flex items-center gap-3">
            <CoreGlobalSearch />
            <InternalThemeToggle theme={theme} onToggle={toggleTheme} />
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Core Online
            </span>
            <button
              onClick={handleLogout}
              title="Déconnexion"
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default CoreAppLayout;
