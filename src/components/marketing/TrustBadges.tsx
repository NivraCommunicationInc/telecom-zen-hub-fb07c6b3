import { useLanguage } from "@/contexts/LanguageContext";

export default function TrustBadges() {
  const { language } = useLanguage();
  const isFr = language === "fr";

  const badges = [
    { icon: "🔒", title: isFr ? "Paiement sécurisé" : "Secure payment", sub: "SSL 256-bit + Stripe" },
    { icon: "📋", title: isFr ? "Sans contrat" : "No contract", sub: isFr ? "Résiliez à tout moment" : "Cancel anytime" },
    { icon: "🇨🇦", title: isFr ? "Entreprise québécoise" : "Quebec-based company", sub: isFr ? "Support local en français" : "Local French support" },
    { icon: "⚡", title: isFr ? "Activation rapide" : "Fast activation", sub: isFr ? "En ligne en 10 minutes" : "Online in 10 minutes" },
    { icon: "💰", title: isFr ? "Prix fixe garanti" : "Guaranteed fixed price", sub: isFr ? "Aucune surprise sur la facture" : "No surprise billing" },
  ];

  return (
    <section aria-label={isFr ? "Garanties Nivra Telecom" : "Nivra Telecom guarantees"} className="bg-secondary border-t border-border">
      <div className="flex flex-wrap justify-center gap-4 py-8 px-6 max-w-[1200px] mx-auto">
        {badges.map((b, i) => (
          <div key={i} className="flex items-center gap-2.5 px-4 py-2">
            <span className="text-2xl" aria-hidden="true">{b.icon}</span>
            <div>
              <div className="font-bold text-xs text-foreground">{b.title}</div>
              <div className="text-xs text-muted-foreground">{b.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
