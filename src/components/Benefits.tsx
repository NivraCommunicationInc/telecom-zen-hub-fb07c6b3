import { Check, Shield, Users, TrendingUp, Unlock, MapPin } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const Benefits = () => {
  const { t } = useLanguage();

  const statCards = [
    {
      value: '98%',
      titleKey: 'benefits.stat1.title',
      descKey: 'benefits.stat1.desc',
      icon: TrendingUp,
    },
    {
      value: '3000+',
      titleKey: 'benefits.stat2.title',
      descKey: 'benefits.stat2.desc',
      icon: Users,
    },
    {
      value: '0',
      titleKey: 'benefits.stat3.title',
      descKey: 'benefits.stat3.desc',
      icon: Unlock,
    },
  ];

  return (
    <section id="benefits" className="section-padding bg-muted/30">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-4">
            {t('benefits.badge')}
          </span>
          
          <h2 className="mb-4">
            {t('benefits.title')}
          </h2>
          
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t('benefits.subtitle')}
          </p>
        </div>

        {/* Stats Cards Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {statCards.map((stat, index) => (
            <div 
              key={index}
              className="group p-6 rounded-2xl bg-card border border-border hover:border-accent/30 hover:shadow-elevated transition-all duration-200"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/15 transition-colors">
                  <stat.icon className="w-6 h-6 text-accent" />
                </div>
                <div className="text-3xl md:text-4xl font-bold text-accent">
                  {stat.value}
                </div>
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                {t(stat.titleKey)}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t(stat.descKey)}
              </p>
            </div>
          ))}
        </div>

        {/* Trust Banner */}
        <div className="pt-10 border-t border-border">
          {/* Primary Trust Badge */}
          <div className="bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-6 max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-center">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-500" />
                <span className="font-semibold text-foreground">{t('benefits.trust.nocredit')}</span>
              </div>
              <span className="hidden sm:block text-muted-foreground">—</span>
              <span className="text-sm text-muted-foreground">
                {t('benefits.nocredit.audience')}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 text-center">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-accent" />
              <span className="text-sm text-muted-foreground">{t('benefits.trust.local')}</span>
            </div>
            <div className="hidden md:block w-px h-5 bg-border" />
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent" />
              <span className="text-sm text-muted-foreground">{t('benefits.trust.secure')}</span>
            </div>
            <div className="hidden md:block w-px h-5 bg-border" />
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-accent" />
              <span className="text-sm text-muted-foreground">{t('benefits.trust.pricing')}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Benefits;