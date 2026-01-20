import { Shield, Zap, Headphones, MapPin, CheckCircle, Star } from "lucide-react";

const NetworkTrust = () => {
  const trustPoints = [
    {
      icon: MapPin,
      title: "Couverture provinciale",
      description: "Service disponible partout au Québec, des grandes villes aux régions éloignées."
    },
    {
      icon: Zap,
      title: "Activation rapide",
      description: "Mobile activé en moins de 24h. Internet installé dans les 3 à 5 jours ouvrables."
    },
    {
      icon: Headphones,
      title: "Support local",
      description: "Équipe de support basée au Québec, disponible 7 jours sur 7 en français."
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
    <section className="py-20 bg-primary text-white overflow-hidden">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-accent/20 text-accent text-sm font-semibold mb-4">
            Pourquoi Nivra
          </span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-5">
            Un fournisseur qui vous 
            <span className="text-accent"> simplifie la vie</span>
          </h2>
          <p className="text-lg text-white/70">
            Pas de contrat à long terme, pas de frais cachés, juste des services télécoms fiables 
            avec un support humain qui répond vraiment.
          </p>
        </div>

        {/* Trust Points Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {trustPoints.map((point, index) => (
            <div 
              key={point.title}
              className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-accent/30 transition-all duration-300 animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center mb-4">
                <point.icon className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{point.title}</h3>
              <p className="text-sm text-white/60 leading-relaxed">{point.description}</p>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <div className="relative">
          <div className="text-center mb-10">
            <h3 className="text-2xl font-bold mb-2">Ce que nos clients disent</h3>
            <p className="text-white/60">Avis vérifiés de vrais clients Nivra</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <div 
                key={testimonial.name}
                className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 animate-fade-in"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                {/* Stars */}
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-accent text-accent" />
                  ))}
                </div>
                
                {/* Quote */}
                <p className="text-white/80 mb-4 italic">"{testimonial.text}"</p>
                
                {/* Author */}
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-accent" />
                  <span className="font-medium">{testimonial.name}</span>
                  <span className="text-white/40">•</span>
                  <span className="text-sm text-white/60">{testimonial.location}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Network Stats */}
        <div className="mt-20 grid grid-cols-2 lg:grid-cols-4 gap-8 py-10 border-t border-white/10">
          <div className="text-center">
            <div className="text-4xl lg:text-5xl font-bold text-accent mb-2">99.9%</div>
            <div className="text-sm text-white/60 uppercase tracking-wide">Disponibilité réseau</div>
          </div>
          <div className="text-center">
            <div className="text-4xl lg:text-5xl font-bold text-white mb-2">5G/LTE</div>
            <div className="text-sm text-white/60 uppercase tracking-wide">Réseau mobile</div>
          </div>
          <div className="text-center">
            <div className="text-4xl lg:text-5xl font-bold text-white mb-2">1 Gbps</div>
            <div className="text-sm text-white/60 uppercase tracking-wide">Vitesse fibre</div>
          </div>
          <div className="text-center">
            <div className="text-4xl lg:text-5xl font-bold text-accent mb-2">24h</div>
            <div className="text-sm text-white/60 uppercase tracking-wide">Activation mobile</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NetworkTrust;
