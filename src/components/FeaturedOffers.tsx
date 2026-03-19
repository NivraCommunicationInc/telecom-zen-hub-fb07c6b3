import { useMemo } from "react";
import { usePublicServices, type PublicService } from "@/hooks/usePublicServices";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, ArrowRight, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const LINK_BY_CATEGORY: Record<string, string> = {
  Internet: "/internet",
  Mobile: "/mobile",
  TV: "/tv",
};

const getServiceFeatures = (service: PublicService): string[] => {
  if (service.features_json.length > 0) return service.features_json.slice(0, 4);
  if (service.short_description) return service.short_description.split(/•|\||;/g).map((f) => f.trim()).filter(Boolean).slice(0, 4);
  return (service.description || "").split(/•|\||;/g).map((f) => f.trim()).filter(Boolean).slice(0, 4);
};

export function FeaturedOffers() {
  const { data: services, isLoading } = usePublicServices({ surface: "website" });
  const { language } = useLanguage();
  const isFr = language === 'fr';

  const featuredPlans = useMemo(() => {
    if (!services?.length) return [];

    // Pick top 2-3 featured plans across categories
    return services
      .filter(s => s.is_featured || s.is_recommended)
      .sort((a, b) => {
        const aScore = (a.is_featured ? 2 : 0) + (a.is_recommended ? 1 : 0);
        const bScore = (b.is_featured ? 2 : 0) + (b.is_recommended ? 1 : 0);
        return bScore - aScore || a.display_order - b.display_order;
      })
      .slice(0, 3);
  }, [services]);

  if (isLoading) {
    return (
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[420px] rounded-2xl bg-white/5" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (featuredPlans.length === 0) return null;

  return (
    <section className="py-20 lg:py-28">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="text-center mb-14">
          <h2 className="text-2xl md:text-4xl font-bold text-white mb-4">
            {isFr ? "Plans populaires" : "Popular Plans"}
          </h2>
          <p className="text-white/50 text-lg">
            {isFr ? "Nos forfaits les plus choisis par nos clients" : "Our most chosen plans by customers"}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {featuredPlans.map((plan, index) => {
            const features = getServiceFeatures(plan);
            const isHighlight = index === 1; // Middle card highlighted

            return (
              <div
                key={plan.id}
                className={`relative bg-[#0B1220] rounded-2xl border overflow-hidden transition-all duration-300 ${
                  isHighlight
                    ? "border-blue-500/50 shadow-xl shadow-blue-500/10 scale-[1.02]"
                    : "border-white/8 hover:border-white/15"
                }`}
              >
                {isHighlight && (
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 to-blue-400" />
                )}

                <div className="p-8">
                  {isHighlight && (
                    <div className="flex items-center gap-1.5 mb-4">
                      <Star className="w-4 h-4 text-blue-400 fill-blue-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                        {isFr ? "Populaire" : "Popular"}
                      </span>
                    </div>
                  )}

                  <h3 className="text-lg font-bold text-white mb-2">{plan.name}</h3>
                  
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-bold text-white">{Number(plan.price).toFixed(0)}$</span>
                    <span className="text-white/40">/{isFr ? "mois" : "mo"}</span>
                  </div>

                  <div className="space-y-3 mb-8">
                    {features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="text-white/60">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    asChild
                    className={`w-full rounded-xl h-12 font-semibold ${
                      isHighlight
                        ? "bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                        : "bg-white/5 border border-white/10 text-white hover:bg-white/10"
                    }`}
                  >
                    <Link to={LINK_BY_CATEGORY[plan.category] || "/compare"}>
                      {isFr ? "Choisir" : "Choose"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
