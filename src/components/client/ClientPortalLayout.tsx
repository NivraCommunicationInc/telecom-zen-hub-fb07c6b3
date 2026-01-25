/**
 * ClientPortalLayout - Professional telecom ISP layout for client portal
 * Navy/slate dark theme with cyan accents
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
  Phone,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PortalSystemStatusBanner } from "@/components/client/PortalSystemStatusBanner";
import { PortalNotificationBell } from "@/components/client/PortalNotificationBell";
import AccountBlockedBanner from "@/components/client/AccountBlockedBanner";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { toast } from "sonner";
import ClientPortalBackground from "./ClientPortalBackground";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ClientPortalLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: "/portal", label: "Tableau de bord", icon: LayoutDashboard },
  { path: "/portal/appointments", label: "Rendez-vous", icon: Calendar },
  { path: "/portal/new-order", label: "Nouvelle commande", icon: ShoppingCart },
  { path: "/portal/orders", label: "Mes commandes", icon: Package },
  { path: "/portal/services", label: "Mes services", icon: Wifi },
  { path: "/portal/channels", label: "Chaînes TV", icon: Tv },
  { path: "/portal/invoices", label: "Factures", icon: FileText },
  { path: "/portal/contracts", label: "Contrats", icon: FileText },
  { path: "/portal/tickets", label: "Support", icon: MessageSquare },
  { path: "/portal/web-forms", label: "Formulaires", icon: MessageSquare },
  { path: "/portal/profile", label: "Mon profil", icon: User },
  { path: "/portal/payments", label: "Paiements", icon: CreditCard },
];

const ClientPortalLayout = ({ children }: ClientPortalLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useClientAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auto-logout handler for idle timeout
  const handleIdleLogout = useCallback(async () => {
    console.log("[ClientPortalLayout] Idle timeout reached - logging out user");
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

  return (
    <div className="min-h-screen flex flex-col relative">
      <ClientPortalBackground />
      
      {/* System Status Banner */}
      <PortalSystemStatusBanner userType="client" />
      
      {/* Account Blocked Banner */}
      <AccountBlockedBanner />
      
      <div className="flex-1 flex relative z-10">
        {/* Mobile Header */}
        <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800 z-50 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <span className="font-display font-bold text-slate-900 text-lg">N</span>
            </div>
            <span className="font-display font-bold text-white text-lg">Nivra</span>
          </div>
          <div className="flex items-center gap-2">
            <PortalNotificationBell />
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-slate-300 hover:text-white hover:bg-slate-800"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </header>

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed top-0 left-0 h-full w-72 bg-slate-900/95 backdrop-blur-xl border-r border-slate-800 z-40 transform transition-transform duration-300 lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Logo */}
          <div className="p-5 border-b border-slate-800 hidden lg:flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <span className="font-display font-bold text-slate-900 text-xl">N</span>
              </div>
              <div>
                <span className="font-display font-bold text-xl text-white block">Nivra</span>
                <span className="text-xs text-slate-500">Espace Client</span>
              </div>
            </Link>
            <PortalNotificationBell />
          </div>

          {/* Navigation */}
          <ScrollArea className="h-[calc(100vh-180px)] mt-16 lg:mt-0">
            <nav className="p-4 space-y-1">
              <Link
                to="/"
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all group"
              >
                <Home className="w-5 h-5" />
                <span className="flex-1">Retour au site</span>
                <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
              
              <div className="h-px bg-slate-800 my-4" />
              <p className="px-4 text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Navigation</p>

              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all group",
                      isActive
                        ? "bg-gradient-to-r from-cyan-500/20 to-teal-500/10 text-cyan-400 border border-cyan-500/30"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                    )}
                  >
                    <item.icon className={cn("w-5 h-5", isActive ? "text-cyan-400" : "")} />
                    <span className="flex-1">{item.label}</span>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
                  </Link>
                );
              })}
            </nav>
          </ScrollArea>

          {/* User Section */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800 bg-slate-900/95 backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-cyan-500/20 to-teal-500/10 border border-cyan-500/30 flex items-center justify-center">
                <User className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Client"}
                </p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
              <Shield className="w-4 h-4 text-emerald-500" />
            </div>
            <Button
              variant="outline"
              className="w-full justify-start border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 hover:border-slate-600"
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
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 lg:ml-72 min-h-screen pt-16 lg:pt-0">
          <div className="p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default ClientPortalLayout;
