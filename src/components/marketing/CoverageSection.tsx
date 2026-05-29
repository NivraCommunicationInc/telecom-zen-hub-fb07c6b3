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
    <section aria-label={isFr ? "Zones de couverture" : "Coverage areas"} className="px-5 sm:px-10" style={{ background: '#0A0A18', paddingTop: 80, paddingBottom: 80, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="max-w-[1100px] mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-5" style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.35)', borderRadius: 50 }}>
            <MapPin className="w-3.5 h-3.5" style={{ color: '#A78BFA' }} />
            <span className="font-bold uppercase" style={{ color: '#C4B5FD', fontSize: 11, letterSpacing: 2 }}>
              {isFr ? "Couverture" : "Coverage"}
            </span>
          </div>

          <h2 className="font-extrabold text-white mb-3" style={{ fontSize: 'clamp(24px, 3.8vw, 40px)', letterSpacing: '-0.8px', lineHeight: 1.1 }}>
            {isFr ? "Vérifiez la disponibilité à votre adresse" : "Check availability at your address"}
          </h2>

          <p className="max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.58)', fontSize: 16, lineHeight: 1.6 }}>
            {isFr
              ? "Internet, TV et mobile sans contrat — partout au Québec"
              : "No-contract Internet, TV and mobile — anywhere in Quebec"}
          </p>
        </div>

        {/* Search card */}
        <form onSubmit={handleSubmit} className="max-w-[640px] mx-auto mb-10" style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 24, boxShadow: '0 20px 50px -20px rgba(124,58,237,0.3)', padding: 14, border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-stretch gap-2 flex-col sm:flex-row">
            <div className="flex-1 w-full">
              <AddressAutocomplete
                value={address}
                onValueChange={setAddress}
                onSelect={handleSelect}
                restrictToQuebec
                placeholder={isFr ? "Entrez votre adresse au Québec" : "Enter your Quebec address"}
                className="h-[52px] rounded-full border-0 bg-transparent text-white placeholder:text-white/40 text-[15px] focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 font-bold transition-all hover:gap-3 shrink-0"
              style={{ height: 52, borderRadius: 50, background: '#7C3AED', color: '#FFFFFF', fontSize: 14, boxShadow: '0 8px 18px -8px rgba(124,58,237,0.6)' }}
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
            <div key={s.label} className="text-center px-3 py-4" style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.09)' }}>
              <div className="font-extrabold mb-1" style={{ color: '#C4B5FD', fontSize: 22, letterSpacing: '-0.5px' }}>{s.value}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Regions */}
        <div className="max-w-[820px] mx-auto text-center">
          <p className="uppercase mb-4" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, letterSpacing: 2, fontWeight: 700 }}>
            {isFr ? "Principales zones couvertes" : "Main covered areas"}
          </p>
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {regions.map((r) => (
              <span key={r} className="inline-flex items-center gap-1.5 px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 50, color: 'rgba(255,255,255,0.7)', fontSize: 12.5, fontWeight: 500 }}>
                <CheckCircle2 className="w-3 h-3" style={{ color: '#A78BFA' }} />
                {r}
              </span>
            ))}
          </div>

          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13.5 }}>
            {isFr ? "Votre ville n'est pas listée ?" : "Your city isn't listed?"}{' '}
            <Link to="/contact" className="font-semibold hover:underline" style={{ color: '#C4B5FD' }}>
              {isFr ? "Contactez-nous" : "Contact us"}
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
