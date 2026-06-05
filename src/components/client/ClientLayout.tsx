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
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <PortalSystemStatusBanner userType="client" />
      <AccountBlockedBanner />
      {user?.id && <PrepaidUrgentBanner userId={user.id} />}

      {/* Top utility bar — desktop only */}
      <div className="bg-card border-b border-border hidden lg:block">
        <div className="max-w-[1200px] mx-auto px-6 flex items-center justify-end gap-6 h-9 text-xs text-muted-foreground">
          <Link to="/" className="hover:text-primary transition-colors">
            Retour au site Nivra
          </Link>
          <span className="text-border">|</span>
          <span className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            {user?.email}
          </span>
          <button onClick={handleSignOut} className="hover:text-primary transition-colors flex items-center gap-1">
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
                        <span className="relative inline-flex items-center">
                          {group.label}
                          {group.badgeKey && sectionBadges[group.badgeKey]?.show && (
                            <span className="ml-1.5 inline-flex">
                              <SectionBadge
                                show
                                variant={sectionBadges[group.badgeKey]?.urgent ? "dot-pulse" : "dot"}
                                ariaLabel={`${group.label} nécessite votre attention`}
                              />
                            </span>
                          )}
                        </span>
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
                        {group.label === "Mes points" && typeof pointsBalance === "number" && (
                          <Badge className="bg-amber-400 text-slate-900 text-[10px] px-1.5 py-0 ml-1.5 min-w-[18px]">
                            {pointsBalance}
                          </Badge>
                        )}
                      </Link>
                    )}

                    {hasChildren && openDropdown === idx && (
                      <div className="absolute top-full left-0 mt-1 w-64 bg-card rounded-xl shadow-xl border border-border py-2 z-50">
                        {group.children.map((child) => (
                          <Link
                            key={child.path}
                            to={child.path}
                            onClick={() => setOpenDropdown(null)}
                            className={cn(
                              "flex items-center justify-between gap-2 px-4 py-2.5 text-sm transition-colors",
                              isActive(child.path)
                                ? "bg-primary/15 text-primary font-medium"
                                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                            )}
                          >
                            <span>{child.label}</span>
                            {child.badgeKey && sectionBadges[child.badgeKey]?.show && (
                              <SectionBadge
                                show
                                variant={sectionBadges[child.badgeKey]?.urgent ? "dot-pulse" : "dot"}
                                ariaLabel={`${child.label} nécessite votre attention`}
                              />
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

      {/* Secondary nav bar — desktop */}
      <div className="bg-card border-b border-border hidden lg:block sticky top-16 z-40">
        <div className="max-w-[1200px] mx-auto px-6 flex items-center h-12 text-sm">
          <span className="font-semibold text-foreground mr-4">MonNivra</span>
          <span className="text-border mr-4">|</span>
          <span className="text-muted-foreground">
            {user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Client"}
          </span>
        </div>
      </div>

      {/* Mobile menu — full-height LEFT drawer */}
      {mobileMenuOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
          <div className="fixed top-0 left-0 h-full w-[85vw] max-w-[320px] bg-card z-50 shadow-2xl lg:hidden overflow-y-auto border-r border-border">
            <div className="p-4 border-b border-border flex items-center justify-between h-14">
              <span className="font-semibold text-foreground text-base">MonNivra</span>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-muted-foreground hover:text-foreground rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-border bg-secondary/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">
                    {user?.user_metadata?.full_name || "Client"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
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
                        "flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium min-h-[44px] transition-colors",
                        isActive(group.path)
                          ? "bg-primary text-white"
                          : "text-foreground hover:bg-secondary/60 active:bg-secondary"
                      )}
                    >
                      <span>{group.label}</span>
                      {group.badgeKey && sectionBadges[group.badgeKey]?.show && (
                        <SectionBadge
                          show
                          variant={sectionBadges[group.badgeKey]?.urgent ? "dot-pulse" : "dot"}
                          ariaLabel={`${group.label} nécessite votre attention`}
                        />
                      )}
                    </Link>
                  ) : (
                    <>
                      <p className="px-4 pt-4 pb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                        <span>{group.label}</span>
                        {group.badgeKey && sectionBadges[group.badgeKey]?.show && (
                          <SectionBadge
                            show
                            variant={sectionBadges[group.badgeKey]?.urgent ? "dot-pulse" : "dot"}
                            ariaLabel={`${group.label} nécessite votre attention`}
                          />
                        )}
                      </p>
                      {group.children.map((child) => (
                        <Link
                          key={child.path}
                          to={child.path}
                          onClick={() => setMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-sm min-h-[44px] transition-colors",
                            isActive(child.path)
                              ? "bg-primary/15 text-primary font-medium"
                              : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground active:bg-secondary"
                          )}
                        >
                          <span>{child.label}</span>
                          {child.badgeKey && sectionBadges[child.badgeKey]?.show && (
                            <SectionBadge
                              show
                              variant={sectionBadges[child.badgeKey]?.urgent ? "dot-pulse" : "dot"}
                              ariaLabel={`${child.label} nécessite votre attention`}
                            />
                          )}
                        </Link>
                      ))}
                    </>
                  )}
                </div>
              ))}
            </nav>

            <div className="p-4 border-t border-border mt-2 space-y-1">
              <Link to="/" className="flex items-center px-4 py-3 text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground rounded-xl min-h-[44px] transition-colors">
                Retour au site Nivra
              </Link>
              {hasStaffRole && (
                <button
                  onClick={() => navigate('/nivra-secure-hub-2617-internal')}
                  className="w-full text-left px-4 py-3 text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground rounded-xl flex items-center gap-2 min-h-[44px] border-t border-border pt-3 mt-1 transition-colors"
                >
                  <LayoutGrid className="w-4 h-4" />
                  Changer de portail
                </button>
              )}
              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 py-3 text-sm text-destructive hover:bg-destructive/10 rounded-xl flex items-center gap-2 min-h-[44px] transition-colors"
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
      <footer className="bg-card border-t border-border py-5 mt-auto">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 text-center text-xs text-muted-foreground space-y-1">
          <p>© {new Date().getFullYear()} Nivra Télécom. Tous droits réservés.</p>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <Link to="/privacy-policy" className="hover:text-primary transition-colors">Confidentialité</Link>
            <span className="text-border">·</span>
            <Link to="/conditions-de-service" className="hover:text-primary transition-colors">Conditions</Link>
            <span className="text-border">·</span>
            <Link to="/contact" className="hover:text-primary transition-colors">Support</Link>
            <span className="text-border">·</span>
            <Link to="/plainte" className="inline-flex items-center gap-1 hover:text-primary transition-colors">
              <AlertCircle className="w-3.5 h-3.5" />
              Soumettre une plainte
            </Link>
          </div>
        </div>
      </footer>
    </div>
    </ImpersonationProvider>
  );
};

export default ClientLayout;
