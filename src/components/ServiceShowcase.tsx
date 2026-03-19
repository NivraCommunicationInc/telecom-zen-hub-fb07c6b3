import { useMemo } from "react";
import { Wifi, Smartphone, Layers, ArrowRight, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { usePublicServices } from "@/hooks/usePublicServices";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";

const ServiceShowcase = () => {
  const { data: services, isLoading } = usePublicServices({ surface: "website" });
  const { language } = useLanguage();
  const isFr = language === 'fr';

  const serviceCards = useMemo(() => {
    const buildCard = (
      category: string,
      icon: typeof Wifi,
      title: string,
      subtitle: string,
      link: string,
      features: string[],
    ) => {
      const categoryServices = (services || []).filter((service) => service.category === category);
      const minPrice = categoryServices.length > 0 ? Math.min(...categoryServices.map((item) => Number(item.price))) : null;
      return { icon, title, subtitle, link, startingPrice: minPrice, features };
    };

    return [
      buildCard("Internet", Wifi, "Internet",
        isFr ? "Vitesse et fiabilité" : "Speed and reliability",
        "/internet",
        isFr ? ["Illimité", "Installation rapide", "Routeur inclus"] : ["Unlimited", "Fast install", "Router included"]),
      buildCard("Mobile", Smartphone, "Mobile",
        isFr ? "Forfaits prépayés" : "Prepaid plans",
        "/mobile",
        isFr ? ["Données flexibles", "Appels illimités", "eSIM disponible"] : ["Flexible data", "Unlimited calls", "eSIM available"]),
      {
        icon: Layers,
        title: isFr ? "Combos" : "Bundles",
        subtitle: isFr ? "Internet + Mobile" : "Internet + Mobile",
        link: "/compare",
        startingPrice: null,
        features: isFr ? ["Économisez plus", "Gestion simplifiée", "Flexibilité totale"] : ["Save more", "Simple management", "Total flexibility"],
      },
    ];
  }, [services, isFr]);

  if (isLoading) {
    return (
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4 max-w-[1320px]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[320px] rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="services" className="py-16 lg:py-24 bg-slate-50">
      <div className="container mx-auto px-4 max-w-[1320px]">
        <div className="text-center mb-12">
          <p className="text-amber-600 text-sm font-bold uppercase tracking-[0.15em] mb-3">
            {isFr ? "NOS SERVICES" : "OUR SERVICES"}
          </p>
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">
            {isFr ? "Tout ce dont vous avez besoin" : "Everything you need"}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {serviceCards.map((service) => (
            <Link
              key={service.title}
              to={service.link}
              className="group relative bg-white rounded-xl border-2 border-slate-200 p-7 transition-all duration-300 hover:border-amber-400 hover:shadow-xl"
            >
              <div className="w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center mb-5">
                <service.icon className="w-6 h-6 text-amber-400" />
              </div>

              <h3 className="text-2xl font-black text-slate-900 mb-1">{service.title}</h3>
              <p className="text-slate-500 text-sm mb-5">{service.subtitle}</p>

              {service.startingPrice != null && (
                <div className="mb-5">
                  <span className="text-xs text-slate-400 uppercase tracking-wider">{isFr ? "À partir de" : "Starting at"}</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-slate-900">{service.startingPrice.toFixed(0)}$</span>
                    <span className="text-slate-400 text-sm">/{isFr ? "mois" : "mo"}</span>
                  </div>
                </div>
              )}

              <div className="space-y-2 mb-6">
                {service.features.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-slate-600">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 text-amber-600 text-sm font-bold uppercase tracking-wider group-hover:gap-3 transition-all">
                {isFr ? "Voir les détails" : "View details"}
                <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServiceShowcase;
