import { useMemo } from "react";
import { usePublicServices, type PublicService } from "@/hooks/usePublicServices";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Wifi, Tv, Smartphone, Check, ArrowRight, Star } from "lucide-react";
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

const LINK_BY_CATEGORY: Record<string, string> = {
  Internet: "/internet",
  Mobile: "/mobile",
  TV: "/tv",
};

const ICON_BY_CATEGORY: Record<string, React.ReactNode> = {
  Internet: <Wifi className="w-7 h-7 text-primary" />,
  Mobile: <Smartphone className="w-7 h-7 text-primary" />,
  TV: <Tv className="w-7 h-7 text-primary" />,
};

const getServiceFeatures = (service: PublicService): string[] => {
  if (service.features_json.length > 0) return service.features_json.slice(0, 4);
  if (service.short_description) return service.short_description.split(/•|\||;/g).map((f) => f.trim()).filter(Boolean).slice(0, 4);
  return (service.description || "").split(/•|\||;/g).map((f) => f.trim()).filter(Boolean).slice(0, 4);
};

export function FeaturedOffers() {
  const { data: services, isLoading } = usePublicServices({ surface: "website" });

  const featuredOffers = useMemo((): FeaturedService[] => {
    if (!services?.length) return [];

    const pickByCategory = (category: string) => {
      return services
        .filter((service) => service.category === category)
        .sort((a, b) => {
          const aScore = (a.is_featured ? 2 : 0) + (a.is_recommended ? 1 : 0);
          const bScore = (b.is_featured ? 2 : 0) + (b.is_recommended ? 1 : 0);
          if (bScore !== aScore) return bScore - aScore;
          if (a.display_order !== b.display_order) return a.display_order - b.display_order;
          return a.price - b.price;
        })[0];
    };

    const picks = [pickByCategory("Internet"), pickByCategory("Mobile"), pickByCategory("TV")].filter(Boolean) as PublicService[];

    return picks.map((service) => {
      const highlight = service.is_featured || service.is_recommended;
      const fallbackBadge = highlight ? "RECOMMANDÉ" : "OFFRE";

      return {
        id: service.id,
        name: service.name,
        category: service.category,
        price: Number(service.price),
        description: service.short_description || service.description,
        badge: (service.badges[0] || fallbackBadge).toUpperCase(),
        badgeColor: highlight ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
        icon: ICON_BY_CATEGORY[service.category] || <Wifi className="w-7 h-7 text-primary" />,
        features: getServiceFeatures(service),
        link: LINK_BY_CATEGORY[service.category] || "/services",
        highlight,
      };
    });
  }, [services]);

  if (isLoading) {
    return (
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-7xl">
          <Skeleton className="h-8 w-48 mx-auto mb-10" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[440px] rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (featuredOffers.length === 0) return null;

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Section header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">Offres vedettes</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Nos meilleurs forfaits sélectionnés pour vous
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {featuredOffers.map((offer) => (
            <div
              key={offer.id}
              className={`relative rounded-2xl border overflow-hidden transition-all duration-300 bg-card group hover:shadow-xl ${
                offer.highlight
                  ? "border-primary ring-2 ring-primary/10 shadow-lg md:scale-[1.03]"
                  : "border-border hover:border-primary/40"
              }`}
            >
              {/* Top accent bar */}
              <div className={`h-1.5 w-full ${offer.highlight ? "bg-primary" : "bg-border"}`} />

              {/* Recommended star overlay */}
              {offer.highlight && (
                <div className="absolute top-5 right-5 z-10">
                  <div className="flex items-center gap-1.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-md">
                    <Star className="w-3 h-3 fill-current" />
                    {offer.badge}
                  </div>
                </div>
              )}
              {!offer.highlight && (
                <div className="absolute top-5 right-5 z-10">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full ${offer.badgeColor}`}>
                    {offer.badge}
                  </span>
                </div>
              )}

              <div className="p-7">
                {/* Icon */}
                <div className="w-16 h-16 rounded-2xl bg-primary/8 border border-primary/10 flex items-center justify-center mb-6">
                  {offer.icon}
                </div>

                {/* Name */}
                <h3 className="text-xl font-bold text-foreground mb-5 leading-tight pr-20">{offer.name}</h3>

                {/* Features */}
                <div className="space-y-3 pb-6 border-b border-border mb-6">
                  {offer.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-3 text-sm">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-emerald-600" />
                      </div>
                      <span className="text-muted-foreground">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Price — large and prominent */}
                <div className="mb-6">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">À partir de</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-5xl font-extrabold text-foreground">{offer.price.toFixed(0)}$</span>
                    <span className="text-muted-foreground text-sm font-medium">/mois</span>
                  </div>
                </div>

                {/* CTA */}
                <Button
                  asChild
                  className={`w-full rounded-full h-12 font-bold text-base transition-all duration-300 ${
                    offer.highlight
                      ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg"
                      : "bg-secondary text-foreground hover:bg-primary hover:text-primary-foreground border border-border hover:border-primary"
                  }`}
                  variant={offer.highlight ? "default" : "outline"}
                >
                  <Link to={offer.link}>
                    Voir les détails
                    <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
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
