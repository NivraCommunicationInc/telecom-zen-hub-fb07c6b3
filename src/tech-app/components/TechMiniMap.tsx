/**
 * TechMiniMap — Real Mapbox mini-map for the dashboard tile.
 * Shows all service address pins with the tech-portal palette.
 * Non-interactive; clicking the tile navigates to /tech/map.
 */
import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useTechMapData } from "../lib/useTechMapData";

export default function TechMiniMap() {
  const { data } = useTechMapData();
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!data?.token || !elRef.current || mapRef.current) return;
    try {
      mapboxgl.accessToken = data.token;
      const map = new mapboxgl.Map({
        container: elRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [-73.5674, 45.5019],
        zoom: 8.5,
        interactive: false,
        attributionControl: false,
      });
      mapRef.current = map;

      map.on("load", () => {
        const pts = data.points || [];
        for (const p of pts) {
          const el = document.createElement("div");
          el.style.cssText = `
            width:10px;height:10px;border-radius:50%;
            background:#a78bfa;border:2px solid #fff;
            box-shadow:0 0 0 3px rgba(124,58,237,0.35);
          `;
          new mapboxgl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map);
        }
        if (pts.length > 1) {
          const b = new mapboxgl.LngLatBounds();
          pts.forEach((p) => b.extend([p.lng, p.lat]));
          map.fitBounds(b, { padding: 20, maxZoom: 10, duration: 0 });
        } else if (pts.length === 1) {
          map.setCenter([pts[0].lng, pts[0].lat]);
          map.setZoom(11);
        }
        setTimeout(() => map.resize(), 200);
      });
    } catch (e) {
      console.error("[TechMiniMap] init failed", e);
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [data?.token, data?.points]);

  return <div ref={elRef} className="absolute inset-0" aria-hidden />;
}
