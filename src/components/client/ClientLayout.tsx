/**
 * ClientLayout - Purple-themed professional layout
 * Top navigation bar with dropdowns, clean white background
 */
import { ReactNode, useCallback, useState, useRef, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  LogOut,
  Menu,
  X,
  ChevronDown,
  User,
  Search,
  LayoutGrid,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { PortalSystemStatusBanner } from "@/components/client/PortalSystemStatusBanner";
import { PortalNotificationBell } from "@/components/client/PortalNotificationBell";
import AccountBlockedBanner from "@/components/client/AccountBlockedBanner";
import PrepaidUrgentBanner from "@/components/client/PrepaidUrgentBanner";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { usePortalSectionBadges, PortalSectionKey } from "@/hooks/usePortalSectionBadges";
import { SectionBadge } from "@/components/ui/section-badge";
import { portalClient } from "@/integrations/backend/portalClient";
import { toast } from "sonner";
import { useLiveActivityTracker } from "@/hooks/useLiveActivityTracker";
import { Badge } from "@/components/ui/badge";
import { ImpersonationProvider } from "@/components/client/ImpersonationBanner";
import { invalidateClientRealtimeQueries } from "@/lib/queryInvalidation";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";

const PURPLE = "#6b21e8";
const PURPLE_LIGHT = "#ede9fe";
const DARK = "#0d0d1a";

interface ClientLayoutProps {
  children: ReactNode;
}

// Navigation structure (with optional badgeKey mapping to usePortalSectionBadges)
const navGroups: Array<{
  label: string;
  path: string | null;
  badgeKey?: PortalSectionKey;
  children: Array<{ path: string; label: string; badgeKey?: PortalSectionKey }>;
}> = [
  {
    label: "Survol",
    path: "/portal",
    children: [],
  },
  {
    label: "Facturation et paiement",
    path: null,
    badgeKey: "billing",
    children: [
      { path: "/portal/billing", label: "Faire un paiement", badgeKey: "billing" },
      { path: "/portal/billing?tab=add-credit", label: "Ajouter un crédit" },
      { path: "/portal/invoices", label: "Mes factures", badgeKey: "billing" },
      { path: "/portal/paiement", label: "Mode de paiement" },
      { path: "/portal/payments", label: "Moyens de paiement" },
      { path: "/portal/monthly-invoices", label: "Historique des paiements" },
    ],
  },
  {
    label: "Utilisation et services",
    path: null,
    badgeKey: "services",
    children: [
      { path: "/portal/services", label: "Mes services", badgeKey: "services" },
      { path: "/portal/change-plan", label: "Changer de forfait" },
      { path: "/portal/equipment", label: "Mon équipement" },
      { path: "/portal/activation", label: "📶 Activation WiFi" },
      { path: "/portal/service-addresses", label: "Mes adresses" },
      { path: "/portal/orders", label: "Mes commandes", badgeKey: "orders" },
      { path: "/portal/identity-verification", label: "Vérification d'identité", badgeKey: "identity" },
      { path: "/portal/channels", label: "Chaînes TV" },
      { path: "/portal/appointments", label: "Rendez-vous" },
      { path: "/portal/contracts", label: "Contrats", badgeKey: "contracts" },
      { path: "/portal/replacement", label: "Demande de remplacement" },
      { path: "/portal/cancellations", label: "Résiliation de service" },
    ],
  },
  {
    label: "Mes offres",
    path: null,
    children: [
      { path: "/portal/new-order", label: "Forfaits & services" },
      { path: "/telephones", label: "📱 Téléphones" },
    ],
  },
  {
    label: "Parrainage",
    path: "/portal/referrals",
    children: [],
  },
  {
    label: "Mes points",
    path: "/portal/loyalty",
    children: [],
  },
  {
    label: "Paramètres",
    path: null,
    badgeKey: "support",
    children: [
      { path: "/portal/profile", label: "Mon profil" },
      { path: "/portal/tickets", label: "Support", badgeKey: "support" },
      { path: "/portal/web-forms", label: "Formulaires" },
      { path: "/portal/documents", label: "Documents", badgeKey: "support" },
      { path: "/portal/guides", label: "📥 Guides & Documents" },
    ],
  },
];

const ClientLayout = ({ children }: ClientLayoutProps) => {
  useLiveActivityTracker();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useClientAuth();
  const queryClient = useQueryClient();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { badges: sectionBadges } = usePortalSectionBadges();
  const { data: canonicalData } = useCanonicalClientData(user?.id);
  const overdueCount = useMemo(() => {
    const closed = new Set(["paid", "paid_by_promo", "cancelled", "refunded", "void"]);
    return (canonicalData?.invoices || []).filter((invoice: any) => {
      const status = String(invoice?.status || "").toLowerCase();
      return !closed.has(status) && Number(invoice?.balance_due ?? invoice?.total ?? 0) > 0;
    }).length;
  }, [canonicalData?.invoices]);
  const pointsBalance = useMemo(() => {
    const points = canonicalData?.loyaltyPoints || [];
    return points.reduce((sum: number, row: any) => sum + (Number(row?.available_points) || 0), 0);
  }, [canonicalData?.loyaltyPoints]);

  const { data: hasStaffRole } = useQuery({
    queryKey: ["user-has-staff-role", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .neq("role", "client");
      return Array.isArray(data) && data.length > 0;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
  });

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

  useEffect(() => {
    if (!user?.id) return;

    let invalidationTimer: ReturnType<typeof setTimeout> | null = null;
    const invalidatePortalData = () => {
      if (invalidationTimer) clearTimeout(invalidationTimer);
      invalidationTimer = setTimeout(() => {
        invalidateClientRealtimeQueries(queryClient);
      }, 750);
    };

    const channel = portalClient
      .channel(`customer-portal-snapshot-sync-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "customer_portal_snapshots", filter: `user_id=eq.${user.id}` }, invalidatePortalData)
      .subscribe();

    return () => {
      if (invalidationTimer) clearTimeout(invalidationTimer);
      portalClient.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

  return (
    <ImpersonationProvider>
    <div className="portal-skin min-h-screen flex flex-col" style={{ background: "#0A0A0F", color: "#FFFFFF" }}>
      <PortalSystemStatusBanner userType="client" />
      <AccountBlockedBanner />
      {user?.id && <PrepaidUrgentBanner userId={user.id} />}

      {/* Top utility bar — desktop only */}
      <div className="hidden lg:block border-b" style={{ background: "#0D0D1F", borderColor: "rgba(124,58,237,0.15)" }}>
        <div className="max-w-[1200px] mx-auto px-6 flex items-center justify-end gap-6 h-9 text-xs" style={{ color: "#A0A0B8" }}>
          <Link to="/" className="transition-colors hover:text-white">
            Retour au site Nivra
          </Link>
          <span style={{ color: "#2A2A40" }}>|</span>
          <span className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            {user?.email}
          </span>
          <button onClick={handleSignOut} className="transition-colors hover:text-white flex items-center gap-1">
            <LogOut className="w-3.5 h-3.5" />
            Déconnexion
          </button>
        </div>
      </div>

      {/* Main nav — dark Nivra brand */}
      <header className="sticky top-0 z-50" style={{ background: "#0D0D1F", borderBottom: "1px solid rgba(124,58,237,0.15)", boxShadow: "0 4px 24px rgba(124,58,237,0.12)" }}>
        <div className="max-w-[1200px] mx-auto px-4 lg:px-6">

          {/* Mobile */}
          <div className="grid grid-cols-[56px_1fr_56px] items-center h-14 lg:hidden">
            <button
              className="w-14 h-14 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menu"
              type="button"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link to="/portal" className="justify-self-center flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <span className="font-bold text-white text-base">N</span>
              </div>
              <span className="font-bold text-lg text-white tracking-tight">Nivra</span>
            </Link>
            <Link to="/portal/profile" className="w-14 h-14 flex items-center justify-center justify-self-end text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors" aria-label="Compte">
              <User className="w-5 h-5" />
            </Link>
          </div>

          {/* Desktop */}
          <div className="hidden lg:flex items-center h-16">
            <Link to="/portal" className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                <span className="font-bold text-white text-lg">N</span>
              </div>
              <span className="font-bold text-xl text-white tracking-tight">Nivra</span>
            </Link>

            <nav className="flex items-center gap-0.5 ml-8 flex-1" ref={dropdownRef}>
              {navGroups.map((group, idx) => {
                const hasChildren = group.children.length > 0;
                const active = isGroupActive(group);
                return (
                  <div key={idx} className="relative">
                    {hasChildren ? (
                      <button
                        className={cn(
                          "flex items-center gap-1 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors",
                          active
                            ? "bg-white/20 text-white"
                            : "text-white/80 hover:bg-white/10 hover:text-white",
                          openDropdown === idx && "bg-white/20 text-white"
                        )}
                        onClick={() => setOpenDropdown(openDropdown === idx ? null : idx)}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {group.label}
                          {group.badgeKey && sectionBadges[group.badgeKey]?.show && (
                            <SectionBadge show variant={sectionBadges[group.badgeKey]?.urgent ? "dot-pulse" : "dot"} ariaLabel={`${group.label} nécessite votre attention`} />
                          )}
                        </span>
                        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform opacity-70", openDropdown === idx && "rotate-180")} />
                        {group.label === "Facturation et paiement" && overdueCount > 0 && (
                          <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0 ml-1 min-w-[18px]">{overdueCount}</Badge>
                        )}
                      </button>
                    ) : (
                      <Link
                        to={group.path!}
                        className={cn(
                          "flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors",
                          active ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        {group.label}
                        {group.label === "Mes points" && typeof pointsBalance === "number" && pointsBalance > 0 && (
                          <Badge className="bg-amber-400 text-gray-900 text-[10px] px-1.5 py-0 min-w-[18px]">{pointsBalance}</Badge>
                        )}
                      </Link>
                    )}

                    {hasChildren && openDropdown === idx && (
                      <div className="absolute top-full left-0 mt-2 w-64 rounded-xl shadow-2xl py-1.5 z-50 border" style={{ background: "#111122", borderColor: "rgba(124,58,237,0.25)", boxShadow: "0 8px 32px rgba(124,58,237,0.2)" }}>
                        {group.children.map((child) => (
                          <Link
                            key={child.path}
                            to={child.path}
                            onClick={() => setOpenDropdown(null)}
                            className={cn(
                              "flex items-center justify-between gap-2 px-4 py-2.5 text-sm transition-colors",
                              isActive(child.path)
                                ? "font-semibold"
                                : ""
                            )}
                            style={isActive(child.path)
                              ? { background: "rgba(124,58,237,0.15)", color: "#a78bfa" }
                              : { color: "#D0D0E8" }
                            }
                            onMouseEnter={e => { if (!isActive(child.path)) (e.currentTarget as HTMLElement).style.background = "rgba(124,58,237,0.08)"; }}
                            onMouseLeave={e => { if (!isActive(child.path)) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                          >
                            <span>{child.label}</span>
                            {child.badgeKey && sectionBadges[child.badgeKey]?.show && (
                              <SectionBadge show variant={sectionBadges[child.badgeKey]?.urgent ? "dot-pulse" : "dot"} ariaLabel={`${child.label} nécessite votre attention`} />
                            )}
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

      {/* Account bar — desktop */}
      <div className="hidden lg:block sticky top-16 z-40 border-b" style={{ background: "#0D0D1F", borderColor: "rgba(124,58,237,0.12)" }}>
        <div className="max-w-[1200px] mx-auto px-6 flex items-center h-11 text-sm gap-3">
          <span className="font-semibold" style={{ color: "#a78bfa" }}>MonNivra</span>
          <span style={{ color: "rgba(124,58,237,0.4)" }}>·</span>
          <span style={{ color: "#A0A0B8" }}>
            {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Client"}
          </span>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed top-0 left-0 h-full w-[85vw] max-w-[320px] z-50 shadow-2xl lg:hidden overflow-y-auto" style={{ background: "#111122", borderRight: "1px solid rgba(124,58,237,0.2)" }}>
            <div className="flex items-center justify-between px-4 h-14 border-b" style={{ borderColor: "rgba(124,58,237,0.15)" }}>
              <span className="font-bold text-base" style={{ color: "#a78bfa" }}>MonNivra</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg transition-colors" style={{ color: "#A0A0B8" }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(124,58,237,0.15)", background: "rgba(124,58,237,0.08)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(124,58,237,0.2)" }}>
                  <User className="w-5 h-5" style={{ color: "#a78bfa" }} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: "#FFFFFF" }}>{user?.user_metadata?.full_name || "Client"}</p>
                  <p className="text-xs truncate" style={{ color: "#A0A0B8" }}>{user?.email}</p>
                </div>
              </div>
            </div>

            <nav className="p-3 space-y-0.5">
              {navGroups.map((group, idx) => (
                <div key={idx}>
                  {group.path && group.children.length === 0 ? (
                    <Link
                      to={group.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium min-h-[44px] transition-colors",
                      )}
                      style={isActive(group.path)
                        ? { background: "rgba(124,58,237,0.25)", color: "#FFFFFF" }
                        : { color: "#D0D0E8" }
                      }
                    >
                      <span>{group.label}</span>
                      {group.badgeKey && sectionBadges[group.badgeKey]?.show && (
                        <SectionBadge show variant={sectionBadges[group.badgeKey]?.urgent ? "dot-pulse" : "dot"} ariaLabel={`${group.label} nécessite votre attention`} />
                      )}
                    </Link>
                  ) : (
                    <>
                      <p className="px-4 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider flex items-center justify-between" style={{ color: "#6B6B85" }}>
                        <span>{group.label}</span>
                        {group.badgeKey && sectionBadges[group.badgeKey]?.show && (
                          <SectionBadge show variant={sectionBadges[group.badgeKey]?.urgent ? "dot-pulse" : "dot"} ariaLabel={`${group.label} nécessite votre attention`} />
                        )}
                      </p>
                      {group.children.map((child) => (
                        <Link
                          key={child.path}
                          to={child.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-sm min-h-[44px] transition-colors",
                          )}
                          style={isActive(child.path)
                            ? { background: "rgba(124,58,237,0.2)", color: "#a78bfa", fontWeight: 600 }
                            : { color: "#B0B0CC" }
                          }
                        >
                          <span>{child.label}</span>
                          {child.badgeKey && sectionBadges[child.badgeKey]?.show && (
                            <SectionBadge show variant={sectionBadges[child.badgeKey]?.urgent ? "dot-pulse" : "dot"} ariaLabel={`${child.label} nécessite votre attention`} />
                          )}
                        </Link>
                      ))}
                    </>
                  )}
                </div>
              ))}
            </nav>

            <div className="border-t p-3 space-y-0.5 mt-2" style={{ borderColor: "rgba(124,58,237,0.15)" }}>
              <Link to="/" className="flex items-center px-4 py-3 text-sm rounded-xl min-h-[44px] transition-colors" style={{ color: "#A0A0B8" }}>
                Retour au site Nivra
              </Link>
              {hasStaffRole && (
                <button
                  onClick={() => navigate('/nivra-secure-hub-2617-internal')}
                  className="w-full text-left px-4 py-3 text-sm rounded-xl flex items-center gap-2 min-h-[44px] transition-colors"
                  style={{ color: "#A0A0B8" }}
                >
                  <LayoutGrid className="w-4 h-4" />
                  Changer de portail
                </button>
              )}
              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 py-3 text-sm rounded-xl flex items-center gap-2 min-h-[44px] transition-colors"
                style={{ color: "#f87171" }}
              >
                <LogOut className="w-4 h-4" />
                Déconnexion
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main content — dashboard manages its own bg/padding */}
      <main className="flex-1" style={{ background: "#020209" }}>
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-5 mt-auto border-t" style={{ background: "#0D0D1F", borderColor: "rgba(124,58,237,0.15)" }}>
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 text-center text-xs space-y-1" style={{ color: "#6B6B85" }}>
          <p>© {new Date().getFullYear()} Nivra Télécom. Tous droits réservés.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <Link to="/privacy-policy" className="transition-colors hover:text-white">Confidentialité</Link>
            <span style={{ color: "rgba(124,58,237,0.3)" }}>·</span>
            <Link to="/conditions-de-service" className="transition-colors hover:text-white">Conditions</Link>
            <span style={{ color: "rgba(124,58,237,0.3)" }}>·</span>
            <Link to="/contact" className="transition-colors hover:text-white">Support</Link>
            <span style={{ color: "rgba(124,58,237,0.3)" }}>·</span>
            <Link to="/plainte" className="inline-flex items-center gap-1 transition-colors hover:text-white">
              <AlertCircle className="w-3.5 h-3.5" />
              Plainte
            </Link>
          </div>
        </div>
      </footer>
    </div>
    </ImpersonationProvider>
  );
};

export default ClientLayout;
