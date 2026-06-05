import ClientLayout from "@/components/client/ClientLayout";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useClientAccountIdentity } from "@/hooks/useClientAccountIdentity";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import ClientBalanceSummary from "@/components/client/ClientBalanceSummary";
import ServiceCountdown from "@/components/client/ServiceCountdown";
import { ClientPaymentMethodCard } from "@/components/client/ClientPaymentMethodCard";
import AccountStateBanner from "@/components/client/AccountStateBanner";
import EmailClaimBanner from "@/components/client/EmailClaimBanner";
import {
  Wifi, Smartphone, Tv, ChevronRight, Copy, FileText,
  CreditCard, AlertCircle, Package, ArrowRight, Settings,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import ReferralPopup from "@/components/client/ReferralPopup";
import { getCycleDisplay } from "@/lib/billingCycleDisplay";

/* ── Service helpers ─────────────────────────────────────────── */
const SERVICE_CONFIG: Record<string, { icon: React.ReactNode; accent: string; bg: string; label: string }> = {
  internet: {
    icon: <Wifi className="w-5 h-5 text-emerald-600" />,
    accent: "#059669",
    bg: "#ecfdf5",
    label: "Internet",
  },
  mobile: {
    icon: <Smartphone className="w-5 h-5 text-violet-600" />,
    accent: "#7c3aed",
    bg: "#f5f3ff",
    label: "Mobile",
  },
  tv: {
    icon: <Tv className="w-5 h-5 text-amber-600" />,
    accent: "#d97706",
    bg: "#fffbeb",
    label: "Télévision",
  },
};

const getServiceCfg = (type: string) =>
  SERVICE_CONFIG[type] || {
    icon: <Package className="w-5 h-5 text-gray-500" />,
    accent: "#6b7280",
    bg: "#f9fafb",
    label: type,
  };

const StatusPill = ({ status }: { status: string }) => {
  const cfg: Record<string, { label: string; cls: string }> = {
    active:    { label: "Actif",      cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
    suspended: { label: "Suspendu",   cls: "bg-red-50 text-red-700 border border-red-200" },
    pending:   { label: "En attente", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
    paused:    { label: "En pause",   cls: "bg-blue-50 text-blue-700 border border-blue-200" },
  };
  const c = cfg[status] || { label: status, cls: "bg-gray-50 text-gray-600 border border-gray-200" };
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ml-2 ${c.cls}`}>{c.label}</span>;
};

/* ── Component ───────────────────────────────────────────────── */
const ClientDashboard = () => {
  const { user } = useClientAuth();
  const navigate = useNavigate();
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem("nivra_welcomed"));
  const { data: accountIdentity } = useClientAccountIdentity(user?.id);
  const { data: canonicalData } = useCanonicalClientData(user?.id);

  const profile   = canonicalData?.profile;
  const account   = canonicalData?.account;
  const orders    = canonicalData?.orders?.slice(0, 3) || [];
  const allSubs   = (canonicalData?.subscriptions || [])
    .filter((s: any) => !["cancelled", "expired"].includes(String(s?.status || "").toLowerCase()))
    .map((s: any) => ({
      id: s.id,
      plan_name: s.plan_name,
      amount: s.plan_price,
      service_type: s.service_category || (
        s.plan_name?.toLowerCase().includes("internet") ? "internet" :
        s.plan_name?.toLowerCase().includes("tv")       ? "tv"       : "mobile"
      ),
      status: s.status,
      cycle_start_date: s.cycle_start_date,
      cycle_end_date:   s.cycle_end_date,
    }));

  const firstName     = profile?.full_name?.split(" ")[0] || user?.user_metadata?.full_name?.split(" ")[0] || "Client";
  const accountNumber = account?.account_number || accountIdentity?.accountNumber || "—";
  const activeCount   = allSubs.filter((s: any) => String(s.status).toLowerCase() === "active").length;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié");
  };

  const orderStatusCfg = (status: string) => {
    if (status === "completed") return { label: "Terminé",  cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" };
    if (status === "shipped")   return { label: "Expédié",  cls: "bg-violet-50 text-violet-700 border border-violet-200" };
    if (["cancelled","cancel"].includes(status)) return { label: "Annulé", cls: "bg-red-50 text-red-700 border border-red-200" };
    return { label: "En cours", cls: "bg-amber-50 text-amber-700 border border-amber-200" };
  };

  /* card style */
  const card = "bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden";
  const cardHeader = "px-6 py-4 border-b border-gray-100 flex items-center justify-between";
  const sectionTitle = "text-base font-bold text-gray-900";
  const viewAll = "text-sm font-medium text-[#6b21e8] hover:text-[#5b17d4] flex items-center gap-1 transition-colors";

  return (
    <ClientLayout>
      <ReferralPopup />
      <div className="space-y-5" data-testid="portal-dashboard">

        {/* ── HERO BANNER ───────────────────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden shadow-sm"
          style={{ background: "linear-gradient(135deg, #4c1d95 0%, #6d28d9 55%, #4338ca 100%)" }}>
          <div className="relative px-6 py-7 sm:px-8 sm:py-8">
            {/* Decorative circle */}
            <div className="absolute right-0 top-0 w-64 h-64 rounded-full opacity-10 -translate-y-1/2 translate-x-1/3"
              style={{ background: "radial-gradient(circle, #c4b5fd, transparent)" }} />

            {showWelcome ? (
              <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="text-white">
                  <p className="text-white/70 text-sm mb-0.5">Bienvenue chez Nivra Télécom</p>
                  <h1 className="text-2xl sm:text-3xl font-bold">Bonjour, {firstName} !</h1>
                  <p className="text-white/75 text-sm mt-2 max-w-md">
                    Votre service sera activé sous 24h. Un courriel de confirmation vous a été envoyé.
                  </p>
                </div>
                <button
                  onClick={() => { setShowWelcome(false); localStorage.setItem("nivra_welcomed","1"); }}
                  className="shrink-0 px-4 py-2 rounded-xl text-sm text-white/90 hover:text-white border border-white/25 hover:border-white/50 transition-colors"
                >
                  Compris ✓
                </button>
              </div>
            ) : (
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-5">
                <div className="text-white">
                  <p className="text-white/65 text-sm mb-0.5">MonNivra · Portail client</p>
                  <h1 className="text-2xl sm:text-3xl font-bold">Bonjour, {firstName}</h1>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-white/65 text-sm">Compte</span>
                      <span className="text-white font-mono text-sm font-semibold tracking-wide">{accountNumber}</span>
                      <button onClick={() => copyToClipboard(accountNumber)} className="p-0.5 text-white/50 hover:text-white transition-colors" title="Copier">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {activeCount > 0 && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/15 text-white">
                        {activeCount} service{activeCount > 1 ? "s" : ""} actif{activeCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
                {/* Quick CTAs */}
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    onClick={() => navigate("/portal/billing")}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white text-[#6d28d9] hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    <CreditCard className="w-4 h-4" />
                    Faire un paiement
                  </button>
                  <Link to="/portal/services"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/25 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Mes services
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── SYSTEM BANNERS ────────────────────────────────────────── */}
        {canonicalData?.identifiers?.usedFallbackLinks && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Certaines données ont été reliées via votre courriel. Si une commande semble manquante, contactez le support.
          </div>
        )}
        {account?.id && <AccountStateBanner accountId={account.id} />}
        <EmailClaimBanner />

        {/* ── SOLDE + PAIEMENT ──────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className={card}>
            <div className={cardHeader}>
              <h2 className={sectionTitle}>Solde et facturation</h2>
              <Link to="/portal/invoices" className={viewAll}>
                Voir les factures <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="px-6 py-5 space-y-4">
              {user?.id && <ClientBalanceSummary userId={user.id} />}
              <div className="flex gap-3 pt-1">
                <Button
                  className="flex-1 h-11 text-sm font-semibold rounded-xl text-white"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #4338ca)" }}
                  onClick={() => navigate("/portal/billing")}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Faire un paiement
                </Button>
                <Link to="/portal/invoices" className="flex-1">
                  <Button variant="outline" className="w-full h-11 text-sm font-semibold rounded-xl border-gray-300 text-gray-700 hover:bg-gray-50">
                    <FileText className="w-4 h-4 mr-2" />
                    Mes factures
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          <div className={card}>
            <div className={cardHeader}>
              <h2 className={sectionTitle}>Mode de paiement</h2>
            </div>
            <div className="px-6 py-5">
              <ClientPaymentMethodCard />
            </div>
          </div>
        </div>

        {/* ── SERVICE COUNTDOWN ─────────────────────────────────────── */}
        {user?.id && <ServiceCountdown userId={user.id} />}

        {/* ── MES SERVICES ──────────────────────────────────────────── */}
        {allSubs.length > 0 ? (
          <div className={card}>
            <div className={cardHeader}>
              <h2 className={sectionTitle}>Mes services actifs</h2>
              <Link to="/portal/services" className={viewAll}>
                Gérer <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div>
              {allSubs.map((sub: any, i: number) => {
                const cfg   = getServiceCfg(sub.service_type);
                const cycle = getCycleDisplay(sub);
                return (
                  <div
                    key={sub.id}
                    className="px-6 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    style={{ borderTop: i === 0 ? undefined : "1px solid #f1f1f1" }}
                    onClick={() => navigate("/portal/services")}
                  >
                    {/* Accent bar */}
                    <div className="w-1 self-stretch rounded-full shrink-0" style={{ background: cfg.accent, minHeight: 40 }} />
                    {/* Icon */}
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: cfg.bg }}>
                      {cfg.icon}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap">
                        <span className="font-semibold text-gray-900 text-sm">{sub.plan_name}</span>
                        <StatusPill status={sub.status} />
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {Number(sub.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois
                        {cycle.isActive && cycle.nextRenewal && (
                          <> · Renouvellement le {format(new Date(cycle.nextRenewal), "d MMM yyyy", { locale: fr })}</>
                        )}
                        {!cycle.isActive && (
                          <span className="text-amber-600"> · Démarre à l'activation</span>
                        )}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={`${card} text-center py-12`}>
            <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="font-semibold text-gray-800 text-base mb-1">Aucun service actif</p>
            <p className="text-sm text-gray-500 mb-6">Vous n'avez aucun service actif pour le moment.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => navigate("/portal/new-order")}
                className="text-sm font-semibold text-white rounded-xl h-11 px-6"
                style={{ background: "linear-gradient(135deg, #7c3aed, #4338ca)" }}
              >
                Découvrir nos forfaits <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Link to="/telephones">
                <Button variant="outline" className="h-11 px-6 text-sm font-semibold rounded-xl border-gray-300 text-gray-700 hover:bg-gray-50">
                  Commander un téléphone
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* ── COMMANDES RÉCENTES ────────────────────────────────────── */}
        {orders.length > 0 && (
          <div className={card}>
            <div className={cardHeader}>
              <h2 className={sectionTitle}>Commandes récentes</h2>
              <Link to="/portal/orders" className={viewAll}>
                Voir tout <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div>
              {orders.map((order: any, i: number) => {
                const sc = orderStatusCfg(order.status);
                return (
                  <div key={order.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    style={{ borderTop: i === 0 ? undefined : "1px solid #f1f1f1" }}>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{order.service_type}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {order.order_number || `#${order.id.slice(0, 8)}`} · {format(new Date(order.created_at), "d MMM yyyy", { locale: fr })}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${sc.cls}`}>{sc.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── PLAINTE ───────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-900">Une insatisfaction à signaler ?</p>
              <p className="text-xs text-red-600 mt-0.5">Soumettez une plainte officielle. SLA de traitement garanti.</p>
            </div>
          </div>
          <Link to="/plainte" className="shrink-0">
            <Button variant="outline" className="h-9 text-sm font-medium rounded-xl border-red-300 text-red-700 hover:bg-red-100 bg-transparent">
              Soumettre une plainte
            </Button>
          </Link>
        </div>

      </div>
    </ClientLayout>
  );
};

export default ClientDashboard;
