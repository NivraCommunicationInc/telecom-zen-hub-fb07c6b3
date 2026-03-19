import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";

const Hero = () => {
  const { language } = useLanguage();
  const isFr = language === 'fr';

  // Countdown timer — 14 days from now (rolling)
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 });

  useEffect(() => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 14);
    targetDate.setHours(23, 59, 59, 0);

    const tick = () => {
      const now = new Date().getTime();
      const diff = targetDate.getTime() - now;
      if (diff <= 0) return;
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
      });
    };

    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative overflow-hidden bg-black">
      {/* Dramatic spotlight background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Central spotlight cone */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px]"
          style={{
            background: 'conic-gradient(from 180deg at 50% 0%, transparent 130deg, rgba(250,204,21,0.15) 170deg, rgba(250,204,21,0.25) 180deg, rgba(250,204,21,0.15) 190deg, transparent 230deg)',
          }}
        />
        {/* Ambient glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-amber-400/10 rounded-full blur-[120px]" />
        {/* Subtle side lights */}
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-amber-500/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-amber-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="container mx-auto px-4 max-w-[1320px] relative">
        <div className="py-20 sm:py-28 lg:py-36 text-center max-w-5xl mx-auto">
          {/* Small label */}
          <p className="text-amber-400 text-sm sm:text-base font-semibold tracking-[0.2em] uppercase mb-4">
            {isFr ? "L'événement" : "The event"}
          </p>

          {/* MASSIVE title */}
          <h1 className="mb-6">
            <span className="block text-5xl sm:text-7xl lg:text-[7rem] font-black text-amber-400 leading-[0.95] tracking-tight uppercase">
              PROMO
            </span>
            <span className="block text-4xl sm:text-6xl lg:text-[5.5rem] font-bold text-white leading-[1] tracking-tight mt-1">
              {isFr ? "en lumière" : "spotlight"}
            </span>
          </h1>

          {/* CTA */}
          <Button
            className="bg-amber-400 hover:bg-amber-300 text-black rounded-none px-10 h-14 text-base font-bold uppercase tracking-wider transition-all duration-200 hover:scale-105 mt-4 mb-10"
            asChild
          >
            <Link to="/compare">
              {isFr ? "Découvrez toutes les offres" : "Discover all offers"}
            </Link>
          </Button>

          {/* Countdown */}
          <div className="flex flex-col items-center gap-3">
            <p className="text-white/60 text-sm">
              {isFr ? "Nos offres Promo en lumière se terminent dans :" : "Our Promo spotlight offers end in:"}
            </p>
            <div className="flex items-center gap-4 text-white font-bold text-lg sm:text-xl">
              <div className="flex items-baseline gap-1">
                <span className="font-extrabold text-2xl sm:text-3xl">{timeLeft.days}</span>
                <span className="text-white/50 text-sm font-normal">{isFr ? "jours" : "days"}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-extrabold text-2xl sm:text-3xl">{timeLeft.hours}</span>
                <span className="text-white/50 text-sm font-normal">{isFr ? "heures" : "hours"}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-extrabold text-2xl sm:text-3xl">{timeLeft.minutes}</span>
                <span className="text-white/50 text-sm font-normal">minutes</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
