import { usePublicServices } from "@/hooks/usePublicServices";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Wifi, Tv, Smartphone, Check, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface FeaturedService {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string | null;
  badge: string;
  badgeColor: string;
  icon: React.ReactNode;
  features: string[];
  link: string;
  highlight?: boolean;
}

export function FeaturedOffers() {
  const { data: services, isLoading } = usePublicServices();

  const getFeaturedOffers = (): FeaturedService[] => {
    if (!services || services.length === 0) return [];

    const featured: FeaturedService[] = [];

    const internetPlan = services.find(
      (s) => s.category === "Internet" && s.name.toLowerCase().includes("500")
    ) || services.find((s) => s.category === "Internet");

    if (internetPlan) {
      featured.push({
        id: internetPlan.id,
        name: internetPlan.name,
        category: "Internet",
        price: Number(internetPlan.price),
        description: internetPlan.description,
        badge: "POPULAIRE",
        badgeColor: "bg-[#003366] text-white",
        icon: <Wifi className="w-6 h-6 text-[#003366]" />,
        features: [
          "Téléchargement haute vitesse",
          "Données illimitées",
          "Routeur WiFi inclus",
          "Support technique 7j/7",
        ],
        link: "/internet",
        highlight: true,
      });
    }

    const mobilePlan = services.find(
      (s) => s.category === "Mobile" && s.name.toLowerCase().includes("75")
    ) || services.find((s) => s.category === "Mobile" && Number(s.price) >= 50);

    if (mobilePlan) {
      featured.push({
        id: mobilePlan.id,
        name: mobilePlan.name,
        category: "Mobile",
        price: Number(mobilePlan.price),
        description: mobilePlan.description,
        badge: "SANS CONTRAT",
        badgeColor: "bg-slate-700 text-white",
        icon: <Smartphone className="w-6 h-6 text-slate-700" />,
        features: [
          "Appels Canada illimités",
          "Textos/MMS illimités",
          "Données 4G/5G",
          "Activation rapide",
        ],
        link: "/mobile",
      });
    }

    const tvPlan = services.find(
      (s) => s.category === "TV" && s.name.toLowerCase().includes("giga") && s.name.includes("25")
    ) || services.find((s) => s.category === "TV" && s.name.toLowerCase().includes("giga"));

    if (tvPlan) {
      featured.push({
        id: tvPlan.id,
        name: tvPlan.name,
        category: "TV",
        price: Number(tvPlan.price),
        description: tvPlan.description,
        badge: "COMBO",
        badgeColor: "bg-[#003366] text-white",
        icon: <Tv className="w-6 h-6 text-[#003366]" />,
        features: [
          "Internet GIGA 1 Gbps inclus",
          "Chaînes populaires + sports",
          "Terminal 4K inclus",
          "Support prioritaire",
        ],
        link: "/tv",
      });
    }

    return featured;
  };

  if (isLoading) {
    return (
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-7xl">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[380px] rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const featuredOffers = getFeaturedOffers();
  if (featuredOffers.length === 0) return null;

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Bell-style section title — left-aligned, bold */}
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-8">
          Offres vedettes
        </h2>

        {/* Bell-style offer tiles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featuredOffers.map((offer) => (
            <div
              key={offer.id}
              className={`relative rounded-2xl border overflow-hidden transition-all duration-300 bg-white group hover:shadow-lg ${
                offer.highlight ? 'border-[#003366] shadow-md' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Top colored bar */}
              <div className={`h-1.5 w-full ${offer.highlight ? 'bg-[#003366]' : 'bg-slate-200'}`} />

              <div className="p-6">
                {/* Badge & icon */}
                <div className="flex items-center justify-between mb-5">
                  <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                    {offer.icon}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${offer.badgeColor}`}>
                    {offer.badge}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-lg font-bold text-slate-900 mb-4 leading-tight">
                  {offer.name}
                </h3>

                {/* Features */}
                <div className="space-y-2.5 pb-5 border-b border-slate-100 mb-5">
                  {offer.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-2.5 text-sm">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-slate-600">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Price */}
                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-slate-900">
                      {offer.price.toFixed(0)}$
                    </span>
                    <span className="text-slate-500">/mois</span>
                  </div>
                </div>

                {/* CTA */}
                <Button 
                  asChild 
                  className={`w-full rounded-full h-11 font-semibold ${
                    offer.highlight 
                      ? 'bg-[#003366] hover:bg-[#002244] text-white' 
                      : 'bg-white border-2 border-[#003366] text-[#003366] hover:bg-[#003366] hover:text-white'
                  }`}
                  variant={offer.highlight ? "default" : "outline"}
                >
                  <Link to={offer.link}>
                    Voir les détails
                    <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
