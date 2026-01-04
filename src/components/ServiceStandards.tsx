import { Clock, Headphones, CheckCircle2, BarChart3 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const ServiceStandards = () => {
  const { language } = useLanguage();
  const isFr = language === 'fr';

  const standards = [
    {
      icon: Clock,
      metric: isFr ? "24-48h" : "24-48h",
      label: isFr ? "Délai d'activation" : "Activation time",
      desc: isFr ? "Mise en service rapide après validation" : "Fast setup after validation",
    },
    {
      icon: Headphones,
      metric: isFr ? "1 jour ouvrable" : "1 business day",
      label: isFr ? "Réponse support" : "Support response",
      desc: isFr ? "Retour garanti sur chaque demande" : "Guaranteed reply on every request",
    },
    {
      icon: CheckCircle2,
      metric: isFr ? "Installation planifiée" : "Scheduled install",
      label: isFr ? "Sur rendez-vous" : "By appointment",
      desc: isFr ? "Créneau confirmé à l'avance" : "Confirmed time slot in advance",
    },
    {
      icon: BarChart3,
      metric: isFr ? "Suivi en temps réel" : "Real-time tracking",
      label: isFr ? "Portail client" : "Client portal",
      desc: isFr ? "Visibilité complète sur vos services" : "Full visibility on your services",
    },
  ];

  return (
    <section className="section-padding-sm bg-primary">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-primary-foreground mb-2">
            {isFr ? "Nos engagements" : "Our commitments"}
          </h2>
          <p className="text-cyan-100/60 text-body max-w-xl mx-auto">
            {isFr 
              ? "Des délais clairs et un suivi professionnel à chaque étape." 
              : "Clear timelines and professional follow-up at every step."}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 max-w-5xl mx-auto">
          {standards.map((item, index) => (
            <div 
              key={index}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5 text-center hover:bg-white/8 transition-colors"
            >
              <div className="w-10 h-10 mx-auto mb-3 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <item.icon className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="text-lg font-semibold text-primary-foreground mb-1">
                {item.metric}
              </div>
              <div className="text-sm font-medium text-cyan-300 mb-1">
                {item.label}
              </div>
              <p className="text-xs text-cyan-100/50">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServiceStandards;