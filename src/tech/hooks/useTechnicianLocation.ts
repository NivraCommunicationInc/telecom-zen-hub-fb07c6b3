import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GeoState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  updatedAt: number | null;
  error: string | null;
}

// Watches GPS and upserts technician_locations every ~15s while active.
export function useTechnicianLocation(active = true) {
  const [state, setState] = useState<GeoState>({
    lat: null, lng: null, accuracy: null, speed: null, heading: null,
    updatedAt: null, error: null,
  });
  const lastPush = useRef(0);

  useEffect(() => {
    if (!active || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      async (pos) => {
        const c = pos.coords;
        setState({
          lat: c.latitude, lng: c.longitude,
          accuracy: c.accuracy ?? null,
          speed: c.speed != null ? c.speed * 3.6 : null,
          heading: c.heading ?? null,
          updatedAt: Date.now(), error: null,
        });
        const now = Date.now();
        if (now - lastPush.current > 15000) {
          lastPush.current = now;
          try {
            await supabase.rpc("fn_upsert_technician_location", {
              _lat: c.latitude, _lng: c.longitude,
              _accuracy: c.accuracy ?? null,
              _speed: c.speed != null ? c.speed * 3.6 : null,
              _heading: c.heading ?? null,
            });
          } catch { /* silent */ }
        }
      },
      (err) => setState((s) => ({ ...s, error: err.message })),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [active]);

  return state;
}
