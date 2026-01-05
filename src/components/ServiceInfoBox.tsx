import { Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";

interface ServiceInfoBoxProps {
  title: string;
  items: string[];
  linkTo?: string;
  linkLabel?: string;
}

export const ServiceInfoBox = ({ title, items, linkTo, linkLabel }: ServiceInfoBoxProps) => {
  return (
    <Card className="bg-muted/50 border-border">
      <CardContent className="p-6">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="space-y-3">
            <h3 className="font-semibold text-foreground">{title}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {items.map((item, index) => (
                <li key={index}>• {item}</li>
              ))}
            </ul>
            {linkTo && linkLabel && (
              <Link 
                to={linkTo} 
                className="text-sm text-primary hover:underline inline-block mt-2"
              >
                {linkLabel} →
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Predefined info boxes for each service type
export const MobileInfoBox = ({ isFrench }: { isFrench: boolean }) => {
  const items = isFrench ? [
    "Portabilité de numéro disponible (codes régionaux QC)",
    "Carte SIM physique ou eSIM : frais uniques de 25$",
    "Frais d'itinérance et de surconsommation peuvent s'appliquer",
    "Vitesses 4G — performance variable selon la couverture réseau"
  ] : [
    "Number portability available (QC area codes)",
    "Physical SIM or eSIM: one-time $25 fee",
    "Roaming and overage fees may apply",
    "4G speeds — performance varies based on network coverage"
  ];

  return (
    <ServiceInfoBox
      title={isFrench ? "À savoir — Mobile" : "Good to Know — Mobile"}
      items={items}
      linkTo="/conditions-de-service"
      linkLabel={isFrench ? "Voir les conditions complètes" : "View full terms"}
    />
  );
};

export const InternetInfoBox = ({ isFrench }: { isFrench: boolean }) => {
  const items = isFrench ? [
    "Vitesses affichées : « jusqu'à » — performance variable",
    "Meilleur effort (best effort) — interruptions possibles",
    "Réseau interne (WiFi) sous responsabilité du client",
    "Politique d'utilisation équitable (fair use) applicable"
  ] : [
    "Speeds shown are 'up to' — performance varies",
    "Best effort service — interruptions possible",
    "Internal network (WiFi) is client's responsibility",
    "Fair use policy applies"
  ];

  return (
    <ServiceInfoBox
      title={isFrench ? "À savoir — Internet" : "Good to Know — Internet"}
      items={items}
      linkTo="/conditions-de-service"
      linkLabel={isFrench ? "Voir les conditions complètes" : "View full terms"}
    />
  );
};

export const TVInfoBox = ({ isFrench }: { isFrench: boolean }) => {
  const items = isFrench ? [
    "25/26 chaînes de base incluses selon le forfait",
    "Chaînes « Free Choice » sélectionnables dans le portail",
    "Chaînes premium disponibles (frais additionnels)",
    "Changements de chaînes : ticket interne, délai 2h à 24h"
  ] : [
    "25/26 basic channels included depending on plan",
    "'Free Choice' channels selectable in portal",
    "Premium channels available (additional fees)",
    "Channel changes: internal ticket, 2h to 24h ETA"
  ];

  return (
    <ServiceInfoBox
      title={isFrench ? "À savoir — TV" : "Good to Know — TV"}
      items={items}
      linkTo="/conditions-de-service"
      linkLabel={isFrench ? "Voir les conditions complètes" : "View full terms"}
    />
  );
};

export const SecurityInfoBox = ({ isFrench }: { isFrench: boolean }) => {
  const items = isFrench ? [
    "Service non prévu pour les urgences (911)",
    "Dépend de l'alimentation électrique et de la connexion Internet",
    "Tests périodiques requis — fausses alarmes possibles",
    "Le client est responsable de la configuration et du maintien"
  ] : [
    "Not intended for emergency services (911)",
    "Depends on power supply and Internet connection",
    "Periodic testing required — false alarms possible",
    "Client responsible for configuration and maintenance"
  ];

  return (
    <ServiceInfoBox
      title={isFrench ? "À savoir — Sécurité" : "Good to Know — Security"}
      items={items}
      linkTo="/conditions-de-service"
      linkLabel={isFrench ? "Voir les conditions complètes" : "View full terms"}
    />
  );
};

export default ServiceInfoBox;
