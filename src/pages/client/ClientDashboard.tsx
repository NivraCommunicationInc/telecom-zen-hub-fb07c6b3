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
  Clock, Settings, HelpCircle, Shield,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import ReferralPopup from "@/components/client/ReferralPopup";
import { getCycleDisplay } from "@/lib/billingCycleDisplay";

/* ─── Dark design tokens ───────────────────────────────────── */
const D = {
  bg:          "#0A0A0F",
  bgCard:      "#111122",
  bgCardHover: "rgba(124,58,237,0.05)",
  border:      "rgba(124,58,237,0.2)",
  borderLight: "rgba(124,58,237,0.12)",
  accent:      "#7C3AED",
  accentLight: "#a78bfa",
  textPrimary: "#FFFFFF",
  textSec:     "#A0A0B8",
  textMuted:   "#6B6B85",
  success:     "#10B981",
  successText: "#34d399",
  warning:     "#F59E0B",
  warningText: "#fbbf24",
  error:       "#EF4444",
  errorText:   "#f87171",
};

/* ─── Service config ────────────────────────────────────────── */
const SVC: Record<string, { icon: React.ReactNode; gradient: string; tag: string; accent: string }> = {
  internet: {
    icon:     <Wifi className="w-6 h-6 text-white" />,
    gradient: "linear-gradient(135deg,#059669,#10b981)",
    tag:      "Internet",
    accent:   "#10b981",
  },
  mobile: {
    icon:     <Smartphone className="w-6 h-6 text-white" />,
    gradient: "linear-gradient(135deg,#7c3aed,#a78bfa)",
    tag:      "Mobile",
    accent:   "#a78bfa",
  },
  tv: {
    icon:     <Tv className="w-6 h-6 text-white" />,
    gradient: "linear-gradient(135deg,#d97706,#fbbf24)",
    tag:      "Télévision",
    accent:   "#fbbf24",
  },
};
const svcCfg = (t: string) =>
  SVC[t] ?? { icon: <Package className="w-6 h-6 text-white" />, gradient: "linear-gradient(135deg,#475569,#94a3b8)", tag: t, accent: "#94a3b8" };

/* ─── Status pill — dark mode ──────────────────────────────── */
const Pill = ({ status }: { status: string }) => {
  const map: Record<string, [string, string, string]> = {
    active:    ["rgba(16,185,129,0.15)",  "#34d399",  "rgba(16,185,129,0.3)"],
    pending:   ["rgba(245,158,11,0.15)",  "#fbbf24",  "rgba(245,158,11,0.3)"],
    suspended: ["rgba(239,68,68,0.15)",   "#f87171",  "rgba(239,68,68,0.3)"],
    paused:    ["rgba(124,58,237,0.15)",  "#a78bfa",  "rgba(124,58,237,0.3)"],
  };
  const [bg, color, border] = map[status] ?? ["rgba(107,107,133,0.2)", "#A0A0B8", "rgba(107,107,133,0.3)"];
  const labels: Record<string,string> = { active:"Actif", pending:"En attente", suspended:"Suspendu", paused:"En pause" };
  return (
    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: bg, color, border: `1px solid ${border}` }}>
      {labels[status] ?? status}
    </span>
  );
};

/* ─── KPI Tile ──────────────────────────────────────────────── */
const Tile = ({ label, value, sub, gradient, icon }: {
  label: string; value: React.ReactNode; sub?: string;
  gradient: string; icon: React.ReactNode;
}) => (
  <div className="rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden cursor-default" style={{ background: gradient, minHeight: 120 }}>
    <div className="absolute inset-0 opacity-10" style={{ background: "radial-gradient(circle at 80% 20%, white, transparent)" }} />
    <div className="flex items-start justify-between relative z-10">
      <p className="text-white/80 text-xs font-semibold uppercase tracking-wider">{label}</p>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.2)" }}>{icon}</div>
    </div>
    <div className="relative z-10">
      <p className="text-white text-2xl font-bold leading-tight mt-2">{value}</p>
      {sub && <p className="text-white/70 text-xs mt-0.5">{sub}</p>}
    </div>
  </div>
);

/* ─── Quick action ──────────────────────────────────────────── */
const QAction = ({ icon, label, to, onClick }: { icon: React.ReactNode; label: string; to?: string; onClick?: () => void }) => {
  const inner = (
    <>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center transition-colors" style={{ background: "rgba(124,58,237,0.15)" }}>
        <span style={{ color: "#a78bfa" }}>{icon}</span>
      </div>
      <span className="text-xs font-semibold text-center leading-tight" style={{ color: "#D0D0E8" }}>{label}</span>
    </>
  );
  const base: React.CSSProperties = {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
    padding: 16, borderRadius: 16, border: `1px solid ${D.border}`,
    background: D.bgCard, cursor: "pointer", transition: "all 0.15s ease",
  };
  if (to) return (
    <Link to={to} style={base}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,58,237,0.5)"; (e.currentTarget as HTMLElement).style.background = "rgba(124,58,237,0.08)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = D.border; (e.currentTarget as HTMLElement).style.background = D.bgCard; }}
    >{inner}</Link>
  );
  return (
    <button style={base} onClick={onClick}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,58,237,0.5)"; (e.currentTarget as HTMLElement).style.background = "rgba(124,58,237,0.08)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = D.border; (e.currentTarget as HTMLElement).style.background = D.bgCard; }}
    >{inner}</button>
  );
};

/* ─── Section header ────────────────────────────────────────── */
const SectionHead = ({ title, linkTo, linkLabel }: { title: string; linkTo?: string; linkLabel?: string }) => (
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: D.textMuted }}>{title}</h2>
    {linkTo && (
      <Link to={linkTo} className="flex items-center gap-1 text-sm font-semibold transition-colors hover:opacity-80" style={{ color: D.accentLight }}>
        {linkLabel} <ChevronRight className="w-4 h-4" />
      </Link>
    )}
  </div>
);

/* ─── Card wrapper ──────────────────────────────────────────── */
const DCard = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{ background: D.bgCard, border: `1px solid ${D.border}`, borderRadius: 16, overflow: "hidden", ...style }}>
    {children}
  </div>
);

/* ─── Main component ────────────────────────────────────────── */
const ClientDashboard = () => {
  const { user } = useClientAuth();
  const navigate  = useNavigate();
  const [welcome, setWelcome] = useState(() => !localStorage.getItem("nivra_welcomed"));

  const { data: accountIdentity } = useClientAccountIdentity(user?.id);
  const { data: canonicalData }   = useCanonicalClientData(user?.id);

  const profile  = canonicalData?.profile;
  const account  = canonicalData?.account;
  const orders   = canonicalData?.orders?.slice(0, 4) || [];

  const subs = (canonicalData?.subscriptions || [])
    .filter((s: any) => !["cancelled","expired"].includes(String(s?.status||"").toLowerCase()))
    .map((s: any) => ({
      id:          s.id,
      name:        s.plan_name,
      price:       s.plan_price,
      type:        s.service_category || (
        s.plan_name?.toLowerCase().includes("internet") ? "internet" :
        s.plan_name?.toLowerCase().includes("tv")       ? "tv"       : "mobile"
      ),
      status:      s.status,
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

  const orderStatus = (s: string): [string, string, string] => {
    if (s === "completed") return ["rgba(16,185,129,0.15)", "#34d399", "Terminé"];
    if (s === "shipped")   return ["rgba(124,58,237,0.15)", "#a78bfa", "Expédié"];
    if (["cancelled","cancel"].includes(s)) return ["rgba(239,68,68,0.15)", "#f87171", "Annulé"];
    return ["rgba(245,158,11,0.15)", "#fbbf24", "En cours"];
  };

  return (
    <ClientLayout>
      <ReferralPopup />
      <div className="space-y-6" data-testid="portal-dashboard" style={{ color: D.textPrimary }}>

        {/* ═══ HERO ════════════════════════════════════════════════ */}
        <div className="rounded-3xl overflow-hidden relative" style={{ background: "linear-gradient(135deg,#0A0A0F 0%,#1A0A2E 50%,#0D0D1F 100%)", border: `1px solid ${D.border}`, minHeight: 200 }}>
          {/* Violet glow orbs */}
          <div className="absolute rounded-full pointer-events-none" style={{ width: 400, height: 400, top: -100, right: -80, background: "radial-gradient(circle, rgba(124,58,237,0.15), transparent)", filter: "blur(40px)" }} />
          <div className="absolute rounded-full pointer-events-none" style={{ width: 250, height: 250, bottom: -60, left: "30%", background: "radial-gradient(circle, rgba(124,58,237,0.08), transparent)", filter: "blur(30px)" }} />

          <div className="relative z-10 px-6 sm:px-8 py-7 sm:py-9">
            {welcome ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div>
                  <p className="text-sm font-medium mb-1" style={{ color: D.textMuted }}>Bienvenue chez Nivra Télécom</p>
                  <h1 className="font-bold text-2xl sm:text-3xl tracking-tight" style={{ color: D.textPrimary }}>
                    Bonjour, {firstName}&nbsp;!
                  </h1>
                  <p className="text-sm mt-2 max-w-sm leading-relaxed" style={{ color: D.textSec }}>
                    Votre service sera activé sous 24h. Consultez votre courriel de confirmation.
                  </p>
                </div>
                <button
                  onClick={() => { setWelcome(false); localStorage.setItem("nivra_welcomed","1"); }}
                  className="self-start sm:self-auto flex-shrink-0 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: "rgba(124,58,237,0.2)", color: "#FFFFFF", border: "1px solid rgba(124,58,237,0.4)" }}
                >
                  Compris ✓
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div>
                  <p className="text-sm font-medium mb-1" style={{ color: D.textMuted }}>Portail client · MonNivra</p>
                  <h1 className="font-bold text-2xl sm:text-3xl tracking-tight" style={{ color: D.textPrimary }}>
                    Bonjour, {firstName}
                  </h1>
                  <div className="flex flex-wrap items-center gap-3 mt-3">
                    <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)" }}>
                      <span className="text-xs" style={{ color: D.textMuted }}>Compte</span>
                      <span className="text-xs font-bold font-mono tracking-wide" style={{ color: D.textPrimary }}>{acctNum}</span>
                      <button onClick={() => copy(acctNum)} className="ml-0.5 transition-colors" style={{ color: D.textMuted }}>
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    {activeCount > 0 && (
                      <div className="flex items-center gap-1.5 rounded-lg px-3 py-1.5" style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}>
                        <CheckCircle2 className="w-3.5 h-3.5" style={{ color: D.successText }} />
                        <span className="text-xs font-semibold" style={{ color: D.successText }}>
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
                    className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all"
                    style={{ background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#FFFFFF", boxShadow: "0 4px 16px rgba(124,58,237,0.4)" }}
                  >
                    <CreditCard className="w-4 h-4" />
                    Faire un paiement
                  </button>
                  <Link to="/portal/invoices"
                    className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all"
                    style={{ background: "rgba(124,58,237,0.12)", color: "#FFFFFF", border: "1px solid rgba(124,58,237,0.3)" }}
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
          <div className="rounded-xl px-4 py-3 text-sm flex items-start gap-2" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", color: D.warningText }}>
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: D.warningText }} />
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
          <SectionHead title="Actions rapides" />
          <div className="grid grid-cols-4 gap-3">
            <QAction icon={<CreditCard className="w-5 h-5" />}   label="Payer"     onClick={() => navigate("/portal/billing")} />
            <QAction icon={<FileText className="w-5 h-5" />}     label="Factures"  to="/portal/invoices" />
            <QAction icon={<Settings className="w-5 h-5" />}     label="Services"  to="/portal/services" />
            <QAction icon={<HelpCircle className="w-5 h-5" />}   label="Support"   to="/portal/tickets" />
          </div>
        </div>

        {/* ═══ MES ABONNEMENTS ═════════════════════════════════════ */}
        <div>
          <SectionHead title="Mes abonnements" linkTo="/portal/services" linkLabel="Gérer" />

          {subs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {subs.map((sub: any) => {
                const cfg   = svcCfg(sub.type);
                const cycle = getCycleDisplay({ ...sub, cycle_start_date: sub.cycle_start, cycle_end_date: sub.cycle_end });
                return (
                  <div
                    key={sub.id}
                    onClick={() => navigate("/portal/services")}
                    className="rounded-2xl overflow-hidden cursor-pointer transition-all group"
                    style={{ background: D.bgCard, border: `1px solid ${D.border}` }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,58,237,0.45)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(124,58,237,0.15)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = D.border; (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.transform = "none"; }}
                  >
                    {/* Colored top strip */}
                    <div className="h-1.5 w-full" style={{ background: cfg.gradient }} />
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: cfg.gradient }}>
                          {cfg.icon}
                        </div>
                        <Pill status={sub.status} />
                      </div>
                      <p className="font-bold text-sm leading-snug" style={{ color: D.textPrimary }}>{sub.name}</p>
                      <p className="text-xs mt-1 font-medium" style={{ color: cfg.accent }}>{cfg.tag}</p>
                      <div className="mt-3 pt-3 flex items-center justify-between" style={{ borderTop: `1px solid ${D.borderLight}` }}>
                        <span className="font-bold text-sm" style={{ color: D.textPrimary }}>
                          {Number(sub.price).toLocaleString("fr-CA",{ style:"currency", currency:"CAD" })}
                          <span className="font-normal text-xs ml-0.5" style={{ color: D.textMuted }}>/mois</span>
                        </span>
                        {cycle.isActive && cycle.nextRenewal ? (
                          <span className="text-xs" style={{ color: D.textMuted }}>
                            Renouvelle le {format(new Date(cycle.nextRenewal),"d MMM",{locale:fr})}
                          </span>
                        ) : (
                          <span className="text-xs font-medium" style={{ color: D.warningText }}>En attente d'activation</span>
                        )}
                      </div>
                    </div>
                    <div className="px-5 pb-4">
                      <div className="flex items-center gap-1 text-xs font-semibold transition-all" style={{ color: D.accentLight }}>
                        Gérer ce service <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <DCard>
              <div className="py-12 px-6 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(124,58,237,0.1)" }}>
                  <Package className="w-7 h-7" style={{ color: D.accentLight }} />
                </div>
                <p className="font-bold mb-1" style={{ color: D.textPrimary }}>Aucun service actif</p>
                <p className="text-sm mb-6" style={{ color: D.textSec }}>Explorez nos forfaits et commencez dès aujourd'hui.</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => navigate("/portal/new-order")}
                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all"
                    style={{ background: "linear-gradient(135deg,#7c3aed,#4338ca)", color: "#FFFFFF", boxShadow: "0 4px 16px rgba(124,58,237,0.35)" }}
                  >
                    Voir nos forfaits <ArrowRight className="w-4 h-4" />
                  </button>
                  <Link to="/telephones"
                    className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-colors"
                    style={{ background: "transparent", border: `1px solid ${D.border}`, color: D.textSec }}
                  >
                    Commander un téléphone
                  </Link>
                </div>
              </div>
            </DCard>
          )}
        </div>

        {/* ═══ MODE DE PAIEMENT ════════════════════════════════════ */}
        <DCard>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${D.borderLight}` }}>
            <h2 className="text-sm font-bold" style={{ color: D.textPrimary }}>Mode de paiement</h2>
          </div>
          <div className="p-6">
            <ClientPaymentMethodCard />
          </div>
        </DCard>

        {/* ═══ COUNTDOWN ═══════════════════════════════════════════ */}
        {user?.id && <ServiceCountdown userId={user.id} />}

        {/* ═══ COMMANDES RÉCENTES ══════════════════════════════════ */}
        {orders.length > 0 && (
          <DCard>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${D.borderLight}` }}>
              <h2 className="text-sm font-bold" style={{ color: D.textPrimary }}>Commandes récentes</h2>
              <Link to="/portal/orders" className="flex items-center gap-1 text-sm font-semibold transition-colors hover:opacity-80" style={{ color: D.accentLight }}>
                Voir tout <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div>
              {orders.map((order: any, i: number) => {
                const [bg, color, label] = orderStatus(order.status);
                return (
                  <div key={order.id}
                    className="px-6 py-4 flex items-center justify-between transition-colors"
                    style={{ borderTop: i > 0 ? `1px solid ${D.borderLight}` : undefined }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(124,58,237,0.05)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(124,58,237,0.12)" }}>
                        <Package className="w-4 h-4" style={{ color: D.accentLight }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: D.textPrimary }}>{order.service_type}</p>
                        <p className="text-xs mt-0.5" style={{ color: D.textMuted }}>
                          {order.order_number || `#${order.id.slice(0,8)}`} · {format(new Date(order.created_at),"d MMM yyyy",{locale:fr})}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: bg, color }}>{label}</span>
                  </div>
                );
              })}
            </div>
          </DCard>
        )}

        {/* ═══ PLAINTE ═════════════════════════════════════════════ */}
        <div className="rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(239,68,68,0.15)" }}>
              <AlertCircle className="w-5 h-5" style={{ color: D.errorText }} />
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: D.textPrimary }}>Une insatisfaction à signaler ?</p>
              <p className="text-xs mt-0.5" style={{ color: D.textSec }}>Soumettez une plainte officielle — SLA de traitement garanti 48h.</p>
            </div>
          </div>
          <Link to="/plainte"
            className="shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold transition-colors"
            style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: D.errorText }}
          >
            Soumettre une plainte
          </Link>
        </div>

      </div>
    </ClientLayout>
  );
};

export default ClientDashboard;
