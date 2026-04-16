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
    <section className="relative flex items-center overflow-hidden" style={{ background: '#0D0D0D', minHeight: 520 }}>
      <div className="container mx-auto px-5 sm:px-6 max-w-[1200px] py-16 md:py-24 lg:py-32">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[2px] mb-4" style={{ color: '#6B7280' }}>
            {t('xhero.eyebrow')}
          </p>

          <h1
            className="font-extrabold text-white mb-5 tracking-[-1px]"
            style={{ fontSize: 'clamp(36px, 8vw, 68px)', lineHeight: 1.08 }}
          >
            {t('xhero.title')}{" "}
            <span style={{ color: '#7C3AED' }}>{t('xhero.titleAccent')}</span>
          </h1>

          <p className="text-base sm:text-lg mb-8 leading-[1.7] max-w-md" style={{ color: '#6B7280' }}>
            {t('xhero.subtitle')}
          </p>

          <div className="mb-8 flex items-baseline gap-1">
            {isLoading || internetPrice === null ? (
              <Skeleton className="h-16 w-32 rounded-lg bg-white/10" />
            ) : (
              <>
                <span className="text-lg font-medium" style={{ color: '#6B7280' }}>{isFr ? 'Dès' : 'From'}</span>
                <span className="text-5xl sm:text-7xl font-black text-white leading-none ml-2">
                  {internetPrice}$
                </span>
                <span className="text-base font-medium" style={{ color: '#6B7280' }}>/{isFr ? 'mois' : 'mo'}</span>
              </>
            )}
          </div>

          <ul className="flex flex-col gap-2.5 sm:flex-row sm:gap-6 mb-10">
            {[t('xhero.bullet1'), t('xhero.bullet2'), t('xhero.bullet3')].map((text) => (
              <li key={text} className="flex items-center gap-2 text-sm font-medium" style={{ color: '#6B7280' }}>
                <Check className="w-4 h-4 shrink-0" style={{ color: '#7C3AED' }} />
                {text}
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/forfaits"
              className="flex items-center justify-center gap-2 px-8 text-[15px] font-bold text-white transition-all w-full sm:w-auto"
              style={{ height: 52, borderRadius: 50, background: '#7C3AED' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#6D28D9')}
              onMouseLeave={e => (e.currentTarget.style.background = '#7C3AED')}
            >
              {t('xhero.cta')}
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/forfaits"
              className="flex items-center justify-center gap-2 px-7 text-[15px] font-semibold text-white bg-transparent transition-all w-full sm:w-auto"
              style={{ height: 52, borderRadius: 50, border: '2px solid rgba(255,255,255,0.25)' }}
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
