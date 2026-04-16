import { ArrowRight, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const FinalCTA = () => {
  const { t } = useLanguage();

  return (
    <section style={{ background: '#0D0D0D', paddingTop: 48, paddingBottom: 48 }}>
      <div className="max-w-[1100px] mx-auto px-5 sm:px-10 text-center">
        <div className="max-w-[700px] mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-[36px] font-extrabold text-white mb-5 sm:mb-7" style={{ letterSpacing: '-0.5px' }}>
            {t('finalcta.title')}
          </h2>
          <ul className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 mb-8 sm:mb-10">
            {[t('finalcta.bullet1'), t('finalcta.bullet2'), t('finalcta.bullet3')].map((text) => (
              <li key={text} className="flex items-center gap-2 font-medium" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                <Check className="w-4 h-4 shrink-0" style={{ color: '#7C3AED' }} />
                {text}
              </li>
            ))}
          </ul>
          <Link
            to="/commander"
            className="inline-flex items-center justify-center gap-2 px-10 font-bold text-white transition-all"
            style={{ height: 52, borderRadius: 50, background: '#7C3AED', fontSize: 15 }}
            onMouseEnter={e => (e.currentTarget.style.background = '#6D28D9')}
            onMouseLeave={e => (e.currentTarget.style.background = '#7C3AED')}
          >
            {t('finalcta.cta')}
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
