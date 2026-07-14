import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@/tech/hooks/useInterventionSession";
import { STEP_META } from "@/tech/lib/steps";
import { Loader2, Wrench, Plus, ChevronRight, MapPin } from "lucide-react";

async function readGps(): Promise<GeolocationCoordinates | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  });
}

export default function TechHome() {
  const nav = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("intervention_sessions")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20);
    if (error) setErr(error.message);
    setSessions((data as Session[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const startNew = async () => {
    setStarting(true); setErr(null);
    try {
      const coords = await readGps();
      const { data, error } = await supabase.rpc("fn_start_intervention", {
        p_assignment_id: null,
        p_service_kind: "internet",
        p_gps_lat: coords?.latitude ?? null,
        p_gps_lng: coords?.longitude ?? null,
        p_gps_accuracy: coords?.accuracy ?? null,
      });
      if (error) throw error;
      const s = data as Session;
      nav(`/tech/intervention/${s.id}`);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erreur au démarrage");
    } finally { setStarting(false); }
  };

  const active = sessions.filter((s) => s.status === "active");
  const done = sessions.filter((s) => s.status !== "active");

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, marginBottom: 22, flexWrap: "wrap" }}>
        <div>
          <div className="tk-tag tk-tag--accent">Portail v3</div>
          <h1 style={{ fontSize: "clamp(24px, 3vw, 34px)", fontWeight: 800, letterSpacing: "-0.02em", margin: "8px 0 4px" }}>Bienvenue</h1>
          <p style={{ color: "hsl(var(--tk-fg-mut))", fontSize: 15, margin: 0, maxWidth: "60ch" }}>
            Démarre une intervention guidée en 12 étapes. Chaque étape est verrouillée jusqu'à ce que la précédente soit complète.
          </p>
        </div>
        <button className="tk-btn" onClick={startNew} disabled={starting}>
          {starting ? <><Loader2 className="tk-spin" size={16} /> Démarrage…</> : <><Plus size={16} /> Démarrer une intervention</>}
        </button>
      </div>

      {err && <div className="tk-alert tk-alert--danger" style={{ marginBottom: 14 }}>{err}</div>}

      <div className="tk-card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "hsl(var(--tk-accent) / 0.15)", color: "hsl(var(--tk-accent))", display: "grid", placeItems: "center" }}>
            <Wrench size={18} />
          </div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>Interventions actives</div>
          <span className="tk-tag tk-tag--accent" style={{ marginLeft: "auto" }}>{active.length}</span>
        </div>

        {loading ? (
          <div style={{ color: "hsl(var(--tk-fg-mut))", fontSize: 14, padding: 12 }}><Loader2 className="tk-spin" size={14} /> Chargement…</div>
        ) : active.length === 0 ? (
          <div className="tk-alert tk-alert--info">Aucune intervention en cours. Toucher <b>Démarrer une intervention</b> pour ouvrir la première.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {active.map((s) => <SessionRow key={s.id} s={s} onOpen={() => nav(`/tech/intervention/${s.id}`)} />)}
          </div>
        )}
      </div>

      {done.length > 0 && (
        <div className="tk-card" style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Historique récent</div>
          <div style={{ display: "grid", gap: 8 }}>
            {done.slice(0, 8).map((s) => <SessionRow key={s.id} s={s} onOpen={() => nav(`/tech/intervention/${s.id}`)} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function SessionRow({ s, onOpen }: { s: Session; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      style={{
        display: "flex", alignItems: "center", gap: 12, padding: 12,
        background: "hsl(var(--tk-bg-2))", border: "1px solid hsl(var(--tk-line))",
        borderRadius: 10, cursor: "pointer", textAlign: "left", width: "100%", color: "inherit",
      }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, background: "hsl(var(--tk-bg-3))", display: "grid", placeItems: "center", flexShrink: 0 }}>
        <MapPin size={16} />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {s.client_full_name ?? "Intervention"}
          <span style={{ color: "hsl(var(--tk-fg-dim))", fontWeight: 500, marginLeft: 8, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>#{s.id.slice(0, 8)}</span>
        </div>
        <div style={{ fontSize: 12, color: "hsl(var(--tk-fg-mut))", display: "flex", gap: 10, marginTop: 3 }}>
          <span className={s.status === "completed" ? "tk-tag tk-tag--ok" : s.status === "cancelled" ? "tk-tag tk-tag--danger" : "tk-tag tk-tag--accent"}>{s.status}</span>
          <span>{STEP_META[s.current_step].label}</span>
          <span>· {s.progress}/12</span>
        </div>
      </div>
      <ChevronRight size={18} style={{ color: "hsl(var(--tk-fg-dim))" }} />
    </button>
  );
}
