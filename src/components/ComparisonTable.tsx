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
      <Check className="w-5 h-5 text-emerald-500 mx-auto" aria-label={isFr ? "Oui" : "Yes"} />
    ) : (
      <X className="w-5 h-5 text-slate-300 mx-auto" aria-label={isFr ? "Non" : "No"} />
    );

  return (
    <section className="py-10 sm:py-20 lg:py-28 bg-white">
      <div className="container mx-auto px-4 sm:px-6 max-w-[900px]">
        <div className="text-center mb-8 sm:mb-10">
          <p className="text-xs tracking-[2px] uppercase text-[#8a94a6] mb-2">
            {isFr ? "Comparaison factuelle" : "Factual comparison"}
          </p>
          <h2 className="text-2xl sm:text-3xl md:text-[2.5rem] font-bold text-[#1a1a2e] tracking-[-0.025em]">
            {isFr ? "Comparez avant de choisir" : "Compare before you choose"}
          </h2>
        </div>

        {/* Scrollable wrapper for mobile */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-[#e8edf3] overflow-hidden max-w-[850px] mx-auto shadow-sm">
          <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
            <table className="w-full min-w-[420px]" aria-label={isFr ? "Comparaison Nivra vs concurrents" : "Nivra vs competitors"}>
              <thead>
                <tr className="bg-[#f4f7fb]">
                  <th className="p-2.5 sm:p-4 text-left text-xs text-[#8a94a6] font-medium" />
                  <th className="p-2.5 sm:p-4 text-center font-bold text-purple-600 text-[13px] sm:text-sm border-l border-[#e8edf3] bg-purple-50">
                    Nivra
                  </th>
                  <th className="p-2.5 sm:p-4 text-center font-bold text-[#8a94a6] text-[13px] sm:text-sm border-l border-[#e8edf3]">Bell</th>
                  <th className="p-2.5 sm:p-4 text-center font-bold text-[#8a94a6] text-[13px] sm:text-sm border-l border-[#e8edf3]">Vidéotron</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const isNegativeAttribute = i <= 2;
                  return (
                    <tr key={i} className={i < rows.length - 1 ? "border-b border-[#e8edf3]" : ""}>
                      <td className="p-2.5 sm:p-4 text-[13px] sm:text-sm font-medium text-[#1a1a2e]">{row.label}</td>
                      <td className="p-2.5 sm:p-4 text-center border-l border-[#e8edf3] bg-purple-50/50">
                        <CellIcon positive={isNegativeAttribute ? !row.nivra : row.nivra} />
                      </td>
                      <td className="p-2.5 sm:p-4 text-center border-l border-[#e8edf3]">
                        <CellIcon positive={isNegativeAttribute ? !row.bell : row.bell} />
                      </td>
                      <td className="p-2.5 sm:p-4 text-center border-l border-[#e8edf3]">
                        <CellIcon positive={isNegativeAttribute ? !row.videotron : row.videotron} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile scroll hint */}
        <p className="text-center text-[12px] text-[#8a94a6] mt-3 sm:hidden">
          ← {isFr ? "Glisser pour voir" : "Swipe to see"} →
        </p>

        <p className="text-center text-[11px] text-[#8a94a6] mt-5 sm:mt-6 max-w-[700px] mx-auto leading-relaxed px-2">
          * {isFr
            ? "Comparaison basée sur les informations publiques disponibles sur bell.ca et videotron.com en avril 2025. Les offres des concurrents peuvent changer sans préavis. Nivra Telecom n'est pas affilié à Bell Canada ou Vidéotron. Pour les tarifs actuels de nos concurrents, consultez leurs sites officiels."
            : "Comparison based on publicly available information on bell.ca and videotron.com as of April 2025. Competitor offers may change without notice. Nivra Telecom is not affiliated with Bell Canada or Vidéotron. For current competitor pricing, please visit their official websites."}
        </p>
      </div>
    </section>
  );
};

export default ComparisonTable;
