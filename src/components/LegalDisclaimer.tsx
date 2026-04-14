/**
 * LegalDisclaimer — Standardized legal disclaimer for pricing/plan pages
 * Bilingual, CRTC-compliant
 */
import { Link } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";

const LegalDisclaimer = () => {
  const { language } = useLanguage();
  const isFr = language === "fr";

  return (
    <div className="text-center text-xs text-muted-foreground/60 leading-relaxed max-w-2xl mx-auto py-6">
      <p>
        {isFr
          ? "Prix en CAD, taxes en sus. Sans contrat — annulez à tout moment. "
          : "Prices in CAD, taxes extra. No contract — cancel anytime. "}
        {isFr ? "Soumis aux " : "Subject to "}
        <Link to="/conditions-de-service" className="underline hover:text-muted-foreground">
          {isFr ? "conditions d'utilisation" : "terms of service"}
        </Link>
        .{" "}
        {isFr
          ? "Service disponible dans les zones desservies au Québec. "
          : "Service available in covered areas in Quebec. "}
        {isFr ? "Conforme aux " : "Compliant with "}
        <Link to="/conformite-crtc" className="underline hover:text-muted-foreground">
          {isFr ? "règlements du CRTC" : "CRTC regulations"}
        </Link>
        .
      </p>
    </div>
  );
};

export default LegalDisclaimer;
