import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LiveLocation } from "@/hooks/useTechnicianAssignment";

// Fix Leaflet default icon URLs broken by bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const techIcon = L.divIcon({
  html: `<div style="background:#f97316;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);font-size:18px;">🚚</div>`,
  className: "",
  iconSize:   [36, 36],
  iconAnchor: [18, 18],
});

const clientIcon = L.divIcon({
  html: `<div style="background:#8b5cf6;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);font-size:16px;">🏠</div>`,
  className: "",
  iconSize:   [32, 32],
  iconAnchor: [16, 16],
});

function FitBounds({ techPos, clientPos }: { techPos: [number, number]; clientPos?: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (clientPos) {
      map.fitBounds([techPos, clientPos], { padding: [40, 40], maxZoom: 15 });
    } else {
      map.setView(techPos, 14);
    }
  }, [techPos[0], techPos[1], clientPos?.[0], clientPos?.[1]]);
  return null;
}

interface TechMapProps {
  techLocation: LiveLocation;
  clientCoords?: { lat: number; lng: number } | null;
  clientAddress?: string | null;
  etaMinutes?: number | null;
}

export default function TechMap({ techLocation, clientCoords, clientAddress, etaMinutes }: TechMapProps) {
  const techPos: [number, number] = [techLocation.lat, techLocation.lng];
  const clientPos: [number, number] | null = clientCoords ? [clientCoords.lat, clientCoords.lng] : null;

  return (
    <div className="rounded-xl overflow-hidden border border-border" style={{ height: 220 }}>
      <MapContainer
        center={techPos}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        scrollWheelZoom={false}
        dragging={true}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitBounds techPos={techPos} clientPos={clientPos} />

        <Marker position={techPos} icon={techIcon}>
          <Popup>
            <div className="text-xs font-semibold">
              Technicien Nivra
              {etaMinutes != null && <div>ETA: ~{etaMinutes} min</div>}
            </div>
          </Popup>
        </Marker>

        {clientPos && (
          <Marker position={clientPos} icon={clientIcon}>
            <Popup>
              <div className="text-xs">{clientAddress || "Votre adresse"}</div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
