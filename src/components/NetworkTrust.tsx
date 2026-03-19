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
    <section className="py-16 lg:py-24 bg-white">
      <div className="container mx-auto px-4 max-w-[1320px]">
        <div className="text-center mb-12">
          <p className="text-amber-600 text-sm font-bold uppercase tracking-[0.15em] mb-3">
            {isFr ? "POURQUOI NIVRA" : "WHY NIVRA"}
          </p>
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight">
            {isFr ? "L'avantage Nivra" : "The Nivra advantage"}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {trustPoints.map((point) => (
            <div
              key={point.title}
              className="bg-slate-50 rounded-xl border-2 border-slate-200 p-6 hover:border-amber-400 hover:shadow-lg transition-all duration-300 group"
            >
              <div className="w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center mb-4 group-hover:bg-amber-400 transition-colors">
                <point.icon className="w-6 h-6 text-amber-400 group-hover:text-black transition-colors" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 mb-2">{point.title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{point.description}</p>
            </div>
          ))}
        </div>

        {/* Stats bar */}
        <div className="bg-black rounded-xl p-8 lg:p-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {stats.map((stat) => (
              <div key={stat.value}>
                <stat.icon className="w-6 h-6 text-amber-400 mx-auto mb-3" />
                <div className="text-4xl lg:text-5xl font-black text-white mb-1">{stat.value}</div>
                <div className="text-sm text-white/50 font-medium uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default NetworkTrust;
