/**
 * CoverageMap — Feature 3 interactive coverage map (Leaflet).
 * Public route /couverture. Renders service_coverage_areas as markers
 * placed via quebecCities geo lookup.
 */
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "react-router-dom";
import { backendClient } from "@/integrations/backend/client";
import { quebecCities } from "@/data/quebecCities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MapPin, Locate } from "lucide-react";

type Zone = {
  id: string;
  city: string;
  province: string;
  postal_prefix: string | null;
  coverage_type: string | null;
  internet_available: boolean;
  tv_available: boolean;
  mobile_available: boolean;
  is_active: boolean;
};

function citySlug(c: string) {
  return c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function colorFor(z: Zone): string {
  if (z.internet_available && z.tv_available && z.mobile_available) return "#7c3aed"; // full
  if (z.internet_available && z.tv_available) return "#10b981"; // internet+tv
  if (z.internet_available) return "#2563eb"; // internet
  return "#94a3b8"; // other / coming
}

function FlyToControl({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => { if (target) map.setView(target, 12); }, [target, map]);
  return null;
}

export default function CoverageMap() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<[number, number] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await backendClient.from("service_coverage_areas").select("*").eq("is_active", true);
      setZones((data as Zone[]) || []);
    })();
  }, []);

  const points = zones.map((z) => {
    const slug = citySlug(z.city || "");
    const geo = quebecCities[slug];
    return geo ? { ...z, lat: geo.lat, lng: geo.lng } : null;
  }).filter(Boolean) as (Zone & { lat: number; lng: number })[];

  const handleSearch = () => {
    const slug = citySlug(search);
    const geo = quebecCities[slug];
    if (geo) setTarget([geo.lat, geo.lng]);
    else if (search) {
      // Approximate: find first zone city that contains query
      const match = points.find((p) => p.city.toLowerCase().includes(search.toLowerCase()));
      if (match) setTarget([match.lat, match.lng]);
    }
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => setTarget([pos.coords.latitude, pos.coords.longitude]));
  };

  return (
    <main className="min-h-screen bg-white">
      <header className="bg-white border-b">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold" style={{ color: "#7c3aed" }}>Nivra</Link>
          <Link to="/" className="text-sm text-slate-600 hover:text-slate-900">← Retour</Link>
        </div>
      </header>

      <section className="max-w-[1400px] mx-auto px-6 py-6">
        <h1 className="text-3xl font-bold text-slate-900">Carte de couverture</h1>
        <p className="text-slate-600 mt-1">Vérifiez la disponibilité de nos services à votre adresse.</p>

        <Card className="mt-4 p-4">
          <div className="flex flex-col md:flex-row gap-2">
            <Input
              placeholder="Entrez votre ville (ex. Montréal, Québec, Laval)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} style={{ background: "#7c3aed" }}><MapPin className="w-4 h-4 mr-2" />Vérifier</Button>
            <Button onClick={handleGeolocate} variant="outline"><Locate className="w-4 h-4 mr-2" />Ma position</Button>
          </div>
          <div className="flex flex-wrap gap-3 mt-3 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: "#7c3aed" }} />Service complet</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: "#10b981" }} />Internet + TV</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: "#2563eb" }} />Internet</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: "#94a3b8" }} />À venir</span>
          </div>
        </Card>

        <div className="mt-4 rounded-lg overflow-hidden border" style={{ height: "65vh" }}>
          <MapContainer center={[46.8, -71.5]} zoom={6} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FlyToControl target={target} />
            {points.map((p) => (
              <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={10} pathOptions={{ color: colorFor(p), fillColor: colorFor(p), fillOpacity: 0.6 }}>
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold">{p.city}, {p.province}</p>
                    {p.postal_prefix && <p className="text-xs text-slate-500">Préfixe postal : {p.postal_prefix}</p>}
                    <ul className="mt-2 text-xs space-y-0.5">
                      <li>Internet : {p.internet_available ? "✓" : "—"}</li>
                      <li>TV : {p.tv_available ? "✓" : "—"}</li>
                      <li>Mobile : {p.mobile_available ? "✓" : "—"}</li>
                    </ul>
                    <Link to="/commander" className="block mt-2 text-center px-3 py-1.5 rounded text-white text-xs" style={{ background: "#7c3aed" }}>
                      Commander maintenant →
                    </Link>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      </section>
    </main>
  );
}
