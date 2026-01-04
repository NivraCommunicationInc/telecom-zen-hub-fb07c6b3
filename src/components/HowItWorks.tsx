import { FileText, Calendar, Settings } from "lucide-react";
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
    <section className="section-padding bg-background">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-block px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-4">
            {t('howitworks.badge')}
          </span>
          <h2 className="mb-4">
            {t('howitworks.title')}
          </h2>
          <p className="text-muted-foreground">
            {t('howitworks.subtitle')}
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <div key={step.titleKey} className="relative">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-px bg-border" />
              )}
              
              <div className="flex flex-col items-center text-center">
                {/* Step number with icon */}
                <div className="relative mb-5">
                  <div className="w-20 h-20 rounded-2xl bg-card border border-border flex items-center justify-center group hover:border-accent/30 transition-colors shadow-sm">
                    <step.icon className="w-8 h-8 text-accent" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-sm font-bold shadow-md">
                    {step.number}
                  </div>
                </div>

                {/* Content */}
                <h3 className="font-semibold text-foreground mb-2">
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