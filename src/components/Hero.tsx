import { Button } from "@/components/ui/button";
import { ArrowRight, Check, Zap, Headphones, Clock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

const Hero = () => {
  const { language } = useLanguage();
  const isFr = language === "fr";

  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 });

  useEffect(() => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 14);
    targetDate.setHours(23, 59, 59, 0);

    const tick = () => {
      const now = Date.now();
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

  const bullets = [
    { icon: Check, text: isFr ? "Sans engagement" : "No contract" },
    { icon: Zap, text: isFr ? "Installation rapide" : "Fast installation" },
    { icon: Headphones, text: isFr ? "Support local 7j/7" : "Local support 7/7" },
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-foreground via-foreground to-primary text-primary-foreground">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-background/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[240px] w-[240px] rounded-full bg-primary/40 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[240px] w-[240px] rounded-full bg-primary/30 blur-3xl" />
      </div>

      <div className="container relative mx-auto max-w-[1320px] px-4">
        <div className="mx-auto max-w-5xl py-20 text-center sm:py-28 lg:py-36">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-background/20 bg-background/10 px-4 py-2 backdrop-blur-sm">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-[0.18em]">
              {isFr ? "OFFRE EN COURS" : "CURRENT OFFER"}
            </span>
          </div>

          <h1 className="mb-6 text-5xl font-black leading-[0.95] tracking-tight text-primary-foreground sm:text-7xl lg:text-[5.8rem]">
            {isFr ? "Internet et mobile haute performance" : "High-performance Internet and mobile"}
          </h1>

          <p className="mx-auto mb-10 max-w-3xl text-lg leading-relaxed text-primary-foreground/80 sm:text-xl">
            {isFr
              ? "Des forfaits simples, rapides et sans surprise. Activez votre service en quelques minutes."
              : "Simple, fast plans with no surprises. Activate your service in minutes."}
          </p>

          <div className="mb-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              className="h-14 w-full rounded-full bg-background px-8 text-base font-bold text-foreground shadow-premium hover:bg-background/90 sm:w-auto"
              asChild
            >
              <Link to="/compare">
                {isFr ? "Voir les forfaits" : "See plans"}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              variant="outline"
              className="h-14 w-full rounded-full border-background/30 bg-transparent px-8 text-base font-semibold text-primary-foreground hover:bg-background/10 sm:w-auto"
              asChild
            >
              <Link to="/portal/auth">{isFr ? "Commander maintenant" : "Order now"}</Link>
            </Button>
          </div>

          <div className="mb-12 flex flex-wrap items-center justify-center gap-5 sm:gap-8">
            {bullets.map((bullet) => (
              <div key={bullet.text} className="flex items-center gap-2.5 text-primary-foreground/85">
                <bullet.icon className="h-4 w-4" />
                <span className="text-sm font-semibold">{bullet.text}</span>
              </div>
            ))}
          </div>

          <div className="mx-auto flex w-full max-w-xl items-center justify-center gap-5 rounded-2xl border border-background/20 bg-background/10 px-6 py-4 backdrop-blur-sm">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black sm:text-4xl">{timeLeft.days}</span>
              <span className="text-xs uppercase tracking-wider text-primary-foreground/70">{isFr ? "jours" : "days"}</span>
            </div>
            <div className="h-8 w-px bg-background/20" />
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black sm:text-4xl">{timeLeft.hours}</span>
              <span className="text-xs uppercase tracking-wider text-primary-foreground/70">{isFr ? "heures" : "hours"}</span>
            </div>
            <div className="h-8 w-px bg-background/20" />
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black sm:text-4xl">{timeLeft.minutes}</span>
              <span className="text-xs uppercase tracking-wider text-primary-foreground/70">minutes</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
