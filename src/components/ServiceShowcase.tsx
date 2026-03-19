import { useMemo } from "react";
import { Wifi, Smartphone, Layers, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { usePublicServices, type PublicService } from "@/hooks/usePublicServices";
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
      fallbackDescription: string,
    ) => {
      const categoryServices = (services || []).filter((service) => service.category === category);
      const minPrice = categoryServices.length > 0 ? Math.min(...categoryServices.map((item) => Number(item.price))) : null;

      return { icon, title, subtitle, link, startingPrice: minPrice };
    };

    return [
      buildCard("Internet", Wifi, "Internet",
        isFr ? "À partir de 45$/mois" : "Starting at $45/mo",
        "/internet", ""),
      buildCard("Mobile", Smartphone, "Mobile",
        isFr ? "Forfaits flexibles" : "Flexible plans",
        "/mobile", ""),
      {
        icon: Layers,
        title: isFr ? "Combos" : "Bundles",
        subtitle: isFr ? "Économisez avec nos offres combinées" : "Save with our combined offers",
        link: "/compare",
        startingPrice: null,
      },
    ];
  }, [services, isFr]);

  if (isLoading) {
    return (
      <section className="py-20">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[260px] rounded-2xl bg-white/5" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="services" className="py-20 lg:py-28">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="text-center mb-14">
          <h2 className="text-2xl md:text-4xl font-bold text-white mb-4">
            {isFr ? "Offres principales" : "Main Offers"}
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            {isFr ? "Des solutions simples pour tous vos besoins" : "Simple solutions for all your needs"}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {serviceCards.map((service) => (
            <Link
              key={service.title}
              to={service.link}
              className="group relative bg-[#0B1220] rounded-2xl border border-white/8 p-8 transition-all duration-300 hover:border-blue-500/40 hover:shadow-xl hover:shadow-blue-500/5"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:bg-blue-500/15 transition-colors">
                <service.icon className="w-7 h-7 text-blue-400" />
              </div>

              <h3 className="text-xl font-bold text-white mb-2">{service.title}</h3>
              <p className="text-white/50 text-sm mb-6">{service.subtitle}</p>

              {service.startingPrice != null && (
                <div className="mb-6">
                  <span className="text-3xl font-bold text-white">{service.startingPrice.toFixed(0)}$</span>
                  <span className="text-white/40 ml-1">/{isFr ? "mois" : "mo"}</span>
                </div>
              )}

              <div className="flex items-center gap-2 text-blue-400 text-sm font-medium group-hover:gap-3 transition-all">
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
