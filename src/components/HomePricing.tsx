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
      <section className="py-16 lg:py-20 bg-secondary/40">
        <div className="container mx-auto px-4 sm:px-6 max-w-[1200px]">
          <Skeleton className="h-8 w-56 mx-auto mb-3" />
          <Skeleton className="h-5 w-72 mx-auto mb-10" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-[380px] rounded-2xl" />)}
          </div>
        </div>
      </section>
    );
  }

  if (plans.length === 0) return null;

  return (
    <section id="forfaits" className="py-16 lg:py-20 bg-secondary/40">
      <div className="container mx-auto px-4 sm:px-6 max-w-[1200px]">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
            Choisissez votre forfait
          </h2>
          <p className="text-muted-foreground text-lg">
            Internet illimité, sans contrat
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6 items-stretch mb-6 max-w-[960px] mx-auto">
          {plans.map((plan) => (
            <Link
              key={plan.id}
              to="/internet"
              className={`group relative bg-card rounded-2xl overflow-hidden transition-all duration-200 block ${
                plan.recommended
                  ? "border-2 border-primary shadow-lg md:scale-[1.03] z-10"
                  : "border border-border hover:border-primary/30 shadow-sm hover:shadow-md"
              }`}
            >
              <div className={`h-1 w-full ${plan.recommended ? "bg-primary" : "bg-transparent"}`} />

              {plan.recommended && (
                <div className="absolute top-4 right-4 z-10">
                  <div className="flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full">
                    <Star className="w-3 h-3 fill-current" />
                    Recommandé
                  </div>
                </div>
              )}

              <div className="p-6 lg:p-7 flex flex-col h-full">
                <h3 className="text-lg font-bold text-foreground mb-1 pr-20 group-hover:text-primary transition-colors">
                  {plan.name}
                </h3>
                {plan.speed && (
                  <p className="text-xs text-muted-foreground mb-5">{plan.speed}</p>
                )}

                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className={`font-black text-foreground leading-none ${plan.recommended ? "text-5xl" : "text-4xl"}`}>
                      {plan.price.toFixed(0)}$
                    </span>
                    <span className="text-muted-foreground text-sm font-medium">/mois</span>
                  </div>
                </div>

                <div className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-sm">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{f}</span>
                    </div>
                  ))}
                </div>

                <div className={`w-full rounded-full flex items-center justify-center gap-2 font-bold text-sm transition-all duration-200 ${
                  plan.recommended
                    ? "h-12 bg-primary text-primary-foreground"
                    : "h-10 bg-secondary text-foreground group-hover:bg-primary group-hover:text-primary-foreground"
                }`}>
                  Choisir
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Taxes en sus • Équipement en option si applicable
        </p>
      </div>
    </section>
  );
};

export default HomePricing;
