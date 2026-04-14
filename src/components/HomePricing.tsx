/**
 * HomePricing — Dynamic pricing cards, Xfinity-inspired dark style
 */
import { useMemo } from "react";
import { usePublicServices } from "@/hooks/usePublicServices";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, ArrowRight, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const HomePricing = () => {
  const { t } = useLanguage();
  const { data: services, isLoading } = usePublicServices({ surface: "website", categories: ["Internet"] });

  const plans = useMemo(() => {
    if (!services?.length) return [];
    return services
      .sort((a, b) => {
        if (a.display_order !== b.display_order) return a.display_order - b.display_order;
        return a.price - b.price;
      })
      .slice(0, 3)
      .map((s, idx) => {
        const features = s.features_json.length > 0
          ? s.features_json.slice(0, 3)
          : (s.short_description || s.description || "").split(/•|\||;/g).map(f => f.trim()).filter(Boolean).slice(0, 3);

        const speedMatch = s.name.match(/(\d+)\s*(Mbps|Gbps|Giga)/i) || (s.description || "").match(/(\d+)\s*(Mbps|Gbps)/i);
        const speed = speedMatch ? `${speedMatch[1]} ${speedMatch[2]}` : null;

        return {
          id: s.id,
          name: s.name,
          price: Number(s.price),
          speed,
          features,
          recommended: Boolean(s.is_recommended || s.is_featured) || idx === 1,
        };
      });
  }, [services]);

  if (isLoading) {
    return (
      <section className="py-16 lg:py-20 bg-[#111111]">
        <div className="container mx-auto px-4 sm:px-6 max-w-[1200px]">
          <Skeleton className="h-8 w-56 mx-auto mb-3 bg-white/10" />
          <Skeleton className="h-5 w-72 mx-auto mb-10 bg-white/10" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-[380px] rounded-2xl bg-white/5" />)}
          </div>
        </div>
      </section>
    );
  }

  if (plans.length === 0) return null;

  return (
    <section id="forfaits" className="py-20 lg:py-28 bg-[#111111]">
      <div className="container mx-auto px-4 sm:px-6 max-w-[1200px]">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-[2.5rem] font-bold text-white mb-4 tracking-[-0.025em]">
            {t('pricing.title')}
          </h2>
          <p className="text-white/60 text-lg">
            {t('pricing.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-7 items-stretch mb-8 max-w-[960px] mx-auto">
          {plans.map((plan) => (
            <Link
              key={plan.id}
              to={`/commander?plan=${plan.id}`}
              className={`group relative rounded-3xl overflow-hidden transition-all duration-300 block ${
                plan.recommended
                  ? "border-2 border-purple-500 shadow-[0_0_30px_rgba(139,92,246,0.15)] md:scale-[1.02] z-10 bg-[#1a1a1a]"
                  : "border border-white/10 hover:border-purple-500/40 bg-[#1a1a1a] hover:shadow-[0_0_20px_rgba(139,92,246,0.1)]"
              }`}
            >
              {plan.recommended && (
                <div className="absolute top-4 right-4 z-10">
                  <div className="flex items-center gap-1 bg-purple-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">
                    <Star className="w-3 h-3 fill-current" />
                    {t('pricing.recommended')}
                  </div>
                </div>
              )}

              <div className="p-7 lg:p-8 flex flex-col h-full">
                <h3 className="text-lg font-bold text-white mb-1 pr-20 group-hover:text-purple-400 transition-colors">
                  {plan.name}
                </h3>
                {plan.speed && (
                  <p className="text-xs text-white/50 mb-5">{plan.speed}</p>
                )}

                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className={`font-black text-white leading-none ${plan.recommended ? "text-5xl" : "text-4xl"}`}>
                      {plan.price.toFixed(0)}$
                    </span>
                    <span className="text-white/50 text-sm font-medium">/mois</span>
                  </div>
                </div>

                <div className="space-y-3 mb-7 flex-1">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-sm">
                      <Check className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <span className="text-white/60">{f}</span>
                    </div>
                  ))}
                </div>

                <div className={`w-full rounded-full flex items-center justify-center gap-2 font-bold text-sm transition-all duration-200 ${
                  plan.recommended
                    ? "h-12 bg-white text-black"
                    : "h-10 bg-white/10 text-white group-hover:bg-white group-hover:text-black"
                }`}>
                  {t('pricing.choose')}
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        <p className="text-center text-xs text-white/40">
          {t('pricing.disclaimer')}
        </p>
      </div>
    </section>
  );
};

export default HomePricing;
