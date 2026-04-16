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
    <section aria-label={isFr ? "Zones de couverture" : "Coverage areas"} className="py-12 sm:py-20 px-4 sm:px-6" style={{ background: '#ffffff' }}>
      <div className="max-w-[1100px] mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-5 sm:mb-6" style={{ background: '#f3eeff', borderRadius: 50 }}>
          <MapPin className="w-4 h-4" style={{ color: '#7c3aed' }} />
          <span className="text-[11px] font-semibold uppercase tracking-[2px]" style={{ color: '#7c3aed' }}>
            {isFr ? "Couverture" : "Coverage"}
          </span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: '#111111' }}>
          {isFr ? "Service disponible dans tout le Québec" : "Service available across Quebec"}
        </h2>

        <p className="mb-8 sm:mb-10 max-w-xl mx-auto text-[14px] sm:text-base" style={{ color: '#555555' }}>
          {isFr
            ? "Internet et TV sans contrat disponibles dans les principales villes et régions du Québec"
            : "No-contract Internet and TV available in major Quebec cities and regions"}
        </p>

        <div className="flex flex-wrap justify-center gap-2 mb-8 sm:mb-10">
          {regions.map((r) => (
            <span
              key={r}
              className="px-3 py-1.5 text-[13px] transition-colors"
              style={{ background: '#f8f8f8', border: '1px solid #eeeeee', borderRadius: 50, color: '#555555' }}
            >
              {r}
            </span>
          ))}
        </div>

        <p className="text-[14px]" style={{ color: '#999999' }}>
          {isFr ? "Votre ville n'est pas listée ?" : "Your city isn't listed?"}{' '}
          <Link to="/contact" className="hover:underline" style={{ color: '#7c3aed' }}>
            {isFr ? "Contactez-nous pour vérifier la disponibilité" : "Contact us to check availability"}
          </Link>
        </p>
      </div>
    </section>
  );
}
