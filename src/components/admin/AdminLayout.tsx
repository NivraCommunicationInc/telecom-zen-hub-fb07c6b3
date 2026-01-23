import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Settings, 
  CreditCard, 
  LogOut,
  Menu,
  X,
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
  Upload
} from "lucide-react";
import { SystemStatusBanner, SystemStatusIndicator } from "@/components/SystemStatusBanner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/ui/notification-bell";
import { GlobalSearchTrigger } from "@/components/admin/GlobalSearch";
import { OnlineUsersIndicator } from "@/components/admin/OnlineUsersIndicator";
import { usePresence } from "@/hooks/usePresence";

interface AdminLayoutProps {
  children: ReactNode;
}

const navItems = [
  { icon: LayoutDashboard, label: "Tableau de bord", href: "/admin" },
  { icon: Package, label: "Commandes", href: "/admin/orders" },
  { icon: Users, label: "Clients", href: "/admin/clients" },
  { icon: Building2, label: "Comptes", href: "/admin/accounts" },
  { icon: Settings, label: "Services", href: "/admin/services" },
  { icon: Tv, label: "Chaînes TV", href: "/admin/channels" },
  { icon: Film, label: "Streaming+", href: "/admin/streaming" },
  { icon: CreditCard, label: "Facturation", href: "/admin/billing" },
  { icon: CreditCard, label: "Facturation V2", href: "/admin/billing-v2" },
  { icon: AlertTriangle, label: "Recouvrement", href: "/admin/recouvrement" },
  { icon: Ticket, label: "Promotions", href: "/admin/promotions" },
  { icon: Trophy, label: "Concours", href: "/admin/concours" },
  { icon: Users, label: "Programme Parrainage", href: "/admin/referrals" },
  { icon: FileText, label: "Conditions Partenaires", href: "/admin/referrals/terms" },
  { icon: MessageSquare, label: "Demandes", href: "/admin/requests" },
  { icon: Ticket, label: "Tickets clients", href: "/admin/tickets" },
  { icon: MessageSquare, label: "Tickets internes", href: "/admin/internal-tickets" },
  { icon: Mail, label: "Formulaire Web", href: "/admin/formulaire-web" },
  { icon: Headphones, label: "Téléphonie (OpenPhone)", href: "/admin/telephony" },
  { icon: Megaphone, label: "Marketing Email", href: "/admin/marketing" },
  { icon: Send, label: "Communication Email", href: "/admin/communication-email" },
  { icon: MessageSquare, label: "Communication SMS", href: "/admin/communication-sms" },
  { icon: FileText, label: "Contrats", href: "/admin/contracts" },
  { icon: Upload, label: "Documents clients", href: "/admin/document-requests" },
  { icon: Calendar, label: "Rendez-vous", href: "/admin/appointments" },
  { icon: Briefcase, label: "Carrières", href: "/admin/careers" },
  { icon: UserPlus, label: "Candidatures", href: "/admin/applications" },
  { icon: Activity, label: "Activité", href: "/admin/activity" },
  { icon: Radio, label: "🔴 Activité en direct", href: "/admin/live-activity" },
  { icon: Radio, label: "Statut Système", href: "/admin/system-status" },
  { icon: Wrench, label: "Maintenance", href: "/admin/maintenance" },
  { icon: Mail, label: "Emails", href: "/admin/email-activity" },
  { icon: ExternalLink, label: "Gestion du Site", href: "/admin/site" },
  { icon: Settings, label: "Mon compte", href: "/admin/account" },
  { icon: Users, label: "Utilisateurs & Accès", href: "/admin/users-access" },
  { icon: History, label: "Journal d'audit", href: "/admin/audit-log" },
  { icon: Shield, label: "Événements sécurité", href: "/admin/security-events" },
  { icon: Shield, label: "Security Guardian", href: "/admin/security-guardian" },
];

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { updateCurrentPage } = usePresence();

  // Track current page for presence
  useEffect(() => {
    updateCurrentPage(location.pathname);
  }, [location.pathname, updateCurrentPage]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* System Status Banner */}
      <SystemStatusBanner userType="admin" />
      
      <div className="flex-1 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-card border-r border-border">
        <div className="p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <Link to="/admin" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center">
                <span className="text-navy-900 font-bold text-sm">N</span>
              </div>
              <span className="font-display font-bold text-lg text-foreground">Nivra Admin</span>
            </Link>
            <div className="flex items-center gap-2">
              <OnlineUsersIndicator />
              <NotificationBell />
            </div>
          </div>
        </div>
        
        {/* Global Search */}
        <div className="px-4 pt-4">
          <GlobalSearchTrigger />
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                location.pathname === item.href
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-border space-y-3">
          <div className="px-4 mb-2">
            <SystemStatusIndicator />
          </div>
          <div className="px-4">
            <p className="text-xs text-muted-foreground">Connecté en tant que</p>
            <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="w-5 h-5" />
            Déconnexion
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between p-4">
          <Link to="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center">
              <span className="text-navy-900 font-bold text-sm">N</span>
            </div>
            <span className="font-display font-bold text-lg text-foreground">Nivra Admin</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-card border-b border-border p-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  location.pathname === item.href
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground mt-4"
              onClick={handleSignOut}
            >
              <LogOut className="w-5 h-5" />
              Déconnexion
            </Button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:p-8 p-4 pt-20 lg:pt-8 overflow-auto">
        {children}
      </main>
      </div>
    </div>
  );
};

export default AdminLayout;
