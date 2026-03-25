import { Shield, Zap, Headphones, CheckCircle } from "lucide-react";

const points = [
  { icon: Shield, title: "Sans contrat", text: "Aucun engagement à long terme. Vous gardez le contrôle." },
  { icon: CheckCircle, title: "Processus simple", text: "Commande en ligne, installation rapide, service actif." },
  { icon: Headphones, title: "Support local", text: "Équipe basée au Québec, disponible 7 jours sur 7." },
  { icon: Zap, title: "Activation rapide", text: "Service activé en quelques jours, pas en semaines." },
];

const WhyNivra = () => (
  <section className="py-24 lg:py-36 bg-secondary/20">
    <div className="container mx-auto px-4 sm:px-6 max-w-[1200px]">
      <h2 className="text-3xl md:text-[2.75rem] font-bold text-foreground text-center mb-6 tracking-[-0.03em]">
        Pourquoi choisir Nivra
      </h2>
      <p className="text-muted-foreground text-lg text-center mb-16 lg:mb-20 max-w-lg mx-auto">
        Des avantages concrets pour votre quotidien
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 lg:gap-10 max-w-[960px] mx-auto">
        {points.map((p) => (
          <div key={p.title} className="bg-card rounded-3xl p-10 border border-border hover:border-primary/20 hover:shadow-xl transition-all duration-300 group hover:-translate-y-1">
            <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mb-6 group-hover:bg-primary/12 transition-colors duration-300">
              <p.icon className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-bold text-foreground mb-3 text-lg">{p.title}</h3>
            <p className="text-muted-foreground leading-relaxed">{p.text}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default WhyNivra;
