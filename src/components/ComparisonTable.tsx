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
      <X className="w-5 h-5 mx-auto" style={{ color: '#EEEEEE' }} aria-label={isFr ? "Non" : "No"} />
    );

  return (
    <section className="px-5 sm:px-10" style={{ background: '#F7F7F7', paddingTop: 48, paddingBottom: 48 }}>
      <div className="max-w-[900px] mx-auto">
        <div className="text-center mb-8 sm:mb-10">
          <p className="uppercase mb-2" style={{ color: '#999999', fontSize: 11, letterSpacing: 2 }}>
            {isFr ? "Comparaison factuelle" : "Factual comparison"}
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold" style={{ color: '#0D0D0D', letterSpacing: '-0.5px' }}>
            {isFr ? "Comparez avant de choisir" : "Compare before you choose"}
          </h2>
        </div>

        <div className="overflow-hidden max-w-[850px] mx-auto" style={{ background: '#FFFFFF', borderRadius: 20, border: '1.5px solid #EEEEEE' }}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px]">
              <thead>
                <tr style={{ background: '#F7F7F7' }}>
                  <th className="p-3 sm:p-4 text-left text-xs font-medium" style={{ color: '#999999' }} />
                  <th className="p-3 sm:p-4 text-center font-bold text-[13px] sm:text-sm" style={{ color: '#7C3AED', borderLeft: '1px solid #EEEEEE', background: '#F3EEFF' }}>Nivra</th>
                  <th className="p-3 sm:p-4 text-center font-bold text-[13px] sm:text-sm" style={{ color: '#999999', borderLeft: '1px solid #EEEEEE' }}>Bell</th>
                  <th className="p-3 sm:p-4 text-center font-bold text-[13px] sm:text-sm" style={{ color: '#999999', borderLeft: '1px solid #EEEEEE' }}>Vidéotron</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const isNeg = i <= 2;
                  return (
                    <tr key={i} style={i < rows.length - 1 ? { borderBottom: '1px solid #EEEEEE' } : {}}>
                      <td className="p-3 sm:p-4 text-[13px] sm:text-sm font-medium" style={{ color: '#0D0D0D' }}>{row.label}</td>
                      <td className="p-3 sm:p-4 text-center" style={{ borderLeft: '1px solid #EEEEEE', background: '#FAFAFA' }}>
                        <CellIcon positive={isNeg ? !row.nivra : row.nivra} />
                      </td>
                      <td className="p-3 sm:p-4 text-center" style={{ borderLeft: '1px solid #EEEEEE' }}>
                        <CellIcon positive={isNeg ? !row.bell : row.bell} />
                      </td>
                      <td className="p-3 sm:p-4 text-center" style={{ borderLeft: '1px solid #EEEEEE' }}>
                        <CellIcon positive={isNeg ? !row.videotron : row.videotron} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-center mt-3 sm:hidden" style={{ color: '#999999', fontSize: 12 }}>
          ← {isFr ? "Glisser pour voir" : "Swipe to see"} →
        </p>
        <p className="text-center mt-6 max-w-[700px] mx-auto leading-relaxed px-2" style={{ color: '#999999', fontSize: 11 }}>
          * {isFr
            ? "Comparaison basée sur les informations publiques disponibles sur bell.ca et videotron.com en avril 2025."
            : "Comparison based on publicly available information on bell.ca and videotron.com as of April 2025."}
        </p>
      </div>
    </section>
  );
};

export default ComparisonTable;
