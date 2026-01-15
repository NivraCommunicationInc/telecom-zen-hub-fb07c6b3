import { usePublicServices } from "@/hooks/usePublicServices";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Wifi, Tv, Smartphone, Check, Zap } from "lucide-react";
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

    // Get one Internet plan (500 Mbps is popular)
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
        badge: "MEILLEUR VENDEUR",
        badgeColor: "bg-accent",
        icon: <Wifi className="w-5 h-5" />,
        features: [
          "Téléchargement haute vitesse",
          "Données illimitées",
          "Routeur Nivra Born Wifi inclus",
          "Support technique 7j/7",
        ],
        link: "/internet",
      });
    }

    // Get one Mobile plan (60$ is popular)
    const mobilePlan = services.find(
      (s) => s.category === "Mobile" && Number(s.price) >= 60
    ) || services.find((s) => s.category === "Mobile");

    if (mobilePlan) {
      featured.push({
        id: mobilePlan.id,
        name: mobilePlan.name,
        category: "Mobile",
        price: Number(mobilePlan.price),
        description: mobilePlan.description,
        badge: "POPULAIRE",
        badgeColor: "bg-cyan-500",
        icon: <Smartphone className="w-5 h-5" />,
        features: [
          "Appels Canada illimités",
          "Textos/MMS internationaux illimités",
          "Données 4G généreuses",
          "Sans contrat",
        ],
        link: "/mobile",
      });
    }

    // Get one TV plan (GIGA + TV 25 choix is premium)
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
        badge: "PREMIUM",
        badgeColor: "bg-purple-500",
        icon: <Tv className="w-5 h-5" />,
        features: [
          "Internet GIGA 1 Gbps inclus",
          "Chaînes populaires + sports",
          "Nivra 4K Smart Terminal",
          "Support VIP prioritaire",
        ],
        link: "/tv",
      });
    }

    return featured;
  };

  if (isLoading) {
    return (
      <section className="py-16 bg-gradient-to-b from-background to-muted/30">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 text-accent mb-4">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">Nos meilleures offres</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Offres en vedette
            </h2>
            <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
              Découvrez nos forfaits les plus populaires avec tout ce qu'il vous faut
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[420px] rounded-xl" />
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
    <section className="py-16 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Section header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 text-accent mb-4">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">Nos meilleures offres</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground">
            Offres en vedette
          </h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Découvrez nos forfaits les plus populaires avec tout ce qu'il vous faut
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featuredOffers.map((offer) => (
            <Card
              key={offer.id}
              className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-card group"
            >
              {/* Category header with gradient */}
              <div className="h-2 bg-gradient-to-r from-primary via-accent to-primary" />

              <CardHeader className="pb-3 pt-5">
                {/* Badges row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {offer.icon}
                  </div>
                  <Badge className={`${offer.badgeColor} text-white font-medium`}>
                    <Sparkles className="w-3 h-3 mr-1" />
                    {offer.badge}
                  </Badge>
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-foreground leading-tight">
                  {offer.name}
                </h3>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Description */}
                {offer.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
                    {offer.description}
                  </p>
                )}

                {/* Features list */}
                <div className="space-y-2 py-3 border-y border-border/50">
                  {offer.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      <span className="text-foreground/80">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Price section */}
                <div className="flex items-end justify-between pt-2">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-primary">
                      {offer.price.toFixed(2)}$
                    </span>
                    <span className="text-sm text-muted-foreground">/mois</span>
                  </div>
                </div>

                {/* CTA Button */}
                <Button asChild className="w-full mt-2 group-hover:bg-primary/90" size="lg">
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
