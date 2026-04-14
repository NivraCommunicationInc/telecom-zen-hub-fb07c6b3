import { useLanguage } from "@/contexts/LanguageContext";
import { Check, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function MarketingComparisonTable() {
  const { language } = useLanguage();
  const isFr = language === "fr";

  const features = [
    { label: isFr ? "Sans contrat" : "No contract", nivra: true, bell: false, videotron: false },
    { label: isFr ? "Prix fixe garanti" : "Guaranteed fixed price", nivra: true, bell: false, videotron: false },
    { label: isFr ? "Activation en ligne" : "Online activation", nivra: true, bell: false, videotron: true },
    { label: isFr ? "Support en français 7j/7" : "French support 7/7", nivra: true, bell: true, videotron: true },
    { label: isFr ? "Frais de résiliation" : "Cancellation fees", nivra: false, bell: true, videotron: true },
    { label: isFr ? "Frais d'installation" : "Installation fees", nivra: false, bell: true, videotron: true },
    { label: isFr ? "Facturation transparente" : "Transparent billing", nivra: true, bell: false, videotron: false },
    { label: isFr ? "Changer de forfait à tout moment" : "Switch plans anytime", nivra: true, bell: false, videotron: false },
  ];

  const Checkmark = ({ val, inverted = false }: { val: boolean; inverted?: boolean }) => {
    const show = inverted ? !val : val;
    return show ? (
      <Check className="w-5 h-5 text-purple-400 mx-auto" aria-label={isFr ? "Oui" : "Yes"} />
    ) : (
      <X className="w-5 h-5 text-white/20 mx-auto" aria-label={isFr ? "Non" : "No"} />
    );
  };

  const isNegativeRow = (idx: number) => idx === 4 || idx === 5;

  return (
    <section
      aria-label={isFr ? "Comparaison avec la concurrence" : "Competitor comparison"}
      className="py-16 px-6 bg-white"
    >
      <div className="max-w-[900px] mx-auto">
        <div className="text-center mb-10">
          <p className="text-xs tracking-[2px] uppercase text-black/40 mb-2">
            {isFr ? "Pourquoi Nivra ?" : "Why Nivra?"}
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-black">
            {isFr ? "La différence est claire" : "The difference is clear"}
          </h2>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full min-w-[500px]" aria-label={isFr ? "Comparaison Nivra vs concurrents" : "Nivra vs competitors"}>
            <thead>
              <tr>
                <th className="p-3 text-left text-xs text-black/50 bg-gray-50 font-medium">
                  {isFr ? "Caractéristique" : "Feature"}
                </th>
                <th className="p-3 text-center bg-purple-600 text-white font-bold text-sm">
                  Nivra Telecom
                </th>
                <th className="p-3 text-center text-xs text-black/50 bg-gray-50 font-medium">Bell</th>
                <th className="p-3 text-center text-xs text-black/50 bg-gray-50 font-medium">Vidéotron</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => {
                const neg = isNegativeRow(i);
                return (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                    <td className="p-3.5 text-sm text-black border-b border-gray-100">{f.label}</td>
                    <td className="p-3.5 text-center border-b border-gray-100 bg-purple-50">
                      <Checkmark val={f.nivra} inverted={neg} />
                    </td>
                    <td className="p-3.5 text-center border-b border-gray-100">
                      <Checkmark val={f.bell} inverted={neg} />
                    </td>
                    <td className="p-3.5 text-center border-b border-gray-100">
                      <Checkmark val={f.videotron} inverted={neg} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="text-center mt-8">
          <Button size="lg" className="bg-black text-white hover:bg-black/90 rounded-full" asChild>
            <Link to="/forfaits">
              {isFr ? "Voir nos forfaits →" : "View our plans →"}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
