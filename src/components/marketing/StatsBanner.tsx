import { useLanguage } from "@/contexts/LanguageContext";

export default function StatsBanner() {
  const { language } = useLanguage();
  const isFr = language === "fr";

  const stats = [
    {
      number: isFr ? "Sans contrat" : "No contract",
      label: isFr ? "Liberté absolue" : "Absolute freedom",
    },
    {
      number: "4.9 ★",
      label: isFr ? "Note satisfaction" : "Satisfaction rating",
    },
    {
      number: isFr ? "Dès 45$" : "From $45",
      label: isFr ? "Taxes incluses" : "Taxes included",
    },
    {
      number: "10 min",
      label: isFr ? "Activation rapide" : "Quick activation",
    },
  ];

  return (
    <section
      aria-label={isFr ? "Statistiques Nivra" : "Nivra Statistics"}
      style={{ background: "#0A0A1A" }}
    >
      <div className="max-w-[1180px] mx-auto px-5 sm:px-10 pb-16 -mt-10 relative z-10">
        <div
          className="grid grid-cols-2 md:grid-cols-4 overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 28,
            backdropFilter: "blur(12px)",
          }}
        >
          {stats.map((s, i) => (
            <div
              key={i}
              className="text-center py-8 px-4 md:py-10 md:px-6 group transition-colors"
              style={{
                borderRight:
                  i < stats.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                borderTop:
                  i >= 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
              }}
            >
              <div
                className="font-bold mb-2 transition-colors group-hover:text-[#A78BFA]"
                style={{
                  color: i === 1 ? "#A78BFA" : "#FFFFFF",
                  fontSize: "clamp(22px, 3vw, 32px)",
                  letterSpacing: "-0.02em",
                }}
              >
                {s.number}
              </div>
              <div
                className="uppercase font-bold"
                style={{
                  color: "rgba(255,255,255,0.45)",
                  fontSize: 10.5,
                  letterSpacing: "0.18em",
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
