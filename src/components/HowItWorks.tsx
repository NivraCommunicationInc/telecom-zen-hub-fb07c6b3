import { FileText, Calendar, Settings, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const HowItWorks = () => {
  const { t } = useLanguage();

  const steps = [
    {
      icon: FileText,
      number: "1",
      titleKey: 'howitworks.step1.title',
      descKey: 'howitworks.step1.desc',
    },
    {
      icon: Calendar,
      number: "2",
      titleKey: 'howitworks.step2.title',
      descKey: 'howitworks.step2.desc',
    },
    {
      icon: Settings,
      number: "3",
      titleKey: 'howitworks.step3.title',
      descKey: 'howitworks.step3.desc',
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-muted/30 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
            {t('howitworks.badge')}
          </span>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            {t('howitworks.title')}
          </h2>
          <p className="text-lg text-muted-foreground">
            {t('howitworks.subtitle')}
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <div key={step.titleKey} className="relative">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-12 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-accent/30 to-accent/10" />
              )}
              
              <div className="flex flex-col items-center text-center">
                {/* Step number with icon */}
                <div className="relative mb-6">
                  <div className="w-24 h-24 rounded-2xl bg-card border border-border shadow-lg flex items-center justify-center group hover:border-accent/30 transition-colors">
                    <step.icon className="w-10 h-10 text-accent" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-sm font-bold shadow-lg">
                    {step.number}
                  </div>
                </div>

                {/* Content */}
                <h3 className="font-display text-xl font-bold text-foreground mb-3">
                  {t(step.titleKey)}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
                  {t(step.descKey)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;