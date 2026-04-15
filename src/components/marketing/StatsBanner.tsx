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
    <section aria-label={isFr ? "Statistiques Nivra" : "Nivra Statistics"} className="bg-black text-white">
      <div className="grid grid-cols-2 md:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={i}
            className={`py-7 px-6 text-center ${
              i < stats.length - 1 ? "border-r border-white/10" : ""
            }`}
          >
            <div className="text-2xl md:text-3xl font-extrabold mb-1 text-purple-400">{s.number}</div>
            <div className="text-xs md:text-sm text-white/60">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
