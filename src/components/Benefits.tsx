import { Check, TrendingDown, Eye, Lock, Users, Award } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const Benefits = () => {
  const { t } = useLanguage();

  const benefits = [
    {
      icon: TrendingDown,
      titleKey: 'benefits.savings.title',
      descKey: 'benefits.savings.desc',
    },
    {
      icon: Eye,
      titleKey: 'benefits.simple.title',
      descKey: 'benefits.simple.desc',
    },
    {
      icon: Lock,
      titleKey: 'benefits.support.title',
      descKey: 'benefits.support.desc',
    },
    {
      icon: Users,
      titleKey: 'benefits.independent.title',
      descKey: 'benefits.independent.desc',
    },
    {
      icon: Award,
      titleKey: 'benefits.stat.clients',
      descKey: 'benefits.stat.savings',
    },
    {
      icon: Check,
      titleKey: 'benefits.stat.experience',
      descKey: 'benefits.subtitle',
    },
  ];

  return (
    <section id="benefits" className="py-20 md:py-32 bg-background relative overflow-hidden">
      {/* 3D Background Decoration */}
      <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-bl from-accent/5 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-1/3 h-1/3 bg-gradient-to-tr from-cyan-500/5 to-transparent pointer-events-none" />
      
      {/* Floating 3D Elements */}
      <div className="absolute top-1/4 right-10 w-20 h-20 border border-accent/10 rounded-2xl rotate-12 float-3d opacity-30" />
      <div className="absolute bottom-1/4 left-10 w-16 h-16 border border-cyan-500/10 rounded-xl -rotate-12 float-3d-delayed opacity-25" />
      
      <div className="container mx-auto px-4 relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left Content */}
          <div>
            <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4 card-3d">
              {t('benefits.badge')}
            </span>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
              {t('benefits.title')}
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              {t('benefits.subtitle')}
            </p>

            {/* Stats with 3D Effect */}
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center p-4 rounded-xl bg-card/50 border border-border card-3d">
                <div className="font-display text-3xl md:text-4xl font-bold text-accent mb-1 text-3d">30%</div>
                <div className="text-sm text-muted-foreground">{t('benefits.stat.services')}</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-card/50 border border-border card-3d">
                <div className="font-display text-3xl md:text-4xl font-bold text-accent mb-1 text-3d">500+</div>
                <div className="text-sm text-muted-foreground">{t('benefits.stat.clients')}</div>
              </div>
              <div className="text-center p-4 rounded-xl bg-card/50 border border-border card-3d">
                <div className="font-display text-3xl md:text-4xl font-bold text-accent mb-1 text-3d">24/7</div>
                <div className="text-sm text-muted-foreground">{t('benefits.stat.quebec')}</div>
              </div>
            </div>
          </div>

          {/* Right - Benefits Grid with 3D Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {benefits.map((benefit, index) => (
              <div
                key={benefit.titleKey}
                className="group p-5 rounded-xl bg-card border border-border hover:border-accent/30 hover:shadow-xl transition-all duration-300 animate-fade-in card-3d"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors shadow-lg group-hover:shadow-glow">
                  <benefit.icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-display font-bold text-foreground mb-2">
                  {t(benefit.titleKey)}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t(benefit.descKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Benefits;
