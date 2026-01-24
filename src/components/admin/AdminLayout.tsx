import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, X } from "lucide-react";
import { SystemStatusBanner, SystemStatusIndicator } from "@/components/SystemStatusBanner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/ui/notification-bell";
import { GlobalSearchTrigger } from "@/components/admin/GlobalSearch";
import { OnlineUsersIndicator } from "@/components/admin/OnlineUsersIndicator";
import { usePresence } from "@/hooks/usePresence";
import AdminSidebarNav from "./AdminSidebarNav";
import AdminMobileNav from "./AdminMobileNav";

interface AdminLayoutProps {
  children: ReactNode;
}

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
        
        <AdminSidebarNav />

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
          <AdminMobileNav 
            onClose={() => setMobileMenuOpen(false)} 
            onSignOut={handleSignOut} 
          />
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
