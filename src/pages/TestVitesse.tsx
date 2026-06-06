import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { TicketCheck, Mail, Share2, RefreshCw, Server, Wifi, ArrowDown, ArrowUp } from "lucide-react";
import SpeedTest from "@cloudflare/speedtest";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PhotoBg } from "@/components/PhotoBg";

// ─── Constants ────────────────────────────────────────────────

// ─── Types ────────────────────────────────────────────────────
type Phase = "idle" | "ping" | "download" | "upload" | "done" | "error";
interface ClientInfo { ip: string; isp: string; city: string; region: string; }
interface Results { ping: number; jitter: number; pingMin: number; pingMax: number; download: number; upload: number; id: string; }

// ─── Arc gauge (SVG) ──────────────────────────────────────────
const R = 140, CX = 180, CY = 180;
const CIRC = 2 * Math.PI * R;
const ARC_DEG = 240, ARC_LEN = CIRC * (ARC_DEG / 360);

function pctToArc(pct: number) { return Math.max(0, Math.min(1, pct)) * ARC_LEN; }

function SpeedGauge({ speed, phase, maxMbps = 1000 }: { speed: number; phase: Phase; maxMbps?: number }) {
  const pct = speed / maxMbps;
  const filled = pctToArc(pct);
  const gradId = phase === "upload" ? "ulG" : "dlG";
  const color = phase === "upload" ? "#06B6D4" : "#A78BFA";

  return (
    <svg viewBox="0 0 360 300" width="100%" style={{ maxWidth: 360 }}>
      <defs>
        <linearGradient id="dlG" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7C3AED" /><stop offset="100%" stopColor="#A78BFA" />
        </linearGradient>
        <linearGradient id="ulG" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0891B2" /><stop offset="100%" stopColor="#06B6D4" />
        </linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>

      {/* Track */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={20} strokeLinecap="round"
        strokeDasharray={`${ARC_LEN} ${CIRC - ARC_LEN}`} transform={`rotate(150,${CX},${CY})`} />

      {/* Filled arc */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke={`url(#${gradId})`} strokeWidth={20} strokeLinecap="round"
        strokeDasharray={`${filled} ${CIRC - filled}`} transform={`rotate(150,${CX},${CY})`}
        filter="url(#glow)" style={{ transition: "stroke-dasharray 0.12s ease-out" }} />

      {/* Tick marks */}
      {[0, 100, 250, 500, 750, 1000].map(v => {
        const a = (150 + (v / maxMbps) * 240) * Math.PI / 180;
        const ri = R - 22, ro = R - 10;
        return <line key={v} x1={CX + ri * Math.cos(a)} y1={CY + ri * Math.sin(a)} x2={CX + ro * Math.cos(a)} y2={CY + ro * Math.sin(a)} stroke="rgba(255,255,255,0.15)" strokeWidth={v % 500 === 0 ? 2 : 1} />;
      })}

      {/* Center number */}
      <text x={CX} y={CY - 12} textAnchor="middle" dominantBaseline="middle"
        fill="#fff" fontSize={speed >= 100 ? 56 : 62} fontFamily="'Space Grotesk',sans-serif" fontWeight={800} letterSpacing={-2} filter="url(#glow)">
        {speed < 10 ? speed.toFixed(1) : Math.round(speed)}
      </text>
      <text x={CX} y={CY + 32} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize={13} fontFamily="'JetBrains Mono',monospace">
        Mbps
      </text>

      {/* Phase label */}
      <text x={CX} y={270} textAnchor="middle" fill={color} fontSize={11} fontFamily="'JetBrains Mono',monospace" letterSpacing={2.5}>
        {phase === "ping" ? "LATENCE" : phase === "download" ? "TÉLÉCHARGEMENT" : "ENVOI"}
      </text>
    </svg>
  );
}

// ─── Speed test engine (Cloudflare edge network) ─────────────
function useSpeedTest() {
  const [phase, setPhase]     = useState<Phase>("idle");
  const [liveSpeed, setLive]  = useState(0);
  const [results, setResults] = useState<Results | null>(null);
  const engineRef             = useRef<InstanceType<typeof SpeedTest> | null>(null);
  const tickerRef             = useRef<ReturnType<typeof setInterval> | null>(null);

  const run = useCallback(() => {
    engineRef.current?.pause();
    if (tickerRef.current) clearInterval(tickerRef.current);
    setResults(null);
    setLive(0);
    setPhase("ping");

    const engine = new SpeedTest({
      autoStart: false,
      // Skip packet-loss (WebRTC) — we only need latency + bandwidth
      measurements: [
        { type: "latency",  numPackets: 4 },
        { type: "download", bytes: 1e5,  count: 4, bypassMinDuration: true },
        { type: "download", bytes: 5e5,  count: 4, bypassMinDuration: true },
        { type: "download", bytes: 1e6,  count: 4, bypassMinDuration: true },
        { type: "download", bytes: 1e7,  count: 4 },
        { type: "download", bytes: 2.5e7, count: 4 },
        { type: "latency",  numPackets: 4 },
        { type: "upload",   bytes: 1e5,  count: 4, bypassMinDuration: true },
        { type: "upload",   bytes: 5e5,  count: 4, bypassMinDuration: true },
        { type: "upload",   bytes: 1e6,  count: 4, bypassMinDuration: true },
        { type: "upload",   bytes: 1e7,  count: 4 },
      ],
    });
    engineRef.current = engine;

    // Running max so the needle climbs and never drops back
    let maxDl = 0, maxUl = 0;

    // Poll at 150 ms — gives smooth animation between measurement blocks
    tickerRef.current = setInterval(() => {
      const r     = engine.results;
      const dlPts = r.getDownloadBandwidthPoints();
      const ulPts = r.getUploadBandwidthPoints();
      if (ulPts.length) {
        maxUl = Math.max(maxUl, ulPts[ulPts.length - 1].bps);
        setLive(Math.round(maxUl / 1e6));
      } else if (dlPts.length) {
        maxDl = Math.max(maxDl, dlPts[dlPts.length - 1].bps);
        setLive(Math.round(maxDl / 1e6));
      }
    }, 150);

    // Phase detection only — live speed is driven by the ticker above
    engine.onResultsChange = ({ type }) => {
      if (type === "download") setPhase("download");
      else if (type === "upload") setPhase("upload");
    };

    engine.onFinish = (r) => {
      if (tickerRef.current) clearInterval(tickerRef.current);
      const dl     = Math.round((r.getDownloadBandwidth() || 0) / 1e6);
      const ul     = Math.round((r.getUploadBandwidth()   || 0) / 1e6);
      const ping   = Math.round( r.getUnloadedLatency()   || 0);
      const jitter = Math.round((r.getUnloadedJitter()    || 0));
      setResults({
        download: dl, upload: ul,
        ping, jitter, pingMin: ping, pingMax: ping,
        id: Math.floor(Math.random() * 1e13).toString().padStart(13, "0"),
      });
      setLive(dl);
      setPhase("done");
    };

    engine.onError = (e) => {
      if (tickerRef.current) clearInterval(tickerRef.current);
      console.error(e);
      setPhase("error");
    };

    engine.play();
  }, []);

  const reset = useCallback(() => {
    engineRef.current?.pause();
    if (tickerRef.current) clearInterval(tickerRef.current);
    setPhase("idle");
    setLive(0);
    setResults(null);
  }, []);

  useEffect(() => () => {
    engineRef.current?.pause();
    if (tickerRef.current) clearInterval(tickerRef.current);
  }, []);

  return { phase, liveSpeed, results, run, reset };
}

// ─── Component ────────────────────────────────────────────────
export default function TestVitesse() {
  const { phase, liveSpeed, results, run, reset } = useSpeedTest();
  const [info, setInfo] = useState<ClientInfo>({ ip: "…", isp: "…", city: "…", region: "…" });
  const [infoLoaded, setInfoLoaded] = useState(false);

  // Fetch client info directly from browser — no backend needed
  useEffect(() => {
    fetch("https://ipapi.co/json/", { cache: "no-store" })
      .then(r => r.json())
      .then(d => {
        const isp = d.org ? d.org.replace(/^AS\d+\s+/, "").trim() : "—";
        setInfo({ ip: d.ip || "—", isp: isp || "—", city: d.city || "—", region: d.region || "—" });
        setInfoLoaded(true);
      })
      .catch(() => { setInfo({ ip: "—", isp: "—", city: "—", region: "—" }); setInfoLoaded(true); });
  }, []);

  const share = () => {
    if (!results) return;
    const txt = `Test de vitesse Nivra Telecom\n↓ ${results.download} Mbps  ↑ ${results.upload} Mbps  📡 ${results.ping} ms\nnivra-telecom.ca/test-vitesse`;
    navigator.share?.({ text: txt }).catch(() => navigator.clipboard.writeText(txt)) ?? navigator.clipboard.writeText(txt);
  };

  const isRunning = phase === "ping" || phase === "download" || phase === "upload";
  const progressPct = phase === "ping" ? 15 : phase === "download" ? 55 : phase === "upload" ? 90 : phase === "done" ? 100 : 0;

  return (
    <>
      <Helmet>
        <title>Test de vitesse Internet — Nivra Telecom</title>
        <meta name="description" content="Testez votre vitesse Internet en temps réel — téléchargement, envoi et latence mesurés depuis nos serveurs au Québec." />
        <link rel="canonical" href="https://nivra-telecom.ca/test-vitesse" />
      </Helmet>
      <Header />

      <div style={{ minHeight: "100vh", background: "#020209", color: "#fff", paddingTop: 64 }} className="relative">
        <PhotoBg url="https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1920&q=80" opacity={0.10} filter="saturate(0.5) brightness(0.6)" />
        {/* Aurora bg */}
        <div aria-hidden style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(124,58,237,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,0.04) 1px,transparent 1px)", backgroundSize: "80px 80px", zIndex: 0 }} />
        <div aria-hidden style={{ position: "fixed", top: "20%", right: "-15%", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle,rgba(124,58,237,0.07) 0%,transparent 70%)", animation: "n-aurora-1 20s ease-in-out infinite", pointerEvents: "none", zIndex: 0 }} />

        <main style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto", padding: "40px 20px 80px" }}>

          {/* Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 100, padding: "6px 16px" }}>
              <Wifi className="w-3.5 h-3.5" style={{ color: "#A78BFA" }} />
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#A78BFA", letterSpacing: "0.1em", textTransform: "uppercase" }}>Test de vitesse</span>
            </div>
            <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: "clamp(26px,5vw,42px)", letterSpacing: "-1.5px", color: "#fff" }}>
              Testez votre <span className="n-shimmer-text">connexion Internet</span>
            </h1>
          </div>

          {/* ── Main test card ── */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 28, padding: "32px 24px", boxShadow: "0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)" }}>

            {/* Progress bar */}
            <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginBottom: 28, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progressPct}%`, background: "linear-gradient(90deg,#7C3AED,#06B6D4)", borderRadius: 2, transition: "width 0.6s ease" }} />
            </div>

            {/* Center area */}
            <div className="flex flex-col items-center">

              {/* ── IDLE: GO button ── */}
              {phase === "idle" && (
                <button
                  onClick={run}
                  style={{
                    width: 200, height: 200, borderRadius: "50%",
                    background: "radial-gradient(circle at 35% 35%, rgba(124,58,237,0.5) 0%, rgba(80,20,180,0.35) 60%, rgba(30,5,80,0.4) 100%)",
                    border: "2px solid rgba(124,58,237,0.6)",
                    boxShadow: "0 0 0 12px rgba(124,58,237,0.06), 0 0 0 24px rgba(124,58,237,0.03), 0 8px 40px rgba(124,58,237,0.5)",
                    cursor: "pointer",
                    color: "#fff",
                    fontFamily: "'Space Grotesk',sans-serif",
                    fontWeight: 800,
                    fontSize: 38,
                    letterSpacing: -1,
                    transition: "box-shadow .2s, transform .15s",
                    animation: "n-border-glow 3s ease-in-out infinite",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 0 16px rgba(124,58,237,0.1), 0 0 0 32px rgba(124,58,237,0.05), 0 12px 50px rgba(124,58,237,0.7)"; e.currentTarget.style.transform = "scale(1.04)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 0 0 12px rgba(124,58,237,0.06), 0 0 0 24px rgba(124,58,237,0.03), 0 8px 40px rgba(124,58,237,0.5)"; e.currentTarget.style.transform = "scale(1)"; }}
                >
                  GO
                </button>
              )}

              {/* ── TESTING: Gauge ── */}
              {isRunning && (
                <div style={{ width: "100%", maxWidth: 360 }}>
                  <SpeedGauge speed={liveSpeed} phase={phase} />
                  <div className="flex justify-center mt-2">
                    <button onClick={reset} style={{ padding: "6px 18px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", cursor: "pointer", letterSpacing: "0.05em" }}>
                      ANNULER
                    </button>
                  </div>
                </div>
              )}

              {/* ── RESULTS ── */}
              {phase === "done" && results && (
                <div style={{ width: "100%" }}>
                  {/* Result ID */}
                  <div className="text-center mb-6">
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em" }}>
                      RÉSULTAT #{results.id}
                    </span>
                  </div>

                  {/* DL / UL big numbers */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    {[
                      { label: "Téléchargement", value: results.download, unit: "Mbps", icon: <ArrowDown className="w-5 h-5" />, color: "#A78BFA", glow: "rgba(124,58,237,0.3)" },
                      { label: "Envoi", value: results.upload, unit: "Mbps", icon: <ArrowUp className="w-5 h-5" />, color: "#06B6D4", glow: "rgba(6,182,212,0.3)" },
                    ].map(m => (
                      <div key={m.label} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${m.glow}`, borderRadius: 20, padding: "24px 20px", textAlign: "center", boxShadow: `0 0 30px ${m.glow.replace("0.3", "0.12")}` }}>
                        <div className="flex items-center justify-center gap-2 mb-2" style={{ color: m.color }}>
                          {m.icon}
                          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>{m.label}</span>
                        </div>
                        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 52, letterSpacing: -2, lineHeight: 1, color: "#fff" }}>
                          {m.value}
                        </div>
                        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>{m.unit}</div>
                      </div>
                    ))}
                  </div>

                  {/* Ping stats */}
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 16, padding: "18px 20px", marginBottom: 20 }}>
                    <div className="flex items-center gap-2 mb-3">
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em" }}>LATENCE</span>
                    </div>
                    <div className="flex justify-around">
                      {[
                        { label: "PING", value: `${results.ping} ms`, color: "#FBBF24" },
                        { label: "MIN", value: `${results.pingMin} ms`, color: "rgba(255,255,255,0.6)" },
                        { label: "MAX", value: `${results.pingMax} ms`, color: "rgba(255,255,255,0.6)" },
                        { label: "JITTER", value: `${results.jitter} ms`, color: "rgba(255,255,255,0.5)" },
                      ].map(s => (
                        <div key={s.label} className="text-center">
                          <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 20, color: s.color }}>{s.value}</div>
                          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", marginTop: 2 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 justify-center">
                    <button onClick={reset} className="flex items-center gap-2" style={{ height: 44, padding: "0 22px", borderRadius: 10, border: "1px solid rgba(124,58,237,0.4)", background: "rgba(124,58,237,0.1)", color: "#A78BFA", fontSize: 14, fontWeight: 600, fontFamily: "'Space Grotesk',sans-serif", cursor: "pointer" }}>
                      <RefreshCw className="w-4 h-4" /> Nouveau test
                    </button>
                    <button onClick={share} className="flex items-center gap-2" style={{ height: 44, padding: "0 22px", borderRadius: 10, border: "1px solid rgba(6,182,212,0.4)", background: "rgba(6,182,212,0.08)", color: "#67E8F9", fontSize: 14, fontWeight: 600, fontFamily: "'Space Grotesk',sans-serif", cursor: "pointer" }}>
                      <Share2 className="w-4 h-4" /> Partager
                    </button>
                  </div>
                </div>
              )}

              {/* ── ERROR ── */}
              {phase === "error" && (
                <div className="text-center py-8">
                  <p style={{ color: "#F87171", marginBottom: 16 }}>Erreur lors du test. Vérifiez votre connexion.</p>
                  <button onClick={reset} style={{ padding: "10px 24px", borderRadius: 10, border: "1px solid rgba(124,58,237,0.4)", background: "rgba(124,58,237,0.1)", color: "#A78BFA", cursor: "pointer", fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600 }}>Réessayer</button>
                </div>
              )}
            </div>

            {/* ── Info bar (ISP + Server) ── */}
            <div style={{ marginTop: 28, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="grid grid-cols-2 gap-4">
                {/* Client ISP */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "14px 16px" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Wifi className="w-3.5 h-3.5" style={{ color: "#A78BFA" }} />
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Votre réseau</span>
                  </div>
                  <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 3 }}>
                    {infoLoaded ? info.isp : "Détection…"}
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                    {infoLoaded ? info.ip : "—"}
                  </div>
                  {infoLoaded && info.city !== "—" && (
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 1 }}>
                      {info.city}, {info.region}
                    </div>
                  )}
                </div>

                {/* Server */}
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "14px 16px" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Server className="w-3.5 h-3.5" style={{ color: "#06B6D4" }} />
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Serveur de test</span>
                  </div>
                  <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 3 }}>
                    Cloudflare Edge
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                    Réseau global
                  </div>
                  {results && (
                    <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "#FBBF24", marginTop: 1 }}>
                      {results.ping} ms ping
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Plan comparison ── */}
          <div style={{ marginTop: 32 }}>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 14, color: "#fff", letterSpacing: "-0.5px" }}>
              Comparez avec votre forfait
            </h2>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 16, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(124,58,237,0.1)" }}>
                    {["Forfait", "↓ Téléchargement", "↑ Envoi", "Latence"].map(h => (
                      <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "rgba(255,255,255,0.5)", letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { plan: "Internet 100", down: 90, downLabel: "~90 Mbps", upLabel: "~20 Mbps", ping: "< 20 ms" },
                    { plan: "Internet 500", down: 450, downLabel: "~450 Mbps", upLabel: "~50 Mbps", ping: "< 15 ms" },
                    { plan: "Internet Giga", down: 900, downLabel: "~1 000 Mbps", upLabel: "~100 Mbps", ping: "< 10 ms" },
                  ].map((row, i) => {
                    const isMatch = results && (
                      (i === 0 && results.download >= 60 && results.download < 400) ||
                      (i === 1 && results.download >= 400 && results.download < 800) ||
                      (i === 2 && results.download >= 800)
                    );
                    return (
                      <tr key={row.plan} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: isMatch ? "rgba(124,58,237,0.08)" : undefined }}>
                        <td style={{ padding: "13px 16px", fontSize: 13, fontWeight: 600, fontFamily: "'Space Grotesk',sans-serif", color: isMatch ? "#A78BFA" : "#fff" }}>
                          {row.plan} {isMatch && "✓"}
                        </td>
                        <td style={{ padding: "13px 16px", fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: "#A78BFA" }}>{row.downLabel}</td>
                        <td style={{ padding: "13px 16px", fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: "#06B6D4" }}>{row.upLabel}</td>
                        <td style={{ padding: "13px 16px", fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: "#FBBF24" }}>{row.ping}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
              Vitesse mesurée en conditions réelles — câblage, distance au routeur et appareils actifs influencent le résultat.
            </p>
          </div>

          {/* ── Support ── */}
          <div style={{ marginTop: 28, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 20, padding: "28px", textAlign: "center" }}>
            <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 6, color: "#fff" }}>
              Vitesse inférieure à votre forfait ?
            </h3>
            <p style={{ color: "rgba(255,255,255,0.4)", marginBottom: 20, fontSize: 13 }}>Notre équipe technique est disponible 7j/7.</p>
            <div className="flex gap-3 flex-wrap justify-center">
              <a href="mailto:support@nivra-telecom.ca" className="flex items-center gap-2" style={{ padding: "10px 20px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", textDecoration: "none", fontWeight: 600, fontFamily: "'Space Grotesk',sans-serif", fontSize: 13 }}>
                <Mail className="w-4 h-4" /> Support
              </a>
              <Link to="/portal/tickets" className="flex items-center gap-2" style={{ padding: "10px 20px", borderRadius: 10, background: "linear-gradient(135deg,#7C3AED,#6D28D9)", color: "#fff", textDecoration: "none", fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif", fontSize: 13, boxShadow: "0 4px 16px rgba(124,58,237,0.35)" }}>
                <TicketCheck className="w-4 h-4" /> Ouvrir un ticket
              </Link>
            </div>
          </div>

        </main>
      </div>
      <Footer />
    </>
  );
}
