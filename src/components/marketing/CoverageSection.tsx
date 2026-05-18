import { Link } from "react-router-dom";
import { useState } from "react";
import { MapPin, CheckCircle2, ArrowRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { AddressAutocomplete, type AddressValue } from "@/components/shared/AddressAutocomplete";

const regions = [
  'Montréal', 'Laval', 'Longueuil', 'Brossard', 'Rive-Sud',
  'Québec', 'Sherbrooke', 'Gatineau', 'Saint-Jérôme', 'Repentigny',
  'Terrebonne', 'Mascouche', 'Blainville', 'Boisbriand', 'Saint-Eustache',
  'Mirabel', 'Vaudreuil-Dorion', 'Châteauguay', 'Saint-Jean-sur-Richelieu',
];

export default function CoverageSection() {
  const { language } = useLanguage();
  const isFr = language === 'fr';
  const [address, setAddress] = useState('');

  const goToCoverage = (q: string) => {
    window.location.href = `/couverture${q ? `?address=${encodeURIComponent(q)}` : ''}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    goToCoverage(address.trim());
  };

  const handleSelect = (addr: AddressValue) => {
    setAddress(addr.formatted);
    goToCoverage(addr.formatted);
  };

  return (
    <section aria-label={isFr ? "Zones de couverture" : "Coverage areas"} className="px-5 sm:px-10" style={{ background: 'linear-gradient(180deg, #FAFAFB 0%, #F3EEFF 100%)', paddingTop: 64, paddingBottom: 64 }}>
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-4" style={{ background: '#FFFFFF', borderRadius: 50, boxShadow: '0 2px 8px rgba(124,58,237,0.08)' }}>
            <MapPin className="w-3.5 h-3.5" style={{ color: '#7C3AED' }} />
            <span className="font-bold uppercase" style={{ color: '#7C3AED', fontSize: 11, letterSpacing: 2 }}>
              {isFr ? "Couverture" : "Coverage"}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-[36px] font-extrabold mb-3" style={{ color: '#0D0D0D', letterSpacing: '-0.6px', lineHeight: 1.15 }}>
            {isFr ? "Vérifiez la disponibilité à votre adresse" : "Check availability at your address"}
          </h2>

          <p className="max-w-xl mx-auto" style={{ color: '#555', fontSize: 16, lineHeight: 1.6 }}>
            {isFr
              ? "Internet, TV et mobile sans contrat — partout au Québec"
              : "No-contract Internet, TV and mobile — anywhere in Quebec"}
          </p>
        </div>

        {/* Search card */}
        <form onSubmit={handleSubmit} className="max-w-[640px] mx-auto mb-10" style={{ background: '#FFFFFF', borderRadius: 24, boxShadow: '0 12px 40px -12px rgba(124,58,237,0.25)', padding: 14 }}>
          <div className="flex items-center gap-2 flex-col sm:flex-row">
            <div className="flex items-center gap-2 flex-1 w-full px-4" style={{ height: 52 }}>
              <Search className="w-4 h-4 shrink-0" style={{ color: '#7C3AED' }} />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={isFr ? "Entrez votre code postal ou adresse" : "Enter your postal code or address"}
                className="w-full bg-transparent outline-none"
                style={{ color: '#0D0D0D', fontSize: 15 }}
                aria-label={isFr ? "Adresse" : "Address"}
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 font-bold transition-all hover:gap-3"
              style={{ height: 52, borderRadius: 50, background: '#7C3AED', color: '#FFFFFF', fontSize: 14, boxShadow: '0 8px 18px -8px rgba(124,58,237,0.5)' }}
            >
              {isFr ? "Vérifier" : "Check"}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-10 max-w-[860px] mx-auto">
          {[
            { value: '19+', label: isFr ? 'Villes desservies' : 'Cities served' },
            { value: '1 Gbps', label: isFr ? 'Vitesse max' : 'Top speed' },
            { value: '10 min', label: isFr ? 'Activation' : 'Activation' },
            { value: '24/7', label: isFr ? 'Support local' : 'Local support' },
          ].map((s) => (
            <div key={s.label} className="text-center px-3 py-4" style={{ background: '#FFFFFF', borderRadius: 16, border: '1px solid #EEEEEE' }}>
              <div className="font-extrabold mb-1" style={{ color: '#7C3AED', fontSize: 22, letterSpacing: '-0.5px' }}>{s.value}</div>
              <div style={{ color: '#666', fontSize: 12, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Regions */}
        <div className="max-w-[820px] mx-auto text-center">
          <p className="uppercase mb-4" style={{ color: '#999', fontSize: 10, letterSpacing: 2, fontWeight: 700 }}>
            {isFr ? "Principales zones couvertes" : "Main covered areas"}
          </p>
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {regions.map((r) => (
              <span key={r} className="inline-flex items-center gap-1.5 px-3 py-1.5" style={{ background: '#FFFFFF', border: '1px solid #EEEEEE', borderRadius: 50, color: '#444', fontSize: 12.5, fontWeight: 500 }}>
                <CheckCircle2 className="w-3 h-3" style={{ color: '#7C3AED' }} />
                {r}
              </span>
            ))}
          </div>

          <p style={{ color: '#666', fontSize: 13.5 }}>
            {isFr ? "Votre ville n'est pas listée ?" : "Your city isn't listed?"}{' '}
            <Link to="/contact" className="font-semibold hover:underline" style={{ color: '#7C3AED' }}>
              {isFr ? "Contactez-nous" : "Contact us"}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
