import { Check, X, Sparkles } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const ComparisonTable = () => {
  const { language } = useLanguage();
  const isFr = language === "fr";

  const rows = [
    { label: isFr ? "Sans contrat à long terme" : "No long-term contract", nivra: true, others: false },
    { label: isFr ? "Aucuns frais de résiliation" : "No cancellation fees", nivra: true, others: false },
    { label: isFr ? "Aucuns frais d'installation" : "No installation fees", nivra: true, others: false },
    { label: isFr ? "Activation en ligne en 10 min" : "Online activation in 10 min", nivra: true, others: false },
    { label: isFr ? "Prix fixe garanti — pas de hausse" : "Guaranteed fixed price — no increase", nivra: true, others: false },
    { label: isFr ? "Support local au Québec" : "Local Quebec-based support", nivra: true, others: false },
  ];

  return (
    <section className="px-5 sm:px-10 py-20 sm:py-24" style={{ background: '#FFFFFF' }}>
      <div className="max-w-[980px] mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 mb-5" style={{ background: '#F3EEFF', borderRadius: 999 }}>
            <Sparkles className="w-3 h-3" style={{ color: '#7C3AED' }} />
            <span className="uppercase font-bold" style={{ color: '#7C3AED', fontSize: 10.5, letterSpacing: 1.6 }}>
              {isFr ? 'Pourquoi Nivra' : 'Why Nivra'}
            </span>
          </div>
          <h2 className="font-bold mb-4 text-[#0A0A0F]" style={{ fontSize: 'clamp(26px, 3.8vw, 40px)', letterSpacing: '-1px', lineHeight: 1.1 }}>
            {isFr ? "La différence est claire" : "The difference is clear"}
          </h2>
          <p className="max-w-[520px] mx-auto" style={{ color: '#6B6B75', fontSize: 16, lineHeight: 1.55 }}>
            {isFr
              ? "Comparez Nivra aux fournisseurs traditionnels du Québec."
              : "Compare Nivra to traditional Quebec providers."}
          </p>
        </div>

        {/* Comparison card */}
        <div className="overflow-hidden" style={{ borderRadius: 24, background: '#FAFAFB', border: '1px solid #EEEEEE' }}>
          {/* Column headers */}
          <div className="grid grid-cols-[1.4fr_1fr_1fr] sm:grid-cols-[1.6fr_1fr_1fr]">
            <div />
            <div className="relative text-center py-5 sm:py-6" style={{
              background: 'linear-gradient(180deg, #16111F 0%, #0A0A0F 100%)',
              color: '#FFFFFF',
            }}>
              <div className="font-bold" style={{ fontSize: 16, letterSpacing: '-0.3px' }}>Nivra</div>
              <div className="uppercase font-semibold mt-0.5" style={{ color: '#C4A8FF', fontSize: 9.5, letterSpacing: 1.4 }}>
                {isFr ? 'Sans contrat' : 'No-contract'}
              </div>
            </div>
            <div className="text-center py-5 sm:py-6" style={{ background: '#F0F0F4' }}>
              <div className="font-semibold" style={{ color: '#6B6B75', fontSize: 14.5 }}>
                {isFr ? 'Fournisseurs traditionnels' : 'Traditional providers'}
              </div>
              <div className="uppercase font-medium mt-0.5" style={{ color: '#999', fontSize: 9.5, letterSpacing: 1.4 }}>
                {isFr ? 'Avec contrat' : 'With contract'}
              </div>
            </div>
          </div>

          {/* Rows */}
          <div className="bg-white">
            {rows.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-[1.4fr_1fr_1fr] sm:grid-cols-[1.6fr_1fr_1fr] items-center"
                style={{ borderTop: '1px solid #F0F0F4' }}
              >
                <div className="px-4 sm:px-6 py-4 sm:py-5 font-medium" style={{ color: '#0A0A0F', fontSize: 14 }}>
                  {row.label}
                </div>
                <div className="flex items-center justify-center py-4" style={{ background: 'rgba(124,58,237,0.04)' }}>
                  <div className="flex items-center justify-center" style={{
                    width: 28, height: 28, borderRadius: 999,
                    background: '#7C3AED',
                    boxShadow: '0 4px 10px -2px rgba(124,58,237,0.4)',
                  }}>
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={3.5} />
                  </div>
                </div>
                <div className="flex items-center justify-center py-4">
                  <div className="flex items-center justify-center" style={{
                    width: 28, height: 28, borderRadius: 999,
                    background: '#F3F3F5',
                  }}>
                    <X className="w-3.5 h-3.5" strokeWidth={3} style={{ color: '#BBBBC0' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center mt-5 max-w-[680px] mx-auto" style={{ color: '#999', fontSize: 11.5, lineHeight: 1.5 }}>
          * {isFr
            ? "Comparaison à titre indicatif basée sur les pratiques courantes des grands fournisseurs traditionnels au Québec."
            : "Indicative comparison based on common practices of major traditional Quebec providers."}
        </p>
      </div>
    </section>
  );
};

export default ComparisonTable;
