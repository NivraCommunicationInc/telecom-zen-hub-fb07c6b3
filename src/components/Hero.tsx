import { Button } from "@/components/ui/button";
import { ArrowRight, Check, MapPin, Wifi, Shield, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { usePublicServices } from "@/hooks/usePublicServices";
import { Skeleton } from "@/components/ui/skeleton";

const Hero = () => {
  const { data: services, isLoading } = usePublicServices({ surface: "website", categories: ["Internet"] });

  const internetPrice = (() => {
    if (!services || services.length === 0) return null;
    return Math.min(...services.map(s => Number(s.price))).toFixed(0);
  })();

  return (
    <section className="bg-background">
      <div className="container mx-auto px-4 sm:px-6 max-w-[1200px] py-14 sm:py-18 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left — text content */}
          <div className="text-center lg:text-left">
            <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold leading-[1.1] text-foreground mb-4 tracking-tight">
              Internet résidentiel simple et fiable —{" "}
              <span className="text-primary">sans contrat</span>
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground mb-8 leading-relaxed max-w-lg mx-auto lg:mx-0">
              Forfaits transparents • Activation rapide • Support local
            </p>

            {/* Price block */}
            <div className="mb-8 inline-flex items-baseline gap-2">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">À partir de</span>
              {isLoading || internetPrice === null ? (
                <Skeleton className="h-12 w-24 rounded-lg" />
              ) : (
                <span className="text-5xl sm:text-6xl font-black text-foreground leading-none">
                  {internetPrice}$
                </span>
              )}
              <span className="text-base text-muted-foreground font-medium">/mois</span>
            </div>

            {/* Bullet points */}
            <ul className="flex flex-col sm:flex-row gap-3 sm:gap-6 mb-8 justify-center lg:justify-start">
              {[
                "Sans engagement",
                "Installation rapide",
                "Support basé au Québec",
              ].map((text) => (
                <li key={text} className="flex items-center gap-2 text-sm text-foreground font-medium">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  {text}
                </li>
              ))}
            </ul>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full h-13 px-8 text-base font-bold w-full sm:w-auto shadow-lg"
                asChild
              >
                <Link to="/internet">
                  Voir les forfaits
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
              <Button
                variant="outline"
                className="rounded-full h-13 px-8 text-base font-bold w-full sm:w-auto border-2"
                asChild
              >
                <Link to="/internet#coverage">
                  <MapPin className="w-4 h-4 mr-2" />
                  Vérifier mon adresse
                </Link>
              </Button>
            </div>
          </div>

          {/* Right — visual element */}
          <div className="hidden lg:flex items-center justify-center">
            <div className="relative w-full max-w-[420px] aspect-square">
              {/* Background glow */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-primary/4 to-transparent rounded-[2rem]" />
              
              {/* Main card */}
              <div className="absolute inset-6 bg-card rounded-2xl border border-border shadow-xl flex flex-col items-center justify-center p-8 gap-6">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Wifi className="w-10 h-10 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Internet illimité</p>
                  <p className="text-4xl font-black text-foreground">
                    {isLoading || internetPrice === null ? (
                      <Skeleton className="h-10 w-28 mx-auto rounded-lg" />
                    ) : (
                      <>{internetPrice}$<span className="text-lg font-medium text-muted-foreground">/mois</span></>
                    )}
                  </p>
                </div>
                <div className="w-full space-y-3">
                  {[
                    { icon: Shield, text: "Sans contrat" },
                    { icon: Zap, text: "Activation rapide" },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-3 bg-secondary/60 rounded-xl px-4 py-3">
                      <Icon className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-sm font-medium text-foreground">{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating accent dots */}
              <div className="absolute top-2 right-8 w-3 h-3 rounded-full bg-primary/20" />
              <div className="absolute bottom-10 left-2 w-4 h-4 rounded-full bg-emerald-500/15" />
              <div className="absolute top-1/3 right-2 w-2 h-2 rounded-full bg-primary/30" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
