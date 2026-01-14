import { useState, useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Package, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Truck, 
  Settings2, 
  Calendar,
  MapPin,
  Copy,
  Check,
  Printer,
  Phone,
  Mail,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  FileText,
  RefreshCw,
  CircleDot,
  DollarSign,
  Wifi,
  Tv,
  Monitor,
  HelpCircle,
  ArrowLeft
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr, enCA } from "date-fns/locale";
import SEOHead from "@/components/SEOHead";
import { toast } from "@/hooks/use-toast";

interface OrderData {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  service_type: string | null;
  shipping_address: string | null;
  shipping_city: string | null;
  total_amount: number | null;
  updated_at: string;
}

const ORDER_STATUSES = [
  { key: "pending", labelFr: "Reçu", labelEn: "Received", icon: Clock, description_fr: "Commande reçue", description_en: "Order received" },
  { key: "verification", labelFr: "En traitement", labelEn: "Processing", icon: Settings2, description_fr: "Vérification en cours", description_en: "Being verified" },
  { key: "shipped", labelFr: "Expédié/Planifié", labelEn: "Shipped/Scheduled", icon: Truck, description_fr: "En route ou planifié", description_en: "On the way or scheduled" },
  { key: "completed", labelFr: "Livré/Installé", labelEn: "Delivered/Installed", icon: CheckCircle2, description_fr: "Service actif", description_en: "Service active" },
];

const getStatusIndex = (status: string): number => {
  const statusMap: Record<string, number> = {
    pending: 0,
    payment_pending: 0,
    verification: 1,
    hold: 1,
    paid: 1,
    ready_to_ship: 2,
    shipped: 2,
    completed: 3,
    cancel: -1,
    cancelled: -1,
  };
  return statusMap[status] ?? 0;
};

const getStatusLabel = (status: string, isFr: boolean): string => {
  const labels: Record<string, { fr: string; en: string }> = {
    pending: { fr: "En attente", en: "Pending" },
    payment_pending: { fr: "Paiement en attente", en: "Payment Pending" },
    verification: { fr: "En traitement", en: "Processing" },
    hold: { fr: "En attente", en: "On Hold" },
    paid: { fr: "Payé", en: "Paid" },
    ready_to_ship: { fr: "Prêt à expédier", en: "Ready to Ship" },
    shipped: { fr: "Expédié", en: "Shipped" },
    completed: { fr: "Complété", en: "Completed" },
    cancel: { fr: "Annulé", en: "Cancelled" },
    cancelled: { fr: "Annulé", en: "Cancelled" },
  };
  return labels[status]?.[isFr ? "fr" : "en"] || status;
};

const getServiceIcon = (serviceType: string | null) => {
  if (!serviceType) return Package;
  const lower = serviceType.toLowerCase();
  if (lower.includes("internet") || lower.includes("giga") || lower.includes("fibre")) return Wifi;
  if (lower.includes("tv") || lower.includes("télé")) return Tv;
  if (lower.includes("mobile") || lower.includes("cell")) return Phone;
  return Monitor;
};

const TrackOrder = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const isFr = language === "fr";
  const printRef = useRef<HTMLDivElement>(null);
  
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [searched, setSearched] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOrderData(null);
    setSearched(true);

    if (!orderNumber.trim() || !email.trim()) {
      setError(isFr 
        ? "Veuillez entrer le numéro de commande et votre courriel." 
        : "Please enter both order number and your email.");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    setIsLoading(true);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "order-tracking-lookup",
        {
          body: {
            orderNumber: orderNumber.trim(),
            email: normalizedEmail,
            language: isFr ? "fr" : "en",
          },
        }
      );

      if (invokeError) {
        console.error("Invoke error:", invokeError);
        let message = isFr
          ? "Une erreur est survenue. Veuillez réessayer."
          : "An error occurred. Please try again.";

        const ctx = (invokeError as any)?.context;
        if (ctx && typeof ctx.json === "function") {
          try {
            const body = await ctx.json();
            if (body?.message && typeof body.message === "string") message = body.message;
          } catch {
            // ignore
          }
        }

        setError(message);
        setIsLoading(false);
        return;
      }

      const order = (data as any)?.order as OrderData | undefined;
      if (!order) {
        setError(
          isFr
            ? "Aucune commande trouvée avec ce numéro."
            : "No order found with this number."
        );
        setIsLoading(false);
        return;
      }

      setOrderData(order);
    } catch (err) {
      console.error("Error fetching order:", err);
      setError(
        isFr
          ? "Une erreur est survenue. Veuillez réessayer."
          : "An error occurred. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyOrderNumber = async () => {
    if (!orderData) return;
    try {
      await navigator.clipboard.writeText(orderData.order_number);
      setCopied(true);
      toast({
        title: isFr ? "Copié!" : "Copied!",
        description: isFr ? "Numéro de commande copié." : "Order number copied.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleNewSearch = () => {
    setOrderData(null);
    setSearched(false);
    setError(null);
    setOrderNumber("");
    setEmail("");
  };

  const currentIndex = orderData ? getStatusIndex(orderData.status) : 0;
  const isCancelled = orderData?.status === "cancel" || orderData?.status === "cancelled";
  const isCompleted = currentIndex === 3;
  const ServiceIcon = getServiceIcon(orderData?.service_type);

  return (
    <>
      <SEOHead 
        title={isFr ? "Suivi de commande | Nivra Telecom" : "Track Order | Nivra Telecom"}
        description={isFr 
          ? "Suivez l'état de votre commande Nivra Telecom en temps réel." 
          : "Track your Nivra Telecom order status in real time."}
      />
      
      <div className="min-h-[85vh] bg-gradient-to-b from-muted/30 via-background to-background py-8 md:py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          
          {/* Back Button */}
          <div className="mb-6 print:hidden">
            <Button 
              variant="ghost" 
              onClick={() => navigate(-1)}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
              {isFr ? "Retour" : "Back"}
            </Button>
          </div>

          {/* Hero Header */}
          <div className="text-center mb-10 animate-fade-in">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-accent to-accent/70 shadow-lg shadow-accent/25 mb-6">
              <Package className="w-10 h-10 text-accent-foreground" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3 tracking-tight">
              {isFr ? "Suivi de commande" : "Track Your Order"}
            </h1>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              {isFr 
                ? "Entrez vos informations pour voir l'état de votre commande en temps réel." 
                : "Enter your details to check your order status in real time."}
            </p>
          </div>

          {/* Search Card */}
          <Card className={cn(
            "mb-8 border-0 shadow-xl shadow-black/5 overflow-hidden transition-all duration-500",
            orderData && "ring-2 ring-accent/20"
          )}>
            <div className="bg-gradient-to-r from-accent/5 via-transparent to-accent/5 p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Search className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg text-foreground">
                    {isFr ? "Rechercher votre commande" : "Search Your Order"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {isFr 
                      ? "Le numéro se trouve dans votre courriel de confirmation" 
                      : "Find your order number in your confirmation email"}
                  </p>
                </div>
              </div>
              
              <form onSubmit={handleSearch} className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="orderNumber" className="text-sm font-medium flex items-center gap-2">
                      <FileText className="w-4 h-4 text-muted-foreground" />
                      {isFr ? "Numéro de commande" : "Order Number"}
                    </Label>
                    <Input
                      id="orderNumber"
                      placeholder={isFr ? "Ex: ORD-2026-1234" : "e.g., ORD-2026-1234"}
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      className="h-12 text-base uppercase bg-background/80 border-border/50 focus:border-accent focus:ring-accent/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      {isFr ? "Courriel" : "Email"}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder={isFr ? "votre@courriel.com" : "your@email.com"}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 text-base bg-background/80 border-border/50 focus:border-accent focus:ring-accent/20"
                    />
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  size="lg"
                  className="w-full h-12 text-base font-semibold shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      {isFr ? "Recherche en cours..." : "Searching..."}
                    </>
                  ) : (
                    <>
                      <Search className="w-5 h-5 mr-2" />
                      {isFr ? "Suivre ma commande" : "Track My Order"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>

              {error && (
                <Alert variant="destructive" className="mt-5 border-destructive/30 bg-destructive/5">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="font-medium">{error}</AlertDescription>
                </Alert>
              )}
            </div>
          </Card>

          {/* Order Results */}
          {orderData && (
            <div ref={printRef} className="space-y-6 animate-fade-in print:p-4">
              {/* Order Header Card */}
              <Card className="border-0 shadow-xl shadow-black/5 overflow-hidden">
                <div className={cn(
                  "h-2",
                  isCancelled 
                    ? "bg-gradient-to-r from-destructive to-destructive/70"
                    : isCompleted 
                      ? "bg-gradient-to-r from-green-500 to-emerald-400"
                      : "bg-gradient-to-r from-accent to-accent/70"
                )} />
                <CardContent className="p-6 md:p-8">
                  {/* Order Info Header */}
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "p-3 rounded-xl",
                        isCancelled 
                          ? "bg-destructive/10" 
                          : isCompleted 
                            ? "bg-green-500/10" 
                            : "bg-accent/10"
                      )}>
                        <ServiceIcon className={cn(
                          "w-8 h-8",
                          isCancelled 
                            ? "text-destructive" 
                            : isCompleted 
                              ? "text-green-600" 
                              : "text-accent"
                        )} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-xl md:text-2xl font-bold text-foreground">
                            {orderData.order_number}
                          </h2>
                          <button 
                            onClick={handleCopyOrderNumber}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors print:hidden"
                            title={isFr ? "Copier" : "Copy"}
                          >
                            {copied ? (
                              <Check className="w-4 h-4 text-green-600" />
                            ) : (
                              <Copy className="w-4 h-4 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground mt-1">
                          <Calendar className="w-4 h-4" />
                          <span className="text-sm">
                            {isFr ? "Passée le " : "Placed on "}
                            {format(new Date(orderData.created_at), "d MMMM yyyy", { 
                              locale: isFr ? fr : enCA 
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 print:hidden">
                      <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
                        <Printer className="w-4 h-4" />
                        <span className="hidden sm:inline">{isFr ? "Imprimer" : "Print"}</span>
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleNewSearch} className="gap-2">
                        <RefreshCw className="w-4 h-4" />
                        <span className="hidden sm:inline">{isFr ? "Nouvelle recherche" : "New Search"}</span>
                      </Button>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="mb-6">
                    <Badge 
                      variant="secondary"
                      className={cn(
                        "text-sm px-4 py-1.5 font-semibold",
                        isCancelled 
                          ? "bg-destructive/10 text-destructive border-destructive/20" 
                          : isCompleted 
                            ? "bg-green-500/10 text-green-700 border-green-500/20" 
                            : "bg-accent/10 text-accent border-accent/20"
                      )}
                    >
                      {isCancelled ? (
                        <AlertCircle className="w-4 h-4 mr-1.5" />
                      ) : isCompleted ? (
                        <Sparkles className="w-4 h-4 mr-1.5" />
                      ) : (
                        <CircleDot className="w-4 h-4 mr-1.5 animate-pulse" />
                      )}
                      {getStatusLabel(orderData.status, isFr)}
                    </Badge>
                  </div>

                  <Separator className="mb-6" />

                  {/* Order Details Grid */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
                    {orderData.service_type && (
                      <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border border-border/50">
                        <div className="p-2 rounded-lg bg-background">
                          <Monitor className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                            {isFr ? "Service" : "Service"}
                          </p>
                          <p className="font-semibold text-foreground mt-0.5">
                            {orderData.service_type}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {orderData.shipping_address && (
                      <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border border-border/50">
                        <div className="p-2 rounded-lg bg-background">
                          <MapPin className="w-5 h-5 text-accent" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                            {isFr ? "Adresse" : "Address"}
                          </p>
                          <p className="font-medium text-foreground mt-0.5 text-sm leading-snug truncate" title={orderData.shipping_address}>
                            {orderData.shipping_address}
                          </p>
                          {orderData.shipping_city && (
                            <p className="text-sm text-muted-foreground">{orderData.shipping_city}</p>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {orderData.total_amount != null && (
                      <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border border-border/50">
                        <div className="p-2 rounded-lg bg-background">
                          <DollarSign className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                            {isFr ? "Total" : "Total"}
                          </p>
                          <p className="font-bold text-foreground text-lg mt-0.5">
                            ${orderData.total_amount.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Status Timeline */}
                  {isCancelled ? (
                    <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-6 text-center">
                      <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
                      <p className="text-destructive font-semibold text-lg">
                        {isFr ? "Commande annulée" : "Order Cancelled"}
                      </p>
                      <p className="text-muted-foreground text-sm mt-1">
                        {isFr 
                          ? "Contactez-nous pour plus d'informations." 
                          : "Contact us for more information."}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-muted/30 rounded-xl p-6 md:p-8">
                      <div className="flex items-center gap-2 mb-6">
                        <ShieldCheck className="w-5 h-5 text-accent" />
                        <h3 className="font-semibold text-foreground">
                          {isFr ? "Progression de la commande" : "Order Progress"}
                        </h3>
                      </div>
                      
                      {/* Desktop Timeline */}
                      <div className="hidden md:block">
                        <div className="flex items-start justify-between relative">
                          {/* Progress line background */}
                          <div className="absolute top-6 left-0 right-0 h-1 bg-border rounded-full" />
                          {/* Progress line filled */}
                          <div 
                            className="absolute top-6 left-0 h-1 bg-gradient-to-r from-accent to-accent/80 rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${(currentIndex / (ORDER_STATUSES.length - 1)) * 100}%` }}
                          />
                          
                          {ORDER_STATUSES.map((status, index) => {
                            const Icon = status.icon;
                            const isComplete = index < currentIndex;
                            const isCurrent = index === currentIndex;
                            const isPending = index > currentIndex;
                            
                            return (
                              <div key={status.key} className="flex flex-col items-center relative z-10 flex-1">
                                <div
                                  className={cn(
                                    "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm",
                                    isComplete && "bg-accent text-accent-foreground shadow-accent/30",
                                    isCurrent && "bg-accent text-accent-foreground ring-4 ring-accent/20 shadow-lg shadow-accent/40 scale-110",
                                    isPending && "bg-muted border-2 border-border text-muted-foreground"
                                  )}
                                >
                                  {isComplete ? (
                                    <CheckCircle2 className="w-6 h-6" />
                                  ) : (
                                    <Icon className={cn("w-5 h-5", isCurrent && "animate-pulse")} />
                                  )}
                                </div>
                                <div className="text-center mt-3">
                                  <span 
                                    className={cn(
                                      "text-sm font-semibold block",
                                      (isComplete || isCurrent) ? "text-foreground" : "text-muted-foreground"
                                    )}
                                  >
                                    {isFr ? status.labelFr : status.labelEn}
                                  </span>
                                  <span className="text-xs text-muted-foreground mt-0.5 block">
                                    {isFr ? status.description_fr : status.description_en}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Mobile Timeline (Vertical) */}
                      <div className="md:hidden space-y-0">
                        {ORDER_STATUSES.map((status, index) => {
                          const Icon = status.icon;
                          const isComplete = index < currentIndex;
                          const isCurrent = index === currentIndex;
                          const isPending = index > currentIndex;
                          const isLast = index === ORDER_STATUSES.length - 1;
                          
                          return (
                            <div key={status.key} className="flex items-start gap-4 relative">
                              {/* Vertical line */}
                              {!isLast && (
                                <div 
                                  className={cn(
                                    "absolute left-5 top-10 w-0.5 h-12",
                                    isComplete ? "bg-accent" : "bg-border"
                                  )}
                                />
                              )}
                              
                              <div
                                className={cn(
                                  "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all",
                                  isComplete && "bg-accent text-accent-foreground",
                                  isCurrent && "bg-accent text-accent-foreground ring-4 ring-accent/20",
                                  isPending && "bg-muted border-2 border-border text-muted-foreground"
                                )}
                              >
                                {isComplete ? (
                                  <CheckCircle2 className="w-5 h-5" />
                                ) : (
                                  <Icon className={cn("w-4 h-4", isCurrent && "animate-pulse")} />
                                )}
                              </div>
                              
                              <div className="pb-8">
                                <p className={cn(
                                  "font-semibold",
                                  (isComplete || isCurrent) ? "text-foreground" : "text-muted-foreground"
                                )}>
                                  {isFr ? status.labelFr : status.labelEn}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {isFr ? status.description_fr : status.description_en}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Last Update */}
                  <p className="text-sm text-muted-foreground text-center mt-6 flex items-center justify-center gap-2">
                    <Clock className="w-4 h-4" />
                    {isFr ? "Dernière mise à jour: " : "Last updated: "}
                    {format(new Date(orderData.updated_at), "d MMM yyyy, HH:mm", { 
                      locale: isFr ? fr : enCA 
                    })}
                  </p>
                </CardContent>
              </Card>

              {/* Help Card */}
              <Card className="border-0 shadow-lg shadow-black/5 bg-gradient-to-br from-accent/5 via-background to-accent/5">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 rounded-xl bg-accent/10">
                        <HelpCircle className="w-6 h-6 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {isFr ? "Besoin d'aide?" : "Need Help?"}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {isFr 
                            ? "Notre équipe est disponible pour répondre à vos questions." 
                            : "Our team is available to answer your questions."}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 print:hidden">
                      <Button variant="outline" size="sm" asChild className="gap-2">
                        <a href="tel:438-544-2233">
                          <Phone className="w-4 h-4" />
                          438-544-2233
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" asChild className="gap-2">
                        <a href="mailto:support@nivratelecom.ca">
                          <Mail className="w-4 h-4" />
                          support@nivratelecom.ca
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* No results message */}
          {searched && !orderData && !error && !isLoading && (
            <Card className="border-0 shadow-xl shadow-black/5 text-center py-12">
              <CardContent>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-4">
                  <Package className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {isFr ? "Aucune commande trouvée" : "No Order Found"}
                </h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {isFr 
                    ? "Vérifiez le numéro de commande et le courriel, puis réessayez." 
                    : "Please verify your order number and email, then try again."}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Security Footer */}
          <div className="mt-10 text-center print:hidden">
            <div className="inline-flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-full">
              <ShieldCheck className="w-4 h-4 text-accent" />
              {isFr 
                ? "Vos données sont protégées et sécurisées" 
                : "Your data is protected and secure"}
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          [data-print-area], [data-print-area] * {
            visibility: visible;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
};

export default TrackOrder;
