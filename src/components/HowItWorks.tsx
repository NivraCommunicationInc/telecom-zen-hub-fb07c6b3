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
    <section className="py-20 lg:py-28 bg-white">
      <div className="container mx-auto px-4 sm:px-6 max-w-[1200px]">
        <h2 className="text-3xl md:text-[2.5rem] font-bold text-black text-center mb-16 tracking-[-0.025em]">
          {t('how.title')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
          {steps.map((step, i) => (
            <div key={i} className="relative text-center group">
              <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mx-auto mb-5 group-hover:bg-purple-200 transition-colors">
                <step.icon className="w-7 h-7 text-purple-600" />
              </div>
              <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold mx-auto mb-4">
                {i + 1}
              </div>
              <h3 className="font-bold text-black mb-2">{t(step.titleKey)}</h3>
              <p className="text-sm text-black/60 leading-relaxed max-w-[220px] mx-auto">{t(step.textKey)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
