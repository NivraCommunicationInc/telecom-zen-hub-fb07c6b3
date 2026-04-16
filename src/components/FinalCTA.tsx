import { ArrowRight, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const FinalCTA = () => {
  const { t } = useLanguage();

  return (
    <section className="py-12 sm:py-20 lg:py-24" style={{ background: '#0D0D0D' }}>
      <div className="container mx-auto px-4 sm:px-6 max-w-[1200px] text-center">
        <div className="max-w-[700px] mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-[40px] font-bold text-white mb-5 sm:mb-7 tracking-[-0.5px]">
            {t('finalcta.title')}
          </h2>
          <ul className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 mb-8 sm:mb-10">
            {[t('finalcta.bullet1'), t('finalcta.bullet2'), t('finalcta.bullet3')].map((text) => (
              <li key={text} className="flex items-center gap-2 text-[14px] font-medium" style={{ color: '#6B7280' }}>
                <Check className="w-4 h-4 shrink-0" style={{ color: '#7C3AED' }} />
                {text}
              </li>
            ))}
          </ul>
          <Link
            to="/commander"
            className="inline-flex items-center justify-center gap-2 px-10 text-[15px] font-bold text-white transition-all"
            style={{ height: 52, borderRadius: 50, background: '#7C3AED' }}
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
