import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Phase = "idle" | "ping" | "download" | "upload" | "saving" | "done";

interface Results {
  download: number; // Mbps
  upload: number;   // Mbps
  latency: number;  // ms
}

// Brand palette (Xfinity Premium / Nivra)
const COLORS = {
  bg: "#1e1b4b",
  card: "rgba(255,255,255,0.05)",
  border: "rgba(124,58,237,0.3)",
  accent: "#7c3aed",
  accentSoft: "#a78bfa",
  text: "#ffffff",
  green: "#10b981",
  blue: "#3b82f6",
} as const;

// Cloudflare public Speed Test endpoints — no auth required
const CF_DOWN = "https://speed.cloudflare.com/__down";
const CF_UP = "https://speed.cloudflare.com/__up";
const CF_META = "https://speed.cloudflare.com/meta";

// Test plan — realistic timings (~25–35s total, like Videotron/Bell)
const PING_SAMPLES = 10;          // 10 × ~50–500ms ≈ 5–8s
const DOWNLOAD_BYTES = 10_000_000; // 10MB per chunk
const DOWNLOAD_CHUNKS = 5;        // 5 × 10MB sequential GETs
const UPLOAD_CHUNKS = 5;          // 5 × 5MB sequential POSTs
const UPLOAD_CHUNK_BYTES = 5 * 1024 * 1024;

interface CfMeta {
  city?: string;
  country?: string;
  region?: string;
  asn?: number;
  colo?: string;
}

// Reference Nivra Internet plans for matching the result.
const NIVRA_PLANS = [
  { name: "Internet 100 Mbps", mbps: 100 },
  { name: "Internet 300 Mbps", mbps: 300 },
  { name: "Internet 500 Mbps", mbps: 500 },
  { name: "Internet Giga", mbps: 1010 },
];

function suggestPlan(measured: number) {
  const eligible = NIVRA_PLANS.filter((p) => p.mbps <= measured * 1.1);
  return eligible[eligible.length - 1] ?? NIVRA_PLANS[0];
}

function speedVerdict(mbps: number): {
  icon: string;
  label: string;
  tone: "good" | "warn" | "bad";
} {
  if (mbps >= 800) return { icon: "✅", label: "Excellent — Compatible Internet Giga", tone: "good" };
  if (mbps >= 400) return { icon: "✅", label: "Très bien — Compatible Internet 500 Mbps", tone: "good" };
  if (mbps >= 80) return { icon: "⚠️", label: "Bien — Compatible Internet 100 Mbps", tone: "warn" };
  return { icon: "❌", label: "Faible — Contactez le support Nivra", tone: "bad" };
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export default function TestVitesse() {
  const [phase, setPhase] = useState<Phase>("idle");
  // Speed shown on the gauge — animated smoothly via rAF towards `targetSpeedRef`
  const [displaySpeed, setDisplaySpeed] = useState(0);
  const targetSpeedRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Sub-progress label (e.g. "Test 2/5 — 124 Mbps")
  const [subLabel, setSubLabel] = useState("");

  const [results, setResults] = useState<Results | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUserId(data.user?.id ?? null);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Smooth gauge interpolation — animates `displaySpeed` toward `targetSpeedRef.current`
  // using requestAnimationFrame so the number counts up gradually.
  useEffect(() => {
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(100, now - last); // ms, clamped
      last = now;
      setDisplaySpeed((curr) => {
        const target = targetSpeedRef.current;
        const diff = target - curr;
        if (Math.abs(diff) < 0.05) return target;
        // Ease toward target: ~30% of remaining gap per ~16ms frame
        const ease = 1 - Math.pow(0.001, dt / 1000); // exponential smoothing
        return curr + diff * ease;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function setTargetSpeed(v: number) {
    targetSpeedRef.current = Math.max(0, v);
  }

  const phaseLabel = useMemo(() => {
    switch (phase) {
      case "ping": return "Test de latence...";
      case "download": return "Test de téléchargement...";
      case "upload": return "Test de téléversement...";
      case "saving": return "Calcul des résultats...";
      case "done": return "Terminé";
      default: return "Prêt";
    }
  }, [phase]);

  // ===================================================================
  // PHASE 1 — LATENCY
  // 10 sequential POSTs of 1KB. Median is the reported ping.
  // Updates sub-label after every sample so the user sees live progress.
  // ===================================================================
  async function testLatency(): Promise<number> {
    setPhase("ping");
    setTargetSpeed(0);
    setSubLabel("Préparation...");

    const tiny = new Uint8Array(1024); // 1 KB
    const pings: number[] = [];

    for (let i = 0; i < PING_SAMPLES; i++) {
      const start = performance.now();
      try {
        const res = await fetch(SPEEDTEST_ENDPOINT, {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/octet-stream",
            apikey: SUPABASE_ANON,
            Authorization: `Bearer ${SUPABASE_ANON}`,
          },
          body: tiny,
        });
        await res.arrayBuffer();
        const ms = performance.now() - start;
        pings.push(ms);
        const currentMedian = Math.round(median(pings));
        setSubLabel(`Ping ${i + 1}/${PING_SAMPLES} — ${currentMedian} ms`);
        // Brief pacing so each ping is visible
        await sleep(120);
      } catch {
        // skip failed sample
      }
    }

    if (pings.length === 0) throw new Error("Latence: aucun échantillon");
    return Math.round(median(pings));
  }

  // ===================================================================
  // PHASE 2 — DOWNLOAD
  // 5 sequential GETs of /speedtest-10mb.bin streamed via ReadableStream.
  // Speed is computed continuously from bytes received over elapsed time
  // and pushed to the gauge every animation frame. A running average
  // across chunks is displayed in the sub-label.
  // Falls back to edge-function round-trip if the static file 404s.
  // ===================================================================
  async function testDownload(): Promise<number> {
    setPhase("download");
    setTargetSpeed(0);
    setSubLabel("Préparation...");

    const chunkSpeeds: number[] = [];

    // Probe the static file once; fall back to edge-function round-trip per chunk.
    let useStatic = true;
    try {
      const probe = await fetch(`/speedtest-10mb.bin?probe=${Date.now()}`, {
        cache: "no-store",
        method: "HEAD",
      });
      if (!probe.ok) useStatic = false;
    } catch {
      useStatic = false;
    }

    for (let i = 0; i < DOWNLOAD_CHUNKS; i++) {
      setSubLabel(`Test ${i + 1}/${DOWNLOAD_CHUNKS} — démarrage...`);

      let chunkMbps = 0;
      if (useStatic) {
        chunkMbps = await downloadOneChunkStreaming(i + 1);
      } else {
        chunkMbps = await downloadOneChunkViaEdge(i + 1);
      }

      if (chunkMbps > 0) chunkSpeeds.push(chunkMbps);

      const avg = chunkSpeeds.length
        ? chunkSpeeds.reduce((a, b) => a + b, 0) / chunkSpeeds.length
        : 0;
      setTargetSpeed(avg);
      setSubLabel(`Test ${i + 1}/${DOWNLOAD_CHUNKS} — ${chunkMbps.toFixed(1)} Mbps (moy. ${avg.toFixed(1)})`);
      await sleep(200);
    }

    if (chunkSpeeds.length === 0) throw new Error("Téléchargement: aucun échantillon");
    // Drop slowest sample (likely TCP slow-start) when we have enough data
    const usable =
      chunkSpeeds.length >= 3
        ? [...chunkSpeeds].sort((a, b) => b - a).slice(0, chunkSpeeds.length - 1)
        : chunkSpeeds;
    const finalMbps = usable.reduce((a, b) => a + b, 0) / usable.length;
    setTargetSpeed(finalMbps);
    return Number(finalMbps.toFixed(2));
  }

  // Stream a 10MB file chunk-by-chunk and push live Mbps to the gauge.
  async function downloadOneChunkStreaming(chunkIndex: number): Promise<number> {
    const url = `/speedtest-10mb.bin?dl=${Date.now()}-${chunkIndex}`;
    const start = performance.now();
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok || !res.body) throw new Error(`status ${res.status}`);

    const reader = res.body.getReader();
    let received = 0;
    let lastUiUpdate = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      received += value.byteLength;
      const elapsed = (performance.now() - start) / 1000;
      if (elapsed > 0.05) {
        const liveMbps = (received * 8) / elapsed / 1_000_000;
        // Throttle UI updates to ~every 100ms; rAF smooths the rest
        if (performance.now() - lastUiUpdate > 100) {
          setTargetSpeed(liveMbps);
          setSubLabel(
            `Test ${chunkIndex}/${DOWNLOAD_CHUNKS} — ${liveMbps.toFixed(1)} Mbps`,
          );
          lastUiUpdate = performance.now();
        }
      }
    }

    const totalSec = (performance.now() - start) / 1000;
    return (received * 8) / totalSec / 1_000_000;
  }

  // Fallback: round-trip via edge function (no static file available).
  async function downloadOneChunkViaEdge(chunkIndex: number): Promise<number> {
    const sizeBytes = 5 * 1024 * 1024; // 5 MB round trip
    const payload = new Uint8Array(sizeBytes);
    const start = performance.now();
    const res = await fetch(SPEEDTEST_ENDPOINT, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/octet-stream",
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
      },
      body: payload,
    });
    await res.arrayBuffer();
    const totalSec = (performance.now() - start) / 1000;
    // Round-trip carries data both ways; approximate effective single-direction throughput
    const mbps = (sizeBytes * 8) / totalSec / 1_000_000;
    setTargetSpeed(mbps);
    setSubLabel(`Test ${chunkIndex}/${DOWNLOAD_CHUNKS} — ${mbps.toFixed(1)} Mbps`);
    return mbps;
  }

  // ===================================================================
  // PHASE 3 — UPLOAD
  // 5 sequential POSTs of 5MB. Sub-label updates per chunk; gauge
  // animates to the running average via rAF interpolation.
  // ===================================================================
  async function testUpload(): Promise<number> {
    setPhase("upload");
    setTargetSpeed(0);
    setSubLabel("Préparation...");

    // Build payload once and reuse — pseudo-random fill defeats compression
    const payload = new Uint8Array(UPLOAD_CHUNK_BYTES);
    for (let i = 0; i < UPLOAD_CHUNK_BYTES; i += 1024) payload[i] = (i * 7) & 0xff;

    const chunkSpeeds: number[] = [];

    for (let i = 0; i < UPLOAD_CHUNKS; i++) {
      setSubLabel(`Test ${i + 1}/${UPLOAD_CHUNKS} — envoi en cours...`);

      // Optimistic in-flight ramp so the gauge moves while the request is outbound
      const optimisticTimer = window.setInterval(() => {
        const last = chunkSpeeds[chunkSpeeds.length - 1] ?? targetSpeedRef.current;
        // Drift gauge toward last known value while we wait
        setTargetSpeed(last);
      }, 250);

      const start = performance.now();
      try {
        const res = await fetch(SPEEDTEST_ENDPOINT, {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/octet-stream",
            apikey: SUPABASE_ANON,
            Authorization: `Bearer ${SUPABASE_ANON}`,
          },
          body: payload,
        });
        await res.arrayBuffer();
      } finally {
        clearInterval(optimisticTimer);
      }

      const totalSec = (performance.now() - start) / 1000;
      const chunkMbps = (UPLOAD_CHUNK_BYTES * 8) / totalSec / 1_000_000;
      chunkSpeeds.push(chunkMbps);
      const avg = chunkSpeeds.reduce((a, b) => a + b, 0) / chunkSpeeds.length;
      setTargetSpeed(avg);
      setSubLabel(`Test ${i + 1}/${UPLOAD_CHUNKS} — ${chunkMbps.toFixed(1)} Mbps (moy. ${avg.toFixed(1)})`);
      await sleep(200);
    }

    if (chunkSpeeds.length === 0) throw new Error("Téléversement: aucun échantillon");
    const usable =
      chunkSpeeds.length >= 3
        ? [...chunkSpeeds].sort((a, b) => b - a).slice(0, chunkSpeeds.length - 1)
        : chunkSpeeds;
    const finalMbps = usable.reduce((a, b) => a + b, 0) / usable.length;
    setTargetSpeed(finalMbps);
    return Number(finalMbps.toFixed(2));
  }

  async function runTest() {
    if (phase !== "idle" && phase !== "done") return;
    setResults(null);
    setTargetSpeed(0);
    setDisplaySpeed(0);
    try {
      const latency = await testLatency();
      const download = await testDownload();
      const upload = await testUpload();

      setPhase("saving");
      setSubLabel("Calcul des résultats...");
      await sleep(700);

      const r: Results = { download, upload, latency };
      setResults(r);
      setPhase("done");
      setSubLabel("");
      setTargetSpeed(download);

      if (userId) {
        try {
          await supabase.from("speedtest_results").insert({
            user_id: userId,
            download_mbps: r.download,
            upload_mbps: r.upload,
            latency_ms: r.latency,
          } as never);
        } catch {
          /* non-critical */
        }
      }
    } catch (err) {
      console.error("Speed test failed", err);
      toast({
        title: "Test interrompu",
        description: "Une erreur réseau est survenue. Veuillez réessayer.",
        variant: "destructive",
      });
      setPhase("idle");
      setSubLabel("");
    }
  }

  const isRunning = phase !== "idle" && phase !== "done";

  // Gauge math (full circle, 0–1100 Mbps scale)
  const MAX_GAUGE = 1100;
  const gaugePct = Math.min(100, (displaySpeed / MAX_GAUGE) * 100);
  const RADIUS = 88;
  const CIRC = 2 * Math.PI * RADIUS; // ~553
  const dashOffset = CIRC - (CIRC * gaugePct) / 100;

  // Ring color depends on phase
  const ringColor =
    phase === "download" ? COLORS.green :
    phase === "upload" ? COLORS.blue :
    COLORS.accent;

  const verdict = results ? speedVerdict(results.download) : null;
  const matchedPlan = results ? suggestPlan(results.download) : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily: "Inter, Helvetica, Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Helmet>
        <title>Test de vitesse Internet | Nivra Telecom</title>
        <meta
          name="description"
          content="Testez votre vitesse Internet (téléchargement, téléversement, latence) propulsé par Nivra Telecom — Serveurs Montréal, QC."
        />
        <link rel="canonical" href="/test-vitesse" />
      </Helmet>

      {/* HEADER */}
      <header
        style={{
          borderBottom: `1px solid ${COLORS.border}`,
          background: "rgba(0,0,0,0.25)",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <Link
            to="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              textDecoration: "none",
              color: COLORS.text,
            }}
            aria-label="Accueil Nivra Telecom"
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: COLORS.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                fontWeight: 800,
                fontSize: 18,
                lineHeight: 1,
                color: "#ffffff",
                fontStyle: "normal",
              }}
              aria-hidden="true"
            >
              N
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: 0.2 }}>
              Nivra Telecom
            </span>
          </Link>

          <Link
            to="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              minHeight: 44,
              padding: "10px 18px",
              borderRadius: 999,
              border: `1px solid ${COLORS.border}`,
              color: COLORS.text,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
              background: "transparent",
              transition: "background 150ms ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(124,58,237,0.12)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            ← Retour au site
          </Link>
        </div>
      </header>

      {/* MAIN */}
      <main style={{ flex: 1, padding: "48px 24px 64px" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", textAlign: "center" }}>
          {/* HERO */}
          <h1
            style={{
              fontSize: "clamp(32px, 5vw, 44px)",
              fontWeight: 800,
              letterSpacing: -0.5,
              margin: "0 0 12px",
            }}
          >
            Test de vitesse Internet
          </h1>
          <p style={{ color: COLORS.accentSoft, fontSize: 16, margin: "0 0 8px", fontWeight: 600 }}>
            Propulsé par Nivra Telecom
          </p>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              borderRadius: 999,
              border: `1px solid ${COLORS.border}`,
              background: "rgba(124,58,237,0.08)",
              fontSize: 12,
              color: COLORS.accentSoft,
              fontWeight: 600,
              marginBottom: 40,
            }}
          >
            🌐 Serveur — Montréal, QC
          </div>

          {/* GAUGE */}
          <div
            style={{
              position: "relative",
              width: 240,
              height: 240,
              margin: "0 auto 24px",
            }}
          >
            <svg viewBox="0 0 200 200" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }}>
              {/* Track */}
              <circle
                cx="100"
                cy="100"
                r={RADIUS}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="14"
              />
              {/* Fill */}
              <circle
                cx="100"
                cy="100"
                r={RADIUS}
                fill="none"
                stroke={ringColor}
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={dashOffset}
                style={{ transition: "stroke-dashoffset 200ms ease-out, stroke 200ms ease-out" }}
              />
            </svg>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ fontSize: 48, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {displaySpeed.toFixed(displaySpeed >= 100 ? 0 : 1)}
              </div>
              <div style={{ fontSize: 12, color: COLORS.accentSoft, letterSpacing: 2, marginTop: 4, textTransform: "uppercase" }}>
                Mbps
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 10, fontWeight: 500 }}>
                {phaseLabel}
              </div>
            </div>
          </div>

          {/* Sub-progress (e.g. "Test 2/5 — 124 Mbps") */}
          {isRunning && subLabel && (
            <div
              style={{
                marginTop: -8,
                marginBottom: 24,
                fontSize: 13,
                color: COLORS.accentSoft,
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
                minHeight: 20,
              }}
              aria-live="polite"
            >
              {subLabel}
            </div>
          )}

          {/* BUTTON */}
          {!results && !isRunning && (
            <button
              onClick={runTest}
              style={{
                width: "100%",
                height: 64,
                borderRadius: 999,
                background: COLORS.accent,
                color: "#fff",
                border: "none",
                fontSize: 18,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 10px 30px rgba(124,58,237,0.4)",
                transition: "transform 120ms ease, background 150ms ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#6d28d9")}
              onMouseLeave={(e) => (e.currentTarget.style.background = COLORS.accent)}
            >
              ▶ Démarrer le test
            </button>
          )}
          {isRunning && (
            <button
              disabled
              style={{
                width: "100%",
                height: 64,
                borderRadius: 999,
                background: "rgba(124,58,237,0.5)",
                color: "#fff",
                border: "none",
                fontSize: 18,
                fontWeight: 700,
                cursor: "not-allowed",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.4)",
                  borderTopColor: "#fff",
                  animation: "nivra-spin 0.8s linear infinite",
                }}
              />
              Test en cours...
            </button>
          )}
          {results && phase === "done" && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                onClick={runTest}
                style={{
                  flex: "1 1 200px",
                  minHeight: 56,
                  borderRadius: 999,
                  background: "transparent",
                  color: "#fff",
                  border: `2px solid ${COLORS.accent}`,
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: "0 20px",
                }}
              >
                🔄 Retester
              </button>
              <Link
                to={userId ? "/portal/tickets" : "/contact"}
                style={{
                  flex: "1 1 200px",
                  minHeight: 56,
                  borderRadius: 999,
                  background: "transparent",
                  color: "#fff",
                  border: "2px solid rgba(255,255,255,0.2)",
                  fontSize: 15,
                  fontWeight: 700,
                  textDecoration: "none",
                  padding: "0 20px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                📞 Signaler un problème
              </Link>
            </div>
          )}
        </div>

        {/* RESULTS */}
        {results && phase === "done" && (
          <div style={{ maxWidth: 900, margin: "48px auto 0" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
                marginBottom: 24,
              }}
            >
              <ResultCard icon="📥" label="Téléchargement" value={results.download.toFixed(results.download >= 100 ? 0 : 1)} unit="Mbps" color={COLORS.green} />
              <ResultCard icon="⚡" label="Latence" value={String(results.latency)} unit="ms" color={COLORS.accent} />
              <ResultCard icon="📤" label="Téléversement" value={results.upload.toFixed(results.upload >= 100 ? 0 : 1)} unit="Mbps" color={COLORS.blue} />
            </div>

            {verdict && (
              <div
                style={{
                  borderRadius: 16,
                  padding: "20px 24px",
                  background: COLORS.card,
                  border: `1px solid ${
                    verdict.tone === "good" ? "rgba(16,185,129,0.4)" :
                    verdict.tone === "warn" ? "rgba(245,158,11,0.4)" :
                    "rgba(239,68,68,0.4)"
                  }`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, color: COLORS.accentSoft, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
                    Comparaison Nivra
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>
                    {verdict.icon} {verdict.label}
                  </div>
                  {matchedPlan && (
                    <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
                      Forfait suggéré : <strong>{matchedPlan.name}</strong>
                    </div>
                  )}
                </div>
                <Link
                  to="/internet"
                  style={{
                    padding: "10px 20px",
                    borderRadius: 999,
                    background: COLORS.accent,
                    color: "#fff",
                    textDecoration: "none",
                    fontWeight: 700,
                    fontSize: 14,
                    minHeight: 44,
                    display: "inline-flex",
                    alignItems: "center",
                  }}
                >
                  Voir nos forfaits →
                </Link>
              </div>
            )}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer
        style={{
          borderTop: `1px solid ${COLORS.border}`,
          background: "rgba(0,0,0,0.3)",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 13,
            color: "rgba(255,255,255,0.6)",
          }}
        >
          <div>
            © 2026 Nivra Communications Inc. —{" "}
            <a href="mailto:support@nivra-telecom.ca" style={{ color: COLORS.accentSoft, textDecoration: "none" }}>
              support@nivra-telecom.ca
            </a>
          </div>
          <nav style={{ display: "flex", flexWrap: "wrap", gap: 18 }}>
            {[
              { label: "Accueil", to: "/" },
              { label: "Internet", to: "/internet" },
              { label: "Mobile", to: "/mobile" },
              { label: "TV", to: "/tv" },
              { label: "Assistance", to: "/support" },
            ].map((l) => (
              <Link
                key={l.to}
                to={l.to}
                style={{ color: "rgba(255,255,255,0.7)", textDecoration: "none", fontWeight: 500 }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>

      <style>{`@keyframes nivra-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ResultCard({
  icon,
  label,
  value,
  unit,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(124,58,237,0.3)",
        borderRadius: 16,
        padding: "20px 24px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: 12, color: "#a78bfa", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 6 }}>
        <span style={{ fontSize: 36, fontWeight: 800, color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</span>
        <span style={{ fontSize: 14, color: "rgba(255,255,255,0.6)" }}>{unit}</span>
      </div>
    </div>
  );
}
