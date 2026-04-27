import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Download, Upload, Zap, Share2, AlertTriangle, RefreshCw, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Phase = "idle" | "ping" | "download" | "upload" | "saving" | "done";

interface Results {
  download: number; // Mbps
  upload: number;   // Mbps
  latency: number;  // ms
}

// Reference Nivra Internet plans (advertised speeds in Mbps).
// Used to suggest a matching plan when user is anonymous.
const NIVRA_PLANS = [
  { name: "Internet 100 Mbps", mbps: 100, href: "/internet" },
  { name: "Internet 300 Mbps", mbps: 300, href: "/internet" },
  { name: "Internet 500 Mbps", mbps: 500, href: "/internet" },
  { name: "Internet Giga", mbps: 1010, href: "/internet" },
];

function classifyVsPlan(measured: number, plan: number): "good" | "warn" | "bad" {
  const ratio = measured / plan;
  if (ratio >= 0.8) return "good";
  if (ratio >= 0.5) return "warn";
  return "bad";
}

function suggestPlan(measured: number) {
  // Pick the highest plan whose advertised speed is <= measured (with a tolerance).
  const eligible = NIVRA_PLANS.filter((p) => p.mbps <= measured * 1.1);
  return eligible[eligible.length - 1] ?? NIVRA_PLANS[0];
}

export default function TestVitesse() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0); // 0-100 within current phase
  const [liveSpeed, setLiveSpeed] = useState(0);
  const [results, setResults] = useState<Results | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [subscribedPlanMbps, setSubscribedPlanMbps] = useState<number | null>(null);
  const [subscribedPlanName, setSubscribedPlanName] = useState<string | null>(null);

  const liveSpeedRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUserId(data.user?.id ?? null);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch subscribed plan info if logged in (best-effort; safe if table empty)
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("subscriptions")
          .select("plan_name, service_category, status")
          .eq("user_id", userId)
          .in("status", ["active", "trialing", "processing"] as never)
          .limit(5);
        if (cancelled || !data) return;
        const internet = data.find(
          (r: any) => (r.service_category ?? "").toLowerCase() === "internet",
        );
        if (internet?.plan_name) {
          setSubscribedPlanName(internet.plan_name);
          // Try to extract speed from plan name (e.g. "Internet 300 Mbps", "Internet Giga")
          const match = String(internet.plan_name).match(/(\d{2,4})\s*Mbps/i);
          if (match) {
            setSubscribedPlanMbps(parseInt(match[1], 10));
          } else if (/giga/i.test(internet.plan_name)) {
            setSubscribedPlanMbps(1010);
          }
        }
      } catch {
        // Non-critical; ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const phaseLabel = useMemo(() => {
    switch (phase) {
      case "ping": return "Test de latence...";
      case "download": return "Test de téléchargement...";
      case "upload": return "Test de téléversement...";
      case "saving": return "Calcul des résultats...";
      case "done": return "Test terminé";
      default: return "Prêt à tester";
    }
  }, [phase]);

  async function runPing(): Promise<number> {
    setPhase("ping");
    setProgress(0);
    // Run a few quick fetches and take the minimum (closest to true latency)
    const samples: number[] = [];
    for (let i = 0; i < 4; i++) {
      const start = performance.now();
      const res = await fetch(`/speedtest-1mb.bin?ping=${Date.now()}-${i}`, {
        cache: "no-store",
      });
      // Read first byte to get TTFB-ish measurement
      const reader = res.body?.getReader();
      if (reader) {
        await reader.read();
        await reader.cancel();
      }
      samples.push(performance.now() - start);
      setProgress(((i + 1) / 4) * 100);
    }
    return Math.round(Math.min(...samples));
  }

  async function runDownload(): Promise<number> {
    setPhase("download");
    setProgress(0);
    setLiveSpeed(0);
    liveSpeedRef.current = 0;

    const url = `/speedtest-10mb.bin?dl=${Date.now()}`;
    const start = performance.now();
    const res = await fetch(url, { cache: "no-store" });
    if (!res.body) throw new Error("Stream not supported");

    const totalBytes = 10 * 1024 * 1024;
    const reader = res.body.getReader();
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        received += value.byteLength;
        const elapsedSec = (performance.now() - start) / 1000;
        if (elapsedSec > 0.05) {
          const mbps = (received * 8) / elapsedSec / 1_000_000;
          liveSpeedRef.current = mbps;
          setLiveSpeed(mbps);
        }
        setProgress(Math.min(100, (received / totalBytes) * 100));
      }
    }

    const totalSec = (performance.now() - start) / 1000;
    const mbps = (received * 8) / totalSec / 1_000_000;
    return Number(mbps.toFixed(2));
  }

  async function runUpload(): Promise<number> {
    setPhase("upload");
    setProgress(0);
    setLiveSpeed(0);

    const sizeBytes = 2 * 1024 * 1024; // 2 MB
    const payload = new Uint8Array(sizeBytes);
    // Fill with pseudo-random bytes to defeat any compression
    for (let i = 0; i < sizeBytes; i += 1024) payload[i] = (i * 7) & 0xff;

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/speedtest-upload?ul=${Date.now()}`;
    const start = performance.now();

    // Animate progress optimistically while we wait for the request to complete
    const animTimer = window.setInterval(() => {
      setProgress((p) => Math.min(95, p + 5));
    }, 200);

    try {
      await fetch(url, {
        method: "POST",
        body: payload,
        cache: "no-store",
        headers: { "Content-Type": "application/octet-stream" },
      });
    } finally {
      clearInterval(animTimer);
    }

    const totalSec = (performance.now() - start) / 1000;
    setProgress(100);
    const mbps = (sizeBytes * 8) / totalSec / 1_000_000;
    setLiveSpeed(mbps);
    return Number(mbps.toFixed(2));
  }

  async function runTest() {
    if (phase !== "idle" && phase !== "done") return;
    setResults(null);
    try {
      const latency = await runPing();
      const download = await runDownload();
      const upload = await runUpload();

      setPhase("saving");
      setProgress(0);
      await new Promise((r) => setTimeout(r, 600));

      const r: Results = { download, upload, latency };
      setResults(r);
      setPhase("done");

      // Save if logged in (best-effort)
      if (userId) {
        try {
          await supabase.from("speedtest_results").insert({
            user_id: userId,
            download_mbps: r.download,
            upload_mbps: r.upload,
            latency_ms: r.latency,
          } as never);
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.error("Speed test failed", err);
      toast({
        title: "Test interrompu",
        description: "Une erreur est survenue. Veuillez réessayer.",
        variant: "destructive",
      });
      setPhase("idle");
    }
  }

  function handleShare() {
    if (!results) return;
    const text = `🚀 Mon test de vitesse Nivra Telecom :
📥 Téléchargement : ${results.download} Mbps
📤 Téléversement : ${results.upload} Mbps
⚡ Latence : ${results.latency} ms
Serveur : Nivra Telecom — Montréal, QC
Testez votre vitesse : ${window.location.origin}/test-vitesse`;
    navigator.clipboard.writeText(text).then(
      () =>
        toast({
          title: "Résultats copiés",
          description: "Vous pouvez maintenant les partager.",
        }),
      () =>
        toast({
          title: "Impossible de copier",
          description: "Veuillez copier manuellement.",
          variant: "destructive",
        }),
    );
  }

  const isRunning = phase !== "idle" && phase !== "done";
  const displaySpeed = isRunning ? liveSpeed : results?.download ?? 0;

  // Gauge math (semi-circle, 0 to 1100 Mbps scale)
  const MAX_GAUGE = 1100;
  const gaugePct = Math.min(100, (displaySpeed / MAX_GAUGE) * 100);
  const gaugeAngle = (gaugePct / 100) * 180; // degrees

  // Comparison block
  const compareTo = subscribedPlanMbps ?? null;
  const matchedPlan = results ? suggestPlan(results.download) : null;
  const verdict =
    results && compareTo ? classifyVsPlan(results.download, compareTo) : null;

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white">
      <Helmet>
        <title>Test de vitesse Internet | Nivra Telecom</title>
        <meta
          name="description"
          content="Testez votre vitesse Internet (téléchargement, téléversement, latence) propulsé par Nivra Telecom. Serveurs au Québec."
        />
        <link rel="canonical" href="/test-vitesse" />
      </Helmet>

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-white/5 bg-gradient-to-b from-[#1e1b4b] to-[#0a0a14]">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center sm:py-20">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-purple-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-purple-400" />
            Serveur : Nivra Telecom — Montréal, QC
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Testez votre vitesse Internet
          </h1>
          <p className="mx-auto max-w-2xl text-base text-white/60 sm:text-lg">
            Propulsé par Nivra Telecom — Serveurs Québec
          </p>
        </div>
      </section>

      {/* SPEED TEST UI */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-sm sm:p-12">
          {/* Gauge */}
          <div className="mx-auto mb-8 flex max-w-md flex-col items-center">
            <div className="relative h-56 w-full max-w-[360px]">
              {/* Semi-circle gauge */}
              <svg viewBox="0 0 200 110" className="h-full w-full">
                <defs>
                  <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#7c3aed" />
                    <stop offset="100%" stopColor="#a78bfa" />
                  </linearGradient>
                </defs>
                {/* Track */}
                <path
                  d="M 10 100 A 90 90 0 0 1 190 100"
                  fill="none"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="14"
                  strokeLinecap="round"
                />
                {/* Fill */}
                <path
                  d="M 10 100 A 90 90 0 0 1 190 100"
                  fill="none"
                  stroke="url(#gaugeGrad)"
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray="282.74"
                  strokeDashoffset={282.74 - (282.74 * gaugePct) / 100}
                  style={{ transition: "stroke-dashoffset 200ms ease-out" }}
                />
                {/* Needle */}
                <g
                  style={{
                    transform: `rotate(${gaugeAngle - 90}deg)`,
                    transformOrigin: "100px 100px",
                    transition: "transform 200ms ease-out",
                  }}
                >
                  <line x1="100" y1="100" x2="100" y2="25" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="100" cy="100" r="6" fill="#fff" />
                </g>
              </svg>
              {/* Live readout */}
              <div className="absolute inset-x-0 bottom-2 text-center">
                <div className="text-5xl font-bold tabular-nums text-white sm:text-6xl">
                  {displaySpeed.toFixed(displaySpeed >= 100 ? 0 : 1)}
                </div>
                <div className="text-xs uppercase tracking-widest text-white/50">Mbps</div>
              </div>
            </div>

            {/* Phase */}
            <div className="mt-4 text-center">
              <div className="text-sm font-medium text-purple-300">{phaseLabel}</div>
              {isRunning && (
                <div className="mx-auto mt-3 h-1.5 w-64 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-purple-300 transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Metrics row */}
          <div className="mb-8 grid gap-4 sm:grid-cols-3">
            <MetricCard
              icon={<Download className="h-5 w-5" />}
              label="Téléchargement"
              value={results ? results.download : isRunning && phase === "download" ? liveSpeed : 0}
              unit="Mbps"
              decimals={1}
              accent="from-purple-600/20 to-purple-500/5"
            />
            <MetricCard
              icon={<Upload className="h-5 w-5" />}
              label="Téléversement"
              value={results ? results.upload : isRunning && phase === "upload" ? liveSpeed : 0}
              unit="Mbps"
              decimals={1}
              accent="from-violet-600/20 to-violet-500/5"
            />
            <MetricCard
              icon={<Zap className="h-5 w-5" />}
              label="Latence"
              value={results ? results.latency : 0}
              unit="ms"
              decimals={0}
              accent="from-fuchsia-600/20 to-fuchsia-500/5"
            />
          </div>

          {/* Action */}
          {phase === "idle" && (
            <div className="text-center">
              <button
                onClick={runTest}
                className="inline-flex h-14 min-w-[220px] items-center justify-center gap-2 rounded-full bg-[#7c3aed] px-8 text-base font-semibold text-white shadow-lg shadow-purple-900/40 transition-all hover:bg-[#6d28d9] hover:shadow-xl active:scale-[0.98]"
              >
                Démarrer le test
              </button>
            </div>
          )}
          {isRunning && (
            <div className="text-center">
              <button
                disabled
                className="inline-flex h-14 min-w-[220px] cursor-not-allowed items-center justify-center gap-2 rounded-full bg-[#7c3aed]/60 px-8 text-base font-semibold text-white"
              >
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Test en cours...
              </button>
            </div>
          )}
        </div>

        {/* RESULTS */}
        {phase === "done" && results && (
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.02] p-8 backdrop-blur-sm">
            <h2 className="mb-6 text-2xl font-semibold">Résultats</h2>

            {/* Comparison block */}
            {compareTo ? (
              <div
                className={`mb-6 rounded-2xl border p-5 ${
                  verdict === "good"
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : verdict === "warn"
                    ? "border-amber-500/30 bg-amber-500/10"
                    : "border-rose-500/30 bg-rose-500/10"
                }`}
              >
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/60">
                  Votre forfait
                </div>
                <div className="text-lg font-semibold">
                  {subscribedPlanName ?? `Internet ${compareTo} Mbps`} · {compareTo} Mbps
                </div>
                <div className="mt-2 text-sm text-white/80">
                  {verdict === "good" && (
                    <>✅ Excellente vitesse — vous obtenez {Math.round((results.download / compareTo) * 100)}% de votre forfait.</>
                  )}
                  {verdict === "warn" && (
                    <>⚠️ Vitesse correcte — vous obtenez {Math.round((results.download / compareTo) * 100)}% de votre forfait.</>
                  )}
                  {verdict === "bad" && (
                    <>❌ Vitesse faible — vous obtenez seulement {Math.round((results.download / compareTo) * 100)}% de votre forfait.</>
                  )}
                </div>
              </div>
            ) : matchedPlan ? (
              <div className="mb-6 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-5">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/60">
                  Comparaison Nivra
                </div>
                <div className="text-base text-white/90">
                  Votre vitesse correspond au forfait{" "}
                  <span className="font-semibold text-white">{matchedPlan.name}</span> de Nivra Telecom.
                </div>
              </div>
            ) : null}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleShare} className="bg-[#7c3aed] hover:bg-[#6d28d9]">
                <Share2 className="h-4 w-4" />
                Partager mes résultats
              </Button>
              <Button asChild variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link to={userId ? "/portal/tickets" : "/contact"}>
                  <AlertTriangle className="h-4 w-4" />
                  Signaler un problème
                </Link>
              </Button>
              <Button onClick={runTest} variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <RefreshCw className="h-4 w-4" />
                Retester
              </Button>
              <Button asChild variant="outline" className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link to="/internet">
                  Voir nos forfaits
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  unit,
  decimals,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  decimals: number;
  accent: string;
}) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-gradient-to-br ${accent} p-5`}>
      <div className="mb-2 flex items-center gap-2 text-white/70">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-3xl font-bold tabular-nums text-white sm:text-4xl">
          {value.toFixed(decimals)}
        </div>
        <div className="text-sm text-white/50">{unit}</div>
      </div>
    </div>
  );
}
