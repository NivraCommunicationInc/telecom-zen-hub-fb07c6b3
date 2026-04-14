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
      <Check className="w-5 h-5 text-green-600 mx-auto" aria-label={isFr ? "Oui" : "Yes"} />
    ) : (
      <X className="w-5 h-5 text-destructive mx-auto" aria-label={isFr ? "Non" : "No"} />
    );
  };

  // For "fees" rows (index 4,5), inversion: true=bad, so Nivra false=good
  const isNegativeRow = (idx: number) => idx === 4 || idx === 5;

  return (
    <section
      aria-label={isFr ? "Comparaison avec la concurrence" : "Competitor comparison"}
      className="py-16 px-6 bg-card"
    >
      <div className="max-w-[900px] mx-auto">
        <div className="text-center mb-10">
          <p className="text-xs tracking-[2px] uppercase text-muted-foreground mb-2">
            {isFr ? "Pourquoi Nivra ?" : "Why Nivra?"}
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-foreground">
            {isFr ? "La différence est claire" : "The difference is clear"}
          </h2>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[500px]" aria-label={isFr ? "Comparaison Nivra vs concurrents" : "Nivra vs competitors"}>
            <thead>
              <tr>
                <th className="p-3 text-left text-xs text-muted-foreground bg-muted font-medium">
                  {isFr ? "Caractéristique" : "Feature"}
                </th>
                <th className="p-3 text-center bg-primary text-primary-foreground font-bold text-sm">
                  Nivra Telecom
                </th>
                <th className="p-3 text-center text-xs text-muted-foreground bg-muted font-medium">Bell</th>
                <th className="p-3 text-center text-xs text-muted-foreground bg-muted font-medium">Vidéotron</th>
              </tr>
            </thead>
            <tbody>
              {features.map((f, i) => {
                const neg = isNegativeRow(i);
                return (
                  <tr key={i} className={i % 2 === 0 ? "bg-card" : "bg-muted/40"}>
                    <td className="p-3.5 text-sm text-foreground border-b border-border">{f.label}</td>
                    <td className="p-3.5 text-center border-b border-border bg-primary/[0.03]">
                      <Checkmark val={f.nivra} inverted={neg} />
                    </td>
                    <td className="p-3.5 text-center border-b border-border">
                      <Checkmark val={f.bell} inverted={neg} />
                    </td>
                    <td className="p-3.5 text-center border-b border-border">
                      <Checkmark val={f.videotron} inverted={neg} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="text-center mt-8">
          <Button size="lg" asChild>
            <Link to="/forfaits">
              {isFr ? "Voir nos forfaits →" : "View our plans →"}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
