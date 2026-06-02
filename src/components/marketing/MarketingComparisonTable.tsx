import { useLanguage } from "@/contexts/LanguageContext";
import { Check, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function MarketingComparisonTable() {
  const { language } = useLanguage();
  const isFr = language === "fr";

  const features = [
    { label: isFr ? "Contrat minimum requis" : "Minimum contract required", nivra: false, other: true, negative: true },
    { label: isFr ? "Frais de résiliation" : "Cancellation fees", nivra: false, other: true, negative: true },
    { label: isFr ? "Frais d'installation" : "Installation fees", nivra: false, other: true, negative: true },
    { label: isFr ? "Activation en ligne disponible" : "Online activation available", nivra: true, other: false, negative: false },
    { label: isFr ? "Prix fixe garanti (sans hausse après 12 mois)" : "Guaranteed fixed price (no increase after 12 months)", nivra: true, other: false, negative: false },
  ];

  const CellIcon = ({ good }: { good: boolean }) =>
    good ? (
      <Check className="w-5 h-5 text-purple-400 mx-auto" aria-label={isFr ? "Oui" : "Yes"} />
    ) : (
      <X className="w-5 h-5 text-white/20 mx-auto" aria-label={isFr ? "Non" : "No"} />
    );

  return (
    <section
      aria-label={isFr ? "Comparaison avec la concurrence" : "Competitor comparison"}
      className="py-16 px-6 bg-white"
    >
      <div className="max-w-[800px] mx-auto">
        <div className="text-center mb-10">
          <p className="text-xs tracking-[2px] uppercase text-black/40 mb-2">
            {isFr ? "Comparaison factuelle" : "Factual comparison"}
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-black">
            {isFr ? "Comparez avant de choisir" : "Compare before you choose"}
          </h2>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full min-w-[420px]" aria-label={isFr ? "Nivra vs autres fournisseurs" : "Nivra vs other providers"}>
            <thead>
              <tr>
                <th className="p-3 text-left text-xs text-black/50 bg-gray-50 font-medium">
                  {isFr ? "Caractéristique" : "Feature"}
                </th>
                <th className="p-3 text-center bg-purple-600 text-white font-bold text-sm">
                  Nivra Telecom
                </th>
                <th className="p-3 text-center text-xs text-black/50 bg-gray-50 font-medium">
                  {isFr ? "Grands fournisseurs" : "Major providers"}
                </th>
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                  <td className="p-3.5 text-sm text-black border-b border-gray-100">{f.label}</td>
                  <td className="p-3.5 text-center border-b border-gray-100 bg-purple-50">
                    <CellIcon good={f.negative ? !f.nivra : f.nivra} />
                  </td>
                  <td className="p-3.5 text-center border-b border-gray-100">
                    <CellIcon good={f.negative ? !f.other : f.other} />
                  </td>
                </tr>
              ))}
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
        <p className="text-center text-[11px] text-black/40 mt-4 max-w-[600px] mx-auto leading-relaxed">
          * {isFr
            ? "Comparaison basée sur les offres types du marché québécois. Les offres des concurrents peuvent changer sans préavis. Nivra Telecom ne fait aucune affiliation avec des tiers."
            : "Comparison based on typical Quebec market offers. Competitor offers may change without notice. Nivra Telecom is not affiliated with any third party."}
        </p>
      </div>
    </section>
  );
}
