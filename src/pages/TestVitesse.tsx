import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { TicketCheck, Mail, Share2, RefreshCw, Wifi, ArrowDown, ArrowUp, Activity } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";

// ── Config ─────────────────────────────────────────────────────
const DOWNLOAD_DURATION_MS = 10_000;
const UPLOAD_DURATION_MS   = 10_000;
const PARALLEL_STREAMS     = 4;
const MAX_SCALE_MBPS       = 1000;
const PING_ROUNDS          = 8;

type Phase = "idle" | "ping" | "download" | "upload" | "done" | "error";

interface Results {
  ping: number;
  jitter: number;
  download: number;
  upload: number;
}

// ── Gauge SVG ───────────────────────────────────────────────────
// 240° arc, starting at bottom-left (210° from right = 7 o'clock)
const CX = 200, CY = 210, R = 158;
const CIRC = 2 * Math.PI * R;
const ARC_DEG = 240;
const ARC_LEN = CIRC * (ARC_DEG / 360);
const START_DEG = 150; // rotate so arc starts at 210° position (7 o'clock)

function GaugeArc({ pct, color }: { pct: number; color: string }) {
  const filled = Math.max(0, Math.min(1, pct)) * ARC_LEN;
  return (
    <circle
      cx={CX} cy={CY} r={R}
      fill="none"
      stroke={color}
      strokeWidth={18}
      strokeLinecap="round"
      strokeDasharray={`${filled} ${CIRC - filled}`}
      transform={`rotate(${START_DEG}, ${CX}, ${CY})`}
      style={{ transition: "stroke-dasharray 0.25s ease-out" }}
    />
  );
}

function SpeedGauge({ speed, phase, results }: {
  speed: number;
  phase: Phase;
  results: Results | null;
}) {
  const pct = Math.min(speed / MAX_SCALE_MBPS, 1);
  const displaySpeed = speed < 10 ? speed.toFixed(1) : Math.round(speed).toString();

  const phaseColor = phase === "download" ? "#A78BFA" : phase === "upload" ? "#06B6D4" : phase === "ping" ? "#FBBF24" : "#ffffff";
  const arcColor = phase === "download" ? "url(#dlGrad)"
    : phase === "upload" ? "url(#ulGrad)"
    : phase === "done" ? "url(#doneGrad)"
    : "rgba(255,255,255,0.25)";

  return (
    <div className="flex flex-col items-center" style={{ userSelect: "none" }}>
      <svg viewBox="0 0 400 340" width="360" height="306" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="dlGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#A78BFA" />
          </linearGradient>
          <linearGradient id="ulGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0891B2" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
          <linearGradient id="doneGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="50%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Background arc */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={18} strokeLinecap="round"
          strokeDasharray={`${ARC_LEN} ${CIRC - ARC_LEN}`} transform={`rotate(${START_DEG}, ${CX}, ${CY})`} />

        {/* Filled arc */}
        <GaugeArc pct={pct} color={arcColor} />

        {/* Scale ticks */}
        {[0, 100, 200, 300, 500, 750, 1000].map(val => {
          const angle = (START_DEG + (val / MAX_SCALE_MBPS) * ARC_DEG) * (Math.PI / 180);
          const innerR = R - 24, outerR = R - 12;
          const x1 = CX + innerR * Math.cos(angle), y1 = CY + innerR * Math.sin(angle);
          const x2 = CX + outerR * Math.cos(angle), y2 = CY + outerR * Math.sin(angle);
          const tx = CX + (R - 36) * Math.cos(angle), ty = CY + (R - 36) * Math.sin(angle);
          return (
            <g key={val}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.2)" strokeWidth={val === 0 || val === 1000 ? 2 : 1} />
              {[0, 100, 500, 1000].includes(val) && (
                <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.3)" fontSize={10} fontFamily="'JetBrains Mono', monospace">
                  {val === 1000 ? "1G" : val}
                </text>
              )}
            </g>
          );
        })}

        {/* Center speed display */}
        {phase !== "idle" && (
          <>
            <text x={CX} y={CY - 12} textAnchor="middle" dominantBaseline="middle"
              fill="#ffffff" fontSize={phase === "ping" ? 44 : 62}
              fontFamily="'Space Grotesk', sans-serif" fontWeight={800} letterSpacing={-2}
              filter={phase !== "done" ? "url(#glow)" : undefined}>
              {phase === "ping" ? "…" : displaySpeed}
            </text>
            <text x={CX} y={CY + 36} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize={14}
              fontFamily="'JetBrains Mono', monospace">
              {phase === "ping" ? "PING" : "Mbps"}
            </text>
          </>
        )}

        {phase === "idle" && (
          <text x={CX} y={CY + 8} textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize={16}
            fontFamily="'JetBrains Mono', monospace">
            PRÊT
          </text>
        )}

        {/* Phase label */}
        <text x={CX} y={300} textAnchor="middle" fill={phaseColor} fontSize={12}
          fontFamily="'JetBrains Mono', monospace" letterSpacing={2}>
          {phase === "idle" ? "" : phase === "ping" ? "LATENCE" : phase === "download" ? "TÉLÉCHARGEMENT" : phase === "upload" ? "ENVOI" : phase === "done" ? "TERMINÉ" : "ERREUR"}
        </text>
      </svg>

      {/* Results bar (shown after done) */}
      {results && (
        <div className="flex gap-6 mt-2">
          {[
            { label: "PING", value: `${results.ping} ms`, icon: <Activity className="w-3.5 h-3.5" />, color: "#FBBF24" },
            { label: "JITTER", value: `${results.jitter} ms`, icon: <Activity className="w-3.5 h-3.5" />, color: "rgba(255,255,255,0.4)" },
            { label: "↓ DL", value: `${results.download} Mbps`, icon: <ArrowDown className="w-3.5 h-3.5" />, color: "#A78BFA" },
            { label: "↑ UL", value: `${results.upload} Mbps`, icon: <ArrowUp className="w-3.5 h-3.5" />, color: "#06B6D4" },
          ].map(s => (
            <div key={s.label} className="flex flex-col items-center gap-0.5">
              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em" }}>{s.label}</span>
              <span style={{ color: s.color, fontSize: 15, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}>{s.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Speed Test Engine ──────────────────────────────────────────
function useSpeedTest() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [speed, setSpeed] = useState(0);
  const [results, setResults] = useState<Results | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const DOWNLOAD_URL = `${supabaseUrl}/functions/v1/speedtest-server?action=download`;
  const PING_URL = `${supabaseUrl}/functions/v1/speedtest-server?action=ping`;
  const UPLOAD_URL = `${supabaseUrl}/functions/v1/speedtest-upload`;

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {} as Record<string, string>;
  }, []);

  const measurePing = useCallback(async (headers: Record<string, string>) => {
    const times: number[] = [];
    for (let i = 0; i < PING_ROUNDS; i++) {
      const t0 = performance.now();
      await fetch(PING_URL, { cache: "no-store", headers });
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    const trimmed = times.slice(1, -1); // drop best and worst
    const avg = trimmed.reduce((s, v) => s + v, 0) / trimmed.length;
    const jitter = Math.max(...trimmed) - Math.min(...trimmed);
    return { ping: Math.round(avg), jitter: Math.round(jitter) };
  }, [PING_URL]);

  const measureDownload = useCallback(async (
    headers: Record<string, string>,
    signal: AbortSignal,
    onProgress: (mbps: number) => void,
  ) => {
    let totalBytes = 0;
    const start = performance.now();
    const lastUpdate = { t: start, b: 0 };

    const stream = async () => {
      while (!signal.aborted && performance.now() - start < DOWNLOAD_DURATION_MS) {
        const resp = await fetch(DOWNLOAD_URL, { cache: "no-store", headers, signal });
        const reader = resp.body!.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done || signal.aborted) break;
          totalBytes += value.byteLength;
          const now = performance.now();
          if (now - lastUpdate.t >= 250) {
            const elapsed = (now - lastUpdate.t) / 1000;
            const bytes = totalBytes - lastUpdate.b;
            onProgress((bytes * 8) / elapsed / 1_000_000);
            lastUpdate.t = now;
            lastUpdate.b = totalBytes;
          }
        }
      }
    };

    await Promise.all(Array.from({ length: PARALLEL_STREAMS }, stream).map(p => p.catch(() => {})));
    const elapsed = (performance.now() - start) / 1000;
    return Math.round((totalBytes * 8) / elapsed / 1_000_000);
  }, [DOWNLOAD_URL]);

  const measureUpload = useCallback(async (
    headers: Record<string, string>,
    signal: AbortSignal,
    onProgress: (mbps: number) => void,
  ) => {
    const CHUNK = 512 * 1024; // 512 KB per POST
    let totalBytes = 0;
    const start = performance.now();
    const lastUpdate = { t: start, b: 0 };
    // Pre-build a chunk of non-compressible data
    const payload = new Uint8Array(CHUNK);
    let seed = 0xCAFEBABE;
    for (let i = 0; i < CHUNK; i++) { seed ^= seed << 13; seed ^= seed >> 17; payload[i] = seed & 0xFF; }

    const stream = async () => {
      while (!signal.aborted && performance.now() - start < UPLOAD_DURATION_MS) {
        await fetch(UPLOAD_URL, {
          method: "POST",
          body: payload,
          headers: { ...headers, "Content-Type": "application/octet-stream" },
          signal,
        });
        totalBytes += CHUNK;
        const now = performance.now();
        if (now - lastUpdate.t >= 250) {
          const elapsed = (now - lastUpdate.t) / 1000;
          const bytes = totalBytes - lastUpdate.b;
          onProgress((bytes * 8) / elapsed / 1_000_000);
          lastUpdate.t = now;
          lastUpdate.b = totalBytes;
        }
      }
    };

    const streams = Math.min(PARALLEL_STREAMS - 1, 3);
    await Promise.all(Array.from({ length: streams }, stream).map(p => p.catch(() => {})));
    const elapsed = (performance.now() - start) / 1000;
    return Math.round((totalBytes * 8) / elapsed / 1_000_000);
  }, [UPLOAD_URL]);

  const start = useCallback(async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setResults(null);
    setSpeed(0);

    try {
      const headers = await getHeaders();

      // 1. Ping
      setPhase("ping");
      setSpeed(0);
      const { ping, jitter } = await measurePing(headers);

      if (ctrl.signal.aborted) return;

      // 2. Download
      setPhase("download");
      setSpeed(0);
      const dl = await measureDownload(headers, ctrl.signal, setSpeed);

      if (ctrl.signal.aborted) return;

      // 3. Upload
      setPhase("upload");
      setSpeed(0);
      const ul = await measureUpload(headers, ctrl.signal, setSpeed);

      if (ctrl.signal.aborted) return;

      const finalResults = { ping, jitter, download: dl, upload: ul };
      setResults(finalResults);
      setSpeed(dl); // show download on gauge at the end
      setPhase("done");
    } catch (e: any) {
      if (e.name !== "AbortError") {
        console.error("Speed test error:", e);
        setPhase("error");
      }
    }
  }, [getHeaders, measurePing, measureDownload, measureUpload]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setPhase("idle");
    setSpeed(0);
    setResults(null);
  }, []);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  return { phase, speed, results, start, reset };
}

// ── Component ───────────────────────────────────────────────────
export default function TestVitesse() {
  const { phase, speed, results, start, reset } = useSpeedTest();

  const shareResult = () => {
    if (!results) return;
    const text = `🚀 Test de vitesse Nivra Telecom\n↓ ${results.download} Mbps téléchargement\n↑ ${results.upload} Mbps envoi\n📡 ${results.ping} ms ping\nnivra-telecom.ca/test-vitesse`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else navigator.clipboard.writeText(text);
  };

  const planMatch = (mbps: number) => {
    if (mbps >= 800) return { label: "Internet Giga ✓", color: "#10B981" };
    if (mbps >= 400) return { label: "Internet 500 Mbps ✓", color: "#A78BFA" };
    if (mbps >= 80) return { label: "Internet 100 Mbps ✓", color: "#06B6D4" };
    return { label: "En dessous du forfait de base", color: "#F87171" };
  };

  return (
    <>
      <Helmet>
        <title>Test de vitesse Internet — Nivra Telecom</title>
        <meta name="description" content="Testez votre vitesse Internet Nivra en temps réel — téléchargement, envoi et latence mesurés depuis nos serveurs au Québec." />
        <link rel="canonical" href="https://nivra-telecom.ca/test-vitesse" />
      </Helmet>

      <Header />

      <div style={{ minHeight: "100vh", background: "#020209", color: "#fff", paddingTop: 64 }}>

        {/* Hero */}
        <section className="relative overflow-hidden" style={{ paddingTop: 60, paddingBottom: 40, textAlign: "center" }}>
          <div aria-hidden style={{ position: "absolute", top: "-20%", left: "-10%", width: 550, height: 550, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)", animation: "n-aurora-1 18s ease-in-out infinite", pointerEvents: "none" }} />
          <div aria-hidden style={{ position: "absolute", bottom: "-20%", right: "-10%", width: 450, height: 450, borderRadius: "50%", background: "radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)", animation: "n-aurora-2 14s ease-in-out infinite", pointerEvents: "none" }} />
          <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(124,58,237,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.04) 1px, transparent 1px)", backgroundSize: "80px 80px", pointerEvents: "none" }} />

          <div style={{ position: "relative", zIndex: 2, maxWidth: 700, margin: "0 auto", padding: "0 24px" }}>
            <div className="n-animate-in inline-flex items-center gap-2 mb-5" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 100, padding: "6px 16px" }}>
              <Wifi style={{ width: 14, height: 14, color: "#A78BFA" }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#A78BFA", letterSpacing: "0.1em", textTransform: "uppercase" }}>Test de vitesse Nivra</span>
            </div>
            <h1 className="n-animate-in-delay-1" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: "clamp(28px, 5vw, 52px)", letterSpacing: "-2px", lineHeight: 1.05, marginBottom: 12, color: "#fff" }}>
              Testez votre <span className="n-shimmer-text">vitesse Internet</span>
            </h1>
            <p className="n-animate-in-delay-2" style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", marginBottom: 0 }}>
              Mesuré depuis nos serveurs au Québec · Téléchargement, envoi, latence
            </p>
          </div>
        </section>

        {/* Gauge + CTA */}
        <section style={{ maxWidth: 540, margin: "0 auto", padding: "0 24px 40px", textAlign: "center" }}>

          {/* Gauge */}
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 28, padding: "32px 24px 24px", marginBottom: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
            <SpeedGauge speed={speed} phase={phase} results={results} />

            {/* Start / Reset button */}
            <div style={{ marginTop: 24, display: "flex", gap: 12, justifyContent: "center" }}>
              {phase === "idle" && (
                <button
                  onClick={start}
                  style={{ height: 52, padding: "0 40px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)", color: "#fff", fontWeight: 800, fontSize: 15, fontFamily: "'Space Grotesk', sans-serif", cursor: "pointer", boxShadow: "0 0 0 1px rgba(124,58,237,0.5), 0 8px 28px rgba(124,58,237,0.45)", transition: "box-shadow .18s, transform .15s", letterSpacing: "-0.3px" }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(124,58,237,0.7), 0 12px 36px rgba(124,58,237,0.6)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 0 0 1px rgba(124,58,237,0.5), 0 8px 28px rgba(124,58,237,0.45)"; e.currentTarget.style.transform = "none"; }}
                >
                  ▶ Démarrer le test
                </button>
              )}

              {(phase === "ping" || phase === "download" || phase === "upload") && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                  {/* Progress bar */}
                  <div style={{ width: 280, height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      background: phase === "ping" ? "#FBBF24" : phase === "download" ? "linear-gradient(90deg, #7C3AED, #A78BFA)" : "linear-gradient(90deg, #0891B2, #06B6D4)",
                      borderRadius: 2,
                      width: phase === "ping" ? "33%" : phase === "download" ? "66%" : "99%",
                      transition: "width .5s ease",
                      animation: "n-beam-h 1.5s ease-in-out infinite",
                    }} />
                  </div>
                  <button onClick={reset} style={{ height: 38, padding: "0 20px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", cursor: "pointer", letterSpacing: "0.05em" }}>
                    ANNULER
                  </button>
                </div>
              )}

              {(phase === "done" || phase === "error") && (
                <div className="flex gap-3">
                  <button
                    onClick={reset}
                    className="flex items-center gap-2"
                    style={{ height: 46, padding: "0 22px", borderRadius: 10, border: "1px solid rgba(124,58,237,0.4)", background: "rgba(124,58,237,0.1)", color: "#A78BFA", fontSize: 13, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", cursor: "pointer" }}
                  >
                    <RefreshCw className="w-4 h-4" /> Nouveau test
                  </button>
                  {results && (
                    <button
                      onClick={shareResult}
                      className="flex items-center gap-2"
                      style={{ height: 46, padding: "0 22px", borderRadius: 10, border: "1px solid rgba(6,182,212,0.4)", background: "rgba(6,182,212,0.08)", color: "#67E8F9", fontSize: 13, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", cursor: "pointer" }}
                    >
                      <Share2 className="w-4 h-4" /> Partager
                    </button>
                  )}
                </div>
              )}

              {phase === "error" && (
                <p style={{ color: "#F87171", fontSize: 13, marginTop: 8 }}>
                  Erreur — vérifiez votre connexion et réessayez.
                </p>
              )}
            </div>

            {/* Plan match */}
            {results && (
              <div style={{ marginTop: 20, padding: "12px 20px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }}>
                {(() => {
                  const m = planMatch(results.download);
                  return <p style={{ color: m.color, fontSize: 14, fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600 }}>{m.label}</p>;
                })()}
              </div>
            )}
          </div>

          {/* Server info */}
          <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em" }}>
            SERVEUR · QUÉBEC, CANADA · NIVRA TELECOM
          </p>
        </section>

        {/* Info cards */}
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 48px" }}>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {[
              { icon: <ArrowDown className="w-5 h-5" style={{ color: "#A78BFA" }} />, bg: "rgba(124,58,237,0.12)", title: "Téléchargement", lines: ["Streams parallèles", "Mesure sur 10 secondes"] },
              { icon: <ArrowUp className="w-5 h-5" style={{ color: "#06B6D4" }} />, bg: "rgba(6,182,212,0.12)", title: "Envoi", lines: ["Paquets compressibles", "Mesure sur 10 secondes"] },
              { icon: <Activity className="w-5 h-5" style={{ color: "#FBBF24" }} />, bg: "rgba(245,158,11,0.12)", title: "Latence & Jitter", lines: ["8 pings consécutifs", "Résultat en millisecondes"] },
            ].map(c => (
              <div key={c.title} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "20px 24px" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>{c.icon}</div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, marginBottom: 6, color: "#fff" }}>{c.title}</div>
                {c.lines.map(l => <div key={l} style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>{l}</div>)}
              </div>
            ))}
          </div>
        </section>

        {/* Plan comparison */}
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 48px" }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 16, color: "#fff", letterSpacing: "-0.5px" }}>
            Comparez avec votre forfait Nivra
          </h2>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 460 }}>
                <thead>
                  <tr style={{ background: "rgba(124,58,237,0.12)" }}>
                    {["Forfait", "Téléchargement", "Envoi", "Latence typique"].map(h => (
                      <th key={h} style={{ padding: "14px 18px", textAlign: "left", fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.6)", letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { plan: "Internet 100 Mbps", down: "~90 Mbps",    up: "~20 Mbps",   ping: "< 20 ms" },
                    { plan: "Internet 500 Mbps", down: "~450 Mbps",   up: "~50 Mbps",   ping: "< 15 ms" },
                    { plan: "Internet Giga",     down: "~1 000 Mbps", up: "~100 Mbps",  ping: "< 10 ms" },
                  ].map((row, i) => (
                    <tr key={row.plan} style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: results && ((i === 0 && results.download >= 80) || (i === 1 && results.download >= 400) || (i === 2 && results.download >= 800)) ? "rgba(124,58,237,0.06)" : undefined }}>
                      <td style={{ padding: "14px 18px", fontSize: 14, fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", color: "#fff" }}>{row.plan}</td>
                      <td style={{ padding: "14px 18px", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: "#A78BFA" }}>{row.down}</td>
                      <td style={{ padding: "14px 18px", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: "#06B6D4" }}>{row.up}</td>
                      <td style={{ padding: "14px 18px", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", color: "#FBBF24" }}>{row.ping}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p style={{ marginTop: 12, fontSize: 13, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>
            Si votre vitesse est inférieure à 70 % de votre forfait, contactez notre support.
          </p>
        </section>

        {/* Support CTA */}
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 80px" }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 20, padding: "32px", textAlign: "center", position: "relative", overflow: "hidden" }}>
            <div aria-hidden style={{ position: "absolute", top: "-40%", left: "50%", transform: "translateX(-50%)", width: 300, height: 250, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 6, color: "#fff", letterSpacing: "-0.5px" }}>
                Un problème avec votre connexion ?
              </h3>
              <p style={{ color: "rgba(255,255,255,0.45)", marginBottom: 24, fontSize: 14 }}>Notre équipe est disponible 7j/7 pour vous aider.</p>
              <div className="flex gap-3 flex-wrap justify-center">
                <a href="mailto:support@nivra-telecom.ca" className="flex items-center gap-2" style={{ padding: "11px 22px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", textDecoration: "none", fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif", fontSize: 14 }}>
                  <Mail className="w-4 h-4" /> Contacter le support
                </a>
                <Link to="/portal/tickets" className="flex items-center gap-2" style={{ padding: "11px 22px", borderRadius: 10, background: "linear-gradient(135deg, #7C3AED, #6D28D9)", color: "#fff", textDecoration: "none", fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, boxShadow: "0 4px 16px rgba(124,58,237,0.35)" }}>
                  <TicketCheck className="w-4 h-4" /> Ouvrir un ticket
                </Link>
              </div>
            </div>
          </div>
        </section>

      </div>
      <Footer />
    </>
  );
}
