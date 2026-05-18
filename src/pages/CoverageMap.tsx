/**
 * CoverageMap — Interactive coverage map with stats, search & service breakdown.
 * Public route /couverture.
 */
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Link } from "react-router-dom";
import { backendClient } from "@/integrations/backend/client";
import { quebecCities } from "@/data/quebecCities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MapPin, Locate, Wifi, Tv, Smartphone, CheckCircle2, ArrowRight, Search } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";

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
  if (z.internet_available && z.tv_available && z.mobile_available) return "#7c3aed";
  if (z.internet_available && z.tv_available) return "#10b981";
  if (z.internet_available) return "#2563eb";
  return "#94a3b8";
}

function FlyToControl({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => { if (target) map.setView(target, 12); }, [target, map]);
  return null;
}

export default function CoverageMap() {
  const { language } = useLanguage();
  const isFr = language === "fr";
  const [zones, setZones] = useState<Zone[]>([]);
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<[number, number] | null>(null);
  const [resultMsg, setResultMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await backendClient.from("service_coverage_areas").select("*").eq("is_active", true);
      setZones((data as Zone[]) || []);
    })();
  }, []);

  const points = useMemo(() => zones.map((z) => {
    const slug = citySlug(z.city || "");
    const geo = quebecCities[slug];
    return geo ? { ...z, lat: geo.lat, lng: geo.lng } : null;
  }).filter(Boolean) as (Zone & { lat: number; lng: number })[], [zones]);

  const stats = useMemo(() => ({
    cities: zones.length,
    internet: zones.filter(z => z.internet_available).length,
    tv: zones.filter(z => z.tv_available).length,
    mobile: zones.filter(z => z.mobile_available).length,
  }), [zones]);

  const handleSearch = () => {
    const q = search.trim();
    if (!q) return;
    const slug = citySlug(q);
    const geo = quebecCities[slug];
    const match = points.find((p) => citySlug(p.city) === slug || p.city.toLowerCase().includes(q.toLowerCase()));
    if (geo) setTarget([geo.lat, geo.lng]);
    else if (match) setTarget([match.lat, match.lng]);

    if (match) {
      const services = [
        match.internet_available && (isFr ? "Internet" : "Internet"),
        match.tv_available && (isFr ? "TV" : "TV"),
        match.mobile_available && (isFr ? "Mobile" : "Mobile"),
      ].filter(Boolean).join(" · ");
      setResultMsg({ ok: true, text: isFr
        ? `Disponible à ${match.city} : ${services || "à venir"}`
        : `Available in ${match.city}: ${services || "coming soon"}` });
    } else {
      setResultMsg({ ok: false, text: isFr
        ? `Aucune couverture trouvée pour « ${q} ». Contactez-nous pour confirmer.`
        : `No coverage found for "${q}". Contact us to confirm.` });
    }
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => setTarget([pos.coords.latitude, pos.coords.longitude]));
  };

  return (
    <>
      <Header />
      <main className="bg-white">
        {/* Hero */}
        <section className="px-5 sm:px-10" style={{ background: "linear-gradient(180deg, #F7F4FF 0%, #FFFFFF 100%)", paddingTop: 56, paddingBottom: 48 }}>
          <div className="max-w-[1100px] mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-5" style={{ background: "#F3EEFF", borderRadius: 50 }}>
              <MapPin className="w-4 h-4" style={{ color: "#7C3AED" }} />
              <span className="font-bold uppercase" style={{ color: "#7C3AED", fontSize: 11, letterSpacing: 2 }}>
                {isFr ? "Couverture Nivra" : "Nivra Coverage"}
              </span>
            </div>
            <h1 className="font-extrabold mb-4" style={{ color: "#0D0D0D", fontSize: "clamp(28px, 5vw, 44px)", letterSpacing: "-1px", lineHeight: 1.1 }}>
              {isFr ? "Vérifiez la couverture à votre adresse" : "Check coverage at your address"}
            </h1>
            <p className="max-w-2xl mx-auto mb-8" style={{ color: "#555", fontSize: 17, lineHeight: 1.6 }}>
              {isFr
                ? "Internet, TV et Mobile disponibles partout au Québec. Recherchez votre ville pour confirmer l'éligibilité en quelques secondes."
                : "Internet, TV and Mobile available across Quebec. Search your city to confirm eligibility in seconds."}
            </p>

            {/* Search card */}
            <div className="max-w-2xl mx-auto p-2 flex flex-col sm:flex-row gap-2"
              style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 20px 50px -20px rgba(124,58,237,0.25), 0 4px 12px rgba(0,0,0,0.05)", border: "1px solid #ECECEC" }}>
              <div className="flex items-center gap-2 flex-1 px-4">
                <Search className="w-4 h-4 shrink-0" style={{ color: "#999" }} />
                <Input
                  placeholder={isFr ? "Entrez votre ville (Montréal, Québec, Laval…)" : "Enter your city (Montreal, Quebec, Laval…)"}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="border-0 shadow-none focus-visible:ring-0 px-0 h-12 text-base"
                />
              </div>
              <Button onClick={handleSearch} className="h-12 px-6 font-bold" style={{ background: "#7C3AED", borderRadius: 50 }}>
                {isFr ? "Vérifier" : "Check"}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <Button onClick={handleGeolocate} variant="outline" className="h-12 px-4" style={{ borderRadius: 50 }}>
                <Locate className="w-4 h-4 mr-1" /> {isFr ? "Ma position" : "My location"}
              </Button>
            </div>

            {resultMsg && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 max-w-xl text-sm"
                style={{
                  background: resultMsg.ok ? "#ECFDF5" : "#FEF2F2",
                  color: resultMsg.ok ? "#065F46" : "#991B1B",
                  borderRadius: 12, border: `1px solid ${resultMsg.ok ? "#A7F3D0" : "#FECACA"}`,
                }}>
                {resultMsg.ok && <CheckCircle2 className="w-4 h-4" />}
                <span className="font-medium">{resultMsg.text}</span>
              </div>
            )}
          </div>
        </section>

        {/* Stats */}
        <section className="px-5 sm:px-10 py-10" style={{ background: "#FFFFFF" }}>
          <div className="max-w-[1100px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: MapPin, label: isFr ? "Villes desservies" : "Cities served", value: stats.cities, color: "#7C3AED" },
              { icon: Wifi, label: "Internet", value: stats.internet, color: "#2563EB" },
              { icon: Tv, label: "TV", value: stats.tv, color: "#10B981" },
              { icon: Smartphone, label: "Mobile", value: stats.mobile, color: "#F59E0B" },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="p-5 text-center" style={{ background: "#FAFAFB", border: "1px solid #ECECEC", borderRadius: 16 }}>
                  <div className="inline-flex items-center justify-center mb-2" style={{ width: 44, height: 44, borderRadius: 12, background: `${s.color}15` }}>
                    <Icon className="w-5 h-5" style={{ color: s.color }} />
                  </div>
                  <div className="font-extrabold" style={{ color: "#0D0D0D", fontSize: 28, letterSpacing: "-0.5px" }}>{s.value}</div>
                  <div style={{ color: "#666", fontSize: 13, marginTop: 2 }}>{s.label}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Map */}
        <section className="px-5 sm:px-10 pb-12">
          <div className="max-w-[1100px] mx-auto">
            <Card className="p-3 sm:p-4" style={{ borderRadius: 20, border: "1px solid #ECECEC", boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
              <div className="flex flex-wrap gap-3 mb-3 text-xs px-2">
                {[
                  { c: "#7c3aed", l: isFr ? "Service complet" : "Full service" },
                  { c: "#10b981", l: "Internet + TV" },
                  { c: "#2563eb", l: "Internet" },
                  { c: "#94a3b8", l: isFr ? "À venir" : "Coming soon" },
                ].map((x, i) => (
                  <span key={i} className="flex items-center gap-1.5 font-medium" style={{ color: "#555" }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: x.c }} />{x.l}
                  </span>
                ))}
              </div>
              <div className="rounded-2xl overflow-hidden" style={{ height: "60vh", minHeight: 420, border: "1px solid #EEE" }}>
                <MapContainer center={[46.8, -71.5]} zoom={6} style={{ height: "100%", width: "100%" }}>
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <FlyToControl target={target} />
                  {points.map((p) => (
                    <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={10} pathOptions={{ color: colorFor(p), fillColor: colorFor(p), fillOpacity: 0.65 }}>
                      <Popup>
                        <div className="text-sm">
                          <p className="font-semibold">{p.city}, {p.province}</p>
                          {p.postal_prefix && <p className="text-xs text-slate-500">{isFr ? "Préfixe postal" : "Postal prefix"} : {p.postal_prefix}</p>}
                          <ul className="mt-2 text-xs space-y-0.5">
                            <li>Internet : {p.internet_available ? "✓" : "—"}</li>
                            <li>TV : {p.tv_available ? "✓" : "—"}</li>
                            <li>Mobile : {p.mobile_available ? "✓" : "—"}</li>
                          </ul>
                          <Link to="/commander" className="block mt-2 text-center px-3 py-1.5 rounded text-white text-xs font-semibold" style={{ background: "#7c3aed" }}>
                            {isFr ? "Commander →" : "Order →"}
                          </Link>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </div>
            </Card>
          </div>
        </section>

        {/* CTA */}
        <section className="px-5 sm:px-10 pb-16">
          <div className="max-w-[1100px] mx-auto p-8 sm:p-10 text-center" style={{
            background: "linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)",
            borderRadius: 24,
            color: "#FFFFFF",
            boxShadow: "0 20px 60px -20px rgba(124,58,237,0.5)",
          }}>
            <h2 className="font-extrabold mb-3" style={{ fontSize: "clamp(22px, 3.5vw, 32px)", letterSpacing: "-0.5px" }}>
              {isFr ? "Couvert ? Activez en 10 minutes." : "Covered? Get activated in 10 minutes."}
            </h2>
            <p className="mb-6 max-w-xl mx-auto" style={{ opacity: 0.9, fontSize: 16 }}>
              {isFr ? "Sans contrat, sans vérification de crédit. Premier mois offert." : "No contract, no credit check. First month free."}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/commander" className="inline-flex items-center gap-2 px-6 py-3 font-bold"
                style={{ background: "#FFFFFF", color: "#7C3AED", borderRadius: 50 }}>
                {isFr ? "Commander maintenant" : "Order now"} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/contact" className="inline-flex items-center gap-2 px-6 py-3 font-bold"
                style={{ background: "rgba(255,255,255,0.12)", color: "#FFFFFF", borderRadius: 50, border: "1px solid rgba(255,255,255,0.3)" }}>
                {isFr ? "Parler à un conseiller" : "Talk to an advisor"}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
