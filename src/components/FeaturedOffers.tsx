import { useMemo } from "react";
import { usePublicServices, type PublicService } from "@/hooks/usePublicServices";
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

const LINK_BY_CATEGORY: Record<string, string> = {
  Internet: "/internet",
  Mobile: "/mobile",
  TV: "/tv",
};

const ICON_BY_CATEGORY: Record<string, React.ReactNode> = {
  Internet: <Wifi className="w-6 h-6 text-[#003366]" />,
  Mobile: <Smartphone className="w-6 h-6 text-slate-700" />,
  TV: <Tv className="w-6 h-6 text-[#003366]" />,
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
      const fallbackBadge = highlight ? "VEDETTE" : "OFFRE";

      return {
        id: service.id,
        name: service.name,
        category: service.category,
        price: Number(service.price),
        description: service.short_description || service.description,
        badge: (service.badges[0] || fallbackBadge).toUpperCase(),
        badgeColor: highlight ? "bg-[#003366] text-white" : "bg-slate-700 text-white",
        icon: ICON_BY_CATEGORY[service.category] || <Wifi className="w-6 h-6 text-slate-700" />,
        features: getServiceFeatures(service),
        link: LINK_BY_CATEGORY[service.category] || "/services",
        highlight,
      };
    });
  }, [services]);

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

  if (featuredOffers.length === 0) return null;

  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4 max-w-7xl">
        <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-8">Offres vedettes</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {featuredOffers.map((offer) => (
            <div
              key={offer.id}
              className={`relative rounded-2xl border overflow-hidden transition-all duration-300 bg-white group hover:shadow-lg ${
                offer.highlight ? "border-[#003366] shadow-md" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className={`h-1.5 w-full ${offer.highlight ? "bg-[#003366]" : "bg-slate-200"}`} />

              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                    {offer.icon}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full ${offer.badgeColor}`}>
                    {offer.badge}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-slate-900 mb-4 leading-tight">{offer.name}</h3>

                <div className="space-y-2.5 pb-5 border-b border-slate-100 mb-5">
                  {offer.features.map((feature, index) => (
                    <div key={index} className="flex items-start gap-2.5 text-sm">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="text-slate-600">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-slate-900">{offer.price.toFixed(0)}$</span>
                    <span className="text-slate-500">/mois</span>
                  </div>
                </div>

                <Button
                  asChild
                  className={`w-full rounded-full h-11 font-semibold ${
                    offer.highlight
                      ? "bg-[#003366] hover:bg-[#002244] text-white"
                      : "bg-white border-2 border-[#003366] text-[#003366] hover:bg-[#003366] hover:text-white"
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
