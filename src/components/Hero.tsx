import { Button } from "@/components/ui/button";
import { ArrowRight, Check, MapPin } from "lucide-react";
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
    <section className="relative min-h-[600px] lg:min-h-[680px] flex items-center overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt={t('xhero.title')}
          className="w-full h-full object-cover"
          loading="eager"
          width={1920}
          height={1080}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/30" />
      </div>

      <div className="relative container mx-auto px-4 sm:px-6 max-w-[1200px] py-20 lg:py-28">
        <div className="max-w-xl">
          <p className="text-sm font-semibold text-white/80 uppercase tracking-wider mb-4">
            {t('xhero.eyebrow')}
          </p>

          <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold leading-[1.06] text-white mb-6 tracking-[-0.03em]">
            {t('xhero.title')}{" "}
            <span className="text-purple-400">{t('xhero.titleAccent')}</span>
          </h1>

          <p className="text-lg text-white/70 mb-8 leading-[1.7] max-w-md">
            {t('xhero.subtitle')}
          </p>

          <div className="mb-8 inline-flex items-baseline gap-2">
            {isLoading || internetPrice === null ? (
              <Skeleton className="h-16 w-32 rounded-lg bg-white/10" />
            ) : (
              <>
                <span className="text-white text-lg font-medium">$</span>
                <span className="text-7xl sm:text-8xl font-black text-white leading-none">
                  {internetPrice}
                </span>
                <span className="text-white/60 text-lg font-medium">/mo</span>
              </>
            )}
          </div>

          <ul className="flex flex-col sm:flex-row gap-3 sm:gap-6 mb-10">
            {[t('xhero.bullet1'), t('xhero.bullet2'), t('xhero.bullet3')].map((text) => (
              <li key={text} className="flex items-center gap-2 text-sm text-white/80 font-medium">
                <Check className="w-4 h-4 text-purple-400" />
                {text}
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row gap-3.5 sm:gap-4">
            <Button
              className="bg-white hover:bg-white/90 text-black rounded-full h-14 px-10 text-base font-bold w-full sm:w-auto shadow-lg hover:shadow-xl transition-all duration-200"
              asChild
            >
              <Link to="/#forfaits">
                {t('xhero.cta')}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button
              variant="outline"
              className="rounded-full h-14 px-10 text-base font-bold w-full sm:w-auto border-2 border-white/30 text-white hover:bg-white/10 hover:border-white/50 bg-transparent transition-all duration-200"
              asChild
            >
              <Link to="/commander">
                <MapPin className="w-4 h-4 mr-2" />
                {t('xhero.ctaSecondary')}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
