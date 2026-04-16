import { useLanguage } from "@/contexts/LanguageContext";

export default function StatsBanner() {
  const { language } = useLanguage();
  const isFr = language === "fr";

  const stats = [
    { number: isFr ? "Sans contrat" : "No contract", label: isFr ? "Résiliez à tout moment, 0 frais" : "Cancel anytime, $0 fees" },
    { number: "4.9★", label: isFr ? "Note de nos premiers clients" : "Rating from our first clients" },
    { number: isFr ? "Dès 39$" : "From $39", label: isFr ? "Par mois, taxes incluses" : "Per month, taxes included" },
    { number: "10 min", label: isFr ? "Activation en ligne" : "Online activation" },
  ];

  return (
    <section aria-label={isFr ? "Statistiques Nivra" : "Nivra Statistics"} className="bg-[#5b21b6] text-white">
      <div className="grid grid-cols-2 md:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={i}
            className={`py-4 px-3 md:py-7 md:px-6 text-center ${
              i < stats.length - 1 ? "border-r border-white/15" : ""
            } ${i >= 2 ? "border-t md:border-t-0 border-white/15" : ""}`}
          >
            <div className="text-xl md:text-3xl font-extrabold mb-1 text-white">{s.number}</div>
            <div className="text-[11px] md:text-sm text-white/70">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
