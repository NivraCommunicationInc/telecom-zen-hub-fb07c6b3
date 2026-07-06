/**
 * MarketingAutomationsPage — Placeholder pour séquences automatisées.
 * Wave 3: éditeur react-flow à venir. Pour l'instant: liste + statut.
 */
import { MKPage, MKCard, MKCardHeader } from "./_marketing-ui";
import MarketingNav from "./MarketingNav";
import { Zap, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function MarketingAutomationsPage() {
  return (
    <MKPage
      title="Automations"
      subtitle="Séquences déclenchées par événements (bienvenue, relance, anniversaire…)"
      actions={
        <Button size="sm" disabled className="bg-[#7C3AED] hover:bg-[#6D28D9]">
          <Zap className="h-4 w-4 mr-1.5" /> Nouvelle automation
        </Button>
      }
    >
      <MarketingNav />

      <MKCard>
        <MKCardHeader title="Bientôt disponible" action={<Badge className="bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/30">Wave 3</Badge>} />
        <div className="p-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#7C3AED]/10 mb-4">
            <Clock className="h-6 w-6 text-[#7C3AED]" />
          </div>
          <h3 className="text-white font-semibold mb-2">Éditeur d'automations en préparation</h3>
          <p className="text-[#888] text-sm max-w-md mx-auto">
            L'éditeur visuel (React Flow) avec déclencheurs, conditions, attentes et actions
            multi-canaux (email, SMS, push) arrive dans la prochaine vague.
          </p>
        </div>
      </MKCard>

      <MKCard>
        <MKCardHeader title="Templates prévus" />
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { name: "Bienvenue nouveau client", desc: "3 emails sur 7 jours après activation" },
            { name: "Relance panier abandonné", desc: "Rappel à H+1, H+24, H+72" },
            { name: "Anniversaire client", desc: "Email + code promo annuel" },
            { name: "Réactivation inactifs", desc: "Séquence 90 jours sans activité" },
            { name: "Onboarding lead CRM", desc: "Nurturing lead → client" },
            { name: "Renouvellement abonnement", desc: "Rappel J-15 / J-7 / J-1" },
          ].map(t => (
            <div key={t.name} className="rounded-[10px] bg-[#0D0D1A] border border-[#1E1E2E] p-4 opacity-70">
              <div className="text-white font-medium text-sm mb-1">{t.name}</div>
              <div className="text-[#888] text-xs">{t.desc}</div>
            </div>
          ))}
        </div>
      </MKCard>
    </MKPage>
  );
}
