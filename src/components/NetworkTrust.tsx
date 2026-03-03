import { Shield, Zap, Headphones, MapPin, CheckCircle, Star, Award, Trophy } from "lucide-react";
import { Link } from "react-router-dom";

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
    <section className="bg-white">
      {/* Trust Points — Bell-style clean white section */}
      <div className="py-16 border-b border-slate-100">
        <div className="container mx-auto px-4 max-w-7xl">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
            Pourquoi choisir Nivra
          </h2>
          <p className="text-slate-500 text-lg mb-10">
            Pas de contrat à long terme, pas de frais cachés, juste des services fiables.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {trustPoints.map((point) => (
              <div 
                key={point.title}
                className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                  <point.icon className="w-6 h-6 text-[#003366]" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-2">{point.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{point.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Awards / Stats — Bell-style highlight tiles */}
      <div className="py-16 bg-slate-50 border-b border-slate-100">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Award tile 1 */}
            <div className="bg-white rounded-2xl p-8 border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-6 h-6 text-[#003366]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#003366]">Performance réseau</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">
                  Internet fibre optique le plus fiable au Québec.
                </h3>
                <p className="text-slate-500 mb-6">
                  Notre réseau fibre offre une disponibilité de 99.9% et des vitesses allant jusqu'à 1 Gbps pour une expérience sans compromis.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-[#003366]">99.9%</div>
                  <div className="text-xs text-slate-500">Disponibilité réseau</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-[#003366]">1 Gbps</div>
                  <div className="text-xs text-slate-500">Vitesse fibre max</div>
                </div>
              </div>
            </div>

            {/* Award tile 2 */}
            <div className="bg-white rounded-2xl p-8 border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Award className="w-6 h-6 text-[#003366]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#003366]">Réseau mobile</span>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3">
                  Réseau 5G/LTE national pour une couverture complète.
                </h3>
                <p className="text-slate-500 mb-6">
                  Profitez du réseau mobile le plus étendu au Canada avec des forfaits prépayés sans engagement et une activation en moins de 24h.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-[#003366]">5G/LTE</div>
                  <div className="text-xs text-slate-500">Réseau mobile</div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-[#003366]">&lt;24h</div>
                  <div className="text-xs text-slate-500">Activation mobile</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Testimonials — Bell-style clean */}
      <div className="py-16">
        <div className="container mx-auto px-4 max-w-7xl">
          <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
            Ce que nos clients disent
          </h2>
          <p className="text-slate-500 mb-8">Avis vérifiés de vrais clients Nivra</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {testimonials.map((testimonial) => (
              <div 
                key={testimonial.name}
                className="bg-white rounded-2xl p-6 border border-slate-200"
              >
                <div className="flex gap-0.5 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 mb-4 leading-relaxed">"{testimonial.text}"</p>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span className="font-medium text-slate-900">{testimonial.name}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-slate-500">{testimonial.location}</span>
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
