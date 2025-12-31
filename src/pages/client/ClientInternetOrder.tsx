import { useState, useCallback, useEffect } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Wifi, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  MapPin, 
  AlertCircle, 
  User, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  FileText, 
  Shield, 
  Zap, 
  Star, 
  Router, 
  Package, 
  Info,
  XCircle,
  Search,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";

// Internet plan configurations
const INTERNET_PLANS = [
  {
    id: "internet-100",
    name: "Internet 100 Mbps",
    speed: "100 Mbps",
    price: 55,
    badge: "OFFRE POPULAIRE",
    badgeEn: "POPULAR OFFER",
    color: "cyan",
    features: {
      fr: ["Téléchargement: 100 Mbps", "Téléversement: 10 Mbps", "Idéal pour 2-3 appareils", "Streaming HD"],
      en: ["Download: 100 Mbps", "Upload: 10 Mbps", "Ideal for 2-3 devices", "HD Streaming"]
    }
  },
  {
    id: "internet-500",
    name: "Internet 500 Mbps",
    speed: "500 Mbps",
    price: 60,
    badge: "MEILLEUR VENDEUR",
    badgeEn: "BEST SELLER",
    color: "emerald",
    features: {
      fr: ["Téléchargement: 500 Mbps", "Téléversement: 20 Mbps", "Idéal pour 5-8 appareils", "Streaming 4K, Gaming"],
      en: ["Download: 500 Mbps", "Upload: 20 Mbps", "Ideal for 5-8 devices", "4K Streaming, Gaming"]
    },
    recommended: true
  },
  {
    id: "internet-940",
    name: "Internet 940 Mbps",
    speed: "940 Mbps",
    price: 70,
    badge: "GIGA SPEED",
    badgeEn: "GIGA SPEED",
    color: "purple",
    features: {
      fr: ["Téléchargement: 940 Mbps", "Téléversement: 50 Mbps", "Appareils illimités", "Streaming 4K simultané, Télétravail"],
      en: ["Download: 940 Mbps", "Upload: 50 Mbps", "Unlimited devices", "Simultaneous 4K Streaming, Remote Work"]
    }
  }
];

// Equipment details
const ROUTER_DETAILS = {
  name: "Nivra Born Wifi",
  price: 60,
  warranty: {
    fr: "Garantie 1 an couvrant les défauts de fabrication",
    en: "1-year warranty covering manufacturer defects"
  }
};

// Quebec postal code pattern (starts with G, H, J)
const QUEBEC_POSTAL_PATTERN = /^[GHJ]\d[A-Z]\s?\d[A-Z]\d$/i;

interface AddressValidation {
  isValid: boolean;
  isQuebec: boolean;
  formattedAddress: string;
  city: string;
  province: string;
  postalCode: string;
}

const ClientInternetOrder = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const isFrench = language === 'fr';

  // Step management
  const [step, setStep] = useState(1);
  
  // Address validation state
  const [address, setAddress] = useState("");
  const [addressValidation, setAddressValidation] = useState<AddressValidation | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [addressBlocked, setAddressBlocked] = useState(false);
  
  // Plan selection
  const [selectedPlan, setSelectedPlan] = useState<typeof INTERNET_PLANS[0] | null>(null);
  
  // Order details
  const [notes, setNotes] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [installationCredit, setInstallationCredit] = useState(0);
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [routerAcknowledged, setRouterAcknowledged] = useState(false);
  
  // Installation scheduling
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  
  // Order result
  const [createdOrder, setCreatedOrder] = useState<any>(null);

  // Fetch client profile
  const { data: profile } = useQuery({
    queryKey: ["client-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Validate Quebec address
  const validateAddress = useCallback(() => {
    if (!address.trim()) {
      toast.error(isFrench ? "Veuillez entrer une adresse" : "Please enter an address");
      return;
    }

    setIsValidating(true);
    setAddressBlocked(false);

    // Check for Quebec postal code pattern
    const addressUpper = address.toUpperCase();
    const postalCodeMatch = addressUpper.match(/[A-Z]\d[A-Z]\s?\d[A-Z]\d/);
    
    setTimeout(() => {
      if (postalCodeMatch) {
        const postalCode = postalCodeMatch[0];
        const isQuebecPostal = QUEBEC_POSTAL_PATTERN.test(postalCode);
        
        if (isQuebecPostal) {
          setAddressValidation({
            isValid: true,
            isQuebec: true,
            formattedAddress: address,
            city: isFrench ? "Ville au Québec" : "City in Quebec",
            province: "QC",
            postalCode: postalCode
          });
          setAddressBlocked(false);
          toast.success(isFrench ? "Adresse validée! Service disponible." : "Address validated! Service available.");
        } else {
          setAddressValidation({
            isValid: true,
            isQuebec: false,
            formattedAddress: address,
            city: "",
            province: "",
            postalCode: postalCode
          });
          setAddressBlocked(true);
          toast.error(isFrench ? "Désolé, nos services Internet sont disponibles uniquement au Québec." : "Sorry, our Internet services are only available in Quebec.");
        }
      } else {
        // Check for Quebec cities or keywords
        const quebecKeywords = ['quebec', 'québec', 'montreal', 'montréal', 'laval', 'gatineau', 'longueuil', 'sherbrooke', 'saguenay', 'trois-rivières', 'lévis', 'terrebonne', 'qc'];
        const hasQuebecKeyword = quebecKeywords.some(kw => addressUpper.toLowerCase().includes(kw.toLowerCase()));
        
        if (hasQuebecKeyword) {
          setAddressValidation({
            isValid: true,
            isQuebec: true,
            formattedAddress: address,
            city: isFrench ? "Ville au Québec" : "City in Quebec",
            province: "QC",
            postalCode: ""
          });
          setAddressBlocked(false);
          toast.success(isFrench ? "Adresse validée! Service disponible." : "Address validated! Service available.");
        } else {
          setAddressValidation({
            isValid: false,
            isQuebec: false,
            formattedAddress: address,
            city: "",
            province: "",
            postalCode: ""
          });
          setAddressBlocked(true);
          toast.error(isFrench ? "Veuillez entrer une adresse au Québec avec un code postal valide (ex: H2X 1Y4)." : "Please enter a Quebec address with a valid postal code (e.g., H2X 1Y4).");
        }
      }
      setIsValidating(false);
    }, 1000);
  }, [address, isFrench]);

  // Apply discount code
  const applyDiscountCode = () => {
    const code = discountCode.toLowerCase();
    if (code === "install50" || code === "freeinstall") {
      setInstallationCredit(50);
      toast.success(isFrench ? "Code promo appliqué! Installation gratuite." : "Promo code applied! Free installation.");
    } else if (code === "install25") {
      setInstallationCredit(25);
      toast.success(isFrench ? "Code promo appliqué! 25$ de rabais sur l'installation." : "Promo code applied! $25 off installation.");
    } else if (code) {
      toast.error(isFrench ? "Code promo invalide" : "Invalid promo code");
    }
  };

  // Calculate totals
  const planPrice = selectedPlan?.price || 0;
  const routerFee = ROUTER_DETAILS.price;
  const deliveryFee = 30;
  const activationFee = 25;
  const installationFee = Math.max(0, 50 - installationCredit);
  const monthlySubtotal = planPrice;
  const oneTimeTotal = routerFee + deliveryFee + activationFee + installationFee;
  const tpsAmount = Math.round((oneTimeTotal) * 0.05 * 100) / 100;
  const tvqAmount = Math.round((oneTimeTotal) * 0.09975 * 100) / 100;
  const totalDueNow = oneTimeTotal + tpsAmount + tvqAmount;

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedPlan) throw new Error("Not authenticated or no plan selected");

      const { data, error } = await supabase.from("orders").insert({
        user_id: user.id,
        client_email: profile?.email || user.email,
        service_type: selectedPlan.name,
        category: "Internet",
        subtotal: planPrice,
        delivery_fee: deliveryFee,
        activation_fee: activationFee,
        installation_fee: 50,
        installation_credit: installationCredit,
        discount_code: discountCode || null,
        status: "pending",
        created_by: "client",
        notes: `${isFrench ? "Adresse d'installation" : "Installation address"}: ${address}\n${notes || ""}`.trim(),
        internal_notes: `Router: Nivra Born Wifi ($60 paid upfront)`,
      }).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["client-orders-all"] });
      setCreatedOrder(data);
      setStep(5);
    },
    onError: (error) => {
      console.error("Order creation error:", error);
      toast.error(isFrench ? "Erreur lors de la soumission de la commande" : "Error submitting order");
    },
  });

  const handleSubmit = () => {
    if (!selectedPlan) {
      toast.error(isFrench ? "Veuillez sélectionner un forfait" : "Please select a plan");
      return;
    }
    if (!identityConfirmed) {
      toast.error(isFrench ? "Veuillez confirmer que vous fournirez une pièce d'identité" : "Please confirm you will provide a government ID");
      return;
    }
    if (!routerAcknowledged) {
      toast.error(isFrench ? "Veuillez confirmer l'achat du routeur" : "Please confirm router purchase");
      return;
    }
    if (!selectedDate || !selectedTime) {
      toast.error(isFrench ? "Veuillez sélectionner une date et heure d'installation" : "Please select an installation date and time");
      return;
    }
    if (!termsAccepted) {
      toast.error(isFrench ? "Veuillez accepter les termes et conditions" : "Please accept the terms and conditions");
      return;
    }
    createOrderMutation.mutate();
  };

  // Generate installation date options
  const getInstallationDates = () => {
    const dates = [];
    for (let i = 2; i <= 14; i++) {
      const date = addDays(new Date(), i);
      if (date.getDay() !== 0) { // Exclude Sundays
        dates.push(date);
      }
    }
    return dates;
  };

  const timeSlots = [
    { value: "8h - 12h", label: isFrench ? "8h - 12h (Matin)" : "8AM - 12PM (Morning)" },
    { value: "12h - 17h", label: isFrench ? "12h - 17h (Après-midi)" : "12PM - 5PM (Afternoon)" },
  ];

  const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
    cyan: { bg: "bg-cyan-500/15", text: "text-cyan-500", border: "border-cyan-500" },
    emerald: { bg: "bg-emerald-500/15", text: "text-emerald-500", border: "border-emerald-500" },
    purple: { bg: "bg-purple-500/15", text: "text-purple-500", border: "border-purple-500" },
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
            <Wifi className="w-8 h-8 text-cyan-500" />
            {isFrench ? "Commander Internet" : "Order Internet"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isFrench ? "Service Internet haute vitesse au Québec" : "High-speed Internet service in Quebec"}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 sm:gap-4">
          {[
            { num: 1, label: isFrench ? "Adresse" : "Address" },
            { num: 2, label: isFrench ? "Forfait" : "Plan" },
            { num: 3, label: isFrench ? "Équipement" : "Equipment" },
            { num: 4, label: isFrench ? "Confirmation" : "Confirmation" },
            { num: 5, label: isFrench ? "Terminé" : "Complete" },
          ].map((s, i, arr) => (
            <div key={s.num} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-2 ${step >= s.num ? "text-cyan-500" : "text-muted-foreground"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step > s.num ? "bg-emerald-500 text-white" : step === s.num ? "bg-cyan-500 text-white" : "bg-muted"
                }`}>
                  {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                </div>
                <span className="text-xs font-medium hidden md:inline">{s.label}</span>
              </div>
              {i < arr.length - 1 && (
                <div className="flex-1 h-0.5 bg-muted">
                  <div className={`h-full transition-all ${step > s.num ? "bg-emerald-500 w-full" : step === s.num ? "bg-cyan-500 w-1/2" : "w-0"}`} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Address Validation */}
        {step === 1 && (
          <div className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-cyan-500" />
                  {isFrench ? "Vérification de disponibilité" : "Service Availability Check"}
                </CardTitle>
                <CardDescription>
                  {isFrench 
                    ? "Entrez votre adresse d'installation pour vérifier si nos services sont disponibles dans votre région."
                    : "Enter your installation address to check if our services are available in your area."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">
                    {isFrench ? "Adresse complète (incluant le code postal)" : "Full address (including postal code)"}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="address"
                      placeholder={isFrench ? "Ex: 123 rue Exemple, Montréal, QC H2X 1Y4" : "E.g., 123 Example St, Montreal, QC H2X 1Y4"}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      onClick={validateAddress} 
                      disabled={isValidating || !address.trim()}
                      variant="hero"
                    >
                      {isValidating ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Search className="w-4 h-4 mr-2" />
                          {isFrench ? "Vérifier" : "Check"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Quebec Only Notice */}
                <Card className="bg-amber-500/10 border-amber-500/30">
                  <CardContent className="py-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {isFrench ? "Service disponible au Québec seulement" : "Service available in Quebec only"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {isFrench 
                          ? "Nos services Internet sont exclusivement disponibles pour les adresses au Québec."
                          : "Our Internet services are exclusively available for Quebec addresses."}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Validation Result */}
                {addressValidation && addressValidation.isQuebec && !addressBlocked && (
                  <Card className="bg-emerald-500/10 border-emerald-500/30">
                    <CardContent className="py-4 flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {isFrench ? "Service disponible!" : "Service available!"}
                        </p>
                        <p className="text-sm text-muted-foreground">{addressValidation.formattedAddress}</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Blocked - Not Quebec */}
                {addressBlocked && (
                  <Card className="bg-destructive/10 border-destructive/30">
                    <CardContent className="py-4 flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {isFrench ? "Service non disponible" : "Service not available"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {isFrench 
                            ? "Désolé, nos services Internet ne sont pas disponibles à cette adresse. Nous desservons uniquement le Québec."
                            : "Sorry, our Internet services are not available at this address. We only serve Quebec."}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>

            {/* Continue Button */}
            {addressValidation?.isQuebec && !addressBlocked && (
              <div className="flex justify-end">
                <Button variant="hero" size="lg" onClick={() => setStep(2)}>
                  {isFrench ? "Continuer" : "Continue"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Plan Selection */}
        {step === 2 && (
          <div className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-cyan-500" />
                  {isFrench ? "Choisissez votre forfait Internet" : "Choose your Internet plan"}
                </CardTitle>
                <CardDescription>
                  {isFrench 
                    ? "Tous les forfaits incluent une connexion coaxiale haute vitesse fiable."
                    : "All plans include reliable high-speed coaxial connection."}
                </CardDescription>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {INTERNET_PLANS.map((plan) => {
                const colors = colorClasses[plan.color];
                const isSelected = selectedPlan?.id === plan.id;
                const features = isFrench ? plan.features.fr : plan.features.en;
                const badge = isFrench ? plan.badge : plan.badgeEn;

                return (
                  <Card
                    key={plan.id}
                    className={`cursor-pointer transition-all hover:shadow-lg relative overflow-hidden ${
                      isSelected
                        ? `${colors.border} bg-card shadow-lg`
                        : "border-border hover:border-cyan-500/50"
                    } ${plan.recommended ? "ring-2 ring-emerald-500" : ""}`}
                    onClick={() => setSelectedPlan(plan)}
                  >
                    {/* Badge */}
                    <div className={`absolute top-0 right-0 ${colors.bg} ${colors.text} px-3 py-1 text-xs font-bold rounded-bl-lg`}>
                      {badge}
                    </div>

                    {plan.recommended && (
                      <div className="absolute top-0 left-0 bg-emerald-500 text-white px-3 py-1 text-xs font-bold rounded-br-lg flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        {isFrench ? "RECOMMANDÉ" : "RECOMMENDED"}
                      </div>
                    )}

                    <CardContent className="pt-10 pb-6">
                      <div className="text-center mb-6">
                        <div className={`w-16 h-16 rounded-full ${colors.bg} flex items-center justify-center mx-auto mb-4`}>
                          <Wifi className={`w-8 h-8 ${colors.text}`} />
                        </div>
                        <h3 className="text-xl font-bold text-foreground">{plan.speed}</h3>
                        <p className="text-3xl font-bold text-foreground mt-2">
                          ${plan.price}
                          <span className="text-sm font-normal text-muted-foreground">/mois</span>
                        </p>
                      </div>

                      <Separator className="my-4" />

                      <ul className="space-y-3">
                        {features.map((feature, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm">
                            <Check className={`w-4 h-4 ${colors.text} flex-shrink-0`} />
                            <span className="text-muted-foreground">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-6">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto ${
                          isSelected ? `${colors.bg} ${colors.text}` : "border-2 border-muted-foreground/30"
                        }`}>
                          {isSelected && <Check className="w-4 h-4" />}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {isFrench ? "Retour" : "Back"}
              </Button>
              <Button 
                variant="hero" 
                size="lg" 
                onClick={() => setStep(3)}
                disabled={!selectedPlan}
              >
                {isFrench ? "Continuer" : "Continue"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Equipment & Verification */}
        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Router Information */}
              <Card className="bg-card border-cyan-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Router className="w-5 h-5 text-cyan-500" />
                    {isFrench ? "Équipement requis" : "Required Equipment"}
                  </CardTitle>
                  <CardDescription>
                    {isFrench 
                      ? "Le routeur doit être acheté avant l'installation."
                      : "The router must be purchased before installation."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-4 p-4 bg-accent/30 rounded-lg">
                    <div className="w-16 h-16 bg-cyan-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Router className="w-8 h-8 text-cyan-500" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">{ROUTER_DETAILS.name}</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        {isFrench ? ROUTER_DETAILS.warranty.fr : ROUTER_DETAILS.warranty.en}
                      </p>
                      <Badge className="bg-cyan-500/20 text-cyan-500 border-0">
                        ${ROUTER_DETAILS.price} ({isFrench ? "frais unique" : "one-time fee"})
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                    <Shield className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {isFrench ? "Garantie incluse" : "Warranty included"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {isFrench 
                          ? "Garantie de 1 an couvrant les défauts de fabrication uniquement."
                          : "1-year warranty covering manufacturer defects only."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="router-acknowledged"
                      checked={routerAcknowledged}
                      onCheckedChange={(checked) => setRouterAcknowledged(checked as boolean)}
                    />
                    <Label htmlFor="router-acknowledged" className="text-sm text-muted-foreground cursor-pointer">
                      {isFrench 
                        ? `Je comprends que je dois payer ${ROUTER_DETAILS.price}$ pour le routeur ${ROUTER_DETAILS.name} avant l'installation.`
                        : `I understand that I must pay $${ROUTER_DETAILS.price} for the ${ROUTER_DETAILS.name} router before installation.`}
                    </Label>
                  </div>
                </CardContent>
              </Card>

              {/* Identity Verification */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-cyan-500" />
                    {isFrench ? "Vérification d'identité" : "Identity Verification"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Card className="bg-amber-500/10 border-amber-500/30">
                    <CardContent className="py-4 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {isFrench ? "Pièce d'identité gouvernementale requise" : "Government ID required"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {isFrench 
                            ? "Une pièce d'identité avec photo est requise pour valider toute commande."
                            : "A photo ID is required to validate any order."}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="identity-confirmed"
                      checked={identityConfirmed}
                      onCheckedChange={(checked) => setIdentityConfirmed(checked as boolean)}
                    />
                    <Label htmlFor="identity-confirmed" className="text-sm text-muted-foreground cursor-pointer">
                      {isFrench 
                        ? "Je confirme que je fournirai une pièce d'identité gouvernementale valide avec photo."
                        : "I confirm that I will provide a valid government-issued photo ID."}
                    </Label>
                  </div>
                </CardContent>
              </Card>

              {/* Installation Scheduling */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-cyan-500" />
                    {isFrench ? "Planifier l'installation" : "Schedule Installation"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{isFrench ? "Date d'installation" : "Installation date"}</Label>
                      <select
                        className="w-full p-3 bg-background border border-border rounded-lg text-foreground"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                      >
                        <option value="">{isFrench ? "Sélectionner une date" : "Select a date"}</option>
                        {getInstallationDates().map((date) => (
                          <option key={date.toISOString()} value={date.toISOString()}>
                            {format(date, "EEEE d MMMM yyyy", { locale: isFrench ? fr : undefined })}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>{isFrench ? "Plage horaire" : "Time slot"}</Label>
                      <select
                        className="w-full p-3 bg-background border border-border rounded-lg text-foreground"
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                      >
                        <option value="">{isFrench ? "Sélectionner une plage" : "Select a time"}</option>
                        {timeSlots.map((slot) => (
                          <option key={slot.value} value={slot.value}>{slot.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Discount Code */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-cyan-500" />
                    {isFrench ? "Code promotionnel" : "Promo Code"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      placeholder={isFrench ? "Entrer le code" : "Enter code"}
                      value={discountCode}
                      onChange={(e) => setDiscountCode(e.target.value)}
                    />
                    <Button onClick={applyDiscountCode} variant="outline">
                      {isFrench ? "Appliquer" : "Apply"}
                    </Button>
                  </div>
                  {installationCredit > 0 && (
                    <p className="text-sm text-emerald-500 mt-2">
                      ✓ {isFrench ? `Rabais de ${installationCredit}$ sur l'installation appliqué!` : `$${installationCredit} installation discount applied!`}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Notes */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-cyan-500" />
                    {isFrench ? "Notes additionnelles" : "Additional Notes"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder={isFrench ? "Instructions spéciales, accès, etc." : "Special instructions, access, etc."}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Order Summary Sidebar */}
            <div className="lg:col-span-1">
              <Card className="bg-card border-cyan-500/30 sticky top-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-cyan-500" />
                    {isFrench ? "Résumé de la commande" : "Order Summary"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Address */}
                  <div className="p-3 bg-accent/30 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">{isFrench ? "Adresse d'installation" : "Installation Address"}</p>
                    <p className="text-sm font-medium">{address}</p>
                  </div>

                  {/* Plan */}
                  {selectedPlan && (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{selectedPlan.name}</span>
                        <span className="text-sm font-medium">${selectedPlan.price}/mois</span>
                      </div>
                    </div>
                  )}

                  <Separator />

                  {/* One-time fees */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase">
                      {isFrench ? "Frais uniques" : "One-time fees"}
                    </p>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{ROUTER_DETAILS.name}</span>
                      <span>${ROUTER_DETAILS.price}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{isFrench ? "Livraison" : "Delivery"}</span>
                      <span>${deliveryFee}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{isFrench ? "Activation" : "Activation"}</span>
                      <span>${activationFee}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{isFrench ? "Installation" : "Installation"}</span>
                      <span className={installationCredit > 0 ? "line-through text-muted-foreground" : ""}>
                        $50
                      </span>
                    </div>
                    {installationCredit > 0 && (
                      <div className="flex justify-between text-sm text-emerald-500">
                        <span>{isFrench ? "Rabais installation" : "Installation discount"}</span>
                        <span>-${installationCredit}</span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Taxes */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">TPS (5%)</span>
                      <span>${tpsAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">TVQ (9.975%)</span>
                      <span>${tvqAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Total */}
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{isFrench ? "Total à payer maintenant" : "Total due now"}</span>
                    <span className="text-xl font-bold text-cyan-500">${totalDueNow.toFixed(2)}</span>
                  </div>

                  <div className="pt-4 space-y-3">
                    <Button
                      variant="hero"
                      className="w-full"
                      size="lg"
                      onClick={() => setStep(4)}
                      disabled={!routerAcknowledged || !identityConfirmed || !selectedDate || !selectedTime}
                    >
                      {isFrench ? "Continuer" : "Continue"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => setStep(2)}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      {isFrench ? "Modifier le forfait" : "Change plan"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Step 4: Terms & Final Confirmation */}
        {step === 4 && (
          <div className="space-y-6 max-w-3xl mx-auto">
            {/* Terms & Conditions - French First */}
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-cyan-500" />
                  {isFrench ? "Termes et conditions" : "Terms and Conditions"}
                </CardTitle>
                <CardDescription>
                  {isFrench ? "Contrats de service Nivra Communications" : "Nivra Communications Service Contracts"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-accent/30 rounded-lg p-4 text-sm space-y-4 max-h-96 overflow-y-auto">
                  {/* French Terms First (Quebec Compliance) */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">Conditions générales (FR)</h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• <strong>Aucune vérification de crédit:</strong> Nivra n'effectue aucune vérification de crédit.</li>
                      <li>• <strong>Pièce d'identité gouvernementale requise:</strong> Une pièce d'identité avec photo est obligatoire pour valider toute commande.</li>
                      <li>• <strong>100% indépendant:</strong> Nivra est un courtier télécom indépendant. Nous ne recevons aucune commission des fournisseurs de télécommunications.</li>
                      <li>• <strong>Paiement direct:</strong> Vous payez directement à Nivra Communications. Aucun intermédiaire.</li>
                      <li>• <strong>Équipement:</strong> Le routeur {ROUTER_DETAILS.name} ({ROUTER_DETAILS.price}$) est requis et doit être payé avant l'installation. Garantie de 1 an couvrant les défauts de fabrication uniquement.</li>
                      <li>• <strong>Annulation:</strong> Vous pouvez annuler en tout temps. Après l'installation: 1 mois de facturation s'applique. Avant 1 mois d'utilisation: frais d'installation de 50$ s'appliquent.</li>
                    </ul>
                  </div>

                  <Separator />

                  {/* English Terms */}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">General Terms (EN)</h4>
                    <ul className="space-y-2 text-muted-foreground">
                      <li>• <strong>No credit check:</strong> Nivra does not perform any credit check.</li>
                      <li>• <strong>Government ID required:</strong> A photo ID is mandatory to validate any order.</li>
                      <li>• <strong>100% independent:</strong> Nivra is an independent telecom broker. We do not receive any commission from telecommunications providers.</li>
                      <li>• <strong>Direct payment:</strong> You pay directly to Nivra Communications. No intermediary.</li>
                      <li>• <strong>Equipment:</strong> The {ROUTER_DETAILS.name} router (${ROUTER_DETAILS.price}) is required and must be paid before installation. 1-year warranty covering manufacturer defects only.</li>
                      <li>• <strong>Cancellation:</strong> You can cancel at any time. After installation: 1 month of billing applies. Before 1 month of use: $50 installation fees apply.</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <Checkbox
                    id="terms-accepted"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                  />
                  <Label htmlFor="terms-accepted" className="text-sm text-muted-foreground cursor-pointer">
                    {isFrench 
                      ? "J'ai lu et j'accepte les termes et conditions de Nivra Communications."
                      : "I have read and accept the Nivra Communications terms and conditions."}
                  </Label>
                </div>
              </CardContent>
            </Card>

            {/* Final Order Summary */}
            <Card className="bg-cyan-500/10 border-cyan-500/30">
              <CardContent className="py-6">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto">
                    <Wifi className="w-8 h-8 text-cyan-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">{selectedPlan?.name}</h3>
                    <p className="text-muted-foreground">{address}</p>
                  </div>
                  <div className="flex justify-center gap-8 text-center">
                    <div>
                      <p className="text-2xl font-bold text-foreground">${selectedPlan?.price}</p>
                      <p className="text-xs text-muted-foreground">{isFrench ? "par mois" : "per month"}</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-cyan-500">${totalDueNow.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">{isFrench ? "à payer maintenant" : "due now"}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {isFrench ? "Retour" : "Back"}
              </Button>
              <Button 
                variant="hero" 
                size="lg" 
                onClick={handleSubmit}
                disabled={!termsAccepted || createOrderMutation.isPending}
              >
                {createOrderMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                {isFrench ? "Confirmer la commande" : "Confirm Order"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Professional Order Confirmation */}
        {step === 5 && createdOrder && (
          <div className="space-y-6 max-w-3xl mx-auto">
            {/* Success Header */}
            <Card className="bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-cyan-500/10 border-emerald-500/30 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-radial from-emerald-500/20 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <CardContent className="py-10 relative">
                <div className="text-center space-y-4">
                  <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30 animate-pulse">
                    <CheckCircle2 className="w-12 h-12 text-white" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-foreground mb-2">
                      {isFrench ? "Commande confirmée!" : "Order Confirmed!"}
                    </h2>
                    <p className="text-muted-foreground max-w-md mx-auto">
                      {isFrench 
                        ? "Merci pour votre confiance. Votre commande Internet a été reçue et est en cours de traitement."
                        : "Thank you for your trust. Your Internet order has been received and is being processed."}
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm text-muted-foreground">
                      {isFrench ? "Numéro de commande" : "Order Number"}
                    </p>
                    <Badge className="bg-foreground text-background text-xl px-6 py-2 font-mono">
                      {createdOrder.order_number}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order Summary */}
            <Card className="bg-card border-border">
              <CardHeader className="border-b border-border">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5 text-cyan-500" />
                  {isFrench ? "Récapitulatif de votre commande" : "Your Order Summary"}
                </CardTitle>
              </CardHeader>
              <CardContent className="py-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Service Details */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-cyan-500" />
                      {isFrench ? "Service commandé" : "Service Ordered"}
                    </h4>
                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-foreground font-medium">{selectedPlan?.name}</span>
                        <Badge className="bg-cyan-500/20 text-cyan-500">{selectedPlan?.speed}</Badge>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{isFrench ? "Abonnement mensuel" : "Monthly subscription"}</span>
                        <span className="text-foreground font-medium">${selectedPlan?.price}/mois</span>
                      </div>
                    </div>
                  </div>

                  {/* Equipment */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      <Router className="w-4 h-4 text-cyan-500" />
                      {isFrench ? "Équipement inclus" : "Included Equipment"}
                    </h4>
                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-foreground font-medium">Nivra Born Wifi</span>
                        <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
                          <Shield className="w-3 h-3 mr-1" />
                          {isFrench ? "Garantie 1 an" : "1-Year Warranty"}
                        </Badge>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{isFrench ? "Frais unique (payé)" : "One-time fee (paid)"}</span>
                        <span className="text-foreground font-medium">$60.00</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Installation Address */}
                <div className="mt-6 space-y-4">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-cyan-500" />
                    {isFrench ? "Adresse d'installation" : "Installation Address"}
                  </h4>
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-foreground">{address}</p>
                  </div>
                </div>

                {/* Installation Schedule */}
                {selectedDate && selectedTime && (
                  <div className="mt-6 space-y-4">
                    <h4 className="font-semibold text-foreground flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-cyan-500" />
                      {isFrench ? "Date d'installation préférée" : "Preferred Installation Date"}
                    </h4>
                    <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-foreground">{selectedDate}</span>
                      </div>
                      <Separator orientation="vertical" className="h-6" />
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-foreground">{selectedTime}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Summary */}
                <div className="mt-6 space-y-4">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-500" />
                    {isFrench ? "Montant payé" : "Amount Paid"}
                  </h4>
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{isFrench ? "Routeur Nivra Born Wifi" : "Nivra Born Wifi Router"}</span>
                        <span className="text-foreground">$60.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{isFrench ? "Livraison" : "Delivery"}</span>
                        <span className="text-foreground">$30.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{isFrench ? "Activation" : "Activation"}</span>
                        <span className="text-foreground">$25.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{isFrench ? "Installation" : "Installation"}</span>
                        <span className="text-foreground">${installationFee.toFixed(2)}</span>
                      </div>
                      {installationCredit > 0 && (
                        <div className="flex justify-between text-emerald-500">
                          <span>{isFrench ? "Crédit promo" : "Promo credit"}</span>
                          <span>-${installationCredit.toFixed(2)}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">TPS (5%)</span>
                        <span className="text-foreground">${tpsAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">TVQ (9.975%)</span>
                        <span className="text-foreground">${tvqAmount.toFixed(2)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-lg font-bold">
                        <span className="text-foreground">{isFrench ? "Total payé" : "Total Paid"}</span>
                        <span className="text-emerald-500">${totalDueNow.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Next Steps */}
            <Card className="bg-card border-border">
              <CardHeader className="border-b border-border">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ArrowRight className="w-5 h-5 text-cyan-500" />
                  {isFrench ? "Prochaines étapes" : "Next Steps"}
                </CardTitle>
              </CardHeader>
              <CardContent className="py-6">
                <div className="space-y-4">
                  {[
                    {
                      icon: FileText,
                      title: isFrench ? "Confirmation par courriel" : "Email Confirmation",
                      desc: isFrench 
                        ? "Un courriel de confirmation avec tous les détails de votre commande sera envoyé à votre adresse."
                        : "A confirmation email with all order details will be sent to your email address.",
                      time: isFrench ? "Immédiat" : "Immediate"
                    },
                    {
                      icon: User,
                      title: isFrench ? "Appel de vérification" : "Verification Call",
                      desc: isFrench 
                        ? "Un agent Nivra vous contactera pour confirmer votre commande et vos informations."
                        : "A Nivra agent will contact you to confirm your order and information.",
                      time: isFrench ? "Sous 24h" : "Within 24h"
                    },
                    {
                      icon: Shield,
                      title: isFrench ? "Vérification d'identité" : "Identity Verification",
                      desc: isFrench 
                        ? "Préparez votre pièce d'identité gouvernementale avec photo pour la vérification."
                        : "Prepare your government-issued photo ID for verification.",
                      time: isFrench ? "Lors de l'appel" : "During call"
                    },
                    {
                      icon: Package,
                      title: isFrench ? "Livraison de l'équipement" : "Equipment Delivery",
                      desc: isFrench 
                        ? "Votre routeur Nivra Born Wifi sera livré à votre adresse dans les délais indiqués."
                        : "Your Nivra Born Wifi router will be delivered to your address within the indicated timeframe.",
                      time: isFrench ? "48-72h ouvrables" : "48-72 business hours"
                    },
                    {
                      icon: Wifi,
                      title: isFrench ? "Installation du service" : "Service Installation",
                      desc: isFrench 
                        ? "Un technicien se présentera à la date et l'heure convenues pour installer votre service."
                        : "A technician will arrive at the agreed date and time to install your service.",
                      time: selectedDate || (isFrench ? "À confirmer" : "To confirm")
                    }
                  ].map((item, index) => (
                    <div key={index} className="flex gap-4 items-start">
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center">
                          <item.icon className="w-5 h-5 text-cyan-500" />
                        </div>
                        {index < 4 && <div className="w-0.5 h-8 bg-border mt-2" />}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-foreground">{item.title}</h4>
                          <Badge variant="outline" className="text-xs">{item.time}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <Card className="bg-muted/30 border-border">
              <CardContent className="py-6">
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {isFrench ? "Des questions? Contactez-nous:" : "Questions? Contact us:"}
                  </p>
                  <div className="flex justify-center gap-6">
                    <a href="tel:+14385442233" className="flex items-center gap-2 text-cyan-500 hover:text-cyan-400 transition-colors">
                      <span className="font-medium">438-544-2233</span>
                    </a>
                    <a href="mailto:support@nivra.ca" className="flex items-center gap-2 text-cyan-500 hover:text-cyan-400 transition-colors">
                      <span className="font-medium">support@nivra.ca</span>
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Button variant="hero" size="lg" onClick={() => navigate("/portal/orders")}>
                <FileText className="w-4 h-4 mr-2" />
                {isFrench ? "Voir mes commandes" : "View My Orders"}
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate("/portal")}>
                {isFrench ? "Retour au tableau de bord" : "Back to Dashboard"}
              </Button>
            </div>

            {/* Print/Save Note */}
            <p className="text-center text-xs text-muted-foreground">
              {isFrench 
                ? "Conservez votre numéro de commande pour référence. Un courriel de confirmation vous sera envoyé sous peu."
                : "Keep your order number for reference. A confirmation email will be sent to you shortly."}
            </p>
          </div>
        )}

        {/* Delivery Notice - Always visible before footer */}
        {step !== 5 && (
          <Card className="bg-accent/30 border-border mt-8">
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground text-center">
                <strong>{isFrench ? "Livraison:" : "Delivery:"}</strong>{" "}
                {isFrench 
                  ? "L'équipement Nivra est normalement livré dans les 48 heures ouvrables en zone urbaine et 72 heures ouvrables en zone rurale après la commande. Des délais peuvent survenir pendant les jours fériés."
                  : "Nivra equipment is normally delivered within 48 working hours in urban areas and 72 working hours in rural areas after the order. Delays may occur during holidays."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </ClientLayout>
  );
};

export default ClientInternetOrder;
