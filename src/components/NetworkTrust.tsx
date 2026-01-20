import { Shield, Zap, Headphones, MapPin, CheckCircle, Star } from "lucide-react";

const NetworkTrust = () => {
  const trustPoints = [
    {
      icon: MapPin,
      title: "Couverture provinciale",
      description: "Service disponible partout au Québec, des grandes villes aux régions."
    },
    {
      icon: Zap,
      title: "Activation rapide",
      description: "Mobile activé en moins de 24h. Internet installé dans les 3-5 jours."
    },
    {
      icon: Headphones,
      title: "Support local",
      description: "Équipe basée au Québec, disponible 7 jours sur 7 en français."
    },
    {
      icon: Shield,
      title: "Sans surprise",
      description: "Prix clairs, pas de frais cachés. Prépayé = vous gardez le contrôle."
    }
  ];

  const testimonials = [
    {
      name: "Marie L.",
      location: "Montréal",
      text: "Enfin un fournisseur qui répond au téléphone! Service impeccable.",
      rating: 5
    },
    {
      name: "Jean-François B.",
      location: "Québec",
      text: "Installation rapide et technicien professionnel. Je recommande.",
      rating: 5
    },
    {
      name: "Sophie T.",
      location: "Gatineau",
      text: "Forfait mobile parfait pour mes besoins, et le prix est imbattable.",
      rating: 5
    }
  ];

  return (
    <section className="py-20 bg-muted/50">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-4">
            Pourquoi Nivra
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Un fournisseur qui vous simplifie la vie
          </h2>
          <p className="text-muted-foreground text-lg">
            Pas de contrat à long terme, pas de frais cachés, juste des services fiables avec un support humain.
          </p>
        </div>

        {/* Trust Points Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
          {trustPoints.map((point, index) => (
            <div 
              key={point.title}
              className="bg-card rounded-xl p-6 border border-border hover:border-accent/30 hover:shadow-md transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                <point.icon className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{point.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{point.description}</p>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="mb-16">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-foreground mb-2">Ce que nos clients disent</h3>
            <p className="text-muted-foreground">Avis vérifiés de vrais clients Nivra</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((testimonial, index) => (
              <div 
                key={testimonial.name}
                className="bg-card rounded-xl p-6 border border-border"
              >
                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                
                {/* Quote */}
                <p className="text-foreground mb-4">"{testimonial.text}"</p>
                
                {/* Author */}
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-accent" />
                  <span className="font-medium text-foreground">{testimonial.name}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{testimonial.location}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Bar */}
        <div className="bg-primary rounded-2xl p-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl lg:text-4xl font-bold text-accent mb-1">99.9%</div>
              <div className="text-sm text-white/70">Disponibilité réseau</div>
            </div>
            <div>
              <div className="text-3xl lg:text-4xl font-bold text-white mb-1">5G/LTE</div>
              <div className="text-sm text-white/70">Réseau mobile</div>
            </div>
            <div>
              <div className="text-3xl lg:text-4xl font-bold text-white mb-1">1 Gbps</div>
              <div className="text-sm text-white/70">Vitesse fibre max</div>
            </div>
            <div>
              <div className="text-3xl lg:text-4xl font-bold text-accent mb-1">&lt;24h</div>
              <div className="text-sm text-white/70">Activation mobile</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NetworkTrust;
