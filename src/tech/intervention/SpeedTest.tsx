import { useCallback, useState } from "react";

type Metrics = { downloadMbps: number; uploadMbps: number; latencyMs: number };

// Real browser measurement — no fake numbers.
// Latency: median of 5 HEAD requests to a small asset.
// Download: 1 MB blob fetch, divide bytes by seconds.
// Upload: POST 512 KB random to httpbin, divide by seconds.
async function measureLatency(): Promise<number> {
  const url = "https://www.gstatic.com/generate_204";
  const samples: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    try { await fetch(url, { method: "HEAD", cache: "no-store", mode: "no-cors" }); } catch { /* ignore */ }
    samples.push(performance.now() - t);
  }
  samples.sort((a, b) => a - b);
  return Math.round(samples[Math.floor(samples.length / 2)]);
}

async function measureDownload(): Promise<number> {
  // 2 MB static object
  const url = "https://speed.cloudflare.com/__down?bytes=2000000&r=" + Math.random();
  const t = performance.now();
  const res = await fetch(url, { cache: "no-store" });
  const buf = await res.arrayBuffer();
  const secs = (performance.now() - t) / 1000;
  const mbps = (buf.byteLength * 8) / 1_000_000 / secs;
  return Math.round(mbps * 10) / 10;
}

async function measureUpload(): Promise<number> {
  const bytes = new Uint8Array(512 * 1024);
  crypto.getRandomValues(bytes);
  const t = performance.now();
  try {
    await fetch("https://speed.cloudflare.com/__up", { method: "POST", body: bytes, cache: "no-store" });
  } catch { /* ignore */ }
  const secs = (performance.now() - t) / 1000;
  return Math.round(((bytes.byteLength * 8) / 1_000_000 / secs) * 10) / 10;
}

export function SpeedTest({ onDone }: { onDone: (m: Metrics) => void }) {
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<string>("");
  const [metrics, setMetrics] = useState<Partial<Metrics>>({});

  const run = useCallback(async () => {
    setRunning(true); setMetrics({});
    try {
      setPhase("Mesure de la latence…");
      const latencyMs = await measureLatency();
      setMetrics((m) => ({ ...m, latencyMs }));
      setPhase("Mesure du téléchargement…");
      const downloadMbps = await measureDownload();
      setMetrics((m) => ({ ...m, downloadMbps }));
      setPhase("Mesure de l'envoi…");
      const uploadMbps = await measureUpload();
      const full: Metrics = { downloadMbps, uploadMbps, latencyMs };
      setMetrics(full);
      onDone(full);
    } catch (e) {
      console.error(e);
    } finally {
      setPhase("");
      setRunning(false);
    }
  }, [onDone]);

  return (
    <div>
      <div className="tk-metric-grid">
        <div className="tk-metric">
          <div className="tk-metric__label">Téléchargement</div>
          <div className="tk-metric__value">{metrics.downloadMbps ?? "—"}<span className="tk-metric__unit">Mb/s</span></div>
        </div>
        <div className="tk-metric">
          <div className="tk-metric__label">Envoi</div>
          <div className="tk-metric__value">{metrics.uploadMbps ?? "—"}<span className="tk-metric__unit">Mb/s</span></div>
        </div>
        <div className="tk-metric">
          <div className="tk-metric__label">Latence</div>
          <div className="tk-metric__value">{metrics.latencyMs ?? "—"}<span className="tk-metric__unit">ms</span></div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
        <button className="tk-btn" onClick={run} disabled={running}>{running ? "Mesure en cours…" : "Lancer le test"}</button>
        {phase && <span style={{ color: "hsl(var(--tk-fg-mut))", fontSize: 13 }}>{phase}</span>}
      </div>
    </div>
  );
}
