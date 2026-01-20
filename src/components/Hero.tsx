import { Button } from "@/components/ui/button";
import { ArrowRight, Wifi, Smartphone, Tv, Shield } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";

const Hero = () => {
  const { t } = useLanguage();

  return (
    <section className="relative min-h-[90vh] bg-primary overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Gradient mesh */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-navy-800 to-navy-700" />
        
        {/* Animated accent orbs */}
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-accent/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] bg-teal-400/10 rounded-full blur-[100px]" />
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '64px 64px',
          }}
        />

        {/* Diagonal speed lines */}
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-[0.03]">
          <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-white to-transparent transform rotate-12 origin-top-right" />
          <div className="absolute top-0 right-20 w-px h-full bg-gradient-to-b from-transparent via-white to-transparent transform rotate-12 origin-top-right" />
          <div className="absolute top-0 right-40 w-px h-full bg-gradient-to-b from-transparent via-white to-transparent transform rotate-12 origin-top-right" />
        </div>
      </div>

      <div className="relative container mx-auto px-4 pt-24 pb-16 lg:pt-32 lg:pb-24 max-w-7xl">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/15 border border-accent/25 mb-6 animate-fade-in">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              <span className="text-sm font-medium text-accent">{t('hero.badge')}</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight text-white mb-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
              {t('hero.title1')}
              <br />
              <span className="text-accent">{t('hero.title2')}</span>
            </h1>

            {/* Subheading */}
            <p className="text-lg text-white/70 max-w-xl mx-auto lg:mx-0 mb-8 animate-fade-in leading-relaxed" style={{ animationDelay: "0.15s" }}>
              {t('hero.subtitle')}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 mb-10 animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <Button 
                variant="hero" 
                size="lg" 
                className="group w-full sm:w-auto text-base px-8"
                asChild
              >
                <Link to="/contact">
                  {t('hero.cta.order')}
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button 
                variant="heroOutline" 
                size="lg" 
                className="w-full sm:w-auto text-base"
                asChild
              >
                <Link to="/mobile">
                  Voir les forfaits
                </Link>
              </Button>
            </div>

            {/* Quick Stats */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 lg:gap-10 animate-fade-in" style={{ animationDelay: "0.25s" }}>
              <div className="text-center lg:text-left">
                <div className="text-2xl lg:text-3xl font-bold text-white">1 Gbps</div>
                <div className="text-xs text-white/60 uppercase tracking-wide">Vitesse max</div>
              </div>
              <div className="w-px h-10 bg-white/20 hidden sm:block" />
              <div className="text-center lg:text-left">
                <div className="text-2xl lg:text-3xl font-bold text-white">200+</div>
                <div className="text-xs text-white/60 uppercase tracking-wide">Chaînes TV</div>
              </div>
              <div className="w-px h-10 bg-white/20 hidden sm:block" />
              <div className="text-center lg:text-left">
                <div className="text-2xl lg:text-3xl font-bold text-accent">7j/7</div>
                <div className="text-xs text-white/60 uppercase tracking-wide">Support</div>
              </div>
            </div>
          </div>

          {/* Right - Service Cards Stack */}
          <div className="relative hidden lg:block animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <div className="relative">
              {/* Floating service cards */}
              <div className="absolute -top-4 -left-4 w-72 transform -rotate-6 z-10">
                <ServicePreviewCard 
                  icon={<Wifi className="w-5 h-5" />}
                  title="Internet GIGA"
                  speed="1 Gbps"
                  price="89.99"
                  color="bg-accent"
                />
              </div>
              
              <div className="relative z-20 ml-16 mt-20">
                <ServicePreviewCard 
                  icon={<Smartphone className="w-5 h-5" />}
                  title="Mobile 60 Go"
                  speed="5G/LTE"
                  price="60.00"
                  color="bg-cyan-500"
                  featured
                />
              </div>
              
              <div className="absolute -bottom-8 -right-4 w-72 transform rotate-3 z-10">
                <ServicePreviewCard 
                  icon={<Tv className="w-5 h-5" />}
                  title="TV Premium"
                  speed="25+ chaînes"
                  price="45.00"
                  color="bg-purple-500"
                />
              </div>
            </div>
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

// Service preview card for hero
interface ServicePreviewCardProps {
  icon: React.ReactNode;
  title: string;
  speed: string;
  price: string;
  color: string;
  featured?: boolean;
}

const ServicePreviewCard = ({ icon, title, speed, price, color, featured }: ServicePreviewCardProps) => (
  <div className={`
    bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 
    shadow-2xl transition-transform hover:scale-105
    ${featured ? 'ring-2 ring-accent' : ''}
  `}>
    <div className="flex items-start justify-between mb-3">
      <div className={`p-2 rounded-xl ${color} text-white`}>
        {icon}
      </div>
      {featured && (
        <span className="text-[10px] font-bold uppercase tracking-wider text-accent bg-accent/20 px-2 py-1 rounded-full">
          Populaire
        </span>
      )}
    </div>
    <h4 className="font-semibold text-white mb-1">{title}</h4>
    <p className="text-sm text-white/60 mb-3">{speed}</p>
    <div className="flex items-baseline gap-1">
      <span className="text-2xl font-bold text-white">{price}$</span>
      <span className="text-xs text-white/50">/mois</span>
    </div>
  </div>
);

export default Hero;
