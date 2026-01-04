import { Smartphone, Wifi, Tv, Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const Services = () => {
  const { t } = useLanguage();

  const scrollToContact = () => {
    const contactSection = document.getElementById('contact');
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const services = [
    {
      icon: Smartphone,
      titleKey: 'services.mobile.title',
      descKey: 'services.mobile.desc',
      features: ['services.mobile.feature1', 'services.mobile.feature2', 'services.mobile.feature3'],
    },
    {
      icon: Wifi,
      titleKey: 'services.internet.title',
      descKey: 'services.internet.desc',
      features: ['services.internet.feature1', 'services.internet.feature2', 'services.internet.feature3'],
    },
    {
      icon: Tv,
      titleKey: 'services.tv.title',
      descKey: 'services.tv.desc',
      features: ['services.tv.feature1', 'services.tv.feature2', 'services.tv.feature3'],
    },
    {
      icon: Shield,
      titleKey: 'services.business.title',
      descKey: 'services.business.desc',
      features: ['services.business.feature1', 'services.business.feature2', 'services.business.feature3'],
    },
  ];

  return (
    <section id="services" className="section-padding bg-background relative overflow-hidden">
      {/* Subtle 3D Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 -right-20 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-20 w-60 h-60 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 relative">
        {/* Section Header - Tighter */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-block px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium mb-3">
            {t('services.badge')}
          </span>
          <h2 className="text-foreground mb-3">
            {t('services.title')}
          </h2>
          <p className="text-body text-muted-foreground">
            {t('services.subtitle')}
          </p>
        </div>

        {/* Services Grid with 3D Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {services.map((service, index) => (
            <div
              key={service.titleKey}
              className="group relative bg-card rounded-2xl p-6 shadow-card hover:shadow-xl transition-all duration-500 border border-border hover:border-accent/30 animate-fade-in card-3d"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Icon with 3D Effect */}
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500/15 to-cyan-400/5 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <service.icon className="w-7 h-7 text-accent" />
              </div>

              {/* Content */}
              <h3 className="font-display text-xl font-bold text-foreground mb-3">
                {t(service.titleKey)}
              </h3>
              <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
                {t(service.descKey)}
              </p>

              {/* Features */}
              <ul className="space-y-2 mb-6">
                {service.features.map((featureKey) => (
                  <li key={featureKey} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-glow" />
                    {t(featureKey)}
                  </li>
                ))}
              </ul>

              {/* Link - Navigate to contact */}
              <Button variant="ghost" size="sm" className="group/btn text-accent p-0 h-auto font-semibold" onClick={scrollToContact}>
                {t('services.cta')}
                <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
              </Button>

              {/* Hover Gradient with Depth */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              
              {/* 3D Card Shine Effect */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;