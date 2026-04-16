import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { usePublicServices } from "@/hooks/usePublicServices";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import heroImage from "@/assets/hero-xfinity.jpg";

const Hero = () => {
  const { t } = useLanguage();
  const { data: services, isLoading } = usePublicServices({ surface: "website", categories: ["Internet"] });

  const internetPrice = (() => {
    if (!services || services.length === 0) return null;
    return Math.min(...services.map(s => Number(s.price))).toFixed(0);
  })();

  return (
    <section className="relative min-h-[520px] lg:min-h-[680px] flex items-center overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt={t('xhero.title')}
          className="w-full h-full object-cover hidden md:block"
          loading="eager"
          width={1920}
          height={1080}
        />
        {/* Mobile: solid dark bg instead of image */}
        <div className="absolute inset-0 bg-[#111118] md:bg-gradient-to-r md:from-black/80 md:via-black/60 md:to-black/30" />
      </div>

      <div className="relative container mx-auto px-4 sm:px-6 max-w-[1200px] py-12 md:py-20 lg:py-28">
        <div className="flex items-center gap-12 lg:gap-16">
          {/* Left content */}
          <div className="max-w-xl flex-1">
            <p className="text-xs sm:text-sm font-semibold text-white/80 uppercase tracking-wider mb-3 sm:mb-4">
              {t('xhero.eyebrow')}
            </p>

            <h1
              className="font-extrabold text-white mb-4 sm:mb-6 tracking-[-0.03em]"
              style={{
                fontSize: 'clamp(28px, 7vw, 3.5rem)',
                lineHeight: 1.15,
              }}
            >
              {t('xhero.title')}{" "}
              <span className="text-[#a78bfa]">{t('xhero.titleAccent')}</span>
            </h1>

            <p className="text-[16px] sm:text-lg text-white/70 mb-6 sm:mb-8 leading-[1.6] max-w-md">
              {t('xhero.subtitle')}
            </p>

            <div className="mb-6 sm:mb-8 inline-flex items-baseline gap-2">
              {isLoading || internetPrice === null ? (
                <Skeleton className="h-16 w-32 rounded-lg bg-white/10" />
              ) : (
                <>
                  <span className="text-white text-lg font-medium">$</span>
                  <span className="text-6xl sm:text-8xl font-black text-white leading-none">
                    {internetPrice}
                  </span>
                  <span className="text-white/60 text-lg font-medium">/mo</span>
                </>
              )}
            </div>

            <ul className="flex flex-col gap-2.5 sm:flex-row sm:gap-6 mb-8 sm:mb-10">
              {[t('xhero.bullet1'), t('xhero.bullet2'), t('xhero.bullet3')].map((text) => (
                <li key={text} className="flex items-center gap-2 text-sm text-white/80 font-medium">
                  <Check className="w-4 h-4 text-[#5b21b6] shrink-0" />
                  {text}
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-4">
              <Button
                className="bg-white hover:bg-white/90 text-black rounded-[10px] sm:rounded-full px-10 text-base font-bold w-full sm:w-auto shadow-lg hover:shadow-xl transition-all duration-200"
                style={{ height: 52 }}
                asChild
              >
                <Link to="/forfaits">
                  {t('xhero.cta')}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
              <Link
                to="/forfaits"
                className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 text-[15px] font-semibold text-white bg-transparent border-2 border-white/30 hover:bg-white/10 hover:border-white/50 transition-all duration-200"
                style={{ height: 52, borderRadius: 10, textDecoration: 'none' }}
              >
                {isFr ? 'Découvrir tous nos forfaits →' : 'Discover all our plans →'}
              </Link>
            </div>
          </div>

          {/* Right testimonial card — hidden on mobile */}
          <div className="hidden lg:flex flex-col items-center gap-4 max-w-xs">
            <div className="w-64 h-64 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20">
              <img
                src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&h=600&fit=crop"
                alt="Famille québécoise à la maison avec internet Nivra"
                className="w-full h-full object-cover"
                loading="eager"
              />
            </div>
            <div className="flex items-center gap-1 text-yellow-400">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-current" />
              ))}
            </div>
            <div className="text-center">
              <p className="text-white/90 text-sm font-medium italic">
                "Économisé 40$/mois vs Bell"
              </p>
              <p className="text-white/50 text-xs mt-1">
                Marie-Claude B. — Rosemont, Montréal
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
