import { useLanguage } from "@/contexts/LanguageContext";

export default function StatsBanner() {
  const { language } = useLanguage();
  const isFr = language === "fr";

  const stats = [
    { number: "2 400+", label: isFr ? "Clients actifs au Québec" : "Active clients in Quebec" },
    { number: "4.9★", label: isFr ? "Note moyenne vérifiée" : "Verified average rating" },
    { number: "$38", label: isFr ? "Économie mensuelle moy. vs Bell" : "Avg monthly savings vs Bell" },
    { number: "10 min", label: isFr ? "Temps d'activation moyen" : "Average activation time" },
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
