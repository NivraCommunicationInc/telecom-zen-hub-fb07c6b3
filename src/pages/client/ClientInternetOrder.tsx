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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  Sparkles,
  Truck,
  Wrench,
  Receipt
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { format, addDays, addMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { ClientIDVerificationForm, ClientIDData, validateIDData } from "@/components/client/ClientIDVerificationForm";
import { verifySensitiveActionAllowed } from "@/lib/securityUtils";
import { 
  CheckoutLayout, 
  CheckoutProgress, 
  OrderSummaryCard, 
  SecurityTrustBox, 
  CheckoutSection,
  ProfessionalConfirmation,
  PinSetupSection,
  validatePinSetup,
  CheckoutPaymentSection,
  CheckoutPhoneField,
  validateCanadianPhone 
} from "@/components/checkout";
import { hashPin } from "@/lib/pinUtils";

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

interface AddressValidation {
  isValid: boolean;
  isQuebec: boolean;
  formattedAddress: string;
  city: string;
  province: string;
  postalCode: string;
}

interface LocationState {
  validatedAddress?: string;
  addressDetails?: {
    formattedAddress: string;
    city?: string;
    province?: string;
    postalCode?: string;
  };
  selectedPlanId?: string;
}

const ClientInternetOrder = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const isFrench = language === 'fr';

  // Get pre-validated data from navigation state
  const locationState = location.state as LocationState | null;

  // Step management - skip to step 2 if address is pre-validated
  const [step, setStep] = useState(() => {
    if (locationState?.validatedAddress && locationState?.addressDetails) {
      return 2; // Skip address validation
    }
    return 1;
  });
  
  // Address validation state - initialize from location state if available
  const [address, setAddress] = useState(locationState?.validatedAddress || "");
  const [addressValidation, setAddressValidation] = useState<AddressValidation | null>(() => {
    if (locationState?.addressDetails) {
      return {
        isValid: true,
        isQuebec: true,
        formattedAddress: locationState.addressDetails.formattedAddress,
        city: locationState.addressDetails.city || "",
        province: locationState.addressDetails.province || "QC",
        postalCode: locationState.addressDetails.postalCode || ""
      };
    }
    return null;
  });
  const [addressBlocked, setAddressBlocked] = useState(false);
  
  // Plan selection - initialize from location state if available
  const [selectedPlan, setSelectedPlan] = useState<typeof INTERNET_PLANS[0] | null>(() => {
    if (locationState?.selectedPlanId) {
      return INTERNET_PLANS.find(p => p.id === locationState.selectedPlanId) || null;
    }
    return null;
  });
  
  // Order details
  const [notes, setNotes] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [installationCredit, setInstallationCredit] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [routerAcknowledged, setRouterAcknowledged] = useState(false);
  
  // Installation method
  const [installationMethod, setInstallationMethod] = useState<"auto" | "technician">("auto");
  
  // Installation scheduling
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  
  // Order result
  const [createdOrder, setCreatedOrder] = useState<any>(null);
  
  // Phone field for checkout
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");

  // Payment method state
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"saved" | "new">("new");
  const [selectedCardId, setSelectedCardId] = useState("");
  const [savedCardCvv, setSavedCardCvv] = useState("");
  const [cvvError, setCvvError] = useState("");
  const [newCardData, setNewCardData] = useState({
    cardNumber: "",
    cardName: "",
    expiry: "",
    cvv: "",
  });
  const [saveNewCard, setSaveNewCard] = useState(false);
  
  // PIN setup for new clients
  const [clientPin, setClientPin] = useState("");
  const [confirmClientPin, setConfirmClientPin] = useState("");
  
  // ID verification data
  const [clientIdData, setClientIdData] = useState<ClientIDData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    serviceAddress: "",
    serviceCity: "",
    serviceProvince: "QC",
    servicePostalCode: "",
    idType: "",
    idNumber: "",
    idExpiration: "",
    idProvince: ""
  });
  const [idAddressValid, setIdAddressValid] = useState(false);

  // Fetch client profile
  const { data: profile } = useQuery({
    queryKey: ["client-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch saved payment methods
  const { data: savedCards } = useQuery({
    queryKey: ["client-payment-methods", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Set default payment method and phone when cards/profile loaded
  useEffect(() => {
    if (savedCards && savedCards.length > 0) {
      setSelectedPaymentMethod("saved");
      const defaultCard = savedCards.find((c: any) => c.is_default) || savedCards[0];
      setSelectedCardId(defaultCard.id);
    }
  }, [savedCards]);

  useEffect(() => {
    if (profile?.phone && !checkoutPhone) {
      // Format the phone from profile
      const digits = (profile.phone || "").replace(/\D/g, "").slice(0, 10);
      if (digits.length === 10) {
        setCheckoutPhone(`(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`);
      }
    }
  }, [profile?.phone, checkoutPhone]);

  // Initialize client ID data from profile when available
  useEffect(() => {
    if (profile) {
      const nameParts = profile.full_name?.split(' ') || [];
      setClientIdData(prev => ({
        ...prev,
        firstName: profile.first_name || nameParts[0] || prev.firstName,
        lastName: profile.last_name || nameParts.slice(1).join(' ') || prev.lastName,
        email: profile.email || user?.email || prev.email,
        phone: profile.phone || prev.phone,
        dateOfBirth: profile.date_of_birth || prev.dateOfBirth,
        serviceAddress: profile.service_address || address || prev.serviceAddress,
        serviceCity: profile.service_city || prev.serviceCity,
        serviceProvince: profile.service_province || "QC",
        servicePostalCode: profile.service_postal_code || prev.servicePostalCode,
        idType: profile.id_type || prev.idType,
        idNumber: profile.id_number || prev.idNumber,
        idExpiration: profile.id_expiration || prev.idExpiration,
        idProvince: profile.id_province || prev.idProvince
      }));
    }
  }, [profile, user?.email, address]);

  // Handle address selection from autocomplete
  const handleAddressSelect = useCallback((details: { 
    formattedAddress: string; 
    city?: string; 
    province?: string; 
    postalCode?: string;
  }) => {
    const postalCode = details.postalCode || "";
    const province = details.province || "";
    
    // Check if it's a Quebec address
    const isQuebecPostal = /^[GHJ]/i.test(postalCode);
    const isQuebecProvince = province.toUpperCase().includes("QC") || province.toUpperCase().includes("QUEBEC");
    const isQuebec = isQuebecPostal || isQuebecProvince;
    
    if (isQuebec) {
      setAddressValidation({
        isValid: true,
        isQuebec: true,
        formattedAddress: details.formattedAddress,
        city: details.city || "",
        province: "QC",
        postalCode: postalCode
      });
      setAddressBlocked(false);
      toast.success(isFrench ? "Adresse validée! Service disponible." : "Address validated! Service available.");
    } else {
      setAddressValidation({
        isValid: true,
        isQuebec: false,
        formattedAddress: details.formattedAddress,
        city: details.city || "",
        province: province,
        postalCode: postalCode
      });
      setAddressBlocked(true);
      toast.error(isFrench ? "Désolé, nos services Internet sont disponibles uniquement au Québec." : "Sorry, our Internet services are only available in Quebec.");
    }
  }, [isFrench]);

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

  // Calculate totals - fee logic based on installation method
  const planPrice = selectedPlan?.price || 0;
  const routerFee = ROUTER_DETAILS.price;
  const deliveryFee = installationMethod === "auto" ? 30 : 0; // Only charge delivery for auto-installation
  const activationFee = 25;
  const installationFee = installationMethod === "technician" ? Math.max(0, 50 - installationCredit) : 0; // Only charge installation for technician
  const monthlySubtotal = planPrice;
  const oneTimeTotal = routerFee + deliveryFee + activationFee + installationFee;
  const tpsAmount = Math.round((oneTimeTotal) * 0.05 * 100) / 100;
  const tvqAmount = Math.round((oneTimeTotal) * 0.09975 * 100) / 100;
  const totalDueNow = oneTimeTotal + tpsAmount + tvqAmount;

  // Create order mutation with automatic appointment creation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedPlan) throw new Error("Not authenticated or no plan selected");

      // Security check before sensitive action
      const { allowed, reason } = await verifySensitiveActionAllowed(user.id);
      if (!allowed) {
        throw new Error(reason || "Action non autorisée - compte suspendu");
      }

      // First, update the profile with ID information and phone
      const phoneDigits = checkoutPhone.replace(/\D/g, "");
      const { error: profileError } = await supabase.from("profiles").update({
        first_name: clientIdData.firstName,
        last_name: clientIdData.lastName,
        full_name: `${clientIdData.firstName} ${clientIdData.lastName}`,
        email: clientIdData.email,
        phone: phoneDigits.length === 10 ? checkoutPhone : (clientIdData.phone || null),
        date_of_birth: clientIdData.dateOfBirth || null,
        service_address: address,
        service_city: addressValidation?.city || null,
        service_province: addressValidation?.province || "QC",
        service_postal_code: addressValidation?.postalCode || null,
        id_type: clientIdData.idType,
        id_number: clientIdData.idNumber,
        id_expiration: clientIdData.idExpiration || null,
        id_province: clientIdData.idProvince
      }).eq("user_id", user.id);

      if (profileError) {
        console.error("Profile update error:", profileError);
      }

      // Build payment reference info (without storing CVV)
      const paymentInfo = selectedPaymentMethod === "saved" 
        ? {
            method: "saved_card",
            card_id: selectedCardId,
            card_type: savedCards?.find((c: any) => c.id === selectedCardId)?.card_type,
            last_four: savedCards?.find((c: any) => c.id === selectedCardId)?.last_four,
          }
        : {
            method: "new_card",
            card_type: newCardData.cardNumber.startsWith("4") ? "Visa" : newCardData.cardNumber.startsWith("5") ? "Mastercard" : "Card",
            last_four: newCardData.cardNumber.replace(/\s/g, "").slice(-4),
          };

      // Create the order with payment status and phone
      const { data: orderData, error: orderError } = await supabase.from("orders").insert({
        user_id: user.id,
        client_email: clientIdData.email || profile?.email || user.email,
        service_type: selectedPlan.name,
        category: "Internet",
        subtotal: planPrice,
        total_amount: totalDueNow,
        delivery_fee: installationMethod === "auto" ? 30 : 0,
        activation_fee: activationFee,
        installation_fee: installationMethod === "technician" ? 50 : 0,
        installation_credit: installationCredit,
        discount_code: discountCode || null,
        status: "pending",
        payment_status: "pre_authorized",
        preauth_card_id: selectedPaymentMethod === "saved" ? selectedCardId : null,
        preauth_discount: 0,
        installation_type: installationMethod,
        appointment_date: selectedDate ? new Date(selectedDate).toISOString() : null,
        created_by: "client",
        tps_amount: tpsAmount,
        tvq_amount: tvqAmount,
        notes: `${isFrench ? "Téléphone" : "Phone"}: ${checkoutPhone}
${isFrench ? "Adresse d'installation" : "Installation address"}: ${address}
${isFrench ? "Méthode d'installation" : "Installation method"}: ${installationMethod === "auto" ? (isFrench ? "Auto-installation" : "Self-installation") : (isFrench ? "Technicien Nivra" : "Nivra Technician")}
${isFrench ? "Date préférée" : "Preferred date"}: ${selectedDate ? format(new Date(selectedDate), "d MMMM yyyy", { locale: isFrench ? fr : undefined }) : "N/A"} ${selectedTime}
${isFrench ? "Paiement" : "Payment"}: ${paymentInfo.card_type} ****${paymentInfo.last_four} (${isFrench ? "Dépôt préautorisé" : "Pre-authorized deposit"})
${notes || ""}`.trim(),
        internal_notes: `Router: Nivra Born Wifi ($60 paid upfront)
Payment: ${JSON.stringify(paymentInfo)}
Deposit: $${totalDueNow.toFixed(2)} pre-authorized`,
      }).select().single();

      if (orderError) throw orderError;
      if (!orderData) throw new Error("Order creation failed - no data returned");

      // AUTO-CREATE APPOINTMENT for Internet orders
      if (selectedDate && selectedTime) {
        const { createAppointmentFromOrder } = await import("@/lib/appointmentUtils");
        
        const appointmentResult = await createAppointmentFromOrder({
          orderId: orderData.id,
          orderNumber: orderData.order_number,
          userId: user.id,
          clientEmail: clientIdData.email || profile?.email || user.email || "",
          clientPhone: clientIdData.phone || profile?.phone || "",
          clientName: `${clientIdData.firstName} ${clientIdData.lastName}`,
          serviceType: selectedPlan.name,
          category: "Internet",
          serviceAddress: address,
          serviceCity: addressValidation?.city || "",
          servicePostalCode: addressValidation?.postalCode || "",
          scheduledDate: selectedDate,
          scheduledTime: selectedTime,
          installationMethod: installationMethod,
          deliveryFee: installationMethod === "auto" ? 30 : 0,
          installationFee: installationMethod === "technician" ? 50 : 0,
          equipmentDetails: [
            { type: "router", name: "Nivra Born Wifi", fee: 60 }
          ],
          notes: notes || "",
        });

        if (!appointmentResult.success) {
          console.error("Appointment creation failed:", appointmentResult.error);
        } else {
          console.log("Appointment created:", appointmentResult.appointment?.appointment_number);
        }
      }

      return orderData;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["client-orders-all"] });
      queryClient.invalidateQueries({ queryKey: ["client-profile"] });
      queryClient.invalidateQueries({ queryKey: ["client-appointments-all"] });
      queryClient.invalidateQueries({ queryKey: ["admin-appointments-full"] });
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
    
    // Validate phone number
    if (!validateCanadianPhone(checkoutPhone)) {
      setPhoneError(isFrench ? "Numéro de téléphone canadien invalide" : "Invalid Canadian phone number");
      toast.error(isFrench ? "Veuillez entrer un numéro de téléphone valide" : "Please enter a valid phone number");
      return;
    }
    setPhoneError("");
    
    // Validate payment method
    if (selectedPaymentMethod === "saved") {
      if (!selectedCardId) {
        toast.error(isFrench ? "Veuillez sélectionner une carte" : "Please select a card");
        return;
      }
      if (!savedCardCvv || savedCardCvv.length < 3) {
        setCvvError(isFrench ? "CVV requis (3-4 chiffres)" : "CVV required (3-4 digits)");
        toast.error(isFrench ? "Veuillez entrer le CVV de votre carte" : "Please enter your card CVV");
        return;
      }
      setCvvError("");
    } else {
      if (!newCardData.cardNumber || !newCardData.cardName || !newCardData.expiry || !newCardData.cvv) {
        toast.error(isFrench ? "Veuillez compléter les informations de la carte" : "Please complete card information");
        return;
      }
    }
    
    // Validate ID data
    const idValidation = validateIDData(clientIdData, false);
    if (!idValidation.valid) {
      toast.error(isFrench ? "Veuillez compléter toutes les informations d'identité" : "Please complete all identity information");
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

  // Calculate next billing date
  const getNextBillingDate = () => {
    const nextMonth = addMonths(new Date(), 1);
    return format(nextMonth, "d MMMM yyyy", { locale: isFrench ? fr : undefined });
  };

  // Build order summary items
  const getMonthlyItems = () => {
    if (!selectedPlan) return [];
    return [{
      label: selectedPlan.name,
      amount: selectedPlan.price,
      description: `${selectedPlan.speed} - ${isFrench ? "Internet haute vitesse" : "High-speed Internet"}`,
    }];
  };

  const getOneTimeItems = () => {
    const items = [];
    items.push({ label: ROUTER_DETAILS.name, amount: routerFee, description: isFrench ? "Équipement requis" : "Required equipment" });
    if (installationMethod === "auto") {
      items.push({ label: isFrench ? "Livraison" : "Delivery", amount: deliveryFee });
    }
    items.push({ label: isFrench ? "Activation" : "Activation", amount: activationFee });
    if (installationMethod === "technician") {
      items.push({ label: isFrench ? "Installation technicien" : "Technician installation", amount: installationFee });
    }
    if (installationCredit > 0) {
      items.push({ label: isFrench ? "Crédit promo" : "Promo credit", amount: installationCredit, isDiscount: true });
    }
    return items;
  };

  // Step configuration for progress indicator
  const checkoutSteps = [
    { id: 1, labelFr: "Adresse", labelEn: "Address" },
    { id: 2, labelFr: "Forfait", labelEn: "Plan" },
    { id: 3, labelFr: "Options", labelEn: "Options" },
    { id: 4, labelFr: "Paiement", labelEn: "Payment" },
    { id: 5, labelFr: "Confirmation", labelEn: "Confirmation" },
  ];

  return (
    <ClientLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="border-b border-border pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Wifi className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
                {isFrench ? "Commander Internet" : "Order Internet"}
              </h1>
              <p className="text-muted-foreground text-sm">
                {isFrench ? "Service Internet haute vitesse au Québec" : "High-speed Internet service in Quebec"}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Steps - Professional Telecom Style */}
        <CheckoutProgress
          currentStep={step}
          steps={checkoutSteps}
          isFrench={isFrench}
          onStepClick={(s) => s < step && setStep(s)}
        />

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
                  <Label>
                    {isFrench ? "Adresse complète (incluant le code postal)" : "Full address (including postal code)"}
                  </Label>
                  <AddressAutocomplete
                    value={address}
                    onChange={(value) => {
                      setAddress(value);
                      if (!value) {
                        setAddressValidation(null);
                        setAddressBlocked(false);
                      }
                    }}
                    onAddressSelect={handleAddressSelect}
                    placeholder={isFrench ? "Ex: 123 rue Exemple, Montréal, QC H2X 1Y4" : "E.g., 123 Example St, Montreal, QC H2X 1Y4"}
                    restrictToQuebec={true}
                  />
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

              {/* Installation Method */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-amber-500" />
                    {isFrench ? "Méthode d'installation" : "Installation Method"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup value={installationMethod} onValueChange={(v) => setInstallationMethod(v as "auto" | "technician")}>
                    <div className="space-y-4">
                      <div className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        installationMethod === "auto" ? "border-emerald-500 bg-emerald-500/5" : "border-border"
                      }`} onClick={() => setInstallationMethod("auto")}>
                        <RadioGroupItem value="auto" id="auto" className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor="auto" className="text-base font-medium cursor-pointer flex items-center gap-2">
                            <Truck className="w-4 h-4 text-emerald-500" />
                            {isFrench ? "Auto-installation" : "Self-installation"}
                          </Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            {isFrench 
                              ? "Recevez votre équipement par la poste et installez-le vous-même. Frais de livraison: $30"
                              : "Receive your equipment by mail and install it yourself. Delivery fee: $30"}
                          </p>
                        </div>
                        <Badge className="bg-emerald-500">{isFrench ? "Économique" : "Economical"}</Badge>
                      </div>

                      <div className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        installationMethod === "technician" ? "border-cyan-500 bg-cyan-500/5" : "border-border"
                      }`} onClick={() => setInstallationMethod("technician")}>
                        <RadioGroupItem value="technician" id="technician" className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor="technician" className="text-base font-medium cursor-pointer flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-cyan-500" />
                            {isFrench ? "Installation par technicien Nivra" : "Nivra Technician Installation"}
                          </Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            {isFrench 
                              ? "Un technicien Nivra se déplace chez vous pour l'installation. Frais d'installation: $50"
                              : "A Nivra technician comes to your home for installation. Installation fee: $50"}
                          </p>
                        </div>
                        <Badge className="bg-cyan-500">{isFrench ? "Recommandé" : "Recommended"}</Badge>
                      </div>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>
              {/* Client ID Verification Form */}
              <ClientIDVerificationForm
                isFrench={isFrench}
                data={clientIdData}
                onChange={setClientIdData}
                showServiceAddress={false}
                existingProfile={profile}
              />

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

              {/* Phone Number Field */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-cyan-500" />
                    {isFrench ? "Coordonnées de contact" : "Contact Information"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CheckoutPhoneField
                    isFrench={isFrench}
                    phone={checkoutPhone}
                    onChange={setCheckoutPhone}
                    error={phoneError}
                  />
                </CardContent>
              </Card>

              {/* PIN Setup for New Clients */}
              <PinSetupSection
                userId={user?.id}
                pin={clientPin}
                onPinChange={setClientPin}
                confirmPin={confirmClientPin}
                onConfirmPinChange={setConfirmClientPin}
                isFrench={isFrench}
                checkFirstOrder={true}
              />

              {/* Payment Section */}
              <CheckoutPaymentSection
                isFrench={isFrench}
                savedCards={savedCards || []}
                selectedPaymentMethod={selectedPaymentMethod}
                onPaymentMethodChange={setSelectedPaymentMethod}
                selectedCardId={selectedCardId}
                onSelectedCardChange={setSelectedCardId}
                cvv={savedCardCvv}
                onCvvChange={setSavedCardCvv}
                newCardData={newCardData}
                onNewCardChange={setNewCardData}
                saveNewCard={saveNewCard}
                onSaveNewCardChange={setSaveNewCard}
                totalAmount={totalDueNow}
                cvvError={cvvError}
              />
            </div>

            {/* Order Summary Sidebar - Professional Telecom Style */}
            <div className="lg:col-span-1">
              <OrderSummaryCard
                isFrench={isFrench}
                monthlyItems={getMonthlyItems()}
                oneTimeItems={getOneTimeItems()}
                tpsAmount={tpsAmount}
                tvqAmount={tvqAmount}
                totalDueNow={totalDueNow}
                monthlyTotal={planPrice}
                nextBillingDate={getNextBillingDate()}
                onEditSection={(section) => {
                  if (section === "plan") setStep(2);
                }}
                className="border-primary/20"
              >
                <div className="pt-4 space-y-4">
                  <Button
                    variant="hero"
                    className="w-full"
                    size="lg"
                    onClick={() => setStep(4)}
                    disabled={
                      !routerAcknowledged || 
                      !validateIDData(clientIdData, false).valid || 
                      !selectedDate || 
                      !selectedTime || 
                      !validateCanadianPhone(checkoutPhone) ||
                      (selectedPaymentMethod === "saved" ? (!selectedCardId || savedCardCvv.length < 3) : (!newCardData.cardNumber || !newCardData.cvv))
                    }
                  >
                    {isFrench ? "Continuer" : "Continue"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => setStep(2)}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {isFrench ? "Modifier le forfait" : "Change plan"}
                  </Button>
                </div>
              </OrderSummaryCard>

              {/* Security & Trust Box */}
              <div className="mt-6">
                <SecurityTrustBox isFrench={isFrench} />
              </div>
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
                      <li>• <strong>100% indépendant:</strong> Nivra est une compagnie de télécommunications indépendante vendant des services Nivra internes. Aucune affiliation carrier.</li>
                      <li>• <strong>Paiement direct:</strong> Modèle client-payeur. Vous payez directement à Nivra Communications. Aucun intermédiaire.</li>
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
                      <li>• <strong>100% independent:</strong> Nivra is an independent telecommunications company selling internal Nivra services. No carrier affiliation.</li>
                      <li>• <strong>Direct payment:</strong> Client-paid model. You pay directly to Nivra Communications. No intermediary.</li>
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
                    <a href="tel:+15145442233" className="flex items-center gap-2 text-cyan-500 hover:text-cyan-400 transition-colors">
                      <span className="font-medium">514-544-2233</span>
                    </a>
                    <a href="mailto:support@nivratelecom.ca" className="flex items-center gap-2 text-cyan-500 hover:text-cyan-400 transition-colors">
                      <span className="font-medium">Support@nivratelecom.ca</span>
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
