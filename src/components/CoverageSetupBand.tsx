import { Zap, Calendar, Headphones, Building2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const CoverageSetupBand = () => {
  const { t } = useLanguage();

  const items = [
    {
      icon: Zap,
      textKey: 'hero.trust.activation',
    },
    {
      icon: Calendar,
      textKey: 'hero.trust.installation',
    },
    {
      icon: Headphones,
      textKey: 'hero.trust.support',
    },
    {
      icon: Building2,
      textKey: 'hero.trust.solutions',
    },
  ];

  return (
    <section className="bg-accent/5 border-y border-border">
      <div className="container mx-auto px-4 py-4 max-w-6xl">
        <div className="flex flex-wrap items-center justify-center gap-6 lg:gap-10">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2.5 min-w-0 max-w-full">
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                <item.icon className="w-4 h-4 text-accent" />
              </div>
              <span className="text-xs sm:text-sm font-medium text-foreground hyphens-none break-normal text-balance">
                {t(item.textKey)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CoverageSetupBand;