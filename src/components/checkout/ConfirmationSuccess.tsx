import { CheckCircle2, FileText, Package, MapPin, Calendar, Clock, ArrowRight, Printer, CalendarPlus, Phone, Mail, LifeBuoy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";

interface ConfirmationSuccessProps {
  isFrench?: boolean;
  orderNumber: string;
  serviceName: string;
  serviceDescription?: string;
  totalPaid: number;
  monthlyAmount?: number;
  installationAddress?: string;
  installationDate?: string;
  installationTime?: string;
  installationMethod?: "auto" | "technician";
  equipmentList?: Array<{ name: string; quantity?: number; fee?: number }>;
  onViewOrders?: () => void;
  onViewInvoice?: () => void;
  onCreateTicket?: () => void;
  onPrint?: () => void;
  onAddToCalendar?: () => void;
}

export const ConfirmationSuccess = ({
  isFrench = true,
  orderNumber,
  serviceName,
  serviceDescription,
  totalPaid,
  monthlyAmount,
  installationAddress,
  installationDate,
  installationTime,
  installationMethod,
  equipmentList = [],
  onViewOrders,
  onViewInvoice,
  onCreateTicket,
  onPrint,
  onAddToCalendar,
}: ConfirmationSuccessProps) => {
  const nextSteps = isFrench ? [
    {
      step: 1,
      title: "Confirmation par courriel",
      description: "Vous recevrez un courriel de confirmation avec tous les détails dans les prochaines minutes."
    },
    {
      step: 2,
      title: "Traitement de la commande",
      description: "Notre équipe vérifiera votre commande et préparera votre équipement."
    },
    {
      step: 3,
      title: installationMethod === "auto" ? "Expédition" : "Installation planifiée",
      description: installationMethod === "auto" 
        ? "Votre équipement sera expédié sous 2-3 jours ouvrables."
        : "Un technicien vous contactera pour confirmer le rendez-vous."
    },
    {
      step: 4,
      title: "Activation",
      description: "Vos services seront activés une fois l'installation complétée."
    }
  ] : [
    {
      step: 1,
      title: "Email confirmation",
      description: "You will receive a confirmation email with all details within the next few minutes."
    },
    {
      step: 2,
      title: "Order processing",
      description: "Our team will verify your order and prepare your equipment."
    },
    {
      step: 3,
      title: installationMethod === "auto" ? "Shipping" : "Scheduled installation",
      description: installationMethod === "auto" 
        ? "Your equipment will be shipped within 2-3 business days."
        : "A technician will contact you to confirm the appointment."
    },
    {
      step: 4,
      title: "Activation",
      description: "Your services will be activated once the installation is complete."
    }
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Success Header */}
      <Card className="bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-primary/5 border-emerald-500/30 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-radial from-emerald-500/20 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <CardContent className="py-10 relative">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                {isFrench ? "Commande confirmée!" : "Order Confirmed!"}
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                {isFrench 
                  ? "Merci pour votre confiance. Votre commande a été reçue et est en cours de traitement."
                  : "Thank you for your trust. Your order has been received and is being processed."}
              </p>
            </div>
            <div className="flex flex-col items-center gap-2 pt-4">
              <p className="text-sm text-muted-foreground">
                {isFrench ? "Numéro de référence" : "Reference number"}
              </p>
              <Badge className="bg-foreground text-background text-lg px-6 py-2 font-mono">
                {orderNumber}
              </Badge>
              <Badge variant="outline" className="mt-2 text-emerald-600 border-emerald-500/30">
                {isFrench ? "En traitement" : "Processing"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Service Details */}
        <Card className="bg-card border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              {isFrench ? "Détails de la commande" : "Order Details"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="font-semibold text-foreground">{serviceName}</p>
              {serviceDescription && (
                <p className="text-sm text-muted-foreground">{serviceDescription}</p>
              )}
            </div>
            
            {equipmentList.length > 0 && (
              <>
                <Separator />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    {isFrench ? "Équipement" : "Equipment"}
                  </p>
                  {equipmentList.map((item, i) => (
                    <p key={i} className="text-sm text-foreground">
                      {item.quantity && item.quantity > 1 ? `${item.quantity}x ` : ""}{item.name}
                      {item.fee !== undefined && ` ($${item.fee})`}
                    </p>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Payment Summary */}
        <Card className="bg-card border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              {isFrench ? "Montant payé" : "Amount Paid"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-primary/5 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-primary">${totalPaid.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {isFrench ? "Frais initiaux" : "Initial fees"}
              </p>
            </div>
            {monthlyAmount && monthlyAmount > 0 && (
              <p className="text-sm text-center text-muted-foreground">
                {isFrench 
                  ? `Mensualité: $${monthlyAmount.toFixed(2)}/mois (après activation)`
                  : `Monthly: $${monthlyAmount.toFixed(2)}/mo (after activation)`}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Installation Info */}
      {(installationAddress || installationDate) && (
        <Card className="bg-card border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {installationMethod === "auto" ? (
                <Package className="w-4 h-4 text-primary" />
              ) : (
                <MapPin className="w-4 h-4 text-primary" />
              )}
              {isFrench 
                ? (installationMethod === "auto" ? "Livraison" : "Installation")
                : (installationMethod === "auto" ? "Delivery" : "Installation")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {installationAddress && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {isFrench ? "Adresse" : "Address"}
                    </p>
                    <p className="text-sm font-medium text-foreground">{installationAddress}</p>
                  </div>
                </div>
              )}
              {installationDate && (
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {isFrench ? "Date prévue" : "Scheduled date"}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {installationDate}
                      {installationTime && ` • ${installationTime}`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next Steps */}
      <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-primary" />
            {isFrench ? "Prochaines étapes" : "Next Steps"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {nextSteps.map((step, index) => (
              <div key={step.step} className="flex items-start gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  index === nextSteps.length - 1 
                    ? "bg-emerald-500/20 text-emerald-600" 
                    : "bg-primary/10 text-primary"
                }`}>
                  <span className="text-sm font-bold">{step.step}</span>
                </div>
                <div>
                  <p className="font-medium text-foreground">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {onPrint && (
          <Button variant="outline" className="gap-2" onClick={onPrint}>
            <Printer className="w-4 h-4" />
            {isFrench ? "Imprimer" : "Print"}
          </Button>
        )}
        {onAddToCalendar && installationDate && (
          <Button variant="outline" className="gap-2" onClick={onAddToCalendar}>
            <CalendarPlus className="w-4 h-4" />
            {isFrench ? "Ajouter au calendrier" : "Add to calendar"}
          </Button>
        )}
        {onViewInvoice && (
          <Button variant="outline" className="gap-2" onClick={onViewInvoice}>
            <FileText className="w-4 h-4" />
            {isFrench ? "Voir facture" : "View invoice"}
          </Button>
        )}
        {onCreateTicket && (
          <Button variant="outline" className="gap-2" onClick={onCreateTicket}>
            <LifeBuoy className="w-4 h-4" />
            {isFrench ? "Ouvrir un billet" : "Open ticket"}
          </Button>
        )}
        {onViewOrders && (
          <Button variant="hero" className="gap-2" onClick={onViewOrders}>
            {isFrench ? "Voir mes commandes" : "View my orders"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Contact Support */}
      <Card className="bg-muted/50 border-border">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Phone className="w-4 h-4" />
              1-888-NIVRA
            </span>
            <span className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              support@nivra.ca
            </span>
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {isFrench ? "Lun-Ven 9h-18h" : "Mon-Fri 9AM-6PM"}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfirmationSuccess;
