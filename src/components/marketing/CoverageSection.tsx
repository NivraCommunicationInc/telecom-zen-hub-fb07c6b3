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
    <section aria-label={isFr ? "Zones de couverture" : "Coverage areas"} className="px-5 sm:px-10" style={{ background: '#F7F7F7', paddingTop: 48, paddingBottom: 48 }}>
      <div className="max-w-[1100px] mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-5" style={{ background: '#F3EEFF', borderRadius: 50 }}>
          <MapPin className="w-4 h-4" style={{ color: '#7C3AED' }} />
          <span className="font-semibold uppercase" style={{ color: '#7C3AED', fontSize: 11, letterSpacing: 2 }}>
            {isFr ? "Couverture" : "Coverage"}
          </span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-extrabold mb-3" style={{ color: '#0D0D0D', letterSpacing: '-0.5px' }}>
          {isFr ? "Service disponible dans tout le Québec" : "Service available across Quebec"}
        </h2>

        <p className="mb-8 max-w-xl mx-auto" style={{ color: '#444444', fontSize: 16, lineHeight: 1.7 }}>
          {isFr ? "Internet et TV sans contrat disponibles dans les principales villes et régions du Québec" : "No-contract Internet and TV available in major Quebec cities and regions"}
        </p>

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {regions.map((r) => (
            <span key={r} className="px-3 py-1.5" style={{ background: '#FFFFFF', border: '1px solid #EEEEEE', borderRadius: 50, color: '#444444', fontSize: 13 }}>
              {r}
            </span>
          ))}
        </div>

        <p style={{ color: '#444444', fontSize: 14 }}>
          {isFr ? "Votre ville n'est pas listée ?" : "Your city isn't listed?"}{' '}
          <Link to="/contact" className="hover:underline" style={{ color: '#7C3AED' }}>
            {isFr ? "Contactez-nous" : "Contact us"}
          </Link>
        </p>
      </div>
    </section>
  );
}
