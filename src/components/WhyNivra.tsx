import { Shield, Zap, Headphones, CheckCircle } from "lucide-react";

const points = [
  { icon: Shield, title: "Sans contrat", text: "Aucun engagement à long terme. Vous gardez le contrôle." },
  { icon: CheckCircle, title: "Processus simple", text: "Commande en ligne, installation rapide, service actif." },
  { icon: Headphones, title: "Support local", text: "Équipe basée au Québec, disponible 7 jours sur 7." },
  { icon: Zap, title: "Activation rapide", text: "Service activé en quelques jours, pas en semaines." },
];

const WhyNivra = () => (
  <section className="py-20 lg:py-28 bg-[#0d0d0d]">
    <div className="container mx-auto px-4 sm:px-6 max-w-[1200px]">
      <h2 className="text-3xl md:text-[2.5rem] font-bold text-white text-center mb-14 tracking-[-0.025em]">
        Pourquoi choisir Nivra
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-7 max-w-[920px] mx-auto">
        {points.map((p) => (
          <div key={p.title} className="bg-[#1a1a1a] rounded-2xl p-8 border border-white/10 hover:border-purple-500/30 hover:shadow-[0_0_20px_rgba(139,92,246,0.08)] transition-all duration-300 group">
            <div className="w-13 h-13 rounded-xl bg-purple-500/10 flex items-center justify-center mb-5 group-hover:bg-purple-500/20 transition-colors">
              <p.icon className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="font-bold text-white mb-2">{p.title}</h3>
            <p className="text-sm text-white/60 leading-relaxed">{p.text}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default WhyNivra;
