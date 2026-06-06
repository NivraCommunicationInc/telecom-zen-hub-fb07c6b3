import { motion } from "framer-motion";
import ClientLayout from "@/components/client/ClientLayout";
import { Link, useNavigate } from "react-router-dom";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useClientAccountIdentity } from "@/hooks/useClientAccountIdentity";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import AccountStateBanner from "@/components/client/AccountStateBanner";
import EmailClaimBanner from "@/components/client/EmailClaimBanner";
import ClientBalanceSummary from "@/components/client/ClientBalanceSummary";
import ServiceCountdown from "@/components/client/ServiceCountdown";
import { ClientPaymentMethodCard } from "@/components/client/ClientPaymentMethodCard";
import ReferralPopup from "@/components/client/ReferralPopup";
import { getCycleDisplay } from "@/lib/billingCycleDisplay";
import {
  Wifi, Smartphone, Tv, Copy, FileText, CreditCard,
  AlertCircle, Package, ArrowRight, ChevronRight,
  CheckCircle2, Clock, Zap, Settings, LifeBuoy, Gift, PhoneForwarded,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/* ─── Keyframe styles injected once ──────────────────────────── */
const KEYFRAMES = `
  @keyframes aurora-1 { 0%,100%{transform:translate(0,0) scale(1);opacity:.5;} 33%{transform:translate(60px,-40px) scale(1.15);opacity:.65;} 66%{transform:translate(-40px,30px) scale(.95);opacity:.45;} }
  @keyframes aurora-2 { 0%,100%{transform:translate(0,0) scale(1);opacity:.35;} 40%{transform:translate(-80px,50px) scale(1.2);opacity:.55;} 75%{transform:translate(50px,-60px) scale(.9);opacity:.3;} }
  @keyframes aurora-3 { 0%,100%{transform:translate(0,0) scale(1);opacity:.25;} 50%{transform:translate(40px,70px) scale(1.1);opacity:.45;} }
  @keyframes scanline  { 0%{transform:translateY(-100%);opacity:0;} 5%{opacity:.5;} 95%{opacity:.5;} 100%{transform:translateY(100vh);opacity:0;} }
  @keyframes pulse-ring { 0%{transform:scale(.85);opacity:.9;} 70%{transform:scale(1.4);opacity:0;} 100%{transform:scale(1.4);opacity:0;} }
  @keyframes shimmer { 0%{background-position:-200% center;} 100%{background-position:200% center;} }
  @keyframes float-card { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-6px);} }
`;

/* ─── Glass card ──────────────────────────────────────────────── */
const GCard = ({
  children, style, className = "", hover = true,
}: { children: React.ReactNode; style?: React.CSSProperties; className?: string; hover?: boolean }) => (
  <div
    className={className}
    style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(124,58,237,0.25)",
      borderRadius: 20,
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      transition: hover ? "border-color .2s ease, box-shadow .2s ease" : undefined,
      ...style,
    }}
    onMouseEnter={hover ? e => {
      (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,58,237,0.5)";
      (e.currentTarget as HTMLElement).style.boxShadow = "0 0 40px rgba(124,58,237,0.12)";
    } : undefined}
    onMouseLeave={hover ? e => {
      (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,58,237,0.25)";
      (e.currentTarget as HTMLElement).style.boxShadow = "none";
    } : undefined}
  >
    {children}
  </div>
);

/* ─── Stat tile ───────────────────────────────────────────────── */
const StatTile = ({ label, value, icon, accentColor, sub }: {
  label: string; value: React.ReactNode; icon: React.ReactNode;
  accentColor: string; sub?: string;
}) => (
  <GCard style={{ padding: 20 }}>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace" }}>{label}</span>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: `${accentColor}18`, border: `1px solid ${accentColor}40`, display: "flex", alignItems: "center", justifyContent: "center", color: accentColor }}>{icon}</div>
    </div>
    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 800, color: "#fff", lineHeight: 1, letterSpacing: "-1px" }}>{value}</div>
    {sub && <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{sub}</div>}
  </GCard>
);

/* ─── Quick action ────────────────────────────────────────────── */
const QBtn = ({ icon, label, to, onClick, color = "#7C3AED" }: {
  icon: React.ReactNode; label: string; to?: string; onClick?: () => void; color?: string;
}) => {
  const inner = (
    <>
      <div style={{ width: 44, height: 44, borderRadius: 14, background: `${color}18`, border: `1px solid ${color}35`, display: "flex", alignItems: "center", justifyContent: "center", color, marginBottom: 8 }}>{icon}</div>
      <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.75)", textAlign: "center", lineHeight: 1.3 }}>{label}</span>
    </>
  );
  const s: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", padding: "18px 12px", borderRadius: 18, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(124,58,237,0.2)", cursor: "pointer", transition: "all .18s ease" };
  const over = (el: HTMLElement) => { el.style.borderColor = `${color}60`; el.style.background = `${color}0A`; el.style.transform = "translateY(-2px)"; };
  const out  = (el: HTMLElement) => { el.style.borderColor = "rgba(124,58,237,0.2)"; el.style.background = "rgba(255,255,255,0.03)"; el.style.transform = "none"; };
  if (to) return <Link to={to} style={s} onMouseEnter={e => over(e.currentTarget as HTMLElement)} onMouseLeave={e => out(e.currentTarget as HTMLElement)}>{inner}</Link>;
  return <button style={s} onClick={onClick} onMouseEnter={e => over(e.currentTarget as HTMLElement)} onMouseLeave={e => out(e.currentTarget as HTMLElement)}>{inner}</button>;
};

/* ─── Status pill ─────────────────────────────────────────────── */
const Pill = ({ status }: { status: string }) => {
  const m: Record<string, [string, string]> = {
    active:    ["rgba(16,185,129,0.15)",  "#34d399"],
    pending:   ["rgba(245,158,11,0.15)",  "#fbbf24"],
    suspended: ["rgba(239,68,68,0.15)",   "#f87171"],
    paused:    ["rgba(124,58,237,0.15)",  "#a78bfa"],
  };
  const [bg, color] = m[status] ?? ["rgba(107,107,133,0.15)", "#A0A0B8"];
  const lbl: Record<string, string> = { active: "Actif", pending: "En attente", suspended: "Suspendu", paused: "En pause" };
  return (
    <span style={{ background: bg, color, border: `1px solid ${color}50`, borderRadius: 999, fontSize: 11, fontWeight: 700, padding: "3px 10px" }}>
      {lbl[status] ?? status}
    </span>
  );
};

/* ─── Service type config ─────────────────────────────────────── */
const SVC: Record<string, { icon: React.ReactNode; color: string; label: string; grad: string }> = {
  internet: { icon: <Wifi className="w-5 h-5" />, color: "#10b981", label: "Internet", grad: "linear-gradient(135deg,#059669,#10b981)" },
  mobile:   { icon: <Smartphone className="w-5 h-5" />, color: "#a78bfa", label: "Mobile", grad: "linear-gradient(135deg,#7c3aed,#a78bfa)" },
  tv:       { icon: <Tv className="w-5 h-5" />, color: "#fbbf24", label: "Télévision", grad: "linear-gradient(135deg,#d97706,#fbbf24)" },
};
const svc = (t: string) => SVC[t] ?? { icon: <Package className="w-5 h-5" />, color: "#94a3b8", label: t, grad: "linear-gradient(135deg,#475569,#94a3b8)" };

/* ─── Fade-up animation variant ──────────────────────────────── */
const up = {
  hidden:  { opacity: 0, y: 20 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] as const } }),
};

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════════ */
const ClientDashboard = () => {
  const { user }    = useClientAuth();
  const navigate    = useNavigate();
  const [welcome, setWelcome] = useState(() => !localStorage.getItem("nivra_welcomed"));

  const { data: accountIdentity } = useClientAccountIdentity(user?.id);
  const { data: canon }           = useCanonicalClientData(user?.id);

  const profile  = canon?.profile;
  const account  = canon?.account;
  const orders   = canon?.orders?.slice(0, 4) ?? [];

  const subs = (canon?.subscriptions ?? [])
    .filter((s: any) => !["cancelled", "expired"].includes(String(s?.status ?? "").toLowerCase()))
    .map((s: any) => ({
      id:     s.id,
      name:   s.plan_name,
      price:  s.plan_price,
      type:   s.service_category || (s.plan_name?.toLowerCase().includes("internet") ? "internet" : s.plan_name?.toLowerCase().includes("tv") ? "tv" : "mobile"),
      status: s.status,
      cycle_start_date:     s.cycle_start_date,
      cycle_end_date:       s.cycle_end_date,
      next_renewal_at:      s.next_renewal_at,
      billing_cycle_anchor: s.billing_cycle_anchor,
    }));

  const firstName   = profile?.full_name?.split(" ")[0] || user?.user_metadata?.full_name?.split(" ")[0] || "Client";
  const acctNum     = account?.account_number || accountIdentity?.accountNumber || "—";
  const activeCount  = subs.filter((s: any) => String(s.status).toLowerCase() === "active").length;
  const hasAnyService = subs.length > 0 || !!(account as any)?.billing_cycle_day || !!(account as any)?.next_invoice_date;

  const nextBilling = (() => {
    const fmt = (d: string | null | undefined) => {
      if (!d) return null;
      try {
        // DATE strings (YYYY-MM-DD) need UTC parsing to avoid off-by-one in local TZ
        const parsed = /^\d{4}-\d{2}-\d{2}$/.test(d)
          ? new Date(d + "T12:00:00Z")
          : new Date(d);
        if (isNaN(parsed.getTime())) return null;
        return format(parsed, "d MMM yyyy", { locale: fr });
      } catch { return null; }
    };

    // 1. account.next_invoice_date — set by trigger on activation, most reliable
    const fromAccount = fmt((account as any)?.next_invoice_date);
    if (fromAccount) return fromAccount;

    // 2. active subscription dates
    const active = subs.find((s: any) => String(s.status).toLowerCase() === "active");
    if (active) {
      const fromRenewal = fmt(active.next_renewal_at);
      if (fromRenewal) return fromRenewal;
      const fromCycleEnd = fmt(active.cycle_end_date);
      if (fromCycleEnd) return fromCycleEnd;
    }

    // 3. account.billing_cycle_day → calculate next occurrence
    const cycleDay = (account as any)?.billing_cycle_day;
    if (cycleDay && Number.isFinite(Number(cycleDay))) {
      const day = Number(cycleDay);
      const now = new Date();
      const candidate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), day));
      if (candidate <= now) candidate.setUTCMonth(candidate.getUTCMonth() + 1);
      const fromCycleDay = fmt(candidate.toISOString().slice(0, 10));
      if (fromCycleDay) return fromCycleDay;
    }

    if (!active) return null;
    return null; // active sub but no date yet — shows "Date à confirmer" in sub-label
  })();

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Copié"); };

  const orderCls = (s: string) => {
    if (["completed", "activated", "installation_completed"].includes(s))
      return ["rgba(16,185,129,0.15)", "#34d399", s === "activated" ? "Activé" : s === "installation_completed" ? "Installé" : "Terminé"];
    if (s === "delivered") return ["rgba(20,184,166,0.15)", "#2dd4bf", "Livré"];
    if (s === "shipped")   return ["rgba(124,58,237,0.15)", "#a78bfa", "Expédié"];
    if (["cancelled","cancel"].includes(s)) return ["rgba(239,68,68,0.15)", "#f87171", "Annulé"];
    if (s === "processing") return ["rgba(59,130,246,0.15)", "#60a5fa", "En traitement"];
    return ["rgba(245,158,11,0.15)", "#fbbf24", "En cours"];
  };

  return (
    <ClientLayout>
      <style>{KEYFRAMES}</style>
      <ReferralPopup />

      {/* ════ PAGE WRAPPER — dark Nivra bg ══════════════════════════ */}
      <div style={{ background: "#020209", minHeight: "100vh", position: "relative" }} data-testid="portal-dashboard">

        {/* ── Aurora blobs ──────────────────────────────────────────── */}
        <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
          <div style={{ position: "absolute", top: "-10%", right: "-15%", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(124,58,237,0.28) 0%, transparent 65%)", animation: "aurora-1 16s ease-in-out infinite", willChange: "transform" }} />
          <div style={{ position: "absolute", bottom: "-20%", left: "-10%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(6,182,212,0.15) 0%, transparent 65%)", animation: "aurora-2 20s ease-in-out infinite", willChange: "transform" }} />
          <div style={{ position: "absolute", top: "40%", left: "30%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(139,92,246,0.12) 0%, transparent 65%)", animation: "aurora-3 24s ease-in-out infinite", willChange: "transform" }} />
        </div>

        {/* ── Grid overlay ──────────────────────────────────────────── */}
        <div aria-hidden style={{ position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)", backgroundSize: "80px 80px", pointerEvents: "none", zIndex: 0 }} />

        {/* ── Scan line ─────────────────────────────────────────────── */}
        <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(124,58,237,0.5) 20%, rgba(6,182,212,0.6) 50%, rgba(124,58,237,0.5) 80%, transparent)", animation: "scanline 10s linear infinite", boxShadow: "0 0 20px rgba(124,58,237,0.3)" }} />
        </div>

        {/* ── Content ───────────────────────────────────────────────── */}
        <div style={{ position: "relative", zIndex: 2, padding: "32px 0 48px" }}>

          {/* SYSTEM BANNERS */}
          {canon?.identifiers?.usedFallbackLinks && (
            <div style={{ marginBottom: 16, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 14, padding: "12px 16px", fontSize: 13, color: "#fbbf24", display: "flex", gap: 10 }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>Certaines données ont été reliées via votre courriel. Contactez le support si une commande semble manquante.</span>
            </div>
          )}
          {account?.id && <div style={{ marginBottom: 16 }}><AccountStateBanner accountId={account.id} /></div>}
          <div style={{ marginBottom: 16 }}><EmailClaimBanner /></div>

          {/* ════ HERO SECTION ═══════════════════════════════════════ */}
          <motion.div initial="hidden" animate="visible" custom={0} variants={up} style={{ marginBottom: 32 }}>
            {welcome ? (
              /* ── First visit ── */
              <GCard hover={false} style={{ padding: "36px 32px", background: "rgba(124,58,237,0.06)", borderColor: "rgba(124,58,237,0.3)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <span style={{ position: "relative", width: 8, height: 8, display: "inline-flex" }}>
                    <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#06B6D4", animation: "pulse-ring 2s ease-out infinite" }} />
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#06B6D4", display: "block" }} />
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#67E8F9", fontFamily: "'JetBrains Mono', monospace" }}>Bienvenue chez Nivra Télécom</span>
                </div>
                <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(28px,4vw,44px)", fontWeight: 800, color: "#fff", letterSpacing: "-1.5px", marginBottom: 12, lineHeight: 1.1 }}>
                  Bonjour, {firstName}&nbsp;!
                </h1>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, lineHeight: 1.7, maxWidth: 480, marginBottom: 24 }}>
                  Votre service sera activé sous 24h. Un courriel de confirmation vous a été envoyé.
                </p>
                <button
                  onClick={() => { setWelcome(false); localStorage.setItem("nivra_welcomed", "1"); }}
                  style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.4)", borderRadius: 12, padding: "10px 20px", color: "#a78bfa", fontSize: 14, fontWeight: 600, cursor: "pointer" }}
                >
                  Accéder à mon espace →
                </button>
              </GCard>
            ) : (
              /* ── Regular dashboard header ── */
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Greeting */}
                <div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.25)", borderRadius: 999, padding: "6px 14px", marginBottom: 16 }}>
                    <span style={{ position: "relative", display: "inline-flex", width: 7, height: 7 }}>
                      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#06B6D4", animation: "pulse-ring 2s ease-out infinite" }} />
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#06B6D4", display: "block" }} />
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#67E8F9", fontFamily: "'JetBrains Mono', monospace" }}>
                      Portail client · MonNivra
                    </span>
                  </div>
                  <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(32px,5vw,56px)", fontWeight: 800, color: "#fff", letterSpacing: "-2px", lineHeight: 1.0, marginBottom: 16 }}>
                    Bonjour,{" "}
                    <span style={{ background: "linear-gradient(90deg,#fff 0%,#A78BFA 40%,#06B6D4 70%,#A78BFA 100%)", backgroundSize: "200% auto", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", animation: "shimmer 4s linear infinite" }}>
                      {firstName}
                    </span>
                  </h1>
                  {/* Account pill row */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "8px 14px" }}>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>COMPTE</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 2 }}>{acctNum}</span>
                      <button onClick={() => copy(acctNum)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: 0, display: "flex" }}>
                        <Copy size={12} />
                      </button>
                    </div>
                    {activeCount > 0 && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 12, padding: "8px 14px" }}>
                        <CheckCircle2 size={13} style={{ color: "#34d399" }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#34d399" }}>{activeCount} service{activeCount > 1 ? "s" : ""} actif{activeCount > 1 ? "s" : ""}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* CTA row */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <button
                    onClick={() => navigate("/portal/billing")}
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg,#7c3aed,#6d28d9)", border: "1px solid rgba(124,58,237,0.6)", borderRadius: 14, padding: "12px 22px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 0 30px rgba(124,58,237,0.3)", transition: "all .18s ease" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 40px rgba(124,58,237,0.5)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 30px rgba(124,58,237,0.3)"; }}
                  >
                    <CreditCard size={16} /> Faire un paiement
                  </button>
                  <Link to="/portal/invoices" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: "12px 22px", color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: 600, textDecoration: "none", transition: "all .18s ease" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(124,58,237,0.4)"; (e.currentTarget as HTMLElement).style.background = "rgba(124,58,237,0.08)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                  >
                    <FileText size={16} /> Mes factures
                  </Link>
                  <Link to="/portal/services" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: "12px 22px", color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: 600, textDecoration: "none", transition: "all .18s ease" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(16,185,129,0.4)"; (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,0.06)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                  >
                    <Settings size={16} /> Mes services
                  </Link>
                </div>
              </div>
            )}
          </motion.div>

          {/* ════ STAT TILES ═════════════════════════════════════════ */}
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.07 } } }} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
            {[
              { label: "Solde", value: <ClientBalanceSummary userId={user?.id ?? ""} compact />, icon: <CreditCard size={16} />, color: "#7C3AED", sub: "Compte courant" },
              { label: "Services actifs", value: activeCount, icon: <CheckCircle2 size={16} />, color: "#10B981", sub: `${subs.length} abonnement${subs.length > 1 ? "s" : ""}` },
              { label: "Prochaine facture", value: nextBilling ?? "—", icon: <Clock size={16} />, color: "#06B6D4", sub: nextBilling ? "Date de renouvellement" : hasAnyService ? "Date à confirmer" : "Aucun service actif" },
              { label: "Performance réseau", value: "99.9%", icon: <Zap size={16} />, color: "#F59E0B", sub: "Disponibilité garantie" },
            ].map((t, i) => (
              <motion.div key={i} custom={i} variants={up}>
                <StatTile {...t} accentColor={t.color} />
              </motion.div>
            ))}
          </motion.div>

          {/* ════ QUICK ACTIONS ══════════════════════════════════════ */}
          <motion.div initial="hidden" animate="visible" custom={2} variants={up} style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>Actions rapides</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 12 }}>
              <QBtn icon={<CreditCard size={20} />}   label="Payer"           onClick={() => navigate("/portal/billing")} color="#7C3AED" />
              <QBtn icon={<FileText size={20} />}     label="Factures"        to="/portal/invoices" color="#06B6D4" />
              <QBtn icon={<Settings size={20} />}     label="Mes services"    to="/portal/services" color="#10B981" />
              <QBtn icon={<LifeBuoy size={20} />}     label="Support"         to="/portal/tickets" color="#F59E0B" />
              <QBtn icon={<Gift size={20} />}         label="Parrainage"      to="/portal/referrals" color="#A78BFA" />
              <QBtn icon={<Package size={20} />}      label="Commandes"       to="/portal/orders" color="#34D399" />
              <QBtn icon={<PhoneForwarded size={20} />} label="Transférer #"  to="/portal/port-in" color="#06B6D4" />
            </div>
          </motion.div>

          {/* ════ MES SERVICES ═══════════════════════════════════════ */}
          <motion.div initial="hidden" animate="visible" custom={3} variants={up} style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>Mes abonnements</span>
              <Link to="/portal/services" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600, color: "#a78bfa", textDecoration: "none" }}>
                Gérer <ChevronRight size={14} />
              </Link>
            </div>

            {subs.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                {subs.map((sub: any, i: number) => {
                  const cfg   = svc(sub.type);
                  const cycle = getCycleDisplay(sub);
                  return (
                    <motion.div key={sub.id} custom={i} variants={up} initial="hidden" animate="visible">
                      <GCard
                        style={{ cursor: "pointer", overflow: "hidden" }}
                        className=""
                      >
                        {/* Color strip top */}
                        <div style={{ height: 3, background: cfg.grad }} />
                        <div style={{ padding: "18px 20px 20px" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 14, background: cfg.grad, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                              {cfg.icon}
                            </div>
                            <Pill status={sub.status} />
                          </div>
                          <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: "#fff", marginBottom: 4, lineHeight: 1.3 }}>{sub.name}</p>
                          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 14, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1, textTransform: "uppercase" }}>{cfg.label}</p>
                          <div style={{ borderTop: "1px solid rgba(124,58,237,0.15)", paddingTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: 20, color: "#fff", letterSpacing: "-0.5px" }}>
                              {Number(sub.price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                              <span style={{ fontSize: 12, fontWeight: 400, color: "rgba(255,255,255,0.4)" }}>/mois</span>
                            </span>
                            {cycle.isActive && cycle.nextRenewal ? (
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace" }}>
                                {format(new Date(cycle.nextRenewal), "d MMM", { locale: fr })}
                              </span>
                            ) : (
                              <span style={{ fontSize: 11, color: "#fbbf24" }}>En attente</span>
                            )}
                          </div>
                          <Link to="/portal/services" style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: cfg.color, textDecoration: "none" }}>
                            Gérer ce service <ArrowRight size={12} />
                          </Link>
                        </div>
                      </GCard>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <GCard style={{ textAlign: "center", padding: "48px 24px" }}>
                <div style={{ width: 56, height: 56, borderRadius: 18, background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: "#7c3aed" }}>
                  <Package size={24} />
                </div>
                <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: "#fff", marginBottom: 8 }}>Aucun service actif</p>
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, marginBottom: 24 }}>Explorez nos forfaits et commencez dès aujourd'hui.</p>
                <button
                  onClick={() => navigate("/portal/new-order")}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg,#7c3aed,#6d28d9)", border: "1px solid rgba(124,58,237,0.5)", borderRadius: 14, padding: "12px 24px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 0 20px rgba(124,58,237,0.25)" }}
                >
                  Voir nos forfaits <ArrowRight size={16} />
                </button>
              </GCard>
            )}
          </motion.div>

          {/* ════ PAIEMENT + COUNTDOWN ═══════════════════════════════ */}
          <motion.div initial="hidden" animate="visible" custom={4} variants={up} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16, marginBottom: 32 }}>
            <GCard hover={false}>
              <div style={{ padding: "18px 20px 8px", borderBottom: "1px solid rgba(124,58,237,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>Mode de paiement</span>
              </div>
              <div style={{ padding: 20 }}><ClientPaymentMethodCard /></div>
            </GCard>
            {user?.id && (
              <GCard hover={false}>
                <div style={{ padding: "18px 20px 8px", borderBottom: "1px solid rgba(124,58,237,0.15)" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>Activation</span>
                </div>
                <div style={{ padding: 20 }}><ServiceCountdown userId={user.id} /></div>
              </GCard>
            )}
          </motion.div>

          {/* ════ COMMANDES ══════════════════════════════════════════ */}
          {orders.length > 0 && (
            <motion.div initial="hidden" animate="visible" custom={5} variants={up} style={{ marginBottom: 32 }}>
              <GCard hover={false}>
                <div style={{ padding: "18px 24px", borderBottom: "1px solid rgba(124,58,237,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono', monospace" }}>Commandes récentes</span>
                  <Link to="/portal/orders" style={{ fontSize: 13, fontWeight: 600, color: "#a78bfa", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>Voir tout <ChevronRight size={14} /></Link>
                </div>
                {orders.map((order: any, i: number) => {
                  const [bg, color, label] = orderCls(order.status);
                  return (
                    <div key={order.id} style={{ padding: "14px 24px", borderTop: i > 0 ? "1px solid rgba(124,58,237,0.08)" : undefined, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#a78bfa" }}>
                          <Package size={15} />
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 2 }}>{order.service_type}</p>
                          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono', monospace" }}>
                            {order.order_number || `#${order.id.slice(0, 8)}`} · {format(new Date(order.created_at), "d MMM yyyy", { locale: fr })}
                          </p>
                        </div>
                      </div>
                      <span style={{ background: bg, color, border: `1px solid ${color}50`, borderRadius: 999, fontSize: 11, fontWeight: 700, padding: "4px 12px" }}>{label}</span>
                    </div>
                  );
                })}
              </GCard>
            </motion.div>
          )}

          {/* ════ PLAINTE ════════════════════════════════════════════ */}
          <motion.div initial="hidden" animate="visible" custom={6} variants={up}>
            <GCard hover={false} style={{ borderColor: "rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.04)" }}>
              <div style={{ padding: "18px 24px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171", flexShrink: 0 }}>
                    <AlertCircle size={18} />
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 3 }}>Une insatisfaction à signaler ?</p>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Soumettez une plainte officielle — SLA 48h garanti.</p>
                  </div>
                </div>
                <Link to="/plainte" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: "10px 18px", color: "#f87171", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                  Soumettre une plainte <ArrowRight size={14} />
                </Link>
              </div>
            </GCard>
          </motion.div>

        </div>
      </div>
    </ClientLayout>
  );
};

export default ClientDashboard;
