import { useState, useEffect } from "react";
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
  LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
      { icon: AlertTriangle, label: "Recouvrement", href: "/admin/recouvrement" },
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
      { icon: Wrench, label: "Maintenance", href: "/admin/maintenance" },
      { icon: Mail, label: "Emails", href: "/admin/email-activity" },
      { icon: ExternalLink, label: "Gestion du Site", href: "/admin/site" },
      { icon: Users, label: "Utilisateurs & Accès", href: "/admin/users-access" },
      { icon: History, label: "Journal d'audit", href: "/admin/audit-log" },
      { icon: Shield, label: "Événements sécurité", href: "/admin/security-events" },
      { icon: Shield, label: "Security Guardian", href: "/admin/security-guardian" },
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

const AdminSidebarNav = () => {
  const location = useLocation();
  
  // Initialize open groups from localStorage or auto-open active group
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

  // Auto-open the group containing the active route
  useEffect(() => {
    const activeGroupId = getActiveGroupId();
    if (activeGroupId && !openGroups[activeGroupId]) {
      setOpenGroups(prev => ({
        ...prev,
        [activeGroupId]: true,
      }));
    }
  }, [location.pathname]);

  // Persist open groups state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups));
  }, [openGroups]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const isItemActive = (href: string) => location.pathname === href;

  const isGroupActive = (group: NavGroup) => 
    group.items.some(item => isItemActive(item.href));

  return (
    <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
      {navGroups.map((group) => {
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
                "flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group",
                hasActiveItem
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <group.icon className="w-4 h-4" />
                <span>{group.label}</span>
              </div>
              {isOpen ? (
                <ChevronDown className="w-4 h-4 transition-transform" />
              ) : (
                <ChevronRight className="w-4 h-4 transition-transform" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-4 mt-1 space-y-0.5">
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                    isItemActive(item.href)
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </nav>
  );
};

// Export for mobile menu usage
export { navGroups };
export default AdminSidebarNav;
