import { Wifi, Smartphone, Tv, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { usePublicServices } from "@/hooks/usePublicServices";
import { Skeleton } from "@/components/ui/skeleton";

const ServiceShowcase = () => {
  const { data: services, isLoading } = usePublicServices();

  const getStartingPrice = (category: string): string => {
    if (!services) return "--";
    const categoryServices = services.filter(s => s.category === category);
    if (categoryServices.length === 0) return "--";
    const minPrice = Math.min(...categoryServices.map(s => Number(s.price)));
    return minPrice.toFixed(0);
  };

  const serviceCards = [
    {
      icon: Wifi,
      title: "Internet",
      description: "Internet haute vitesse illimité avec installation professionnelle incluse",
      category: "Internet",
      features: ["Jusqu'à 1 Gbps", "Données illimitées", "Routeur WiFi inclus"],
      popular: true,
      link: "/internet",
    },
    {
      icon: Smartphone,
      title: "Mobile",
      description: "Forfaits prépayés flexibles sur le réseau national 5G/LTE",
      category: "Mobile",
      features: ["Réseau 5G/LTE", "Appels Canada illimités", "Sans contrat"],
      link: "/mobile",
    },
    {
      icon: Tv,
      title: "Internet + TV",
      description: "Combinez Internet et TV pour une expérience complète",
      category: "TV",
      features: ["Internet haute vitesse", "Chaînes populaires", "Terminal 4K inclus"],
      link: "/tv",
    },
  ];

  if (isLoading) {
    return (
      <section className="py-16 bg-slate-50">
        <div className="container mx-auto px-4 max-w-7xl">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-5 w-96 mb-10" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-[380px] rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="services" className="py-16 bg-slate-50">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Bell-style: left-aligned bold title */}
        <div className="mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
            Nos services
          </h2>
          <p className="text-slate-500 text-lg">
            Des solutions télécoms complètes pour la maison et l'entreprise
          </p>
        </div>

        {/* Service Cards — clean white cards on gray background */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {serviceCards.map((service) => (
            <div
              key={service.title}
              className={`relative bg-white rounded-2xl border overflow-hidden transition-all duration-300 hover:shadow-lg ${
                service.popular 
                  ? 'border-[#003366] shadow-md' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              {/* Popular badge */}
              {service.popular && (
                <div className="absolute top-0 right-0">
                  <div className="bg-[#003366] text-white text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 rounded-bl-xl">
                    Populaire
                  </div>
                </div>
              )}

              <div className="p-6">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-5 ${
                  service.popular ? 'bg-blue-50' : 'bg-slate-50'
                }`}>
                  <service.icon className={`w-7 h-7 ${service.popular ? 'text-[#003366]' : 'text-slate-600'}`} />
                </div>

                <h3 className="text-xl font-bold text-slate-900 mb-2">{service.title}</h3>
                <p className="text-slate-500 text-sm mb-5 leading-relaxed">{service.description}</p>

                <ul className="space-y-2.5 mb-6">
                  {service.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2.5 text-sm text-slate-700">
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="pt-5 border-t border-slate-100">
                  <div className="mb-4">
                    <span className="text-sm text-slate-400">À partir de</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-slate-900">
                        {getStartingPrice(service.category)}$
                      </span>
                      <span className="text-slate-400">/mois</span>
                    </div>
                  </div>
                  <Button 
                    asChild 
                    className={`w-full rounded-full h-11 font-semibold ${
                      service.popular 
                        ? 'bg-[#003366] hover:bg-[#002244] text-white' 
                        : 'bg-white border-2 border-[#003366] text-[#003366] hover:bg-[#003366] hover:text-white'
                    }`}
                    variant={service.popular ? "default" : "outline"}
                  >
                    <Link to={service.link}>
                      Voir les forfaits
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bundle Banner — Bell-style dark navy */}
        <div className="bg-[#003366] rounded-2xl p-8 lg:p-10 text-center">
          <h3 className="text-2xl font-bold text-white mb-2">
            Combinez et économisez
          </h3>
          <p className="text-white/75 mb-6 max-w-lg mx-auto">
            Regroupez Internet, TV et Mobile pour profiter de rabais exclusifs sur votre facture mensuelle
          </p>
          <Button 
            className="bg-white text-[#003366] hover:bg-slate-100 rounded-full px-8 h-12 text-base font-semibold"
            asChild
          >
            <Link to="/contact">
              Créer mon forfait personnalisé
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ServiceShowcase;
