/**
 * ClientLayout - Purple-themed professional layout
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
import { useLiveActivityTracker } from "@/hooks/useLiveActivityTracker";
import { Badge } from "@/components/ui/badge";
import { ImpersonationProvider } from "@/components/client/ImpersonationBanner";

const PURPLE = "#6b21e8";
const PURPLE_LIGHT = "#ede9fe";
const DARK = "#0d0d1a";

interface ClientLayoutProps {
  children: ReactNode;
}

// Navigation structure
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
      { path: "/portal/billing", label: "Faire un paiement" },
      { path: "/portal/billing?tab=add-credit", label: "Ajouter un crédit" },
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
      { path: "/portal/activation", label: "📶 Activation WiFi" },
      { path: "/portal/service-addresses", label: "Mes adresses" },
      { path: "/portal/orders", label: "Mes commandes" },
      { path: "/portal/identity-verification", label: "Vérification d'identité" },
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
    label: "Parrainage",
    path: "/portal/referrals",
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
      { path: "/portal/guides", label: "📥 Guides & Documents" },
    ],
  },
];

const ClientLayout = ({ children }: ClientLayoutProps) => {
  useLiveActivityTracker();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useClientAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: overdueCount } = useOverdueCount(user?.id, portalClient);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  return (
    <ImpersonationProvider>
    <div className="min-h-screen flex flex-col bg-white text-slate-900">
      <PortalSystemStatusBanner userType="client" />
      <AccountBlockedBanner />
      {user?.id && <PrepaidUrgentBanner userId={user.id} />}

      {/* Top utility bar — desktop only */}
      <div className="bg-slate-100 border-b border-slate-200 hidden lg:block">
        <div className="max-w-[1200px] mx-auto px-6 flex items-center justify-end gap-6 h-9 text-xs text-slate-600">
          <Link to="/" className="hover:text-[#6b21e8] transition-colors">
            Retour au site Nivra
          </Link>
          <span className="text-slate-300">|</span>
          <span className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            {user?.email}
          </span>
          <button onClick={handleSignOut} className="hover:text-[#6b21e8] transition-colors flex items-center gap-1">
            <LogOut className="w-3.5 h-3.5" />
            Déconnexion
          </button>
        </div>
      </div>

      {/* Main navigation bar — purple themed */}
      <header className="text-white shadow-md sticky top-0 z-50" style={{ background: DARK }}>
        <div className="max-w-[1200px] mx-auto px-4 lg:px-6">
          {/* Mobile: strict 3-column grid */}
          <div className="grid grid-cols-[56px_1fr_56px] items-center h-14 lg:hidden">
            <button
              className="w-14 h-14 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/10 rounded-lg"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menu"
              type="button"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <Link to="/portal" className="justify-self-center flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: PURPLE }}>
                <span className="font-bold text-white text-lg">N</span>
              </div>
              <span className="font-bold text-xl text-white">Nivra</span>
            </Link>

            <Link
              to="/portal/profile"
              className="w-14 h-14 flex items-center justify-center justify-self-end text-white/90 hover:text-white hover:bg-white/10 rounded-lg"
              aria-label="Compte"
            >
              <User className="w-5 h-5" />
            </Link>
          </div>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center h-16">
            <Link to="/portal" className="flex items-center gap-2 shrink-0">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: PURPLE }}>
                <span className="font-bold text-white text-lg">N</span>
              </div>
              <span className="font-bold text-xl text-white">Nivra</span>
            </Link>

            <nav className="flex items-center gap-1 ml-8 flex-1" ref={dropdownRef}>
              {navGroups.map((group, idx) => {
                const hasChildren = group.children.length > 0;
                const active = isGroupActive(group);

                return (
                  <div key={idx} className="relative">
                    {hasChildren ? (
                      <button
                        className={cn(
                          "flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                          active ? "text-white" : "text-white/85 hover:bg-white/10 hover:text-white",
                          openDropdown === idx && "bg-white/20"
                        )}
                        style={active ? { background: PURPLE } : undefined}
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
                          active ? "text-white" : "text-white/85 hover:bg-white/10 hover:text-white"
                        )}
                        style={active ? { background: PURPLE } : undefined}
                      >
                        {group.label}
                      </Link>
                    )}

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
                                ? "font-medium"
                                : "text-slate-700 hover:text-[#6b21e8]"
                            )}
                            style={isActive(child.path) ? { background: PURPLE_LIGHT, color: PURPLE } : undefined}
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

            <div className="flex items-center gap-1 shrink-0">
              <PortalNotificationBell />
            </div>
          </div>
        </div>
      </header>

      {/* Secondary nav bar — desktop */}
      <div className="bg-white border-b border-slate-200 hidden lg:block sticky top-16 z-40">
        <div className="max-w-[1200px] mx-auto px-6 flex items-center h-12 text-sm">
          <span className="font-semibold text-slate-900 mr-4">MonNivra</span>
          <span className="text-slate-400 mr-4">|</span>
          <span className="text-slate-600">
            {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Client"}
          </span>
        </div>
      </div>

      {/* Mobile menu — full-height LEFT drawer */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed top-0 left-0 h-full w-[85vw] max-w-[320px] bg-white z-50 shadow-2xl lg:hidden overflow-y-auto">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between h-14">
              <span className="font-semibold text-slate-900 text-base">MonNivra</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-slate-500 hover:text-slate-900 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: PURPLE_LIGHT }}>
                  <User className="w-5 h-5" style={{ color: PURPLE }} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 text-sm truncate">
                    {user?.user_metadata?.full_name || "Client"}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{user?.email}</p>
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
                        "flex items-center px-4 py-3 rounded-xl text-sm font-medium min-h-[44px]",
                        isActive(group.path) ? "text-white" : "text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                      )}
                      style={isActive(group.path) ? { background: PURPLE, color: 'white' } : undefined}
                    >
                      {group.label}
                    </Link>
                  ) : (
                    <>
                      <p className="px-4 pt-4 pb-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        {group.label}
                      </p>
                      {group.children.map((child) => (
                        <Link
                          key={child.path}
                          to={child.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center px-4 py-3 rounded-xl text-sm min-h-[44px]",
                            isActive(child.path) ? "font-medium" : "text-slate-600 hover:bg-slate-50 active:bg-slate-100"
                          )}
                          style={isActive(child.path) ? { background: PURPLE_LIGHT, color: PURPLE } : undefined}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </>
                  )}
                </div>
              ))}
            </nav>

            <div className="p-4 border-t border-slate-200 mt-2 space-y-1">
              <Link to="/" className="flex items-center px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 rounded-xl min-h-[44px]">
                Retour au site Nivra
              </Link>
              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2 min-h-[44px]"
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
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6 lg:py-8">
          {children}
        </div>
      </main>

      {/* Portal Footer */}
      <footer className="bg-slate-100 border-t border-slate-200 py-5 mt-auto">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 text-center text-xs text-slate-500 space-y-1">
          <p>© {new Date().getFullYear()} Nivra Télécom. Tous droits réservés.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <Link to="/privacy-policy" className="hover:text-[#6b21e8] transition-colors">Confidentialité</Link>
            <span className="text-slate-400">·</span>
            <Link to="/conditions-de-service" className="hover:text-[#6b21e8] transition-colors">Conditions</Link>
            <span className="text-slate-400">·</span>
            <Link to="/contact" className="hover:text-[#6b21e8] transition-colors">Support</Link>
          </div>
        </div>
      </footer>
    </div>
    </ImpersonationProvider>
  );
};

export default ClientLayout;
