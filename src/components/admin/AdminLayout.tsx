/**
 * AdminLayout V2 — TELUS-grade carrier admin shell
 * Clean, professional, high-contrast dark theme
 * Stable sidebar + sticky header + breadcrumbs
 */
import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu, X, Search, Shield, Bell, ChevronRight } from "lucide-react";
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
    <div className="min-h-screen flex flex-col bg-[hsl(222,47%,7%)] text-[hsl(220,14%,96%)]">
      {/* System Status Banner */}
      <SystemStatusBanner userType="admin" />

      <div className="flex-1 flex">
        {/* ═══════ DESKTOP SIDEBAR ═══════ */}
        <aside className="hidden lg:flex flex-col w-[260px] shrink-0 border-r border-[hsl(222,30%,14%)] bg-[hsl(222,47%,9%)]">
          {/* Brand */}
          <div className="h-14 flex items-center gap-3 px-5 border-b border-[hsl(222,30%,14%)]">
            <div className="h-8 w-8 rounded-lg bg-[hsl(168,76%,42%)] flex items-center justify-center">
              <Shield className="h-4 w-4 text-[hsl(222,47%,9%)]" />
            </div>
            <Link to="/admin" className="font-semibold text-sm tracking-tight text-white">
              Nivra Admin
            </Link>
          </div>

          {/* Search */}
          <div className="px-3 py-3 space-y-2">
            <GlobalSearchTrigger />
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[hsl(220,9%,40%)]" />
              <Input
                type="text"
                placeholder="Filtrer le menu…"
                value={sidebarSearchQuery}
                onChange={(e) => setSidebarSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-[hsl(222,40%,12%)] border-[hsl(222,30%,16%)] text-[hsl(220,14%,80%)] placeholder:text-[hsl(220,9%,35%)] focus-visible:ring-[hsl(168,76%,42%)] focus-visible:ring-1"
              />
              {sidebarSearchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0.5 top-1/2 -translate-y-1/2 h-7 w-7 text-[hsl(220,9%,40%)] hover:text-white"
                  onClick={() => setSidebarSearchQuery("")}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Nav */}
          <AdminSidebarNav searchQuery={sidebarSearchQuery} />

          {/* Footer */}
          <div className="px-4 py-3 border-t border-[hsl(222,30%,14%)] space-y-2">
            <div className="flex items-center gap-2 px-1">
              <div className="h-7 w-7 rounded-full bg-[hsl(222,40%,16%)] flex items-center justify-center text-xs font-medium text-[hsl(220,14%,70%)]">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[hsl(220,14%,85%)] truncate">{user?.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-xs text-[hsl(220,9%,50%)] hover:text-white hover:bg-[hsl(222,40%,14%)] h-8"
              onClick={handleSignOut}
            >
              <LogOut className="w-3.5 h-3.5" />
              Déconnexion
            </Button>
          </div>
        </aside>

        {/* ═══════ MAIN AREA ═══════ */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* ─── Top bar (desktop) ─── */}
          <header className="hidden lg:flex items-center justify-between h-14 px-6 border-b border-[hsl(222,30%,14%)] bg-[hsl(222,47%,8%)] shrink-0">
            <div className="flex items-center gap-3">
              {/* Breadcrumb placeholder — pages inject via context */}
            </div>
            <div className="flex items-center gap-2">
              <LockdownButton compact />
              <OnlineUsersIndicator />
              <NotificationBell basePath="/admin" />
            </div>
          </header>

          {/* ─── Mobile header ─── */}
          <header className="lg:hidden sticky top-0 z-50 flex items-center justify-between h-14 px-3 border-b border-[hsl(222,30%,14%)] bg-[hsl(222,47%,8%)]">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="h-10 w-10 text-[hsl(220,14%,70%)]"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <Link to="/admin" className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-[hsl(168,76%,42%)] flex items-center justify-center">
                <Shield className="h-3.5 w-3.5 text-[hsl(222,47%,9%)]" />
              </div>
              <span className="font-semibold text-sm text-white">Nivra Admin</span>
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
