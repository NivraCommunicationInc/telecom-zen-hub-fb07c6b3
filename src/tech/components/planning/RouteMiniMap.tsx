import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { DayAssignment } from "@/tech/hooks/useMyDay";
import type { GeoState } from "@/tech/hooks/useTechnicianLocation";

const TOKEN = import.meta.env.VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN as string | undefined;

export function RouteMiniMap({ items, me }: { items: DayAssignment[]; me: GeoState | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!ref.current || !TOKEN) return;
    mapboxgl.accessToken = TOKEN;
    map.current = new mapboxgl.Map({
      container: ref.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-73.5674, 45.5017],
      zoom: 10,
    });
    return () => { map.current?.remove(); map.current = null; };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    markers.current.forEach((m) => m.remove());
    markers.current = [];

    const pts = items.filter((i) => i.latitude != null && i.longitude != null);
    pts.forEach((it, idx) => {
      const el = document.createElement("div");
      el.style.cssText = "width:28px;height:28px;border-radius:50%;background:hsl(32 100% 56%);color:#0b1220;display:grid;place-items:center;font-weight:900;font-size:12px;box-shadow:0 0 0 2px hsl(224 22% 5%);border:2px solid hsl(22 96% 50%);";
      el.textContent = String(idx + 1);
      const m = new mapboxgl.Marker({ element: el })
        .setLngLat([Number(it.longitude), Number(it.latitude)])
        .setPopup(new mapboxgl.Popup({ offset: 20 }).setText(`${idx + 1}. ${it.client_full_name ?? "RDV"} · ${it.address_line ?? ""}`))
        .addTo(map.current!);
      markers.current.push(m);
    });

    if (me?.lat && me.lng) {
      const el = document.createElement("div");
      el.style.cssText = "width:16px;height:16px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 3px hsl(152 68% 46% / 0.35),0 0 0 6px hsl(152 68% 46% / 0.15);";
      markers.current.push(new mapboxgl.Marker({ element: el }).setLngLat([me.lng, me.lat]).addTo(map.current!));
    }

    // Polyline in order
    const coords: [number, number][] = [];
    if (me?.lat && me.lng) coords.push([me.lng, me.lat]);
    pts.forEach((p) => coords.push([Number(p.longitude), Number(p.latitude)]));

    const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
      type: "Feature", properties: {},
      geometry: { type: "LineString", coordinates: coords },
    };

    const m = map.current;
    const applyLayer = () => {
      if (!m) return;
      const src = m.getSource("route") as mapboxgl.GeoJSONSource | undefined;
      if (src) {
        src.setData(geojson);
      } else {
        m.addSource("route", { type: "geojson", data: geojson });
        m.addLayer({
          id: "route-line", type: "line", source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "hsl(32,100%,56%)", "line-width": 3, "line-opacity": 0.75, "line-dasharray": [2, 1.5] },
        });
      }
      if (coords.length > 0) {
        const bounds = coords.reduce((b, c) => b.extend(c as [number, number]), new mapboxgl.LngLatBounds(coords[0], coords[0]));
        m.fitBounds(bounds, { padding: 40, duration: 400, maxZoom: 13 });
      }
    };
    if (m.isStyleLoaded()) applyLayer(); else m.once("load", applyLayer);
  }, [items, me?.lat, me?.lng]);

  if (!TOKEN) {
    return <div className="tk-mini-map" style={{ display: "grid", placeItems: "center", color: "hsl(var(--tk-fg-mut))" }}>Mapbox non configuré</div>;
  }
  return <div ref={ref} className="tk-mini-map" />;
}
