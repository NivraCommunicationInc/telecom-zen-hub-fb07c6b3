import { MessageSquare, Search, FileCheck, Headphones } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const HowItWorks = () => {
  const { t } = useLanguage();

  const steps = [
    {
      icon: MessageSquare,
      step: "01",
      titleKey: 'howitworks.step1.title',
      descKey: 'howitworks.step1.desc',
    },
    {
      icon: Search,
      step: "02",
      titleKey: 'howitworks.step2.title',
      descKey: 'howitworks.step2.desc',
    },
    {
      icon: FileCheck,
      step: "03",
      titleKey: 'howitworks.step3.title',
      descKey: 'howitworks.step3.desc',
    },
    {
      icon: Headphones,
      step: "04",
      titleKey: 'howitworks.step4.title',
      descKey: 'howitworks.step4.desc',
    },
  ];

  return (
    <section id="how-it-works" className="py-20 md:py-32 bg-secondary/30 relative overflow-hidden">
      {/* 3D Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-1/4 w-40 h-40 bg-accent/5 rounded-full blur-3xl float-3d" />
        <div className="absolute bottom-20 right-1/4 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl float-3d-delayed" />
      </div>

      <div className="container mx-auto px-4 relative">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4 card-3d">
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
        <div className="relative max-w-5xl mx-auto">
          {/* Connection Line - Desktop with 3D Effect */}
          <div className="hidden lg:block absolute top-24 left-[10%] right-[10%] h-1 bg-gradient-to-r from-accent/20 via-accent/50 to-accent/20 rounded-full shadow-glow" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
            {steps.map((step, index) => (
              <div
                key={step.step}
                className="relative animate-fade-in"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                {/* Step Card with 3D Effect */}
                <div className="relative bg-card rounded-2xl p-6 shadow-card border border-border text-center lg:text-left card-3d hover:shadow-xl transition-all duration-300">
                  {/* Step Number with 3D Effect */}
                  <div className="absolute -top-4 left-1/2 lg:left-6 -translate-x-1/2 lg:translate-x-0 w-10 h-10 rounded-full bg-gradient-to-br from-accent to-cyan-400 text-accent-foreground font-bold text-sm flex items-center justify-center shadow-lg btn-3d" style={{ boxShadow: '0 4px 0 hsl(192 95% 35%), 0 6px 15px rgba(0,0,0,0.3)' }}>
                    {step.step}
                  </div>

                  {/* Icon with 3D Container */}
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/15 to-accent/5 flex items-center justify-center mx-auto lg:mx-0 mt-4 mb-5 shadow-lg">
                    <step.icon className="w-8 h-8 text-accent" />
                  </div>

                  {/* Content */}
                  <h3 className="font-display text-xl font-bold text-foreground mb-3">
                    {t(step.titleKey)}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {t(step.descKey)}
                  </p>
                </div>

                {/* Arrow - Mobile/Tablet with 3D */}
                {index < steps.length - 1 && (
                  <div className="lg:hidden flex justify-center my-4">
                    <div className="w-1 h-8 bg-gradient-to-b from-accent/50 to-accent/10 rounded-full shadow-glow" />
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
