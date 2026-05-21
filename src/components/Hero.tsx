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
    <section className="relative flex items-center overflow-hidden" style={{ background: '#EDE9FF', minHeight: 520 }}>
      <div className="max-w-[1100px] mx-auto px-5 sm:px-10 w-full" style={{ paddingTop: 64, paddingBottom: 48 }}>
        <div className="flex items-center gap-10">
          <div className="max-w-xl flex-1">
            <p className="font-semibold uppercase mb-4" style={{ color: '#7C3AED', fontSize: 12, letterSpacing: 3 }}>
              {t('xhero.eyebrow')}
            </p>

            <h1
              className="font-extrabold mb-5"
              style={{ color: '#111111', fontSize: 'clamp(36px, 7vw, 56px)', lineHeight: 1.1, letterSpacing: '-1px' }}
            >
              {t('xhero.title')}{" "}
              <span style={{ color: '#7C3AED' }}>{t('xhero.titleAccent')}</span>
            </h1>

            <p className="mb-5 max-w-[480px]" style={{ color: '#555555', fontSize: 17, lineHeight: 1.7 }}>
              {t('xhero.subtitle')}
            </p>

            {/* Promo badges — first month free + 30-day guarantee */}
            <div className="flex flex-wrap gap-2 mb-7">
              <span
                className="inline-flex items-center gap-1.5 font-semibold"
                style={{
                  background: '#FFFFFF',
                  color: '#7C3AED',
                  border: '1.5px solid #7C3AED',
                  borderRadius: 999,
                  padding: '6px 14px',
                  fontSize: 12,
                }}
              >
                🎁 {isFr ? 'Premier mois GRATUIT' : 'First month FREE'}
              </span>
              <span
                className="inline-flex items-center gap-1.5 font-semibold"
                style={{
                  background: '#FFFFFF',
                  color: '#10B981',
                  border: '1.5px solid #10B981',
                  borderRadius: 999,
                  padding: '6px 14px',
                  fontSize: 12,
                }}
              >
                🔄 {isFr ? 'Satisfait ou remboursé 30 jours' : '30-day money-back'}
              </span>
            </div>

            <div className="mb-8 flex items-baseline gap-1">
              {isLoading || internetPrice === null ? (
                <Skeleton className="h-16 w-32 rounded-lg bg-purple-100" />
              ) : (
                <>
                  <span style={{ color: '#555555', fontSize: 18 }}>{isFr ? 'Dès' : 'From'}</span>
                  <span className="font-black leading-none ml-2" style={{ color: '#111111', fontSize: 'clamp(48px, 10vw, 72px)' }}>
                    {internetPrice}$
                  </span>
                  <span style={{ color: '#555555', fontSize: 16 }}>/{isFr ? 'mois' : 'mo'}</span>
                </>
              )}
            </div>

            <ul className="flex flex-col gap-2.5 sm:flex-row sm:gap-6 mb-10">
              {[t('xhero.bullet1'), t('xhero.bullet2'), t('xhero.bullet3')].map((text) => (
                <li key={text} className="flex items-center gap-2 text-sm font-medium" style={{ color: '#555555' }}>
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
                className="flex items-center justify-center gap-2 px-7 font-semibold transition-all w-full sm:w-auto"
                style={{ height: 52, borderRadius: 50, border: '2px solid #7C3AED', color: '#7C3AED', fontSize: 15 }}
              >
                {isFr ? 'Découvrir tous nos forfaits' : 'Discover all our plans'} →
              </Link>
            </div>
          </div>

          {/* Hero image — desktop only */}
          <div className="hidden lg:block flex-1">
            <img
              src="https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&q=80"
              alt={isFr ? "Personne profitant d'internet à la maison" : "Person enjoying internet at home"}
              className="w-full max-w-[440px] ml-auto"
              style={{ borderRadius: 24 }}
              loading="eager"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
