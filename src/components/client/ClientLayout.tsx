/**
 * ClientLayout - Rogers/MonRogers-style layout
 * Top navigation bar with dropdowns, clean white background
 */
import { ReactNode, useCallback, useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useClientAuth } from "@/hooks/useClientAuth";
import {
  LogOut,
  Menu,
  X,
  ChevronDown,
  User,
  Search,
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
import { Badge } from "@/components/ui/badge";

interface ClientLayoutProps {
  children: ReactNode;
}

// Rogers-style navigation structure
const navGroups = [
  {
    label: "Survol",
    path: "/portal",
    children: [],
  },
  {
    label: "Facturation et paiement",
    path: null,
    children: [
      { path: "/portal/invoices", label: "Mes factures" },
      { path: "/portal/payments", label: "Moyens de paiement" },
      { path: "/portal/monthly-invoices", label: "Historique des paiements" },
    ],
  },
  {
    label: "Utilisation et services",
    path: null,
    children: [
      { path: "/portal/services", label: "Mes services" },
      { path: "/portal/orders", label: "Mes commandes" },
      { path: "/portal/channels", label: "Chaînes TV" },
      { path: "/portal/appointments", label: "Rendez-vous" },
      { path: "/portal/contracts", label: "Contrats" },
    ],
  },
  {
    label: "Mes offres",
    path: "/portal/new-order",
    children: [],
  },
  {
    label: "Paramètres",
    path: null,
    children: [
      { path: "/portal/profile", label: "Mon profil" },
      { path: "/portal/tickets", label: "Support" },
      { path: "/portal/web-forms", label: "Formulaires" },
      { path: "/portal/documents", label: "Documents" },
    ],
  },
];

const ClientLayout = ({ children }: ClientLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useClientAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: overdueCount } = useOverdueCount(user?.id, portalClient);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-logout handler
  const handleIdleLogout = useCallback(async () => {
    sessionStorage.removeItem("client_pin_verified");
    sessionStorage.removeItem("client_pin_pending_email");
    sessionStorage.removeItem("client_pin_pending_user_id");
    sessionStorage.removeItem("client_last_auth_check");
    await signOut();
    toast.info("Vous avez été déconnecté après 1 heure d'inactivité", { duration: 5000 });
    navigate("/portal/auth");
  }, [signOut, navigate]);

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

  const isActive = (path: string) => location.pathname === path;
  const isGroupActive = (group: typeof navGroups[0]) => {
    if (group.path && isActive(group.path)) return true;
    return group.children.some((c) => isActive(c.path));
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] client-portal-dark text-slate-900">
      {/* System banners */}
      <PortalSystemStatusBanner userType="client" />
      <AccountBlockedBanner />
      {user?.id && <PrepaidUrgentBanner userId={user.id} />}

      {/* Top utility bar - like Rogers gray bar */}
      <div className="bg-slate-100 border-b border-slate-200 hidden lg:block">
        <div className="max-w-[1200px] mx-auto px-6 flex items-center justify-end gap-6 h-9 text-xs text-slate-600">
          <Link to="/" className="hover:text-teal-700 transition-colors">
            Retour au site Nivra
          </Link>
          <span className="text-slate-300">|</span>
          <span className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            {user?.email}
          </span>
          <button onClick={handleSignOut} className="hover:text-teal-700 transition-colors flex items-center gap-1">
            <LogOut className="w-3.5 h-3.5" />
            Déconnexion
          </button>
        </div>
      </div>

      {/* Main navigation bar - teal like Rogers red bar */}
      <header className="bg-teal-700 text-white shadow-md sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-4 lg:px-6">
          <div className="flex items-center justify-between h-14 lg:h-16">
            {/* Logo */}
            <Link to="/portal" className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
                <span className="font-display font-bold text-white text-lg">N</span>
              </div>
              <span className="font-display font-bold text-xl text-white hidden sm:block">Nivra</span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-1 ml-8" ref={dropdownRef}>
              {navGroups.map((group, idx) => {
                const hasChildren = group.children.length > 0;
                const active = isGroupActive(group);
                
                return (
                  <div key={idx} className="relative">
                    {hasChildren ? (
                      <button
                        className={cn(
                          "flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                          active ? "bg-white/20 text-white" : "text-white/85 hover:bg-white/10 hover:text-white",
                          openDropdown === idx && "bg-white/20"
                        )}
                        onClick={() => setOpenDropdown(openDropdown === idx ? null : idx)}
                      >
                        {group.label}
                        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", openDropdown === idx && "rotate-180")} />
                        {group.label === "Facturation et paiement" && overdueCount && overdueCount > 0 && (
                          <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0 ml-1 min-w-[18px]">
                            {overdueCount}
                          </Badge>
                        )}
                      </button>
                    ) : (
                      <Link
                        to={group.path!}
                        className={cn(
                          "flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                          active ? "bg-white/20 text-white" : "text-white/85 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        {group.label}
                      </Link>
                    )}

                    {/* Dropdown menu */}
                    {hasChildren && openDropdown === idx && (
                      <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-xl border border-slate-200 py-2 z-50">
                        {group.children.map((child) => (
                          <Link
                            key={child.path}
                            to={child.path}
                            onClick={() => setOpenDropdown(null)}
                            className={cn(
                              "block px-4 py-2.5 text-sm transition-colors",
                              isActive(child.path)
                                ? "bg-teal-50 text-teal-700 font-medium"
                                : "text-slate-700 hover:bg-slate-50 hover:text-teal-700"
                            )}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-2">
              <PortalNotificationBell />
              {/* Mobile menu toggle */}
              <button
                className="lg:hidden p-2 text-white/90 hover:text-white hover:bg-white/10 rounded-lg"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Secondary nav bar - MonNivra + account */}
      <div className="bg-white border-b border-slate-200 hidden lg:block sticky top-16 z-40">
        <div className="max-w-[1200px] mx-auto px-6 flex items-center h-12 text-sm">
          <span className="font-semibold text-slate-900 mr-4">MonNivra</span>
          <span className="text-slate-400 mr-4">|</span>
          <span className="text-slate-600">
            {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Client"}
          </span>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-80 bg-white z-50 shadow-2xl lg:hidden overflow-y-auto">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <span className="font-semibold text-slate-900">Menu</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-slate-500 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-teal-700" />
                </div>
                <div>
                  <p className="font-medium text-slate-900 text-sm">
                    {user?.user_metadata?.full_name || "Client"}
                  </p>
                  <p className="text-xs text-slate-500">{user?.email}</p>
                </div>
              </div>
            </div>

            <nav className="p-2">
              {navGroups.map((group, idx) => (
                <div key={idx} className="mb-1">
                  {group.path && group.children.length === 0 ? (
                    <Link
                      to={group.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "block px-4 py-3 rounded-lg text-sm font-medium",
                        isActive(group.path) ? "bg-teal-50 text-teal-700" : "text-slate-700 hover:bg-slate-50"
                      )}
                    >
                      {group.label}
                    </Link>
                  ) : (
                    <>
                      <p className="px-4 pt-4 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        {group.label}
                      </p>
                      {group.children.map((child) => (
                        <Link
                          key={child.path}
                          to={child.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "block px-4 py-2.5 rounded-lg text-sm",
                            isActive(child.path) ? "bg-teal-50 text-teal-700 font-medium" : "text-slate-600 hover:bg-slate-50"
                          )}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </>
                  )}
                </div>
              ))}
            </nav>

            <div className="p-4 border-t border-slate-200 mt-2">
              <Link to="/" className="block px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 rounded-lg mb-1">
                Retour au site Nivra
              </Link>
              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Déconnexion
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-100 border-t border-slate-200 py-6 mt-auto">
        <div className="max-w-[1200px] mx-auto px-6 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Nivra Télécom. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
};

export default ClientLayout;
