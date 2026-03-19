import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Zap, Clock, Headphones } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { usePublicServices } from "@/hooks/usePublicServices";

const Hero = () => {
  const { language } = useLanguage();
  const isFr = language === 'fr';
  const { data: services } = usePublicServices();

  const internetPrice = (() => {
    if (!services) return "--";
    const internetServices = services.filter(s => s.category === "Internet");
    if (internetServices.length === 0) return "--";
    return Math.min(...internetServices.map(s => Number(s.price))).toFixed(0);
  })();

  const bullets = [
    { icon: Check, text: isFr ? "Sans engagement" : "No contract" },
    { icon: Zap, text: isFr ? "Installation rapide" : "Fast installation" },
    { icon: Headphones, text: isFr ? "Support local 7j/7" : "Local support 7/7" },
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white">
      <div className="container mx-auto px-4 max-w-[1320px] relative">
        <div className="py-20 sm:py-28 lg:py-36 text-center max-w-4xl mx-auto">
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold leading-[1.1] text-slate-900 mb-6 tracking-tight">
            {isFr
              ? "Internet et mobile haute performance"
              : "High-performance Internet and mobile"}
          </h1>

          <p className="text-lg sm:text-xl text-slate-500 mb-10 leading-relaxed max-w-2xl mx-auto">
            {isFr
              ? "Des forfaits simples, rapides et sans surprise. Activez votre service en quelques minutes."
              : "Simple, fast plans with no surprises. Activate your service in minutes."}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-8 h-14 text-base font-semibold shadow-md shadow-blue-600/20 w-full sm:w-auto"
              asChild
            >
              <Link to="/compare">
                {isFr ? "Voir les forfaits" : "See plans"}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button
              variant="outline"
              className="border-slate-300 text-slate-700 bg-white hover:bg-slate-50 rounded-full px-8 h-14 text-base font-medium w-full sm:w-auto"
              asChild
            >
              <Link to="/portal/auth">
                {isFr ? "Commander maintenant" : "Order now"}
              </Link>
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {bullets.map((bullet) => (
              <div key={bullet.text} className="flex items-center gap-2.5 text-slate-500">
                <bullet.icon className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">{bullet.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
