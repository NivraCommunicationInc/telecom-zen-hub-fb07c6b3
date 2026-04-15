import { useState, useMemo } from "react";
import { Check, Wifi, Tv, Package, ArrowRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import SEOHead from "@/components/SEOHead";
import LegalDisclaimer from "@/components/LegalDisclaimer";
import { useInternetPlans, useTVPlans } from "@/hooks/usePublicServices";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type TabKey = "internet" | "tv" | "combo";

const GOLD = "#d4a843";

const Forfaits = () => {
  const { language } = useLanguage();
  const isFr = language === "fr";
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<TabKey>("internet");
  const [postalCode, setPostalCode] = useState("");
  const [availabilityResult, setAvailabilityResult] = useState<"ok" | "no" | null>(null);

  const { plans: internetPlans, isLoading: loadingInternet } = useInternetPlans(isFr);
  const { standardPlans: tvStandard, gigaPlans: tvGiga, isLoading: loadingTV } = useTVPlans(isFr);

  const isLoading = loadingInternet || loadingTV;

  const tabs: { key: TabKey; label: string; icon: typeof Wifi }[] = [
    { key: "internet", label: "Internet", icon: Wifi },
    { key: "tv", label: isFr ? "Télévision" : "Television", icon: Tv },
    { key: "combo", label: "Internet + TV", icon: Package },
  ];

  // Build cards per tab
  const cards = useMemo(() => {
    if (activeTab === "internet") {
      return internetPlans.map((p, i) => ({
        id: p.id,
        title: p.speed,
        price: p.price,
        features: p.features.slice(0, 5),
        popular: p.featured || i === 1,
        link: `/commander?plan=${p.id}`,
      }));
    }
    if (activeTab === "tv") {
      const all = [...tvStandard, ...tvGiga];
      return all.map((p, i) => ({
        id: p.id,
        title: p.name,
        price: p.price,
        features: p.features.slice(0, 5),
        popular: p.featured || i === 1,
        link: `/commander?plan=${p.id}`,
      }));
    }
    // combo = TV plans (which include internet)
    const combos = [...tvStandard, ...tvGiga].filter(
      (p) => p.internetSpeed && p.internetSpeed !== "0"
    );
    return combos.map((p, i) => ({
      id: p.id,
      title: `${p.name}`,
      price: p.price,
      features: [
        isFr ? `Internet ${p.internetSpeed} inclus` : `${p.internetSpeed} Internet included`,
        ...p.features.slice(0, 4),
      ],
      popular: p.featured || i === 1,
      link: `/commander?plan=${p.id}`,
    }));
  }, [activeTab, internetPlans, tvStandard, tvGiga, isFr]);

  const handleCheckAvailability = () => {
    const cleaned = postalCode.replace(/\s/g, "").toUpperCase();
    if (/^[GHJ]/i.test(cleaned) && cleaned.length >= 3) {
      setAvailabilityResult("ok");
    } else if (cleaned.length >= 3) {
      setAvailabilityResult("no");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Forfaits Internet et TV sans contrat au Québec | Nivra Telecom"
        description="Comparez nos forfaits Internet haute vitesse et TV sans contrat au Québec. Prix fixes garantis, sans engagement. Activation rapide."
      />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Page header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-3">
              {isFr ? "Nos forfaits" : "Our Plans"}
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              {isFr
                ? "Internet et TV sans contrat au Québec — prix fixe garanti"
                : "No-contract Internet and TV in Quebec — guaranteed fixed price"}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex gap-1 bg-muted/50 rounded-xl p-1.5">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    activeTab === tab.key
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  style={activeTab === tab.key ? { borderBottom: `3px solid ${GOLD}` } : undefined}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Address checker */}
          <div className="bg-secondary/60 rounded-2xl p-6 md:p-8 mb-12 text-center max-w-2xl mx-auto">
            <h3 className="text-lg font-bold text-foreground mb-2">
              {isFr ? "Vérifiez la disponibilité à votre adresse" : "Check availability at your address"}
            </h3>
            <div className="flex gap-3 max-w-md mx-auto">
              <Input
                type="text"
                placeholder={isFr ? "Code postal (ex: H2X 1Y4)" : "Postal code (e.g. H2X 1Y4)"}
                value={postalCode}
                onChange={(e) => {
                  setPostalCode(e.target.value);
                  setAvailabilityResult(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleCheckAvailability()}
                className="flex-1"
              />
              <Button onClick={handleCheckAvailability} className="shrink-0 font-bold">
                {isFr ? "Vérifier" : "Check"}
              </Button>
            </div>
            {availabilityResult === "ok" && (
              <p className="text-emerald-600 text-sm font-medium mt-3">
                ✓ {isFr ? "Excellente nouvelle! Le service est disponible dans votre région." : "Great news! Service is available in your area."}
              </p>
            )}
            {availabilityResult === "no" && (
              <p className="text-muted-foreground text-sm mt-3">
                {isFr
                  ? "Service actuellement limité au Québec. Contactez-nous pour plus d'informations."
                  : "Service currently limited to Quebec. Contact us for more information."}
              </p>
            )}
            <p className="text-xs text-muted-foreground/60 mt-2">
              {isFr ? "Service disponible dans la majorité des régions du Québec" : "Available in most Quebec regions"}
            </p>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {/* Plan cards */}
          {!isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-12">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className={`relative rounded-2xl bg-card overflow-hidden transition-all duration-200 ${
                    card.popular
                      ? "border-2 border-primary shadow-xl md:scale-[1.03] z-10"
                      : "border border-border shadow-sm hover:shadow-lg"
                  }`}
                >
                  {/* Popular badge */}
                  {card.popular && (
                    <div className="bg-primary text-primary-foreground text-center py-1.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
                      <span>★</span> {isFr ? "Le plus populaire" : "Most Popular"}
                    </div>
                  )}

                  <div className="p-6 lg:p-8">
                    {/* Product name */}
                    <h3 className="text-xl md:text-2xl font-bold text-foreground mb-4">
                      {card.title}
                    </h3>

                    {/* Price */}
                    <div className="mb-1">
                      <span className="text-4xl md:text-5xl font-black text-foreground">
                        ${card.price}
                      </span>
                      <span className="text-muted-foreground text-base font-medium">
                        /{isFr ? "mois" : "mo"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-6">
                      {isFr ? "taxes incluses • prix fixe garanti" : "taxes included • guaranteed fixed price"}
                    </p>

                    {/* Features */}
                    <ul className="space-y-3 mb-8">
                      {card.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <button
                      onClick={() => navigate(card.link)}
                      className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200"
                      style={
                        card.popular
                          ? { background: GOLD, color: "#fff" }
                          : { background: "transparent", border: `2px solid ${GOLD}`, color: GOLD }
                      }
                    >
                      {isFr ? "Choisir ce forfait" : "Choose this plan"}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {cards.length === 0 && !isLoading && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  {isFr ? "Aucun forfait disponible pour cette catégorie." : "No plans available for this category."}
                </div>
              )}
            </div>
          )}

          {/* Legal disclaimer */}
          <LegalDisclaimer />
        </div>
      </main>
    </div>
  );
};

export default Forfaits;
