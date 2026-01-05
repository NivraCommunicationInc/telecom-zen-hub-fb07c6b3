import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CheckCircle2,
  FileText,
  Receipt,
  Package,
  MapPin,
  Calendar,
  Clock,
  ArrowRight,
  Printer,
  CalendarPlus,
  Phone,
  Mail,
  LifeBuoy,
  Truck,
  Wrench,
  Wifi,
  Tv,
  Shield,
  CreditCard,
  Smartphone,
  Copy,
  Download,
  MessageSquare,
  User,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

// Types for order data
interface ServiceItem {
  name: string;
  description?: string;
  monthlyPrice?: number;
  quantity?: number;
}

interface FeeItem {
  label: string;
  amount: number;
  description?: string;
  isDiscount?: boolean;
}

interface EquipmentItem {
  name: string;
  quantity?: number;
  method?: "shipping" | "technician" | "pickup";
  fee?: number;
}

interface TransferDetails {
  phoneNumber?: string;
  accountNumber?: string;
  imei?: string;
  status?: string;
}

interface ProfessionalConfirmationProps {
  isFrench?: boolean;
  // Order reference
  orderNumber: string;
  confirmationNumber?: string;
  orderStatus?: "received" | "processing" | "approved" | "pending";
  createdAt?: Date;
  // Services
  monthlyServices?: ServiceItem[];
  monthlySubtotal?: number;
  // One-time fees
  oneTimeFees?: FeeItem[];
  oneTimeSubtotal?: number;
  tpsAmount?: number;
  tvqAmount?: number;
  totalDueToday?: number;
  // Payment info
  paymentMethod?: string;
  cardType?: string;
  cardLastFour?: string;
  isPreAuthorized?: boolean;
  // Equipment
  equipment?: EquipmentItem[];
  // Installation / Delivery
  fulfillmentType?: "installation" | "delivery" | "pickup";
  installationDate?: string;
  installationTime?: string;
  installationBooked?: boolean;
  deliveryEstimate?: string;
  serviceAddress?: string;
  serviceCity?: string;
  servicePostalCode?: string;
  // Transfer details (for mobile orders)
  transferDetails?: TransferDetails;
  // Category for icon display
  category?: "Internet" | "TV" | "Mobile" | "Security" | "Bundle";
  // Callbacks
  onViewOrders?: () => void;
  onDownloadReceipt?: () => void;
  onModifyAppointment?: () => void;
  onCreateTicket?: () => void;
  onPrint?: () => void;
  onAddToCalendar?: () => void;
}

export const ProfessionalConfirmation = ({
  isFrench = true,
  orderNumber,
  confirmationNumber,
  orderStatus = "received",
  createdAt = new Date(),
  monthlyServices = [],
  monthlySubtotal = 0,
  oneTimeFees = [],
  oneTimeSubtotal = 0,
  tpsAmount = 0,
  tvqAmount = 0,
  totalDueToday = 0,
  paymentMethod,
  cardType,
  cardLastFour,
  isPreAuthorized = true,
  equipment = [],
  fulfillmentType = "installation",
  installationDate,
  installationTime,
  installationBooked = false,
  deliveryEstimate,
  serviceAddress,
  serviceCity,
  servicePostalCode,
  transferDetails,
  category = "Internet",
  onViewOrders,
  onDownloadReceipt,
  onModifyAppointment,
  onCreateTicket,
  onPrint,
  onAddToCalendar,
}: ProfessionalConfirmationProps) => {
  const navigate = useNavigate();
  const [showFullFees, setShowFullFees] = useState(false);

  // Status badge config
  const statusConfig = {
    received: { 
      label: isFrench ? "Reçue" : "Received", 
      className: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30" 
    },
    processing: { 
      label: isFrench ? "En traitement" : "Processing", 
      className: "bg-amber-500/20 text-amber-600 border-amber-500/30" 
    },
    approved: { 
      label: isFrench ? "Approuvée" : "Approved", 
      className: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30" 
    },
    pending: { 
      label: isFrench ? "En attente" : "Pending", 
      className: "bg-amber-500/20 text-amber-600 border-amber-500/30" 
    },
  };

  // Category icon
  const categoryIcons = {
    Internet: Wifi,
    TV: Tv,
    Mobile: Smartphone,
    Security: Shield,
    Bundle: Package,
  };
  const CategoryIcon = categoryIcons[category] || Package;

  // Format currency
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
  };

  // Next step banner content
  const getNextStepContent = () => {
    if (fulfillmentType === "installation") {
      if (installationBooked && installationDate) {
        return {
          title: isFrench ? "Installation confirmée" : "Installation confirmed",
          description: isFrench
            ? `Rendez-vous prévu le ${format(new Date(installationDate), "d MMMM yyyy", { locale: fr })} ${installationTime || ""}`
            : `Appointment scheduled for ${format(new Date(installationDate), "MMMM d, yyyy")} ${installationTime || ""}`,
          icon: Wrench,
          color: "emerald",
        };
      }
      return {
        title: isFrench ? "Installation à planifier" : "Installation to schedule",
        description: isFrench
          ? "Un agent vous contactera sous 2 à 24 h pour confirmer l'installation."
          : "An agent will contact you within 2-24 hours to confirm the installation.",
        icon: Calendar,
        color: "amber",
      };
    }
    if (fulfillmentType === "delivery") {
      return {
        title: isFrench ? "Expédition prévue" : "Shipping scheduled",
        description: deliveryEstimate 
          ? (isFrench ? `Livraison estimée: ${deliveryEstimate}` : `Estimated delivery: ${deliveryEstimate}`)
          : (isFrench ? "Livraison sous 1-3 jours ouvrables" : "Delivery within 1-3 business days"),
        icon: Truck,
        color: "blue",
      };
    }
    return {
      title: isFrench ? "Prêt pour ramassage" : "Ready for pickup",
      description: isFrench
        ? "Vous serez contacté lorsque votre commande sera prête."
        : "You will be contacted when your order is ready.",
      icon: Package,
      color: "purple",
    };
  };

  const nextStep = getNextStepContent();
  const NextStepIcon = nextStep.icon;

  // Copy order number to clipboard
  const copyOrderNumber = () => {
    navigator.clipboard.writeText(orderNumber);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header - Success Banner */}
      <Card className="bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-primary/5 border-emerald-500/30 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-radial from-emerald-500/20 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <CardContent className="py-8 relative">
          <div className="text-center space-y-4">
            {/* Success Icon */}
            <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
              <CheckCircle2 className="w-10 h-10 text-white" />
            </div>
            
            {/* Title */}
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                {isFrench ? "Commande confirmée" : "Order Confirmed"}
              </h1>
              <p className="text-muted-foreground max-w-lg mx-auto">
                {isFrench 
                  ? "Merci. Nous avons bien reçu votre commande et nous la traitons maintenant."
                  : "Thank you. We have received your order and are now processing it."}
              </p>
            </div>

            {/* Order Reference + Status + Timestamp */}
            <div className="flex flex-col items-center gap-3 pt-4">
              <div className="flex items-center gap-2">
                <Badge className="bg-foreground text-background text-lg px-6 py-2 font-mono">
                  {orderNumber}
                </Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyOrderNumber}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={statusConfig[orderStatus].className}>
                  {statusConfig[orderStatus].label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {format(createdAt, "d MMMM yyyy 'à' HH:mm", { locale: isFrench ? fr : undefined })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next Step Banner */}
      <Card className={`border-${nextStep.color}-500/30 bg-${nextStep.color}-500/5`}>
        <CardContent className="py-5">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-full bg-${nextStep.color}-500/20 flex items-center justify-center flex-shrink-0`}>
              <NextStepIcon className={`w-6 h-6 text-${nextStep.color}-500`} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                {isFrench ? "Prochaine étape" : "Next Step"}
              </p>
              <h3 className="text-lg font-semibold text-foreground">{nextStep.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{nextStep.description}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Details Section */}
      <Card className="bg-card border-border">
        <CardHeader className="border-b border-border">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-primary" />
            {isFrench ? "Détails de la commande" : "Order Details"}
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6 space-y-6">
          {/* Monthly Services */}
          {monthlyServices.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {isFrench ? "Services (Mensuel)" : "Services (Monthly)"}
              </h4>
              <div className="space-y-3">
                {monthlyServices.map((service, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <CategoryIcon className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">{service.name}</p>
                        {service.description && (
                          <p className="text-sm text-muted-foreground">{service.description}</p>
                        )}
                      </div>
                    </div>
                    {service.monthlyPrice !== undefined && (
                      <span className="font-semibold text-foreground">
                        {formatCurrency(service.monthlyPrice)}/mo
                      </span>
                    )}
                  </div>
                ))}
                {monthlySubtotal > 0 && (
                  <div className="flex justify-between pt-2 border-t border-border">
                    <span className="text-muted-foreground">
                      {isFrench ? "Sous-total mensuel estimé" : "Estimated monthly subtotal"}
                    </span>
                    <span className="font-semibold">{formatCurrency(monthlySubtotal)}/mo</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* One-Time Fees */}
          <div>
            <div 
              className="flex items-center justify-between cursor-pointer"
              onClick={() => setShowFullFees(!showFullFees)}
            >
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {isFrench ? "Frais uniques (Aujourd'hui)" : "One-Time Fees (Today)"}
              </h4>
              <Button variant="ghost" size="sm" className="gap-1">
                {showFullFees ? (
                  <><ChevronUp className="w-4 h-4" /> {isFrench ? "Moins" : "Less"}</>
                ) : (
                  <><ChevronDown className="w-4 h-4" /> {isFrench ? "Détails" : "Details"}</>
                )}
              </Button>
            </div>
            
            {showFullFees && oneTimeFees.length > 0 && (
              <div className="mt-3 space-y-2">
                {oneTimeFees.map((fee, idx) => (
                  <div key={idx} className={`flex justify-between py-1 ${fee.isDiscount ? "text-emerald-600" : ""}`}>
                    <span className="text-muted-foreground">{fee.label}</span>
                    <span className={fee.isDiscount ? "text-emerald-600" : "text-foreground"}>
                      {fee.isDiscount ? "-" : ""}{formatCurrency(fee.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            
            {/* Taxes */}
            <div className="mt-3 space-y-2 pt-3 border-t border-border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">TPS (5%)</span>
                <span className="text-foreground">{formatCurrency(tpsAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">TVQ (9.975%)</span>
                <span className="text-foreground">{formatCurrency(tvqAmount)}</span>
              </div>
            </div>
            
            {/* Total */}
            <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-foreground">
                    {isFrench ? "Total dû aujourd'hui" : "Total due today"}
                  </p>
                  {isPreAuthorized && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {isFrench 
                        ? "Dépôt préautorisé (remboursable)" 
                        : "Pre-authorized deposit (refundable)"}
                    </p>
                  )}
                </div>
                <span className="text-2xl font-bold text-primary">{formatCurrency(totalDueToday)}</span>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          {(paymentMethod || cardLastFour) && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {isFrench ? "Paiement / Autorisation" : "Payment / Authorization"}
                </h4>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <CreditCard className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">
                      {cardType || "Card"} •••• {cardLastFour}
                    </p>
                    {isPreAuthorized && (
                      <p className="text-sm text-amber-600">
                        {isFrench 
                          ? "Préautorisation (dépôt) — remboursable si la commande est annulée"
                          : "Pre-authorized amount (deposit) — refundable if the order is cancelled"}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Equipment Section */}
      {equipment.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="w-5 h-5 text-primary" />
              {isFrench ? "Équipement" : "Equipment"}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <div className="space-y-3">
              {equipment.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-foreground">
                        {item.quantity && item.quantity > 1 ? `${item.quantity}x ` : ""}{item.name}
                      </p>
                      {item.method && (
                        <p className="text-xs text-muted-foreground">
                          {item.method === "shipping" && (isFrench ? "Livraison" : "Shipping")}
                          {item.method === "technician" && (isFrench ? "Installation technicien" : "Technician install")}
                          {item.method === "pickup" && (isFrench ? "Ramassage" : "Pickup")}
                        </p>
                      )}
                    </div>
                  </div>
                  {item.fee !== undefined && item.fee > 0 && (
                    <span className="text-sm text-muted-foreground">{formatCurrency(item.fee)}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Installation / Delivery Section */}
      {(serviceAddress || installationDate || deliveryEstimate) && (
        <Card className="bg-card border-border">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              {fulfillmentType === "installation" ? (
                <Wrench className="w-5 h-5 text-primary" />
              ) : (
                <Truck className="w-5 h-5 text-primary" />
              )}
              {fulfillmentType === "installation" 
                ? (isFrench ? "Installation" : "Installation")
                : (isFrench ? "Livraison" : "Delivery")}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Address */}
              {serviceAddress && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">
                      {isFrench ? "Adresse de service" : "Service Address"}
                    </p>
                    <p className="font-medium text-foreground">{serviceAddress}</p>
                    {(serviceCity || servicePostalCode) && (
                      <p className="text-sm text-muted-foreground">
                        {[serviceCity, servicePostalCode].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Date/Time */}
              {(installationDate || deliveryEstimate) && (
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">
                      {fulfillmentType === "installation"
                        ? (isFrench ? "Date d'installation" : "Installation Date")
                        : (isFrench ? "Livraison estimée" : "Estimated Delivery")}
                    </p>
                    {installationDate ? (
                      <p className="font-medium text-foreground">
                        {format(new Date(installationDate), "d MMMM yyyy", { locale: isFrench ? fr : undefined })}
                        {installationTime && ` • ${installationTime}`}
                      </p>
                    ) : (
                      <p className="font-medium text-foreground">
                        {deliveryEstimate || (isFrench ? "1-3 jours ouvrables" : "1-3 business days")}
                      </p>
                    )}
                    {!installationBooked && fulfillmentType === "installation" && (
                      <p className="text-xs text-amber-600 mt-1">
                        {isFrench 
                          ? "Un agent vous contactera pour confirmer"
                          : "An agent will contact you to confirm"}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Number Transfer Section (for Mobile orders) */}
      {transferDetails && (transferDetails.phoneNumber || transferDetails.accountNumber) && (
        <Card className="bg-amber-500/5 border-amber-500/30">
          <CardHeader className="border-b border-amber-500/20 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <RefreshCw className="w-5 h-5 text-amber-600" />
              {isFrench ? "Transfert de numéro" : "Number Transfer"}
            </CardTitle>
          </CardHeader>
          <CardContent className="py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {transferDetails.phoneNumber && (
                <div>
                  <p className="text-xs text-muted-foreground">{isFrench ? "Numéro" : "Number"}</p>
                  <p className="font-mono font-medium">{transferDetails.phoneNumber}</p>
                </div>
              )}
              {transferDetails.accountNumber && (
                <div>
                  <p className="text-xs text-muted-foreground">{isFrench ? "Compte" : "Account"}</p>
                  <p className="font-mono font-medium">{transferDetails.accountNumber}</p>
                </div>
              )}
              {transferDetails.imei && (
                <div>
                  <p className="text-xs text-muted-foreground">IMEI</p>
                  <p className="font-mono font-medium text-sm">{transferDetails.imei}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">{isFrench ? "Statut" : "Status"}</p>
                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                  {transferDetails.status || (isFrench ? "À traiter" : "Processing")}
                </Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              {isFrench 
                ? "La portabilité est généralement complétée dans un délai de 2 à 48 h."
                : "Number portability is typically completed within 2-48 hours."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap justify-center gap-3">
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
        {onDownloadReceipt && (
          <Button variant="outline" className="gap-2" onClick={onDownloadReceipt}>
            <Download className="w-4 h-4" />
            {isFrench ? "Télécharger le reçu" : "Download receipt"}
          </Button>
        )}
        {onModifyAppointment && fulfillmentType === "installation" && (
          <Button variant="outline" className="gap-2" onClick={onModifyAppointment}>
            <Calendar className="w-4 h-4" />
            {isFrench ? "Modifier le rendez-vous" : "Modify appointment"}
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
            {isFrench ? "Voir ma commande" : "View my order"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Communication Expectations Card */}
      <Card className="bg-muted/30 border-border">
        <CardContent className="py-5">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-foreground mb-1">
                {isFrench ? "Suivi de commande" : "Order Tracking"}
              </h4>
              <p className="text-sm text-muted-foreground">
                {isFrench 
                  ? "Vous recevrez un courriel/SMS de confirmation. Conservez votre référence:"
                  : "You will receive a confirmation email/SMS. Keep your reference:"}
                {" "}
                <span className="font-mono font-semibold text-foreground">{orderNumber}</span>
              </p>
              <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground">
                <a href="tel:+14385442233" className="flex items-center gap-2 hover:text-foreground transition-colors">
                  <Phone className="w-4 h-4" />
                  438-544-2233
                </a>
                <span className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Support@nivratelecom.ca
                </span>
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {isFrench ? "Lun-Ven 9h-18h" : "Mon-Fri 9AM-6PM"}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfessionalConfirmation;
