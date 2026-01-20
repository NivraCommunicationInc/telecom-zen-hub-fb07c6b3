import { usePublicServices } from "@/hooks/usePublicServices";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Wifi, Tv, Smartphone, Check } from "lucide-react";
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
}

export function FeaturedOffers() {
  const { data: services, isLoading } = usePublicServices();

  // Create featured offers from services table directly
  const getFeaturedOffers = (): FeaturedService[] => {
    if (!services || services.length === 0) return [];

    const featured: FeaturedService[] = [];

    // Get Internet 500 Mbps (most popular mid-tier)
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
        badgeColor: "bg-accent text-white",
        icon: <Wifi className="w-5 h-5" />,
        features: [
          "Téléchargement haute vitesse",
          "Données illimitées",
          "Routeur WiFi inclus",
          "Support technique 7j/7",
        ],
        link: "/internet",
      });
    }

    // Get Mobile 75GB plan
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
        badgeColor: "bg-cyan-600 text-white",
        icon: <Smartphone className="w-5 h-5" />,
        features: [
          "Appels Canada illimités",
          "Textos/MMS illimités",
          "Données 4G/5G",
          "Activation rapide",
        ],
        link: "/mobile",
      });
    }

    // Get GIGA + TV combo
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
        badgeColor: "bg-purple-600 text-white",
        icon: <Tv className="w-5 h-5" />,
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
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-10">
            <Skeleton className="h-6 w-40 mx-auto mb-4" />
            <Skeleton className="h-10 w-72 mx-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[380px] rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const featuredOffers = getFeaturedOffers();

  if (featuredOffers.length === 0) {
    return null;
  }

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Section header */}
        <div className="text-center mb-10">
          <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-4">
            Offres vedettes
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Nos forfaits les plus populaires
          </h2>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featuredOffers.map((offer) => (
            <Card
              key={offer.id}
              className="relative overflow-hidden border shadow-sm hover:shadow-md transition-all duration-300 bg-card"
            >
              <CardHeader className="pb-3 pt-5">
                {/* Icon & Badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2.5 rounded-xl bg-primary/5">
                    {offer.icon}
                  </div>
                  <Badge className={offer.badgeColor}>
                    {offer.badge}
                  </Badge>
                </div>

                {/* Title */}
                <h3 className="text-lg font-bold text-foreground leading-tight">
                  {offer.name}
                </h3>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Features list */}
                <div className="space-y-2.5 py-4 border-y border-border">
                  {offer.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-2.5 text-sm">
                      <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Price section */}
                <div className="flex items-end justify-between pt-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">
                      {offer.price.toFixed(0)}$
                    </span>
                    <span className="text-muted-foreground">/mois</span>
                  </div>
                </div>

                {/* CTA Button */}
                <Button asChild className="w-full" size="lg">
                  <Link to={offer.link}>Voir les détails</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
