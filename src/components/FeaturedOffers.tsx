import { useMemo } from "react";
import { usePublicServices, type PublicService } from "@/hooks/usePublicServices";
import { Skeleton } from "@/components/ui/skeleton";
import { Wifi, Tv, Smartphone, Check, ArrowRight, Star } from "lucide-react";
import { Link } from "react-router-dom";

interface FeaturedService {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string | null;
  icon: React.ReactNode;
  features: string[];
  link: string;
  highlight: boolean;
  rank: number;
}

const LINK_BY_CATEGORY: Record<string, string> = {
  Internet: "/internet",
  Mobile: "/mobile",
  TV: "/tv",
};

const ICON_BY_CATEGORY: Record<string, React.ReactNode> = {
  Internet: <Wifi className="w-6 h-6 text-primary" />,
  Mobile: <Smartphone className="w-6 h-6 text-primary" />,
  TV: <Tv className="w-6 h-6 text-primary" />,
};

const getServiceFeatures = (service: PublicService): string[] => {
  if (service.features_json.length > 0) return service.features_json.slice(0, 3);
  if (service.short_description) return service.short_description.split(/•|\||;/g).map((f) => f.trim()).filter(Boolean).slice(0, 3);
  return (service.description || "").split(/•|\||;/g).map((f) => f.trim()).filter(Boolean).slice(0, 3);
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

    return picks.map((service, idx) => ({
      id: service.id,
      name: service.name,
      category: service.category,
      price: Number(service.price),
      description: service.short_description || service.description,
      icon: ICON_BY_CATEGORY[service.category] || <Wifi className="w-6 h-6 text-primary" />,
      features: getServiceFeatures(service),
      link: LINK_BY_CATEGORY[service.category] || "/services",
      highlight: Boolean(service.is_featured || service.is_recommended),
      rank: idx,
    }));
  }, [services]);

  if (isLoading) {
    return (
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-7xl">
          <Skeleton className="h-8 w-48 mx-auto mb-10" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[400px] rounded-2xl" />
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 items-stretch">
          {featuredOffers.map((offer) => {
            const isDominant = offer.highlight;

            return (
              <Link
                key={offer.id}
                to={offer.link}
                className={`relative rounded-2xl overflow-hidden transition-all duration-200 bg-card group block ${
                  isDominant
                    ? "border-2 border-primary shadow-lg md:scale-[1.03] z-10"
                    : "border border-border hover:border-primary/30 shadow-sm hover:shadow-md"
                }`}
              >
                {/* Top accent */}
                <div className={`h-1 w-full ${isDominant ? "bg-primary" : "bg-transparent"}`} />

                {/* Recommended badge — only on dominant */}
                {isDominant && (
                  <div className="absolute top-4 right-4 z-10">
                    <div className="flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">
                      <Star className="w-3 h-3 fill-current" />
                      Recommandé
                    </div>
                  </div>
                )}

                <div className="p-6 lg:p-7 flex flex-col h-full">
                  {/* Icon + Category */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                    isDominant ? "bg-primary/10" : "bg-secondary"
                  }`}>
                    {offer.icon}
                  </div>

                  <h3 className="text-lg font-bold text-foreground mb-1 pr-16 group-hover:text-primary transition-colors duration-200">{offer.name}</h3>
                  <p className="text-xs text-muted-foreground mb-5">{offer.category}</p>

                  {/* Features */}
                  <div className="space-y-2.5 mb-6 flex-1">
                    {offer.features.map((feature, index) => (
                      <div key={index} className="flex items-start gap-2.5 text-sm">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Price + CTA */}
                  <div className="pt-5 border-t border-border">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">À partir de</span>
                    <div className="flex items-baseline gap-1 mt-0.5 mb-4">
                      <span className={`font-black text-foreground leading-none ${isDominant ? "text-4xl" : "text-3xl"}`}>
                        {offer.price.toFixed(0)}$
                      </span>
                      <span className="text-muted-foreground text-xs font-medium">/mois</span>
                    </div>

                    <div className={`w-full rounded-full flex items-center justify-center gap-2 font-bold text-sm transition-all duration-200 ${
                      isDominant
                        ? "h-12 bg-primary text-primary-foreground"
                        : "h-10 bg-secondary text-foreground group-hover:bg-primary group-hover:text-primary-foreground"
                    }`}>
                      {isDominant ? "Choisir ce forfait" : "Voir les détails"}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
