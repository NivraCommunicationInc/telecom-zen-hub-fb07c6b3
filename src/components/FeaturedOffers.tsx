import { useMemo } from "react";
import { usePublicServices, type PublicService } from "@/hooks/usePublicServices";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, ArrowRight, Star, Flame } from "lucide-react";
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
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[420px] rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (featuredPlans.length === 0) return null;

  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 mb-6">
            <Flame className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-bold text-amber-700 uppercase tracking-wider">
              {isFr ? "Offres limitées" : "Limited offers"}
            </span>
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
            {isFr ? "Plans populaires" : "Popular Plans"}
          </h2>
          <p className="text-slate-500 text-lg">
            {isFr ? "Nos forfaits les plus choisis par nos clients" : "Our most chosen plans by customers"}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {featuredPlans.map((plan, index) => {
            const features = getServiceFeatures(plan);
            const isHighlight = index === 1;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl overflow-hidden transition-all duration-300 ${
                  isHighlight
                    ? "bg-gradient-to-br from-blue-700 to-indigo-800 text-white shadow-2xl shadow-blue-500/25 scale-[1.03]"
                    : "bg-white border-2 border-slate-200 hover:border-blue-300 hover:shadow-xl"
                }`}
              >
                {isHighlight && (
                  <div className="absolute top-4 right-4">
                    <span className="inline-flex items-center gap-1.5 bg-amber-400 text-slate-900 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
                      <Star className="w-3 h-3 fill-current" />
                      {isFr ? "Populaire" : "Popular"}
                    </span>
                  </div>
                )}

                {!isHighlight && (
                  <div className="absolute top-4 right-4">
                    <span className="inline-block bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-blue-200">
                      {isFr ? "OFFRE LIMITÉE" : "LIMITED OFFER"}
                    </span>
                  </div>
                )}

                <div className="p-8">
                  <h3 className={`text-lg font-bold mb-2 ${isHighlight ? 'text-white' : 'text-slate-900'}`}>{plan.name}</h3>
                  
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className={`text-5xl font-extrabold ${isHighlight ? 'text-white' : 'text-slate-900'}`}>
                      {Number(plan.price).toFixed(0)}$
                    </span>
                    <span className={isHighlight ? 'text-white/60' : 'text-slate-400'}>/{isFr ? "mois" : "mo"}</span>
                  </div>

                  <div className="space-y-3 mb-8">
                    {features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-3 text-sm">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          isHighlight ? 'bg-white/20' : 'bg-emerald-50'
                        }`}>
                          <Check className={`w-3 h-3 ${isHighlight ? 'text-amber-300' : 'text-emerald-600'}`} />
                        </div>
                        <span className={isHighlight ? 'text-white/90' : 'text-slate-600'}>{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    asChild
                    className={`w-full rounded-xl h-12 font-bold text-base transition-all duration-200 hover:scale-[1.02] ${
                      isHighlight
                        ? "bg-amber-400 hover:bg-amber-300 text-slate-900 shadow-lg"
                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-md"
                    }`}
                  >
                    <Link to={LINK_BY_CATEGORY[plan.category] || "/compare"}>
                      {isFr ? "Choisir ce plan" : "Choose this plan"}
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
