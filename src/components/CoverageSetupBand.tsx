import { Zap, Calendar, Headphones } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const CoverageSetupBand = () => {
  const { language } = useLanguage();
  const isFr = language === 'fr';

  const items = [
    {
      icon: Zap,
      text: isFr ? "Activation rapide" : "Fast activation",
    },
    {
      icon: Calendar,
      text: isFr ? "Installation sur rendez-vous" : "Scheduled installation",
    },
    {
      icon: Headphones,
      text: isFr ? "Support humain" : "Human support",
    },
  ];

  return (
    <section className="bg-accent/5 border-y border-accent/10">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-wrap items-center justify-center gap-6 lg:gap-12">
          {items.map((item, index) => (
            <div key={index} className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-accent/15 flex items-center justify-center">
                <item.icon className="w-4 h-4 text-accent" />
              </div>
              <span className="text-sm font-medium text-foreground">
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CoverageSetupBand;