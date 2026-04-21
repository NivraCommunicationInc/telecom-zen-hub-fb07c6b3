import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, Package, Users, Settings, CreditCard, MessageSquare,
  FileText, Activity, Calendar, Briefcase, UserPlus, Ticket, Tv, Wrench,
  ExternalLink, Building2, Film, Radio, Mail, History, AlertTriangle,
  Shield, Trophy, Headphones, Megaphone, Send, Upload, ChevronRight,
  ShoppingCart, Handshake, LifeBuoy,
  HardDrive, Bell, DollarSign, LucideIcon, Gavel
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDisputeCounts } from "@/hooks/useDisputeCounts";
import { useAdminSectionBadges } from "@/hooks/admin/useAdminSectionBadges";
import { SectionBadge } from "@/components/ui/section-badge";

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

const navGroups: NavGroup[] = [
  {
    id: "overview",
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { icon: LayoutDashboard, label: "Tableau de bord", href: "/admin" },
      { icon: Activity, label: "Activité", href: "/admin/activity" },
      { icon: Radio, label: "Activité en direct", href: "/admin/live-activity" },
      { icon: Radio, label: "Statut système", href: "/admin/system-status" },
    ],
  },
  {
    id: "operations",
    label: "Opérations",
    icon: ShoppingCart,
    items: [
      { icon: Activity, label: "File de travail", href: "/admin/work-queue" },
      { icon: Package, label: "Commandes", href: "/admin/orders" },
      { icon: ShoppingCart, label: "POS", href: "/admin/pos" },
      { icon: Shield, label: "KYC", href: "/admin/kyc-verifications" },
      { icon: Calendar, label: "Rendez-vous", href: "/admin/appointments" },
      { icon: MessageSquare, label: "Demandes", href: "/admin/requests" },
    ],
  },
  {
    id: "clients",
    label: "Clients",
    icon: Users,
    items: [
      { icon: Users, label: "Clients", href: "/admin/clients" },
      { icon: Building2, label: "Comptes", href: "/admin/accounts" },
      { icon: Upload, label: "Documents", href: "/admin/document-requests" },
    ],
  },
  {
    id: "billing",
    label: "Facturation",
    icon: CreditCard,
    items: [
      { icon: CreditCard, label: "Facturation", href: "/admin/billing" },
      { icon: FileText, label: "Factures", href: "/admin/invoices" },
      { icon: DollarSign, label: "Paiements", href: "/admin/payments" },
      { icon: Package, label: "Abonnements", href: "/admin/subscriptions" },
      { icon: FileText, label: "Templates PDF", href: "/admin/pdf-templates-v2" },
      { icon: AlertTriangle, label: "Recouvrement", href: "/admin/recouvrement" },
      { icon: Gavel, label: "Contestations", href: "/admin/contested-payments" },
      { icon: FileText, label: "Factures contestées", href: "/admin/contested-invoices" },
    ],
  },
  {
    id: "offers",
    label: "Catalogue",
    icon: Settings,
    items: [
      { icon: Settings, label: "Services", href: "/admin/services" },
      { icon: Tv, label: "Chaînes TV", href: "/admin/channels" },
      { icon: Film, label: "Streaming+", href: "/admin/streaming" },
      { icon: FileText, label: "Contrats", href: "/admin/contracts" },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    items: [
      { icon: Ticket, label: "Promotions", href: "/admin/promotions" },
      { icon: Trophy, label: "Concours", href: "/admin/concours" },
      { icon: Megaphone, label: "Email marketing", href: "/admin/marketing" },
      { icon: Send, label: "Email comm.", href: "/admin/communication-email" },
      { icon: MessageSquare, label: "SMS", href: "/admin/communication-sms" },
    ],
  },
  {
    id: "partners",
    label: "Partenaires",
    icon: Handshake,
    items: [
      { icon: Users, label: "Parrainage", href: "/admin/referrals" },
      { icon: FileText, label: "Conditions", href: "/admin/referrals/terms" },
    ],
  },
  {
    id: "support",
    label: "Support",
    icon: LifeBuoy,
    items: [
      { icon: Ticket, label: "Tickets clients", href: "/admin/tickets" },
      { icon: MessageSquare, label: "Tickets internes", href: "/admin/internal-tickets" },
      { icon: Mail, label: "Formulaire web", href: "/admin/formulaire-web" },
      { icon: Headphones, label: "Téléphonie", href: "/admin/telephony" },
    ],
  },
  {
    id: "hr",
    label: "RH",
    icon: Briefcase,
    items: [
      { icon: Briefcase, label: "Carrières", href: "/admin/careers" },
      { icon: UserPlus, label: "Candidatures", href: "/admin/applications" },
    ],
  },
  {
    id: "system",
    label: "Système",
    icon: HardDrive,
    items: [
      { icon: Bell, label: "Notifications", href: "/admin/notifications-settings" },
      { icon: Wrench, label: "Maintenance", href: "/admin/maintenance" },
      { icon: Mail, label: "Emails", href: "/admin/email-activity" },
      { icon: ExternalLink, label: "Site", href: "/admin/site" },
      { icon: Users, label: "Utilisateurs", href: "/admin/users-access" },
      { icon: History, label: "Audit", href: "/admin/audit-log" },
      { icon: Shield, label: "Sécurité", href: "/admin/security-events" },
      { icon: Shield, label: "Guardian", href: "/admin/security-guardian" },
      { icon: Activity, label: "System Audit", href: "/admin/system-audit" },
      { icon: Settings, label: "Mon compte", href: "/admin/account" },
    ],
  },
];

const STORAGE_KEY = "admin_sidebar_groups_state";

interface AdminSidebarNavProps {
  searchQuery?: string;
}

const AdminSidebarNav = ({ searchQuery = "" }: AdminSidebarNavProps) => {
  const location = useLocation();
  const { data: disputeCounts } = useDisputeCounts();
  const { badges: sectionBadges } = useAdminSectionBadges();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const getActiveGroupId = (): string | null => {
    for (const group of navGroups) {
      if (group.items.some(item => location.pathname === item.href)) {
        return group.id;
      }
    }
    return null;
  };

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return navGroups;
    const query = searchQuery.toLowerCase().trim();
    return navGroups
      .map(group => {
        const groupMatches = group.label.toLowerCase().includes(query);
        const matchingItems = group.items.filter(item =>
          item.label.toLowerCase().includes(query)
        );
        if (groupMatches) return group;
        if (matchingItems.length > 0) return { ...group, items: matchingItems };
        return null;
      })
      .filter((group): group is NavGroup => group !== null);
  }, [searchQuery]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const newOpen: Record<string, boolean> = {};
      filteredGroups.forEach(g => { newOpen[g.id] = true; });
      setOpenGroups(prev => ({ ...prev, ...newOpen }));
    }
  }, [searchQuery, filteredGroups]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      const activeGroupId = getActiveGroupId();
      if (activeGroupId && !openGroups[activeGroupId]) {
        setOpenGroups(prev => ({ ...prev, [activeGroupId]: true }));
      }
    }
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups));
  }, [openGroups]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const isItemActive = (href: string) => location.pathname === href;
  const isGroupActive = (group: NavGroup) =>
    group.items.some(item => isItemActive(item.href));

  return (
    <nav className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto admin-scrollbar">
        {filteredGroups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Aucun résultat pour « {searchQuery} »
          </div>
        ) : (
          filteredGroups.map((group) => {
            const isOpen = openGroups[group.id] ?? false;
            const hasActiveItem = isGroupActive(group);

            return (
              <Collapsible
                key={group.id}
                open={isOpen}
                onOpenChange={() => toggleGroup(group.id)}
              >
                <CollapsibleTrigger
                  className={cn(
                    "flex items-center justify-between w-full px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors",
                    hasActiveItem
                      ? "text-primary"
                      : "text-admin-text-secondary hover:text-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <group.icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{group.label}</span>
                    {sectionBadges[group.id]?.show && (
                      <SectionBadge
                        show
                        variant={sectionBadges[group.id]?.urgent ? "dot-pulse" : "dot"}
                        ariaLabel={`${group.label} nécessite votre attention`}
                      />
                    )}
                    {group.id === "billing" && disputeCounts && disputeCounts.total > 0 && (
                      <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px] font-semibold rounded-full">
                        {disputeCounts.total}
                      </Badge>
                    )}
                  </div>
                  <ChevronRight className={cn(
                    "w-3 h-3 shrink-0 transition-transform duration-200",
                    isOpen && "rotate-90"
                  )} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-3.5 pl-2.5 border-l border-sidebar-border space-y-0.5 py-0.5">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-[5px] rounded-md text-xs transition-colors",
                          isItemActive(item.href)
                            ? "bg-primary text-primary-foreground font-medium"
                            : "text-admin-text-secondary hover:text-foreground hover:bg-sidebar-accent"
                        )}
                      >
                        <item.icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })
        )}
      </div>
    </nav>
  );
};

export { navGroups };
export type { NavGroup, NavItem };
export default AdminSidebarNav;
