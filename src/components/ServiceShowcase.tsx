import { Wifi, Smartphone, Tv, Shield, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { usePublicServices } from "@/hooks/usePublicServices";

interface ServiceCardData {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  startingPrice: string;
  features: string[];
  badge?: string;
  badgeColor?: string;
  link: string;
  gradient: string;
}

const ServiceShowcase = () => {
  const { data: services } = usePublicServices();

  // Get actual starting prices from database
  const getStartingPrice = (category: string): string => {
    if (!services) return "--";
    const categoryServices = services.filter(s => s.category === category);
    if (categoryServices.length === 0) return "--";
    const minPrice = Math.min(...categoryServices.map(s => Number(s.price)));
    return minPrice.toFixed(0);
  };

  const serviceCards: ServiceCardData[] = [
    {
      icon: Wifi,
      title: "Internet",
      description: "Internet haute vitesse illimité avec installation professionnelle",
      startingPrice: getStartingPrice("Internet"),
      features: [
        "Jusqu'à 1 Gbps",
        "Données illimitées",
        "Routeur WiFi 6 inclus",
        "Installation pro"
      ],
      badge: "Populaire",
      badgeColor: "bg-accent",
      link: "/internet",
      gradient: "from-accent/20 to-teal-400/20"
    },
    {
      icon: Smartphone,
      title: "Mobile",
      description: "Forfaits prépayés flexibles sur le réseau national 5G/LTE",
      startingPrice: getStartingPrice("Mobile"),
      features: [
        "Réseau 5G/LTE",
        "Appels Canada illimités",
        "Sans contrat",
        "Activation rapide"
      ],
      badge: "Sans contrat",
      badgeColor: "bg-cyan-500",
      link: "/mobile",
      gradient: "from-cyan-500/20 to-blue-500/20"
    },
    {
      icon: Tv,
      title: "Télévision",
      description: "IPTV premium avec 200+ chaînes et contenu à la demande",
      startingPrice: getStartingPrice("TV"),
      features: [
        "200+ chaînes",
        "Sports & nouvelles",
        "Terminal 4K inclus",
        "Guide interactif"
      ],
      link: "/tv",
      gradient: "from-purple-500/20 to-pink-500/20"
    },
    {
      icon: Shield,
      title: "Sécurité",
      description: "Solutions de sécurité connectée pour votre maison et entreprise",
      startingPrice: getStartingPrice("Sécurité"),
      features: [
        "Caméras HD/4K",
        "Détecteurs mouvement",
        "Appli mobile",
        "Alertes en temps réel"
      ],
      link: "/contact",
      gradient: "from-orange-500/20 to-red-500/20"
    }
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-4">
            Nos services
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-5">
            Tout pour rester connecté
          </h2>
          <p className="text-lg text-muted-foreground">
            Des solutions télécoms complètes pour la maison et l'entreprise. 
            Un seul fournisseur, une seule facture.
          </p>
        </div>

        {/* Service Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {serviceCards.map((service, index) => (
            <div
              key={service.title}
              className="group relative bg-card rounded-2xl border border-border overflow-hidden transition-all duration-300 hover:border-accent/40 hover:shadow-elevated animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Gradient header */}
              <div className={`h-2 bg-gradient-to-r ${service.gradient}`} />
              
              <div className="p-6">
                {/* Icon & Badge */}
                <div className="flex items-start justify-between mb-5">
                  <div className="w-14 h-14 rounded-xl bg-primary/5 flex items-center justify-center group-hover:bg-accent/10 transition-colors">
                    <service.icon className="w-7 h-7 text-primary group-hover:text-accent transition-colors" />
                  </div>
                  {service.badge && (
                    <span className={`text-[10px] font-bold uppercase tracking-wider text-white ${service.badgeColor} px-2.5 py-1 rounded-full`}>
                      {service.badge}
                    </span>
                  )}
                </div>

                {/* Title & Description */}
                <h3 className="text-xl font-bold text-foreground mb-2">
                  {service.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-5 leading-relaxed line-clamp-2">
                  {service.description}
                </p>

                {/* Features */}
                <ul className="space-y-2 mb-6">
                  {service.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-accent flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Price & CTA */}
                <div className="pt-5 border-t border-border">
                  <div className="flex items-end justify-between mb-4">
                    <div>
                      <span className="text-xs text-muted-foreground">À partir de</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-primary">{service.startingPrice}$</span>
                        <span className="text-sm text-muted-foreground">/mois</span>
                      </div>
                    </div>
                  </div>
                  <Button asChild className="w-full group/btn">
                    <Link to={service.link}>
                      Voir les forfaits
                      <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover/btn:translate-x-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bundle CTA */}
        <div className="mt-14 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-4 bg-accent/10 rounded-2xl border border-accent/20">
            <div className="text-left">
              <p className="font-semibold text-foreground">Combinez et économisez</p>
              <p className="text-sm text-muted-foreground">Internet + TV + Mobile = jusqu'à 20% de rabais</p>
            </div>
            <Button variant="accent" asChild>
              <Link to="/contact">
                Créer mon forfait
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ServiceShowcase;
