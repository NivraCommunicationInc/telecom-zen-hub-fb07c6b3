import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";

const CTA = () => {
  const { language } = useLanguage();
  const isFr = language === 'fr';

  return (
    <section className="py-16 lg:py-24">
      <div className="container mx-auto px-4 max-w-[1320px]">
        <div className="relative bg-black rounded-xl p-10 lg:p-16 text-center overflow-hidden">
          {/* Spotlight effect */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[400px]"
              style={{
                background: 'conic-gradient(from 180deg at 50% 0%, transparent 140deg, rgba(250,204,21,0.08) 170deg, rgba(250,204,21,0.15) 180deg, rgba(250,204,21,0.08) 190deg, transparent 220deg)',
              }}
            />
          </div>

          <div className="relative">
            <p className="text-amber-400 text-sm font-bold uppercase tracking-[0.15em] mb-4">
              {isFr ? "OFFRE EN COURS" : "CURRENT OFFER"}
            </p>
            <h2 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">
              {isFr ? "Prêt à commencer?" : "Ready to get started?"}
            </h2>
            <p className="text-white/50 mb-8 max-w-lg mx-auto text-lg">
              {isFr
                ? "Choisissez votre forfait et activez votre service dès aujourd'hui."
                : "Choose your plan and activate your service today."}
            </p>
            <Button
              className="bg-amber-400 hover:bg-amber-300 text-black rounded-none px-10 h-14 text-base font-bold uppercase tracking-wider transition-all duration-200 hover:scale-105"
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
