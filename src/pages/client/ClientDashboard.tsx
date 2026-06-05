import ClientLayout from "@/components/client/ClientLayout";
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
  CreditCard, AlertCircle, Package, ArrowRight, CheckCircle2,
  Clock, Settings, Bell, Shield, HelpCircle, Gift,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import ReferralPopup from "@/components/client/ReferralPopup";
import { getCycleDisplay } from "@/lib/billingCycleDisplay";

/* ─── Design tokens ────────────────────────────────────────── */
const T = {
  bg:        "#F4F5F9",
  white:     "#FFFFFF",
  primary:   "#5B21B6",
  primary2:  "#7C3AED",
  navy:      "#0F172A",
  body:      "#334155",
  muted:     "#64748B",
  border:    "#E2E8F0",
  success:   "#059669",
  warning:   "#D97706",
  error:     "#DC2626",
};

/* ─── Service config ───────────────────────────────────────── */
const SVC: Record<string, { icon: React.ReactNode; gradient: string; tag: string }> = {
  internet: {
    icon:     <Wifi className="w-6 h-6 text-white" />,
    gradient: "linear-gradient(135deg,#059669,#10b981)",
    tag:      "Internet",
  },
  mobile: {
    icon:     <Smartphone className="w-6 h-6 text-white" />,
    gradient: "linear-gradient(135deg,#7c3aed,#a78bfa)",
    tag:      "Mobile",
  },
  tv: {
    icon:     <Tv className="w-6 h-6 text-white" />,
    gradient: "linear-gradient(135deg,#d97706,#fbbf24)",
    tag:      "Télévision",
  },
};
const svcCfg = (t: string) =>
  SVC[t] ?? { icon: <Package className="w-6 h-6 text-white" />, gradient: "linear-gradient(135deg,#475569,#94a3b8)", tag: t };

/* ─── Status pill ──────────────────────────────────────────── */
const Pill = ({ status }: { status: string }) => {
  const map: Record<string, [string, string]> = {
    active:    ["#dcfce7","#166534"],
    pending:   ["#fef3c7","#92400e"],
    suspended: ["#fee2e2","#991b1b"],
    paused:    ["#ede9fe","#5b21b6"],
  };
  const [bg, color] = map[status] ?? ["#f1f5f9","#334155"];
  const labels: Record<string,string> = { active:"Actif", pending:"En attente", suspended:"Suspendu", paused:"En pause" };
  return (
    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: bg, color }}>
      {labels[status] ?? status}
    </span>
  );
};

/* ─── Metric tile ──────────────────────────────────────────── */
const Tile = ({ label, value, sub, gradient, icon }: {
  label: string; value: React.ReactNode; sub?: string;
  gradient: string; icon: React.ReactNode;
}) => (
  <div className="rounded-2xl p-5 flex flex-col justify-between min-h-[120px] relative overflow-hidden" style={{ background: gradient }}>
    <div className="absolute inset-0 opacity-10" style={{ background: "radial-gradient(circle at 80% 20%, white, transparent)" }} />
    <div className="flex items-start justify-between relative z-10">
      <p className="text-white/80 text-xs font-semibold uppercase tracking-wider">{label}</p>
      <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">{icon}</div>
    </div>
    <div className="relative z-10">
      <p className="text-white text-2xl font-bold leading-tight mt-2">{value}</p>
      {sub && <p className="text-white/70 text-xs mt-0.5">{sub}</p>}
    </div>
  </div>
);

/* ─── Quick action button ──────────────────────────────────── */
const QAction = ({ icon, label, to, onClick }: { icon: React.ReactNode; label: string; to?: string; onClick?: () => void }) => {
  const cls = "flex flex-col items-center gap-2 p-4 rounded-2xl border bg-white hover:shadow-md hover:border-violet-200 hover:-translate-y-0.5 transition-all cursor-pointer group";
  const inner = (
    <>
      <div className="w-11 h-11 rounded-xl bg-violet-50 group-hover:bg-violet-100 flex items-center justify-center transition-colors">
        <span className="text-violet-600">{icon}</span>
      </div>
      <span className="text-xs font-semibold text-gray-700 text-center leading-tight">{label}</span>
    </>
  );
  if (to) return <Link to={to} className={cls} style={{ borderColor: T.border }}>{inner}</Link>;
  return <button className={cls} style={{ borderColor: T.border }} onClick={onClick}>{inner}</button>;
};

/* ─── Main component ───────────────────────────────────────── */
const ClientDashboard = () => {
  const { user } = useClientAuth();
  const navigate  = useNavigate();
  const [welcome, setWelcome] = useState(() => !localStorage.getItem("nivra_welcomed"));

  const { data: accountIdentity } = useClientAccountIdentity(user?.id);
  const { data: canonicalData }   = useCanonicalClientData(user?.id);

  const profile   = canonicalData?.profile;
  const account   = canonicalData?.account;
  const orders    = canonicalData?.orders?.slice(0, 4) || [];

  const subs = (canonicalData?.subscriptions || [])
    .filter((s: any) => !["cancelled","expired"].includes(String(s?.status||"").toLowerCase()))
    .map((s: any) => ({
      id:   s.id,
      name: s.plan_name,
      price: s.plan_price,
      type: s.service_category || (
        s.plan_name?.toLowerCase().includes("internet") ? "internet" :
        s.plan_name?.toLowerCase().includes("tv")       ? "tv"       : "mobile"
      ),
      status:     s.status,
      cycle_start: s.cycle_start_date,
      cycle_end:   s.cycle_end_date,
    }));

  const firstName  = profile?.full_name?.split(" ")[0] || user?.user_metadata?.full_name?.split(" ")[0] || "Client";
  const acctNum    = account?.account_number || accountIdentity?.accountNumber || "—";
  const activeCount = subs.filter((s: any) => String(s.status).toLowerCase() === "active").length;

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Copié"); };

  const nextBilling = (() => {
    const active = subs.find((s: any) => String(s.status).toLowerCase() === "active");
    if (!active) return null;
    const cycle = getCycleDisplay(active);
    return cycle.isActive && cycle.nextRenewal ? format(new Date(cycle.nextRenewal), "d MMM", { locale: fr }) : null;
  })();

  const orderCls = (s: string) => {
    if (s === "completed") return ["#dcfce7","#166534","Terminé"];
    if (s === "shipped")   return ["#ede9fe","#5b21b6","Expédié"];
    if (["cancelled","cancel"].includes(s)) return ["#fee2e2","#991b1b","Annulé"];
    return ["#fef3c7","#92400e","En cours"];
  };

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <ClientLayout>
      <ReferralPopup />
      <div className="space-y-6" data-testid="portal-dashboard">

        {/* ═══ HERO ═══════════════════════════════════════════════ */}
        <div className="rounded-3xl overflow-hidden relative" style={{ background: "linear-gradient(135deg,#3b0764 0%,#6d28d9 50%,#4338ca 100%)", minHeight: 200 }}>
          {/* Background circles decoration */}
          <div className="absolute w-80 h-80 rounded-full -top-20 -right-20 opacity-[0.07]" style={{ background: "radial-gradient(circle, white, transparent)" }} />
          <div className="absolute w-48 h-48 rounded-full bottom-0 left-1/3 opacity-[0.05]" style={{ background: "radial-gradient(circle, white, transparent)" }} />

          <div className="relative z-10 px-6 sm:px-8 py-7 sm:py-9">
            {welcome ? (
              /* First visit */
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div>
                  <p className="text-white/60 text-sm font-medium mb-1">Bienvenue chez Nivra Télécom</p>
                  <h1 className="text-white font-bold text-2xl sm:text-3xl tracking-tight">
                    Bonjour, {firstName}&nbsp;!
                  </h1>
                  <p className="text-white/70 text-sm mt-2 max-w-sm leading-relaxed">
                    Votre service sera activé sous 24h. Consultez votre courriel de confirmation.
                  </p>
                </div>
                <button
                  onClick={() => { setWelcome(false); localStorage.setItem("nivra_welcomed","1"); }}
                  className="self-start sm:self-auto flex-shrink-0 px-5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-semibold border border-white/20 transition-all"
                >
                  Compris ✓
                </button>
              </div>
            ) : (
              /* Regular view */
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                  <p className="text-white/55 text-sm font-medium mb-1">Portail client · MonNivra</p>
                  <h1 className="text-white font-bold text-2xl sm:text-3xl tracking-tight">
                    Bonjour, {firstName}
                  </h1>
                  {/* Account row */}
                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5">
                      <span className="text-white/60 text-xs">Compte</span>
                      <span className="text-white text-xs font-bold font-mono tracking-wide">{acctNum}</span>
                      <button onClick={() => copy(acctNum)} className="text-white/40 hover:text-white/80 transition-colors ml-0.5">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    {activeCount > 0 && (
                      <div className="flex items-center gap-1.5 bg-emerald-400/20 rounded-lg px-3 py-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                        <span className="text-emerald-200 text-xs font-semibold">
                          {activeCount} service{activeCount > 1 ? "s" : ""} actif{activeCount > 1 ? "s" : ""}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* CTA buttons */}
                <div className="flex flex-wrap gap-2.5 shrink-0">
                  <button
                    onClick={() => navigate("/portal/billing")}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-white text-violet-700 hover:bg-gray-50 shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5"
                  >
                    <CreditCard className="w-4 h-4" />
                    Faire un paiement
                  </button>
                  <Link to="/portal/invoices"
                    className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-all hover:-translate-y-0.5"
                  >
                    <FileText className="w-4 h-4" />
                    Mes factures
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ SYSTEM BANNERS ══════════════════════════════════════ */}
        {canonicalData?.identifiers?.usedFallbackLinks && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>Certaines données ont été reliées via votre courriel. Contactez le support si une commande semble manquante.</span>
          </div>
        )}
        {account?.id && <AccountStateBanner accountId={account.id} />}
        <EmailClaimBanner />

        {/* ═══ KPI TILES ═══════════════════════════════════════════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Tile
            label="Solde"
            value={<ClientBalanceSummary userId={user?.id || ""} compact />}
            gradient="linear-gradient(135deg,#7c3aed,#a855f7)"
            icon={<CreditCard className="w-4 h-4 text-white" />}
          />
          <Tile
            label="Services actifs"
            value={activeCount}
            sub={activeCount === 0 ? "Aucun service" : `Sur ${subs.length} abonnement${subs.length > 1 ? "s" : ""}`}
            gradient="linear-gradient(135deg,#059669,#34d399)"
            icon={<CheckCircle2 className="w-4 h-4 text-white" />}
          />
          <Tile
            label="Prochaine facture"
            value={nextBilling ?? "—"}
            sub={nextBilling ? "Date de renouvellement" : "Aucun service actif"}
            gradient="linear-gradient(135deg,#0369a1,#38bdf8)"
            icon={<Clock className="w-4 h-4 text-white" />}
          />
          <Tile
            label="Mode de paiement"
            value="Manuel"
            sub="Paiement par facture"
            gradient="linear-gradient(135deg,#b45309,#f59e0b)"
            icon={<Shield className="w-4 h-4 text-white" />}
          />
        </div>

        {/* ═══ QUICK ACTIONS ═══════════════════════════════════════ */}
        <div>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Actions rapides</h2>
          <div className="grid grid-cols-4 sm:grid-cols-4 gap-3">
            <QAction icon={<CreditCard className="w-5 h-5" />}   label="Payer"          onClick={() => navigate("/portal/billing")} />
            <QAction icon={<FileText className="w-5 h-5" />}     label="Factures"       to="/portal/invoices" />
            <QAction icon={<Settings className="w-5 h-5" />}     label="Services"       to="/portal/services" />
            <QAction icon={<HelpCircle className="w-5 h-5" />}   label="Support"        to="/portal/tickets" />
          </div>
        </div>

        {/* ═══ MES SERVICES ════════════════════════════════════════ */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Mes abonnements</h2>
            <Link to="/portal/services" className="text-sm font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1 transition-colors">
              Gérer <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {subs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {subs.map((sub: any) => {
                const cfg   = svcCfg(sub.type);
                const cycle = getCycleDisplay({ ...sub, cycle_start_date: sub.cycle_start, cycle_end_date: sub.cycle_end });
                return (
                  <div
                    key={sub.id}
                    onClick={() => navigate("/portal/services")}
                    className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-violet-200 transition-all cursor-pointer hover:-translate-y-0.5 group"
                  >
                    {/* Color header */}
                    <div className="h-2 w-full" style={{ background: cfg.gradient }} />
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: cfg.gradient }}>
                          {cfg.icon}
                        </div>
                        <Pill status={sub.status} />
                      </div>
                      <p className="font-bold text-gray-900 text-sm leading-snug">{sub.name}</p>
                      <p className="text-gray-500 text-xs mt-1 font-medium">{cfg.tag}</p>
                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-gray-900 font-bold text-sm">
                          {Number(sub.price).toLocaleString("fr-CA",{ style:"currency", currency:"CAD" })}
                          <span className="text-gray-400 font-normal text-xs">/mois</span>
                        </span>
                        {cycle.isActive && cycle.nextRenewal ? (
                          <span className="text-gray-400 text-xs">
                            Renouvelle le {format(new Date(cycle.nextRenewal),"d MMM",{locale:fr})}
                          </span>
                        ) : (
                          <span className="text-amber-600 text-xs font-medium">En attente d'activation</span>
                        )}
                      </div>
                    </div>
                    <div className="px-5 pb-4">
                      <div className="flex items-center gap-1 text-violet-600 text-xs font-semibold group-hover:gap-2 transition-all">
                        Gérer ce service <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 py-12 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
                <Package className="w-7 h-7 text-gray-400" />
              </div>
              <p className="text-gray-900 font-bold mb-1">Aucun service actif</p>
              <p className="text-gray-500 text-sm mb-6">Explorez nos forfaits et commencez dès aujourd'hui.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => navigate("/portal/new-order")}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:shadow-lg hover:-translate-y-0.5"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#4338ca)" }}
                >
                  Voir nos forfaits <ArrowRight className="w-4 h-4" />
                </button>
                <Link to="/telephones" className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">
                  Commander un téléphone
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ═══ MODE DE PAIEMENT ════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">Mode de paiement</h2>
          </div>
          <div className="p-6">
            <ClientPaymentMethodCard />
          </div>
        </div>

        {/* ═══ COUNTDOWN ═══════════════════════════════════════════ */}
        {user?.id && <ServiceCountdown userId={user.id} />}

        {/* ═══ COMMANDES RÉCENTES ══════════════════════════════════ */}
        {orders.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900">Commandes récentes</h2>
              <Link to="/portal/orders" className="text-sm font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1 transition-colors">
                Voir tout <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div>
              {orders.map((order: any, i: number) => {
                const [bg, color, label] = orderCls(order.status);
                return (
                  <div key={order.id}
                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    style={{ borderTop: i > 0 ? "1px solid #f1f5f9" : undefined }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-violet-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{order.service_type}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {order.order_number || `#${order.id.slice(0,8)}`} · {format(new Date(order.created_at),"d MMM yyyy",{locale:fr})}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: bg, color }}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ PLAINTE ═════════════════════════════════════════════ */}
        <div className="rounded-2xl border border-red-100 bg-gradient-to-r from-red-50 to-orange-50 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">Une insatisfaction à signaler ?</p>
              <p className="text-xs text-gray-500 mt-0.5">Soumettez une plainte officielle — SLA de traitement garanti 48h.</p>
            </div>
          </div>
          <Link to="/plainte" className="shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold border border-red-200 text-red-700 bg-white hover:bg-red-50 transition-colors shadow-sm">
            Soumettre une plainte
          </Link>
        </div>

      </div>
    </ClientLayout>
  );
};

export default ClientDashboard;
