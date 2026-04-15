import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const FinalCTA = () => {
  const { t } = useLanguage();

  return (
    <section className="py-12 sm:py-20 lg:py-28 bg-gradient-to-br from-purple-700 via-purple-600 to-purple-800">
      <div className="container mx-auto px-4 sm:px-6 max-w-[1200px] text-center relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-white/5 to-transparent" />
        </div>
        <div className="relative max-w-[700px] mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-[2.5rem] font-bold text-white mb-5 sm:mb-7 tracking-[-0.025em]">
            {t('finalcta.title')}
          </h2>
          <ul className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 mb-8 sm:mb-10">
            {[t('finalcta.bullet1'), t('finalcta.bullet2'), t('finalcta.bullet3')].map((text) => (
              <li key={text} className="flex items-center gap-2 text-[14px] text-white/80 font-medium">
                <Check className="w-4 h-4 text-white shrink-0" />
                {text}
              </li>
            ))}
          </ul>
          <Button
            className="bg-white text-purple-700 hover:bg-white/90 rounded-[10px] sm:rounded-full px-8 sm:px-12 text-base font-bold shadow-lg hover:shadow-xl transition-all duration-200 w-full sm:w-auto"
            style={{ height: 52 }}
            asChild
          >
            <Link to="/commander">
              {t('finalcta.cta')}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
