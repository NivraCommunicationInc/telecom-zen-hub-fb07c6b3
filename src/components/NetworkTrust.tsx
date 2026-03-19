import { Shield, Zap, Headphones, MapPin, CheckCircle, Star, Award, Trophy } from "lucide-react";

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
    <section className="bg-background">
      {/* Trust Points */}
      <div className="py-20 border-b border-border">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              Pourquoi choisir Nivra
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Pas de contrat à long terme, pas de frais cachés, juste des services fiables.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {trustPoints.map((point, i) => (
              <div
                key={point.title}
                className="bg-card rounded-2xl p-7 border border-border hover:border-primary/20 hover:shadow-md transition-all duration-200 group relative overflow-hidden"
              >
                {/* Subtle corner accent on hover */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-primary/0 group-hover:bg-primary/5 rounded-bl-[3rem] transition-colors duration-500" />

                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mb-5 group-hover:bg-primary/12 transition-colors duration-300">
                    <point.icon className="w-7 h-7 text-primary transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <h3 className="font-bold text-foreground mb-2 text-lg">{point.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{point.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Awards / Stats */}
      <div className="py-20 bg-secondary/40 border-b border-border">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Award tile 1 */}
            <div className="bg-card rounded-2xl p-8 lg:p-10 border border-border flex flex-col justify-between hover:shadow-lg transition-all duration-300 group">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                    <Trophy className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">Performance réseau</span>
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-3">
                  Internet fibre optique le plus fiable au Québec.
                </h3>
                <p className="text-muted-foreground mb-8 leading-relaxed">
                  Notre réseau fibre offre une disponibilité de 99.9% et des vitesses allant jusqu'à 1 Gbps pour une expérience sans compromis.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-primary/5 rounded-xl p-5 text-center border border-primary/10 group-hover:border-primary/20 transition-colors">
                  <div className="text-3xl font-black text-primary">99.9%</div>
                  <div className="text-xs text-muted-foreground mt-1.5 font-medium">Disponibilité réseau</div>
                </div>
                <div className="bg-primary/5 rounded-xl p-5 text-center border border-primary/10 group-hover:border-primary/20 transition-colors">
                  <div className="text-3xl font-black text-primary">1 Gbps</div>
                  <div className="text-xs text-muted-foreground mt-1.5 font-medium">Vitesse fibre max</div>
                </div>
              </div>
            </div>

            {/* Award tile 2 */}
            <div className="bg-card rounded-2xl p-8 lg:p-10 border border-border flex flex-col justify-between hover:shadow-lg transition-all duration-300 group">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                    <Award className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">Réseau mobile</span>
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-3">
                  Réseau 5G/LTE national pour une couverture complète.
                </h3>
                <p className="text-muted-foreground mb-8 leading-relaxed">
                  Profitez du réseau mobile le plus étendu au Canada avec des forfaits prépayés sans engagement et une activation en moins de 24h.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-primary/5 rounded-xl p-5 text-center border border-primary/10 group-hover:border-primary/20 transition-colors">
                  <div className="text-3xl font-black text-primary">5G/LTE</div>
                  <div className="text-xs text-muted-foreground mt-1.5 font-medium">Réseau mobile</div>
                </div>
                <div className="bg-primary/5 rounded-xl p-5 text-center border border-primary/10 group-hover:border-primary/20 transition-colors">
                  <div className="text-3xl font-black text-primary">&lt;24h</div>
                  <div className="text-xs text-muted-foreground mt-1.5 font-medium">Activation mobile</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Testimonials */}
      <div className="py-20">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
              Ce que nos clients disent
            </h2>
            <p className="text-muted-foreground text-lg">Avis vérifiés de vrais clients Nivra</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.name}
                className="bg-card rounded-2xl p-7 border border-border hover:shadow-md hover:border-primary/15 transition-all duration-300"
              >
                <div className="flex gap-0.5 mb-5">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-foreground mb-5 leading-relaxed text-base italic">"{testimonial.text}"</p>
                <div className="flex items-center gap-2.5 text-sm pt-5 border-t border-border">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">{testimonial.name.charAt(0)}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-foreground block">{testimonial.name}</span>
                    <span className="text-muted-foreground text-xs">{testimonial.location}</span>
                  </div>
                  <CheckCircle className="w-4 h-4 text-emerald-500 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default NetworkTrust;
