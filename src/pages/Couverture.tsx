/**
 * Couverture — Public coverage check page (/couverture).
 *
 * Combines Mapbox address autocomplete with the canonical CoverageChecker
 * component. When a user selects an address, we extract its postal code and
 * automatically run the coverage check via CoverageChecker.
 */
import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Wifi, Tv, Smartphone, MapPin, Network, Gauge, ChevronDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import CoverageChecker from "@/components/CoverageChecker";
import { AddressAutocomplete, type AddressValue } from "@/components/shared/AddressAutocomplete";
import { Button } from "@/components/ui/button";

const NAVY = "#0B1437";
const PURPLE = "#7C3AED";

export default function Couverture() {
  const { language } = useLanguage();
  const isFr = language === "fr";

  const [addressInput, setAddressInput] = useState("");
  const [selectedPostal, setSelectedPostal] = useState<string>("");
  const [selectedAddress, setSelectedAddress] = useState<AddressValue | null>(null);
  const checkerRef = useRef<HTMLDivElement>(null);

  const handleAddressSelect = useCallback((address: AddressValue) => {
    setSelectedAddress(address);
    if (address.postalCode) {
      setSelectedPostal(address.postalCode);
      // Smooth scroll to the checker after selection
      setTimeout(() => {
        checkerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 80);
    }
  }, []);

  return (
    <main>
      {/* HERO */}
      <section
        aria-label={isFr ? "Vérification de couverture Nivra" : "Nivra coverage check"}
        style={{
          background: `linear-gradient(135deg, ${NAVY} 0%, #1A2456 100%)`,
          color: "white",
          padding: "80px 20px 64px",
        }}
      >
        <div className="max-w-[1100px] mx-auto text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 mb-6"
            style={{ background: "rgba(124,58,237,0.18)", borderRadius: 50, border: "1px solid rgba(124,58,237,0.4)" }}
          >
            <MapPin className="w-4 h-4" style={{ color: "#C4B5FD" }} />
            <span className="font-semibold uppercase" style={{ color: "#C4B5FD", fontSize: 11, letterSpacing: 2 }}>
              {isFr ? "Disponibilité du service" : "Service availability"}
            </span>
          </div>

          <h1
            className="font-extrabold mb-5"
            style={{
              fontSize: "clamp(28px, 4vw, 48px)",
              lineHeight: 1.15,
              letterSpacing: "-1px",
              maxWidth: 900,
              margin: "0 auto 20px",
            }}
          >
            {isFr
              ? "Vérifiez la disponibilité des services Nivra dans votre quartier"
              : "Check Nivra service availability in your neighborhood"}
          </h1>
          <p
            className="mx-auto mb-10"
            style={{ fontSize: 18, lineHeight: 1.6, color: "#D1D5DB", maxWidth: 720 }}
          >
            {isFr
              ? "Internet haute vitesse, télévision et mobile 4G — couvrant la Province de Québec."
              : "High-speed Internet, TV and 4G mobile — covering the Province of Quebec."}
          </p>

          {/* Address autocomplete */}
          <div className="max-w-2xl mx-auto">
            <label htmlFor="coverage-address" className="block text-left mb-2 font-semibold" style={{ color: "#E5E7EB", fontSize: 13 }}>
              {isFr ? "Votre adresse" : "Your address"}
            </label>
            <div className="rounded-xl bg-white p-1">
              <AddressAutocomplete
                value={addressInput}
                onValueChange={setAddressInput}
                onSelect={handleAddressSelect}
                placeholder={isFr ? "Entrez votre adresse complète…" : "Enter your full address…"}
                restrictToQuebec
                className="!border-0 !shadow-none h-12 text-base"
              />
            </div>
            <p className="text-left mt-2" style={{ color: "#9CA3AF", fontSize: 12 }}>
              {isFr
                ? "Ou entrez seulement votre code postal ci-dessous."
                : "Or enter just your postal code below."}
            </p>
          </div>

          <div className="mt-6 flex justify-center">
            <ChevronDown className="w-6 h-6 animate-bounce" style={{ color: "#C4B5FD" }} aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* COVERAGE CHECKER */}
      <div ref={checkerRef}>
        <CoverageChecker
          variant="section"
          defaultPostalCode={selectedPostal}
          title={
            selectedAddress?.formatted
              ? isFr
                ? `Vérification pour : ${selectedAddress.formatted}`
                : `Checking: ${selectedAddress.formatted}`
              : isFr
              ? "Entrez votre code postal"
              : "Enter your postal code"
          }
          subtitle={
            isFr
              ? "Nous vérifions instantanément les services Internet, TV et Mobile disponibles à votre adresse."
              : "We instantly check the Internet, TV and Mobile services available at your address."
          }
        />
      </div>

      {/* INFO STRIP */}
      <section
        aria-label={isFr ? "Détails du réseau Nivra" : "Nivra network details"}
        style={{ background: "white", padding: "56px 20px", borderTop: "1px solid #EEE" }}
      >
        <div className="max-w-[1100px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <InfoCard
            icon={<MapPin className="w-6 h-6" style={{ color: PURPLE }} />}
            title={isFr ? "Zone desservie" : "Service area"}
            value={isFr ? "Province de Québec" : "Province of Quebec"}
          />
          <InfoCard
            icon={<Network className="w-6 h-6" style={{ color: PURPLE }} />}
            title={isFr ? "Réseau" : "Network"}
            value={isFr ? "Infrastructure Bell Canada" : "Bell Canada infrastructure"}
          />
          <InfoCard
            icon={<Gauge className="w-6 h-6" style={{ color: PURPLE }} />}
            title={isFr ? "Vitesse maximale" : "Max speed"}
            value={isFr ? "Jusqu'à 1 010 Mbps" : "Up to 1,010 Mbps"}
          />
        </div>
      </section>

      {/* SERVICES PREVIEW */}
      <section
        aria-label={isFr ? "Services Nivra disponibles" : "Available Nivra services"}
        style={{ background: "#F7F7F7", padding: "64px 20px" }}
      >
        <div className="max-w-[1100px] mx-auto">
          <h2
            className="text-center font-extrabold mb-3"
            style={{ color: "#0D0D0D", fontSize: "clamp(24px, 3vw, 34px)", letterSpacing: "-0.5px" }}
          >
            {isFr ? "Services disponibles dans les zones couvertes" : "Services available in covered zones"}
          </h2>
          <p className="text-center mb-10" style={{ color: "#444", maxWidth: 640, margin: "0 auto 40px", fontSize: 16 }}>
            {isFr
              ? "Tous nos forfaits sont sans contrat, sans vérification de crédit et avec activation rapide."
              : "All our plans are contract-free, no credit check, with fast activation."}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <ServiceCard
              icon={<Wifi className="w-7 h-7" style={{ color: PURPLE }} />}
              title={isFr ? "Internet" : "Internet"}
              line={isFr ? "Jusqu'à 1 Gbps · Données illimitées" : "Up to 1 Gbps · Unlimited data"}
              cta={isFr ? "Voir les forfaits Internet" : "See Internet plans"}
              to="/internet"
            />
            <ServiceCard
              icon={<Tv className="w-7 h-7" style={{ color: PURPLE }} />}
              title={isFr ? "Télévision" : "Television"}
              line={isFr ? "Forfaits dès 75 $/mois" : "Plans from $75/month"}
              cta={isFr ? "Voir les forfaits TV" : "See TV plans"}
              to="/tv"
            />
            <ServiceCard
              icon={<Smartphone className="w-7 h-7" style={{ color: PURPLE }} />}
              title={isFr ? "Mobile 4G" : "4G Mobile"}
              line={isFr ? "50 Go et 75 Go disponibles" : "50 GB and 75 GB available"}
              cta={isFr ? "Voir les forfaits Mobile" : "See Mobile plans"}
              to="/mobile"
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        aria-label={isFr ? "Foire aux questions sur la couverture" : "Coverage FAQ"}
        style={{ background: "white", padding: "72px 20px" }}
      >
        <div className="max-w-[860px] mx-auto">
          <h2
            className="text-center font-extrabold mb-3"
            style={{ color: "#0D0D0D", fontSize: "clamp(24px, 3vw, 34px)", letterSpacing: "-0.5px" }}
          >
            {isFr ? "Questions fréquentes" : "Frequently asked questions"}
          </h2>
          <p className="text-center mb-10" style={{ color: "#666", fontSize: 16 }}>
            {isFr ? "Tout ce que vous devez savoir sur la couverture Nivra." : "Everything you need to know about Nivra coverage."}
          </p>

          <div className="space-y-3">
            {(isFr ? FAQ_FR : FAQ_EN).map((item, i) => (
              <Faq key={i} q={item.q} a={item.a} />
            ))}
          </div>

          <div className="text-center mt-12">
            <p style={{ color: "#666", marginBottom: 12 }}>
              {isFr ? "Une autre question ? Notre équipe est là pour vous aider." : "Another question? Our team is here to help."}
            </p>
            <Link to="/contact">
              <Button
                size="lg"
                style={{ background: PURPLE, color: "white" }}
                className="h-12 px-8 font-semibold"
              >
                {isFr ? "Contacter le support" : "Contact support"}
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function InfoCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="flex items-center justify-center"
        style={{ width: 56, height: 56, borderRadius: 16, background: "#F3EEFF" }}
      >
        {icon}
      </div>
      <div>
        <div className="font-semibold uppercase" style={{ color: "#7C3AED", fontSize: 11, letterSpacing: 1.5 }}>
          {title}
        </div>
        <div className="font-bold mt-1" style={{ color: "#0D0D0D", fontSize: 18 }}>
          {value}
        </div>
      </div>
    </div>
  );
}

function ServiceCard({
  icon,
  title,
  line,
  cta,
  to,
}: {
  icon: React.ReactNode;
  title: string;
  line: string;
  cta: string;
  to: string;
}) {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col"
      style={{ background: "white", border: "1px solid #E8E8E8", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
    >
      <div
        className="flex items-center justify-center mb-4"
        style={{ width: 56, height: 56, borderRadius: 16, background: "#F3EEFF" }}
      >
        {icon}
      </div>
      <h3 className="font-bold mb-2" style={{ color: "#0D0D0D", fontSize: 20 }}>
        {title}
      </h3>
      <p className="mb-5 flex-1" style={{ color: "#555", fontSize: 15, lineHeight: 1.55 }}>
        {line}
      </p>
      <Link
        to={to}
        className="inline-flex items-center justify-center w-full px-4 py-3 rounded-lg font-semibold transition-colors"
        style={{ background: "#0D0D0D", color: "white" }}
      >
        {cta}
      </Link>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details
      className="group rounded-xl"
      style={{ background: "#F7F7F7", border: "1px solid #EEE" }}
    >
      <summary
        className="flex items-start justify-between gap-4 cursor-pointer px-5 py-4 font-semibold"
        style={{ color: "#0D0D0D", fontSize: 16 }}
      >
        <span>{q}</span>
        <ChevronDown
          className="w-5 h-5 flex-shrink-0 transition-transform group-open:rotate-180"
          style={{ color: "#7C3AED" }}
        />
      </summary>
      <div className="px-5 pb-5 pt-1" style={{ color: "#555", fontSize: 15, lineHeight: 1.65 }}>
        {a}
      </div>
    </details>
  );
}

const FAQ_FR = [
  {
    q: "Comment savoir si mon adresse est couverte ?",
    a: "Entrez votre adresse ou code postal dans le champ de vérification ci-dessus. Nous interrogeons en temps réel notre base de zones desservies et affichons les services Internet, TV et Mobile disponibles chez vous.",
  },
  {
    q: "Pourquoi mon adresse n'est pas couverte ?",
    a: "Nivra utilise l'infrastructure de télécommunication existante. Certaines zones rurales ou éloignées peuvent ne pas être encore desservies. Laissez-nous votre courriel et nous vous informerons dès que votre zone sera couverte.",
  },
  {
    q: "Quels services sont disponibles ?",
    a: "Internet haute vitesse (de 100 Mbps à 1 Gbps), télévision (forfaits de base et sur mesure) et mobile 4G (forfaits 50 Go et 75 Go avec appels et textos illimités au Canada).",
  },
  {
    q: "Est-ce que Nivra couvre toute la province ?",
    a: "Nivra dessert principalement les régions urbaines et semi-urbaines du Québec : Montréal, Laval, Rive-Sud, Québec, Gatineau, Saguenay, Trois-Rivières et les régions environnantes. La couverture s'étend continuellement.",
  },
];

const FAQ_EN = [
  {
    q: "How do I know if my address is covered?",
    a: "Enter your address or postal code in the check field above. We query our service zone database in real-time and display the Internet, TV and Mobile services available at your location.",
  },
  {
    q: "Why isn't my address covered?",
    a: "Nivra uses existing telecommunications infrastructure. Some rural or remote areas may not yet be served. Leave us your email and we'll let you know as soon as your area is covered.",
  },
  {
    q: "What services are available?",
    a: "High-speed Internet (100 Mbps to 1 Gbps), television (basic and custom plans), and 4G mobile (50 GB and 75 GB plans with unlimited calls and texts in Canada).",
  },
  {
    q: "Does Nivra cover the entire province?",
    a: "Nivra primarily serves urban and semi-urban regions of Quebec: Montreal, Laval, South Shore, Quebec City, Gatineau, Saguenay, Trois-Rivières and surrounding areas. Coverage is continuously expanding.",
  },
];
