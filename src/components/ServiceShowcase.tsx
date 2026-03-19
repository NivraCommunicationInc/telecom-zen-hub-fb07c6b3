import { useMemo } from "react";
import { Wifi, Smartphone, Tv, ArrowRight, Check, Zap, Shield, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { usePublicServices, type PublicService } from "@/hooks/usePublicServices";
import { Skeleton } from "@/components/ui/skeleton";

const ServiceShowcase = () => {
  const { data: services, isLoading } = usePublicServices({ surface: "website" });

  const serviceCards = useMemo(() => {
    const buildCard = (
      category: string,
      icon: typeof Wifi,
      title: string,
      link: string,
      fallbackDescription: string,
      popular = false,
    ) => {
      const categoryServices = (services || []).filter((service) => service.category === category);
      const lead = categoryServices
        .sort((a, b) => {
          const aScore = (a.is_featured ? 2 : 0) + (a.is_recommended ? 1 : 0);
          const bScore = (b.is_featured ? 2 : 0) + (b.is_recommended ? 1 : 0);
          if (bScore !== aScore) return bScore - aScore;
          if (a.display_order !== b.display_order) return a.display_order - b.display_order;
          return a.price - b.price;
        })[0];

      const features = (lead?.features_json?.length ? lead.features_json : (lead?.description || "").split(/•|\||;/g).map((f) => f.trim()).filter(Boolean))
        .slice(0, 3);

      const minPrice = categoryServices.length > 0 ? Math.min(...categoryServices.map((item) => Number(item.price))) : null;

      return {
        icon,
        title,
        description: lead?.short_description || lead?.description || fallbackDescription,
        features,
        popular: popular || Boolean(lead?.is_featured),
        link,
        startingPrice: minPrice,
      };
    };

    return [
      buildCard("Internet", Wifi, "Internet", "/internet", "Internet haute vitesse illimité", true),
      buildCard("Mobile", Smartphone, "Mobile", "/mobile", "Forfaits prépayés flexibles"),
      buildCard("TV", Tv, "Combos Internet + TV", "/tv", "Combinez Internet et TV pour économiser"),
    ];
  }, [services]);

  if (isLoading) {
    return (
      <section className="py-20 bg-secondary/50">
        <div className="container mx-auto px-4 max-w-7xl">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-5 w-96 mb-12" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[420px] rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="services" className="py-20 bg-secondary/50">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Section header */}
        <div className="mb-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">Nos services</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Des solutions télécoms complètes pour la maison et l'entreprise
          </p>
        </div>

        {/* Trust micro-bar */}
        <div className="flex flex-wrap items-center justify-center gap-6 mb-12">
          {[
            { icon: Shield, text: "Sans contrat" },
            { icon: Clock, text: "Activation rapide" },
            { icon: Zap, text: "Fibre optique" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-2 text-sm text-muted-foreground">
              <item.icon className="w-4 h-4 text-primary" />
              <span className="font-medium">{item.text}</span>
            </div>
          ))}
        </div>

        {/* Service cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-14">
          {serviceCards.map((service) => (
            <Link
              key={service.title}
              to={service.link}
              className={`group relative bg-card rounded-2xl border overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 block ${
                service.popular
                  ? "border-primary ring-2 ring-primary/10 shadow-lg"
                  : "border-border hover:border-primary/40"
              }`}
            >
              {/* Popular ribbon */}
              {service.popular && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
              )}
              {service.popular && (
                <div className="absolute top-3 right-3 z-10">
                  <span className="bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full shadow-md">
                    Populaire
                  </span>
                </div>
              )}

              <div className="p-7">
                {/* Icon */}
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-colors duration-300 ${
                  service.popular
                    ? "bg-primary/10 group-hover:bg-primary/15"
                    : "bg-secondary group-hover:bg-primary/10"
                }`}>
                  <service.icon className={`w-8 h-8 transition-colors duration-300 ${
                    service.popular ? "text-primary" : "text-muted-foreground group-hover:text-primary"
                  }`} />
                </div>

                {/* Title & description */}
                <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                  {service.title}
                </h3>
                <p className="text-muted-foreground text-sm mb-6 leading-relaxed line-clamp-2">
                  {service.description}
                </p>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {service.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-sm text-foreground">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-emerald-600" />
                      </div>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Price + CTA */}
                <div className="pt-6 border-t border-border">
                  <div className="mb-5">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">À partir de</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-4xl font-extrabold text-foreground">
                        {service.startingPrice != null ? `${service.startingPrice.toFixed(0)}$` : "--"}
                      </span>
                      <span className="text-muted-foreground text-sm font-medium">/mois</span>
                    </div>
                  </div>
                  <div
                    className={`w-full rounded-full h-12 font-semibold flex items-center justify-center gap-2 transition-all duration-300 text-base ${
                      service.popular
                        ? "bg-primary text-primary-foreground group-hover:bg-primary/90 shadow-md"
                        : "bg-secondary text-foreground group-hover:bg-primary group-hover:text-primary-foreground border border-border group-hover:border-primary"
                    }`}
                  >
                    Voir les forfaits
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Combo banner */}
        <div className="bg-primary rounded-2xl p-8 lg:p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-white/5 to-transparent" />
          </div>
          <div className="relative">
            <h3 className="text-2xl md:text-3xl font-bold text-primary-foreground mb-3">Combinez et économisez</h3>
            <p className="text-primary-foreground/70 mb-8 max-w-lg mx-auto text-lg">
              Regroupez Internet, TV et Mobile pour profiter de rabais exclusifs sur votre facture mensuelle
            </p>
            <Button className="bg-white text-primary hover:bg-white/90 rounded-full px-10 h-13 text-base font-bold shadow-lg" asChild>
              <Link to="/contact">
                Créer mon forfait personnalisé
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ServiceShowcase;
