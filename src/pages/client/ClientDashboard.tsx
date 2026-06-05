import ClientLayout from "@/components/client/ClientLayout";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useClientAccountIdentity } from "@/hooks/useClientAccountIdentity";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import ClientBalanceSummary from "@/components/client/ClientBalanceSummary";
import ServiceCountdown from "@/components/client/ServiceCountdown";
import { ClientPaymentMethodCard } from "@/components/client/ClientPaymentMethodCard";
import AccountStateBanner from "@/components/client/AccountStateBanner";
import EmailClaimBanner from "@/components/client/EmailClaimBanner";
import {
  Wifi, Smartphone, Tv, ChevronRight, Copy, FileText,
  CreditCard, AlertCircle, Package, ArrowRight, CheckCircle2, Clock,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import ReferralPopup from "@/components/client/ReferralPopup";
import { getCycleDisplay } from "@/lib/billingCycleDisplay";

const HERO_GRADIENT = "linear-gradient(135deg, #3b0764 0%, #4338ca 45%, #1e1b4b 100%)";
const CARD_BG = "#13132a";
const CARD_BORDER = "rgba(124, 58, 237, 0.22)";
const CARD_HOVER = "rgba(124, 58, 237, 0.10)";

const serviceIcon = (type: string) => {
  if (type === "mobile") return <Smartphone className="w-5 h-5" style={{ color: "#a78bfa" }} />;
  if (type === "tv")     return <Tv className="w-5 h-5" style={{ color: "#f59e0b" }} />;
  return <Wifi className="w-5 h-5" style={{ color: "#34d399" }} />;
};

const serviceAccent = (type: string) => {
  if (type === "mobile") return "#7c3aed";
  if (type === "tv")     return "#d97706";
  return "#059669";
};

const ClientDashboard = () => {
  const { user } = useClientAuth();
  const navigate = useNavigate();
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem("nivra_welcomed"));
  const { data: accountIdentity } = useClientAccountIdentity(user?.id);
  const { data: canonicalData } = useCanonicalClientData(user?.id);

  const profile   = canonicalData?.profile;
  const account   = canonicalData?.account;
  const orders    = canonicalData?.orders?.slice(0, 3) || [];
  const subscriptions = (canonicalData?.subscriptions || [])
    .filter((s: any) => !["cancelled", "expired"].includes(String(s?.status || "").toLowerCase()))
    .map((s: any) => ({
      id: s.id,
      plan_name: s.plan_name,
      amount: s.plan_price,
      billing_cycle: "monthly",
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié");
  };

  const mobileServices  = subscriptions.filter((s: any) => s.service_type === "mobile" || s.plan_name?.toLowerCase().includes("mobile"));
  const internetServices = subscriptions.filter((s: any) => s.service_type === "internet" || s.plan_name?.toLowerCase().includes("internet"));
  const tvServices      = subscriptions.filter((s: any) => s.service_type === "tv" || s.plan_name?.toLowerCase().includes("tv"));
  const allServices     = [...internetServices, ...mobileServices, ...tvServices];
  const activeCount     = subscriptions.filter((s: any) => String(s.status).toLowerCase() === "active").length;

  const statusLabel = (status: string) => {
    const cfg: Record<string, { label: string; bg: string; color: string }> = {
      active:    { label: "Actif",      bg: "rgba(16,185,129,0.15)",  color: "#34d399" },
      suspended: { label: "Suspendu",   bg: "rgba(239,68,68,0.15)",   color: "#f87171" },
      pending:   { label: "En attente", bg: "rgba(245,158,11,0.15)",  color: "#fbbf24" },
      paused:    { label: "En pause",   bg: "rgba(99,102,241,0.15)",  color: "#a5b4fc" },
    };
    const c = cfg[status] || { label: status, bg: "rgba(255,255,255,0.08)", color: "#c4c4e0" };
    return (
      <span
        className="text-[11px] font-semibold px-2 py-0.5 rounded-full ml-2"
        style={{ background: c.bg, color: c.color }}
      >
        {c.label}
      </span>
    );
  };

  const orderStatusConfig = (status: string) => {
    if (status === "completed") return { label: "Terminé",    bg: "rgba(16,185,129,0.15)",  color: "#34d399" };
    if (status === "shipped")   return { label: "Expédié",    bg: "rgba(124,58,237,0.15)",  color: "#a78bfa" };
    if (status === "cancelled" || status === "cancel") return { label: "Annulé", bg: "rgba(239,68,68,0.15)", color: "#f87171" };
    return { label: "En cours", bg: "rgba(245,158,11,0.15)", color: "#fbbf24" };
  };

  return (
    <ClientLayout>
      <ReferralPopup />
      <div className="space-y-5" data-testid="portal-dashboard">

        {/* ── HERO GRADIENT BANNER ──────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl" style={{ background: HERO_GRADIENT }}>
          {/* Decorative orbs */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, #a78bfa, transparent)" }} />
          <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full opacity-15"
            style={{ background: "radial-gradient(circle, #6366f1, transparent)" }} />

          <div className="relative z-10 px-6 py-7 sm:px-8 sm:py-8">
            {/* Welcome banner (first time) */}
            {showWelcome ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="text-white">
                  <p className="text-white/70 text-sm font-medium mb-1">Bienvenue chez Nivra Télécom</p>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                    Bonjour, {firstName} !
                  </h1>
                  <p className="text-white/75 text-sm mt-2">
                    Votre service sera activé sous 24h. Gardez un œil sur votre courriel de confirmation.
                  </p>
                </div>
                <button
                  onClick={() => { setShowWelcome(false); localStorage.setItem("nivra_welcomed", "1"); }}
                  className="shrink-0 text-sm text-white/90 hover:text-white px-4 py-2 rounded-xl border border-white/20 hover:border-white/40 transition-colors"
                >
                  Compris ✓
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
                <div className="text-white">
                  <p className="text-white/65 text-sm font-medium mb-0.5">MonNivra</p>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                    Bonjour, {firstName}
                  </h1>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-white/70 text-sm">Compte</span>
                    <span className="text-white font-mono text-sm font-semibold">{accountNumber}</span>
                    <button
                      onClick={() => copyToClipboard(accountNumber)}
                      className="p-1 text-white/50 hover:text-white/90 transition-colors"
                      title="Copier"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {activeCount > 0 && (
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full ml-1"
                        style={{ background: "rgba(52,211,153,0.2)", color: "#34d399" }}
                      >
                        {activeCount} service{activeCount > 1 ? "s" : ""} actif{activeCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>

                {/* CTA buttons */}
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    onClick={() => navigate("/portal/billing")}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                    style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.22)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
                  >
                    <CreditCard className="w-4 h-4" />
                    Payer
                  </button>
                  <Link
                    to="/portal/invoices"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                    style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.18)" }}
                  >
                    <FileText className="w-4 h-4" />
                    Factures
                  </Link>
                  <Link
                    to="/portal/services"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
                    style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.18)" }}
                  >
                    <Package className="w-4 h-4" />
                    Services
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── SYSTEM BANNERS ────────────────────────────────────────── */}
        {canonicalData?.identifiers?.usedFallbackLinks && (
          <div className="rounded-xl border px-4 py-3 text-sm"
            style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.25)", color: "#fbbf24" }}>
            Certaines données ont été reliées via votre courriel. Si une commande semble manquante, contactez le support.
          </div>
        )}
        {account?.id && <AccountStateBanner accountId={account.id} />}
        <EmailClaimBanner />

        {/* ── BALANCE + PAYMENT METHOD ──────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl p-5 flex flex-col gap-3"
            style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold" style={{ color: "#e0e0f0" }}>Solde et facturation</h2>
              <Link to="/portal/invoices"
                className="text-xs font-medium flex items-center gap-1 transition-colors"
                style={{ color: "#a78bfa" }}>
                Voir tout <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            {user?.id && <ClientBalanceSummary userId={user.id} />}
            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 h-10 text-sm font-semibold rounded-xl text-white"
                style={{ background: "linear-gradient(135deg, #7c3aed, #4338ca)" }}
                onClick={() => navigate("/portal/billing")}
              >
                <CreditCard className="w-4 h-4 mr-2" /> Faire un paiement
              </Button>
              <Link to="/portal/invoices" className="flex-1">
                <Button variant="outline" className="w-full h-10 text-sm font-semibold rounded-xl"
                  style={{ borderColor: CARD_BORDER, color: "#a78bfa", background: "transparent" }}>
                  <FileText className="w-4 h-4 mr-2" /> Mes factures
                </Button>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl p-5"
            style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
            <h2 className="text-base font-semibold mb-3" style={{ color: "#e0e0f0" }}>Mode de paiement</h2>
            <ClientPaymentMethodCard />
          </div>
        </div>

        {/* ── SERVICE COUNTDOWN ─────────────────────────────────────── */}
        {user?.id && <ServiceCountdown userId={user.id} />}

        {/* ── MES SERVICES ──────────────────────────────────────────── */}
        {allServices.length > 0 ? (
          <div className="rounded-2xl overflow-hidden"
            style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
            <div className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
              <h2 className="text-base font-semibold" style={{ color: "#e0e0f0" }}>Mes services</h2>
              <Link to="/portal/services"
                className="text-xs font-medium flex items-center gap-1"
                style={{ color: "#a78bfa" }}>
                Gérer <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="divide-y" style={{ borderColor: CARD_BORDER }}>
              {allServices.map((sub: any) => {
                const cycle  = getCycleDisplay(sub);
                const accent = serviceAccent(sub.service_type);
                return (
                  <div key={sub.id}
                    className="px-6 py-4 flex items-center gap-4 transition-colors cursor-pointer"
                    style={{ borderBottom: `1px solid ${CARD_BORDER}` }}
                    onClick={() => navigate("/portal/services")}>
                    {/* Colored left accent */}
                    <div className="w-1 self-stretch rounded-full shrink-0"
                      style={{ background: accent }} />
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${accent}22` }}>
                      {serviceIcon(sub.service_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap">
                        <span className="font-semibold text-sm" style={{ color: "#f0f0ff" }}>
                          {sub.plan_name}
                        </span>
                        {statusLabel(sub.status)}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: "#9090b0" }}>
                        {Number(sub.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois
                        {cycle.isActive && cycle.nextRenewal && (
                          <span className="ml-2">
                            · Renouvellement {format(new Date(cycle.nextRenewal), "d MMM yyyy", { locale: fr })}
                          </span>
                        )}
                        {!cycle.isActive && (
                          <span className="ml-2" style={{ color: "#fbbf24" }}>· Démarre à l'activation</span>
                        )}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "#6060a0" }} />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl p-8 text-center"
            style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
            <Package className="w-10 h-10 mx-auto mb-3" style={{ color: "#7c3aed" }} />
            <p className="font-semibold text-base mb-1" style={{ color: "#e0e0f0" }}>Aucun service actif</p>
            <p className="text-sm mb-5" style={{ color: "#7070a0" }}>Vous n'avez aucun service actif pour le moment.</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button
                onClick={() => navigate("/portal/new-order")}
                className="text-sm font-semibold text-white rounded-xl h-10"
                style={{ background: "linear-gradient(135deg, #7c3aed, #4338ca)" }}>
                Découvrir nos forfaits <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Link to="/telephones">
                <Button variant="outline" className="w-full h-10 text-sm font-semibold rounded-xl"
                  style={{ borderColor: CARD_BORDER, color: "#a78bfa", background: "transparent" }}>
                  Commander un téléphone
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* ── COMMANDES RÉCENTES ────────────────────────────────────── */}
        {orders.length > 0 && (
          <div className="rounded-2xl overflow-hidden"
            style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}>
            <div className="px-6 py-4 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
              <h2 className="text-base font-semibold" style={{ color: "#e0e0f0" }}>Commandes récentes</h2>
              <Link to="/portal/orders"
                className="text-xs font-medium flex items-center gap-1"
                style={{ color: "#a78bfa" }}>
                Voir tout <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div>
              {orders.map((order: any) => {
                const sc = orderStatusConfig(order.status);
                return (
                  <div key={order.id}
                    className="px-6 py-4 flex items-center justify-between"
                    style={{ borderBottom: `1px solid rgba(124,58,237,0.08)` }}>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#e0e0f0" }}>
                        {order.service_type}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "#7070a0" }}>
                        {order.order_number || `#${order.id.slice(0, 8)}`} · {format(new Date(order.created_at), "d MMM yyyy", { locale: fr })}
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: sc.bg, color: sc.color }}>
                      {sc.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── SIGNALER UNE INSATISFACTION ───────────────────────────── */}
        <div className="rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
          style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.20)" }}>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#f87171" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "#fca5a5" }}>Une insatisfaction à signaler ?</p>
              <p className="text-xs mt-0.5" style={{ color: "#9090b0" }}>Soumettez une plainte officielle. SLA de traitement garanti.</p>
            </div>
          </div>
          <Link to="/plainte" className="shrink-0">
            <Button variant="outline" className="h-9 text-sm rounded-xl font-medium"
              style={{ borderColor: "rgba(239,68,68,0.35)", color: "#f87171", background: "transparent" }}>
              Soumettre une plainte
            </Button>
          </Link>
        </div>

      </div>
    </ClientLayout>
  );
};

export default ClientDashboard;
