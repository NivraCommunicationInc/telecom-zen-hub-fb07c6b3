/**
 * Client Portal - New Order Wizard
 * 
 * Full checkout flow for clients to order services (Internet, TV, Mobile, Streaming).
 * Uses existing checkout components and submits real orders to the database.
 */

import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  ArrowLeft, 
  ArrowRight, 
  Wifi, 
  Tv, 
  Smartphone, 
  Film,
  Check,
  Loader2,
  ShoppingCart,
  User,
  MapPin,
  CreditCard,
  CheckCircle2
} from "lucide-react";
import { portalSupabase } from "@/integrations/supabase/portalClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckoutLayout,
  CheckoutServiceAddress,
  OrderSummaryCard,
  CheckoutProgress,
  isAddressComplete,
} from "@/components/checkout";

type ServiceType = "internet" | "tv" | "mobile" | "streaming";
type Step = "service" | "plan" | "address" | "confirm";

interface Plan {
  id: string;
  name: string;
  price: number;
  description: string;
  features: string[];
  featured?: boolean;
}

interface ServiceAddress {
  address: string;
  apartment: string;
  city: string;
  province: string;
  postalCode: string;
}

// Plan configurations by service type
const PLANS: Record<ServiceType, Plan[]> = {
  internet: [
    {
      id: "internet-100",
      name: "Internet 100 Mbps",
      price: 55,
      description: "Idéal pour la navigation et le streaming",
      features: ["Téléchargement jusqu'à 100 Mbps", "Données illimitées", "Routeur inclus"],
    },
    {
      id: "internet-500",
      name: "Internet 500 Mbps",
      price: 60,
      description: "Parfait pour les familles",
      features: ["Téléchargement jusqu'à 500 Mbps", "Données illimitées", "Routeur inclus", "Streaming 4K"],
      featured: true,
    },
    {
      id: "internet-940",
      name: "Internet 940 Mbps",
      price: 70,
      description: "Performance maximale",
      features: ["Téléchargement jusqu'à 940 Mbps", "Données illimitées", "Routeur inclus", "Latence ultra-faible"],
    },
  ],
  tv: [
    {
      id: "tv-base",
      name: "TV Base",
      price: 25,
      description: "Chaînes essentielles",
      features: ["30+ chaînes", "Guide TV", "Application mobile"],
    },
    {
      id: "tv-plus",
      name: "TV Plus",
      price: 45,
      description: "Divertissement complet",
      features: ["80+ chaînes", "Sports et films", "Enregistrement cloud"],
      featured: true,
    },
    {
      id: "tv-premium",
      name: "TV Premium",
      price: 65,
      description: "Tout inclus",
      features: ["150+ chaînes", "Tous les sports", "Chaînes premium", "Multi-écrans"],
    },
  ],
  mobile: [
    {
      id: "mobile-40",
      name: "Mobile 5 Go",
      price: 40,
      description: "Usage léger",
      features: ["5 Go de données", "Appels illimités Canada", "Textos illimités"],
    },
    {
      id: "mobile-50",
      name: "Mobile 15 Go",
      price: 50,
      description: "Usage modéré",
      features: ["15 Go de données", "Appels illimités Canada/US", "Textos illimités"],
      featured: true,
    },
    {
      id: "mobile-60",
      name: "Mobile 25 Go",
      price: 60,
      description: "Usage intensif",
      features: ["25 Go de données", "Appels internationaux", "Itinérance incluse"],
    },
  ],
  streaming: [
    {
      id: "streaming-basic",
      name: "Streaming Basic",
      price: 15,
      description: "Un service au choix",
      features: ["Netflix ou Disney+", "HD inclus"],
    },
    {
      id: "streaming-bundle",
      name: "Streaming Bundle",
      price: 35,
      description: "Plusieurs services",
      features: ["Netflix + Disney+ + Crave", "4K inclus"],
      featured: true,
    },
  ],
};

const SERVICE_LABELS: Record<ServiceType, { fr: string; en: string; icon: typeof Wifi }> = {
  internet: { fr: "Internet", en: "Internet", icon: Wifi },
  tv: { fr: "Télévision", en: "Television", icon: Tv },
  mobile: { fr: "Mobile", en: "Mobile", icon: Smartphone },
  streaming: { fr: "Streaming", en: "Streaming", icon: Film },
};

const PortalNewOrder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const { toast } = useToast();
  const isFrench = language === "fr";
  
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState<Step>("service");
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [serviceAddress, setServiceAddress] = useState<ServiceAddress>({
    address: "",
    apartment: "",
    city: "",
    province: "QC",
    postalCode: "",
  });
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  
  // Loading state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await portalSupabase.auth.getSession();
      
      if (!session) {
        navigate("/portal/auth", { 
          state: { redirectTo: "/portal/new-order" },
          replace: true 
        });
        return;
      }
      
      setIsAuthenticated(true);
      setUserId(session.user.id);
      setUserEmail(session.user.email || null);
      
      // Load profile data
      const { data: profile } = await portalSupabase
        .from("profiles")
        .select("first_name, last_name, phone, service_address, service_city, service_postal_code")
        .eq("user_id", session.user.id)
        .single();
      
      if (profile) {
        if (profile.first_name) setFirstName(profile.first_name);
        if (profile.last_name) setLastName(profile.last_name);
        if (profile.phone) setPhone(profile.phone);
        if (profile.service_address) {
          setServiceAddress(prev => ({
            ...prev,
            address: profile.service_address || "",
            city: profile.service_city || "",
            postalCode: profile.service_postal_code || "",
          }));
        }
      }
      
      // Check for pre-selected service from location state
      const state = location.state as any;
      if (state?.serviceType) {
        setSelectedService(state.serviceType as ServiceType);
        setCurrentStep("plan");
      }
    };

    checkSession();
  }, [navigate, location.state]);

  // Calculate totals
  const calculateTotals = () => {
    if (!selectedPlan) return { subtotal: 0, tps: 0, tvq: 0, total: 0 };
    
    const subtotal = selectedPlan.price;
    const tps = subtotal * 0.05;
    const tvq = subtotal * 0.09975;
    const total = subtotal + tps + tvq;
    
    return { subtotal, tps, tvq, total };
  };

  const { subtotal, tps, tvq, total } = calculateTotals();

  // Generate order number
  const generateOrderNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  };

  // Submit order
  const handleSubmitOrder = async () => {
    if (!userId || !selectedPlan || !selectedService) return;
    
    setIsSubmitting(true);
    
    try {
      const newOrderNumber = generateOrderNumber();
      
      const { error } = await portalSupabase.from("orders").insert({
        user_id: userId,
        order_number: newOrderNumber,
        service_type: selectedService,
        status: "pending",
        subtotal: subtotal,
        tps_amount: tps,
        tvq_amount: tvq,
        total_amount: total,
        notes: notes || null,
        client_email: userEmail,
        payment_status: "unpaid",
      });

      if (error) {
        console.error("Order creation error:", error);
        throw error;
      }

      setOrderNumber(newOrderNumber);
      setOrderComplete(true);
      
      toast({
        title: isFrench ? "Commande confirmée!" : "Order confirmed!",
        description: isFrench 
          ? `Votre commande #${newOrderNumber} a été enregistrée.`
          : `Your order #${newOrderNumber} has been placed.`,
      });
    } catch (error: any) {
      console.error("Order submission error:", error);
      toast({
        variant: "destructive",
        title: isFrench ? "Erreur" : "Error",
        description: isFrench 
          ? "Une erreur est survenue. Veuillez réessayer."
          : "An error occurred. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle address change
  const handleAddressChange = (field: keyof ServiceAddress, value: string) => {
    setServiceAddress(prev => ({ ...prev, [field]: value }));
  };

  // Navigation
  const goToStep = (step: Step) => setCurrentStep(step);
  
  const canProceed = () => {
    switch (currentStep) {
      case "service":
        return !!selectedService;
      case "plan":
        return !!selectedPlan;
      case "address":
        return isAddressComplete(serviceAddress) && firstName && lastName && phone;
      case "confirm":
        return acceptedTerms;
      default:
        return false;
    }
  };

  const handleNext = () => {
    switch (currentStep) {
      case "service":
        goToStep("plan");
        break;
      case "plan":
        goToStep("address");
        break;
      case "address":
        goToStep("confirm");
        break;
      case "confirm":
        handleSubmitOrder();
        break;
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case "plan":
        goToStep("service");
        break;
      case "address":
        goToStep("plan");
        break;
      case "confirm":
        goToStep("address");
        break;
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  // Order complete screen
  if (orderComplete && orderNumber) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <CardTitle className="text-2xl">
              {isFrench ? "Commande confirmée!" : "Order Confirmed!"}
            </CardTitle>
            <CardDescription>
              {isFrench 
                ? "Votre commande a été enregistrée avec succès."
                : "Your order has been successfully placed."
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm text-muted-foreground">
                {isFrench ? "Numéro de commande" : "Order Number"}
              </p>
              <p className="text-lg font-mono font-bold">{orderNumber}</p>
            </div>
            
            <p className="text-sm text-muted-foreground">
              {isFrench 
                ? "Vous recevrez un courriel de confirmation sous peu."
                : "You will receive a confirmation email shortly."
              }
            </p>
            
            <div className="flex flex-col gap-2 pt-4">
              <Link to="/portal/orders">
                <Button className="w-full">
                  {isFrench ? "Voir mes commandes" : "View My Orders"}
                </Button>
              </Link>
              <Link to="/portal/dashboard">
                <Button variant="outline" className="w-full">
                  {isFrench ? "Retour au tableau de bord" : "Back to Dashboard"}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get steps for progress indicator
  const steps = [
    { id: "service", label: isFrench ? "Service" : "Service", icon: ShoppingCart },
    { id: "plan", label: isFrench ? "Forfait" : "Plan", icon: CreditCard },
    { id: "address", label: isFrench ? "Adresse" : "Address", icon: MapPin },
    { id: "confirm", label: isFrench ? "Confirmer" : "Confirm", icon: Check },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => currentStep === "service" ? navigate("/portal/dashboard") : handleBack()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {isFrench ? "Retour" : "Back"}
            </Button>
            
            {/* Progress */}
            <div className="hidden md:flex items-center gap-2">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index < currentStepIndex 
                      ? "bg-primary text-primary-foreground" 
                      : index === currentStepIndex 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted text-muted-foreground"
                  }`}>
                    {index < currentStepIndex ? <Check className="w-4 h-4" /> : index + 1}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`w-8 h-0.5 mx-1 ${index < currentStepIndex ? "bg-primary" : "bg-muted"}`} />
                  )}
                </div>
              ))}
            </div>
            
            <div className="text-sm text-muted-foreground">
              {isFrench ? "Étape" : "Step"} {currentStepIndex + 1}/{steps.length}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Form */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Step 1: Service Selection */}
            {currentStep === "service" && (
              <Card>
                <CardHeader>
                  <CardTitle>{isFrench ? "Choisir un service" : "Choose a Service"}</CardTitle>
                  <CardDescription>
                    {isFrench 
                      ? "Sélectionnez le type de service que vous souhaitez commander"
                      : "Select the type of service you want to order"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {(Object.keys(SERVICE_LABELS) as ServiceType[]).map((service) => {
                      const { fr, en, icon: Icon } = SERVICE_LABELS[service];
                      return (
                        <button
                          key={service}
                          onClick={() => setSelectedService(service)}
                          className={`p-4 rounded-lg border-2 transition-all text-left ${
                            selectedService === service
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                              selectedService === service ? "bg-primary/10" : "bg-muted"
                            }`}>
                              <Icon className={`w-6 h-6 ${selectedService === service ? "text-primary" : "text-muted-foreground"}`} />
                            </div>
                            <div>
                              <p className="font-medium">{isFrench ? fr : en}</p>
                              <p className="text-sm text-muted-foreground">
                                {isFrench ? "Voir les forfaits" : "View plans"}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Plan Selection */}
            {currentStep === "plan" && selectedService && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {isFrench ? "Choisir un forfait" : "Choose a Plan"}
                  </CardTitle>
                  <CardDescription>
                    {isFrench 
                      ? `Forfaits ${SERVICE_LABELS[selectedService].fr} disponibles`
                      : `Available ${SERVICE_LABELS[selectedService].en} plans`
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={selectedPlan?.id || ""}
                    onValueChange={(value) => {
                      const plan = PLANS[selectedService].find(p => p.id === value);
                      setSelectedPlan(plan || null);
                    }}
                  >
                    <div className="space-y-4">
                      {PLANS[selectedService].map((plan) => (
                        <label
                          key={plan.id}
                          className={`block p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            selectedPlan?.id === plan.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <RadioGroupItem value={plan.id} className="mt-1" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-semibold">{plan.name}</p>
                                  {plan.featured && (
                                    <Badge variant="default" className="text-xs">
                                      {isFrench ? "Populaire" : "Popular"}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-lg font-bold text-primary">
                                  ${plan.price}<span className="text-sm font-normal text-muted-foreground">/mois</span>
                                </p>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">{plan.description}</p>
                              <ul className="space-y-1">
                                {plan.features.map((feature, idx) => (
                                  <li key={idx} className="text-sm flex items-center gap-2">
                                    <Check className="w-4 h-4 text-emerald-500" />
                                    {feature}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>
            )}

            {/* Step 3: Address & Contact */}
            {currentStep === "address" && (
              <>
                <CheckoutServiceAddress
                  address={serviceAddress}
                  onChange={handleAddressChange}
                />
                
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5 text-primary" />
                      {isFrench ? "Informations de contact" : "Contact Information"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">
                          {isFrench ? "Prénom" : "First Name"} <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="firstName"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Jean"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">
                          {isFrench ? "Nom" : "Last Name"} <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="lastName"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Tremblay"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">
                        {isFrench ? "Téléphone" : "Phone"} <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="514-555-1234"
                      />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Step 4: Confirmation */}
            {currentStep === "confirm" && selectedPlan && selectedService && (
              <Card>
                <CardHeader>
                  <CardTitle>{isFrench ? "Confirmer votre commande" : "Confirm Your Order"}</CardTitle>
                  <CardDescription>
                    {isFrench 
                      ? "Vérifiez les détails de votre commande"
                      : "Review your order details"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Order Summary */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-start p-4 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">{selectedPlan.name}</p>
                        <p className="text-sm text-muted-foreground">{SERVICE_LABELS[selectedService].fr}</p>
                      </div>
                      <p className="font-bold">${selectedPlan.price}/mois</p>
                    </div>
                    
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium mb-1">{isFrench ? "Adresse de service" : "Service Address"}</p>
                      <p className="text-sm text-muted-foreground">
                        {serviceAddress.address}
                        {serviceAddress.apartment && `, ${serviceAddress.apartment}`}
                        <br />
                        {serviceAddress.city}, {serviceAddress.province} {serviceAddress.postalCode}
                      </p>
                    </div>
                  </div>
                  
                  {/* Notes */}
                  <div className="space-y-2">
                    <Label htmlFor="notes">
                      {isFrench ? "Notes (optionnel)" : "Notes (optional)"}
                    </Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={isFrench 
                        ? "Instructions spéciales pour la livraison ou l'installation..."
                        : "Special instructions for delivery or installation..."
                      }
                      rows={3}
                    />
                  </div>
                  
                  {/* Terms */}
                  <div className="flex items-start gap-3 p-4 border rounded-lg">
                    <Checkbox
                      id="terms"
                      checked={acceptedTerms}
                      onCheckedChange={(checked) => setAcceptedTerms(!!checked)}
                    />
                    <label htmlFor="terms" className="text-sm cursor-pointer">
                      {isFrench 
                        ? "J'accepte les conditions de service et la politique de confidentialité de Nivra."
                        : "I accept Nivra's terms of service and privacy policy."
                      }
                    </label>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              {selectedPlan ? (
                <OrderSummaryCard
                  isFrench={isFrench}
                  monthlyItems={[
                    {
                      label: selectedPlan.name,
                      amount: selectedPlan.price,
                      description: selectedService ? SERVICE_LABELS[selectedService].fr : "",
                    }
                  ]}
                  tpsAmount={tps}
                  tvqAmount={tvq}
                  totalDueNow={total}
                  monthlyTotal={selectedPlan.price}
                >
                  <div className="pt-4">
                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={handleNext}
                      disabled={!canProceed() || isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {isFrench ? "Traitement..." : "Processing..."}
                        </>
                      ) : currentStep === "confirm" ? (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          {isFrench ? "Confirmer la commande" : "Confirm Order"}
                        </>
                      ) : (
                        <>
                          {isFrench ? "Continuer" : "Continue"}
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </OrderSummaryCard>
              ) : (
                <Card className="bg-muted/50">
                  <CardContent className="py-8 text-center">
                    <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">
                      {isFrench 
                        ? "Sélectionnez un forfait pour voir le résumé"
                        : "Select a plan to see the summary"
                      }
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PortalNewOrder;
