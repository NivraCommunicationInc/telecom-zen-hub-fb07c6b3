import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const FinalCTA = () => (
  <section className="py-24 lg:py-36 bg-primary">
    <div className="container mx-auto px-4 sm:px-6 max-w-[1200px] text-center relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-white/5 to-transparent" />
        <div className="absolute bottom-0 left-0 w-1/4 h-full bg-gradient-to-r from-white/3 to-transparent" />
      </div>
      <div className="relative max-w-[740px] mx-auto">
        <h2 className="text-4xl md:text-[3rem] font-bold text-primary-foreground mb-8 tracking-[-0.03em] leading-tight">
          Prêt à commencer ?
        </h2>
        <ul className="flex flex-col sm:flex-row items-center justify-center gap-5 sm:gap-8 mb-12">
          {["Sans contrat", "Mise en service rapide", "Processus simple"].map((t) => (
            <li key={t} className="flex items-center gap-2.5 text-sm text-primary-foreground/80 font-medium">
              <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
                <Check className="w-3 h-3 text-emerald-400" />
              </div>
              {t}
            </li>
          ))}
        </ul>
        <Button
          className="bg-white text-primary hover:bg-white/90 rounded-2xl px-14 h-16 text-lg font-bold shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-0.5"
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
