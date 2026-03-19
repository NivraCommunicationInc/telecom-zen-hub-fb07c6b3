import { X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const PromoBar = () => {
  const [dismissed, setDismissed] = useState(false);
  const { language } = useLanguage();
  const isFr = language === 'fr';

  if (dismissed) return null;

  return (
    <div className="w-full bg-black text-white py-3 px-4 relative">
      <div className="container mx-auto flex items-center justify-center gap-2 text-center">
        <span className="text-sm">
          {isFr ? "★ Livraison gratuite et " : "★ Free delivery and "}
          <Link to="/compare" className="font-bold underline underline-offset-2 hover:text-amber-300 transition-colors">
            {isFr ? "frais d'activation à 0$ en ligne." : "activation fees at $0 online."}
          </Link>
          {" ★"}
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export default PromoBar;
