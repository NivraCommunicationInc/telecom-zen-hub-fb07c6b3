/**
 * TechnicianMapView — real-time map of all active technicians.
 * Uses react-leaflet (already installed) + OpenStreetMap tiles.
 */
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { usePortalRealtime } from "@/hooks/usePortalRealtime";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, LocateFixed, Navigation, RefreshCw, Search } from "lucide-react";

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
const orangeIcon = colored("#f59e0b");

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
  const [search, setSearch] = useState("");
  const [activityFilter, setActivityFilter] = useState("all");
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

  // Techniciens assignés à un RDV actif (accepté / en route / en cours) — affichés à l'adresse du job
  // quand ils n'ont pas encore partagé leur position live.
  const assignmentsQ = useQuery({
    queryKey: ["technician-active-assignments"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("technician_assignments")
        .select("id, technician_id, status, scheduled_date, scheduled_time_start, scheduled_time_end, order_id, service_address_id, service_addresses:service_address_id(address_line, city, latitude, longitude)")
        .in("status", ["accepted", "en_route", "in_progress", "arrived"])
        .gte("scheduled_date", new Date(Date.now() - 24 * 3600_000).toISOString().slice(0, 10));
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const assignTechIds = Array.from(
    new Set((assignmentsQ.data ?? []).map((a: any) => a.technician_id).filter(Boolean)),
  );
  const assignTechNamesQ = useQuery({
    queryKey: ["assign-tech-names", assignTechIds.join(",")],
    enabled: assignTechIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("technicians")
        .select("user_id, full_name")
        .in("user_id", assignTechIds);
      const m = new Map<string, string>();
      (data ?? []).forEach((t: any) => m.set(t.user_id, t.full_name || "Technicien"));
      return m;
    },
  });

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const visibleLocs = useMemo(() => locs.filter((loc) => {
    const speed = loc.speed_kmh ?? 0;
    const job = loc.installation_job_id ? jobsQ.data?.get(loc.installation_job_id) : null;
    const name = techsQ.data?.get(loc.technician_id) ?? "Technicien";
    if (activityFilter === "moving" && speed <= 5) return false;
    if (activityFilter === "assigned" && !job) return false;
    if (activityFilter === "idle" && (speed > 5 || job)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const haystack = [name, loc.technician_id, job?.job_number, job?.client_name, job?.service_address, job?.service_city]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    }
    return true;
  }), [activityFilter, jobsQ.data, locs, search, techsQ.data]);

  if (locsQ.isLoading) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement de la carte…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher technicien, job, client, adresse…" className="pl-9" />
        </div>
        <Select value={activityFilter} onValueChange={setActivityFilter}>
          <SelectTrigger className="w-full md:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous ({locs.length})</SelectItem>
            <SelectItem value="moving">En déplacement</SelectItem>
            <SelectItem value="assigned">Avec job</SelectItem>
            <SelectItem value="idle">Disponibles</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => locsQ.refetch()} disabled={locsQ.isFetching}>
          {locsQ.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Rafraîchir
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-[320px_1fr]">
        <div className="rounded-xl border border-border bg-card max-h-[70vh] overflow-auto">
          <div className="sticky top-0 z-10 border-b border-border bg-card p-3">
            <p className="text-sm font-semibold">Techniciens actifs</p>
            <p className="text-xs text-muted-foreground">{visibleLocs.length} affiché(s) · mise à jour 30s</p>
          </div>
          <div className="divide-y divide-border">
            {visibleLocs.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Aucune position active selon les filtres.</div>
            ) : visibleLocs.map((loc) => {
              const speed = loc.speed_kmh ?? 0;
              const job = loc.installation_job_id ? jobsQ.data?.get(loc.installation_job_id) : null;
              const name = techsQ.data?.get(loc.technician_id) ?? "Technicien";
              const ageSec = Math.max(0, Math.round((now - new Date(loc.recorded_at).getTime()) / 1000));
              return (
                <div key={loc.id} className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{name}</p>
                      <p className="text-xs text-muted-foreground">Maj {ageSec < 60 ? `${ageSec}s` : `${Math.round(ageSec / 60)}min`}</p>
                    </div>
                    <Badge variant="outline">{speed > 5 ? "En route" : job ? "Sur job" : "Disponible"}</Badge>
                  </div>
                  {job && <p className="text-xs text-muted-foreground">Job #{job.job_number} · {job.client_name}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`, "_blank")}> 
                      <LocateFixed className="mr-1 h-3 w-3" /> Ouvrir GPS
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(`${loc.latitude},${loc.longitude}`)}>Copier coords</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="h-[70vh] w-full rounded-xl overflow-hidden border border-border">
      <MapContainer center={[45.5, -73.5]} zoom={10} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {visibleLocs.map((loc) => {
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
                  <div className="text-muted-foreground">{Number(loc.latitude).toFixed(5)}, {Number(loc.longitude).toFixed(5)}</div>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary"
                  >
                    Itinéraire <Navigation size={12} />
                  </a>
                  <div className="text-muted-foreground">
                    Maj il y a {ageSec < 60 ? `${ageSec}s` : `${Math.round(ageSec / 60)}min`}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Techniciens avec RDV actif mais sans position live → épinglés à l'adresse du client */}
        {(assignmentsQ.data ?? [])
          .filter((a: any) => {
            const addr = a.service_addresses;
            if (!addr?.latitude || !addr?.longitude) return false;
            // Skip si déjà affiché en live
            return !locs.some((l) => l.technician_id === a.technician_id);
          })
          .map((a: any) => {
            const addr = a.service_addresses;
            const name = assignTechNamesQ.data?.get(a.technician_id) ?? "Technicien";
            return (
              <Marker key={`asn-${a.id}`} position={[Number(addr.latitude), Number(addr.longitude)]} icon={orangeIcon}>
                <Popup>
                  <div className="text-xs space-y-1">
                    <div className="font-semibold">{name}</div>
                    <div className="text-muted-foreground">Statut: {a.status}</div>
                    <div className="text-muted-foreground">
                      RDV {a.scheduled_date} · {String(a.scheduled_time_start).slice(0, 5)}–{String(a.scheduled_time_end).slice(0, 5)}
                    </div>
                    <div className="text-muted-foreground">
                      {addr.address_line}{addr.city ? `, ${addr.city}` : ""}
                    </div>
                    <div className="text-[10px] italic text-muted-foreground">Position estimée (adresse du RDV)</div>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${addr.latitude},${addr.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary"
                    >
                      Itinéraire <Navigation size={12} />
                    </a>
                  </div>
                </Popup>
              </Marker>
            );
          })}
      </MapContainer>
        </div>
      </div>
    </div>
  );
}

export default TechnicianMapView;
