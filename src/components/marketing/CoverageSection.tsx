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
    <section aria-label={isFr ? "Zones de couverture" : "Coverage areas"} className="py-10 sm:py-16 px-4 sm:px-6 bg-[#0a0a0a]">
      <div className="max-w-[1100px] mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-5 sm:mb-6">
          <MapPin className="w-4 h-4 text-cyan-400" />
          <span className="text-xs text-cyan-400 font-medium uppercase tracking-wider">
            {isFr ? "Couverture" : "Coverage"}
          </span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
          {isFr ? "Service disponible dans tout le Québec" : "Service available across Quebec"}
        </h2>

        <p className="text-white/50 mb-8 sm:mb-10 max-w-xl mx-auto text-[14px] sm:text-base">
          {isFr
            ? "Internet et TV sans contrat disponibles dans les principales villes et régions du Québec"
            : "No-contract Internet and TV available in major Quebec cities and regions"}
        </p>

        <div className="flex flex-wrap justify-center gap-2 mb-8 sm:mb-10">
          {regions.map((r) => (
            <span
              key={r}
              className="px-3 py-1.5 text-[13px] bg-white/5 border border-white/10 rounded-full text-white/70 hover:border-cyan-500/30 hover:text-cyan-400 transition-colors"
              style={{ padding: '5px 12px' }}
            >
              {r}
            </span>
          ))}
        </div>

        <p className="text-white/40 text-[14px]">
          {isFr ? "Votre ville n'est pas listée ?" : "Your city isn't listed?"}{' '}
          <Link to="/contact" className="text-cyan-400 hover:underline">
            {isFr ? "Contactez-nous pour vérifier la disponibilité" : "Contact us to check availability"}
          </Link>
        </p>
      </div>
    </section>
  );
}
