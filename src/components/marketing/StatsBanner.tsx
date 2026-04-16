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
    <section aria-label={isFr ? "Statistiques Nivra" : "Nivra Statistics"} style={{ background: '#F7F7F7' }}>
      <div className="grid grid-cols-2 md:grid-cols-4 max-w-[1100px] mx-auto">
        {stats.map((s, i) => (
          <div
            key={i}
            className={`py-5 px-4 md:py-8 md:px-6 text-center ${
              i < stats.length - 1 ? "border-r" : ""
            } ${i >= 2 ? "border-t md:border-t-0" : ""}`}
            style={{ borderColor: '#EEEEEE' }}
          >
            <div className="text-xl md:text-[36px] font-extrabold mb-1" style={{ color: '#7C3AED' }}>{s.number}</div>
            <div className="text-[11px] md:text-sm" style={{ color: '#999999' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
