import { Button } from "@/components/ui/button";
import { ArrowRight, Check, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { usePublicServices } from "@/hooks/usePublicServices";
import { Skeleton } from "@/components/ui/skeleton";
import heroImage from "@/assets/hero-family.jpg";

const Hero = () => {
  const { data: services, isLoading } = usePublicServices({ surface: "website", categories: ["Internet"] });

  const internetPrice = (() => {
    if (!services || services.length === 0) return null;
    return Math.min(...services.map(s => Number(s.price))).toFixed(0);
  })();

  return (
    <section className="bg-gradient-to-b from-secondary/40 to-background">
      <div className="container mx-auto px-4 sm:px-6 max-w-[1200px] py-24 sm:py-32 lg:py-40">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left — text content */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-primary text-sm font-semibold mb-8">
              <Check className="w-3.5 h-3.5" />
              Sans contrat · Sans surprise
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold leading-[1.05] text-foreground mb-6 tracking-[-0.035em]">
              Internet résidentiel simple et fiable —{" "}
              <span className="text-primary">sans contrat</span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground mb-12 leading-[1.75] max-w-lg mx-auto lg:mx-0">
              Forfaits transparents • Activation rapide • Support local
            </p>

            {/* Price block */}
            <div className="mb-12 inline-flex items-baseline gap-3 bg-card border border-border rounded-2xl px-8 py-5 shadow-sm">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">À partir de</span>
              {isLoading || internetPrice === null ? (
                <Skeleton className="h-14 w-28 rounded-lg" />
              ) : (
                <span className="text-6xl sm:text-7xl font-black text-foreground leading-none tracking-tight">
                  {internetPrice}$
                </span>
              )}
              <span className="text-lg text-muted-foreground font-medium">/mois</span>
            </div>

            {/* Bullet points */}
            <ul className="flex flex-col sm:flex-row gap-4 sm:gap-8 mb-12 justify-center lg:justify-start">
              {[
                "Sans engagement",
                "Installation rapide",
                "Support basé au Québec",
              ].map((text) => (
                <li key={text} className="flex items-center gap-2.5 text-sm text-foreground font-medium">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                  </div>
                  {text}
                </li>
              ))}
            </ul>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-5">
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl h-16 px-12 text-base font-bold w-full sm:w-auto shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
                asChild
              >
                <Link to="/#forfaits">
                  Voir les forfaits
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl h-16 px-12 text-base font-bold w-full sm:w-auto border-2 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5"
                asChild
              >
                <Link to="/commander">
                  <MapPin className="w-4 h-4 mr-2" />
                  Vérifier mon adresse
                </Link>
              </Button>
            </div>
          </div>

          {/* Right — lifestyle image */}
          <div className="hidden lg:block">
            <div className="relative rounded-[2rem] overflow-hidden shadow-2xl aspect-[4/3] ring-1 ring-border">
              <img
                src={heroImage}
                alt="Famille profitant d'Internet à la maison avec Nivra"
                className="w-full h-full object-cover"
                loading="eager"
              />
              {/* Subtle overlay gradient for depth */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
