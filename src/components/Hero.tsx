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
      <div className="max-w-[1100px] mx-auto px-5 sm:px-10 w-full" style={{ paddingTop: 64, paddingBottom: 48 }}>
        <div className="max-w-2xl">
          <p className="font-semibold uppercase mb-4" style={{ color: '#7C3AED', fontSize: 12, letterSpacing: 3 }}>
            {t('xhero.eyebrow')}
          </p>

          <h1
            className="font-extrabold text-white mb-5"
            style={{ fontSize: 'clamp(40px, 8vw, 64px)', lineHeight: 1.1, letterSpacing: '-1px' }}
          >
            {t('xhero.title')}{" "}
            <span style={{ color: '#7C3AED' }}>{t('xhero.titleAccent')}</span>
          </h1>

          <p className="mb-8 max-w-[480px]" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 17, lineHeight: 1.7 }}>
            {t('xhero.subtitle')}
          </p>

          <div className="mb-8 flex items-baseline gap-1">
            {isLoading || internetPrice === null ? (
              <Skeleton className="h-16 w-32 rounded-lg bg-white/10" />
            ) : (
              <>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 18 }}>{isFr ? 'Dès' : 'From'}</span>
                <span className="text-white font-black leading-none ml-2" style={{ fontSize: 'clamp(48px, 10vw, 72px)' }}>
                  {internetPrice}$
                </span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 16 }}>/{isFr ? 'mois' : 'mo'}</span>
              </>
            )}
          </div>

          <ul className="flex flex-col gap-2.5 sm:flex-row sm:gap-6 mb-10">
            {[t('xhero.bullet1'), t('xhero.bullet2'), t('xhero.bullet3')].map((text) => (
              <li key={text} className="flex items-center gap-2 text-sm font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
                <Check className="w-4 h-4 shrink-0" style={{ color: '#7C3AED' }} />
                {text}
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/forfaits"
              className="flex items-center justify-center gap-2 px-8 font-bold text-white transition-all w-full sm:w-auto"
              style={{ height: 52, borderRadius: 50, background: '#7C3AED', fontSize: 15 }}
              onMouseEnter={e => (e.currentTarget.style.background = '#6D28D9')}
              onMouseLeave={e => (e.currentTarget.style.background = '#7C3AED')}
            >
              {t('xhero.cta')}
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              to="/forfaits"
              className="flex items-center justify-center gap-2 px-7 font-semibold text-white bg-transparent transition-all w-full sm:w-auto"
              style={{ height: 52, borderRadius: 50, border: '2px solid rgba(255,255,255,0.4)', fontSize: 15 }}
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
