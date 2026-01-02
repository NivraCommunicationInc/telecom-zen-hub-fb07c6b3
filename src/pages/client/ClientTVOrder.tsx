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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Tv, 
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
  Monitor,
  Wifi,
  Upload,
  Truck,
  Wrench,
  Plus,
  Minus
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import AddressAutocomplete from "@/components/AddressAutocomplete";
import { ClientIDVerificationForm, ClientIDData, validateIDData } from "@/components/client/ClientIDVerificationForm";
import { PinSetupSection } from "@/components/checkout/PinSetupSection";

// TV + Internet plan configurations
const TV_PLANS = [
  {
    id: "tv-basic",
    name: "Internet 100 + TV Basic",
    internetSpeed: "100 Mbps",
    price: 75,
    channels: 26,
    channelType: { fr: "chaînes générales", en: "general channels" },
    badge: "ÉCONOMIQUE",
    badgeEn: "VALUE",
    color: "blue",
    channelChoices: 0,
  },
  {
    id: "tv-5choices",
    name: "Internet 500 + TV 5 choix",
    nameEn: "Internet 500 + TV 5 choices",
    internetSpeed: "500 Mbps",
    price: 80,
    channels: 32,
    channelType: { fr: "chaînes populaires", en: "popular channels" },
    badge: "POPULAIRE",
    badgeEn: "POPULAR",
    color: "cyan",
    channelChoices: 5,
  },
  {
    id: "tv-10choices",
    name: "Internet 500 + TV 10 choix",
    nameEn: "Internet 500 + TV 10 choices",
    internetSpeed: "500 Mbps",
    price: 90,
    previousPrice: 109,
    channels: 37,
    channelType: { fr: "chaînes populaires + sports", en: "popular + sports channels" },
    badge: "MEILLEUR VENDEUR",
    badgeEn: "BEST SELLER",
    color: "emerald",
    channelChoices: 10,
    recommended: true,
  },
  {
    id: "tv-15choices",
    name: "Internet 500 + TV 15 choix",
    nameEn: "Internet 500 + TV 15 choices",
    internetSpeed: "500 Mbps",
    price: 95,
    previousPrice: 129,
    channels: 42,
    channelType: { fr: "chaînes populaires + sports", en: "popular + sports channels" },
    badge: "ÉCONOMIE 26%",
    badgeEn: "SAVE 26%",
    color: "purple",
    channelChoices: 15,
  },
  {
    id: "tv-25choices",
    name: "Internet 500 + TV 25 choix",
    nameEn: "Internet 500 + TV 25 choices",
    internetSpeed: "500 Mbps",
    price: 110,
    previousPrice: 135,
    channels: 52,
    channelType: { fr: "chaînes populaires + sports", en: "popular + sports channels" },
    badge: "PREMIUM",
    badgeEn: "PREMIUM",
    color: "amber",
    channelChoices: 25,
  }
];

// Equipment details
const TERMINAL_DETAILS = {
  name: "Nivra 4K Smart Terminal",
  price: 50,
  maxQuantity: 4,
  warranty: {
    fr: "Garantie 1 an couvrant les défauts de fabrication",
    en: "1-year warranty covering manufacturer defects"
  }
};

const ROUTER_DETAILS = {
  name: "Nivra Born Wifi Router",
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

const ClientTVOrder = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const isFrench = language === 'fr';

  const locationState = location.state as LocationState | null;

  // Step management
  const [step, setStep] = useState(() => {
    if (locationState?.validatedAddress && locationState?.addressDetails) {
      return 2;
    }
    return 1;
  });
  
  // Address validation state
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
  
  // Plan selection
  const [selectedPlan, setSelectedPlan] = useState<typeof TV_PLANS[0] | null>(() => {
    if (locationState?.selectedPlanId) {
      return TV_PLANS.find(p => p.id === locationState.selectedPlanId) || null;
    }
    return null;
  });
  
  // Equipment
  const [terminalCount, setTerminalCount] = useState(1);
  const [routerAcknowledged, setRouterAcknowledged] = useState(false);
  
  // Installation method
  const [installationMethod, setInstallationMethod] = useState<"auto" | "technician">("auto");
  
  // Order details
  const [notes, setNotes] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [installationCredit, setInstallationCredit] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  // Installation scheduling
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  
  // Order result
  const [createdOrder, setCreatedOrder] = useState<any>(null);

  // Security PIN for new accounts
  const [securityPin, setSecurityPin] = useState("");
  const [confirmSecurityPin, setConfirmSecurityPin] = useState("");

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

  // Fetch available channels for selection
  const { data: availableChannels = [] } = useQuery({
    queryKey: ["tv-channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tv_channels")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Handle address selection
  const handleAddressSelect = useCallback((details: { 
    formattedAddress: string; 
    city?: string; 
    province?: string; 
    postalCode?: string;
  }) => {
    const postalCode = details.postalCode || "";
    const province = details.province || "";
    
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
      toast.error(isFrench ? "Désolé, nos services sont disponibles uniquement au Québec." : "Sorry, our services are only available in Quebec.");
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
  const terminalFee = TERMINAL_DETAILS.price * terminalCount;
  const routerFee = ROUTER_DETAILS.price;
  const deliveryFee = installationMethod === "auto" ? 30 : 0; // Only charge delivery for auto-installation
  const activationFee = 25;
  const installationFee = installationMethod === "technician" ? Math.max(0, 50 - installationCredit) : 0; // Only charge installation for technician
  const oneTimeTotal = terminalFee + routerFee + deliveryFee + activationFee + installationFee;
  const tpsAmount = Math.round((oneTimeTotal) * 0.05 * 100) / 100;
  const tvqAmount = Math.round((oneTimeTotal) * 0.09975 * 100) / 100;
  const totalDueNow = oneTimeTotal + tpsAmount + tvqAmount;

  // Create order mutation with automatic appointment creation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedPlan) throw new Error("Not authenticated or no plan selected");

      // First, update the profile with ID information and PIN if provided
      const profileUpdate: any = {
        first_name: clientIdData.firstName,
        last_name: clientIdData.lastName,
        full_name: `${clientIdData.firstName} ${clientIdData.lastName}`,
        email: clientIdData.email,
        phone: clientIdData.phone,
        date_of_birth: clientIdData.dateOfBirth || null,
        service_address: address,
        service_city: addressValidation?.city || null,
        service_province: addressValidation?.province || "QC",
        service_postal_code: addressValidation?.postalCode || null,
        id_type: clientIdData.idType,
        id_number: clientIdData.idNumber,
        id_expiration: clientIdData.idExpiration || null,
        id_province: clientIdData.idProvince
      };

      // Save PIN if provided and valid
      if (securityPin && securityPin.length === 4 && securityPin === confirmSecurityPin) {
        profileUpdate.client_pin = securityPin;
        profileUpdate.pin_failed_attempts = 0;
        profileUpdate.pin_lockout_until = null;
      }

      const { error: profileError } = await supabase.from("profiles").update(profileUpdate).eq("user_id", user.id);

      if (profileError) {
        console.error("Profile update error:", profileError);
      }

      // Create the order
      const { data: orderData, error: orderError } = await supabase.from("orders").insert({
        user_id: user.id,
        client_email: clientIdData.email || profile?.email || user.email,
        service_type: isFrench ? selectedPlan.name : (selectedPlan.nameEn || selectedPlan.name),
        category: "TV + Internet",
        subtotal: planPrice,
        delivery_fee: installationMethod === "auto" ? 30 : 0,
        activation_fee: activationFee,
        installation_fee: installationMethod === "technician" ? 50 : 0,
        installation_credit: installationCredit,
        discount_code: discountCode || null,
        status: "pending",
        installation_type: installationMethod,
        appointment_date: selectedDate ? new Date(selectedDate).toISOString() : null,
        created_by: "client",
        notes: `${isFrench ? "Adresse d'installation" : "Installation address"}: ${address}
${isFrench ? "Méthode d'installation" : "Installation method"}: ${installationMethod === "auto" ? (isFrench ? "Auto-installation" : "Self-installation") : (isFrench ? "Technicien Nivra" : "Nivra Technician")}
${isFrench ? "Date préférée" : "Preferred date"}: ${selectedDate ? format(new Date(selectedDate), "d MMMM yyyy", { locale: isFrench ? fr : undefined }) : "N/A"} ${selectedTime}
${isFrench ? "Nombre de terminaux" : "Number of terminals"}: ${terminalCount}
${notes || ""}`.trim(),
        internal_notes: `Equipment: Nivra Born Wifi Router ($60) + ${terminalCount}x Nivra 4K Smart Terminal ($${terminalFee})`,
      }).select().single();

      if (orderError) throw orderError;
      if (!orderData) throw new Error("Order creation failed - no data returned");

      // AUTO-CREATE APPOINTMENT for TV + Internet orders
      if (selectedDate && selectedTime) {
        const { createAppointmentFromOrder } = await import("@/lib/appointmentUtils");
        
        const appointmentResult = await createAppointmentFromOrder({
          orderId: orderData.id,
          orderNumber: orderData.order_number,
          userId: user.id,
          clientEmail: clientIdData.email || profile?.email || user.email || "",
          clientPhone: clientIdData.phone || profile?.phone || "",
          clientName: `${clientIdData.firstName} ${clientIdData.lastName}`,
          serviceType: isFrench ? selectedPlan.name : (selectedPlan.nameEn || selectedPlan.name),
          category: "TV + Internet",
          serviceAddress: address,
          serviceCity: addressValidation?.city || "",
          servicePostalCode: addressValidation?.postalCode || "",
          scheduledDate: selectedDate,
          scheduledTime: selectedTime,
          installationMethod: installationMethod,
          deliveryFee: installationMethod === "auto" ? 30 : 0,
          installationFee: installationMethod === "technician" ? 50 : 0,
          equipmentDetails: [
            { type: "router", name: "Nivra Born Wifi", fee: 60 },
            { type: "terminal", name: "Nivra 4K Smart Terminal", quantity: terminalCount, fee: terminalFee }
          ],
          notes: notes || "",
        });

        if (!appointmentResult.success) {
          console.error("Appointment creation failed:", appointmentResult.error);
          // Don't throw - order was created successfully, appointment creation is secondary
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
    
    // Validate ID data
    const idValidation = validateIDData(clientIdData, false);
    if (!idValidation.valid) {
      toast.error(isFrench ? "Veuillez compléter toutes les informations d'identité" : "Please complete all identity information");
      return;
    }
    
    if (!routerAcknowledged) {
      toast.error(isFrench ? "Veuillez confirmer l'achat de l'équipement" : "Please confirm equipment purchase");
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
      if (date.getDay() !== 0) {
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
    blue: { bg: "bg-blue-500/15", text: "text-blue-500", border: "border-blue-500" },
    cyan: { bg: "bg-cyan-500/15", text: "text-cyan-500", border: "border-cyan-500" },
    emerald: { bg: "bg-emerald-500/15", text: "text-emerald-500", border: "border-emerald-500" },
    purple: { bg: "bg-purple-500/15", text: "text-purple-500", border: "border-purple-500" },
    amber: { bg: "bg-amber-500/15", text: "text-amber-500", border: "border-amber-500" },
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
            <Tv className="w-8 h-8 text-purple-500" />
            {isFrench ? "Commander TV + Internet" : "Order TV + Internet"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isFrench ? "Forfaits TV avec Internet inclus au Québec" : "TV plans with Internet included in Quebec"}
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
              <div className={`flex items-center gap-2 ${step >= s.num ? "text-purple-500" : "text-muted-foreground"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step > s.num ? "bg-emerald-500 text-white" : step === s.num ? "bg-purple-500 text-white" : "bg-muted"
                }`}>
                  {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                </div>
                <span className="text-xs font-medium hidden md:inline">{s.label}</span>
              </div>
              {i < arr.length - 1 && (
                <div className="flex-1 h-0.5 bg-muted">
                  <div className={`h-full transition-all ${step > s.num ? "bg-emerald-500 w-full" : step === s.num ? "bg-purple-500 w-1/2" : "w-0"}`} />
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
                  <MapPin className="w-5 h-5 text-purple-500" />
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
                          ? "Nos services TV + Internet sont exclusivement disponibles pour les adresses au Québec."
                          : "Our TV + Internet services are exclusively available for Quebec addresses."}
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

                {/* Blocked */}
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
                            ? "Désolé, nos services ne sont pas disponibles à cette adresse. Nous desservons uniquement le Québec."
                            : "Sorry, our services are not available at this address. We only serve Quebec."}
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
                  <Tv className="w-5 h-5 text-purple-500" />
                  {isFrench ? "Choisissez votre forfait TV + Internet" : "Choose your TV + Internet plan"}
                </CardTitle>
                <CardDescription>
                  {isFrench 
                    ? "Tous les forfaits incluent Internet et le tableau de bord streaming (navigateur uniquement, aucune application)."
                    : "All plans include Internet and browser-based streaming dashboard (no app required)."}
                </CardDescription>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {TV_PLANS.map((plan) => {
                const colors = colorClasses[plan.color];
                const isSelected = selectedPlan?.id === plan.id;
                const badge = isFrench ? plan.badge : plan.badgeEn;
                const channelType = isFrench ? plan.channelType.fr : plan.channelType.en;

                return (
                  <Card
                    key={plan.id}
                    className={`cursor-pointer transition-all hover:shadow-lg relative overflow-hidden ${
                      isSelected
                        ? `${colors.border} bg-card shadow-lg`
                        : "border-border hover:border-purple-500/50"
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
                        <div className="flex items-center justify-center gap-2 mb-4">
                          <div className={`w-12 h-12 rounded-full ${colors.bg} flex items-center justify-center`}>
                            <Tv className={`w-6 h-6 ${colors.text}`} />
                          </div>
                          <span className="text-muted-foreground">+</span>
                          <div className="w-12 h-12 rounded-full bg-cyan-500/15 flex items-center justify-center">
                            <Wifi className="w-6 h-6 text-cyan-500" />
                          </div>
                        </div>
                        <h3 className="text-lg font-bold text-foreground">{isFrench ? plan.name : (plan.nameEn || plan.name)}</h3>
                        <div className="mt-2">
                          {plan.previousPrice && (
                            <span className="text-lg text-muted-foreground line-through mr-2">${plan.previousPrice}</span>
                          )}
                          <span className="text-3xl font-bold text-foreground">${plan.price}</span>
                          <span className="text-sm font-normal text-muted-foreground">/mois</span>
                        </div>
                        <Badge variant="outline" className={`mt-2 ${colors.text} border-current/30`}>
                          {plan.channels} {channelType}
                        </Badge>
                      </div>

                      <Separator className="my-4" />

                      <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-2">
                          <Check className={`w-4 h-4 ${colors.text} flex-shrink-0`} />
                          <span className="text-muted-foreground">Internet {plan.internetSpeed}</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <Check className={`w-4 h-4 ${colors.text} flex-shrink-0`} />
                          <span className="text-muted-foreground">{plan.channels} {isFrench ? "chaînes" : "channels"}</span>
                        </li>
                        {plan.channelChoices > 0 && (
                          <li className="flex items-center gap-2">
                            <Check className={`w-4 h-4 ${colors.text} flex-shrink-0`} />
                            <span className="text-muted-foreground">{plan.channelChoices} {isFrench ? "chaînes au choix" : "channels of choice"}</span>
                          </li>
                        )}
                        <li className="flex items-center gap-2">
                          <Check className={`w-4 h-4 ${colors.text} flex-shrink-0`} />
                          <span className="text-muted-foreground">Nivra 4K Smart Terminal</span>
                        </li>
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

        {/* Step 3: Equipment & Installation */}
        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Terminal Selection */}
              <Card className="bg-card border-purple-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-purple-500" />
                    Nivra 4K Smart Terminal
                  </CardTitle>
                  <CardDescription>
                    {isFrench 
                      ? "Terminal 4K avec télécommande vocale. Maximum 4 terminaux par adresse."
                      : "4K terminal with voice control remote. Maximum 4 terminals per address."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{isFrench ? "Nombre de terminaux" : "Number of terminals"}</p>
                      <p className="text-sm text-muted-foreground">${TERMINAL_DETAILS.price} {isFrench ? "par terminal" : "per terminal"}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => setTerminalCount(Math.max(1, terminalCount - 1))}
                        disabled={terminalCount <= 1}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="text-2xl font-bold w-8 text-center">{terminalCount}</span>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => setTerminalCount(Math.min(TERMINAL_DETAILS.maxQuantity, terminalCount + 1))}
                        disabled={terminalCount >= TERMINAL_DETAILS.maxQuantity}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
                      <Shield className="w-3 h-3 mr-1" />
                      {isFrench ? TERMINAL_DETAILS.warranty.fr : TERMINAL_DETAILS.warranty.en}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Router */}
              <Card className="bg-card border-cyan-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Router className="w-5 h-5 text-cyan-500" />
                    {ROUTER_DETAILS.name}
                  </CardTitle>
                  <CardDescription>
                    {isFrench 
                      ? "Routeur haute performance requis pour le service Internet."
                      : "High-performance router required for Internet service."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">${ROUTER_DETAILS.price} {isFrench ? "frais uniques" : "one-time fee"}</p>
                      <p className="text-sm text-muted-foreground">
                        {isFrench ? ROUTER_DETAILS.warranty.fr : ROUTER_DETAILS.warranty.en}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-cyan-500 border-cyan-500/30">
                      <Shield className="w-3 h-3 mr-1" />
                      {isFrench ? "Inclus" : "Included"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="router-ack" 
                      checked={routerAcknowledged}
                      onCheckedChange={(checked) => setRouterAcknowledged(checked === true)}
                    />
                    <Label htmlFor="router-ack" className="text-sm">
                      {isFrench 
                        ? "Je confirme l'achat de l'équipement Nivra (terminal + routeur)"
                        : "I confirm the purchase of Nivra equipment (terminal + router)"}
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
                        installationMethod === "technician" ? "border-purple-500 bg-purple-500/5" : "border-border"
                      }`} onClick={() => setInstallationMethod("technician")}>
                        <RadioGroupItem value="technician" id="technician" className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor="technician" className="text-base font-medium cursor-pointer flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-purple-500" />
                            {isFrench ? "Installation par technicien Nivra" : "Nivra Technician Installation"}
                          </Label>
                          <p className="text-sm text-muted-foreground mt-1">
                            {isFrench 
                              ? "Un technicien Nivra se déplace chez vous pour l'installation. Frais d'installation: $50"
                              : "A Nivra technician comes to your home for installation. Installation fee: $50"}
                          </p>
                        </div>
                        <Badge className="bg-purple-500">{isFrench ? "Recommandé" : "Recommended"}</Badge>
                      </div>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>

              {/* Identity Verification */}
              <Card className="bg-card border-amber-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-amber-500" />
                    {isFrench ? "Vérification d'identité" : "Identity Verification"}
                  </CardTitle>
                  <CardDescription>
                    {isFrench 
                      ? "Une pièce d'identité gouvernementale est requise pour valider toute commande. Aucune vérification de crédit."
                      : "A government ID is required to validate any order. No credit check."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ClientIDVerificationForm
                    data={clientIdData}
                    onChange={setClientIdData}
                    isFrench={isFrench}
                  />
                </CardContent>
              </Card>

              {/* Installation Scheduling */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-purple-500" />
                    {isFrench ? "Planification de l'installation" : "Installation Scheduling"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{isFrench ? "Date préférée" : "Preferred Date"}</Label>
                      <select 
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full p-2 border rounded-md bg-background"
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
                      <Label>{isFrench ? "Plage horaire" : "Time Slot"}</Label>
                      <select 
                        value={selectedTime}
                        onChange={(e) => setSelectedTime(e.target.value)}
                        className="w-full p-2 border rounded-md bg-background"
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

              {/* Promo Code */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    {isFrench ? "Code promo" : "Promo Code"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input 
                      placeholder={isFrench ? "Entrez votre code" : "Enter your code"}
                      value={discountCode}
                      onChange={(e) => setDiscountCode(e.target.value)}
                    />
                    <Button variant="outline" onClick={applyDiscountCode}>
                      {isFrench ? "Appliquer" : "Apply"}
                    </Button>
                  </div>
                  {installationCredit > 0 && (
                    <p className="text-sm text-emerald-500 mt-2">
                      {isFrench ? `Crédit d'installation: -$${installationCredit}` : `Installation credit: -$${installationCredit}`}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Notes */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>{isFrench ? "Notes additionnelles" : "Additional Notes"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea 
                    placeholder={isFrench ? "Instructions spéciales pour l'installation..." : "Special installation instructions..."}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Order Summary Sidebar */}
            <div className="space-y-6">
              <Card className="bg-card border-border sticky top-6">
                <CardHeader>
                  <CardTitle>{isFrench ? "Résumé de la commande" : "Order Summary"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Selected Plan */}
                  {selectedPlan && (
                    <div className="p-3 bg-purple-500/10 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Tv className="w-4 h-4 text-purple-500" />
                        <span className="font-medium">{isFrench ? selectedPlan.name : (selectedPlan.nameEn || selectedPlan.name)}</span>
                      </div>
                      <p className="text-lg font-bold mt-1">${selectedPlan.price}/{isFrench ? "mois" : "month"}</p>
                    </div>
                  )}

                  <Separator />

                  {/* One-time fees */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>{terminalCount}x Nivra 4K Smart Terminal</span>
                      <span>${terminalFee}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Nivra Born Wifi Router</span>
                      <span>${routerFee}</span>
                    </div>
                    {installationMethod === "auto" && (
                      <div className="flex justify-between">
                        <span>{isFrench ? "Livraison" : "Delivery"}</span>
                        <span>${deliveryFee}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>{isFrench ? "Activation" : "Activation"}</span>
                      <span>${activationFee}</span>
                    </div>
                    {installationMethod === "technician" && (
                      <div className="flex justify-between">
                        <span>{isFrench ? "Installation technicien" : "Technician Installation"}</span>
                        <span>${installationFee}</span>
                      </div>
                    )}
                    {installationCredit > 0 && (
                      <div className="flex justify-between text-emerald-500">
                        <span>{isFrench ? "Crédit promo" : "Promo credit"}</span>
                        <span>-${installationCredit}</span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Taxes */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>TPS (5%)</span>
                      <span>${tpsAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>TVQ (9.975%)</span>
                      <span>${tvqAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  <Separator />

                  {/* Total */}
                  <div className="flex justify-between font-bold text-lg">
                    <span>{isFrench ? "Total à payer maintenant" : "Total due now"}</span>
                    <span>${totalDueNow.toFixed(2)}</span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {isFrench 
                      ? `Mensualité: $${planPrice}/mois (facturée après activation)`
                      : `Monthly: $${planPrice}/month (billed after activation)`}
                  </p>

                  {/* Terms */}
                  <div className="flex items-start gap-2 pt-4">
                    <Checkbox 
                      id="terms" 
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                    />
                    <Label htmlFor="terms" className="text-xs text-muted-foreground">
                      {isFrench 
                        ? "J'accepte les termes et conditions de Nivra Communications. Aucune vérification de crédit. Paiement facturé directement au client."
                        : "I accept Nivra Communications terms and conditions. No credit check. Client pays directly."}
                    </Label>
                  </div>
                </CardContent>
              </Card>

              {/* Navigation */}
              <div className="flex flex-col gap-2">
                <Button 
                  variant="hero" 
                  size="lg" 
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={createOrderMutation.isPending || !routerAcknowledged || !validateIDData(clientIdData, false).valid || !termsAccepted || !selectedDate || !selectedTime}
                >
                  {createOrderMutation.isPending ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      {isFrench ? "Confirmer la commande" : "Confirm Order"}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {isFrench ? "Retour" : "Back"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Order Confirmation */}
        {step === 5 && createdOrder && (
          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-emerald-500/10 via-card to-card border-emerald-500/30">
              <CardHeader className="text-center pb-2">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </div>
                <CardTitle className="text-2xl md:text-3xl text-emerald-500">
                  {isFrench ? "Commande confirmée!" : "Order Confirmed!"}
                </CardTitle>
                <p className="text-muted-foreground">
                  {isFrench ? "Numéro de commande" : "Order number"}: <span className="font-mono font-bold text-foreground">{createdOrder.order_number}</span>
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Order Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      {isFrench ? "Détails de la commande" : "Order Details"}
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{isFrench ? "Forfait" : "Plan"}</span>
                        <span className="font-medium">{selectedPlan?.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{isFrench ? "Terminaux" : "Terminals"}</span>
                        <span className="font-medium">{terminalCount}x Nivra 4K Smart Terminal</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{isFrench ? "Installation" : "Installation"}</span>
                        <span className="font-medium">{installationMethod === "auto" ? (isFrench ? "Auto-installation" : "Self-installation") : (isFrench ? "Technicien Nivra" : "Nivra Technician")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      {isFrench ? "Montant payé" : "Amount Paid"}
                    </h3>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-3xl font-bold text-foreground">${totalDueNow.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {isFrench ? `Mensualité: $${planPrice}/mois` : `Monthly: $${planPrice}/month`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Next Steps */}
                <Card className="bg-muted/30 border-border">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Info className="w-5 h-5 text-purple-500" />
                      {isFrench ? "Prochaines étapes" : "Next Steps"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-3 text-sm">
                      <li className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-purple-500">1</span>
                        </div>
                        <span>{isFrench ? "Confirmation par courriel dans les prochaines minutes" : "Email confirmation within the next few minutes"}</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-purple-500">2</span>
                        </div>
                        <span>{isFrench ? "Appel de vérification d'identité sous 24-48h" : "Identity verification call within 24-48h"}</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-purple-500">3</span>
                        </div>
                        <span>{isFrench ? "Livraison de l'équipement sous 48-72h ouvrables" : "Equipment delivery within 48-72 business hours"}</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-purple-500">4</span>
                        </div>
                        <span>{installationMethod === "technician" 
                          ? (isFrench ? "Installation par technicien Nivra à la date convenue" : "Nivra technician installation on the agreed date")
                          : (isFrench ? "Auto-installation avec guide inclus" : "Self-installation with included guide")}</span>
                      </li>
                    </ol>
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button variant="hero" className="flex-1" onClick={() => navigate("/portal/orders")}>
                    {isFrench ? "Voir mes commandes" : "View My Orders"}
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => navigate("/portal")}>
                    {isFrench ? "Retour au tableau de bord" : "Back to Dashboard"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </ClientLayout>
  );
};

export default ClientTVOrder;
