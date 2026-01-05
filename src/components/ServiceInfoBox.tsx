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

// Predefined info boxes for each service type - Text matches Contract Annex B exactly
export const MobileInfoBox = ({ isFrench }: { isFrench: boolean }) => {
  const items = isFrench ? [
    "La portabilité dépend de votre fournisseur actuel et des informations fournies (incluant NIP/PIN de portage si requis).",
    "Des frais peuvent s'appliquer pour activation/remplacement SIM/eSIM (perte/vol/bris).",
    "Roaming/hors-forfait/valeur ajoutée facturés selon tarifs applicables; mesures anti-fraude possibles."
  ] : [
    "Portability depends on your current provider and the information provided (including porting PIN if required).",
    "Fees may apply for SIM/eSIM activation/replacement (loss/theft/damage).",
    "Roaming/overage/value-added billed at applicable rates; anti-fraud measures possible."
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
    "Vitesses annoncées « jusqu'à » : la vitesse réelle varie (congestion, Wi-Fi, câblage, appareils, configuration).",
    "Le réseau interne (Wi-Fi/routeur/câbles) est sous responsabilité du client.",
    "Usage raisonnable pour prévenir abus/fraude/revente non autorisée."
  ] : [
    "Speeds advertised as \"up to\": actual speed varies (congestion, Wi-Fi, wiring, devices, configuration).",
    "Internal network (Wi-Fi/router/cables) is the client's responsibility.",
    "Fair use to prevent abuse/fraud/unauthorized resale."
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
    "Tous les plans incluent 25 ou 26 chaînes de base obligatoires.",
    "Chaînes Free-Choice selon le plan; Premium facturées en supplément.",
    "Certaines modifications peuvent nécessiter confirmation et créer un ticket interne (ETA 2h à 24h)."
  ] : [
    "All plans include 25 or 26 mandatory basic channels.",
    "Free-Choice channels according to plan; Premium channels billed separately.",
    "Some changes may require confirmation and create an internal ticket (ETA 2h to 24h)."
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
    "Service non-urgence : en cas d'urgence, composer 911.",
    "Dépend de l'électricité/Internet/réseaux; interruptions possibles.",
    "Fausses alarmes/interventions non couvertes peuvent entraîner des frais."
  ] : [
    "Non-emergency service: in case of emergency, call 911.",
    "Depends on electricity/Internet/networks; interruptions possible.",
    "False alarms/uncovered interventions may incur fees."
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
