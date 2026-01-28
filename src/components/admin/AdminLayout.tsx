import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, X, Search, RefreshCw, Shield } from "lucide-react";
import { SystemStatusBanner, SystemStatusIndicator } from "@/components/SystemStatusBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { GlobalSearchTrigger } from "@/components/admin/GlobalSearch";
import { OnlineUsersIndicator } from "@/components/admin/OnlineUsersIndicator";
import { usePresence } from "@/hooks/usePresence";
import AdminSidebarNav from "./AdminSidebarNav";
import AdminMobileNav from "./AdminMobileNav";
import StaffBackground from "@/components/staff/StaffBackground";

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState("");
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
    <div className="min-h-screen relative flex flex-col admin-dark">
      {/* Staff-style background */}
      <StaffBackground />
      
      {/* System Status Banner */}
      <SystemStatusBanner userType="admin" />
      
      <div className="flex-1 flex relative z-10">
        {/* Desktop Sidebar - Dark theme matching Employee portal */}
        <aside className="hidden lg:flex flex-col w-64 bg-slate-900/80 backdrop-blur-xl border-r border-slate-700/50">
          {/* Logo Header */}
          <div className="p-6 border-b border-slate-700/50">
            <div className="flex items-center justify-between">
              <Link to="/admin" className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-400 shadow-lg shadow-teal-500/20">
                  <Shield className="h-5 w-5 text-slate-900" />
                </div>
                <span className="font-display font-bold text-lg text-white">Nivra Admin</span>
              </Link>
              <div className="flex items-center gap-2">
                <OnlineUsersIndicator />
                <NotificationBell basePath="/admin" />
              </div>
            </div>
          </div>
          
          {/* Global Search (DB search) */}
          <div className="px-4 pt-4">
            <GlobalSearchTrigger />
          </div>

          {/* Sidebar Menu Filter */}
          <div className="px-4 pt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                type="text"
                placeholder="Filtrer le menu..."
                value={sidebarSearchQuery}
                onChange={(e) => setSidebarSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9 text-sm bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
              />
              {sidebarSearchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-slate-400 hover:text-white"
                  onClick={() => setSidebarSearchQuery("")}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>
          
          <AdminSidebarNav searchQuery={sidebarSearchQuery} />

          {/* Footer - User info and logout */}
          <div className="p-4 border-t border-slate-700/50 space-y-3">
            <div className="px-4 mb-2">
              <SystemStatusIndicator />
            </div>
            <div className="px-4">
              <p className="text-xs text-slate-500">Connecté en tant que</p>
              <p className="text-sm font-medium text-white truncate">{user?.email}</p>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-slate-400 hover:text-white hover:bg-slate-800"
              onClick={handleSignOut}
            >
              <LogOut className="w-5 h-5" />
              Déconnexion
            </Button>
          </div>
        </aside>

        {/* Mobile Header */}
        <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50">
          <div className="flex items-center justify-between p-4">
            <Link to="/admin" className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-400 shadow-lg shadow-teal-500/20">
                <Shield className="h-5 w-5 text-slate-900" />
              </div>
              <span className="font-display font-bold text-lg text-white">Nivra Admin</span>
            </Link>
            <div className="flex items-center gap-2">
              <NotificationBell basePath="/admin" />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-slate-400 hover:text-white hover:bg-slate-800"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
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
