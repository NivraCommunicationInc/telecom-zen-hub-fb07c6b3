import { Link } from "react-router-dom";
import { MapPin } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const regions = [
  'Montréal', 'Laval', 'Longueuil', 'Brossard', 'Rive-Sud',
  'Québec', 'Sherbrooke', 'Gatineau', 'Saint-Jérôme', 'Repentigny',
  'Terrebonne', 'Mascouche', 'Blainville', 'Boisbriand', 'Saint-Eustache',
  'Mirabel', 'Vaudreuil-Dorion', 'Châteauguay', 'Saint-Jean-sur-Richelieu',
];

export default function CoverageSection() {
  const { language } = useLanguage();
  const isFr = language === 'fr';

  return (
    <section aria-label={isFr ? "Zones de couverture" : "Coverage areas"} className="py-10 sm:py-16 px-4 sm:px-6 bg-white">
      <div className="max-w-[1100px] mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-50 border border-cyan-200 mb-5 sm:mb-6">
          <MapPin className="w-4 h-4 text-cyan-600" />
          <span className="text-xs text-cyan-600 font-medium uppercase tracking-wider">
            {isFr ? "Couverture" : "Coverage"}
          </span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold text-[#1a1a2e] mb-3">
          {isFr ? "Service disponible dans tout le Québec" : "Service available across Quebec"}
        </h2>

        <p className="text-[#555e6d] mb-8 sm:mb-10 max-w-xl mx-auto text-[14px] sm:text-base">
          {isFr
            ? "Internet et TV sans contrat disponibles dans les principales villes et régions du Québec"
            : "No-contract Internet and TV available in major Quebec cities and regions"}
        </p>

        <div className="flex flex-wrap justify-center gap-2 mb-8 sm:mb-10">
          {regions.map((r) => (
            <span
              key={r}
              className="px-3 py-1.5 text-[13px] bg-[#f4f7fb] border border-[#e8edf3] rounded-full text-[#555e6d] hover:border-cyan-300 hover:text-cyan-600 transition-colors"
              style={{ padding: '5px 12px' }}
            >
              {r}
            </span>
          ))}
        </div>

        <p className="text-[#8a94a6] text-[14px]">
          {isFr ? "Votre ville n'est pas listée ?" : "Your city isn't listed?"}{' '}
          <Link to="/contact" className="text-cyan-600 hover:underline">
            {isFr ? "Contactez-nous pour vérifier la disponibilité" : "Contact us to check availability"}
          </Link>
        </p>
      </div>
    </section>
  );
}
