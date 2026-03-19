import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "react-router-dom";

const CTA = () => {
  const { language } = useLanguage();
  const isFr = language === 'fr';

  return (
    <section className="py-20 lg:py-28">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="relative bg-gradient-to-br from-blue-600 to-blue-500 rounded-3xl p-10 lg:p-16 text-center overflow-hidden">
          {/* Subtle glow */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-60 h-60 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          </div>

          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              {isFr ? "Prêt à commencer?" : "Ready to get started?"}
            </h2>
            <p className="text-white/70 mb-8 max-w-lg mx-auto text-lg">
              {isFr
                ? "Choisissez votre forfait et activez votre service dès aujourd'hui."
                : "Choose your plan and activate your service today."}
            </p>
            <Button
              className="bg-white text-blue-600 hover:bg-white/90 rounded-full px-8 h-14 text-base font-semibold shadow-xl"
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
