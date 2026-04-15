import { Shield, Zap, Headphones, CheckCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const WhyNivra = () => {
  const { t } = useLanguage();

  const points = [
    { icon: Shield, titleKey: "why.nocontract", textKey: "why.nocontract.desc" },
    { icon: CheckCircle, titleKey: "why.simple", textKey: "why.simple.desc" },
    { icon: Headphones, titleKey: "why.support", textKey: "why.support.desc" },
    { icon: Zap, titleKey: "why.fast", textKey: "why.fast.desc" },
  ];

  return (
    <section className="py-10 sm:py-20 lg:py-28 bg-[#0d0d0d]">
      <div className="container mx-auto px-4 sm:px-6 max-w-[1200px]">
        <h2 className="text-2xl sm:text-3xl md:text-[2.5rem] font-bold text-white text-center mb-8 sm:mb-14 tracking-[-0.025em]">
          {t('why.title')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-6 lg:gap-7 max-w-[920px] mx-auto">
          {points.map((p) => (
            <div key={p.titleKey} className="bg-[#1a1a1a] rounded-xl sm:rounded-2xl p-5 sm:p-8 border border-white/10 hover:border-purple-500/30 hover:shadow-[0_0_20px_rgba(139,92,246,0.08)] transition-all duration-300 group">
              <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-lg sm:rounded-xl bg-purple-500/10 flex items-center justify-center mb-4 sm:mb-5 group-hover:bg-purple-500/20 transition-colors">
                <p.icon className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
              </div>
              <h3 className="font-bold text-white mb-1.5 sm:mb-2 text-[15px] sm:text-base">{t(p.titleKey)}</h3>
              <p className="text-[14px] sm:text-sm text-white/60 leading-relaxed">{t(p.textKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyNivra;
