import { Wifi, Smartphone, Tv, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { usePublicServices } from "@/hooks/usePublicServices";
import { Skeleton } from "@/components/ui/skeleton";

const ServiceShowcase = () => {
  const { data: services, isLoading } = usePublicServices();

  // Get actual starting prices from database
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
      features: [
        "Jusqu'à 1 Gbps",
        "Données illimitées",
        "Routeur WiFi inclus",
      ],
      popular: true,
      link: "/internet",
    },
    {
      icon: Smartphone,
      title: "Mobile",
      description: "Forfaits prépayés flexibles sur le réseau national 5G/LTE",
      category: "Mobile",
      features: [
        "Réseau 5G/LTE",
        "Appels Canada illimités",
        "Sans contrat",
      ],
      link: "/mobile",
    },
    {
      icon: Tv,
      title: "Internet + TV",
      description: "Combinez Internet et TV pour une expérience complète",
      category: "TV",
      features: [
        "Internet haute vitesse",
        "Chaînes populaires",
        "Terminal 4K inclus",
      ],
      link: "/tv",
    },
  ];

  if (isLoading) {
    return (
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <Skeleton className="h-8 w-48 mx-auto mb-4" />
            <Skeleton className="h-12 w-96 mx-auto" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-[400px] rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-4">
            Nos services
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Tout pour rester connecté
          </h2>
          <p className="text-muted-foreground text-lg">
            Des solutions télécoms complètes pour la maison et l'entreprise
          </p>
        </div>

        {/* Service Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {serviceCards.map((service) => (
            <div
              key={service.title}
              className={`
                relative bg-card rounded-2xl border transition-all duration-300 overflow-hidden
                ${service.popular 
                  ? 'border-accent shadow-lg ring-1 ring-accent/20' 
                  : 'border-border hover:border-accent/40 hover:shadow-md'
                }
              `}
            >
              {/* Popular badge */}
              {service.popular && (
                <div className="absolute top-0 right-0">
                  <div className="bg-accent text-accent-foreground text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-bl-xl">
                    Populaire
                  </div>
                </div>
              )}

              <div className="p-6">
                {/* Icon */}
                <div className={`
                  w-14 h-14 rounded-xl flex items-center justify-center mb-5
                  ${service.popular ? 'bg-accent/15' : 'bg-muted'}
                `}>
                  <service.icon className={`w-7 h-7 ${service.popular ? 'text-accent' : 'text-primary'}`} />
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-foreground mb-2">
                  {service.title}
                </h3>
                
                {/* Description */}
                <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
                  {service.description}
                </p>

                {/* Features */}
                <ul className="space-y-2.5 mb-6">
                  {service.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2.5 text-sm text-foreground">
                      <Check className="w-4 h-4 text-accent flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Price */}
                <div className="pt-5 border-t border-border">
                  <div className="mb-4">
                    <span className="text-sm text-muted-foreground">À partir de</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-foreground">
                        {getStartingPrice(service.category)}$
                      </span>
                      <span className="text-muted-foreground">/mois</span>
                    </div>
                  </div>
                  <Button 
                    asChild 
                    className={`w-full ${service.popular ? '' : 'bg-primary hover:bg-navy-700'}`}
                    variant={service.popular ? "accent" : "default"}
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

        {/* Bundle Banner */}
        <div className="bg-gradient-to-r from-primary to-navy-700 rounded-2xl p-8 text-center">
          <h3 className="text-2xl font-bold text-white mb-2">
            Combinez et économisez
          </h3>
          <p className="text-white/80 mb-6 max-w-lg mx-auto">
            Regroupez Internet, TV et Mobile pour profiter de rabais exclusifs sur votre facture mensuelle
          </p>
          <Button variant="hero" size="lg" asChild>
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
