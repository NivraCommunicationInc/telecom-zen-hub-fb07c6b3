import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { DayAssignment } from "@/tech/hooks/useMyDay";
import type { Incident } from "@/tech/hooks/useServiceIncidents";
import type { GeoState } from "@/tech/hooks/useTechnicianLocation";

const TOKEN = import.meta.env.VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN as string | undefined;

type OpsMapMode = "compact" | "fullscreen";

function marker(className: string, label: string) {
  const el = document.createElement("div");
  el.className = className;
  el.textContent = label;
  return el;
}

export function OpsMap({
  assignments,
  incidents = [],
  me,
  mode = "compact",
}: {
  assignments: DayAssignment[];
  incidents?: Incident[];
  me: GeoState | null;
  mode?: OpsMapMode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!ref.current || !TOKEN) return;
    mapboxgl.accessToken = TOKEN;
    map.current = new mapboxgl.Map({
      container: ref.current,
      style: "mapbox://styles/mapbox/navigation-night-v1",
      center: [-73.5674, 45.5017],
      zoom: mode === "fullscreen" ? 10.8 : 9.8,
      pitch: mode === "fullscreen" ? 46 : 28,
      bearing: mode === "fullscreen" ? -18 : 0,
    });
    map.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "bottom-right");
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [mode]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((x) => x.remove());
    markers.current = [];

    const points: [number, number][] = [];
    if (me?.lat && me.lng) {
      points.push([me.lng, me.lat]);
      markers.current.push(
        new mapboxgl.Marker({ element: marker("tk-map-marker tk-map-marker--me", "●") })
          .setLngLat([me.lng, me.lat])
          .setPopup(new mapboxgl.Popup({ offset: 18 }).setText("Position technicien live"))
          .addTo(m),
      );
    }

    assignments
      .filter((a) => a.latitude != null && a.longitude != null)
      .forEach((a, idx) => {
        const lngLat: [number, number] = [Number(a.longitude), Number(a.latitude)];
        points.push(lngLat);
        markers.current.push(
          new mapboxgl.Marker({ element: marker("tk-map-marker tk-map-marker--appt", String(idx + 1)) })
            .setLngLat(lngLat)
            .setPopup(new mapboxgl.Popup({ offset: 18 }).setText(`${a.time_start?.slice(0, 5) ?? "RDV"} · ${a.client_full_name ?? "Client"} · ${a.address_line ?? "Adresse"}`))
            .addTo(m),
        );
      });

    incidents.slice(0, 8).forEach((i, idx) => {
      // Incident rows rarely carry coordinates today; distribute them around Montréal
      // so the operator still sees the NOC layer instead of a dead panel.
      const lngLat: [number, number] = [-73.67 + idx * 0.035, 45.47 + (idx % 3) * 0.035];
      points.push(lngLat);
      markers.current.push(
        new mapboxgl.Marker({ element: marker("tk-map-marker tk-map-marker--incident", "!") })
          .setLngLat(lngLat)
          .setPopup(new mapboxgl.Popup({ offset: 18 }).setText(`${i.service_display_name ?? i.service_name} · ${i.incident_title}`))
          .addTo(m),
      );
    });

    const routeCoords: [number, number][] = [];
    if (me?.lat && me.lng) routeCoords.push([me.lng, me.lat]);
    assignments
      .filter((a) => a.latitude != null && a.longitude != null)
      .forEach((a) => routeCoords.push([Number(a.longitude), Number(a.latitude)]));

    const draw = () => {
      if (routeCoords.length > 1) {
        const route: GeoJSON.Feature<GeoJSON.LineString> = {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: routeCoords },
        };
        const src = m.getSource("tech-route") as mapboxgl.GeoJSONSource | undefined;
        if (src) src.setData(route);
        else {
          m.addSource("tech-route", { type: "geojson", data: route });
          m.addLayer({
            id: "tech-route-line",
            type: "line",
            source: "tech-route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": "#ffb020",
              "line-width": mode === "fullscreen" ? 5 : 3,
              "line-opacity": 0.88,
            },
          });
        }
      }
      if (points.length > 0) {
        const bounds = points.reduce((b, p) => b.extend(p), new mapboxgl.LngLatBounds(points[0], points[0]));
        m.fitBounds(bounds, { padding: mode === "fullscreen" ? 92 : 42, duration: 500, maxZoom: 14 });
      }
    };
    if (m.isStyleLoaded()) draw(); else m.once("load", draw);
  }, [assignments, incidents, me?.lat, me?.lng, mode]);

  if (!TOKEN) {
    return (
      <div className={mode === "fullscreen" ? "tk-ops-map tk-ops-map--full" : "tk-ops-map"}>
        <div className="tk-map-empty">Carte indisponible — connecteur Mapbox requis</div>
      </div>
    );
  }

  return <div ref={ref} className={mode === "fullscreen" ? "tk-ops-map tk-ops-map--full" : "tk-ops-map"} />;
}