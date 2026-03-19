import { Button } from "@/components/ui/button";
import { ArrowRight, Flame } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";

const CTA = () => {
  const { language } = useLanguage();
  const isFr = language === 'fr';

  return (
    <section className="py-20 lg:py-28">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="relative bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 rounded-3xl p-10 lg:p-16 text-center overflow-hidden shadow-2xl shadow-blue-500/20">
          {/* Background elements */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-indigo-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3" />
          </div>

          <div className="relative">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6">
              <Flame className="w-4 h-4 text-amber-300" />
              <span className="text-sm font-bold text-white uppercase tracking-wider">
                {isFr ? "Offre en cours" : "Current offer"}
              </span>
            </div>
            
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4 tracking-tight">
              {isFr ? "Prêt à commencer?" : "Ready to get started?"}
            </h2>
            <p className="text-white/80 mb-8 max-w-lg mx-auto text-lg">
              {isFr
                ? "Choisissez votre forfait et activez votre service dès aujourd'hui."
                : "Choose your plan and activate your service today."}
            </p>
            <Button
              className="bg-amber-400 hover:bg-amber-300 text-slate-900 rounded-full px-10 h-14 text-base font-bold shadow-lg shadow-amber-400/30 transition-all duration-200 hover:scale-105"
              asChild
            >
              <Link to="/compare">
                {isFr ? "Choisir mon plan" : "Choose my plan"}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
