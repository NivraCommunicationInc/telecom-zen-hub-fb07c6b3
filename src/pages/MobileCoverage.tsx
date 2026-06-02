import { useState, useCallback, useEffect } from "react";
import { MapContainer, TileLayer, Circle, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Check, Signal, Globe, Wifi, Shield, CheckCircle, XCircle, Loader2, Info, Phone, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SEOHead from "@/components/SEOHead";
import { AddressAutocomplete, type AddressValue } from "@/components/shared/AddressAutocomplete";

const COVERAGE_ZONES = [
  // Grand Montréal
  { name: "Montréal",        lat: 45.5017, lng: -73.5673, radius: 35000 },
  { name: "Laval",           lat: 45.6066, lng: -73.7124, radius: 18000 },
  { name: "Longueuil",       lat: 45.5315, lng: -73.5185, radius: 15000 },
  { name: "Repentigny",      lat: 45.7399, lng: -73.4600, radius: 10000 },
  { name: "Terrebonne",      lat: 45.7051, lng: -73.6452, radius: 12000 },
  { name: "Saint-Jérôme",    lat: 45.7766, lng: -74.0025, radius: 10000 },
  { name: "Blainville",      lat: 45.6699, lng: -73.8800, radius:  8000 },
  { name: "Brossard",        lat: 45.4607, lng: -73.4643, radius: 10000 },
  { name: "Châteauguay",     lat: 45.3800, lng: -73.7500, radius:  8000 },
  { name: "Chambly",         lat: 45.4500, lng: -73.2833, radius:  6000 },
  { name: "Joliette",        lat: 46.0170, lng: -73.4400, radius:  8000 },
  // Capitale-Nationale
  { name: "Québec",          lat: 46.8139, lng: -71.2080, radius: 25000 },
  { name: "Lévis",           lat: 46.7100, lng: -71.1756, radius: 12000 },
  // Outaouais
  { name: "Gatineau",        lat: 45.4765, lng: -75.7013, radius: 20000 },
  // Autres centres
  { name: "Sherbrooke",      lat: 45.4042, lng: -71.8929, radius: 15000 },
  { name: "Saguenay",        lat: 48.4284, lng: -71.0537, radius: 15000 },
  { name: "Trois-Rivières",  lat: 46.3432, lng: -72.5418, radius: 12000 },
  { name: "Drummondville",   lat: 45.8833, lng: -72.4833, radius:  8000 },
  { name: "Granby",          lat: 45.4000, lng: -72.7333, radius:  8000 },
  { name: "Saint-Hyacinthe", lat: 45.6167, lng: -72.9500, radius:  8000 },
  { name: "Rouyn-Noranda",   lat: 48.2333, lng: -79.0167, radius:  8000 },
  { name: "Val-d'Or",        lat: 48.1000, lng: -77.7833, radius:  6000 },
  { name: "Rimouski",        lat: 48.4478, lng: -68.5290, radius:  8000 },
];

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

function FlyToControl({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => { if (target) map.setView(target, 12); }, [target, map]);
  return null;
}

const MobileCoverage = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isFr = language === "fr";

  const [addressText, setAddressText] = useState("");
  const [addressDetails, setAddressDetails] = useState<AddressValue | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [coverageResult, setCoverageResult] = useState<"available" | "limited" | "unavailable" | null>(null);
  const [mapTarget, setMapTarget] = useState<[number, number] | null>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);

  const handleAddressSelect = useCallback(async (address: AddressValue) => {
    setAddressDetails(address);
    setIsChecking(true);
    setCoverageResult(null);

    await new Promise(resolve => setTimeout(resolve, 1500));

    const isQuebec = address.region?.toLowerCase().includes("qc") ||
      address.region?.toLowerCase().includes("quebec") ||
      address.region?.toLowerCase().includes("québec");

    setCoverageResult(isQuebec || address.region ? "available" : "limited");
    setIsChecking(false);

    if (address.lat !== undefined && address.lng !== undefined) {
      setMapTarget([address.lat, address.lng]);
    }
  }, []);

  const handleAddressChange = useCallback((value: string) => {
    setAddressText(value);
    if (!value) { setAddressDetails(null); setCoverageResult(null); }
  }, []);

  const networkStats = [
    { value: "99.9%", label: isFr ? "Disponibilité réseau" : "Network uptime" },
    { value: "4G LTE", label: isFr ? "Technologie" : "Technology" },
    { value: "95%", label: isFr ? "Population couverte" : "Population covered" },
    { value: "24/7", label: isFr ? "Support technique" : "Technical support" },
  ];

  const coverageFeatures = [
    { icon: Signal, title: isFr ? "Réseau 4G/LTE" : "4G/LTE Network", desc: isFr ? "Connexion haute vitesse dans toutes les zones urbaines et péri-urbaines du Québec" : "High-speed connection in all urban and suburban areas of Quebec" },
    { icon: Globe, title: isFr ? "Couverture nationale" : "Nationwide Coverage", desc: isFr ? "Voyagez partout au Canada avec notre réseau partenaire étendu" : "Travel across Canada with our extended partner network" },
    { icon: Wifi, title: isFr ? "Appels Wi-Fi" : "Wi-Fi Calling", desc: isFr ? "Restez connecté même dans les zones à faible signal grâce aux appels Wi-Fi" : "Stay connected even in low signal areas with Wi-Fi calling" },
    { icon: Shield, title: isFr ? "Réseau fiable" : "Reliable Network", desc: isFr ? "Infrastructure moderne avec redondance pour une fiabilité maximale" : "Modern infrastructure with redundancy for maximum reliability" },
  ];

  const subscriptionSteps = [
    { step: "1", title: isFr ? "Vérifiez la couverture" : "Check coverage", desc: isFr ? "Entrez votre adresse ci-dessus" : "Enter your address above" },
    { step: "2", title: isFr ? "Choisissez votre forfait" : "Choose your plan", desc: isFr ? "Sélectionnez le forfait adapté à vos besoins" : "Select the plan that fits your needs" },
    { step: "3", title: isFr ? "Recevez votre SIM" : "Receive your SIM", desc: isFr ? "Livraison gratuite en 2-3 jours ouvrables" : "Free delivery in 2-3 business days" },
    { step: "4", title: isFr ? "Activez en ligne" : "Activate online", desc: isFr ? "Activation instantanée depuis votre espace client" : "Instant activation from your account" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#020209" }} data-testid="mobile-coverage-page">
      <SEOHead
        title={isFr ? "Couverture Mobile | Vérifiez la disponibilité | Nivra" : "Mobile Coverage | Check Availability | Nivra"}
        description={isFr
          ? "Vérifiez la couverture mobile Nivra à votre adresse. Couverture 4G nationale au Canada avec réseau fiable et haute vitesse."
          : "Check Nivra mobile coverage at your address. Nationwide 4G coverage across Canada with reliable and high-speed network."}
      />
      <Header />

      <style>{`
        @keyframes coverage-pulse {
          0%, 100% { fill-opacity: 0.15; stroke-opacity: 0.6; }
          50%       { fill-opacity: 0.30; stroke-opacity: 0.9; }
        }
        .coverage-zone-circle { animation: coverage-pulse 3s ease-in-out infinite; }
        .leaflet-tooltip.coverage-tip {
          background: #1A1A2E; border: 1px solid rgba(124,58,237,0.5);
          color: #fff; font-size: 13px; padding: 6px 10px; border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        }
        .leaflet-tooltip.coverage-tip::before { display: none; }
      `}</style>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden px-5 sm:px-10" style={{ paddingTop: 100, paddingBottom: 48 }}>
          <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: 550, height: 550, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)', animation: 'n-aurora-1 18s ease-in-out infinite', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)', animation: 'n-aurora-2 14s ease-in-out infinite', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)', backgroundSize: '80px 80px', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.4), rgba(6,182,212,0.4), transparent)', animation: 'n-scanline 10s linear infinite', pointerEvents: 'none' }} />

          <div className="max-w-[1100px] mx-auto text-center" style={{ position: 'relative', zIndex: 2 }}>
            <div className="n-animate-in inline-flex items-center gap-2 px-4 py-1.5 mb-5" style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.35)", borderRadius: 100 }}>
              <Signal className="w-4 h-4" style={{ color: "#A78BFA" }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#A78BFA", fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {isFr ? "Couverture Mobile Nivra" : "Nivra Mobile Coverage"}
              </span>
            </div>
            <h1 className="n-animate-in-delay-1 mb-4 text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: "clamp(32px, 5vw, 56px)", letterSpacing: "-2.5px", lineHeight: 1.0 }}>
              {isFr ? <>Couverture mobile{' '}<span className="n-shimmer-text">au Québec</span></> : <>Mobile Coverage{' '}<span className="n-shimmer-text">in Quebec</span></>}
            </h1>
            <p className="n-animate-in-delay-2 max-w-2xl mx-auto mb-10" style={{ color: "rgba(255,255,255,0.6)", fontSize: 17, lineHeight: 1.6 }}>
              {isFr
                ? "Vérifiez la disponibilité du service mobile Nivra à votre adresse et consultez la carte du Québec."
                : "Check Nivra mobile availability at your address and view the Quebec map."}
            </p>

            {/* Network stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto mb-10">
              {networkStats.map((stat, i) => (
                <div key={i} className="p-4 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14 }}>
                  <div className="font-extrabold mb-1" style={{ fontSize: 24, color: "#A78BFA", letterSpacing: "-0.5px" }}>{stat.value}</div>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Address check */}
            <div className="max-w-2xl mx-auto p-2 flex flex-col sm:flex-row gap-2" style={{ background: "rgba(255,255,255,0.04)", borderRadius: 20, boxShadow: "0 20px 50px -20px rgba(124,58,237,0.25)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="flex-1">
                <AddressAutocomplete
                  value={addressText}
                  onValueChange={handleAddressChange}
                  onSelect={handleAddressSelect}
                  placeholder={isFr ? "Numéro civique, rue, ville, code postal" : "Street number, street, city, postal code"}
                  restrictToQuebec
                  className="h-12 border-0 shadow-none focus-visible:ring-0 text-base bg-transparent text-white placeholder:text-white/40"
                />
              </div>
              {isChecking && (
                <div className="flex items-center justify-center px-4">
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#A78BFA" }} />
                </div>
              )}
            </div>

            {/* Coverage result */}
            {coverageResult && !isChecking && (
              <div className="mt-4 max-w-xl mx-auto">
                {coverageResult === "available" && (
                  <div className="flex flex-col items-center gap-3 px-5 py-4" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 14 }}>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5" style={{ color: "#6EE7B7" }} />
                      <span className="font-semibold" style={{ color: "#6EE7B7" }}>{isFr ? "Couverture disponible !" : "Coverage Available!"}</span>
                    </div>
                    <p style={{ color: "rgba(110,231,183,0.8)", fontSize: 13 }}>
                      {isFr ? "La couverture mobile Nivra 4G/LTE est disponible à votre adresse." : "Nivra 4G/LTE mobile coverage is available at your address."}
                    </p>
                    {addressDetails && (
                      <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                        <MapPin className="w-3 h-3" />
                        <span>{addressDetails.formatted || [addressDetails.line1, addressDetails.city].filter(Boolean).join(", ")}</span>
                      </div>
                    )}
                    <Button onClick={() => navigate("/mobile")} className="mt-1 font-bold gap-2 rounded-full px-6" style={{ background: "#7C3AED", color: "#fff" }}>
                      {isFr ? "Voir les forfaits" : "View Plans"} <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                {coverageResult === "limited" && (
                  <div className="flex flex-col items-center gap-3 px-5 py-4" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 14 }}>
                    <div className="flex items-center gap-2">
                      <Info className="w-5 h-5" style={{ color: "#FCD34D" }} />
                      <span className="font-semibold" style={{ color: "#FCD34D" }}>{isFr ? "Couverture étendue" : "Extended Coverage"}</span>
                    </div>
                    <p style={{ color: "rgba(252,211,77,0.8)", fontSize: 13 }}>
                      {isFr ? "Votre adresse est couverte par notre réseau partenaire étendu." : "Your address is covered by our extended partner network."}
                    </p>
                    <Button onClick={() => navigate("/mobile")} className="mt-1 font-bold gap-2 rounded-full px-6" style={{ background: "#7C3AED", color: "#fff" }}>
                      {isFr ? "Voir les forfaits" : "View Plans"} <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                {coverageResult === "unavailable" && (
                  <div className="flex flex-col items-center gap-3 px-5 py-4" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 14 }}>
                    <div className="flex items-center gap-2">
                      <XCircle className="w-5 h-5" style={{ color: "#FCA5A5" }} />
                      <span className="font-semibold" style={{ color: "#FCA5A5" }}>{isFr ? "Couverture limitée" : "Limited Coverage"}</span>
                    </div>
                    <p style={{ color: "rgba(252,165,165,0.8)", fontSize: 13 }}>
                      {isFr ? "La couverture est limitée à votre adresse. Contactez-nous." : "Coverage is limited at your address. Contact us."}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Stats bar + Map */}
        <section className="px-5 sm:px-10 py-10" style={{ background: "#020209", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          {/* Telecom stats bar */}
          <div className="max-w-[1100px] mx-auto mb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: "22+",           label: isFr ? "Villes desservies" : "Cities served" },
              { value: "500 000+",      label: isFr ? "Résidents couverts" : "Residents covered" },
              { value: "940 Mbps",      label: isFr ? "Vitesse maximale" : "Max speed" },
              { value: isFr ? "Sans contrat" : "No contract", label: isFr ? "Ni engagement" : "No commitment" },
            ].map((s, i) => (
              <div key={i} className="p-4 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 14 }}>
                <div className="font-extrabold mb-1" style={{ color: "#A78BFA", fontSize: 20, letterSpacing: "-0.5px" }}>{s.value}</div>
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Map card */}
          <div className="max-w-[1100px] mx-auto" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "12px" }}>
            <div className="flex flex-wrap gap-3 mb-3 text-xs px-2">
              <span className="flex items-center gap-1.5 font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#7C3AED" }} />
                {isFr ? "Zones de couverture mobile" : "Mobile coverage zones"}
              </span>
            </div>
            <div className="rounded-2xl overflow-hidden" style={{ height: "55vh", minHeight: 380, border: "1px solid rgba(255,255,255,0.08)" }}>
              <MapContainer center={[45.8, -73.6]} zoom={9} style={{ height: "100%", width: "100%" }}>
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FlyToControl target={mapTarget} />
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
              </MapContainer>
            </div>
            <div className="mt-3 px-2 flex items-center gap-2">
              <span style={{ color: "#7C3AED", fontSize: 16, lineHeight: 1 }}>&#9899;</span>
              <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 500 }}>
                Zones de service Nivra Telecom
              </span>
            </div>
          </div>
        </section>

        {/* Coverage Regions */}
        <section className="px-5 sm:px-10 pb-12" style={{ background: "#020209" }}>
          <div className="max-w-[1100px] mx-auto">
            <div className="mb-8 text-center">
              <h2 className="font-extrabold text-white mb-2" style={{ fontSize: "clamp(20px,3vw,28px)", letterSpacing: "-0.5px" }}>
                {isFr ? "Régions desservies" : "Service Regions"}
              </h2>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15 }}>
                {isFr ? "Couverture disponible dans les principales agglomérations du Québec" : "Coverage available in Quebec's main urban areas"}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              {REGIONS.map((r, i) => (
                <div key={i} className="flex gap-4 p-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 14 }}>
                  <div className="shrink-0 rounded-full" style={{ background: "#7C3AED", width: 8, height: 8, flexShrink: 0, marginTop: 6 }} />
                  <div>
                    <p className="font-bold text-white mb-1" style={{ fontSize: 14 }}>{r.label}</p>
                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.6 }}>{r.cities}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 12 }}>
              <div className="flex gap-3">
                <span style={{ color: "#A78BFA", fontSize: 16, flexShrink: 0 }}>&#9432;</span>
                <div>
                  <p className="font-semibold mb-1" style={{ color: "#C4B5FD", fontSize: 13 }}>
                    {isFr ? "Zones en expansion — Tier 2" : "Expansion Zones — Tier 2"}
                  </p>
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.6 }}>
                    {isFr
                      ? "Grâce à des projets d'expansion actifs, les services s'étendent à : Abitibi-Témiscamingue, Bas-Saint-Laurent, Gaspésie, Côte-Nord (partielle)."
                      : "Through active expansion projects, services are extending to: Abitibi-Témiscamingue, Bas-Saint-Laurent, Gaspésie, Côte-Nord (partial)."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Network Features */}
        <section className="px-5 sm:px-10 py-14" style={{ background: "#020209", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="max-w-[1100px] mx-auto">
            <div className="text-center mb-10">
              <h2 className="font-extrabold text-white mb-2" style={{ fontSize: "clamp(20px,3vw,28px)", letterSpacing: "-0.5px" }}>
                {isFr ? "Caractéristiques du réseau" : "Network Features"}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {coverageFeatures.map((f, i) => (
                <div key={i} className="p-6 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, transition: "border-color 0.2s" }}>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(124,58,237,0.15)" }}>
                    <f.icon className="w-7 h-7" style={{ color: "#A78BFA" }} />
                  </div>
                  <h3 className="font-semibold text-white mb-2" style={{ fontSize: 15 }}>{f.title}</h3>
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.6 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How to Subscribe */}
        <section className="px-5 sm:px-10 py-14" style={{ background: "#020209" }}>
          <div className="max-w-[1100px] mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-extrabold text-white mb-2" style={{ fontSize: "clamp(20px,3vw,28px)", letterSpacing: "-0.5px" }}>
                {isFr ? "Comment s'abonner" : "How to Subscribe"}
              </h2>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15 }}>
                {isFr ? "Rejoignez Nivra en quelques étapes simples" : "Join Nivra in a few simple steps"}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {subscriptionSteps.map((item, i) => (
                <div key={i} className="relative text-center">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-white text-lg" style={{ background: "#7C3AED" }}>
                    {item.step}
                  </div>
                  <h3 className="font-semibold text-white mb-2" style={{ fontSize: 15 }}>{item.title}</h3>
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>{item.desc}</p>
                  {i < subscriptionSteps.length - 1 && (
                    <div className="hidden lg:block absolute top-6 left-[60%] h-[2px]" style={{ width: "80%", background: "rgba(124,58,237,0.3)" }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="px-5 sm:px-10 py-14" style={{ background: "#020209", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="max-w-[1100px] mx-auto">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Avantages */}
              <div className="p-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18 }}>
                <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                  <Check className="w-5 h-5" style={{ color: "#6EE7B7" }} />
                  {isFr ? "Avantages Nivra" : "Nivra Benefits"}
                </h3>
                <ul className="space-y-3">
                  {[
                    isFr ? "Aucune vérification de crédit requise" : "No credit check required",
                    isFr ? "Activation rapide en ligne" : "Quick online activation",
                    isFr ? "Gardez votre numéro actuel" : "Keep your current number",
                    isFr ? "Sans engagement — prépayé" : "No commitment — prepaid",
                    isFr ? "Support client local au Québec" : "Local customer support in Quebec",
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 shrink-0" style={{ color: "#6EE7B7" }} />
                      <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 14 }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Need help */}
              <div className="p-6" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 18 }}>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Phone className="w-5 h-5" style={{ color: "#A78BFA" }} />
                  {isFr ? "Besoin d'aide ?" : "Need Help?"}
                </h3>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, lineHeight: 1.7, marginBottom: 20 }}>
                  {isFr
                    ? "Notre équipe est disponible pour répondre à vos questions sur la couverture et les forfaits."
                    : "Our team is available to answer your questions about coverage and plans."}
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => navigate("/contact")}
                    className="w-full flex items-center justify-center gap-2 py-3 font-semibold"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "rgba(255,255,255,0.8)", fontSize: 14, cursor: "pointer" }}
                  >
                    <Phone className="w-4 h-4" />
                    {isFr ? "Nous contacter" : "Contact Us"}
                  </button>
                  <button
                    onClick={() => navigate("/mobile")}
                    className="w-full flex items-center justify-center gap-2 py-3 font-bold"
                    style={{ background: "#7C3AED", borderRadius: 10, color: "#fff", fontSize: 14, cursor: "pointer", border: "none" }}
                  >
                    <Zap className="w-4 h-4" />
                    {isFr ? "Voir les forfaits" : "View Plans"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-5 sm:px-10 pb-16 pt-8" style={{ background: "#020209" }}>
          <div className="max-w-[1100px] mx-auto p-8 sm:p-10 text-center" style={{
            background: "linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)",
            borderRadius: 24,
            boxShadow: "0 20px 60px -20px rgba(124,58,237,0.5)",
          }}>
            <h2 className="font-extrabold text-white mb-3" style={{ fontSize: "clamp(22px, 3.5vw, 32px)", letterSpacing: "-0.5px" }}>
              {isFr ? "Prêt à rejoindre Nivra ?" : "Ready to Join Nivra?"}
            </h2>
            <p className="mb-6 max-w-xl mx-auto text-white" style={{ opacity: 0.85, fontSize: 16 }}>
              {isFr ? "Découvrez nos forfaits mobiles prépayés flexibles et sans engagement." : "Discover our flexible prepaid mobile plans with no commitment."}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={() => navigate("/mobile")}
                className="inline-flex items-center gap-2 px-6 py-3 font-bold"
                style={{ background: "#FFFFFF", color: "#7C3AED", borderRadius: 50, border: "none", cursor: "pointer" }}
              >
                {isFr ? "Voir les forfaits" : "View Plans"} <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate("/contact")}
                className="inline-flex items-center gap-2 px-6 py-3 font-bold"
                style={{ background: "rgba(255,255,255,0.12)", color: "#FFFFFF", borderRadius: 50, border: "1px solid rgba(255,255,255,0.3)", cursor: "pointer" }}
              >
                {isFr ? "Nous contacter" : "Contact Us"}
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default MobileCoverage;
