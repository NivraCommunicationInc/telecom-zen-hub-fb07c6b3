import { useLanguage } from "@/contexts/LanguageContext";

export default function StatsBanner() {
  const { language } = useLanguage();
  const isFr = language === "fr";

  const stats = [
    {
      number: isFr ? "Sans contrat" : "No contract",
      label: isFr ? "Résiliez à tout moment, 0 frais" : "Cancel anytime, $0 fees",
    },
    {
      number: "4.9★",
      label: isFr ? "Note de nos premiers clients" : "Rating from our first clients",
    },
    {
      number: isFr ? "Dès 45$" : "From $45",
      label: isFr ? "Par mois, taxes incluses" : "Per month, taxes included",
    },
    {
      number: "10 min",
      label: isFr ? "Activation en ligne" : "Online activation",
    },
  ];

  return (
    <section
      aria-label={isFr ? "Statistiques Nivra" : "Nivra Statistics"}
      style={{ background: '#07060D', borderBottom: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 max-w-[1100px] mx-auto">
        {stats.map((s, i) => (
          <div
            key={i}
            className="py-6 px-4 md:py-8 md:px-6 text-center"
            style={{
              borderRight: i < stats.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
              borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.07)' : 'none',
            }}
          >
            <div
              className="font-extrabold mb-1 text-white"
              style={{ fontSize: 'clamp(18px, 3.5vw, 28px)', letterSpacing: '-0.5px' }}
            >
              {s.number}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
