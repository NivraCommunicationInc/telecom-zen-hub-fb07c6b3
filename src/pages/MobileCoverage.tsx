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

        {/* Map */}
        <section className="px-5 sm:px-10 py-10" style={{ background: "#020209", borderTop: "1px solid rgba(124,58,237,0.15)" }}>
          <div className="max-w-[1100px] mx-auto" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 20, padding: "16px", boxShadow: "0 0 60px -20px rgba(124,58,237,0.15)" }}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4 px-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ background: "#34D399", boxShadow: "0 0 8px rgba(52,211,153,0.8)" }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.5)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {isFr ? "Réseau 4G en direct" : "Live 4G network"}
                </span>
              </div>
              <span className="flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.4)", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                <span className="w-2 h-2 rounded-full" style={{ background: "#7C3AED" }} />
                {isFr ? "Zones de couverture mobile" : "Mobile coverage zones"}
              </span>
            </div>
            <div className="rounded-2xl overflow-hidden" style={{ height: "55vh", minHeight: 380, border: "1px solid rgba(124,58,237,0.15)" }}>
              <MapContainer center={[45.8, -73.6]} zoom={9} style={{ height: "100%", width: "100%" }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
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
          </div>
        </section>

        {/* Coverage Regions */}
        <section className="px-5 sm:px-10 py-16" style={{ background: "#020209", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="max-w-[1100px] mx-auto">
            <div className="mb-10 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-4" style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 100 }}>
                <Signal className="w-3.5 h-3.5" style={{ color: "#A78BFA" }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#A78BFA", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>
                  {isFr ? "Carte de couverture 4G" : "4G Coverage map"}
                </span>
              </div>
              <h2 className="font-extrabold text-white mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(24px,3.5vw,36px)", letterSpacing: "-1px" }}>
                {isFr ? <>Régions <span className="n-shimmer-text">desservies</span></> : <>Service <span className="n-shimmer-text">regions</span></>}
              </h2>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15, maxWidth: 520, margin: "0 auto" }}>
                {isFr ? "Couverture disponible dans les principales agglomérations du Québec" : "Coverage available in Quebec's main urban areas"}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {REGIONS.map((r, i) => {
                const colors = ["#A78BFA", "#60A5FA", "#34D399", "#FBBF24"];
                return (
                  <div key={i} className="flex gap-0 overflow-hidden" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, transition: "border-color 0.2s" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = `${colors[i]}40`)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)")}
                  >
                    <div style={{ width: 4, flexShrink: 0, background: `linear-gradient(180deg, ${colors[i]}, ${colors[i]}80)`, borderRadius: "14px 0 0 14px" }} />
                    <div className="flex-1 p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-extrabold" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: colors[i], letterSpacing: "0.1em", textTransform: "uppercase" }}>R{String(i + 1).padStart(2, "0")}</span>
                        <p className="font-bold text-white" style={{ fontSize: 14 }}>{r.label}</p>
                      </div>
                      <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 12.5, lineHeight: 1.7 }}>{r.cities}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 p-5" style={{ background: "rgba(124,58,237,0.07)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 14 }}>
              <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.35)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
              </div>
              <div>
                <p className="font-bold mb-1" style={{ color: "#C4B5FD", fontSize: 13, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.04em" }}>
                  {isFr ? "ZONES EN EXPANSION — TIER 2" : "EXPANSION ZONES — TIER 2"}
                </p>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, lineHeight: 1.6 }}>
                  {isFr
                    ? "Grâce à des projets d'expansion actifs, les services s'étendent à : Abitibi-Témiscamingue, Bas-Saint-Laurent, Gaspésie, Côte-Nord (partielle)."
                    : "Through active expansion projects, services are extending to: Abitibi-Témiscamingue, Bas-Saint-Laurent, Gaspésie, Côte-Nord (partial)."}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Network Features */}
        <section className="px-5 sm:px-10 py-16" style={{ background: "#020209", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="max-w-[1100px] mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-4" style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 100 }}>
                <Zap className="w-3.5 h-3.5" style={{ color: "#67E8F9" }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#67E8F9", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>
                  {isFr ? "Infrastructure réseau" : "Network infrastructure"}
                </span>
              </div>
              <h2 className="font-extrabold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(24px,3.5vw,36px)", letterSpacing: "-1px" }}>
                {isFr ? <>Caractéristiques du <span className="n-shimmer-text">réseau</span></> : <>Network <span className="n-shimmer-text">features</span></>}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {coverageFeatures.map((f, i) => {
                const accents = ["#A78BFA", "#60A5FA", "#34D399", "#F9A8D4"];
                return (
                  <div key={i} className="p-6 text-center group" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.07)`, borderRadius: 18, transition: "border-color 0.25s, transform 0.25s", cursor: "default" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = `${accents[i]}35`; e.currentTarget.style.transform = "translateY(-3px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; e.currentTarget.style.transform = "translateY(0)"; }}
                  >
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: `radial-gradient(circle, ${accents[i]}20 0%, rgba(255,255,255,0.03) 100%)`, border: `1px solid ${accents[i]}30` }}>
                      <f.icon className="w-6 h-6" style={{ color: accents[i] }} />
                    </div>
                    <h3 className="font-bold text-white mb-2" style={{ fontSize: 14, letterSpacing: "-0.3px" }}>{f.title}</h3>
                    <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, lineHeight: 1.65 }}>{f.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* How to Subscribe */}
        <section className="px-5 sm:px-10 py-16" style={{ background: "linear-gradient(180deg, #020209 0%, rgba(124,58,237,0.04) 50%, #020209 100%)" }}>
          <div className="max-w-[1100px] mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-4" style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 100 }}>
                <ArrowRight className="w-3.5 h-3.5" style={{ color: "#A78BFA" }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#A78BFA", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>
                  {isFr ? "Processus d'activation" : "Activation process"}
                </span>
              </div>
              <h2 className="font-extrabold text-white mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(24px,3.5vw,36px)", letterSpacing: "-1px" }}>
                {isFr ? <>Activez votre service <span className="n-shimmer-text">en 4 étapes</span></> : <>Get activated <span className="n-shimmer-text">in 4 steps</span></>}
              </h2>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 15 }}>
                {isFr ? "Rejoignez Nivra en quelques minutes" : "Join Nivra in just a few minutes"}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {subscriptionSteps.map((item, i) => (
                <div key={i} className="relative p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(124,58,237,0.15)", borderRadius: 18 }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold shrink-0" style={{ background: "linear-gradient(135deg, #7C3AED, #5B21B6)", color: "#fff", fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, boxShadow: "0 4px 20px -4px rgba(124,58,237,0.6)" }}>
                      {item.step}
                    </div>
                    {i < subscriptionSteps.length - 1 && (
                      <div className="hidden lg:block flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(124,58,237,0.4), transparent)" }} />
                    )}
                  </div>
                  <h3 className="font-bold text-white mb-2" style={{ fontSize: 14, letterSpacing: "-0.3px" }}>{item.title}</h3>
                  <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, lineHeight: 1.6 }}>{item.desc}</p>
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
          <div className="max-w-[1100px] mx-auto text-center relative overflow-hidden" style={{
            background: "linear-gradient(135deg, #4C1D95 0%, #7C3AED 50%, #5B21B6 100%)",
            borderRadius: 24,
            boxShadow: "0 20px 80px -20px rgba(124,58,237,0.6), inset 0 1px 0 rgba(255,255,255,0.15)",
            padding: "clamp(40px, 6vw, 64px) 24px",
          }}>
            <div aria-hidden style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" }} />
            <div aria-hidden style={{ position: "absolute", top: "-40%", left: "50%", transform: "translateX(-50%)", width: 600, height: 400, borderRadius: "50%", background: "radial-gradient(ellipse, rgba(255,255,255,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
            <div style={{ position: "relative" }}>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-5" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 100 }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#34D399", boxShadow: "0 0 6px rgba(52,211,153,1)" }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.9)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>
                  {isFr ? "Disponible maintenant" : "Available now"}
                </span>
              </div>
              <h2 className="font-extrabold text-white mb-3" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(26px, 4vw, 44px)", letterSpacing: "-1.5px", lineHeight: 1.1 }}>
                {isFr ? "Prêt à rejoindre Nivra ?" : "Ready to Join Nivra?"}
              </h2>
              <p className="mb-8 max-w-lg mx-auto text-white" style={{ opacity: 0.8, fontSize: 16, lineHeight: 1.6 }}>
                {isFr ? "Forfaits mobiles prépayés flexibles, sans engagement, sans vérification de crédit." : "Flexible prepaid mobile plans, no commitment, no credit check."}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button onClick={() => navigate("/mobile")} className="inline-flex items-center gap-2 px-7 py-3.5 font-bold" style={{ background: "#FFFFFF", color: "#7C3AED", borderRadius: 50, border: "none", cursor: "pointer", fontSize: 15 }}>
                  {isFr ? "Voir les forfaits" : "View Plans"} <ArrowRight className="w-4 h-4" />
                </button>
                <button onClick={() => navigate("/contact")} className="inline-flex items-center gap-2 px-7 py-3.5 font-bold" style={{ background: "rgba(255,255,255,0.1)", color: "#FFFFFF", borderRadius: 50, border: "1px solid rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 15 }}>
                  {isFr ? "Nous contacter" : "Contact Us"}
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default MobileCoverage;
