import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, FileText, Clock, CheckCircle2, XCircle, AlertTriangle, ListChecks } from "lucide-react";
import { Link } from "react-router-dom";

export interface ChecklistState {
  prepaid: boolean;
  delays: boolean;
  notices: boolean;
  etransfer: boolean;
}

export interface CheckoutEssentialTermsBaseProps {
  isFrench: boolean;
  checklist: ChecklistState;
  onChecklistChange: (key: keyof ChecklistState, checked: boolean) => void;
  paymentMethod?: "credit_card" | "etransfer" | "saved" | "new";
}

// E-Transfer status display component
export const ETransferStatusInfo = ({ isFrench }: { isFrench: boolean }) => {
  const statuses = [
    { 
      key: "Pending", 
      label: isFrench ? "Pending" : "Pending", 
      icon: Clock, 
      color: "bg-amber-500/20 text-amber-500",
      description: isFrench ? "Virement envoyé, en attente de réception" : "Transfer sent, awaiting receipt"
    },
    { 
      key: "In verification", 
      label: isFrench ? "In verification" : "In verification", 
      icon: AlertCircle, 
      color: "bg-blue-500/20 text-blue-500",
      description: isFrench ? "Montant reçu, vérification en cours" : "Amount received, verification in progress"
    },
    { 
      key: "Complete", 
      label: isFrench ? "Complete" : "Complete", 
      icon: CheckCircle2, 
      color: "bg-emerald-500/20 text-emerald-500",
      description: isFrench ? "Paiement confirmé, service activé" : "Payment confirmed, service activated"
    },
    { 
      key: "Declined", 
      label: isFrench ? "Declined" : "Declined", 
      icon: XCircle, 
      color: "bg-red-500/20 text-red-500",
      description: isFrench ? "Paiement refusé, contacter le support" : "Payment declined, contact support"
    },
    { 
      key: "Fraud", 
      label: isFrench ? "Fraud" : "Fraud", 
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

export const CheckoutEssentialTermsBase = ({
  isFrench,
  checklist,
  onChecklistChange,
  paymentMethod,
}: CheckoutEssentialTermsBaseProps) => {
  const isETransfer = paymentMethod === "etransfer";

  const essentialTerms = isFrench ? [
    "Vous payez à l'avance par cycle (services prépayés). La facture est émise 5 jours avant votre Bill Cycle. Le paiement doit être confirmé AVANT le Bill Cycle pour renouveler le service.",
    "Si le paiement n'est pas reçu au Bill Cycle (J0), le service devient Expiré (non-renouvelé). Frais de réactivation applicables.",
    "Le cycle en cours payé n'est pas remboursable (sauf disposition légale contraire ou erreur de facturation confirmée).",
    "Les délais d'installation/activation sont des estimations. Service fourni en « best effort » (interruptions possibles).",
    "Avis et factures transmis via le portail et/ou courriel.",
    "En cas d'erreur d'affichage (« Prix à confirmer »), le prix applicable est celui de la confirmation de commande et/ou de la facture."
  ] : [
    "You pay in advance per cycle (prepaid services). Invoice is issued 5 days before your Bill Cycle. Payment must be confirmed BEFORE Bill Cycle to renew service.",
    "If payment is not received at Bill Cycle (J0), service becomes Expired (non-renewed). Reactivation fee applies.",
    "The current paid cycle is non-refundable (except where required by law or confirmed billing error).",
    "Installation/activation timelines are estimates. Service provided on a \"best effort\" basis (interruptions possible).",
    "Notices and invoices transmitted via portal and/or email.",
    "In case of display error (\"Price to confirm\"), the applicable price is that of the order confirmation and/or invoice."
  ];

  const checklistItems = [
    {
      key: "prepaid" as keyof ChecklistState,
      label: isFrench 
        ? "J'ai compris que les services sont prépayés, que la facture est émise 5 jours avant le Bill Cycle, et que le paiement doit être confirmé AVANT le Bill Cycle pour renouveler."
        : "I understand that services are prepaid, invoice is issued 5 days before Bill Cycle, and payment must be confirmed BEFORE Bill Cycle to renew.",
      required: true
    },
    {
      key: "delays" as keyof ChecklistState,
      label: isFrench 
        ? "J'ai compris que les délais d'installation/activation sont estimés et que le service est fourni en best effort."
        : "I understand that installation/activation timelines are estimates and service is provided on a best effort basis.",
      required: true
    },
    {
      key: "notices" as keyof ChecklistState,
      label: isFrench 
        ? "J'ai compris que les avis peuvent être transmis via portail et/ou courriel."
        : "I understand that notices may be sent via portal and/or email.",
      required: true
    },
  ];

  // Add e-transfer item if applicable
  if (isETransfer) {
    checklistItems.push({
      key: "etransfer" as keyof ChecklistState,
      label: isFrench 
        ? "J'ai compris que l'activation se fait après réception et vérification du paiement e-Transfer."
        : "I understand that activation occurs after receipt and verification of the e-Transfer payment.",
      required: true
    });
  }

  return (
    <div className="space-y-4">
      {/* Essential Terms Card */}
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
              <Link to="/conditions-de-service#contestations" className="text-xs text-primary hover:underline">
                {isFrench ? "Contestations (10 jours)" : "Disputes (10 days)"}
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
              <Link to="/frais-possibles" className="text-xs text-primary hover:underline">
                {isFrench ? "Frais possibles" : "Possible Fees"}
              </Link>
              <span className="text-xs text-muted-foreground">•</span>
              <Link to="/confidentialite-loi25" className="text-xs text-primary hover:underline">
                {isFrench ? "Confidentialité" : "Privacy"}
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* E-Transfer Info (if applicable) */}
      {isETransfer && <ETransferStatusInfo isFrench={isFrench} />}

      {/* Checklist Card */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-primary" />
            {isFrench ? "Checklist avant paiement" : "Pre-payment Checklist"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {checklistItems.map((item) => (
            <div key={item.key} className="flex items-start gap-3">
              <Checkbox
                id={`checklist-${item.key}`}
                checked={checklist[item.key]}
                onCheckedChange={(checked) => onChecklistChange(item.key, checked === true)}
                className="mt-0.5"
              />
              <Label 
                htmlFor={`checklist-${item.key}`} 
                className="text-sm text-foreground cursor-pointer leading-relaxed"
              >
                {item.label}
              </Label>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

// Helper to check if all required items are checked
export const isChecklistComplete = (checklist: ChecklistState, isETransfer: boolean): boolean => {
  const baseComplete = checklist.prepaid && checklist.delays && checklist.notices;
  if (isETransfer) {
    return baseComplete && checklist.etransfer;
  }
  return baseComplete;
};

export default CheckoutEssentialTermsBase;
