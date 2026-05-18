/**
 * TechnicianMapView — real-time map of all active technicians.
 * Uses react-leaflet (already installed) + OpenStreetMap tiles.
 */
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { usePortalRealtime } from "@/hooks/usePortalRealtime";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

// Fix default marker icons (Leaflet + bundlers)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const colored = (color: string) =>
  L.divIcon({
    className: "",
    html: `<div style="background:${color};width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 0 4px rgba(0,0,0,0.5)"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });

const greenIcon = colored("#10b981");
const blueIcon = colored("#3b82f6");
const grayIcon = colored("#6b7280");

type LocRow = {
  id: string;
  technician_id: string;
  installation_job_id: string | null;
  latitude: number;
  longitude: number;
  speed_kmh: number | null;
  recorded_at: string;
  is_active: boolean;
};

export function TechnicianMapView() {
  const locsQ = useQuery({
    queryKey: ["technician-locations-active"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("technician_locations")
        .select("id, technician_id, installation_job_id, latitude, longitude, speed_kmh, recorded_at, is_active")
        .eq("is_active", true)
        .gt("recorded_at", new Date(Date.now() - 10 * 60_000).toISOString());
      if (error) throw error;
      return (data as LocRow[]) ?? [];
    },
  });

  usePortalRealtime(["technician_locations"], [["technician-locations-active"]]);

  const locs = locsQ.data ?? [];
  const techIds = Array.from(new Set(locs.map((l) => l.technician_id)));
  const jobIds = Array.from(new Set(locs.map((l) => l.installation_job_id).filter(Boolean) as string[]));

  const techsQ = useQuery({
    queryKey: ["tech-names", techIds.join(",")],
    enabled: techIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("technicians")
        .select("user_id, full_name")
        .in("user_id", techIds);
      const m = new Map<string, string>();
      (data ?? []).forEach((t: any) => m.set(t.user_id, t.full_name || "Technicien"));
      return m;
    },
  });

  const jobsQ = useQuery({
    queryKey: ["tech-jobs", jobIds.join(",")],
    enabled: jobIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("installation_jobs")
        .select("id, job_number, client_name, service_address, service_city")
        .in("id", jobIds);
      const m = new Map<string, any>();
      (data ?? []).forEach((j: any) => m.set(j.id, j));
      return m;
    },
  });

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (locsQ.isLoading) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement de la carte…
      </div>
    );
  }

  return (
    <div className="h-[70vh] w-full rounded-xl overflow-hidden border border-border">
      <MapContainer center={[45.5, -73.5]} zoom={10} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {locs.map((loc) => {
          const speed = loc.speed_kmh ?? 0;
          const job = loc.installation_job_id ? jobsQ.data?.get(loc.installation_job_id) : null;
          const icon = speed > 5 ? greenIcon : job ? blueIcon : grayIcon;
          const name = techsQ.data?.get(loc.technician_id) ?? "Technicien";
          const ageSec = Math.round((now - new Date(loc.recorded_at).getTime()) / 1000);
          return (
            <Marker key={loc.id} position={[loc.latitude, loc.longitude]} icon={icon}>
              <Popup>
                <div className="text-xs space-y-1">
                  <div className="font-semibold">{name}</div>
                  {job && (
                    <>
                      <div>Job #{job.job_number}</div>
                      <div className="text-muted-foreground">{job.client_name}</div>
                      <div className="text-muted-foreground">
                        {job.service_address}{job.service_city ? `, ${job.service_city}` : ""}
                      </div>
                    </>
                  )}
                  <div>{speed > 0 ? `${speed.toFixed(0)} km/h` : "Arrêté"}</div>
                  <div className="text-muted-foreground">
                    Maj il y a {ageSec < 60 ? `${ageSec}s` : `${Math.round(ageSec / 60)}min`}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

export default TechnicianMapView;
