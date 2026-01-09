import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { useOptionalAuth } from "@/hooks/useAuth";

const Hero = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useOptionalAuth();

  const scrollToContact = () => {
    const contactSection = document.getElementById('contact');
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleOrder = () => {
    if (user) {
      navigate('/portal/new-order');
    } else {
      navigate('/portal/auth', { state: { redirectTo: '/portal/new-order' } });
    }
  };

  return (
    <section className="relative min-h-[85vh] bg-hero overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-navy-800 to-navy-700" />
        
        {/* Subtle accent glow */}
        <div className="absolute top-1/3 right-0 w-96 h-96 bg-accent/10 rounded-full blur-3xl translate-x-1/3" />
        <div className="absolute bottom-1/4 left-0 w-72 h-72 bg-accent/5 rounded-full blur-3xl -translate-x-1/3" />
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="relative container mx-auto px-4 pt-32 pb-20 lg:pt-40 lg:pb-28 max-w-6xl">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/15 border border-accent/25 mb-6 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-sm font-medium text-accent">{t('hero.badge')}</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-[1.625rem] sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.15] tracking-tight text-white mb-5 animate-fade-in hyphens-none" style={{ animationDelay: "0.1s" }}>
            {t('hero.title1')}
            <br />
            <span className="text-accent">{t('hero.title2')}</span>
          </h1>

          {/* Subheading */}
          <p className="text-lg text-white/70 max-w-2xl mx-auto mb-8 animate-fade-in leading-relaxed" style={{ animationDelay: "0.15s" }}>
            {t('hero.subtitle')}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <Button 
              variant="hero" 
              size="lg" 
              className="group w-full sm:w-auto" 
              onClick={handleOrder}
            >
              {t('hero.cta.order')}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
            <Button 
              variant="heroOutline" 
              size="lg" 
              className="w-full sm:w-auto"
              onClick={scrollToContact}
            >
              {t('hero.cta.services')}
            </Button>
          </div>

          {/* Trust Bar - 4 items */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 max-w-3xl mx-auto animate-fade-in" style={{ animationDelay: "0.25s" }}>
            {[
              { key: 'hero.trust.activation' },
              { key: 'hero.trust.installation' },
              { key: 'hero.trust.support' },
              { key: 'hero.trust.solutions' },
            ].map((item, index) => (
              <div 
                key={index}
                className="flex items-center justify-center gap-2 p-3 lg:p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm min-w-0"
              >
                <div className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                <span className="text-[11px] sm:text-xs lg:text-sm text-white/80 font-medium text-center hyphens-none break-words min-w-0">{t(item.key)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
          <path d="M0 80L60 72C120 64 240 48 360 44C480 40 600 48 720 52C840 56 960 56 1080 52C1200 48 1320 40 1380 36L1440 32V80H1380C1320 80 1200 80 1080 80C960 80 840 80 720 80C600 80 480 80 360 80C240 80 120 80 60 80H0Z" fill="hsl(var(--background))"/>
        </svg>
      </div>
    </section>
  );
};

export default Hero;