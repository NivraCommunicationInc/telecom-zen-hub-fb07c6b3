import { Button } from "@/components/ui/button";
import { ArrowRight, Check, MapPin } from "lucide-react";
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
      <div className="container mx-auto px-4 max-w-[1100px] py-12 sm:py-16 lg:py-20">
        <div className="max-w-2xl mx-auto text-center lg:text-left lg:mx-0">
          {/* Main headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-[1.1] text-foreground mb-4 tracking-tight">
            Internet résidentiel simple et fiable —{" "}
            <span className="text-primary">sans contrat</span>
          </h1>

          {/* Subtitle */}
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
      </div>
    </section>
  );
};

export default Hero;
