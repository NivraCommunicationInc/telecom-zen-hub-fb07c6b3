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
      <Check className="w-5 h-5 text-emerald-400 mx-auto" aria-label={isFr ? "Oui" : "Yes"} />
    ) : (
      <X className="w-5 h-5 text-white/25 mx-auto" aria-label={isFr ? "Non" : "No"} />
    );

  return (
    <section className="py-20 lg:py-28 bg-[#111111]">
      <div className="container mx-auto px-4 sm:px-6 max-w-[900px]">
        <div className="text-center mb-10">
          <p className="text-xs tracking-[2px] uppercase text-white/40 mb-2">
            {isFr ? "Comparaison factuelle" : "Factual comparison"}
          </p>
          <h2 className="text-3xl md:text-[2.5rem] font-bold text-white tracking-[-0.025em]">
            {isFr ? "Comparez avant de choisir" : "Compare before you choose"}
          </h2>
        </div>

        <div className="bg-[#1a1a1a] rounded-3xl border border-white/10 overflow-x-auto max-w-[850px] mx-auto">
          <table className="w-full min-w-[500px]" aria-label={isFr ? "Comparaison Nivra vs concurrents" : "Nivra vs competitors"}>
            <thead>
              <tr>
                <th className="p-4 text-left text-xs text-white/50 font-medium" />
                <th className="p-4 text-center font-bold text-purple-400 text-sm border-l border-white/10 bg-purple-500/5">
                  Nivra Telecom
                </th>
                <th className="p-4 text-center font-bold text-white/50 text-sm border-l border-white/10">Bell</th>
                <th className="p-4 text-center font-bold text-white/50 text-sm border-l border-white/10">Vidéotron</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                // For negative attributes (contract, fees), "true" means bad for consumer
                const isNegativeAttribute = i <= 2;
                return (
                  <tr key={i} className={i < rows.length - 1 ? "border-b border-white/10" : ""}>
                    <td className="p-4 text-sm font-medium text-white">{row.label}</td>
                    <td className="p-4 text-center border-l border-white/10 bg-purple-500/5">
                      <CellIcon positive={isNegativeAttribute ? !row.nivra : row.nivra} />
                    </td>
                    <td className="p-4 text-center border-l border-white/10">
                      <CellIcon positive={isNegativeAttribute ? !row.bell : row.bell} />
                    </td>
                    <td className="p-4 text-center border-l border-white/10">
                      <CellIcon positive={isNegativeAttribute ? !row.videotron : row.videotron} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-center text-[11px] text-white/35 mt-6 max-w-[700px] mx-auto leading-relaxed">
          * {isFr
            ? "Comparaison basée sur les informations publiques disponibles sur bell.ca et videotron.com en avril 2025. Les offres des concurrents peuvent changer sans préavis. Nivra Telecom n'est pas affilié à Bell Canada ou Vidéotron. Pour les tarifs actuels de nos concurrents, consultez leurs sites officiels."
            : "Comparison based on publicly available information on bell.ca and videotron.com as of April 2025. Competitor offers may change without notice. Nivra Telecom is not affiliated with Bell Canada or Vidéotron. For current competitor pricing, please visit their official websites."}
        </p>
      </div>
    </section>
  );
};

export default ComparisonTable;
