import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  CreditCard, 
  LogOut,
  Menu,
  X,
  MessageSquare,
  XCircle,
  AlertTriangle,
  ExternalLink
} from "lucide-react";
import { SystemStatusBanner, SystemStatusIndicator } from "@/components/SystemStatusBanner";
import { Button } from "@/components/ui/button";
import { useEmployeeAuth } from "@/hooks/useEmployeeAuth";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/ui/notification-bell";

interface EmployeeLayoutProps {
  children: ReactNode;
}

const navItems = [
  { icon: LayoutDashboard, label: "Tableau de bord", href: "/employee" },
  { icon: Users, label: "Clients", href: "/employee/clients" },
  { icon: Package, label: "Commandes", href: "/employee/orders" },
  { icon: CreditCard, label: "Facturation", href: "/employee/billing" },
  { icon: XCircle, label: "Annulations", href: "/employee/cancellations" },
  { icon: AlertTriangle, label: "Contestations", href: "/employee/payment-disputes" },
  { icon: MessageSquare, label: "Tickets", href: "/employee/tickets" },
];

const EmployeeLayout = ({ children }: EmployeeLayoutProps) => {
  const { signOut, user } = useEmployeeAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/employee/login");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* System Status Banner */}
      <SystemStatusBanner userType="admin" />
      
      <div className="flex-1 flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 bg-card border-r border-border">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <Link to="/employee" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-400 flex items-center justify-center">
                <span className="text-navy-900 font-bold text-sm">N</span>
              </div>
              <span className="font-display font-bold text-lg text-foreground">Nivra Employee</span>
            </Link>
            <NotificationBell />
          </div>
          
          <nav className="flex-1 p-4 space-y-1">
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
            <Link
              to="/admin"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Ouvrir Admin
            </Link>
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
            <Link to="/employee" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-400 flex items-center justify-center">
                <span className="text-navy-900 font-bold text-sm">N</span>
              </div>
              <span className="font-display font-bold text-lg text-foreground">Nivra Employee</span>
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

export default EmployeeLayout;
