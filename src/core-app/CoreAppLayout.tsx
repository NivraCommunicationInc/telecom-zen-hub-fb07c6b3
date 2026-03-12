/**
 * CoreAppLayout — Nivra Core internal operations console shell.
 * Dark ops-grade layout with grouped sidebar navigation matching old admin structure.
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
  DollarSign, AlertTriangle, Gavel, Film, Megaphone, Trophy, Send,
  Handshake, Briefcase, UserPlus, Bell, Wrench, Mail, ExternalLink,
  History, HardDrive, Ticket, Search, X, ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
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
      { icon: LayoutDashboard, label: "Tableau de bord", href: "/dashboard" },
      { icon: Activity, label: "Activité", href: "/activity" },
      { icon: Radio, label: "Activité en direct", href: "/live-activity" },
      { icon: Radio, label: "Statut système", href: "/system-status" },
    ],
  },
  {
    id: "operations",
    label: "Opérations",
    icon: ShoppingCart,
    items: [
      { icon: Activity, label: "File de travail", href: "/work-queue" },
      { icon: Package, label: "Commandes", href: "/orders" },
      { icon: Receipt, label: "POS", href: "/pos" },
      { icon: Shield, label: "KYC", href: "/kyc" },
      { icon: Calendar, label: "Rendez-vous", href: "/appointments" },
      { icon: MessageSquare, label: "Demandes", href: "/requests" },
    ],
  },
  {
    id: "clients",
    label: "Clients",
    icon: Users,
    items: [
      { icon: Users, label: "Clients", href: "/clients" },
      { icon: UserCircle, label: "Comptes", href: "/accounts" },
      { icon: Upload, label: "Documents", href: "/documents" },
    ],
  },
  {
    id: "billing",
    label: "Facturation",
    icon: CreditCard,
    items: [
      { icon: CreditCard, label: "Facturation", href: "/billing" },
      { icon: FileText, label: "Factures", href: "/invoices" },
      { icon: DollarSign, label: "Paiements", href: "/payments" },
      { icon: RefreshCcw, label: "Abonnements", href: "/subscriptions" },
      { icon: FileText, label: "Templates PDF", href: "/pdf-templates" },
      { icon: AlertTriangle, label: "Recouvrement", href: "/recouvrement" },
      { icon: Gavel, label: "Contestations", href: "/contested-payments" },
      { icon: FileText, label: "Factures contestées", href: "/contested-invoices" },
    ],
  },
  {
    id: "catalogue",
    label: "Catalogue",
    icon: Settings,
    items: [
      { icon: Settings, label: "Services", href: "/services" },
      { icon: Tv, label: "Chaînes TV", href: "/channels" },
      { icon: Film, label: "Streaming+", href: "/streaming" },
      { icon: FileText, label: "Contrats", href: "/contracts" },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    items: [
      { icon: Tag, label: "Promotions", href: "/promotions" },
      { icon: Trophy, label: "Concours", href: "/contests" },
      { icon: Megaphone, label: "Email marketing", href: "/email-marketing" },
      { icon: Send, label: "Email comm.", href: "/communication-email" },
      { icon: MessageSquare, label: "SMS", href: "/communication-sms" },
    ],
  },
  {
    id: "partners",
    label: "Partenaires",
    icon: Handshake,
    items: [
      { icon: Users, label: "Parrainage", href: "/referrals" },
      { icon: FileText, label: "Conditions", href: "/referral-terms" },
    ],
  },
  {
    id: "support",
    label: "Support",
    icon: Headphones,
    items: [
      { icon: Ticket, label: "Tickets clients", href: "/support" },
      { icon: MessageSquare, label: "Tickets internes", href: "/internal-tickets" },
      { icon: Mail, label: "Formulaire web", href: "/web-forms" },
      { icon: Headphones, label: "Téléphonie", href: "/telephony" },
    ],
  },
  {
    id: "hr",
    label: "RH",
    icon: Briefcase,
    items: [
      { icon: Briefcase, label: "Carrières", href: "/careers" },
      { icon: UserPlus, label: "Candidatures", href: "/applications" },
    ],
  },
  {
    id: "system",
    label: "Système",
    icon: HardDrive,
    items: [
      { icon: Bell, label: "Notifications", href: "/notifications" },
      { icon: Wrench, label: "Maintenance", href: "/maintenance" },
      { icon: Mail, label: "Emails", href: "/email-activity" },
      { icon: ExternalLink, label: "Site", href: "/site-settings" },
      { icon: Users, label: "Utilisateurs", href: "/users-access" },
      { icon: History, label: "Audit", href: "/audit-log" },
      { icon: Shield, label: "Sécurité", href: "/security-events" },
      { icon: Shield, label: "Guardian", href: "/security-guardian" },
      { icon: Activity, label: "System Audit", href: "/system-audit" },
      { icon: Settings, label: "Personnel", href: "/staff" },
      { icon: Settings, label: "Mon compte", href: "/my-account" },
    ],
  },
];

const STORAGE_KEY = "core_sidebar_groups_state";

const CoreAppLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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
    for (const group of NAV_GROUPS) {
      if (group.items.some((item) => isCorePathActive(location.pathname, item.href))) {
        if (!openGroups[group.id]) {
          setOpenGroups((prev) => ({ ...prev, [group.id]: true }));
        }
        break;
      }
    }
  }, [location.pathname]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return NAV_GROUPS;
    const q = searchQuery.toLowerCase().trim();
    return NAV_GROUPS
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
  }, [searchQuery]);

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
    <div className="core-console min-h-screen flex bg-[hsl(220,20%,8%)] text-[hsl(var(--core-text-primary))]">
      {/* ═══ SIDEBAR ═══ */}
      <aside
        className={cn(
          "flex flex-col shrink-0 border-r border-[hsl(220,15%,16%)] bg-[hsl(220,20%,10%)] transition-all duration-200",
          collapsed ? "w-14" : "w-[220px]"
        )}
      >
        {/* Brand */}
        <div className="h-12 flex items-center gap-2 px-3 border-b border-[hsl(220,15%,16%)]">
          <div className="h-7 w-7 rounded-md bg-emerald-600 flex items-center justify-center shrink-0">
            <Terminal className="h-3.5 w-3.5 text-white" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm tracking-tight text-white whitespace-nowrap">
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
                className="pl-8 h-7 text-xs bg-[hsl(220,15%,14%)] border-[hsl(220,15%,20%)] text-[hsl(var(--core-text-primary))] placeholder:text-[hsl(var(--core-text-label))]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[hsl(var(--core-text-label))] hover:text-[hsl(var(--core-text-primary))]"
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
            NAV_GROUPS.map((group) => (
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
                    ? "bg-emerald-600/15 text-emerald-400"
                    : "text-[hsl(var(--core-text-secondary))] hover:bg-[hsl(220,15%,14%)] hover:text-[hsl(var(--core-text-primary))]"
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
                          ? "text-emerald-400"
                          : "text-[hsl(var(--core-text-label))] hover:text-[hsl(var(--core-text-primary))] hover:bg-[hsl(220,15%,14%)]"
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
                      <div className="ml-3.5 pl-2.5 border-l border-[hsl(220,15%,18%)] space-y-0.5 py-0.5">
                        {group.items.map((item) => {
                          const active = isActive(item.href);
                          return (
                            <Link
                              key={item.href}
                              to={corePath(item.href)}
                              className={cn(
                                "flex items-center gap-2 px-2.5 py-[5px] rounded-md text-[12px] transition-colors",
                                active
                                  ? "bg-emerald-600/20 text-emerald-400 font-medium"
                                  : "text-[hsl(var(--core-text-secondary))] hover:text-[hsl(var(--core-text-primary))] hover:bg-[hsl(220,15%,14%)]"
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
        <div className="border-t border-[hsl(220,15%,16%)] p-1.5">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center py-1.5 rounded-md text-[hsl(var(--core-text-label))] hover:text-[hsl(var(--core-text-primary))] hover:bg-[hsl(220,15%,14%)] transition-colors"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* ═══ MAIN AREA ═══ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-40 h-12 flex items-center justify-between px-4 border-b border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)]/95 backdrop-blur">
          <span className="text-xs font-medium text-[hsl(var(--core-text-label))] uppercase tracking-wider">
            Internal Operations Console
          </span>
          <div className="flex items-center gap-3">
            <CoreGlobalSearch />
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-600/10 px-2 py-0.5 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Core Online
            </span>
            <button
              onClick={handleLogout}
              title="Déconnexion"
              className="p-1.5 rounded-md text-[hsl(var(--core-text-label))] hover:text-red-400 hover:bg-red-500/10 transition-colors"
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
