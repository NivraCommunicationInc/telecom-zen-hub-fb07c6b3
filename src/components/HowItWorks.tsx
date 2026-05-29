import { ClipboardList, MapPin, Settings, Wifi } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const HowItWorks = () => {
  const { t } = useLanguage();

  const steps = [
    { icon: ClipboardList, titleKey: "how.step1", textKey: "how.step1.desc" },
    { icon: MapPin, titleKey: "how.step2", textKey: "how.step2.desc" },
    { icon: Settings, titleKey: "how.step3", textKey: "how.step3.desc" },
    { icon: Wifi, titleKey: "how.step4", textKey: "how.step4.desc" },
  ];

  return (
    <section className="py-10 sm:py-20 lg:py-28" style={{ background: '#0A0A18' }}>
      <div className="container mx-auto px-4 sm:px-6 max-w-[1200px]">
        <h2 className="font-bold text-white text-center mb-10 sm:mb-16" style={{ fontSize: 'clamp(22px, 3.5vw, 38px)', letterSpacing: '-0.8px' }}>
          {t('how.title')}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8 lg:gap-10">
          {steps.map((step, i) => (
            <div key={i} className="relative text-center group">
              <div
                className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-5 transition-colors"
                style={{ background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.3)' }}
              >
                <step.icon className="w-5 h-5 sm:w-7 sm:h-7" style={{ color: '#A78BFA' }} />
              </div>
              <div
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold mx-auto mb-3 sm:mb-4"
                style={{ background: '#7C3AED', color: '#FFFFFF' }}
              >
                {i + 1}
              </div>
              <h3 className="font-bold text-white mb-1.5 sm:mb-2 text-[14px] sm:text-base">{t(step.titleKey)}</h3>
              <p className="text-[13px] sm:text-sm leading-relaxed max-w-[220px] mx-auto" style={{ color: 'rgba(255,255,255,0.55)' }}>{t(step.textKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
