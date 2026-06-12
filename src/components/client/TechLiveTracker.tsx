/**
 * TechLiveTracker — shown inside each upcoming appointment in the client portal.
 * - Renders only when a technician_assignment exists for the order.
 * - When status = en_route + live_location present: shows Leaflet map with tech pin.
 * - Geocodes the client address once via Nominatim to show client pin + distance ETA.
 * - When tech is < 3 km away (≈5 min): shows a persistent banner + sends email via RPC.
 */
import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { Loader2, Radio, Navigation, Clock, MapPin } from "lucide-react";
import { useTechnicianAssignment } from "@/hooks/useTechnicianAssignment";
import { portalClient } from "@/integrations/backend";
import TechnicianStatusTimeline from "./TechnicianStatusTimeline";

const TechMap = lazy(() => import("./TechMap"));

// ── Haversine ──────────────────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Nominatim geocoding ────────────────────────────────────────────────────
async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=ca&limit=1`;
    const res = await fetch(url, { headers: { "Accept-Language": "fr" } });
    const data = await res.json();
    if (data?.[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

// ── Props ──────────────────────────────────────────────────────────────────
interface TechLiveTrackerProps {
  orderId: string | null | undefined;
  clientAddress?: string | null;
}

const LIVE_STATUSES = new Set(["en_route", "arrived", "in_progress"]);
const NEARBY_KM = 3; // ≈5 min at 30 km/h

export default function TechLiveTracker({ orderId, clientAddress }: TechLiveTrackerProps) {
  const { data: assignment, isLoading } = useTechnicianAssignment(orderId);
  const [clientCoords, setClientCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showNearbyBanner, setShowNearbyBanner] = useState(false);
  const notifiedRef = useRef(false);

  // Geocode client address once when en_route and address is known
  useEffect(() => {
    if (assignment?.status !== "en_route" || !clientAddress || clientCoords) return;
    geocode(clientAddress).then((coords) => { if (coords) setClientCoords(coords); });
  }, [assignment?.status, clientAddress, clientCoords]);

  // Detect 5-min proximity
  useEffect(() => {
    if (!assignment?.live_location || !clientCoords || notifiedRef.current) return;
    if (assignment.nearby_notified_at) { notifiedRef.current = true; return; }

    const { lat, lng } = assignment.live_location;
    const km = haversineKm(lat, lng, clientCoords.lat, clientCoords.lng);

    if (km <= NEARBY_KM) {
      notifiedRef.current = true;
      setShowNearbyBanner(true);
      // Fire-and-forget: send email + mark in DB
      if (assignment.id) {
        (portalClient.rpc as any)("notify_client_technician_nearby", { p_assignment_id: assignment.id });
      }
    }
  }, [assignment?.live_location, assignment?.nearby_notified_at, clientCoords, assignment?.id]);

  // On mount: if already notified before, show banner
  useEffect(() => {
    if (assignment?.nearby_notified_at && !notifiedRef.current) {
      notifiedRef.current = true;
      setShowNearbyBanner(true);
    }
  }, [assignment?.nearby_notified_at]);

  if (!orderId) return null;
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 mt-2">
        <Loader2 className="w-3 h-3 animate-spin" /> Chargement du suivi...
      </div>
    );
  }
  if (!assignment) return null;

  const isLive = LIVE_STATUSES.has(assignment.status);
  const hasMap = assignment.status === "en_route" && !!assignment.live_location;

  // ETA calculation
  let etaMinutes: number | null = null;
  let distanceKm: number | null = null;
  if (hasMap && clientCoords && assignment.live_location) {
    const { lat, lng } = assignment.live_location;
    distanceKm = haversineKm(lat, lng, clientCoords.lat, clientCoords.lng);
    etaMinutes = Math.max(1, Math.round((distanceKm / 30) * 60));
  }

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-border bg-card/60 p-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        {isLive ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
            <Radio className="w-3.5 h-3.5 animate-pulse" /> Suivi en direct
          </span>
        ) : (
          <span className="text-xs font-semibold text-muted-foreground">Statut du technicien</span>
        )}

        {/* ETA chip */}
        {etaMinutes != null && distanceKm != null && (
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <MapPin className="w-3 h-3" /> {distanceKm.toFixed(1)} km
            </span>
            <span className="flex items-center gap-1 rounded-full bg-orange-500/15 border border-orange-500/30 px-2.5 py-1 text-xs font-semibold text-orange-300">
              <Clock className="w-3 h-3" /> ~{etaMinutes} min
            </span>
          </div>
        )}
        {!etaMinutes && assignment.eta_text && (
          <span className="flex items-center gap-1 rounded-full bg-orange-500/15 border border-orange-500/30 px-2.5 py-1 text-xs font-semibold text-orange-300">
            <Clock className="w-3 h-3" /> {assignment.eta_text}
          </span>
        )}
      </div>

      {/* 5-min nearby banner */}
      {showNearbyBanner && (
        <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-3 flex items-center gap-3">
          <Navigation className="w-5 h-5 text-orange-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-orange-300">Le technicien est à 5 minutes!</p>
            <p className="text-xs text-muted-foreground mt-0.5">Vous avez reçu un courriel de confirmation.</p>
          </div>
        </div>
      )}

      {/* Live map */}
      {hasMap && assignment.live_location && (
        <Suspense fallback={<div className="h-[220px] rounded-xl bg-muted animate-pulse" />}>
          <TechMap
            techLocation={assignment.live_location}
            clientCoords={clientCoords}
            clientAddress={clientAddress}
            etaMinutes={etaMinutes}
          />
        </Suspense>
      )}

      {/* Status timeline */}
      <TechnicianStatusTimeline
        currentStatus={assignment.status}
        etaText={assignment.eta_text}
        scheduledDate={assignment.scheduled_date}
        scheduledTimeStart={assignment.scheduled_time_start}
      />
    </div>
  );
}
