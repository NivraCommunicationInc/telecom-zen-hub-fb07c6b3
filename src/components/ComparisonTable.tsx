import { Check, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const ComparisonTable = () => {
  const { language } = useLanguage();
  const isFr = language === "fr";

  const rows = [
    { label: isFr ? "Contrat minimum requis" : "Minimum contract required", nivra: false, bell: true, videotron: true },
    { label: isFr ? "Frais de résiliation" : "Cancellation fees", nivra: false, bell: true, videotron: true },
    { label: isFr ? "Frais d'installation" : "Installation fees", nivra: false, bell: true, videotron: true },
    { label: isFr ? "Activation en ligne disponible" : "Online activation available", nivra: true, bell: false, videotron: true },
    { label: isFr ? "Prix fixe garanti (sans hausse après 12 mois)" : "Guaranteed fixed price (no increase after 12 months)", nivra: true, bell: false, videotron: false },
  ];

  const CellIcon = ({ positive }: { positive: boolean }) =>
    positive ? (
      <Check className="w-5 h-5 mx-auto" style={{ color: '#7C3AED' }} aria-label={isFr ? "Oui" : "Yes"} />
    ) : (
      <X className="w-5 h-5 mx-auto" style={{ color: '#E8E8E8' }} aria-label={isFr ? "Non" : "No"} />
    );

  return (
    <section className="py-12 sm:py-20 lg:py-28" style={{ background: '#F5F5F5' }}>
      <div className="container mx-auto px-4 sm:px-6 max-w-[900px]">
        <div className="text-center mb-8 sm:mb-10">
          <p className="text-[11px] tracking-[2px] uppercase mb-2" style={{ color: '#6B7280' }}>
            {isFr ? "Comparaison factuelle" : "Factual comparison"}
          </p>
          <h2 className="text-2xl sm:text-3xl md:text-[40px] font-bold tracking-[-0.5px]" style={{ color: '#0D0D0D' }}>
            {isFr ? "Comparez avant de choisir" : "Compare before you choose"}
          </h2>
        </div>

        <div className="overflow-hidden max-w-[850px] mx-auto" style={{ background: '#FFFFFF', borderRadius: 20, border: '1.5px solid #E8E8E8' }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px]">
              <thead>
                <tr style={{ background: '#F5F5F5' }}>
                  <th className="p-3 sm:p-4 text-left text-xs font-medium" style={{ color: '#6B7280' }} />
                  <th className="p-3 sm:p-4 text-center font-bold text-[13px] sm:text-sm" style={{ color: '#7C3AED', borderLeft: '1px solid #E8E8E8', background: '#F3EEFF' }}>Nivra</th>
                  <th className="p-3 sm:p-4 text-center font-bold text-[13px] sm:text-sm" style={{ color: '#6B7280', borderLeft: '1px solid #E8E8E8' }}>Bell</th>
                  <th className="p-3 sm:p-4 text-center font-bold text-[13px] sm:text-sm" style={{ color: '#6B7280', borderLeft: '1px solid #E8E8E8' }}>Vidéotron</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const isNeg = i <= 2;
                  return (
                    <tr key={i} style={i < rows.length - 1 ? { borderBottom: '1px solid #E8E8E8' } : {}}>
                      <td className="p-3 sm:p-4 text-[13px] sm:text-sm font-medium" style={{ color: '#0D0D0D' }}>{row.label}</td>
                      <td className="p-3 sm:p-4 text-center" style={{ borderLeft: '1px solid #E8E8E8', background: '#FAFAFA' }}>
                        <CellIcon positive={isNeg ? !row.nivra : row.nivra} />
                      </td>
                      <td className="p-3 sm:p-4 text-center" style={{ borderLeft: '1px solid #E8E8E8' }}>
                        <CellIcon positive={isNeg ? !row.bell : row.bell} />
                      </td>
                      <td className="p-3 sm:p-4 text-center" style={{ borderLeft: '1px solid #E8E8E8' }}>
                        <CellIcon positive={isNeg ? !row.videotron : row.videotron} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-center text-[12px] mt-3 sm:hidden" style={{ color: '#6B7280' }}>
          ← {isFr ? "Glisser pour voir" : "Swipe to see"} →
        </p>
        <p className="text-center text-[11px] mt-6 max-w-[700px] mx-auto leading-relaxed px-2" style={{ color: '#6B7280' }}>
          * {isFr
            ? "Comparaison basée sur les informations publiques disponibles sur bell.ca et videotron.com en avril 2025."
            : "Comparison based on publicly available information on bell.ca and videotron.com as of April 2025."}
        </p>
      </div>
    </section>
  );
};

export default ComparisonTable;
