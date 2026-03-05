/**
 * AdminLayout — TELUS-grade carrier admin shell
 * Semantic tokens, proper sizing (14px base), AA contrast
 */
import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, X, Search, Shield } from "lucide-react";
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

      <div className="flex-1 flex">
        {/* ═══════ DESKTOP SIDEBAR ═══════ */}
        <aside className="hidden lg:flex flex-col w-[260px] shrink-0 border-r border-sidebar-border bg-sidebar">
          {/* Brand */}
          <div className="h-14 flex items-center gap-3 px-5 border-b border-sidebar-border">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <Link to="/admin" className="font-semibold text-[15px] tracking-tight text-foreground">
              Nivra Admin
            </Link>
          </div>

          {/* Search */}
          <div className="px-3 py-3 space-y-2">
            <GlobalSearchTrigger />
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Filtrer le menu…"
                value={sidebarSearchQuery}
                onChange={(e) => setSidebarSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm bg-secondary border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary focus-visible:ring-1"
              />
              {sidebarSearchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setSidebarSearchQuery("")}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Nav */}
          <AdminSidebarNav searchQuery={sidebarSearchQuery} />

          {/* Footer */}
          <div className="px-4 py-3 border-t border-sidebar-border space-y-2">
            <div className="flex items-center gap-2.5 px-1">
              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-sm font-medium text-admin-text-secondary">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary h-9"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4" />
              Déconnexion
            </Button>
          </div>
        </aside>

        {/* ═══════ MAIN AREA ═══════ */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* ─── Top bar (desktop) ─── */}
          <header className="hidden lg:flex items-center justify-between h-14 px-6 border-b border-border bg-background shrink-0 sticky top-0 z-40">
            <div className="flex items-center gap-3" />
            <div className="flex items-center gap-2">
              <LockdownButton compact />
              <OnlineUsersIndicator />
              <NotificationBell basePath="/admin" />
            </div>
          </header>

          {/* ─── Mobile header ─── */}
          <header className="lg:hidden sticky top-0 z-50 flex items-center justify-between h-14 px-3 border-b border-border bg-background">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="h-10 w-10 text-muted-foreground"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <Link to="/admin" className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
                <Shield className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-sm text-foreground">Nivra Admin</span>
            </Link>
            <NotificationBell basePath="/admin" />
            {mobileMenuOpen && (
              <AdminMobileNav
                onClose={() => setMobileMenuOpen(false)}
                onSignOut={handleSignOut}
              />
            )}
          </header>

          {/* ─── Page content ─── */}
          <main className="flex-1 overflow-auto">
            <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-6 lg:py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
