import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Settings, 
  CreditCard, 
  MessageSquare,
  FileText,
  Activity,
  Calendar,
  Briefcase,
  UserPlus,
  Ticket,
  Tv,
  Wrench,
  ExternalLink,
  Building2,
  Film,
  Radio,
  Mail,
  History,
  AlertTriangle,
  Shield,
  Trophy,
  Headphones,
  Megaphone,
  Send,
  Upload,
  ChevronDown,
  ChevronRight,
  Eye,
  ShoppingCart,
  UserCheck,
  Receipt,
  Handshake,
  LifeBuoy,
  Phone,
  HardDrive,
  User,
  Search,
  X,
  Gavel,
  Bell,
  DollarSign,
  LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useDisputeCounts } from "@/hooks/useDisputeCounts";

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
    label: "Vue d'ensemble",
    icon: Eye,
    items: [
      { icon: LayoutDashboard, label: "Tableau de bord", href: "/admin" },
      { icon: Activity, label: "Activité", href: "/admin/activity" },
      { icon: Radio, label: "🔴 Activité en direct", href: "/admin/live-activity" },
      { icon: Radio, label: "Statut Système", href: "/admin/system-status" },
    ],
  },
  {
    id: "sales",
    label: "Ventes & Commandes",
    icon: ShoppingCart,
    items: [
      { icon: Package, label: "Commandes", href: "/admin/orders" },
      { icon: Activity, label: "Queues opérationnelles", href: "/admin/queues" },
      { icon: ShoppingCart, label: "Point de Vente (POS)", href: "/admin/pos" },
      { icon: Shield, label: "Vérifications KYC", href: "/admin/kyc-verifications" },
      { icon: MessageSquare, label: "Demandes", href: "/admin/requests" },
      { icon: Calendar, label: "Rendez-vous", href: "/admin/appointments" },
    ],
  },
  {
    id: "clients",
    label: "Clients & Comptes",
    icon: UserCheck,
    items: [
      { icon: Users, label: "Clients", href: "/admin/clients" },
      { icon: Building2, label: "Comptes", href: "/admin/accounts" },
      { icon: Upload, label: "Documents clients", href: "/admin/document-requests" },
    ],
  },
  {
    id: "offers",
    label: "Offres & Services",
    icon: Settings,
    items: [
      { icon: Settings, label: "Services", href: "/admin/services" },
      { icon: Tv, label: "Chaînes TV", href: "/admin/channels" },
      { icon: Film, label: "Streaming+", href: "/admin/streaming" },
      { icon: FileText, label: "Contrats", href: "/admin/contracts" },
    ],
  },
  {
    id: "billing",
    label: "Facturation & Recouvrement",
    icon: Receipt,
    items: [
      { icon: CreditCard, label: "Facturation", href: "/admin/billing" },
      { icon: DollarSign, label: "Paiements", href: "/admin/payments" },
      { icon: FileText, label: "Templates PDF V2", href: "/admin/pdf-templates-v2" },
      { icon: AlertTriangle, label: "Recouvrement", href: "/admin/recouvrement" },
      { icon: FileText, label: "Factures contestées", href: "/admin/contested-invoices" },
      { icon: Gavel, label: "Paiements contestés", href: "/admin/contested-payments" },
    ],
  },
  {
    id: "marketing",
    label: "Marketing & Communications",
    icon: Megaphone,
    items: [
      { icon: Ticket, label: "Promotions", href: "/admin/promotions" },
      { icon: Trophy, label: "Concours", href: "/admin/concours" },
      { icon: Megaphone, label: "Marketing Email", href: "/admin/marketing" },
      { icon: Send, label: "Communication Email", href: "/admin/communication-email" },
      { icon: MessageSquare, label: "Communication SMS", href: "/admin/communication-sms" },
    ],
  },
  {
    id: "partners",
    label: "Partenaires",
    icon: Handshake,
    items: [
      { icon: Users, label: "Programme Parrainage", href: "/admin/referrals" },
      { icon: FileText, label: "Conditions Partenaires", href: "/admin/referrals/terms" },
    ],
  },
  {
    id: "support",
    label: "Support",
    icon: LifeBuoy,
    items: [
      { icon: Ticket, label: "Tickets clients", href: "/admin/tickets" },
      { icon: MessageSquare, label: "Tickets internes", href: "/admin/internal-tickets" },
      { icon: Mail, label: "Formulaire Web", href: "/admin/formulaire-web" },
    ],
  },
  {
    id: "telephony",
    label: "Téléphonie",
    icon: Phone,
    items: [
      { icon: Headphones, label: "Téléphonie (OpenPhone)", href: "/admin/telephony" },
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
    label: "Système & Administration",
    icon: HardDrive,
    items: [
      { icon: Bell, label: "Notifications", href: "/admin/notifications-settings" },
      { icon: Wrench, label: "Maintenance", href: "/admin/maintenance" },
      { icon: Mail, label: "Emails", href: "/admin/email-activity" },
      { icon: Mail, label: "Délivrabilité Emails", href: "/admin/email-deliverability" },
      { icon: ExternalLink, label: "Gestion du Site", href: "/admin/site" },
      { icon: Users, label: "Utilisateurs & Accès", href: "/admin/users-access" },
      { icon: History, label: "Journal d'audit", href: "/admin/audit-log" },
      { icon: Shield, label: "Événements sécurité", href: "/admin/security-events" },
      { icon: Shield, label: "Security Guardian", href: "/admin/security-guardian" },
      { icon: FileText, label: "QA Audit", href: "/admin/qa" },
      { icon: Activity, label: "System Audit", href: "/admin/system-audit" },
    ],
  },
  {
    id: "account",
    label: "Compte",
    icon: User,
    items: [
      { icon: Settings, label: "Mon compte", href: "/admin/account" },
    ],
  },
];

const STORAGE_KEY = "admin_sidebar_groups_state";
const ACCORDION_MODE_KEY = "admin_sidebar_accordion_mode";

interface AdminSidebarNavProps {
  searchQuery?: string;
}

const AdminSidebarNav = ({ searchQuery = "" }: AdminSidebarNavProps) => {
  const location = useLocation();
  const { data: disputeCounts } = useDisputeCounts();
  
  // Accordion mode: only one group open at a time
  const [accordionMode, setAccordionMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(ACCORDION_MODE_KEY);
      return saved === "true";
    } catch {
      return false;
    }
  });

  // Initialize open groups from localStorage
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignore parse errors
    }
    return {};
  });

  // Find which group contains the active route
  const getActiveGroupId = (): string | null => {
    for (const group of navGroups) {
      if (group.items.some(item => location.pathname === item.href)) {
        return group.id;
      }
    }
    return null;
  };

  // Filter groups and items based on search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return navGroups;
    }

    const query = searchQuery.toLowerCase().trim();
    
    return navGroups
      .map(group => {
        // Check if group label matches
        const groupMatches = group.label.toLowerCase().includes(query);
        
        // Filter items that match
        const matchingItems = group.items.filter(item =>
          item.label.toLowerCase().includes(query)
        );

        // Include group if group label matches OR has matching items
        if (groupMatches) {
          return group; // Return full group if group name matches
        } else if (matchingItems.length > 0) {
          return { ...group, items: matchingItems };
        }
        
        return null;
      })
      .filter((group): group is NavGroup => group !== null);
  }, [searchQuery]);

  // Auto-expand groups that have search matches
  useEffect(() => {
    if (searchQuery.trim()) {
      const matchingGroupIds = filteredGroups.map(g => g.id);
      const newOpenGroups: Record<string, boolean> = {};
      matchingGroupIds.forEach(id => {
        newOpenGroups[id] = true;
      });
      setOpenGroups(prev => ({
        ...prev,
        ...newOpenGroups,
      }));
    }
  }, [searchQuery, filteredGroups]);

  // Auto-open the group containing the active route
  useEffect(() => {
    if (!searchQuery.trim()) {
      const activeGroupId = getActiveGroupId();
      if (activeGroupId && !openGroups[activeGroupId]) {
        if (accordionMode) {
          // In accordion mode, close others and open only active
          setOpenGroups({ [activeGroupId]: true });
        } else {
          setOpenGroups(prev => ({
            ...prev,
            [activeGroupId]: true,
          }));
        }
      }
    }
  }, [location.pathname, accordionMode]);

  // Persist open groups state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups));
  }, [openGroups]);

  // Persist accordion mode
  useEffect(() => {
    localStorage.setItem(ACCORDION_MODE_KEY, String(accordionMode));
  }, [accordionMode]);

  const toggleGroup = (groupId: string) => {
    if (accordionMode) {
      // In accordion mode, close all others and toggle this one
      setOpenGroups(prev => ({
        [groupId]: !prev[groupId],
      }));
    } else {
      setOpenGroups(prev => ({
        ...prev,
        [groupId]: !prev[groupId],
      }));
    }
  };

  const isItemActive = (href: string) => location.pathname === href;

  const isGroupActive = (group: NavGroup) => 
    group.items.some(item => isItemActive(item.href));

  const handleAccordionModeChange = (checked: boolean) => {
    setAccordionMode(checked);
    if (checked) {
      // When enabling accordion mode, keep only the active group open
      const activeGroupId = getActiveGroupId();
      if (activeGroupId) {
        setOpenGroups({ [activeGroupId]: true });
      } else {
        setOpenGroups({});
      }
    }
  };

  return (
    <nav className="flex-1 flex flex-col overflow-hidden">
      {/* Navigation Groups */}
      <div className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto scrollbar-thin">
        {filteredGroups.length === 0 ? (
          <div className="text-center py-8 text-[hsl(220,9%,40%)] text-xs">
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
                    "flex items-center justify-between w-full px-2.5 py-2 rounded-md text-xs font-medium transition-colors",
                    hasActiveItem
                      ? "text-[hsl(168,76%,50%)]"
                      : "text-[hsl(220,9%,55%)] hover:text-[hsl(220,14%,85%)] hover:bg-[hsl(222,40%,12%)]"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <group.icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{group.label}</span>
                    {group.id === "billing" && disputeCounts && disputeCounts.total > 0 && (
                      <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px] font-medium rounded-full">
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
                  <div className="ml-4 pl-2.5 border-l border-[hsl(222,30%,16%)] space-y-0.5 py-0.5">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={cn(
                          "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs transition-colors",
                          isItemActive(item.href)
                            ? "bg-[hsl(168,76%,42%)] text-[hsl(222,47%,9%)] font-medium"
                            : "text-[hsl(220,9%,50%)] hover:text-[hsl(220,14%,85%)] hover:bg-[hsl(222,40%,12%)]"
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

// Export for mobile menu usage
export { navGroups };
export type { NavGroup, NavItem };
export default AdminSidebarNav;
