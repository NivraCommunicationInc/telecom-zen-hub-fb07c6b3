/**
 * CoreAppLayout — Nivra Core internal operations console shell.
 * Light modal-style layout with grouped sidebar navigation.
 */
import { useState, useEffect, useMemo } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { CoreGlobalSearch } from "./components/CoreGlobalSearch";
import { supabase } from "@/integrations/supabase/client";
import { corePath, isCorePathActive } from "@/core-app/lib/corePaths";
import {
  LayoutDashboard, ListTodo, ShoppingCart, Users, UserCircle,
  FileText, CreditCard, RefreshCcw, Calendar, LogOut, ChevronLeft,
  ChevronRight, Terminal, Receipt, Package, Shield, Settings, Tv,
  Boxes, Headphones, Tag, Activity, Radio, MessageSquare, Upload,
  MonitorPlay, Lock, Wifi,
  DollarSign, AlertTriangle, Gavel, Film, Megaphone, Trophy, Send, Gift,
  Handshake, Briefcase, UserPlus, Bell, Wrench, Mail, ExternalLink,
  History, HardDrive, Ticket, Search, X, ChevronDown, Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import InternalThemeToggle from "@/components/internal/InternalThemeToggle";
import { useInternalTheme } from "@/hooks/useInternalTheme";

import { useIsCoreAdmin } from "@/core-app/hooks/useIsCoreAdmin";

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  adminOnly?: boolean;
}

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
      { icon: Activity, label: "Activity", href: "/activity" },
      { icon: Radio, label: "Live Activity", href: "/live-activity" },
      { icon: HardDrive, label: "System Status", href: "/system-status" },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    icon: FileText,
    items: [
      { icon: FileText, label: "Soumissions", href: "/quotes" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: ListTodo,
    items: [
      { icon: ListTodo, label: "Work Queue", href: "/work-queue" },
      { icon: Package, label: "Orders", href: "/orders" },
      { icon: Receipt, label: "POS", href: "/pos" },
      { icon: Shield, label: "KYC", href: "/kyc" },
      { icon: Wifi, label: "Demandes WiFi", href: "/wifi-requests" },
      { icon: Calendar, label: "Appointments", href: "/appointments" },
      { icon: MessageSquare, label: "Requests", href: "/requests" },
      { icon: Lock, label: "Comptes Fournisseur", href: "/supplier-accounts", adminOnly: true },
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
      { icon: Tag, label: "Promotions", href: "/promotions" },
      { icon: Trophy, label: "Contests", href: "/contests" },
      { icon: Send, label: "Email", href: "/communication-email" },
      { icon: Megaphone, label: "Email Marketing", href: "/email-marketing" },
      { icon: MessageSquare, label: "SMS", href: "/communication-sms" },
    ],
  },
  {
    id: "field",
    label: "Field Sales",
    icon: Send,
    items: [
      { icon: Users, label: "Agents terrain", href: "/field-agents" },
    ],
  },
  {
    id: "hr",
    label: "HR & Payroll",
    icon: Briefcase,
    items: [
      { icon: LayoutDashboard, label: "Dashboard RH", href: "/hr" },
      { icon: Users, label: "Employés", href: "/hr/employees" },
      { icon: UserPlus, label: "Onboarding", href: "/hr/onboarding" },
      { icon: DollarSign, label: "Paie", href: "/hr/payroll" },
      { icon: Tag, label: "Commissions", href: "/hr/commissions" },
      { icon: Activity, label: "Temps & Punch", href: "/hr/time" },
      { icon: Calendar, label: "Horaires", href: "/hr/schedules" },
      { icon: FileText, label: "Documents RH", href: "/hr/documents" },
      { icon: FileText, label: "Docs fiscaux", href: "/hr/tax-documents" },
      { icon: MessageSquare, label: "Demandes RH", href: "/hr/requests" },
      { icon: Briefcase, label: "Recrutement", href: "/hr/careers" },
      { icon: History, label: "Audit RH", href: "/hr/audit" },
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
  const isDarkTheme = themeClass === "theme-dark";
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
            visibleGroups.map((group) => (
              <button
                key={group.id}
                onClick={() => {
                  setCollapsed(false);
                  setOpenGroups((prev) => ({ ...prev, [group.id]: true }));
                }}
                title={group.label}
                className={cn(
                  "w-full flex items-center justify-center py-2 rounded-md transition-colors",
                  isGroupActive(group)
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <group.icon className="h-4 w-4" />
              </button>
            ))
          ) : (
            filteredGroups.length === 0 ? (
              <div className="text-center py-6 text-[hsl(var(--core-text-label))] text-xs">
                Aucun résultat
              </div>
            ) : (
              filteredGroups.map((group) => {
                const isOpen = openGroups[group.id] ?? false;
                const hasActive = isGroupActive(group);
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
                          return (
                            <Link
                              key={item.href}
                              to={corePath(item.href)}
                              className={cn(
                                "flex items-center gap-2 px-2.5 py-[5px] rounded-md text-[12px] transition-colors",
                                active
                                  ? "bg-primary/15 text-primary font-medium"
                                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                              )}
                            >
                              <item.icon className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{item.label}</span>
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

        {/* Collapse toggle */}
        <div className="border-t border-border p-1.5">
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
