import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Shield, Zap, Wifi, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { usePublicServices } from "@/hooks/usePublicServices";
import { useLanguage } from "@/contexts/LanguageContext";

// Animated counter hook
function useCountUp(target: number, duration = 1800, started = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!started || target === 0) return;
    const start = performance.now();
    const raf = (ts: number) => {
      const p = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setCount(Math.floor(ease * target));
      if (p < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }, [target, duration, started]);
  return count;
}

const Hero = () => {
  const { t, language } = useLanguage();
  const isFr = language === "fr";
  const { data: services } = usePublicServices({ surface: "website", categories: ["Internet"] });
  const [visible, setVisible] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  const internetPrice = (() => {
    if (!services || services.length === 0) return null;
    return Math.min(...services.map((s) => Number(s.price))).toFixed(0);
  })();

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const speed = useCountUp(940, 1600, visible);

  return (
    <section
      ref={heroRef}
      className="relative overflow-hidden"
      style={{ background: "#020209", minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      {/* ── CSS Keyframes ─────────────────────────────────────────── */}
      <style>{`
        @keyframes aurora-1 {
          0%,100% { transform: translate(0,0) scale(1); opacity:.55; }
          33%      { transform: translate(60px,-40px) scale(1.15); opacity:.7; }
          66%      { transform: translate(-40px,30px) scale(.95); opacity:.5; }
        }
        @keyframes aurora-2 {
          0%,100% { transform: translate(0,0) scale(1); opacity:.4; }
          40%      { transform: translate(-80px,50px) scale(1.2); opacity:.6; }
          75%      { transform: translate(50px,-60px) scale(.9); opacity:.35; }
        }
        @keyframes aurora-3 {
          0%,100% { transform: translate(0,0) scale(1); opacity:.3; }
          50%      { transform: translate(40px,70px) scale(1.1); opacity:.5; }
        }
        @keyframes scanline {
          0%   { transform: translateY(-100%); opacity:0; }
          5%   { opacity:.6; }
          95%  { opacity:.6; }
          100% { transform: translateY(100vh); opacity:0; }
        }
        @keyframes float-card {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-10px); }
        }
        @keyframes float-badge {
          0%,100% { transform: translateY(0px) rotate(-2deg); }
          50%      { transform: translateY(-8px) rotate(-2deg); }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(.85); opacity:.9; }
          70%  { transform: scale(1.4); opacity:0; }
          100% { transform: scale(1.4); opacity:0; }
        }
        @keyframes pulse-ring-2 {
          0%   { transform: scale(.85); opacity:.7; }
          70%  { transform: scale(1.6); opacity:0; }
          100% { transform: scale(1.6); opacity:0; }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes beam-h {
          0%   { transform: translateX(-100%); opacity:0; }
          10%  { opacity:1; }
          90%  { opacity:1; }
          100% { transform: translateX(100%); opacity:0; }
        }
        @keyframes data-flow {
          0%   { transform: translateY(0); opacity:.7; }
          100% { transform: translateY(-400px); opacity:0; }
        }
        @keyframes slide-up {
          from { transform: translateY(30px); opacity:0; }
          to   { transform: translateY(0);    opacity:1; }
        }
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes meter-fill {
          from { stroke-dashoffset: 565; }
          to   { stroke-dashoffset: 90; }
        }
        @keyframes glow-pulse {
          0%,100% { filter: blur(40px); opacity:.55; }
          50%      { filter: blur(55px); opacity:.75; }
        }
        .hero-title { animation: slide-up .7s cubic-bezier(.16,1,.3,1) both; }
        .hero-sub   { animation: slide-up .7s .12s cubic-bezier(.16,1,.3,1) both; }
        .hero-price { animation: slide-up .7s .22s cubic-bezier(.16,1,.3,1) both; }
        .hero-ctas  { animation: slide-up .7s .32s cubic-bezier(.16,1,.3,1) both; }
        .hero-card  { animation: slide-up .8s .2s cubic-bezier(.16,1,.3,1) both; }
        .shimmer-text {
          background: linear-gradient(90deg,#fff 0%,#A78BFA 30%,#06B6D4 50%,#A78BFA 70%,#fff 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }
        .meter-arc {
          stroke-dasharray: 565;
          stroke-dashoffset: 565;
          animation: meter-fill 1.8s .5s cubic-bezier(.16,1,.3,1) forwards;
        }
      `}</style>

      {/* ── Aurora background blobs ─────────────────────────────── */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        <div style={{
          position: "absolute", top: "-20%", right: "-10%",
          width: 900, height: 900, borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(124,58,237,0.35) 0%, transparent 65%)",
          animation: "aurora-1 14s ease-in-out infinite",
          willChange: "transform",
        }} />
        <div style={{
          position: "absolute", bottom: "-30%", left: "-15%",
          width: 800, height: 800, borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(6,182,212,0.2) 0%, transparent 65%)",
          animation: "aurora-2 18s ease-in-out infinite",
          willChange: "transform",
        }} />
        <div style={{
          position: "absolute", top: "30%", left: "35%",
          width: 600, height: 600, borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(139,92,246,0.18) 0%, transparent 65%)",
          animation: "aurora-3 22s ease-in-out infinite",
          willChange: "transform",
        }} />
      </div>

      {/* ── Grid overlay ─────────────────────────────────────────── */}
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(124,58,237,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.06) 1px, transparent 1px)",
        backgroundSize: "80px 80px",
      }} />

      {/* ── Scan line ────────────────────────────────────────────── */}
      <div aria-hidden className="absolute inset-x-0 pointer-events-none" style={{
        height: 2,
        background: "linear-gradient(90deg, transparent 0%, rgba(124,58,237,0.5) 20%, rgba(6,182,212,0.6) 50%, rgba(124,58,237,0.5) 80%, transparent 100%)",
        animation: "scanline 8s linear infinite",
        boxShadow: "0 0 20px rgba(124,58,237,0.4), 0 0 40px rgba(6,182,212,0.2)",
      }} />

      {/* ── Main content ─────────────────────────────────────────── */}
      <div className="relative max-w-[1200px] mx-auto px-5 sm:px-10 w-full" style={{ paddingTop: 90, paddingBottom: 80, flex: 1 }}>
        <div className="flex items-center gap-10 lg:gap-16">

          {/* ── LEFT COLUMN ─────────────────────────────────────── */}
          <div className="flex-1 max-w-[600px]">

            {/* Status chip */}
            <div className="hero-title inline-flex items-center gap-2.5 mb-8" style={{
              background: "rgba(6,182,212,0.08)",
              border: "1px solid rgba(6,182,212,0.3)",
              borderRadius: 999, padding: "7px 16px",
            }}>
              <span className="relative flex" style={{ width: 8, height: 8 }}>
                <span style={{
                  position: "absolute", inset: 0, borderRadius: "50%",
                  background: "#06B6D4", animation: "pulse-ring 2s ease-out infinite",
                }} />
                <span style={{
                  position: "absolute", inset: 0, borderRadius: "50%",
                  background: "#06B6D4", animation: "pulse-ring-2 2s .4s ease-out infinite",
                }} />
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#06B6D4", display: "block" }} />
              </span>
              <span style={{ color: "#67E8F9", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>
                {isFr ? "Réseau actif — Québec" : "Live Network — Quebec"}
              </span>
            </div>

            {/* Headline */}
            <h1 className="hero-title" style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 800,
              fontSize: "clamp(42px, 6vw, 76px)",
              lineHeight: 1.0,
              letterSpacing: "-2.5px",
              marginBottom: 24,
            }}>
              <span style={{ color: "#FFFFFF", display: "block" }}>
                {isFr ? "Connectez-vous" : "Connect to"}
              </span>
              <span className="shimmer-text" style={{ display: "block", letterSpacing: "-3px" }}>
                {isFr ? "l'avenir" : "the future"}
              </span>
              <span style={{
                display: "block", color: "rgba(255,255,255,0.18)",
                fontSize: "clamp(20px, 2.5vw, 32px)",
                fontWeight: 600, letterSpacing: "-0.5px", marginTop: 8,
              }}>
                {isFr ? "Internet · Mobile · TV · Fibre" : "Internet · Mobile · TV · Fibre"}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="hero-sub" style={{
              color: "rgba(255,255,255,0.55)",
              fontSize: 17, lineHeight: 1.7, maxWidth: 480, marginBottom: 36,
            }}>
              {t("xhero.subtitle")}
            </p>

            {/* Speed + price row */}
            <div className="hero-price flex items-end gap-8 mb-10">
              <div>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>
                  {isFr ? "VITESSE MAX" : "MAX SPEED"}
                </p>
                <div className="flex items-baseline gap-1">
                  <span style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 800, fontSize: "clamp(52px, 8vw, 88px)",
                    lineHeight: 1, letterSpacing: "-3px",
                    color: "#FFFFFF",
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {speed}
                  </span>
                  <span style={{ color: "#A78BFA", fontSize: 22, fontWeight: 700, marginLeft: 4 }}>Mbps</span>
                </div>
              </div>
              {internetPrice && (
                <div style={{ paddingBottom: 6 }}>
                  <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>
                    {isFr ? "À PARTIR DE" : "STARTING AT"}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 800, fontSize: 44, lineHeight: 1, letterSpacing: "-2px", color: "#FFFFFF",
                    }}>
                      {internetPrice}$
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 15 }}>/{isFr ? "mois" : "mo"}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Feature pills */}
            <div className="hero-price flex flex-wrap gap-2 mb-10">
              {[
                { icon: Check, text: isFr ? "Sans contrat" : "No contract", color: "#10B981" },
                { icon: Zap,   text: isFr ? "1er mois GRATUIT" : "1st month FREE", color: "#FBBF24" },
                { icon: Shield,text: isFr ? "Remboursé 30 jours" : "30-day refund", color: "#60A5FA" },
                { icon: Wifi,  text: isFr ? "Activation en ligne" : "Online activation", color: "#A78BFA" },
              ].map(({ icon: Icon, text, color }) => (
                <span key={text} className="inline-flex items-center gap-1.5" style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 999, padding: "8px 14px",
                  color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: 600,
                  backdropFilter: "blur(8px)",
                  transition: "border-color .2s, background .2s",
                }}>
                  <Icon className="w-3.5 h-3.5" style={{ color }} />
                  {text}
                </span>
              ))}
            </div>

            {/* CTAs */}
            <div className="hero-ctas flex flex-col sm:flex-row gap-3">
              <Link
                to="/forfaits"
                className="flex items-center justify-center gap-2 font-bold text-white cursor-pointer"
                style={{
                  height: 56, padding: "0 32px", borderRadius: 10, fontSize: 15,
                  background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 50%, #5B21B6 100%)",
                  boxShadow: "0 0 0 1px rgba(124,58,237,0.5), 0 8px 32px rgba(124,58,237,0.45), 0 0 60px rgba(124,58,237,0.2)",
                  fontFamily: "'Space Grotesk', sans-serif",
                  transition: "box-shadow .2s, transform .2s",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = "0 0 0 1px rgba(124,58,237,0.7), 0 12px 40px rgba(124,58,237,0.6), 0 0 80px rgba(124,58,237,0.3)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = "0 0 0 1px rgba(124,58,237,0.5), 0 8px 32px rgba(124,58,237,0.45), 0 0 60px rgba(124,58,237,0.2)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                {t("xhero.cta")}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/couverture"
                className="flex items-center justify-center gap-2 font-semibold cursor-pointer"
                style={{
                  height: 56, padding: "0 28px", borderRadius: 10, fontSize: 15,
                  border: "1px solid rgba(6,182,212,0.35)",
                  color: "#67E8F9",
                  background: "rgba(6,182,212,0.06)",
                  backdropFilter: "blur(8px)",
                  fontFamily: "'Space Grotesk', sans-serif",
                  transition: "border-color .2s, background .2s, box-shadow .2s",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = "rgba(6,182,212,0.6)";
                  e.currentTarget.style.background = "rgba(6,182,212,0.12)";
                  e.currentTarget.style.boxShadow = "0 0 20px rgba(6,182,212,0.15)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "rgba(6,182,212,0.35)";
                  e.currentTarget.style.background = "rgba(6,182,212,0.06)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <Activity className="w-4 h-4" />
                {isFr ? "Vérifier ma couverture" : "Check my coverage"}
              </Link>
            </div>
          </div>

          {/* ── RIGHT COLUMN — Speed visualizer ──────────────────── */}
          <div className="hero-card hidden lg:flex flex-1 items-center justify-center">
            <div className="relative" style={{ width: 420 }}>

              {/* Main glassmorphism card */}
              <div style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 28,
                padding: "36px 32px 32px",
                backdropFilter: "blur(24px)",
                boxShadow: "0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.15), inset 0 1px 0 rgba(255,255,255,0.08)",
                animation: "float-card 6s ease-in-out infinite",
              }}>

                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div style={{
                      width: 42, height: 42, borderRadius: 12,
                      background: "linear-gradient(135deg, rgba(124,58,237,0.4) 0%, rgba(6,182,212,0.2) 100%)",
                      border: "1px solid rgba(124,58,237,0.3)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 0 20px rgba(124,58,237,0.3)",
                    }}>
                      <Wifi className="w-5 h-5" style={{ color: "#A78BFA" }} />
                    </div>
                    <div>
                      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                        NIVRA NETWORK
                      </p>
                      <p style={{ color: "#FFFFFF", fontSize: 14, fontWeight: 700, marginTop: 1 }}>
                        {isFr ? "Fibre Optique — Actif" : "Fibre Optics — Active"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {["#EF4444", "#F59E0B", "#10B981"].map((c) => (
                      <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, opacity: .7 }} />
                    ))}
                  </div>
                </div>

                {/* Speed meter SVG */}
                <div className="flex justify-center mb-6">
                  <div className="relative" style={{ width: 200, height: 200 }}>
                    <svg viewBox="0 0 200 200" width="200" height="200" style={{ transform: "rotate(-90deg)" }}>
                      {/* Track */}
                      <circle cx="100" cy="100" r="90" fill="none"
                        stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                      {/* Glow track */}
                      <circle cx="100" cy="100" r="90" fill="none"
                        stroke="url(#speedGrad)" strokeWidth="10"
                        strokeLinecap="round" className="meter-arc"
                        style={{ filter: "drop-shadow(0 0 8px rgba(124,58,237,0.8)) drop-shadow(0 0 20px rgba(6,182,212,0.4))" }}
                      />
                      <defs>
                        <linearGradient id="speedGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#7C3AED" />
                          <stop offset="50%" stopColor="#A78BFA" />
                          <stop offset="100%" stopColor="#06B6D4" />
                        </linearGradient>
                      </defs>
                    </svg>
                    {/* Center content */}
                    <div style={{
                      position: "absolute", inset: 0,
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontWeight: 800, fontSize: 48, lineHeight: 1,
                        color: "#FFFFFF", letterSpacing: "-2px",
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {speed}
                      </span>
                      <span style={{ color: "#A78BFA", fontSize: 14, fontWeight: 700, marginTop: 2 }}>Mbps</span>
                      <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 2, marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                        {isFr ? "VITESSE MAX" : "MAX SPEED"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Live stats row */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: "PING", value: "4ms", color: "#10B981" },
                    { label: "JITTER", value: "0.3ms", color: "#06B6D4" },
                    { label: "UPTIME", value: "99.9%", color: "#A78BFA" },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 12, padding: "12px",
                      textAlign: "center",
                    }}>
                      <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>
                        {label}
                      </p>
                      <p style={{ color, fontSize: 16, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Beam animation bar */}
                <div style={{ position: "relative", height: 2, borderRadius: 999, background: "rgba(255,255,255,0.06)", overflow: "hidden", marginBottom: 16 }}>
                  <div style={{
                    position: "absolute", top: 0, left: 0, height: "100%", width: "40%",
                    background: "linear-gradient(90deg, transparent, #7C3AED, #06B6D4, transparent)",
                    animation: "beam-h 2.5s ease-in-out infinite",
                  }} />
                </div>

                {/* Tech tags */}
                <div className="flex flex-wrap gap-2">
                  {["IPv6 Ready", "CGNAT-Free", "Fibre XGS-PON", "WPA3"].map((tag) => (
                    <span key={tag} style={{
                      background: "rgba(124,58,237,0.12)",
                      border: "1px solid rgba(124,58,237,0.25)",
                      borderRadius: 6, padding: "4px 10px",
                      color: "#C4B5FD", fontSize: 10, fontWeight: 700,
                      fontFamily: "'JetBrains Mono', monospace",
                      letterSpacing: .5,
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Floating badge — NO CONTRACT */}
              <div style={{
                position: "absolute", top: -20, right: -20,
                background: "linear-gradient(135deg, #7C3AED, #5B21B6)",
                borderRadius: 14, padding: "12px 18px",
                boxShadow: "0 12px 40px rgba(124,58,237,0.55), 0 0 0 1px rgba(124,58,237,0.4)",
                animation: "float-badge 5s ease-in-out infinite",
              }}>
                <p style={{ color: "#FFFFFF", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 2, margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
                  {isFr ? "Sans contrat" : "No contract"}
                </p>
              </div>

              {/* Floating cyan chip — bottom left */}
              <div style={{
                position: "absolute", bottom: 20, left: -30,
                background: "rgba(6,182,212,0.1)",
                border: "1px solid rgba(6,182,212,0.4)",
                borderRadius: 12, padding: "10px 16px",
                backdropFilter: "blur(12px)",
                animation: "float-badge 7s 1s ease-in-out infinite",
                boxShadow: "0 8px 24px rgba(6,182,212,0.2)",
              }}>
                <p style={{ color: "#67E8F9", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", marginBottom: 2 }}>
                  ACTIVATION
                </p>
                <p style={{ color: "#FFFFFF", fontSize: 13, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>
                  {isFr ? "En ligne 24h" : "Online 24h"}
                </p>
              </div>

              {/* Glow under card */}
              <div aria-hidden style={{
                position: "absolute", bottom: -60, left: "10%", right: "10%", height: 120,
                background: "radial-gradient(ellipse, rgba(124,58,237,0.4) 0%, transparent 70%)",
                animation: "glow-pulse 4s ease-in-out infinite",
                pointerEvents: "none",
              }} />
            </div>
          </div>

        </div>
      </div>

      {/* ── Animated stats ticker ────────────────────────────────── */}
      <div style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(12px)",
        overflow: "hidden",
        position: "relative",
      }}>
        {/* Fade edges */}
        <div aria-hidden style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 120, zIndex: 2,
          background: "linear-gradient(90deg, rgba(2,2,9,1) 0%, transparent 100%)",
          pointerEvents: "none",
        }} />
        <div aria-hidden style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: 120, zIndex: 2,
          background: "linear-gradient(90deg, transparent 0%, rgba(2,2,9,1) 100%)",
          pointerEvents: "none",
        }} />

        <div style={{ display: "flex", animation: "ticker 30s linear infinite", width: "max-content" }}>
          {[...Array(2)].map((_, rep) => (
            <div key={rep} className="flex items-center" style={{ gap: 0 }}>
              {[
                { val: "940 Mbps", desc: isFr ? "Vitesse max fibre" : "Max fibre speed" },
                { val: "99.9%", desc: isFr ? "Disponibilité réseau" : "Network uptime" },
                { val: "4 ms", desc: isFr ? "Latence moyenne" : "Avg latency" },
                { val: "22+ villes", desc: isFr ? "Couverture Québec" : "Quebec coverage" },
                { val: "5G LTE", desc: isFr ? "Réseau mobile" : "Mobile network" },
                { val: "0$", desc: isFr ? "Frais d'installation" : "Setup fees" },
                { val: "7j/7", desc: isFr ? "Support client" : "Customer support" },
                { val: "IPv6", desc: isFr ? "Prêt pour demain" : "Future-ready" },
              ].map((s, i) => (
                <div key={i} className="flex items-center" style={{ padding: "18px 32px" }}>
                  <span style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 800, fontSize: 18, color: "#FFFFFF", letterSpacing: "-0.5px", marginRight: 10,
                  }}>
                    {s.val}
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, fontWeight: 500 }}>
                    {s.desc}
                  </span>
                  {i < 7 && (
                    <span style={{ marginLeft: 32, color: "rgba(124,58,237,0.5)", fontSize: 18 }}>·</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Hero;
