import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const Hero = () => {
  const { t } = useLanguage();

  const scrollToContact = () => {
    const contactSection = document.getElementById('contact');
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative min-h-screen bg-hero overflow-hidden bg-layered">
      {/* 3D Layered Background Elements */}
      <div className="absolute inset-0 parallax-container">
        {/* Primary Gradient Orb - Floating */}
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl float-3d" />
        <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-cyan-400/15 rounded-full blur-3xl float-3d-delayed" />
        
        {/* 3D Geometric Shapes */}
        <div className="absolute top-20 right-20 w-32 h-32 border border-cyan-500/20 rounded-2xl rotate-12 float-3d opacity-40" 
          style={{ transform: 'rotateX(45deg) rotateZ(12deg)' }} 
        />
        <div className="absolute bottom-40 left-20 w-24 h-24 border border-cyan-400/15 rounded-xl -rotate-12 float-3d-delayed opacity-30"
          style={{ transform: 'rotateX(-30deg) rotateZ(-12deg)' }}
        />
        <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-cyan-500/10 rounded-lg rotate-45 float-3d opacity-50" />
        
        {/* Grid Pattern with Perspective */}
        <div 
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
            transform: 'perspective(500px) rotateX(60deg)',
            transformOrigin: 'center top'
          }}
        />
        
        {/* Ambient Light Effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-radial from-cyan-500/10 via-transparent to-transparent blur-2xl" />
      </div>

      <div className="relative container mx-auto px-4 pt-32 pb-20 md:pt-40 md:pb-32">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge with 3D Effect */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-premium mb-8 animate-fade-in card-3d">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-sm font-medium text-cyan-300">{t('hero.badge')}</span>
          </div>

          {/* Main Heading - Tighter */}
          <h1 className="text-primary-foreground mb-4 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            {t('hero.title1')}
            <br />
            <span className="text-gradient">{t('hero.title2')}</span>
          </h1>

          {/* Subheading - Tighter */}
          <p className="text-body-lg text-cyan-100/70 max-w-xl mx-auto mb-8 animate-fade-in text-balance" style={{ animationDelay: "0.2s" }}>
            {t('hero.subtitle')}
          </p>

          {/* CTA Buttons - Cleaner */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <Button 
              variant="hero" 
              size="lg" 
              className="group focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-primary" 
              onClick={scrollToContact}
            >
              {t('hero.cta.order')}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button 
              variant="heroOutline" 
              size="lg" 
              onClick={scrollToContact}
              className="focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-primary"
            >
              {t('hero.cta.services')}
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom Wave with 3D Effect */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full" style={{ filter: 'drop-shadow(0 -10px 20px rgba(0,0,0,0.1))' }}>
          <path d="M0 120L60 110C120 100 240 80 360 70C480 60 600 60 720 65C840 70 960 80 1080 85C1200 90 1320 90 1380 90L1440 90V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="hsl(var(--background))"/>
        </svg>
      </div>
    </section>
  );
};

export default Hero;