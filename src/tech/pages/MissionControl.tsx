import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMyDay, type DayAssignment } from "@/tech/hooks/useMyDay";
import { useTechnicianLocation } from "@/tech/hooks/useTechnicianLocation";
import { useServiceIncidents } from "@/tech/hooks/useServiceIncidents";
import { useTruckStock } from "@/tech/hooks/useTruckStock";
import { AlertTriangle, CloudSun, Gauge, Package, Radio, Wifi, MapPin, Loader2, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface WeatherRes { id?: string; tempC: number | null; condition: string | null; precipProbability: number | null; error?: string }
interface EtaRes { seconds: number | null; trafficDelaySeconds: number | null; distanceMeters: number | null }

export default function MissionControl() {
  const nav = useNavigate();
  const { items, loading } = useMyDay();
  const me = useTechnicianLocation(true);
  const { items: incidents } = useServiceIncidents();
  const { items: stock } = useTruckStock();
  const [weather, setWeather] = useState<Record<string, WeatherRes>>({});
  const [eta, setEta] = useState<EtaRes | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

  const upcoming = useMemo(() => items.filter((i) => i.status !== "completed" && i.status !== "cancelled"), [items]);
  const next = upcoming.find((i) => i.intervention_status !== "completed") ?? null;

  // Weather batch for RDVs with coords
  useEffect(() => {
    const pts = items.filter((i) => i.latitude != null && i.longitude != null)
      .slice(0, 8)
      .map((i) => ({ id: i.assignment_id, lat: Number(i.latitude), lng: Number(i.longitude) }));
    if (pts.length === 0) return;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("tech-weather-batch", { body: { points: pts } });
        const map: Record<string, WeatherRes> = {};
        (data?.results ?? []).forEach((r: WeatherRes) => { if (r.id) map[r.id] = r; });
        setWeather(map);
      } catch { /* silent */ }
    })();
  }, [items]);

  // ETA to next RDV
  useEffect(() => {
    if (!me.lat || !me.lng || !next?.latitude || !next?.longitude) { setEta(null); return; }
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("tech-route-eta", {
          body: {
            originLat: me.lat, originLng: me.lng,
            destLat: Number(next.latitude), destLng: Number(next.longitude),
          },
        });
        if (data && !data.error) setEta(data);
      } catch { /* silent */ }
    })();
  }, [me.lat, me.lng, next?.latitude, next?.longitude]);

  const nextStart = next ? new Date(`${next.scheduled_date}T${next.time_start}`).getTime() : null;
  const mins = nextStart ? Math.round((nextStart - now) / 60000) : null;
  const lowStock = stock.filter((s) => s.status === "in_stock").length < 3;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ marginBottom: 14 }}>
        <div className="tk-tag tk-tag--accent">Portail v3 · Temps réel</div>
        <h1 style={{ fontSize: "clamp(24px, 3vw, 34px)", fontWeight: 800, letterSpacing: "-0.02em", margin: "8px 0 4px" }}>Mission Control</h1>
        <p style={{ color: "hsl(var(--tk-fg-mut))", fontSize: 14, margin: 0 }}>
          {new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
          {me.lat && me.lng ? ` · GPS ✓ (±${Math.round(me.accuracy ?? 0)}m)` : " · GPS…"}
        </p>
      </div>

      {/* HERO */}
      <div className="tk-mc-hero">
        <div className="tk-card tk-widget">
          <div className="tk-widget__head"><Clock /> Prochain RDV</div>
          {next ? (
            <>
              <div className="tk-widget__value">{next.client_full_name || "Client"}</div>
              <div className="tk-widget__sub">
                <MapPin size={12} style={{ verticalAlign: -1 }} /> {next.address_line}, {next.city} · {next.time_start?.slice(0, 5)}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                <div className="tk-metric" style={{ minWidth: 110 }}>
                  <div className="tk-metric__label">Départ</div>
                  <div className="tk-metric__value">{mins != null ? (mins > 0 ? `${mins}min` : "Maintenant") : "—"}</div>
                </div>
                {eta?.seconds != null && (
                  <div className="tk-metric" style={{ minWidth: 110 }}>
                    <div className="tk-metric__label">ETA route</div>
                    <div className="tk-metric__value">{Math.round(eta.seconds / 60)}<span className="tk-metric__unit">min</span></div>
                  </div>
                )}
                {eta?.distanceMeters != null && (
                  <div className="tk-metric" style={{ minWidth: 110 }}>
                    <div className="tk-metric__label">Distance</div>
                    <div className="tk-metric__value">{(eta.distanceMeters / 1000).toFixed(1)}<span className="tk-metric__unit">km</span></div>
                  </div>
                )}
                {eta?.trafficDelaySeconds != null && eta.trafficDelaySeconds > 60 && (
                  <div className="tk-metric" style={{ minWidth: 110, borderColor: "hsl(var(--tk-warn) / 0.5)" }}>
                    <div className="tk-metric__label" style={{ color: "hsl(var(--tk-warn))" }}>Trafic</div>
                    <div className="tk-metric__value">+{Math.round(eta.trafficDelaySeconds / 60)}<span className="tk-metric__unit">min</span></div>
                  </div>
                )}
              </div>
              <button className="tk-btn" style={{ marginTop: 14 }} onClick={() => nav(`/tech/journee`)}>
                Voir ma journée →
              </button>
            </>
          ) : (
            <div className="tk-alert tk-alert--info">Aucun rendez-vous restant aujourd'hui.</div>
          )}
        </div>

        <div className="tk-card tk-widget">
          <div className="tk-widget__head"><Gauge /> Statut terrain</div>
          <div style={{ display: "grid", gap: 10 }}>
            <StatusLine label="Position GPS" ok={!!me.lat} value={me.lat ? `${me.lat.toFixed(4)}, ${me.lng?.toFixed(4)}` : "…"} />
            <StatusLine label="Vitesse" ok={true} value={me.speed != null ? `${Math.round(me.speed)} km/h` : "0 km/h"} />
            <StatusLine label="Connexion" ok={navigator.onLine} value={navigator.onLine ? "En ligne" : "Hors ligne"} />
            <StatusLine label="Stock camion" ok={!lowStock} value={`${stock.length} items`} warn={lowStock} />
          </div>
        </div>
      </div>

      {/* WIDGET GRID */}
      <div className="tk-mc-grid">
        {/* Timeline */}
        <div className="tk-card tk-widget" style={{ gridColumn: "1 / -1" }}>
          <div className="tk-widget__head"><Radio /> Timeline du jour · {upcoming.length} RDV</div>
          {loading ? (
            <div style={{ color: "hsl(var(--tk-fg-mut))" }}><Loader2 className="tk-spin" size={14} /> Chargement…</div>
          ) : upcoming.length === 0 ? (
            <div className="tk-alert tk-alert--info">Journée libre — aucun RDV planifié.</div>
          ) : (
            <div className="tk-timeline">
              {upcoming.slice(0, 8).map((a, i) => (
                <div key={a.assignment_id} className="tk-appt" data-cur={a.intervention_status === "active" ? 1 : 0}>
                  <div className="tk-appt__time"><div style={{ fontSize: 10, opacity: 0.7 }}>#{i + 1}</div><div>{a.time_start?.slice(0, 5)}</div></div>
                  <div className="tk-appt__body">
                    <div className="tk-appt__title">{a.client_full_name || "Client"}</div>
                    <div className="tk-appt__meta">
                      <span>{a.address_line}{a.city ? `, ${a.city}` : ""}</span>
                      <span>· {a.service_type ?? "installation"}</span>
                      {a.intervention_status === "active" && <span className="tk-tag tk-tag--accent">{a.intervention_progress ?? 0}/12</span>}
                    </div>
                  </div>
                  <button className="tk-btn tk-btn--sm tk-btn--ghost" onClick={() => nav(a.intervention_session_id ? `/tech/intervention/${a.intervention_session_id}` : `/tech/journee`)}>
                    Ouvrir
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weather */}
        <div className="tk-card tk-widget">
          <div className="tk-widget__head"><CloudSun /> Météo par RDV</div>
          <div className="tk-weather-list">
            {upcoming.slice(0, 5).map((a) => {
              const w = weather[a.assignment_id];
              return (
                <div key={a.assignment_id} className="tk-weather-row">
                  <div className="tk-weather-row__t">{a.time_start?.slice(0, 5)}</div>
                  <div className="tk-weather-row__c">{w?.condition ?? "—"}{w?.precipProbability != null ? ` · ${w.precipProbability}% pluie` : ""}</div>
                  <div className="tk-weather-row__temp">{w?.tempC != null ? `${Math.round(w.tempC)}°` : "—"}</div>
                </div>
              );
            })}
            {upcoming.length === 0 && <div style={{ color: "hsl(var(--tk-fg-mut))", fontSize: 13 }}>Aucun RDV</div>}
          </div>
        </div>

        {/* NOC */}
        <div className="tk-card tk-widget">
          <div className="tk-widget__head"><AlertTriangle /> NOC · Incidents actifs</div>
          {incidents.length === 0 ? (
            <div style={{ color: "hsl(var(--tk-ok))", fontSize: 13 }}>✓ Aucun incident réseau actif</div>
          ) : (
            <div>
              {incidents.slice(0, 4).map((i) => (
                <div key={i.id} className="tk-noc-item">
                  <div className="tk-noc-item__t">{i.service_display_name ?? i.service_name} — {i.incident_title}</div>
                  <div className="tk-noc-item__m">{new Date(i.started_at).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })} · {i.status_at_incident}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stock */}
        <div className="tk-card tk-widget">
          <div className="tk-widget__head"><Package /> Stock camion</div>
          {stock.length === 0 ? (
            <div style={{ color: "hsl(var(--tk-fg-mut))", fontSize: 13 }}>Aucun équipement assigné</div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {stock.slice(0, 6).map((s) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 8px", background: "hsl(var(--tk-bg-2))", borderRadius: 8 }}>
                  <span>{s.catalog_name}</span>
                  <span style={{ color: "hsl(var(--tk-fg-dim))", fontFamily: "monospace", fontSize: 11 }}>{s.serial_number ?? s.sku ?? "—"}</span>
                </div>
              ))}
            </div>
          )}
          {lowStock && <div className="tk-alert tk-alert--warn" style={{ marginTop: 10, fontSize: 12 }}>Stock faible — pense au réappro</div>}
        </div>

        {/* Urgent */}
        <div className="tk-card tk-widget">
          <div className="tk-widget__head"><Wifi /> Interventions actives</div>
          {items.filter((i) => i.intervention_status === "active").length === 0 ? (
            <div style={{ color: "hsl(var(--tk-fg-mut))", fontSize: 13 }}>Aucune intervention en cours</div>
          ) : (
            items.filter((i) => i.intervention_status === "active").map((i) => (
              <button key={i.assignment_id} onClick={() => nav(`/tech/intervention/${i.intervention_session_id}`)}
                className="tk-noc-item" style={{ display: "block", width: "100%", textAlign: "left", background: "hsl(var(--tk-accent) / 0.06)", borderColor: "hsl(var(--tk-accent) / 0.3)", cursor: "pointer" }}>
                <div className="tk-noc-item__t">{i.client_full_name} · étape {i.intervention_progress}/12</div>
                <div className="tk-noc-item__m">Reprendre l'intervention →</div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatusLine({ label, value, ok, warn }: { label: string; value: string; ok: boolean; warn?: boolean }) {
  const color = warn ? "hsl(var(--tk-warn))" : ok ? "hsl(var(--tk-ok))" : "hsl(var(--tk-danger))";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "6px 0", borderBottom: "1px solid hsl(var(--tk-line))" }}>
      <span style={{ color: "hsl(var(--tk-fg-mut))" }}>
        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: color, marginRight: 8 }} />{label}
      </span>
      <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }}>{value}</span>
    </div>
  );
}
