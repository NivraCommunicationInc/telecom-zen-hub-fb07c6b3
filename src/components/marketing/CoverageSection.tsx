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
    <section aria-label={isFr ? "Zones de couverture" : "Coverage areas"} className="py-12 sm:py-20 px-4 sm:px-6" style={{ background: '#F5F5F5' }}>
      <div className="max-w-[1100px] mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-5 sm:mb-6" style={{ background: '#F3EEFF', borderRadius: 50 }}>
          <MapPin className="w-4 h-4" style={{ color: '#7C3AED' }} />
          <span className="text-[11px] font-semibold uppercase tracking-[2px]" style={{ color: '#7C3AED' }}>
            {isFr ? "Couverture" : "Coverage"}
          </span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ color: '#0D0D0D' }}>
          {isFr ? "Service disponible dans tout le Québec" : "Service available across Quebec"}
        </h2>

        <p className="mb-8 sm:mb-10 max-w-xl mx-auto text-[14px] sm:text-base" style={{ color: '#6B7280' }}>
          {isFr ? "Internet et TV sans contrat disponibles dans les principales villes et régions du Québec" : "No-contract Internet and TV available in major Quebec cities and regions"}
        </p>

        <div className="flex flex-wrap justify-center gap-2 mb-8 sm:mb-10">
          {regions.map((r) => (
            <span key={r} className="px-3 py-1.5 text-[13px]" style={{ background: '#FFFFFF', border: '1px solid #E8E8E8', borderRadius: 50, color: '#6B7280' }}>
              {r}
            </span>
          ))}
        </div>

        <p className="text-[14px]" style={{ color: '#6B7280' }}>
          {isFr ? "Votre ville n'est pas listée ?" : "Your city isn't listed?"}{' '}
          <Link to="/contact" className="hover:underline" style={{ color: '#7C3AED' }}>
            {isFr ? "Contactez-nous" : "Contact us"}
          </Link>
        </p>
      </div>
    </section>
  );
}
