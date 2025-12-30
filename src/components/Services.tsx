import { Smartphone, Wifi, Tv, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const services = [
  {
    icon: Smartphone,
    title: "Téléphonie mobile",
    description: "Forfaits cellulaires et contrats d'appareils négociés au meilleur prix pour particuliers et entreprises.",
    features: ["Forfaits sur mesure", "Négociation de contrats", "Rabais employeur"],
  },
  {
    icon: Wifi,
    title: "Internet",
    description: "Services internet résidentiels et commerciaux optimisés selon vos besoins réels de connexion.",
    features: ["Haute vitesse", "Fibre optique", "Solutions affaires"],
  },
  {
    icon: Tv,
    title: "Télévision",
    description: "Forfaits TV pour la maison et les entreprises avec accès aux meilleures chaînes et contenus.",
    features: ["Chaînes HD", "Forfaits flexibles", "Multi-écrans"],
  },
  {
    icon: ShieldCheck,
    title: "Sécurité",
    description: "Systèmes de sécurité résidentiels et commerciaux pour protéger ce qui compte le plus.",
    features: ["Surveillance 24/7", "Domotique", "Alarmes intelligentes"],
  },
];

const Services = () => {
  return (
    <section id="services" className="py-20 md:py-32 bg-background relative overflow-hidden">
      {/* Subtle 3D Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 -right-20 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-20 w-60 h-60 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative">
        {/* Section Header with 3D Text */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4 card-3d">
            Nos Services
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Tous vos services télécoms,{" "}
            <span className="text-gradient">optimisés</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Nous comparons, négocions et sécurisons les meilleures offres du marché québécois pour chacun de vos besoins.
          </p>
        </div>

        {/* Services Grid with 3D Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {services.map((service, index) => (
            <div
              key={service.title}
              className="group relative bg-card rounded-2xl p-6 shadow-card hover:shadow-xl transition-all duration-500 border border-border hover:border-accent/30 animate-fade-in card-3d"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Icon with 3D Effect */}
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500/15 to-cyan-400/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <service.icon className="w-7 h-7 text-accent" />
              </div>

              {/* Content */}
              <h3 className="font-display text-xl font-bold text-foreground mb-3">
                {service.title}
              </h3>
              <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
                {service.description}
              </p>

              {/* Features */}
              <ul className="space-y-2 mb-6">
                {service.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-glow" />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Link - Navigate to contact */}
              <Button variant="ghost" size="sm" className="group/btn text-accent p-0 h-auto font-semibold" asChild>
                <Link to="/book">
                  En savoir plus
                  <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                </Link>
              </Button>

              {/* Hover Gradient with Depth */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              {/* 3D Card Shine Effect */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;