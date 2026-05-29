import { forwardRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Lock, FileText, MapPin, Zap, DollarSign } from "lucide-react";

const TrustBadges = forwardRef<HTMLElement>((_props, ref) => {
  const { language } = useLanguage();
  const isFr = language === "fr";

  const badges = [
    {
      icon: Lock,
      title: isFr ? "Paiement sécurisé" : "Secure payment",
      sub: "SSL 256-bit",
    },
    {
      icon: FileText,
      title: isFr ? "Sans contrat" : "No contract",
      sub: isFr ? "Résiliez à tout moment" : "Cancel anytime",
    },
    {
      icon: MapPin,
      title: isFr ? "Entreprise québécoise" : "Quebec-based",
      sub: isFr ? "Support local" : "Local support",
    },
    {
      icon: Zap,
      title: isFr ? "Activation rapide" : "Fast activation",
      sub: "10 min",
    },
    {
      icon: DollarSign,
      title: isFr ? "Prix fixe garanti" : "Fixed price",
      sub: isFr ? "Aucune surprise" : "No surprises",
    },
  ];

  return (
    <section ref={ref} style={{ background: '#07060D', borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex flex-wrap justify-center gap-0 max-w-[1100px] mx-auto py-0">
        {badges.map((b, i) => {
          const Icon = b.icon;
          return (
            <div
              key={i}
              className="flex items-center gap-3 px-6 py-5"
              style={{
                borderRight: i < badges.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(124,58,237,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon className="w-4 h-4" style={{ color: '#A78BFA' }} strokeWidth={2} />
              </div>
              <div>
                <div className="font-bold text-white" style={{ fontSize: 12.5 }}>{b.title}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11.5 }}>{b.sub}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
});

TrustBadges.displayName = "TrustBadges";

export default TrustBadges;
