import { useLanguage } from "@/contexts/LanguageContext";

export default function TrustBadges() {
  const { language } = useLanguage();
  const isFr = language === "fr";

  const badges = [
    { icon: "🔒", title: isFr ? "Paiement sécurisé" : "Secure payment", sub: "SSL 256-bit" },
    { icon: "📋", title: isFr ? "Sans contrat" : "No contract", sub: isFr ? "Résiliez à tout moment" : "Cancel anytime" },
    { icon: "🇨🇦", title: isFr ? "Entreprise québécoise" : "Quebec-based", sub: isFr ? "Support local" : "Local support" },
    { icon: "⚡", title: isFr ? "Activation rapide" : "Fast activation", sub: "10 min" },
    { icon: "💰", title: isFr ? "Prix fixe garanti" : "Fixed price", sub: isFr ? "Aucune surprise" : "No surprises" },
  ];

  return (
    <section style={{ background: '#FFFFFF', borderTop: '1px solid #E8E8E8' }}>
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:justify-center gap-2 sm:gap-4 py-6 sm:py-8 px-4 sm:px-6 max-w-[1200px] mx-auto">
        {badges.map((b, i) => (
          <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 sm:px-4 sm:py-2">
            <span className="text-xl sm:text-2xl">{b.icon}</span>
            <div>
              <div className="font-bold text-[12px] sm:text-xs" style={{ color: '#0D0D0D' }}>{b.title}</div>
              <div className="text-[11px] sm:text-xs" style={{ color: '#6B7280' }}>{b.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
