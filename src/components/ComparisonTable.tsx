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
      <Check className="w-5 h-5 mx-auto" style={{ color: '#059669' }} aria-label={isFr ? "Oui" : "Yes"} />
    ) : (
      <X className="w-5 h-5 mx-auto" style={{ color: '#d1d5db' }} aria-label={isFr ? "Non" : "No"} />
    );

  return (
    <section className="py-12 sm:py-20 lg:py-28" style={{ background: '#f8f8f8' }}>
      <div className="container mx-auto px-4 sm:px-6 max-w-[900px]">
        <div className="text-center mb-8 sm:mb-10">
          <p className="text-[11px] tracking-[2px] uppercase mb-2" style={{ color: '#999999' }}>
            {isFr ? "Comparaison factuelle" : "Factual comparison"}
          </p>
          <h2 className="text-2xl sm:text-3xl md:text-[40px] font-bold tracking-[-0.5px]" style={{ color: '#111111' }}>
            {isFr ? "Comparez avant de choisir" : "Compare before you choose"}
          </h2>
        </div>

        <div className="overflow-hidden max-w-[850px] mx-auto" style={{ background: '#ffffff', borderRadius: 20, border: '1.5px solid #eeeeee', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full min-w-[420px]" aria-label={isFr ? "Comparaison Nivra vs concurrents" : "Nivra vs competitors"}>
              <thead>
                <tr style={{ background: '#f8f8f8' }}>
                  <th className="p-3 sm:p-4 text-left text-xs font-medium" style={{ color: '#999999' }} />
                  <th className="p-3 sm:p-4 text-center font-bold text-[13px] sm:text-sm" style={{ color: '#7c3aed', borderLeft: '1px solid #eeeeee', background: '#f3eeff' }}>
                    Nivra
                  </th>
                  <th className="p-3 sm:p-4 text-center font-bold text-[13px] sm:text-sm" style={{ color: '#999999', borderLeft: '1px solid #eeeeee' }}>Bell</th>
                  <th className="p-3 sm:p-4 text-center font-bold text-[13px] sm:text-sm" style={{ color: '#999999', borderLeft: '1px solid #eeeeee' }}>Vidéotron</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const isNegativeAttribute = i <= 2;
                  return (
                    <tr key={i} style={i < rows.length - 1 ? { borderBottom: '1px solid #eeeeee' } : {}}>
                      <td className="p-3 sm:p-4 text-[13px] sm:text-sm font-medium" style={{ color: '#111111' }}>{row.label}</td>
                      <td className="p-3 sm:p-4 text-center" style={{ borderLeft: '1px solid #eeeeee', background: '#faf8ff' }}>
                        <CellIcon positive={isNegativeAttribute ? !row.nivra : row.nivra} />
                      </td>
                      <td className="p-3 sm:p-4 text-center" style={{ borderLeft: '1px solid #eeeeee' }}>
                        <CellIcon positive={isNegativeAttribute ? !row.bell : row.bell} />
                      </td>
                      <td className="p-3 sm:p-4 text-center" style={{ borderLeft: '1px solid #eeeeee' }}>
                        <CellIcon positive={isNegativeAttribute ? !row.videotron : row.videotron} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-center text-[12px] mt-3 sm:hidden" style={{ color: '#999999' }}>
          ← {isFr ? "Glisser pour voir" : "Swipe to see"} →
        </p>

        <p className="text-center text-[11px] mt-6 max-w-[700px] mx-auto leading-relaxed px-2" style={{ color: '#999999' }}>
          * {isFr
            ? "Comparaison basée sur les informations publiques disponibles sur bell.ca et videotron.com en avril 2025. Les offres des concurrents peuvent changer sans préavis. Nivra Telecom n'est pas affilié à Bell Canada ou Vidéotron."
            : "Comparison based on publicly available information on bell.ca and videotron.com as of April 2025. Competitor offers may change without notice. Nivra Telecom is not affiliated with Bell Canada or Vidéotron."}
        </p>
      </div>
    </section>
  );
};

export default ComparisonTable;
