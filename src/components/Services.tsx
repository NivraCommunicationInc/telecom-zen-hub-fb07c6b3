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
    <section id="services" className="section-padding bg-background">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-block px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-4">
            {t('services.badge')}
          </span>
          <h2 className="mb-4">
            {t('services.title')}
          </h2>
          <p className="text-muted-foreground">
            {t('services.subtitle')}
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {services.map((service, index) => (
            <div
              key={service.titleKey}
              className="group bg-card rounded-2xl p-6 border border-border hover:border-accent/30 transition-all duration-200 hover:shadow-elevated animate-fade-in"
              style={{ animationDelay: `${index * 0.08}s` }}
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-5 group-hover:bg-accent/15 transition-colors">
                <service.icon className="w-6 h-6 text-accent" />
              </div>

              {/* Content */}
              <h3 className="font-semibold text-foreground mb-2">
                {t(service.titleKey)}
              </h3>
              <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
                {t(service.descKey)}
              </p>

              {/* Features */}
              <ul className="space-y-2 mb-5">
                {service.features.map((featureKey) => (
                  <li key={featureKey} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                    <span>{t(featureKey)}</span>
                  </li>
                ))}
              </ul>

              {/* Link */}
              <Button variant="ghost" size="sm" className="text-accent p-0 h-auto font-medium hover:bg-transparent group/btn" onClick={scrollToContact}>
                {t('services.cta')}
                <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-0.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Services;