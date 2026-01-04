import { Check, Shield, Zap, Clock, Home, MapPin } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const Benefits = () => {
  const { t } = useLanguage();

  const benefits = [
    {
      icon: Shield,
      titleKey: 'benefits.independent.title',
      descKey: 'benefits.independent.desc',
    },
    {
      icon: Clock,
      titleKey: 'benefits.savings.title',
      descKey: 'benefits.savings.desc',
    },
    {
      icon: Zap,
      titleKey: 'benefits.simple.title',
      descKey: 'benefits.simple.desc',
    },
    {
      icon: Home,
      titleKey: 'benefits.support.title',
      descKey: 'benefits.support.desc',
    },
  ];

  const stats = [
    { value: '98%', labelKey: 'benefits.stat.satisfaction' },
    { value: '3000+', labelKey: 'benefits.stat.clients' },
    { value: '24/7', labelKey: 'benefits.stat.quebec' },
  ];

  return (
    <section id="benefits" className="section-padding bg-background relative overflow-hidden">
      {/* Subtle Background Accent */}
      <div className="absolute top-0 right-0 w-1/4 h-1/3 bg-gradient-to-bl from-accent/3 to-transparent pointer-events-none" />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl relative">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-start">
          {/* Left Content */}
          <div>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium mb-4">
              {t('benefits.badge')}
            </span>
            
            <h2 className="text-foreground mb-3">
              {t('benefits.title')}
            </h2>
            
            <p className="text-body text-muted-foreground mb-8 max-w-md">
              {t('benefits.subtitle')}
            </p>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
              {stats.map((stat, index) => (
                <div 
                  key={index}
                  className="text-center p-5 rounded-xl bg-card border border-border"
                >
                  <div className="text-3xl md:text-4xl font-bold text-accent mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t(stat.labelKey)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right - Benefits Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {benefits.map((benefit, index) => (
              <div
                key={benefit.titleKey}
                className="group p-6 rounded-xl bg-card border border-border hover:border-accent/30 hover:shadow-elevated transition-all duration-200"
              >
                <div className="w-11 h-11 rounded-lg bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/15 transition-colors">
                  <benefit.icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  {t(benefit.titleKey)}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t(benefit.descKey)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Trust Banner */}
        <div className="mt-16 pt-10 border-t border-border">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 text-center">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-accent" />
              <span className="text-muted-foreground">{t('benefits.trust.local')}</span>
            </div>
            <div className="hidden md:block w-px h-6 bg-border" />
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-accent" />
              <span className="text-muted-foreground">{t('benefits.trust.secure')}</span>
            </div>
            <div className="hidden md:block w-px h-6 bg-border" />
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-accent" />
              <span className="text-muted-foreground">{t('benefits.trust.nocredit')}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Benefits;