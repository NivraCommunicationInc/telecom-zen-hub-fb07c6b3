/**
 * AdminLayout — Carrier-grade OSS/BSS workspace shell
 * Full-width workspace, no card containers, operational navigation
 */
import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, X, Search, Shield, Bell } from "lucide-react";
import { SystemStatusBanner } from "@/components/SystemStatusBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { GlobalSearchTrigger } from "@/components/admin/GlobalSearch";
import { OnlineUsersIndicator } from "@/components/admin/OnlineUsersIndicator";
import { LockdownButton } from "@/components/admin/LockdownButton";
import { usePresence } from "@/hooks/usePresence";
import AdminSidebarNav from "./AdminSidebarNav";
import AdminMobileNav from "./AdminMobileNav";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { updateCurrentPage } = usePresence();

  useEffect(() => {
    updateCurrentPage(location.pathname);
  }, [location.pathname, updateCurrentPage]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login");
  };

  return (
    <div className="admin-dark min-h-screen flex flex-col bg-background text-foreground">
      <SystemStatusBanner userType="admin" />

      {/* ═══ TOP HEADER — sticky, full width ═══ */}
      <header className="hidden lg:flex items-center h-12 px-4 border-b border-border bg-background shrink-0 sticky top-0 z-50">
        {/* Left: Brand */}
        <div className="flex items-center gap-2 mr-4">
          <div className="h-7 w-7 rounded-md bg-primary flex items-center justify-center">
            <Shield className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <Link to="/admin" className="font-semibold text-sm tracking-tight text-foreground">
            Nivra Ops
          </Link>
        </div>

        {/* Center: Global search */}
        <div className="flex-1 max-w-md">
          <GlobalSearchTrigger />
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 ml-auto">
          <LockdownButton compact />
          <OnlineUsersIndicator />
          <NotificationBell basePath="/admin" />
          <div className="w-px h-6 bg-border mx-1" />
          <div className="flex items-center gap-2 px-2">
            <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-muted-foreground">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <span className="text-xs text-muted-foreground hidden xl:inline truncate max-w-[120px]">
              {user?.email}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={handleSignOut}
            title="Déconnexion"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </header>

      {/* ═══ MOBILE HEADER ═══ */}
      <header className="lg:hidden sticky top-0 z-50 flex items-center justify-between h-12 px-3 border-b border-border bg-background">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="h-9 w-9 text-muted-foreground"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
        <Link to="/admin" className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center">
            <Shield className="h-3 w-3 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm text-foreground">Nivra Ops</span>
        </Link>
        <NotificationBell basePath="/admin" />
        {mobileMenuOpen && (
          <AdminMobileNav
            onClose={() => setMobileMenuOpen(false)}
            onSignOut={handleSignOut}
          />
        )}
      </header>

      <div className="flex-1 flex min-h-0">
        {/* ═══ SIDEBAR — operational navigation ═══ */}
        <aside className={cn(
          "hidden lg:flex flex-col shrink-0 border-r border-border bg-sidebar overflow-hidden transition-all duration-200",
          sidebarCollapsed ? "w-0" : "w-[240px]"
        )}>
          {/* Sidebar search */}
          <div className="px-2 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Filtrer…"
                value={sidebarSearchQuery}
                onChange={(e) => setSidebarSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground"
              />
              {sidebarSearchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground hover:text-foreground"
                  onClick={() => setSidebarSearchQuery("")}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Navigation */}
          <AdminSidebarNav searchQuery={sidebarSearchQuery} />

          {/* Footer */}
          <div className="px-3 py-2 border-t border-sidebar-border">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-xs text-muted-foreground hover:text-foreground h-8"
              onClick={handleSignOut}
            >
              <LogOut className="w-3.5 h-3.5" />
              Déconnexion
            </Button>
          </div>
        </aside>

        {/* ═══ WORKSPACE — full width, no card containers ═══ */}
        <main className="flex-1 overflow-auto min-w-0">
          <div className="px-4 lg:px-5 py-3 lg:py-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
