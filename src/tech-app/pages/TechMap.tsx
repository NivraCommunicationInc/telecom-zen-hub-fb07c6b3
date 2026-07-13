/**
 * TechMap — Mapbox map with active service addresses + technician positions.
 * Filters by service type. Click pin → drawer with address + services/tech.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { ArrowLeft, Loader2, MapPin, Wifi, Tv, Smartphone, X, Layers, Navigation2, UserRound } from "lucide-react";
import { useTechMapData, MapPoint } from "../lib/useTechMapData";

type Filter = "all" | "internet" | "tv" | "mobile";

function pickColor(services: MapPoint["services"]): string {
  const types = services.map((s) => (s.service_type || "").toLowerCase());
  if (types.some((t) => t.includes("mobile") || t.includes("sim"))) return "#f59e0b";
  if (types.some((t) => t.includes("tv"))) return "#22d3ee";
  if (types.some((t) => t.includes("internet") || t.includes("wifi"))) return "#a78bfa";
  return "#7c3aed";
}

function markerColor(p: MapPoint): string {
  return p.kind === "technician" ? "#f59e0b" : pickColor(p.services);
}

function matchesFilter(p: MapPoint, filter: Filter): boolean {
  if (filter === "all") return true;
    if (p.kind === "technician") return false;
    return p.services.some((s) => (s.service_type || "").toLowerCase().includes(filter));
}

export default function TechMap() {
  const { data, isLoading, error } = useTechMapData();
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<MapPoint | null>(null);
  const [style, setStyle] = useState<"streets" | "dark">("dark");

  const points = useMemo(() => (data?.points || []).filter((p) => matchesFilter(p, filter)), [data, filter]);

  // Init map once we have a token AND the container is mounted
  useEffect(() => {
    if (!data?.token || !mapEl.current || mapRef.current) return;
    try {
      mapboxgl.accessToken = data.token;
      const styleUrl =
        style === "dark"
          ? "mapbox://styles/mapbox/dark-v11"
          : "mapbox://styles/mapbox/streets-v12";
      mapRef.current = new mapboxgl.Map({
        container: mapEl.current,
        style: styleUrl,
        center: [-73.5674, 45.5019],
        zoom: 10,
        attributionControl: false,
      });
      mapRef.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      // Force resize once layout settles (fixes 0-height flash on mobile 100dvh)
      const t = setTimeout(() => mapRef.current?.resize(), 250);
      return () => {
        clearTimeout(t);
        mapRef.current?.remove();
        mapRef.current = null;
      };
    } catch (e) {
      console.error("[TechMap] init failed", e);
    }
  }, [data?.token]);

  // Update style
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setStyle(style === "dark" ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/streets-v12");
  }, [style]);

  // Draw markers when points change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    for (const p of points) {
      const el = document.createElement("button");
      el.style.cssText = `
        width:28px;height:28px;border-radius:50%;border:2.5px solid #fff;
        background:${markerColor(p)};box-shadow:0 4px 12px rgba(0,0,0,.45),0 0 0 4px ${markerColor(p)}25;
        cursor:pointer;display:flex;align-items:center;justify-content:center;
        transition:transform .15s ease;
      `;
      el.onmouseenter = () => (el.style.transform = "scale(1.15)");
      el.onmouseleave = () => (el.style.transform = "scale(1)");
      el.onclick = (ev) => {
        ev.stopPropagation();
        setSelected(p);
        map.flyTo({ center: [p.lng, p.lat], zoom: 14, duration: 700 });
      };
      const marker = new mapboxgl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
      markersRef.current.push(marker);
    }

    // Fit bounds
    if (points.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      points.forEach((p) => bounds.extend([p.lng, p.lat]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 600 });
    }
  }, [points]);

  const counts = useMemo(() => {
    const all = data?.points || [];
    return {
      all: all.length,
      internet: all.filter((p) => p.services.some((s) => (s.service_type || "").toLowerCase().includes("internet"))).length,
      tv: all.filter((p) => p.services.some((s) => (s.service_type || "").toLowerCase().includes("tv"))).length,
      mobile: all.filter((p) => p.services.some((s) => (s.service_type || "").toLowerCase().includes("mobile"))).length,
    };
  }, [data]);

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ background: "var(--tp-bg)", zIndex: 1 }}
    >
      {/* Map container — explicit size, not dependent on 100dvh */}
      <div ref={mapEl} className="absolute inset-0" style={{ width: "100%", height: "100%" }} />

      {/* Loader / no token */}
      {(isLoading || !data?.token) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: "var(--tp-bg)" }}>
          {isLoading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--tp-primary-glow)" }} />
              <p className="text-[13px]" style={{ color: "var(--tp-text-muted)" }}>Chargement de la carte…</p>
            </>
          ) : (
            <>
              <MapPin className="h-8 w-8" style={{ color: "var(--tp-danger)" }} />
              <p className="text-[13px]" style={{ color: "var(--tp-text-muted)" }}>Carte indisponible</p>
            </>
          )}
        </div>
      )}

      {/* Top overlay: back + filters */}
      <div className="absolute top-0 left-0 right-0 pt-[env(safe-area-inset-top)] z-10 pointer-events-none">
        <div className="px-4 pt-3 flex items-center gap-2 pointer-events-auto">
          <Link
            to="/tech"
            className="h-10 w-10 rounded-full flex items-center justify-center backdrop-blur-md"
            style={{ background: "rgba(15,15,26,0.85)", border: "1px solid var(--tp-border-strong)", color: "var(--tp-text)" }}
            aria-label="Retour"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div
            className="flex-1 h-10 px-3 rounded-full flex items-center gap-2 backdrop-blur-md"
            style={{ background: "rgba(15,15,26,0.85)", border: "1px solid var(--tp-border-strong)" }}
          >
            <MapPin className="h-4 w-4" style={{ color: "var(--tp-primary-glow)" }} />
            <span className="text-[13px] font-bold tp-display" style={{ color: "var(--tp-text)" }}>
              {points.length} {points.length > 1 ? "adresses" : "adresse"}
            </span>
            {error && (
              <span className="ml-auto text-[10px] font-bold text-red-400">Erreur</span>
            )}
          </div>
          <button
            onClick={() => setStyle((s) => (s === "dark" ? "streets" : "dark"))}
            className="h-10 w-10 rounded-full flex items-center justify-center backdrop-blur-md"
            style={{ background: "rgba(15,15,26,0.85)", border: "1px solid var(--tp-border-strong)", color: "var(--tp-text)" }}
            aria-label="Style de carte"
          >
            <Layers className="h-5 w-5" />
          </button>
        </div>

        {/* Filters row */}
        <div className="mt-2.5 px-4 flex gap-2 overflow-x-auto no-scrollbar pointer-events-auto pb-1">
          {([
            { id: "all", label: "Tout", icon: MapPin, count: counts.all },
            { id: "internet", label: "Internet", icon: Wifi, count: counts.internet },
            { id: "tv", label: "TV", icon: Tv, count: counts.tv },
                { id: "mobile", label: "Mobile", icon: Smartphone, count: counts.mobile },
          ] as const).map(({ id, label, icon: Icon, count }) => {
            const active = filter === id;
            return (
              <button
                key={id}
                onClick={() => setFilter(id as Filter)}
                className="shrink-0 h-9 pl-3 pr-3.5 rounded-full flex items-center gap-1.5 text-[12px] font-bold transition-all backdrop-blur-md"
                style={{
                  background: active
                    ? "linear-gradient(135deg,var(--tp-primary),var(--tp-primary-deep))"
                    : "rgba(15,15,26,0.85)",
                  border: active ? "1px solid var(--tp-primary-glow)" : "1px solid var(--tp-border-strong)",
                  color: active ? "#fff" : "var(--tp-text-muted)",
                  boxShadow: active ? "0 4px 14px rgba(124,58,237,0.35)" : "none",
                }}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                <span
                  className="ml-1 text-[10px] px-1.5 h-4 rounded-full flex items-center"
                  style={{
                    background: active ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)",
                    color: active ? "#fff" : "var(--tp-text-dim)",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Detail sheet */}
      {selected && (
        <div
          className="absolute left-3 right-3 bottom-[calc(90px+env(safe-area-inset-bottom))] rounded-2xl p-4 z-20 tp-card"
          style={{ background: "rgba(20,20,42,0.96)", backdropFilter: "blur(20px)" }}
        >
          <div className="flex items-start gap-3">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: pickColor(selected.services) + "20", border: `1px solid ${pickColor(selected.services)}55` }}
            >
              {selected.kind === "technician" ? (
                <UserRound className="h-5 w-5" style={{ color: markerColor(selected) }} />
              ) : (
                <MapPin className="h-5 w-5" style={{ color: markerColor(selected) }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="tp-display text-[15px] font-black leading-tight" style={{ color: "var(--tp-text)" }}>
                {selected.kind === "technician" ? (selected.technician_name || "Technicien") : (selected.label || "Adresse client")}
              </p>
              <p className="text-[12px] mt-0.5 line-clamp-2" style={{ color: "var(--tp-text-muted)" }}>
                {selected.kind === "technician"
                  ? `${selected.location_source === "live_gps" ? "Position GPS" : "Adresse du rendez-vous"}${selected.assignment_status ? ` · ${selected.assignment_status}` : ""}`
                  : [selected.address_line, selected.city, selected.province, selected.postal_code].filter(Boolean).join(", ")}
              </p>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: "rgba(255,255,255,0.06)", color: "var(--tp-text-muted)" }}
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {selected.kind === "technician" && (
            <div className="mt-3 rounded-xl px-3 py-2" style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.28)", color: "#fbbf24" }}>
              <p className="text-[11px] font-bold">Technicien visible sur la carte</p>
            </div>
          )}

          {selected.services.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selected.services.map((s) => (
                <span
                  key={s.id}
                  className="text-[10px] font-bold px-2 py-1 rounded-full"
                  style={{
                    background: "rgba(124,58,237,0.15)",
                    color: "var(--tp-primary-glow)",
                    border: "1px solid rgba(124,58,237,0.25)",
                  }}
                >
                  {s.plan_name || s.service_type || "Service"}
                </span>
              ))}
            </div>
          )}

          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${selected.lat},${selected.lng}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 w-full h-11 rounded-xl flex items-center justify-center gap-2 text-[13px] font-bold text-white tp-btn-primary"
          >
            <Navigation2 className="h-4 w-4" /> Itinéraire
          </a>
        </div>
      )}
    </div>
  );
}
