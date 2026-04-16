import { ArrowRight, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { usePublicServices } from "@/hooks/usePublicServices";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";

const Hero = () => {
  const { t, language } = useLanguage();
  const isFr = language === 'fr';
  const { data: services, isLoading } = usePublicServices({ surface: "website", categories: ["Internet"] });

  const internetPrice = (() => {
    if (!services || services.length === 0) return null;
    return Math.min(...services.map(s => Number(s.price))).toFixed(0);
  })();

  return (
    <section className="relative flex items-center overflow-hidden" style={{ background: '#111111', minHeight: 520 }}>
      <div className="container mx-auto px-5 sm:px-6 max-w-[1200px] py-16 md:py-24 lg:py-32">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[2px] text-white/50 mb-4">
            {t('xhero.eyebrow')}
          </p>

          <h1
            className="font-extrabold text-white mb-5 tracking-[-1px]"
            style={{ fontSize: 'clamp(36px, 8vw, 68px)', lineHeight: 1.08 }}
          >
            {t('xhero.title')}{" "}
            <span style={{ color: '#7c3aed' }}>{t('xhero.titleAccent')}</span>
          </h1>

          <p className="text-base sm:text-lg text-white/60 mb-8 leading-[1.7] max-w-md">
            {t('xhero.subtitle')}
          </p>

          <div className="mb-8 flex items-baseline gap-1">
            {isLoading || internetPrice === null ? (
              <Skeleton className="h-16 w-32 rounded-lg bg-white/10" />
            ) : (
              <>
                <span className="text-white/60 text-lg font-medium">{isFr ? 'Dès' : 'From'}</span>
                <span className="text-5xl sm:text-7xl font-black text-white leading-none ml-2">
                  {internetPrice}$
                </span>
                <span className="text-white/40 text-base font-medium">/{isFr ? 'mois' : 'mo'}</span>
              </>
            )}
          </div>

          <ul className="flex flex-col gap-2.5 sm:flex-row sm:gap-6 mb-10">
            {[t('xhero.bullet1'), t('xhero.bullet2'), t('xhero.bullet3')].map((text) => (
              <li key={text} className="flex items-center gap-2 text-sm text-white/70 font-medium">
                <Check className="w-4 h-4 shrink-0" style={{ color: '#7c3aed' }} />
                {text}
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/forfaits"
              className="flex items-center justify-center gap-2 px-8 text-[15px] font-bold text-white hover:opacity-90 transition-all w-full sm:w-auto"
              style={{ height: 52, borderRadius: 50, background: '#7c3aed' }}
            >
              {t('xhero.cta')}
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/forfaits"
              className="flex items-center justify-center gap-2 px-7 text-[15px] font-semibold text-white bg-transparent border-2 border-white/25 hover:border-white/50 transition-all w-full sm:w-auto"
              style={{ height: 52, borderRadius: 50 }}
            >
              {isFr ? 'Découvrir tous nos forfaits' : 'Discover all our plans'} →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
