/**
 * CoverageMap — Interactive coverage map with stats, search & service breakdown.
 * Public route /couverture.
 */
import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, Circle, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Link, useSearchParams } from "react-router-dom";
import { backendClient } from "@/integrations/backend/client";
import { quebecCities } from "@/data/quebecCities";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, Wifi, Tv, Smartphone, CheckCircle2, ArrowRight, Mail, Loader2, AlertTriangle } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import AddressAutocomplete, { type AddressValue } from "@/components/shared/AddressAutocomplete";

// ─── Coverage zones (radius in metres) ────────────────────────────────────────
const COVERAGE_ZONES = [
  // Grand Montréal
  { name: "Montréal",       lat: 45.5017, lng: -73.5673, radius: 35000 },
  { name: "Laval",          lat: 45.6066, lng: -73.7124, radius: 18000 },
  { name: "Longueuil",      lat: 45.5315, lng: -73.5185, radius: 15000 },
  { name: "Repentigny",     lat: 45.7399, lng: -73.4600, radius: 10000 },
  { name: "Terrebonne",     lat: 45.7051, lng: -73.6452, radius: 12000 },
  { name: "Saint-Jérôme",   lat: 45.7766, lng: -74.0025, radius: 10000 },
  { name: "Blainville",     lat: 45.6699, lng: -73.8800, radius:  8000 },
  { name: "Brossard",       lat: 45.4607, lng: -73.4643, radius: 10000 },
  { name: "Châteauguay",    lat: 45.3800, lng: -73.7500, radius:  8000 },
  { name: "Chambly",        lat: 45.4500, lng: -73.2833, radius:  6000 },
  { name: "Joliette",       lat: 46.0170, lng: -73.4400, radius:  8000 },
  // Capitale-Nationale
  { name: "Québec",         lat: 46.8139, lng: -71.2080, radius: 25000 },
  { name: "Lévis",          lat: 46.7100, lng: -71.1756, radius: 12000 },
  // Outaouais
  { name: "Gatineau",       lat: 45.4765, lng: -75.7013, radius: 20000 },
  // Autres centres
  { name: "Sherbrooke",     lat: 45.4042, lng: -71.8929, radius: 15000 },
  { name: "Saguenay",       lat: 48.4284, lng: -71.0537, radius: 15000 },
  { name: "Trois-Rivières", lat: 46.3432, lng: -72.5418, radius: 12000 },
  { name: "Drummondville",  lat: 45.8833, lng: -72.4833, radius:  8000 },
  { name: "Granby",         lat: 45.4000, lng: -72.7333, radius:  8000 },
  { name: "Saint-Hyacinthe",lat: 45.6167, lng: -72.9500, radius:  8000 },
  { name: "Rouyn-Noranda",  lat: 48.2333, lng: -79.0167, radius:  8000 },
  { name: "Val-d'Or",       lat: 48.1000, lng: -77.7833, radius:  6000 },
  { name: "Rimouski",       lat: 48.4478, lng: -68.5290, radius:  8000 },
];

// ─── Coverage regions ─────────────────────────────────────────────────────────
const REGIONS = [
  {
    label: "Grand Montréal",
    cities: "Montréal, Laval, Longueuil, Brossard, Repentigny, Terrebonne, Mascouche, Blainville, Sainte-Thérèse, Saint-Jérôme, Mirabel, Anjou, Saint-Léonard, Montréal-Nord, Saint-Laurent, Verdun, LaSalle, Côte-Saint-Luc, Mont-Royal, Westmount, Outremont, Rosemont, Pierrefonds, Dollard-des-Ormeaux, Kirkland, Beaconsfield, Pointe-Claire, Dorval, Châteauguay, Chambly, Saint-Bruno-de-Montarville, Sainte-Julie, Varennes, L'Assomption, Joliette, Boisbriand, Rosemère, Lorraine, Deux-Montagnes, Sainte-Marthe-sur-Lac",
  },
  {
    label: "Capitale-Nationale",
    cities: "Québec (toutes arrondissements), Lévis, Sainte-Foy, Charlesbourg, Beauport, Loretteville, Cap-Rouge, Ancienne-Lorette, Saint-Augustin",
  },
  {
    label: "Outaouais",
    cities: "Gatineau, Hull, Aylmer, Buckingham, Masson-Angers",
  },
  {
    label: "Autres grands centres",
    cities: "Sherbrooke, Saguenay (Chicoutimi, Jonquière, La Baie), Trois-Rivières, Cap-de-la-Madeleine, Shawinigan, Drummondville, Saint-Hyacinthe, Granby, Saint-Jean-sur-Richelieu, Sorel-Tracy, Victoriaville, Rimouski, Sept-Îles, Rouyn-Noranda, Val-d'Or, Salaberry-de-Valleyfield, Lachute, Mont-Laurier, Saint-Sauveur, Sainte-Agathe-des-Monts",
  },
];

// ─── Plan cards ───────────────────────────────────────────────────────────────
const PLANS = [
  {
    title: "Internet GIGA",
    speed: "940 Mbps",
    price: "60$",
    period: "/mois",
    badge: null,
    features: [
      "Vitesse de téléchargement 940 Mbps",
      "WiFi haute performance inclus",
      "Sans contrat, sans engagement",
      "Activation en 24-48h",
      "Support en français",
    ],
  },
  {
    title: "Bundle GIGA + TV",
    speed: null,
    price: "100$",
    period: "/mois",
    badge: "POPULAIRE",
    features: [
      "Internet GIGA 940 Mbps",
      "TV 25 chaînes au choix",
      "Terminal TV 4K inclus",
      "Sans contrat, sans engagement",
      "Activation en 24-48h",
    ],
  },
  {
    title: "Mobile",
    speed: null,
    price: "60$",
    period: "/30 jours",
    badge: null,
    features: [
      "75 Go de données 4G",
      "Appels et SMS illimités Canada",
      "Sans vérification de crédit",
      "Activation immédiate",
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

type CheckResult = { ok: true; city: string } | { ok: false; query: string; postalCode?: string } | null;

function citySlug(c: string) {
  return c.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function colorFor(z: Zone): string {
  if (z.internet_available && z.tv_available && z.mobile_available) return "#7c3aed";
  if (z.internet_available && z.tv_available) return "#10b981";
  if (z.internet_available) return "#2563eb";
  return "#94a3b8";
}

function FlyToControl({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => { if (target) map.setView(target, 11); }, [target, map]);
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function CoverageMap() {
  const { language } = useLanguage();
  const isFr = language === "fr";
  const [searchParams] = useSearchParams();

  const [zones, setZones] = useState<Zone[]>([]);
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<[number, number] | null>(null);
  const [checkResult, setCheckResult] = useState<CheckResult>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);

  // Waitlist state
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistDone, setWaitlistDone] = useState(false);
  const [waitlistError, setWaitlistError] = useState("");

  useEffect(() => {
    const address = searchParams.get("address");
    if (address) setSearch(address);
  }, [searchParams]);

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

  const handleSearch = (forcedQuery?: string, postalCode?: string) => {
    const q = (forcedQuery ?? search).trim();
    if (!q) return;
    const slug = citySlug(q);
    const geo = quebecCities[slug];
    const lowerQ = q.toLowerCase();
    const match = points.find((p) => {
      const city = p.city.toLowerCase();
      return citySlug(p.city) === slug || city.includes(lowerQ) || lowerQ.includes(city);
    });

    if (geo) setTarget([geo.lat, geo.lng]);
    else if (match) setTarget([match.lat, match.lng]);

    if (match) {
      setCheckResult({ ok: true, city: match.city });
    } else {
      setCheckResult({ ok: false, query: q, postalCode });
    }
  };

  const handleAddressSelect = (address: AddressValue) => {
    const label = address.formatted || [address.line1, address.city, address.postalCode].filter(Boolean).join(", ");
    setSearch(label);
    if (address.lat !== undefined && address.lng !== undefined) setTarget([address.lat, address.lng]);
    if (address.city) handleSearch(address.city, address.postalCode);
  };

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail.trim()) return;
    setWaitlistLoading(true);
    setWaitlistError("");
    const city = checkResult?.ok === false ? checkResult.query : undefined;
    const postalCode = checkResult?.ok === false ? checkResult.postalCode : undefined;
    const { error } = await backendClient.from("coverage_waitlist").insert({
      email: waitlistEmail.trim(),
      city: city || null,
      postal_code: postalCode || null,
    });
    setWaitlistLoading(false);
    if (error) {
      setWaitlistError("Une erreur est survenue. Veuillez réessayer.");
    } else {
      setWaitlistDone(true);
    }
  };

  return (
    <>
      <Header />
      <main style={{ background: "#020209" }}>

        <style>{`
          @keyframes coverage-pulse {
            0%, 100% { fill-opacity: 0.12; stroke-opacity: 0.5; }
            50%       { fill-opacity: 0.22; stroke-opacity: 0.8; }
          }
          .coverage-zone-circle { animation: coverage-pulse 3s ease-in-out infinite; }
          .coverage-zone-circle-hover { fill-opacity: 0.25 !important; stroke-opacity: 1 !important; }
          .leaflet-tooltip.coverage-tip {
            background: #1A1A2E; border: 1px solid rgba(124,58,237,0.5);
            color: #fff; font-size: 13px; padding: 6px 10px; border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4);
          }
          .leaflet-tooltip.coverage-tip::before { display: none; }
        `}</style>

        {/* ── Hero ── */}
        <section className="relative overflow-hidden px-5 sm:px-10" style={{ paddingTop: 100, paddingBottom: 60 }}>
          <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 550, height: 550, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)', animation: 'n-aurora-1 18s ease-in-out infinite', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)', animation: 'n-aurora-2 14s ease-in-out infinite', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)', backgroundSize: '80px 80px', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.4), rgba(6,182,212,0.4), transparent)', animation: 'n-scanline 10s linear infinite', pointerEvents: 'none' }} />

          <div className="max-w-[1100px] mx-auto text-center" style={{ position: 'relative', zIndex: 2 }}>
            <div className="n-animate-in inline-flex items-center gap-2 px-4 py-1.5 mb-5" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.35)", borderRadius: 100 }}>
              <MapPin className="w-4 h-4" style={{ color: "#A78BFA" }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#A78BFA", fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
                {isFr ? "Couverture Nivra Telecom" : "Nivra Telecom Coverage"}
              </span>
            </div>

            <h1 className="n-animate-in-delay-1 mb-4 text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: "clamp(30px, 5vw, 52px)", letterSpacing: "-2.5px", lineHeight: 1.0 }}>
              {isFr ? <>Vérifiez la couverture{' '}<span className="n-shimmer-text">à votre adresse</span></> : <>Check coverage{' '}<span className="n-shimmer-text">at your address</span></>}
            </h1>
            <p className="n-animate-in-delay-2 max-w-2xl mx-auto mb-8" style={{ color: "rgba(255,255,255,0.6)", fontSize: 17, lineHeight: 1.6 }}>
              {isFr
                ? "Service Internet, TV et Mobile disponible dans 22+ villes du Québec. Vérifiez dès maintenant."
                : "Internet, TV & Mobile service in 22+ Quebec cities. Check availability now."}
            </p>

            {/* Search bar */}
            <div className="max-w-2xl mx-auto p-2 flex flex-col sm:flex-row gap-2 mb-6"
              style={{ background: "rgba(255,255,255,0.05)", borderRadius: 20, boxShadow: "0 20px 50px -20px rgba(124,58,237,0.25)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="flex-1">
                <AddressAutocomplete
                  value={search}
                  onValueChange={setSearch}
                  onSelect={handleAddressSelect}
                  restrictToQuebec
                  placeholder={isFr ? "Entrez votre adresse au Québec" : "Enter your Quebec address"}
                  className="h-12 border-0 shadow-none focus-visible:ring-0 text-base bg-transparent text-white placeholder:text-white/40"
                />
              </div>
              <Button onClick={() => handleSearch()} className="h-12 px-6 font-bold shrink-0" style={{ background: "#7C3AED", borderRadius: 50 }}>
                {isFr ? "Vérifier" : "Check"}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>

            {/* ── Result: available ── */}
            {checkResult?.ok === true && (
              <div className="text-left">
                {/* Success banner */}
                <div className="flex items-center gap-3 p-4 mb-6 max-w-2xl mx-auto" style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.35)", borderRadius: 14 }}>
                  <CheckCircle2 className="w-6 h-6 shrink-0" style={{ color: "#10B981" }} />
                  <div>
                    <p className="font-bold text-white" style={{ fontSize: 16 }}>
                      Excellent ! Le service Nivra Telecom est disponible à votre adresse.
                    </p>
                    <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, marginTop: 2 }}>
                      Zone desservie : <strong style={{ color: "#6EE7B7" }}>{checkResult.city}</strong>
                    </p>
                  </div>
                </div>

                {/* Plan cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto mb-5">
                  {PLANS.map((plan, i) => (
                    <div key={i} className="relative flex flex-col p-6" style={{
                      background: plan.badge ? "linear-gradient(135deg,#2D1B69 0%,#1A1A2E 100%)" : "rgba(255,255,255,0.04)",
                      border: plan.badge ? "1px solid rgba(124,58,237,0.6)" : "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 16,
                      boxShadow: plan.badge ? "0 0 30px -10px rgba(124,58,237,0.4)" : "none",
                    }}>
                      {plan.badge && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-bold" style={{ background: "#7C3AED", color: "#fff", borderRadius: 50, letterSpacing: 1 }}>
                          {plan.badge}
                        </span>
                      )}
                      <div className="mb-4">
                        <p className="font-bold text-white mb-1" style={{ fontSize: 17 }}>{plan.title}</p>
                        {plan.speed && <p style={{ color: "#A78BFA", fontSize: 13 }}>{plan.speed}</p>}
                        <div className="mt-3 flex items-baseline gap-1">
                          <span className="font-extrabold text-white" style={{ fontSize: 30, letterSpacing: "-1px" }}>{plan.price}</span>
                          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>{plan.period}</span>
                        </div>
                      </div>
                      <ul className="space-y-2 flex-1 mb-5">
                        {plan.features.map((f, j) => (
                          <li key={j} className="flex items-start gap-2" style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#10B981" }} />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <Link
                        to="/commander"
                        className="block text-center py-2.5 font-bold rounded-full"
                        style={{ background: plan.badge ? "#7C3AED" : "rgba(124,58,237,0.2)", color: "#fff", border: plan.badge ? "none" : "1px solid rgba(124,58,237,0.4)", fontSize: 14 }}
                      >
                        Commander →
                      </Link>
                    </div>
                  ))}
                </div>

                <p className="text-center" style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>
                  Questions ? Appelez-nous : <a href="tel:+18447223112" className="font-semibold" style={{ color: "#A78BFA" }}>(844) 722-3112</a>
                </p>
              </div>
            )}

            {/* ── Result: not available → waitlist ── */}
            {checkResult?.ok === false && (
              <div className="max-w-xl mx-auto">
                <div className="p-5 mb-4" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 14 }}>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: "#FCD34D" }} />
                    <p className="font-bold" style={{ color: "#FCD34D", fontSize: 15 }}>
                      Le service n'est pas encore disponible dans votre secteur.
                    </p>
                  </div>
                  <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, lineHeight: 1.6 }}>
                    Laissez-nous votre courriel et nous vous aviserons lors de l'expansion dans votre région.
                  </p>
                </div>

                {!waitlistDone ? (
                  <form onSubmit={handleWaitlist} className="flex gap-2">
                    <div className="flex-1 flex items-center gap-2 px-4" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12 }}>
                      <Mail className="w-4 h-4 shrink-0" style={{ color: "#A78BFA" }} />
                      <input
                        type="email"
                        required
                        value={waitlistEmail}
                        onChange={e => setWaitlistEmail(e.target.value)}
                        placeholder="votre@courriel.ca"
                        className="flex-1 bg-transparent text-white outline-none py-3"
                        style={{ fontSize: 14, border: "none" }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={waitlistLoading}
                      className="px-5 py-3 font-bold rounded-xl shrink-0 flex items-center gap-2"
                      style={{ background: "#7C3AED", color: "#fff", border: "none", cursor: waitlistLoading ? "not-allowed" : "pointer", opacity: waitlistLoading ? 0.7 : 1, fontSize: 14 }}
                    >
                      {waitlistLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                      M'aviser
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2 p-4" style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 12 }}>
                    <CheckCircle2 className="w-5 h-5" style={{ color: "#10B981" }} />
                    <p style={{ color: "#6EE7B7", fontSize: 14, fontWeight: 600 }}>Merci ! Vous serez avisé(e) dès que le service sera disponible.</p>
                  </div>
                )}

                {waitlistError && (
                  <p className="mt-2 text-center" style={{ color: "#FCA5A5", fontSize: 13 }}>{waitlistError}</p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── Stats bar ── */}
        <section className="px-5 sm:px-10 py-8" style={{ background: "#020209", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="max-w-[1100px] mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: MapPin,     value: "22+",      label: isFr ? "Villes desservies" : "Cities served",        color: "#A78BFA" },
              { icon: Smartphone, value: "500 000+", label: isFr ? "Résidents couverts" : "Residents covered",   color: "#60A5FA" },
              { icon: Wifi,       value: "940 Mbps", label: isFr ? "Vitesse maximale" : "Max speed",             color: "#34D399" },
              { icon: Tv,         value: isFr ? "Sans contrat" : "No contract", label: isFr ? "Ni engagement" : "No commitment", color: "#FBBF24" },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="p-5 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16 }}>
                  <div className="inline-flex items-center justify-center mb-2" style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(124,58,237,0.15)" }}>
                    <Icon className="w-5 h-5" style={{ color: s.color }} />
                  </div>
                  <div className="font-extrabold text-white" style={{ fontSize: 22, letterSpacing: "-0.5px" }}>{s.value}</div>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 2 }}>{s.label}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Map ── */}
        <section className="px-5 sm:px-10 pb-12 pt-8" style={{ background: "#020209" }}>
          <div className="max-w-[1100px] mx-auto">
            <Card className="p-3 sm:p-4" style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}>
              <div className="flex flex-wrap gap-3 mb-3 text-xs px-2 items-center justify-between">
                <div className="flex flex-wrap gap-4">
                  {[
                    { c: "#7C3AED", l: isFr ? "Zones de couverture Nivra" : "Nivra coverage zones" },
                    { c: "#A78BFA", l: isFr ? "Service complet" : "Full service" },
                    { c: "#34D399", l: "Internet + TV" },
                    { c: "#60A5FA", l: "Internet" },
                  ].map((x, i) => (
                    <span key={i} className="flex items-center gap-1.5 font-medium" style={{ color: "rgba(255,255,255,0.55)" }}>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: x.c }} />{x.l}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden" style={{ height: "62vh", minHeight: 440, border: "1px solid rgba(255,255,255,0.08)" }}>
                <MapContainer center={[46.2, -73.2]} zoom={7} style={{ height: "100%", width: "100%" }}>
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <FlyToControl target={target} />

                  {/* Violet coverage zone circles */}
                  {COVERAGE_ZONES.map((z) => (
                    <Circle
                      key={z.name}
                      center={[z.lat, z.lng]}
                      radius={z.radius}
                      pathOptions={{
                        color: "rgba(124,58,237,0.5)",
                        weight: 2,
                        fillColor: "#7C3AED",
                        fillOpacity: hoveredZone === z.name ? 0.25 : 0.12,
                        className: hoveredZone === z.name ? "" : "coverage-zone-circle",
                      }}
                      eventHandlers={{
                        mouseover: () => setHoveredZone(z.name),
                        mouseout: () => setHoveredZone(null),
                      }}
                    >
                      <Tooltip direction="top" className="coverage-tip">
                        <strong>{z.name}</strong><br />
                        <span style={{ color: "#A78BFA" }}>✓ Service disponible</span>
                      </Tooltip>
                    </Circle>
                  ))}

                  {/* DB-driven service markers */}
                  {points.map((p) => (
                    <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={8} pathOptions={{ color: colorFor(p), fillColor: colorFor(p), fillOpacity: 0.7 }}>
                      <Popup>
                        <div className="text-sm">
                          <p className="font-semibold">{p.city}, {p.province}</p>
                          {p.postal_prefix && <p className="text-xs text-slate-500">{isFr ? "Préfixe postal" : "Postal prefix"}: {p.postal_prefix}</p>}
                          <ul className="mt-2 text-xs space-y-0.5">
                            <li>Internet : {p.internet_available ? "✓" : "—"}</li>
                            <li>TV : {p.tv_available ? "✓" : "—"}</li>
                            <li>Mobile : {p.mobile_available ? "✓" : "—"}</li>
                          </ul>
                          <Link to="/commander" className="block mt-2 text-center px-3 py-1.5 rounded text-white text-xs font-semibold" style={{ background: "#7C3AED" }}>
                            {isFr ? "Commander →" : "Order →"}
                          </Link>
                        </div>
                      </Popup>
                    </CircleMarker>
                  ))}
                </MapContainer>
              </div>

              {/* Legend */}
              <div className="mt-3 px-2 flex items-center gap-2">
                <span style={{ color: "#7C3AED", fontSize: 16, lineHeight: 1 }}>&#9899;</span>
                <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 12, fontWeight: 500 }}>
                  Zones de service Nivra Telecom — survolez une zone pour les détails
                </span>
              </div>
            </Card>
          </div>
        </section>

        {/* ── Coverage Regions ── */}
        <section className="px-5 sm:px-10 pb-12" style={{ background: "#020209", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="max-w-[1100px] mx-auto pt-10">
            <div className="mb-8 text-center">
              <h2 className="font-extrabold text-white mb-2" style={{ fontSize: "clamp(20px,3vw,28px)", letterSpacing: "-0.5px" }}>
                {isFr ? "Régions desservies" : "Service Regions"}
              </h2>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15 }}>
                {isFr ? "Couverture complète dans les principales agglomérations du Québec" : "Full coverage in Quebec's main urban areas"}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              {REGIONS.map((r, i) => (
                <div key={i} className="flex gap-4 p-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 14 }}>
                  <div className="shrink-0 mt-1.5 rounded-full" style={{ background: "#7C3AED", width: 8, height: 8, flexShrink: 0, marginTop: 6 }} />
                  <div>
                    <p className="font-bold text-white mb-1" style={{ fontSize: 14 }}>{r.label}</p>
                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.6 }}>{r.cities}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Expansion zones */}
            <div className="p-4" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 12 }}>
              <div className="flex gap-3">
                <span style={{ color: "#A78BFA", fontSize: 16, flexShrink: 0 }}>&#9432;</span>
                <div>
                  <p className="font-semibold mb-1" style={{ color: "#C4B5FD", fontSize: 13 }}>
                    {isFr ? "Zones en expansion — Tier 2" : "Expansion Zones — Tier 2"}
                  </p>
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.6 }}>
                    {isFr
                      ? "Grâce à des projets d'expansion actifs, les services s'étendent à : Abitibi-Témiscamingue, Bas-Saint-Laurent, Gaspésie, Côte-Nord (partielle). Ces régions seront couvertes progressivement."
                      : "Through active expansion projects, services are extending to: Abitibi-Témiscamingue, Bas-Saint-Laurent, Gaspésie, Côte-Nord (partial). These regions will be progressively covered."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="px-5 sm:px-10 pb-16 pt-8" style={{ background: "#020209" }}>
          <div className="max-w-[1100px] mx-auto p-8 sm:p-10 text-center" style={{
            background: "linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)",
            borderRadius: 24,
            boxShadow: "0 20px 60px -20px rgba(124,58,237,0.5)",
          }}>
            <h2 className="font-extrabold mb-3 text-white" style={{ fontSize: "clamp(22px, 3.5vw, 32px)", letterSpacing: "-0.5px" }}>
              {isFr ? "Couvert ? Activez en 10 minutes." : "Covered? Get activated in 10 minutes."}
            </h2>
            <p className="mb-6 max-w-xl mx-auto text-white" style={{ opacity: 0.85, fontSize: 16 }}>
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
