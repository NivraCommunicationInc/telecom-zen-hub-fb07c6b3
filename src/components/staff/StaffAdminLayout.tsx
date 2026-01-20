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
  Loader2
} from "lucide-react";
import { SystemStatusBanner, SystemStatusIndicator } from "@/components/SystemStatusBanner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/ui/notification-bell";
import { GlobalSearchTrigger } from "@/components/admin/GlobalSearch";
import { OnlineUsersIndicator } from "@/components/admin/OnlineUsersIndicator";
import { usePresence } from "@/hooks/usePresence";
import { toast } from "sonner";
import StaffBackground from "@/components/staff/StaffBackground";

interface StaffAdminLayoutProps {
  children: ReactNode;
}

// Same nav items as AdminLayout, but with /staff/admin prefix
const navItems = [
  { icon: LayoutDashboard, label: "Tableau de bord", href: "/staff/admin" },
  { icon: Package, label: "Commandes", href: "/staff/admin/orders" },
  { icon: Users, label: "Clients", href: "/staff/admin/clients" },
  { icon: Building2, label: "Comptes", href: "/staff/admin/accounts" },
  { icon: Settings, label: "Services", href: "/staff/admin/services" },
  { icon: Tv, label: "Chaînes TV", href: "/staff/admin/channels" },
  { icon: Film, label: "Streaming+", href: "/staff/admin/streaming" },
  { icon: CreditCard, label: "Facturation", href: "/staff/admin/billing" },
  { icon: CreditCard, label: "Facturation V2", href: "/staff/admin/billing-v2" },
  { icon: AlertTriangle, label: "Recouvrement", href: "/staff/admin/recouvrement" },
  { icon: Ticket, label: "Promotions", href: "/staff/admin/promotions" },
  { icon: Trophy, label: "Concours", href: "/staff/admin/concours" },
  { icon: Users, label: "Programme Parrainage", href: "/staff/admin/referrals" },
  { icon: FileText, label: "Conditions Partenaires", href: "/staff/admin/referrals/terms" },
  { icon: MessageSquare, label: "Demandes", href: "/staff/admin/requests" },
  { icon: Ticket, label: "Tickets clients", href: "/staff/admin/tickets" },
  { icon: MessageSquare, label: "Tickets internes", href: "/staff/admin/internal-tickets" },
  { icon: Mail, label: "Formulaire Web", href: "/staff/admin/formulaire-web" },
  { icon: Headphones, label: "Téléphonie (OpenPhone)", href: "/staff/admin/telephony" },
  { icon: Megaphone, label: "Marketing Email", href: "/staff/admin/marketing" },
  { icon: Send, label: "Communication Email", href: "/staff/admin/communication-email" },
  { icon: MessageSquare, label: "Communication SMS", href: "/staff/admin/communication-sms" },
  { icon: FileText, label: "Contrats", href: "/staff/admin/contracts" },
  { icon: Calendar, label: "Rendez-vous", href: "/staff/admin/appointments" },
  { icon: Briefcase, label: "Carrières", href: "/staff/admin/careers" },
  { icon: UserPlus, label: "Candidatures", href: "/staff/admin/applications" },
  { icon: Activity, label: "Activité", href: "/staff/admin/activity" },
  { icon: Radio, label: "🔴 Activité en direct", href: "/staff/admin/live-activity" },
  { icon: Radio, label: "Statut Système", href: "/staff/admin/system-status" },
  { icon: Wrench, label: "Maintenance", href: "/staff/admin/maintenance" },
  { icon: Mail, label: "Emails", href: "/staff/admin/email-activity" },
  { icon: ExternalLink, label: "Gestion du Site", href: "/staff/admin/site" },
  { icon: Settings, label: "Mon compte", href: "/staff/admin/account" },
  { icon: Users, label: "Utilisateurs & Accès", href: "/staff/admin/users-access" },
  { icon: History, label: "Journal d'audit", href: "/staff/admin/audit-log" },
  { icon: Shield, label: "Événements sécurité", href: "/staff/admin/security-events" },
  { icon: Shield, label: "Security Guardian", href: "/staff/admin/security-guardian" },
];

/**
 * StaffAdminLayout - Full admin layout for staff portal
 * 
 * This is essentially the same as AdminLayout but:
 * 1. Uses staff auth (has_staff_role) instead of admin auth
 * 2. Routes use /staff/admin/* prefix
 * 3. Logout redirects to /staff instead of /admin/login
 */
const StaffAdminLayout = ({ children }: StaffAdminLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const { updateCurrentPage } = usePresence();

  // Check auth on mount
  useEffect(() => {
    let mounted = true;

    const checkAccess = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          if (mounted) navigate("/staff", { replace: true });
          return;
        }

        // Check if user has admin staff role
        const { data: hasRole } = await supabase.rpc("has_staff_role", {
          _user_id: session.user.id,
          _role: "admin",
        });

        if (!hasRole) {
          if (mounted) navigate("/staff", { replace: true });
          return;
        }

        if (mounted) {
          setUser(session.user);
          setIsAuthorized(true);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("[StaffAdminLayout] Access check failed:", error);
        if (mounted) navigate("/staff", { replace: true });
      }
    };

    checkAccess();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        if (event === "SIGNED_OUT" || !session) {
          navigate("/staff", { replace: true });
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  // Track current page for presence
  useEffect(() => {
    updateCurrentPage(location.pathname);
  }, [location.pathname, updateCurrentPage]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnexion réussie");
    navigate("/staff", { replace: true });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <StaffBackground />
        <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col relative">
      <StaffBackground />
      
      {/* System Status Banner */}
      <SystemStatusBanner userType="admin" />
      
      <div className="flex-1 flex relative z-10">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 bg-slate-900/70 backdrop-blur-xl border-r border-slate-700/50">
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex items-center justify-between">
              <Link to="/staff/admin" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-teal-500/25">
                  <span className="text-slate-900 font-bold text-lg">N</span>
                </div>
                <span className="font-bold text-xl text-white">Nivra Staff</span>
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
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                  location.pathname === item.href
                    ? "bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-teal-400 border border-teal-500/30"
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                )}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-700/50 space-y-3">
            <div className="px-4 mb-2">
              <SystemStatusIndicator />
            </div>
            <div className="px-4 py-3 rounded-xl bg-slate-800/50">
              <p className="text-xs text-slate-500">Connecté en tant que</p>
              <p className="text-sm font-medium text-white truncate">{user?.email}</p>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-xl"
              onClick={handleSignOut}
            >
              <LogOut className="w-5 h-5" />
              Déconnexion
            </Button>
          </div>
        </aside>

        {/* Mobile Header */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-xl border-b border-slate-700/50">
          <div className="flex items-center justify-between p-4">
            <Link to="/staff/admin" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-teal-500/25">
                <span className="text-slate-900 font-bold text-lg">N</span>
              </div>
              <span className="font-bold text-xl text-white">Nivra Staff</span>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-white hover:bg-slate-800/50"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="absolute top-full left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/50 p-4 space-y-1 max-h-[70vh] overflow-y-auto">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                    location.pathname === item.href
                      ? "bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-teal-400 border border-teal-500/30"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              ))}
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-slate-800/50 mt-4 rounded-xl"
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
          <div className="bg-slate-900/40 backdrop-blur-sm rounded-2xl border border-slate-700/30 p-6 min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default StaffAdminLayout;
