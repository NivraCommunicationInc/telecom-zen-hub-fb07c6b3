import { Button } from "@/components/ui/button";
import { ArrowRight, Check } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";

const Hero = () => {
  const { t, language } = useLanguage();
  const isFr = language === 'fr';

  const highlights = [
    isFr ? "Sans contrat" : "No contract",
    isFr ? "Support 7j/7" : "24/7 Support",
    isFr ? "Activation rapide" : "Fast activation",
  ];

  return (
    <section className="relative bg-gradient-to-b from-primary to-navy-700 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-accent/5 to-transparent" />
        <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-gradient-to-tr from-accent/3 to-transparent" />
      </div>

      <div className="relative container mx-auto px-4 pt-24 pb-16 lg:pt-32 lg:pb-24 max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          
          {/* Left Content */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              <span className="text-sm font-medium text-white">{t('hero.badge')}</span>
            </div>

            {/* Headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-[1.1] tracking-tight text-white mb-5">
              {t('hero.title1')}
              <br />
              <span className="text-accent">{t('hero.title2')}</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg text-white/80 max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed">
              {t('hero.subtitle')}
            </p>

            {/* Highlights */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 mb-8">
              {highlights.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-white/90">
                  <Check className="w-4 h-4 text-accent" />
                  <span className="text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
              <Button 
                variant="hero" 
                size="lg" 
                className="group w-full sm:w-auto text-base px-8 h-12"
                asChild
              >
                <Link to="/contact">
                  {t('hero.cta.order')}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button 
                variant="heroOutline" 
                size="lg" 
                className="w-full sm:w-auto text-base h-12"
                asChild
              >
                <Link to="/mobile">
                  {isFr ? "Voir les forfaits" : "View Plans"}
                </Link>
              </Button>
            </div>
          </div>

          {/* Right - Stats Cards */}
          <div className="hidden lg:block">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <div className="text-4xl font-bold text-white mb-2">1 Gbps</div>
                <div className="text-sm text-white/70">{isFr ? "Vitesse Internet max" : "Max Internet Speed"}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <div className="text-4xl font-bold text-accent mb-2">5G</div>
                <div className="text-sm text-white/70">{isFr ? "Réseau mobile" : "Mobile Network"}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <div className="text-4xl font-bold text-white mb-2">200+</div>
                <div className="text-sm text-white/70">{isFr ? "Chaînes TV" : "TV Channels"}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <div className="text-4xl font-bold text-accent mb-2">7j/7</div>
                <div className="text-sm text-white/70">{isFr ? "Support local" : "Local Support"}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Stats Row */}
        <div className="lg:hidden mt-10 grid grid-cols-3 gap-3">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10 text-center">
            <div className="text-xl font-bold text-white">1 Gbps</div>
            <div className="text-xs text-white/60 mt-1">{isFr ? "Internet" : "Internet"}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10 text-center">
            <div className="text-xl font-bold text-accent">5G</div>
            <div className="text-xs text-white/60 mt-1">{isFr ? "Mobile" : "Mobile"}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10 text-center">
            <div className="text-xl font-bold text-white">7j/7</div>
            <div className="text-xs text-white/60 mt-1">{isFr ? "Support" : "Support"}</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
