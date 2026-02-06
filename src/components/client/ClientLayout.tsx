/**
 * ClientLayout - Professional clean telecom client portal layout
 * Light theme with teal accents for excellent readability
 */
import { ReactNode, useCallback, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useClientAuth } from "@/hooks/useClientAuth";
import {
  LayoutDashboard,
  Calendar,
  FileText,
  CreditCard,
  MessageSquare,
  User,
  LogOut,
  Menu,
  X,
  Home,
  Package,
  ShoppingCart,
  Tv,
  ChevronRight,
  Wifi,
  Shield,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PortalSystemStatusBanner } from "@/components/client/PortalSystemStatusBanner";
import { PortalNotificationBell } from "@/components/client/PortalNotificationBell";
import AccountBlockedBanner from "@/components/client/AccountBlockedBanner";
import PrepaidUrgentBanner from "@/components/client/PrepaidUrgentBanner";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { useOverdueCount } from "@/hooks/useOverdueCount";
import { portalClient } from "@/integrations/backend/portalClient";
import { toast } from "sonner";
import ClientPortalBackground from "./ClientPortalBackground";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface ClientLayoutProps {
  children: ReactNode;
}

const mainNavItems = [
  { path: "/portal", label: "Tableau de bord", icon: LayoutDashboard },
  { path: "/portal/services", label: "Mes services", icon: Wifi },
  { path: "/portal/orders", label: "Mes commandes", icon: Package },
  { path: "/portal/invoices", label: "Facturation", icon: FileText, hasBadge: true },
];

const serviceNavItems = [
  { path: "/portal/new-order", label: "Nouvelle commande", icon: ShoppingCart },
  { path: "/portal/appointments", label: "Rendez-vous", icon: Calendar },
  { path: "/portal/channels", label: "Chaînes TV", icon: Tv },
  { path: "/portal/contracts", label: "Contrats", icon: FileText },
];

const supportNavItems = [
  { path: "/portal/tickets", label: "Support", icon: MessageSquare },
  { path: "/portal/web-forms", label: "Formulaires", icon: HelpCircle },
  { path: "/portal/payments", label: "Paiements", icon: CreditCard },
  { path: "/portal/profile", label: "Mon profil", icon: User },
];

const ClientLayout = ({ children }: ClientLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useClientAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Get overdue invoice count for badge - use portalClient for proper RLS
  const { data: overdueCount } = useOverdueCount(user?.id, portalClient);

  // Auto-logout handler for idle timeout
  const handleIdleLogout = useCallback(async () => {
    console.log("[ClientLayout] Idle timeout reached - logging out user");
    sessionStorage.removeItem("client_pin_verified");
    sessionStorage.removeItem("client_pin_pending_email");
    sessionStorage.removeItem("client_pin_pending_user_id");
    sessionStorage.removeItem("client_last_auth_check");
    
    await signOut();
    toast.info("Vous avez été déconnecté après 1 heure d'inactivité", {
      duration: 5000,
    });
    navigate("/portal/auth");
  }, [signOut, navigate]);

  // Enable idle timeout (1 hour)
  useIdleTimeout({
    onIdle: handleIdleLogout,
    timeout: 60 * 60 * 1000,
    enabled: !!user,
  });

  const handleSignOut = async () => {
    sessionStorage.removeItem("client_pin_verified");
    sessionStorage.removeItem("client_pin_pending_email");
    sessionStorage.removeItem("client_pin_pending_user_id");
    sessionStorage.removeItem("client_last_auth_check");
    await signOut();
    navigate("/");
  };

  const NavLink = ({ item, onClick }: { item: typeof mainNavItems[0]; onClick?: () => void }) => {
    const isActive = location.pathname === item.path;
    const showBadge = item.hasBadge && overdueCount && overdueCount > 0;
    
    return (
      <Link
        to={item.path}
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group relative",
          isActive
            ? "bg-gradient-to-r from-teal-500/15 via-teal-500/10 to-teal-400/5 text-teal-700 shadow-sm border border-teal-500/20"
            : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        )}
      >
        <item.icon className={cn("w-5 h-5 transition-colors", isActive ? "text-teal-600" : "group-hover:text-teal-600")} />
        <span className="flex-1 font-medium">{item.label}</span>
        {showBadge && (
          <Badge className="bg-red-500 text-white text-xs px-1.5 py-0.5 min-w-[20px] flex items-center justify-center">
            {overdueCount}
          </Badge>
        )}
        {isActive && !showBadge && <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />}
      </Link>
    );
  };

  const NavSection = ({ title, items, onClick }: { title: string; items: typeof mainNavItems; onClick?: () => void }) => (
    <div className="space-y-1">
      <p className="px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{title}</p>
      {items.map((item) => (
        <NavLink key={item.path} item={item} onClick={onClick} />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col relative client-portal-dark">
      <ClientPortalBackground />
      
      {/* System Status Banner */}
      <PortalSystemStatusBanner userType="client" />
      
      {/* Account Blocked Banner */}
      <AccountBlockedBanner />
      
      {/* Urgent Payment Banner */}
      {user?.id && <PrepaidUrgentBanner userId={user.id} />}
      
      <div className="flex-1 flex relative z-10">
        {/* Mobile Header */}
        <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-xl border-b border-slate-200 z-50 flex items-center justify-between px-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/25">
              <span className="font-display font-bold text-white text-lg">N</span>
            </div>
            <div>
              <span className="font-display font-bold text-slate-900 text-lg">Nivra</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PortalNotificationBell />
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </header>

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed top-0 left-0 h-full w-72 bg-white/98 backdrop-blur-2xl border-r border-slate-200 z-40 transform transition-transform duration-300 lg:translate-x-0 flex flex-col shadow-xl shadow-slate-900/5",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Logo Header */}
          <div className="p-5 border-b border-slate-200 hidden lg:flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/25 group-hover:shadow-teal-500/40 transition-shadow">
                <span className="font-display font-bold text-white text-xl">N</span>
              </div>
              <div>
                <span className="font-display font-bold text-xl text-slate-900 block">Nivra</span>
                <span className="text-[10px] text-teal-600 font-medium tracking-wider uppercase">Espace Client</span>
              </div>
            </Link>
            <PortalNotificationBell />
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 py-4 mt-16 lg:mt-0">
            <nav className="px-3 space-y-6">
              {/* Return to site */}
              <Link
                to="/"
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all group"
              >
                <Home className="w-5 h-5" />
                <span className="flex-1 font-medium">Retour au site</span>
                <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
              
              <Separator className="bg-slate-200" />

              <NavSection title="Principal" items={mainNavItems} onClick={() => setSidebarOpen(false)} />
              
              <Separator className="bg-slate-200" />
              
              <NavSection title="Services" items={serviceNavItems} onClick={() => setSidebarOpen(false)} />
              
              <Separator className="bg-slate-200" />
              
              <NavSection title="Compte" items={supportNavItems} onClick={() => setSidebarOpen(false)} />
            </nav>
          </ScrollArea>

          {/* User Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/80">
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-teal-500/20 to-teal-400/10 border border-teal-500/30 flex items-center justify-center">
                <User className="w-5 h-5 text-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Client"}
                </p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start border-slate-300 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-400"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </aside>

        {/* Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 lg:ml-72 min-h-screen pt-16 lg:pt-0 overflow-x-hidden">
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ClientLayout;
