import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Shield, Zap, Wifi, Activity, Signal } from "lucide-react";
import { Link } from "react-router-dom";
import { usePublicServices } from "@/hooks/usePublicServices";
import { useLanguage } from "@/contexts/LanguageContext";
import { PhotoBg } from "@/components/PhotoBg";

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

const NODES = [
  { id: "montreal",      label: "Montréal",       x: 200, y: 72,  color: "#A78BFA", delay: 0 },
  { id: "laval",         label: "Laval",           x: 322, y: 138, color: "#06B6D4", delay: 0.3 },
  { id: "longueuil",     label: "Longueuil",       x: 322, y: 262, color: "#10B981", delay: 0.6 },
  { id: "quebec",        label: "Québec",          x: 200, y: 328, color: "#FBBF24", delay: 0.9 },
  { id: "sherbrooke",    label: "Sherbrooke",      x: 78,  y: 262, color: "#F472B6", delay: 1.2 },
  { id: "troisrivieres", label: "Trois-Rivières",  x: 78,  y: 138, color: "#34D399", delay: 1.5 },
];

const CX = 200;
const CY = 200;

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
      {/* NYC skyline at night — city lights on dark, maximum impact hero */}
      <PhotoBg url="https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=1920&q=80" opacity={0.18} filter="saturate(0.7) brightness(0.65)" position="center center" />
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
        @keyframes slide-up {
          from { transform: translateY(30px); opacity:0; }
          to   { transform: translateY(0);    opacity:1; }
        }
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes glow-pulse {
          0%,100% { filter: blur(40px); opacity:.55; }
          50%      { filter: blur(55px); opacity:.75; }
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
        @keyframes node-pulse {
          0%,100% { opacity:.8; r: 7; }
          50% { opacity:1; r: 9; }
        }
        @keyframes data-flow {
          0%   { stroke-dashoffset: 80; opacity:.9; }
          100% { stroke-dashoffset: 0; opacity:.4; }
        }
        @keyframes center-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes float-card {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-8px); }
        }
        @keyframes float-badge {
          0%,100% { transform: translateY(0px) rotate(-2deg); }
          50%      { transform: translateY(-8px) rotate(-2deg); }
        }
        @keyframes beam-h {
          0%   { transform: translateX(-100%); opacity:0; }
          10%  { opacity:1; }
          90%  { opacity:1; }
          100% { transform: translateX(100%); opacity:0; }
        }
        @keyframes ring-expand {
          0%   { r: 38; opacity:.6; }
          100% { r: 80; opacity:0; }
        }
        @keyframes ring-expand-2 {
          0%   { r: 38; opacity:.4; }
          100% { r: 100; opacity:0; }
        }
        @keyframes signal-bar {
          0%,100% { opacity:.3; }
          50%     { opacity:1; }
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
        .n-shimmer-text {
          background: linear-gradient(90deg,#A78BFA 0%,#06B6D4 50%,#A78BFA 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 3s linear infinite;
        }
      `}</style>

      {/* Aurora blobs */}
      <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
        <div style={{ position:"absolute", top:"-20%", right:"-10%", width:900, height:900, borderRadius:"50%", background:"radial-gradient(ellipse, rgba(124,58,237,0.32) 0%, transparent 65%)", animation:"aurora-1 14s ease-in-out infinite", willChange:"transform" }} />
        <div style={{ position:"absolute", bottom:"-30%", left:"-15%", width:800, height:800, borderRadius:"50%", background:"radial-gradient(ellipse, rgba(6,182,212,0.18) 0%, transparent 65%)", animation:"aurora-2 18s ease-in-out infinite", willChange:"transform" }} />
        <div style={{ position:"absolute", top:"30%", left:"35%", width:600, height:600, borderRadius:"50%", background:"radial-gradient(ellipse, rgba(139,92,246,0.15) 0%, transparent 65%)", animation:"aurora-3 22s ease-in-out infinite", willChange:"transform" }} />
      </div>

      {/* Grid */}
      <div aria-hidden className="absolute inset-0 pointer-events-none" style={{ backgroundImage:"linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)", backgroundSize:"80px 80px" }} />

      {/* Scanline */}
      <div aria-hidden className="absolute inset-x-0 pointer-events-none" style={{ height:2, background:"linear-gradient(90deg, transparent 0%, rgba(124,58,237,0.5) 20%, rgba(6,182,212,0.6) 50%, rgba(124,58,237,0.5) 80%, transparent 100%)", animation:"scanline 8s linear infinite", boxShadow:"0 0 20px rgba(124,58,237,0.4), 0 0 40px rgba(6,182,212,0.2)" }} />

      {/* Main content */}
      <div className="relative max-w-[1200px] mx-auto px-5 sm:px-10 w-full" style={{ paddingTop:90, paddingBottom:80, flex:1 }}>
        <div className="flex items-center gap-10 lg:gap-16">

          {/* LEFT */}
          <div className="flex-1 max-w-[600px]">

            {/* Live chip */}
            <div className="hero-title inline-flex items-center gap-2.5 mb-8" style={{ background:"rgba(6,182,212,0.08)", border:"1px solid rgba(6,182,212,0.3)", borderRadius:999, padding:"7px 16px" }}>
              <span className="relative flex" style={{ width:8, height:8 }}>
                <span style={{ position:"absolute", inset:0, borderRadius:"50%", background:"#06B6D4", animation:"pulse-ring 2s ease-out infinite" }} />
                <span style={{ position:"absolute", inset:0, borderRadius:"50%", background:"#06B6D4", animation:"pulse-ring-2 2s .4s ease-out infinite" }} />
                <span style={{ width:8, height:8, borderRadius:"50%", background:"#06B6D4", display:"block" }} />
              </span>
              <span style={{ color:"#67E8F9", fontSize:11, fontWeight:700, letterSpacing:2, textTransform:"uppercase", fontFamily:"'JetBrains Mono', monospace" }}>
                {isFr ? "Réseau actif — Québec" : "Live Network — Quebec"}
              </span>
            </div>

            {/* Headline */}
            <h1 className="hero-title" style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:"clamp(42px, 6vw, 76px)", lineHeight:1.0, letterSpacing:"-2.5px", marginBottom:24 }}>
              <span style={{ color:"#FFFFFF", display:"block" }}>{isFr ? "Connectez-vous" : "Connect to"}</span>
              <span className="shimmer-text" style={{ display:"block", letterSpacing:"-3px" }}>{isFr ? "l'avenir" : "the future"}</span>
              <span style={{ display:"block", color:"rgba(255,255,255,0.18)", fontSize:"clamp(20px, 2.5vw, 32px)", fontWeight:600, letterSpacing:"-0.5px", marginTop:8 }}>
                Internet · Mobile · TV · Fibre
              </span>
            </h1>

            {/* Subtitle */}
            <p className="hero-sub" style={{ color:"rgba(255,255,255,0.55)", fontSize:17, lineHeight:1.7, maxWidth:480, marginBottom:36 }}>
              {t("xhero.subtitle")}
            </p>

            {/* Speed + price */}
            <div className="hero-price flex items-end gap-8 mb-10">
              <div>
                <p style={{ color:"rgba(255,255,255,0.35)", fontSize:11, fontWeight:700, letterSpacing:2, textTransform:"uppercase", fontFamily:"'JetBrains Mono', monospace", marginBottom:4 }}>{isFr ? "VITESSE MAX" : "MAX SPEED"}</p>
                <div className="flex items-baseline gap-1">
                  <span style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:"clamp(52px, 8vw, 88px)", lineHeight:1, letterSpacing:"-3px", color:"#FFFFFF", fontVariantNumeric:"tabular-nums" }}>{speed}</span>
                  <span style={{ color:"#A78BFA", fontSize:22, fontWeight:700, marginLeft:4 }}>Mbps</span>
                </div>
              </div>
              {internetPrice && (
                <div style={{ paddingBottom:6 }}>
                  <p style={{ color:"rgba(255,255,255,0.35)", fontSize:11, fontWeight:700, letterSpacing:2, textTransform:"uppercase", fontFamily:"'JetBrains Mono', monospace", marginBottom:4 }}>{isFr ? "À PARTIR DE" : "STARTING AT"}</p>
                  <div className="flex items-baseline gap-1">
                    <span style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:44, lineHeight:1, letterSpacing:"-2px", color:"#FFFFFF" }}>{internetPrice}$</span>
                    <span style={{ color:"rgba(255,255,255,0.4)", fontSize:15 }}>/{isFr ? "mois" : "mo"}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Pills */}
            <div className="hero-price flex flex-wrap gap-2 mb-10">
              {[
                { icon: Check,  text: isFr ? "Sans contrat" : "No contract",      color:"#10B981" },
                { icon: Zap,    text: isFr ? "1er mois GRATUIT" : "1st month FREE", color:"#FBBF24" },
                { icon: Shield, text: isFr ? "Remboursé 30 jours" : "30-day refund", color:"#60A5FA" },
                { icon: Wifi,   text: isFr ? "Activation en ligne" : "Online activation", color:"#A78BFA" },
              ].map(({ icon: Icon, text, color }) => (
                <span key={text} className="inline-flex items-center gap-1.5" style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:999, padding:"8px 14px", color:"rgba(255,255,255,0.85)", fontSize:12, fontWeight:600, backdropFilter:"blur(8px)" }}>
                  <Icon className="w-3.5 h-3.5" style={{ color }} />{text}
                </span>
              ))}
            </div>

            {/* CTAs */}
            <div className="hero-ctas flex flex-col sm:flex-row gap-3">
              <Link to="/forfaits" className="flex items-center justify-center gap-2 font-bold text-white cursor-pointer"
                style={{ height:56, padding:"0 32px", borderRadius:10, fontSize:15, background:"linear-gradient(135deg, #7C3AED 0%, #6D28D9 50%, #5B21B6 100%)", boxShadow:"0 0 0 1px rgba(124,58,237,0.5), 0 8px 32px rgba(124,58,237,0.45)", fontFamily:"'Space Grotesk', sans-serif", transition:"box-shadow .2s, transform .2s" }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow="0 0 0 1px rgba(124,58,237,0.7), 0 12px 40px rgba(124,58,237,0.6)"; e.currentTarget.style.transform="translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow="0 0 0 1px rgba(124,58,237,0.5), 0 8px 32px rgba(124,58,237,0.45)"; e.currentTarget.style.transform="translateY(0)"; }}
              >
                {t("xhero.cta")} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/couverture" className="flex items-center justify-center gap-2 font-semibold cursor-pointer"
                style={{ height:56, padding:"0 28px", borderRadius:10, fontSize:15, border:"1px solid rgba(6,182,212,0.35)", color:"#67E8F9", background:"rgba(6,182,212,0.06)", backdropFilter:"blur(8px)", fontFamily:"'Space Grotesk', sans-serif", transition:"border-color .2s, background .2s, box-shadow .2s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor="rgba(6,182,212,0.6)"; e.currentTarget.style.background="rgba(6,182,212,0.12)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor="rgba(6,182,212,0.35)"; e.currentTarget.style.background="rgba(6,182,212,0.06)"; }}
              >
                <Activity className="w-4 h-4" />{isFr ? "Vérifier ma couverture" : "Check coverage"}
              </Link>
            </div>
          </div>

          {/* RIGHT — Network topology */}
          <div className="hero-card hidden lg:flex flex-1 items-center justify-center">
            <div className="relative" style={{ width:440, height:440 }}>

              {/* Ambient glow */}
              <div aria-hidden style={{ position:"absolute", inset:0, borderRadius:"50%", background:"radial-gradient(ellipse 60% 60% at 50% 50%, rgba(124,58,237,0.22) 0%, transparent 70%)", pointerEvents:"none", animation:"glow-pulse 4s ease-in-out infinite" }} />

              {/* Network SVG */}
              <svg viewBox="0 0 400 400" width="440" height="440" style={{ overflow:"visible" }}>
                <defs>
                  <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
                  </radialGradient>
                  <filter id="nodeBlur">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  {NODES.map(n => (
                    <radialGradient key={`g-${n.id}`} id={`grad-${n.id}`} cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor={n.color} stopOpacity="0.5" />
                      <stop offset="100%" stopColor={n.color} stopOpacity="0" />
                    </radialGradient>
                  ))}
                </defs>

                {/* Connection lines */}
                {NODES.map((n) => (
                  <g key={`line-${n.id}`}>
                    {/* Base line */}
                    <line x1={CX} y1={CY} x2={n.x} y2={n.y}
                      stroke={n.color} strokeWidth="1" strokeOpacity="0.2" />
                    {/* Animated data flow */}
                    <line x1={CX} y1={CY} x2={n.x} y2={n.y}
                      stroke={n.color} strokeWidth="1.5" strokeOpacity="0.8"
                      strokeDasharray="12 6"
                      style={{
                        animation: `data-flow 2.5s ${n.delay}s linear infinite`,
                        strokeDashoffset: 0,
                      }}
                    />
                  </g>
                ))}

                {/* Center pulse rings */}
                <circle cx={CX} cy={CY} r="38" fill="none" stroke="#7C3AED" strokeWidth="1.5" strokeOpacity="0.6"
                  style={{ animation:"ring-expand 3s ease-out infinite" }} />
                <circle cx={CX} cy={CY} r="38" fill="none" stroke="#7C3AED" strokeWidth="1" strokeOpacity="0.3"
                  style={{ animation:"ring-expand-2 3s 1s ease-out infinite" }} />

                {/* Center outer ring */}
                <circle cx={CX} cy={CY} r="38" fill="none" stroke="rgba(124,58,237,0.3)" strokeWidth="1" strokeDasharray="4 4"
                  style={{ transformOrigin:"200px 200px", animation:"center-spin 20s linear infinite" }} />

                {/* Center glow fill */}
                <circle cx={CX} cy={CY} r="60" fill="url(#centerGlow)" />

                {/* Center node */}
                <circle cx={CX} cy={CY} r="30" fill="rgba(124,58,237,0.15)" stroke="rgba(124,58,237,0.6)" strokeWidth="1.5" />
                <circle cx={CX} cy={CY} r="22" fill="rgba(124,58,237,0.25)" stroke="rgba(124,58,237,0.8)" strokeWidth="1" />
                <circle cx={CX} cy={CY} r="14" fill="rgba(124,58,237,0.6)" />
                {/* Center wifi icon paths (simplified) */}
                <text x={CX} y={CY + 5} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="monospace">N</text>

                {/* Outer nodes */}
                {NODES.map((n) => (
                  <g key={n.id}>
                    {/* Node glow */}
                    <circle cx={n.x} cy={n.y} r="20" fill={`url(#grad-${n.id})`} />
                    {/* Node ring */}
                    <circle cx={n.x} cy={n.y} r="12" fill="rgba(0,0,0,0.5)" stroke={n.color} strokeWidth="1.5" strokeOpacity="0.5" />
                    {/* Node core */}
                    <circle cx={n.x} cy={n.y} r="7" fill={n.color} fillOpacity="0.9"
                      style={{ animation:`node-pulse 2s ${n.delay}s ease-in-out infinite` }} />
                    {/* Node dot */}
                    <circle cx={n.x} cy={n.y} r="3" fill="white" fillOpacity="0.9" />
                    {/* Label */}
                    <text
                      x={n.x + (n.x > CX ? 18 : n.x < CX ? -18 : 0)}
                      y={n.y + (n.y > CY ? 20 : n.y < CY ? -16 : 5)}
                      textAnchor={n.x > CX ? "start" : n.x < CX ? "end" : "middle"}
                      fill={n.color} fontSize="10" fontWeight="700" fontFamily="'JetBrains Mono', monospace"
                      style={{ letterSpacing: 0.5 }}
                    >
                      {n.label}
                    </text>
                  </g>
                ))}

                {/* Signal bars — bottom right corner */}
                {[0,1,2,3].map((i) => (
                  <rect key={i}
                    x={350 + i * 9} y={360 - i * 8}
                    width="6" height={8 + i * 8}
                    rx="2" fill="#A78BFA"
                    fillOpacity={i < 3 ? 1 : 0.3}
                    style={{ animation:`signal-bar 1.5s ${i * 0.2}s ease-in-out infinite` }}
                  />
                ))}
              </svg>

              {/* Floating metric cards */}
              {/* PING card */}
              <div style={{ position:"absolute", top:30, right:-20, background:"rgba(6,6,20,0.85)", border:"1px solid rgba(16,185,129,0.4)", borderRadius:12, padding:"10px 16px", backdropFilter:"blur(16px)", boxShadow:"0 8px 32px rgba(0,0,0,0.5)", animation:"float-card 6s ease-in-out infinite", minWidth:110 }}>
                <p style={{ color:"rgba(255,255,255,0.4)", fontSize:9, fontWeight:700, letterSpacing:2, textTransform:"uppercase", fontFamily:"'JetBrains Mono', monospace", marginBottom:3 }}>PING</p>
                <div className="flex items-baseline gap-1">
                  <span style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:26, lineHeight:1, color:"#34D399", letterSpacing:"-1px" }}>4</span>
                  <span style={{ color:"#34D399", fontSize:12, fontWeight:700 }}>ms</span>
                </div>
                <div style={{ height:2, background:"rgba(52,211,153,0.2)", borderRadius:999, marginTop:6, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:"95%", background:"linear-gradient(90deg, #10B981, #34D399)", borderRadius:999 }} />
                </div>
              </div>

              {/* UPTIME card */}
              <div style={{ position:"absolute", bottom:50, left:-30, background:"rgba(6,6,20,0.85)", border:"1px solid rgba(124,58,237,0.4)", borderRadius:12, padding:"10px 16px", backdropFilter:"blur(16px)", boxShadow:"0 8px 32px rgba(0,0,0,0.5)", animation:"float-card 7s 1s ease-in-out infinite", minWidth:120 }}>
                <p style={{ color:"rgba(255,255,255,0.4)", fontSize:9, fontWeight:700, letterSpacing:2, textTransform:"uppercase", fontFamily:"'JetBrains Mono', monospace", marginBottom:3 }}>UPTIME</p>
                <div className="flex items-baseline gap-0.5">
                  <span style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:24, lineHeight:1, color:"#A78BFA", letterSpacing:"-1px" }}>99.9</span>
                  <span style={{ color:"#A78BFA", fontSize:14, fontWeight:700 }}>%</span>
                </div>
                <div style={{ height:2, background:"rgba(124,58,237,0.2)", borderRadius:999, marginTop:6, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:"99.9%", background:"linear-gradient(90deg, #7C3AED, #A78BFA)", borderRadius:999 }} />
                </div>
              </div>

              {/* NODES card */}
              <div style={{ position:"absolute", top:10, left:20, background:"rgba(6,6,20,0.85)", border:"1px solid rgba(6,182,212,0.35)", borderRadius:12, padding:"10px 16px", backdropFilter:"blur(16px)", boxShadow:"0 8px 32px rgba(0,0,0,0.5)", animation:"float-badge 5s 0.5s ease-in-out infinite" }}>
                <p style={{ color:"rgba(255,255,255,0.4)", fontSize:9, fontWeight:700, letterSpacing:2, textTransform:"uppercase", fontFamily:"'JetBrains Mono', monospace", marginBottom:3 }}>NŒUDS ACTIFS</p>
                <div className="flex items-center gap-2">
                  <span style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:22, lineHeight:1, color:"#67E8F9" }}>22+</span>
                  <span style={{ color:"rgba(255,255,255,0.3)", fontSize:11 }}>villes</span>
                </div>
              </div>

              {/* Sans contrat badge */}
              <div style={{ position:"absolute", top:-18, right:40, background:"linear-gradient(135deg, #7C3AED, #5B21B6)", borderRadius:14, padding:"11px 18px", boxShadow:"0 12px 40px rgba(124,58,237,0.5), 0 0 0 1px rgba(124,58,237,0.4)", animation:"float-badge 5s ease-in-out infinite" }}>
                <p style={{ color:"#FFFFFF", fontSize:10, fontWeight:800, textTransform:"uppercase", letterSpacing:2, margin:0, fontFamily:"'Space Grotesk', sans-serif" }}>{isFr ? "Sans contrat" : "No contract"}</p>
              </div>

              {/* Glow under */}
              <div aria-hidden style={{ position:"absolute", bottom:-60, left:"10%", right:"10%", height:100, background:"radial-gradient(ellipse, rgba(124,58,237,0.4) 0%, transparent 70%)", animation:"glow-pulse 4s ease-in-out infinite", pointerEvents:"none" }} />
            </div>
          </div>

        </div>
      </div>

      {/* Stats ticker */}
      <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", background:"rgba(0,0,0,0.5)", backdropFilter:"blur(12px)", overflow:"hidden", position:"relative" }}>
        <div aria-hidden style={{ position:"absolute", right:0, top:0, bottom:0, width:80, zIndex:2, background:"linear-gradient(90deg, transparent 0%, rgba(2,2,9,1) 100%)", pointerEvents:"none" }} />
        <div style={{ display:"flex", animation:"ticker 30s linear infinite", width:"max-content" }}>
          {[...Array(2)].map((_, rep) => (
            <div key={rep} className="flex items-center" style={{ gap:0 }}>
              {[
                { val:"940 Mbps",  desc: isFr ? "Vitesse max fibre" : "Max fibre speed" },
                { val:"99.9%",     desc: isFr ? "Disponibilité réseau" : "Network uptime" },
                { val:"4 ms",      desc: isFr ? "Latence moyenne" : "Avg latency" },
                { val:"22+ villes",desc: isFr ? "Couverture Québec" : "Quebec coverage" },
                { val:"5G LTE",    desc: isFr ? "Réseau mobile" : "Mobile network" },
                { val:"0$",        desc: isFr ? "Frais d'installation" : "Setup fees" },
                { val:"7j/7",      desc: isFr ? "Support client" : "Customer support" },
                { val:"IPv6",      desc: isFr ? "Prêt pour demain" : "Future-ready" },
              ].map((s, i) => (
                <div key={i} className="flex items-center" style={{ padding:"18px 32px" }}>
                  <span style={{ fontFamily:"'Space Grotesk', sans-serif", fontWeight:800, fontSize:18, color:"#FFFFFF", letterSpacing:"-0.5px", marginRight:10 }}>{s.val}</span>
                  <span style={{ color:"rgba(255,255,255,0.35)", fontSize:12, fontWeight:500 }}>{s.desc}</span>
                  {i < 7 && <span style={{ marginLeft:32, color:"rgba(124,58,237,0.5)", fontSize:18 }}>·</span>}
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
