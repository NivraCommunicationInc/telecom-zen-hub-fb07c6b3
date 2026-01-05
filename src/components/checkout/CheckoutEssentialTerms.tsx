import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, FileText, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

interface CheckoutEssentialTermsProps {
  isFrench: boolean;
  acknowledged: boolean;
  onAcknowledgeChange: (checked: boolean) => void;
  paymentMethod?: "credit_card" | "etransfer" | "saved" | "new";
}

// E-Transfer status display component
export const ETransferStatusInfo = ({ isFrench }: { isFrench: boolean }) => {
  const statuses = [
    { 
      key: "Pending", 
      label: isFrench ? "En attente" : "Pending", 
      icon: Clock, 
      color: "bg-amber-500/20 text-amber-500",
      description: isFrench ? "Virement envoyé, en attente de réception" : "Transfer sent, awaiting receipt"
    },
    { 
      key: "In verification", 
      label: isFrench ? "En vérification" : "In verification", 
      icon: AlertCircle, 
      color: "bg-blue-500/20 text-blue-500",
      description: isFrench ? "Montant reçu, vérification en cours" : "Amount received, verification in progress"
    },
    { 
      key: "Complete", 
      label: isFrench ? "Complet" : "Complete", 
      icon: CheckCircle2, 
      color: "bg-emerald-500/20 text-emerald-500",
      description: isFrench ? "Paiement confirmé, service activé" : "Payment confirmed, service activated"
    },
    { 
      key: "Declined", 
      label: isFrench ? "Refusé" : "Declined", 
      icon: XCircle, 
      color: "bg-red-500/20 text-red-500",
      description: isFrench ? "Paiement refusé, contacter le support" : "Payment declined, contact support"
    },
    { 
      key: "Fraud", 
      label: isFrench ? "Fraude" : "Fraud", 
      icon: AlertTriangle, 
      color: "bg-red-600/20 text-red-600",
      description: isFrench ? "Activité suspecte détectée" : "Suspicious activity detected"
    },
  ];

  return (
    <Card className="bg-amber-500/5 border-amber-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          {isFrench ? "Paiement par virement Interac" : "Interac e-Transfer Payment"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {isFrench 
            ? "L'activation du service se fait uniquement après réception et vérification du virement. Statuts possibles :"
            : "Service activation occurs only after receipt and verification of the transfer. Possible statuses:"}
        </p>
        <div className="space-y-2">
          {statuses.map((status) => (
            <div key={status.key} className="flex items-center gap-3 text-sm">
              <Badge className={`${status.color} border-0 gap-1`}>
                <status.icon className="w-3 h-3" />
                {status.label}
              </Badge>
              <span className="text-muted-foreground text-xs">{status.description}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export const CheckoutEssentialTerms = ({
  isFrench,
  acknowledged,
  onAcknowledgeChange,
  paymentMethod,
}: CheckoutEssentialTermsProps) => {
  const isETransfer = paymentMethod === "etransfer";

  const essentialTerms = isFrench ? [
    "Les services sont prépayés par cycle; le renouvellement se fait uniquement après réception et confirmation du paiement.",
    "Le client peut annuler en tout temps; le service reste actif jusqu'à la fin de la période payée; le cycle en cours n'est pas remboursable, sauf obligation légale ou erreur de facturation confirmée.",
    "Disponibilité « meilleur effort » (best effort); des interruptions sont possibles; les délais d'installation/activation sont des estimations.",
    "Les taxes applicables (TPS/TVQ) s'appliquent.",
    "En cas d'erreur d'affichage de prix, le prix facturé sur la confirmation/facture fait foi."
  ] : [
    "Services are prepaid per cycle; renewal occurs only after payment is received and confirmed.",
    "Client can cancel anytime; service stays active until end of paid period; current paid cycle is non-refundable except for legal requirement or confirmed billing error.",
    "Best effort availability; interruptions possible; installation/activation ETAs are estimates.",
    "Applicable taxes (GST/QST) apply.",
    "In case of display price errors, the price on confirmation/invoice prevails."
  ];

  return (
    <div className="space-y-4">
      <Card className="bg-muted/50 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            {isFrench ? "Conditions essentielles" : "Essential Terms"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm text-muted-foreground">
            {essentialTerms.map((term, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>{term}</span>
              </li>
            ))}
          </ul>
          
          <div className="pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">
              {isFrench ? "Documents légaux :" : "Legal documents:"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link to="/conditions-de-service" className="text-xs text-primary hover:underline">
                {isFrench ? "Conditions de service" : "Terms of Service"}
              </Link>
              <span className="text-xs text-muted-foreground">•</span>
              <Link to="/modalites-paiement" className="text-xs text-primary hover:underline">
                {isFrench ? "Modalités de paiement" : "Payment Terms"}
              </Link>
              <span className="text-xs text-muted-foreground">•</span>
              <Link to="/equipement-garantie" className="text-xs text-primary hover:underline">
                {isFrench ? "Équipement & garantie" : "Equipment & Warranty"}
              </Link>
              <span className="text-xs text-muted-foreground">•</span>
              <Link to="/confidentialite-loi25" className="text-xs text-primary hover:underline">
                {isFrench ? "Confidentialité" : "Privacy"}
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {isETransfer && <ETransferStatusInfo isFrench={isFrench} />}

      <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
        <Checkbox
          id="essential-terms-acknowledged"
          checked={acknowledged}
          onCheckedChange={(checked) => onAcknowledgeChange(checked === true)}
          className="mt-0.5"
        />
        <Label 
          htmlFor="essential-terms-acknowledged" 
          className="text-sm text-foreground cursor-pointer leading-relaxed"
        >
          {isFrench 
            ? "J'ai lu et je comprends les conditions essentielles ci-dessus, y compris les politiques de paiement, d'annulation et de service."
            : "I have read and understand the essential terms above, including payment, cancellation and service policies."}
        </Label>
      </div>
    </div>
  );
};

export default CheckoutEssentialTerms;
