import { ReactNode } from "react";
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
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PortalSystemStatusBanner } from "@/components/client/PortalSystemStatusBanner";
import { PortalNotificationBell } from "@/components/client/PortalNotificationBell";
import AccountBlockedBanner from "@/components/client/AccountBlockedBanner";

interface ClientLayoutProps {
  children: ReactNode;
}

const ClientLayout = ({ children }: ClientLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useClientAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    // Clear PIN verification state on sign out (but NOT trusted device)
    sessionStorage.removeItem("client_pin_verified");
    sessionStorage.removeItem("client_pin_pending_email");
    sessionStorage.removeItem("client_pin_pending_user_id");
    sessionStorage.removeItem("client_last_auth_check");
    // Note: Do NOT clear localStorage.portal_trusted_until - trusted device persists
    await signOut();
    navigate("/");
  };

  const navItems = [
    { path: "/portal", label: "Tableau de bord", icon: LayoutDashboard },
    { path: "/portal/appointments", label: "Rendez-vous", icon: Calendar },
    { path: "/portal/new-order", label: "Nouvelle commande", icon: ShoppingCart },
    { path: "/portal/orders", label: "Mes commandes", icon: Package },
    { path: "/portal/services", label: "Mes services", icon: CreditCard },
    { path: "/portal/channels", label: "Chaînes TV", icon: Tv },
    { path: "/portal/invoices", label: "Factures", icon: FileText },
    { path: "/portal/contracts", label: "Contrats", icon: FileText },
    { path: "/portal/tickets", label: "Support", icon: MessageSquare },
    { path: "/portal/profile", label: "Mon profil", icon: User },
    { path: "/portal/payments", label: "Paiements", icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* System Status Banner */}
      <PortalSystemStatusBanner userType="client" />
      
      {/* Account Blocked Banner */}
      <AccountBlockedBanner />
      
      <div className="flex-1 relative">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center">
            <span className="font-display font-bold text-navy-900 text-sm">N</span>
          </div>
          <span className="font-display font-bold text-foreground">Nivra</span>
        </div>
        <div className="flex items-center gap-1">
          <PortalNotificationBell />
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full w-64 bg-card border-r border-border z-40 transform transition-transform duration-200 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 border-b border-border hidden lg:flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center">
              <span className="font-display font-bold text-navy-900 text-xl">N</span>
            </div>
            <span className="font-display font-bold text-xl text-foreground">Nivra</span>
          </Link>
          <PortalNotificationBell />
        </div>

        <nav className="p-4 space-y-1 mt-16 lg:mt-0">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <Home className="w-5 h-5" />
            <span>Retour au site</span>
          </Link>
          
          <div className="h-px bg-border my-4" />

          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                  isActive
                    ? "bg-cyan-500/20 text-cyan-400"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-4 px-3">
            <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
              <User className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Client"}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full justify-start"
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
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
      </div>
    </div>
  );
};

export default ClientLayout;