import { Shield, Zap, Headphones, DollarSign, Star, Users, Clock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const NetworkTrust = () => {
  const { language } = useLanguage();
  const isFr = language === 'fr';

  const trustPoints = [
    {
      icon: DollarSign,
      title: isFr ? "Prix transparents" : "Transparent pricing",
      description: isFr ? "Aucun frais caché, ce que vous voyez est ce que vous payez." : "No hidden fees, what you see is what you pay.",
    },
    {
      icon: Zap,
      title: isFr ? "Activation rapide" : "Fast activation",
      description: isFr ? "Mobile en moins de 24h, Internet en 3-5 jours." : "Mobile in under 24h, Internet in 3-5 days.",
    },
    {
      icon: Shield,
      title: isFr ? "Aucun engagement" : "No commitment",
      description: isFr ? "Prépayé, sans contrat. Vous gardez le contrôle total." : "Prepaid, no contract. You stay in full control.",
    },
    {
      icon: Headphones,
      title: isFr ? "Support humain" : "Human support",
      description: isFr ? "Équipe locale disponible 7j/7, en français." : "Local team available 7/7, in French.",
    },
  ];

  const stats = [
    { value: "4.8/5", label: isFr ? "Satisfaction client" : "Customer satisfaction", icon: Star },
    { value: "100+", label: isFr ? "Clients actifs" : "Active customers", icon: Users },
    { value: "<2h", label: isFr ? "Temps de réponse" : "Response time", icon: Clock },
  ];

  return (
    <section className="py-20 lg:py-28 bg-slate-50">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="text-center mb-14">
          <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
            {isFr ? "Pourquoi Nivra" : "Why Nivra"}
          </h2>
          <p className="text-slate-500 text-lg max-w-xl mx-auto">
            {isFr ? "Des valeurs simples pour un service irréprochable" : "Simple values for impeccable service"}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {trustPoints.map((point) => (
            <div
              key={point.title}
              className="bg-white rounded-2xl border-2 border-slate-200 p-7 hover:border-blue-400 hover:shadow-lg transition-all duration-300 group"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <point.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">{point.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{point.description}</p>
            </div>
          ))}
        </div>

        {/* Trust stats — bold style */}
        <div className="bg-gradient-to-br from-blue-700 to-indigo-800 rounded-3xl p-10 lg:p-16 shadow-2xl shadow-blue-500/20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-center">
            {stats.map((stat) => (
              <div key={stat.value}>
                <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center mx-auto mb-4">
                  <stat.icon className="w-6 h-6 text-amber-300" />
                </div>
                <div className="text-4xl lg:text-5xl font-extrabold text-white mb-2">{stat.value}</div>
                <div className="text-sm text-white/70 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default NetworkTrust;
