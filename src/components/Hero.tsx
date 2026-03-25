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
    <section className="bg-background">
      <div className="container mx-auto px-4 sm:px-6 max-w-[1200px] py-20 sm:py-24 lg:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left — text content */}
          <div className="text-center lg:text-left">
            <h1 className="text-3xl sm:text-4xl lg:text-[3rem] font-extrabold leading-[1.08] text-foreground mb-5 tracking-[-0.03em]">
              Internet résidentiel simple et fiable —{" "}
              <span className="text-primary">sans contrat</span>
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground mb-10 leading-[1.7] max-w-lg mx-auto lg:mx-0">
              Forfaits transparents • Activation rapide • Support local
            </p>

            {/* Price block */}
            <div className="mb-10 inline-flex items-baseline gap-2.5">
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
                <Link to="/#forfaits">
                  Voir les forfaits
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </Button>
              <Button
                variant="outline"
                className="rounded-full h-13 px-8 text-base font-bold w-full sm:w-auto border-2"
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
            <div className="relative rounded-2xl overflow-hidden shadow-2xl aspect-[4/3]">
              <img
                src={heroImage}
                alt="Famille profitant d'Internet à la maison avec Nivra"
                className="w-full h-full object-cover"
                loading="eager"
              />
              {/* Subtle overlay gradient for depth */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
