/**
 * TechnicianLocationShare — toggleable GPS sharing for technicians.
 * Uses browser geolocation watchPosition + supabase upsert into
 * technician_locations. One row per technician (unique constraint).
 *
 * When toggled off OR component unmounts → marks row is_active=false.
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  userId: string;
  installationJobId?: string | null;
}

export function TechnicianLocationShare({ userId, installationJobId }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastWriteRef = useRef<number>(0);

  const writeLocation = async (pos: GeolocationPosition) => {
    const now = Date.now();
    // throttle writes to one per 30s
    if (now - lastWriteRef.current < 30_000) return;
    lastWriteRef.current = now;

    const payload = {
      technician_id: userId,
      installation_job_id: installationJobId ?? null,
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy_meters: pos.coords.accuracy ?? null,
      heading: pos.coords.heading ?? null,
      speed_kmh: pos.coords.speed != null ? pos.coords.speed * 3.6 : null,
      recorded_at: new Date().toISOString(),
      is_active: true,
    };

    const { error } = await (supabase as any)
      .from("technician_locations")
      .upsert(payload, { onConflict: "technician_id" });

    if (error) {
      console.error("[TechnicianLocationShare] upsert failed", error);
      return;
    }
    setLastUpdate(new Date());
  };

  const stopSharing = async () => {
    if (watchIdRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    try {
      await (supabase as any)
        .from("technician_locations")
        .update({ is_active: false })
        .eq("technician_id", userId);
    } catch (e) {
      console.error("[TechnicianLocationShare] stop failed", e);
    }
  };

  const startSharing = async () => {
    if (!("geolocation" in navigator)) {
      toast.error("Géolocalisation non disponible sur cet appareil");
      return;
    }
    setBusy(true);
    try {
      // immediate single shot then start watch
      navigator.geolocation.getCurrentPosition(
        (pos) => { void writeLocation(pos); },
        (err) => console.warn("[geo] initial", err),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 },
      );
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => { void writeLocation(pos); },
        (err) => {
          console.error("[geo] watch", err);
          toast.error("Erreur GPS — partage interrompu");
          setEnabled(false);
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (enabled) {
      void startSharing();
    } else {
      void stopSharing();
    }
    return () => {
      if (watchIdRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      // best-effort flush
      void (supabase as any)
        .from("technician_locations")
        .update({ is_active: false })
        .eq("technician_id", userId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, userId, installationJobId]);

  return (
    <div className="bg-[#111827] border border-slate-700 rounded-xl p-3 flex items-center justify-between">
      <div className="flex items-center gap-2 min-w-0">
        <MapPin className={`w-4 h-4 flex-shrink-0 ${enabled ? "text-emerald-400" : "text-slate-400"}`} />
        <div className="min-w-0">
          <div className="text-sm text-slate-100 font-medium">Partager ma position</div>
          <div className="text-[11px] text-slate-400">
            {enabled
              ? lastUpdate
                ? `Maj ${lastUpdate.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}`
                : "Acquisition GPS…"
              : "Arrêté"}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setEnabled((v) => !v)}
        disabled={busy}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? "bg-emerald-500" : "bg-slate-600"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
            enabled ? "translate-x-5" : "translate-x-1"
          }`}
        />
        {busy && <Loader2 className="absolute -right-6 w-4 h-4 animate-spin text-slate-400" />}
      </button>
    </div>
  );
}

export default TechnicianLocationShare;
