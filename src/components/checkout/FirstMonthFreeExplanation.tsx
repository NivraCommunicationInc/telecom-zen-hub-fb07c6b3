import { PartyPopper, PackageCheck, CalendarCheck, XCircle, RotateCcw, Sparkles } from "lucide-react";

const FIRST_MONTH_FREE_CODES = ['BIENVENUE2026', 'NIVRA2026'];

interface FirstMonthFreeExplanationProps {
  promoCode?: string | null;
  autoApplied?: boolean;
}

/**
 * Explanation box shown when a first-month-free promo code is applied (BIENVENUE2026 or NIVRA2026).
 * Shows a different header message when the promo was auto-applied vs manually entered.
 */
export const FirstMonthFreeExplanation = ({ promoCode, autoApplied = false }: FirstMonthFreeExplanationProps) => {
  if (!promoCode || !FIRST_MONTH_FREE_CODES.includes(promoCode.toUpperCase())) {
    return null;
  }

  return (
    <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        {autoApplied ? (
          <Sparkles className="w-5 h-5 text-emerald-600" />
        ) : (
          <PartyPopper className="w-5 h-5 text-emerald-600" />
        )}
        <p className="font-semibold text-emerald-700 text-sm">
          {autoApplied
            ? "🎉 Bonne nouvelle! Nous avons détecté que vous êtes un nouveau client. Votre premier mois de service est automatiquement gratuit — aucun code requis!"
            : "Premier mois gratuit appliqué!"}
        </p>
      </div>

      <div className="space-y-2 text-sm text-slate-700">
        <div className="flex items-start gap-2">
          <PackageCheck className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
          <p>
            <strong>Ce que vous payez aujourd'hui :</strong> Les frais d'équipement uniquement (borne WiFi et/ou terminal) + taxes applicables.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <CalendarCheck className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
          <p>
            <strong>Premier mois de service :</strong> 100% gratuit — crédité automatiquement.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <CalendarCheck className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
          <p>
            <strong>À partir du 2e mois :</strong> Votre forfait mensuel normal reprend.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <XCircle className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
          <p>
            <strong>Annulation :</strong> Possible à tout moment, effective à la fin de votre cycle de facturation.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <RotateCcw className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
          <p>
            <strong>Remboursement équipement :</strong> 100% remboursé si retourné dans les 30 jours en bon état.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FirstMonthFreeExplanation;
