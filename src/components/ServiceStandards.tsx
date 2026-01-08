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
      metric: isFr ? "Sur rendez-vous" : "Scheduled",
      label: isFr ? "Installation planifiée" : "Planned install",
      desc: isFr ? "Créneau confirmé à l'avance" : "Confirmed time slot in advance",
    },
    {
      icon: BarChart3,
      metric: isFr ? "Suivi en temps réel" : "Real-time tracking",
      label: isFr ? "Portail client" : "Client portal",
      desc: isFr ? "Visibilité sur vos services" : "Visibility on your services",
    },
  ];

  return (
    <section className="section-padding-sm bg-primary">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="text-center mb-10">
          <h2 className="text-white mb-3">
            {isFr ? "Nos engagements" : "Our commitments"}
          </h2>
          <p className="text-white/60 max-w-xl mx-auto">
            {isFr 
              ? "Des délais clairs et un suivi professionnel à chaque étape." 
              : "Clear timelines and professional follow-up at every step."}
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          {standards.map((item, index) => (
            <div 
              key={index}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 sm:p-5 text-center hover:bg-white/8 transition-colors min-w-0"
            >
              <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-accent/15 flex items-center justify-center">
                <item.icon className="w-5 h-5 text-accent" />
              </div>
              <div className="text-base sm:text-lg font-semibold text-white mb-1 break-words hyphens-none">
                {item.metric}
              </div>
              <div className="text-xs sm:text-sm font-medium text-accent mb-1 break-words">
                {item.label}
              </div>
              <p className="text-[11px] sm:text-xs text-white/50 break-words">
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