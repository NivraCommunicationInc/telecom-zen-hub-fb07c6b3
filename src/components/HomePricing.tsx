/**
 * HomePricing — Dynamic pricing cards from canonical catalog
 * No hardcoded prices. Skeleton loader while loading.
 */
import { useMemo } from "react";
import { usePublicServices } from "@/hooks/usePublicServices";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, ArrowRight, Star } from "lucide-react";
import { Link } from "react-router-dom";

const HomePricing = () => {
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
      <section className="py-24 lg:py-32 bg-secondary/30">
        <div className="container mx-auto px-4 sm:px-6 max-w-[1200px]">
          <Skeleton className="h-10 w-64 mx-auto mb-4" />
          <Skeleton className="h-6 w-80 mx-auto mb-14" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-[440px] rounded-3xl" />)}
          </div>
        </div>
      </section>
    );
  }

  if (plans.length === 0) return null;

  return (
    <section id="forfaits" className="py-24 lg:py-36 bg-secondary/30">
      <div className="container mx-auto px-4 sm:px-6 max-w-[1200px]">
        <div className="text-center mb-16 lg:mb-20">
          <h2 className="text-3xl md:text-[2.75rem] font-bold text-foreground mb-5 tracking-[-0.03em]">
            Choisissez votre forfait
          </h2>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Internet illimité, sans contrat
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10 items-stretch mb-10 max-w-[1020px] mx-auto">
          {plans.map((plan) => (
            <Link
              key={plan.id}
              to={`/commander?plan=${plan.id}`}
              className={`group relative bg-card rounded-3xl overflow-hidden transition-all duration-300 block hover:-translate-y-1 ${
                plan.recommended
                  ? "border-2 border-primary shadow-xl md:scale-[1.04] z-10 ring-4 ring-primary/10"
                  : "border border-border hover:border-primary/30 shadow-md hover:shadow-xl"
              }`}
            >
              <div className={`h-1.5 w-full ${plan.recommended ? "bg-primary" : "bg-transparent"}`} />

              {plan.recommended && (
                <div className="absolute top-5 right-5 z-10">
                  <div className="flex items-center gap-1.5 bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wider px-4 py-2 rounded-full shadow-md">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    Recommandé
                  </div>
                </div>
              )}

              <div className="p-8 lg:p-10 flex flex-col h-full">
                <h3 className="text-xl font-bold text-foreground mb-1.5 pr-24 group-hover:text-primary transition-colors duration-200">
                  {plan.name}
                </h3>
                {plan.speed && (
                  <p className="text-sm text-muted-foreground mb-6 font-medium">{plan.speed}</p>
                )}

                <div className="mb-8">
                  <div className="flex items-baseline gap-1.5">
                    <span className={`font-black text-foreground leading-none ${plan.recommended ? "text-6xl" : "text-5xl"}`}>
                      {plan.price.toFixed(0)}$
                    </span>
                    <span className="text-muted-foreground text-base font-medium">/mois</span>
                  </div>
                </div>

                <div className="space-y-4 mb-8 flex-1">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-emerald-600" />
                      </div>
                      <span className="text-muted-foreground leading-snug">{f}</span>
                    </div>
                  ))}
                </div>

                <div className={`w-full rounded-2xl flex items-center justify-center gap-2 font-bold text-sm transition-all duration-300 ${
                  plan.recommended
                    ? "h-14 bg-primary text-primary-foreground shadow-md"
                    : "h-12 bg-secondary text-foreground group-hover:bg-primary group-hover:text-primary-foreground"
                }`}>
                  Choisir
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Taxes en sus • Équipement en option si applicable
        </p>
      </div>
    </section>
  );
};

export default HomePricing;
