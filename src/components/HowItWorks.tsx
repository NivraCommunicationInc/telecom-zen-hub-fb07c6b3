import { MessageSquare, Search, FileCheck, Headphones } from "lucide-react";

const steps = [
  {
    icon: MessageSquare,
    step: "01",
    title: "Consultation gratuite",
    description: "Prenez rendez-vous pour une consultation téléphonique de 30 minutes. Nous analysons vos besoins actuels et vos objectifs.",
  },
  {
    icon: Search,
    step: "02",
    title: "Analyse du marché",
    description: "Nous comparons toutes les offres disponibles au Québec et identifions les meilleures options pour votre situation.",
  },
  {
    icon: FileCheck,
    step: "03",
    title: "Négociation & contrat",
    description: "Nous négocions en votre nom pour obtenir les meilleurs tarifs et conditions, sans clauses cachées.",
  },
  {
    icon: Headphones,
    step: "04",
    title: "Suivi continu",
    description: "Nous surveillons votre facturation et intervenons en cas de problème. Vous êtes protégé tout au long du contrat.",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-20 md:py-32 bg-secondary/30">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
            Notre Processus
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Comment ça <span className="text-gradient">fonctionne</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Un processus simple et transparent pour vous garantir les meilleurs services télécoms au Québec.
          </p>
        </div>

        {/* Steps */}
        <div className="relative max-w-5xl mx-auto">
          {/* Connection Line - Desktop */}
          <div className="hidden lg:block absolute top-24 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-accent/20 via-accent/40 to-accent/20" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {steps.map((step, index) => (
              <div
                key={step.step}
                className="relative animate-fade-in"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                {/* Step Card */}
                <div className="relative bg-card rounded-2xl p-6 shadow-card border border-border text-center lg:text-left">
                  {/* Step Number */}
                  <div className="absolute -top-4 left-1/2 lg:left-6 -translate-x-1/2 lg:translate-x-0 w-8 h-8 rounded-full bg-accent text-accent-foreground font-bold text-sm flex items-center justify-center shadow-glow">
                    {step.step}
                  </div>

                  {/* Icon */}
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/10 to-accent/5 flex items-center justify-center mx-auto lg:mx-0 mt-4 mb-5">
                    <step.icon className="w-8 h-8 text-accent" />
                  </div>

                  {/* Content */}
                  <h3 className="font-display text-xl font-bold text-foreground mb-3">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Arrow - Mobile/Tablet */}
                {index < steps.length - 1 && (
                  <div className="lg:hidden flex justify-center my-4">
                    <div className="w-0.5 h-8 bg-gradient-to-b from-accent/40 to-accent/10" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
