import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";

const Hero = () => {
  const { t } = useLanguage();

  return (
    <section className="relative min-h-[85vh] bg-primary overflow-hidden">
      {/* Background - clean gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-navy-700" />
        
        {/* Subtle accent glow */}
        <div className="absolute top-1/3 right-0 w-[600px] h-[600px] bg-accent/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-accent/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative container mx-auto px-4 pt-28 pb-20 lg:pt-36 lg:pb-28 max-w-6xl">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 mb-8 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
            </span>
            <span className="text-sm font-medium text-white/90">{t('hero.badge')}</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight text-white mb-6 animate-fade-in" style={{ animationDelay: "0.1s" }}>
            {t('hero.title1')}
            <br />
            <span className="text-accent">{t('hero.title2')}</span>
          </h1>

          {/* Subheading */}
          <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-10 animate-fade-in leading-relaxed" style={{ animationDelay: "0.15s" }}>
            {t('hero.subtitle')}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <Button 
              variant="hero" 
              size="lg" 
              className="group w-full sm:w-auto text-base px-8 h-14"
              asChild
            >
              <Link to="/contact">
                {t('hero.cta.order')}
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="w-full sm:w-auto text-base h-14 bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
              asChild
            >
              <Link to="/mobile">
                Voir les forfaits
              </Link>
            </Button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto animate-fade-in" style={{ animationDelay: "0.25s" }}>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="text-2xl lg:text-3xl font-bold text-white">1 Gbps</div>
              <div className="text-xs text-white/60 mt-1">Vitesse max</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="text-2xl lg:text-3xl font-bold text-white">200+</div>
              <div className="text-xs text-white/60 mt-1">Chaînes TV</div>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="text-2xl lg:text-3xl font-bold text-accent">7j/7</div>
              <div className="text-xs text-white/60 mt-1">Support</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
          <path d="M0 60L48 55C96 50 192 40 288 35C384 30 480 30 576 33.3C672 36.7 768 43.3 864 45C960 46.7 1056 43.3 1152 41.7C1248 40 1344 40 1392 40L1440 40V60H1392C1344 60 1248 60 1152 60C1056 60 960 60 864 60C768 60 672 60 576 60C480 60 384 60 288 60C192 60 96 60 48 60H0Z" fill="hsl(var(--background))"/>
        </svg>
      </div>
    </section>
  );
};

export default Hero;
