import { useMemo } from "react";
import { Wifi, Smartphone, Layers, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { usePublicServices } from "@/hooks/usePublicServices";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";

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
      badge?: string,
      gradient?: string,
    ) => {
      const categoryServices = (services || []).filter((service) => service.category === category);
      const minPrice = categoryServices.length > 0 ? Math.min(...categoryServices.map((item) => Number(item.price))) : null;
      return { icon, title, subtitle, link, startingPrice: minPrice, badge, gradient };
    };

    return [
      buildCard("Internet", Wifi, "Internet",
        isFr ? "Vitesse et fiabilité" : "Speed and reliability",
        "/internet",
        isFr ? "POPULAIRE" : "POPULAR",
        "from-blue-600 to-blue-700"),
      buildCard("Mobile", Smartphone, "Mobile",
        isFr ? "Forfaits flexibles" : "Flexible plans",
        "/mobile",
        isFr ? "NOUVEAU" : "NEW",
        "from-indigo-600 to-purple-700"),
      {
        icon: Layers,
        title: isFr ? "Combos" : "Bundles",
        subtitle: isFr ? "Économisez avec nos offres combinées" : "Save with our combined offers",
        link: "/compare",
        startingPrice: null,
        badge: isFr ? "ÉCONOMIE" : "SAVINGS",
        gradient: "from-emerald-600 to-teal-700",
      },
    ];
  }, [services, isFr]);

  if (isLoading) {
    return (
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[320px] rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="services" className="py-20 lg:py-28 bg-slate-50">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
            {isFr ? "Nos services" : "Our Services"}
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            {isFr ? "Des solutions simples pour tous vos besoins" : "Simple solutions for all your needs"}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {serviceCards.map((service) => (
            <Link
              key={service.title}
              to={service.link}
              className="group relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
            >
              {/* Gradient background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${service.gradient} opacity-100`} />
              
              {/* Content */}
              <div className="relative p-8 min-h-[280px] flex flex-col justify-between">
                {service.badge && (
                  <div className="self-start">
                    <span className="inline-block bg-white/20 backdrop-blur-sm text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-white/30">
                      {service.badge}
                    </span>
                  </div>
                )}

                <div className="mt-auto">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-5">
                    <service.icon className="w-7 h-7 text-white" />
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-2">{service.title}</h3>
                  <p className="text-white/80 text-sm mb-5">{service.subtitle}</p>

                  {service.startingPrice != null && (
                    <div className="mb-5">
                      <span className="text-sm text-white/60">{isFr ? "À partir de" : "Starting at"}</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-extrabold text-white">{service.startingPrice.toFixed(0)}$</span>
                        <span className="text-white/60">/{isFr ? "mois" : "mo"}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-white text-sm font-semibold group-hover:gap-3 transition-all">
                    {isFr ? "Voir les détails" : "View details"}
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServiceShowcase;
