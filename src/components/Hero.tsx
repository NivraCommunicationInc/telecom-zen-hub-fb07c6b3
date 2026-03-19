import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Zap, Clock, Headphones, Flame } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { usePublicServices } from "@/hooks/usePublicServices";
import { Badge } from "@/components/ui/badge";

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
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700">
      {/* Animated background shapes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -right-24 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 -left-32 w-[400px] h-[400px] bg-blue-400/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 max-w-[1320px] relative">
        <div className="py-20 sm:py-28 lg:py-36 text-center max-w-4xl mx-auto">
          {/* Promo badge */}
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-5 py-2 mb-8">
            <Flame className="w-4 h-4 text-amber-300" />
            <span className="text-sm font-semibold text-white">
              {isFr ? "Offres exclusives — Durée limitée" : "Exclusive offers — Limited time"}
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold leading-[1.05] text-white mb-6 tracking-tight">
            {isFr
              ? <>Offres exclusives <span className="text-amber-300">Nivra</span></>
              : <>Exclusive <span className="text-amber-300">Nivra</span> Offers</>}
          </h1>

          <p className="text-lg sm:text-xl text-white/80 mb-10 leading-relaxed max-w-2xl mx-auto">
            {isFr
              ? "Internet et mobile à prix réduit pour une durée limitée. Des forfaits simples, rapides et sans surprise."
              : "Internet and mobile at reduced prices for a limited time. Simple, fast plans with no surprises."}
          </p>

          {/* Price callout */}
          <div className="inline-flex items-baseline gap-2 mb-10 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-8 py-4">
            <span className="text-white/70 text-lg">{isFr ? "À partir de" : "Starting at"}</span>
            <span className="text-5xl font-extrabold text-white">{internetPrice}$</span>
            <span className="text-white/60 text-lg">/{isFr ? "mois" : "mo"}</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Button
              className="bg-amber-400 hover:bg-amber-300 text-slate-900 rounded-full px-10 h-14 text-base font-bold shadow-lg shadow-amber-400/30 w-full sm:w-auto transition-all duration-200 hover:scale-105"
              asChild
            >
              <Link to="/compare">
                {isFr ? "Voir les offres" : "See offers"}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button
              className="border-2 border-white/30 text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full px-8 h-14 text-base font-semibold w-full sm:w-auto transition-all duration-200"
              asChild
            >
              <Link to="/portal/auth">
                {isFr ? "Commander maintenant" : "Order now"}
              </Link>
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {bullets.map((bullet) => (
              <div key={bullet.text} className="flex items-center gap-2.5 text-white/80">
                <div className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center">
                  <bullet.icon className="w-3.5 h-3.5 text-amber-300" />
                </div>
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
