import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const FinalCTA = () => (
  <section className="py-16 lg:py-20 bg-primary">
    <div className="container mx-auto px-4 sm:px-6 max-w-[1200px] text-center relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-white/5 to-transparent" />
      </div>
      <div className="relative max-w-[700px] mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-6">
          Prêt à commencer ?
        </h2>
        <ul className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-8">
          {["Sans contrat", "Mise en service rapide", "Processus simple"].map((t) => (
            <li key={t} className="flex items-center gap-2 text-sm text-primary-foreground/80 font-medium">
              <Check className="w-4 h-4 text-emerald-400" />
              {t}
            </li>
          ))}
        </ul>
        <Button
          className="bg-white text-primary hover:bg-white/90 rounded-full px-10 h-13 text-base font-bold shadow-lg transition-all duration-200"
          asChild
        >
          <Link to="/commander">
            Commencer maintenant
            <ArrowRight className="w-5 h-5 ml-2" />
          </Link>
        </Button>
      </div>
    </div>
  </section>
);

export default FinalCTA;
