import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Package, Search, AlertCircle, CheckCircle, Clock, Truck, Settings, Calendar, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr, enCA } from "date-fns/locale";
import SEOHead from "@/components/SEOHead";

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
  { key: "pending", labelFr: "Reçu", labelEn: "Received", icon: Clock },
  { key: "verification", labelFr: "En traitement", labelEn: "Processing", icon: Settings },
  { key: "shipped", labelFr: "Expédié/Planifié", labelEn: "Shipped/Scheduled", icon: Truck },
  { key: "completed", labelFr: "Livré/Installé", labelEn: "Delivered/Installed", icon: Package },
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
    verification: { fr: "En vérification", en: "Verification" },
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

const TrackOrder = () => {
  const { language } = useLanguage();
  const isFr = language === "fr";
  
  const [orderNumber, setOrderNumber] = useState("");
  const [lastName, setLastName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOrderData(null);
    setSearched(true);

    if (!orderNumber.trim() || !lastName.trim()) {
      setError(isFr 
        ? "Veuillez entrer le numéro de commande et votre nom de famille." 
        : "Please enter both order number and your last name.");
      return;
    }

    // Normalize last name - trim and lowercase for comparison
    const normalizedLastName = lastName.trim().toLowerCase();

    setIsLoading(true);

    try {
      // Query order by order_number and verify last name matches
      const { data, error: queryError } = await supabase
        .from("orders")
        .select("id, order_number, status, created_at, updated_at, service_type, shipping_address, shipping_city, total_amount, client_last_name")
        .eq("order_number", orderNumber.trim().toUpperCase())
        .single();

      if (queryError || !data) {
        setError(isFr 
          ? "Aucune commande trouvée avec ce numéro." 
          : "No order found with this number.");
        setIsLoading(false);
        return;
      }

      // Verify last name matches (case-insensitive)
      const orderLastName = (data.client_last_name || "").trim().toLowerCase();
      if (orderLastName !== normalizedLastName) {
        setError(isFr 
          ? "Le nom de famille ne correspond pas à cette commande." 
          : "The last name does not match this order.");
        setIsLoading(false);
        return;
      }

      setOrderData({
        id: data.id,
        order_number: data.order_number || "",
        status: data.status,
        created_at: data.created_at,
        updated_at: data.updated_at,
        service_type: data.service_type,
        shipping_address: data.shipping_address,
        shipping_city: data.shipping_city,
        total_amount: data.total_amount,
      });
    } catch (err) {
      console.error("Error fetching order:", err);
      setError(isFr 
        ? "Une erreur est survenue. Veuillez réessayer." 
        : "An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const currentIndex = orderData ? getStatusIndex(orderData.status) : 0;
  const isCancelled = orderData?.status === "cancel" || orderData?.status === "cancelled";

  return (
    <>
      <SEOHead 
        title={isFr ? "Suivi de commande | Nivra Telecom" : "Track Order | Nivra Telecom"}
        description={isFr 
          ? "Suivez l'état de votre commande Nivra Telecom en temps réel." 
          : "Track your Nivra Telecom order status in real time."}
      />
      
      <div className="min-h-[80vh] bg-background py-12 px-4">
        <div className="container mx-auto max-w-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 mb-4">
              <Package className="w-8 h-8 text-accent" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {isFr ? "Suivi de commande" : "Track Your Order"}
            </h1>
            <p className="text-muted-foreground">
              {isFr 
                ? "Entrez votre numéro de commande et nom de famille pour voir l'état de votre commande." 
                : "Enter your order number and last name to check your order status."}
            </p>
          </div>

          {/* Search Form */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg">
                {isFr ? "Rechercher votre commande" : "Search Your Order"}
              </CardTitle>
              <CardDescription>
                {isFr 
                  ? "Le numéro de commande se trouve dans votre email de confirmation." 
                  : "The order number can be found in your confirmation email."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="orderNumber">
                      {isFr ? "Numéro de commande" : "Order Number"}
                    </Label>
                    <Input
                      id="orderNumber"
                      placeholder={isFr ? "Ex: ORD-2026-1234" : "e.g., ORD-2026-1234"}
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      className="uppercase"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">
                      {isFr ? "Nom de famille" : "Last Name"}
                    </Label>
                    <Input
                      id="lastName"
                      placeholder={isFr ? "Ex: Tremblay" : "e.g., Smith"}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  <Search className="w-4 h-4 mr-2" />
                  {isLoading 
                    ? (isFr ? "Recherche..." : "Searching...") 
                    : (isFr ? "Rechercher" : "Search")}
                </Button>
              </form>

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Order Results */}
          {orderData && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">
                      {isFr ? "Commande" : "Order"} {orderData.order_number}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(orderData.created_at), "d MMMM yyyy", { 
                        locale: isFr ? fr : enCA 
                      })}
                    </CardDescription>
                  </div>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-sm font-medium",
                    isCancelled 
                      ? "bg-destructive/10 text-destructive" 
                      : currentIndex === 3 
                        ? "bg-green-500/10 text-green-600" 
                        : "bg-accent/10 text-accent"
                  )}>
                    {getStatusLabel(orderData.status, isFr)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Order Details */}
                {(orderData.service_type || orderData.shipping_address) && (
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    {orderData.service_type && (
                      <div className="flex items-center gap-2 text-sm">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{isFr ? "Service:" : "Service:"}</span>
                        <span className="font-medium capitalize">{orderData.service_type}</span>
                      </div>
                    )}
                    {orderData.shipping_address && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{isFr ? "Adresse:" : "Address:"}</span>
                        <span className="font-medium">
                          {orderData.shipping_address}
                          {orderData.shipping_city && `, ${orderData.shipping_city}`}
                        </span>
                      </div>
                    )}
                    {orderData.total_amount && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">{isFr ? "Total:" : "Total:"}</span>
                        <span className="font-medium">${orderData.total_amount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Status Timeline */}
                {isCancelled ? (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-center">
                    <p className="text-destructive font-medium">
                      {isFr ? "Commande annulée" : "Order Cancelled"}
                    </p>
                  </div>
                ) : (
                  <div className="w-full py-4">
                    <div className="flex items-center justify-between relative">
                      {/* Progress line */}
                      <div className="absolute top-4 left-0 right-0 h-0.5 bg-border" />
                      <div 
                        className="absolute top-4 left-0 h-0.5 bg-accent transition-all duration-500"
                        style={{ width: `${(currentIndex / (ORDER_STATUSES.length - 1)) * 100}%` }}
                      />
                      
                      {ORDER_STATUSES.map((status, index) => {
                        const Icon = status.icon;
                        const isCompleted = index <= currentIndex;
                        const isCurrent = index === currentIndex;
                        
                        return (
                          <div key={status.key} className="flex flex-col items-center relative z-10">
                            <div
                              className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                                isCompleted 
                                  ? "bg-accent text-accent-foreground" 
                                  : "bg-muted border border-border text-muted-foreground",
                                isCurrent && "ring-2 ring-accent ring-offset-2 ring-offset-background"
                              )}
                            >
                              {isCompleted && index < currentIndex ? (
                                <CheckCircle className="w-4 h-4" />
                              ) : (
                                <Icon className="w-4 h-4" />
                              )}
                            </div>
                            <span 
                              className={cn(
                                "text-xs mt-2 text-center max-w-[80px]",
                                isCompleted ? "text-foreground font-medium" : "text-muted-foreground"
                              )}
                            >
                              {isFr ? status.labelFr : status.labelEn}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Last Update */}
                <p className="text-xs text-muted-foreground text-center">
                  {isFr ? "Dernière mise à jour:" : "Last updated:"}{" "}
                  {format(new Date(orderData.updated_at), "d MMM yyyy, HH:mm", { 
                    locale: isFr ? fr : enCA 
                  })}
                </p>

                {/* Help Text */}
                <div className="text-center pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    {isFr 
                      ? "Des questions? Contactez-nous au " 
                      : "Questions? Contact us at "}
                    <a href="tel:438-544-2233" className="text-accent hover:underline font-medium">
                      438-544-2233
                    </a>
                    {isFr ? " ou par email à " : " or email "}
                    <a href="mailto:support@nivratelecom.ca" className="text-accent hover:underline font-medium">
                      support@nivratelecom.ca
                    </a>
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* No results message */}
          {searched && !orderData && !error && !isLoading && (
            <Card className="text-center py-8">
              <CardContent>
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {isFr 
                    ? "Aucune commande trouvée. Vérifiez les informations entrées." 
                    : "No order found. Please verify the information entered."}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
};

export default TrackOrder;
