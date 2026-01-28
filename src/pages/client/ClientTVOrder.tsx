import { useState, useCallback, useEffect, useMemo, useRef } from "react";
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
import { useClientAuth } from "@/hooks/useClientAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { portalClient as supabase } from "@/integrations/backend/portalClient";
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
  Minus,
  Play
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { useLanguage } from "@/contexts/LanguageContext";
import { AddressAutocomplete, type AddressValue } from "@/components/shared/AddressAutocomplete";
import { ClientIDVerificationForm, ClientIDData, validateIDData } from "@/components/client/ClientIDVerificationForm";
import { PortalPinSetupSection } from "@/components/checkout/PortalPinSetupSection";
import { PortalTVChannelSelection } from "@/components/checkout/PortalTVChannelSelection";
import { PortalStreamingServiceSelection } from "@/components/checkout/PortalStreamingServiceSelection";
import { StreamingCatalogItem } from "@/hooks/usePortalStreamingCatalog";
import { CheckoutPaymentSection, CheckoutPhoneField, validateCanadianPhone, CheckoutEssentialTerms, AutoPayPalOption } from "@/components/checkout";
import { verifyPortalSensitiveActionAllowed } from "@/lib/portalSecurityUtils";
import { useOrderDraft, OrderDraft } from "@/hooks/useOrderDraft";
import { checkAccountBlockedForAction } from "@/lib/accountBlockCheck";
import { useClientBlockStatus } from "@/hooks/useClientBlockStatus";
import BlockedActionWrapper from "@/components/client/BlockedActionWrapper";
import { buildOrderLineItems, wrapLineItemsForOrder } from "@/lib/orderLineItems";

// Channel interface
interface Channel {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number;
  is_hd: boolean;
  is_4k: boolean;
  is_active: boolean;
  base_pack: string | null;
}

// Using StreamingCatalogItem from useStreamingCatalog hook

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
    includesInternet: true,
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
    includesInternet: true,
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
    includesInternet: true,
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
    includesInternet: true,
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
    includesInternet: true,
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
  const { user } = useClientAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const isFrench = language === 'fr';
  const { isAccountBlocked } = useClientBlockStatus();
  
  // Idempotency key: generated once per checkout session to prevent duplicate orders
  // Using useRef ensures it's stable across re-renders and never regenerates
  const clientRequestIdRef = useRef(crypto.randomUUID());
  const clientRequestId = clientRequestIdRef.current;
  
  // Synchronous guard to prevent double-click race conditions
  const submittingRef = useRef(false);

  const locationState = location.state as LocationState | null;

  // Use the order draft hook for persistent state
  const {
    draft,
    isHydrated,
    setStep,
    setAddress: setDraftAddress,
    selectPlan,
    setFreeChannels,
    setPremiumChannels,
    setStreamingServices,
    setTerminalCount: setDraftTerminalCount,
    setInstallationMethod: setDraftInstallationMethod,
    setSchedule,
    setPromo,
    setNotes: setDraftNotes,
    clearDraft,
  } = useOrderDraft({
    orderType: 'tv',
    initialAddress: locationState?.validatedAddress,
    initialAddressDetails: locationState?.addressDetails,
    initialPlanId: locationState?.selectedPlanId,
  });

  // Derive step from draft
  const step = draft.currentStep;
  
  // Derive address state from draft
  const address = draft.address;
  const addressValidation = draft.addressValidation;
  const addressBlocked = draft.addressValidation?.isQuebec === false;
  
  // Derive selected plan from draft
  const selectedPlan = useMemo(() => {
    if (!draft.selectedPlanId) return null;
    return TV_PLANS.find(p => p.id === draft.selectedPlanId) || null;
  }, [draft.selectedPlanId]);
  
  // Channel selection state - derived from draft IDs + actual channel objects
  const [selectedFreeChannels, setSelectedFreeChannelsState] = useState<Channel[]>([]);
  const [selectedPremiumChannels, setSelectedPremiumChannelsState] = useState<Channel[]>([]);
  
  // Streaming services state - derived from draft IDs + actual service objects
  const [selectedStreamingServices, setSelectedStreamingServicesState] = useState<StreamingCatalogItem[]>([]);
  
  // Equipment - from draft
  const terminalCount = draft.terminalCount;
  const routerAcknowledged = true;
  
  // Installation method from draft
  const installationMethod = draft.installationMethod;
  
  // Scheduling from draft
  const selectedDate = draft.selectedDate;
  const selectedTime = draft.selectedTime;
  
  // Promo from draft
  const discountCode = draft.discountCode;
  const installationCredit = draft.installationCredit;
  
  // Notes from draft
  const notes = draft.notes;

  // Wrapper functions to update draft state
  const setAddress = useCallback((value: string) => {
    if (!value) {
      setDraftAddress('', null);
    }
  }, [setDraftAddress]);

  const handleAddressValidation = useCallback((validation: OrderDraft['addressValidation'] | null, formattedAddress: string) => {
    setDraftAddress(formattedAddress, validation);
  }, [setDraftAddress]);

  const setSelectedPlan = useCallback((plan: typeof TV_PLANS[0] | null) => {
    selectPlan(plan?.id || null);
    // Clear channel selections when plan changes
    setSelectedFreeChannelsState([]);
    setSelectedPremiumChannelsState([]);
  }, [selectPlan]);

  const setSelectedFreeChannels = useCallback((channels: Channel[]) => {
    setSelectedFreeChannelsState(channels);
    setFreeChannels(channels.map(c => c.id));
  }, [setFreeChannels]);

  const setSelectedPremiumChannels = useCallback((channels: Channel[]) => {
    setSelectedPremiumChannelsState(channels);
    setPremiumChannels(channels.map(c => c.id));
  }, [setPremiumChannels]);

  const setSelectedStreamingServices = useCallback((services: StreamingCatalogItem[]) => {
    setSelectedStreamingServicesState(services);
    setStreamingServices(services.map(s => s.id));
  }, [setStreamingServices]);

  const setTerminalCount = useCallback((count: number) => {
    setDraftTerminalCount(count);
  }, [setDraftTerminalCount]);

  const setInstallationMethod = useCallback((method: "auto" | "technician") => {
    setDraftInstallationMethod(method);
  }, [setDraftInstallationMethod]);

  const setSelectedDate = useCallback((date: string) => {
    setSchedule(date, selectedTime);
  }, [setSchedule, selectedTime]);

  const setSelectedTime = useCallback((time: string) => {
    setSchedule(selectedDate, time);
  }, [setSchedule, selectedDate]);

  const setDiscountCode = useCallback((code: string) => {
    setPromo(code, installationCredit);
  }, [setPromo, installationCredit]);

  const setInstallationCredit = useCallback((credit: number) => {
    setPromo(discountCode, credit);
  }, [setPromo, discountCode]);

  const setNotes = useCallback((value: string) => {
    setDraftNotes(value);
  }, [setDraftNotes]);
  
  // Order details - local state (not persisted)
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [essentialTermsAcknowledged, setEssentialTermsAcknowledged] = useState(false);
  
  // Order result
  const [createdOrder, setCreatedOrder] = useState<any>(null);

  // Phone field for checkout
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");

  // Payment method state
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"saved" | "new" | "etransfer" | "paypal">("etransfer");
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
  
  // PayPal capture ID when payment is completed via PayPal
  const [paypalCaptureId, setPaypalCaptureId] = useState("");
  
  // Auto-billing PayPal option with $5 discount
  const [enableAutoBilling, setEnableAutoBilling] = useState(false);
  const AUTO_BILLING_DISCOUNT = 5;

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

  // Handle address selection
  const handleAddressSelect = useCallback((details: AddressValue) => {
    const postalCode = details.postalCode || "";
    const region = details.region || "";
    
    const isQuebecPostal = /^[GHJ]/i.test(postalCode);
    const isQuebecRegion = region.toUpperCase() === "QC";
    const isQuebec = isQuebecPostal || isQuebecRegion;
    
    const validation: OrderDraft['addressValidation'] = {
      isValid: true,
      isQuebec,
      formattedAddress: details.formatted,
      city: details.city || "",
      province: isQuebec ? "QC" : region,
      postalCode: postalCode
    };
    
    handleAddressValidation(validation, details.line1);
    
    if (isQuebec) {
      toast.success(isFrench ? "Adresse validée! Service disponible." : "Address validated! Service available.");
    } else {
      toast.error(isFrench ? "Désolé, nos services sont disponibles uniquement au Québec." : "Sorry, our services are only available in Quebec.");
    }
  }, [isFrench, handleAddressValidation]);

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
  const premiumChannelsTotal = selectedPremiumChannels.reduce((sum, ch) => sum + (ch.price || 0), 0);
  const streamingTotal = selectedStreamingServices.reduce((sum, s) => sum + s.price_monthly, 0);
  const monthlyRecurring = planPrice + premiumChannelsTotal + streamingTotal;
  
  const terminalFee = TERMINAL_DETAILS.price * terminalCount;
  const routerFee = ROUTER_DETAILS.price;
  const deliveryFee = installationMethod === "auto" ? 30 : 0;
  const activationFee = 25;
  const installationFee = installationMethod === "technician" ? Math.max(0, 50 - installationCredit) : 0;
  const oneTimeTotal = terminalFee + routerFee + deliveryFee + activationFee + installationFee;
  const tpsAmount = Math.round((oneTimeTotal) * 0.05 * 100) / 100;
  const tvqAmount = Math.round((oneTimeTotal) * 0.09975 * 100) / 100;
  const totalDueNow = oneTimeTotal + tpsAmount + tvqAmount;

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id || !selectedPlan) throw new Error("Not authenticated or no plan selected");

      const { allowed, reason } = await verifyPortalSensitiveActionAllowed(user.id);
      if (!allowed) {
        throw new Error(reason || "Action non autorisée - compte suspendu");
      }

      // Update profile with phone
      const phoneDigits = checkoutPhone.replace(/\D/g, "");
      const profileUpdate: any = {
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
      };

      if (securityPin && securityPin.length === 4 && securityPin === confirmSecurityPin) {
        profileUpdate.client_pin = securityPin;
        profileUpdate.pin_failed_attempts = 0;
        profileUpdate.pin_lockout_until = null;
      }

      const { error: profileError } = await supabase.from("profiles").update(profileUpdate).eq("user_id", user.id);

      if (profileError) {
        console.error("Profile update error:", profileError);
      }

      // Build payment reference info (without storing CVV)
      // SECURITY: Extract only safe metadata from card - NEVER send PAN/CVV to backend
      const { extractCardMetadata } = await import("@/lib/validation");
      
      const paymentInfo = selectedPaymentMethod === "saved" 
        ? {
            method: "saved_card",
            card_id: selectedCardId,
            card_type: savedCards?.find((c: any) => c.id === selectedCardId)?.card_type,
            last_four: savedCards?.find((c: any) => c.id === selectedCardId)?.last_four,
          }
        : (() => {
            const metadata = extractCardMetadata(newCardData.cardNumber, newCardData.expiry);
            return {
              method: "new_card",
              card_type: metadata?.brand || "Card",
              last_four: metadata?.last4 || "****",
              exp_month: metadata?.expMonth,
              exp_year: metadata?.expYear,
            };
          })();

      // Build selected channels data
      const selectedChannelsData = [
        ...selectedFreeChannels.map(ch => ({
          id: ch.id,
          name: ch.name,
          category: "free_choice",
          price: 0,
          is_hd: ch.is_hd,
          is_4k: ch.is_4k,
        })),
        ...selectedPremiumChannels.map(ch => ({
          id: ch.id,
          name: ch.name,
          category: "premium",
          price: ch.price,
          is_hd: ch.is_hd,
          is_4k: ch.is_4k,
        })),
      ];

      // Build structured line_items for contract PDF
      const lineItems = buildOrderLineItems({
        services: [
          {
            type: "Internet" as const,
            name: "Internet " + (isFrench ? selectedPlan.name : (selectedPlan.nameEn || selectedPlan.name)),
            price: planPrice,
            priceLabel: "/mois",
          },
          {
            type: "TV" as const,
            name: "TV " + (isFrench ? selectedPlan.name : (selectedPlan.nameEn || selectedPlan.name)),
            price: premiumChannelsTotal,
            priceLabel: "/mois",
            description: `${selectedPremiumChannels.length} chaînes premium`,
          },
          ...selectedStreamingServices.map((s) => ({
            type: "Streaming" as const,
            name: s.name,
            price: s.price_monthly,
            priceLabel: "/mois",
            refId: s.id,
          })),
        ].filter((s) => s.price > 0 || s.type !== "TV"),
        equipment: [
          { name: "Routeur Nivra Born WiFi", quantity: 1, unitPrice: routerFee },
          { name: "Terminal Nivra 4K Smart", quantity: terminalCount, unitPrice: TERMINAL_DETAILS.price },
        ],
        fees: [
          ...(activationFee > 0 ? [{ name: "Frais d'activation", amount: activationFee }] : []),
          ...(deliveryFee > 0 ? [{ name: "Frais de livraison", amount: deliveryFee }] : []),
          ...(installationFee > 0 ? [{ name: "Installation professionnelle", amount: installationFee }] : []),
        ],
      });

      // Use upsert with client_request_id for idempotency — if this request was already processed, return existing order
      const { data: orderData, error: orderError } = await supabase.from("orders").upsert({
        client_request_id: clientRequestId,
        user_id: user.id,
        client_email: clientIdData.email || profile?.email || user.email,
        service_type: isFrench ? selectedPlan.name : (selectedPlan.nameEn || selectedPlan.name),
        category: "TV + Internet",
        subtotal: monthlyRecurring,
        total_amount: totalDueNow,
        delivery_fee: installationMethod === "auto" ? 30 : 0,
        activation_fee: activationFee,
        installation_fee: installationMethod === "technician" ? 50 : 0,
        installation_credit: installationCredit,
        discount_code: discountCode || null,
        status: "pending",
        payment_status: selectedPaymentMethod === "paypal" && paypalCaptureId ? "captured" : "pre_authorized",
        payment_method: selectedPaymentMethod === "paypal" ? "paypal" : selectedPaymentMethod === "etransfer" ? "etransfer" : "card",
        payment_reference: selectedPaymentMethod === "paypal" && paypalCaptureId ? paypalCaptureId : null,
        preauth_card_id: selectedPaymentMethod === "saved" ? selectedCardId : null,
        preauth_discount: 0,
        tps_amount: tpsAmount,
        tvq_amount: tvqAmount,
        installation_type: installationMethod,
        appointment_date: selectedDate ? new Date(selectedDate).toISOString() : null,
        created_by: "client",
        selected_channels: selectedChannelsData,
        terminal_count: terminalCount,
        terminal_fee: terminalFee,
        router_fee: routerFee,
        equipment_details: wrapLineItemsForOrder(lineItems),
        notes: `${isFrench ? "Téléphone" : "Phone"}: ${checkoutPhone}
${isFrench ? "Adresse d'installation" : "Installation address"}: ${address}
${isFrench ? "Méthode d'installation" : "Installation method"}: ${installationMethod === "auto" ? (isFrench ? "Auto-installation" : "Self-installation") : (isFrench ? "Technicien Nivra" : "Nivra Technician")}
${isFrench ? "Date préférée" : "Preferred date"}: ${selectedDate ? format(new Date(selectedDate), "d MMMM yyyy", { locale: isFrench ? fr : undefined }) : "N/A"} ${selectedTime}
${isFrench ? "Nombre de terminaux" : "Number of terminals"}: ${terminalCount}
${isFrench ? "Chaînes au choix" : "Free choice channels"}: ${selectedFreeChannels.length}
${isFrench ? "Chaînes premium" : "Premium channels"}: ${selectedPremiumChannels.length}
${isFrench ? "Services streaming" : "Streaming services"}: ${selectedStreamingServices.map(s => s.name).join(", ") || "Aucun"}
${isFrench ? "Paiement" : "Payment"}: ${paymentInfo.card_type} ****${paymentInfo.last_four} (${isFrench ? "Dépôt préautorisé" : "Pre-authorized deposit"})
${notes || ""}`.trim(),
        internal_notes: `Equipment: Nivra Born Wifi Router ($60) + ${terminalCount}x Nivra 4K Smart Terminal ($${terminalFee})
Monthly: Plan $${planPrice} + Premium Channels $${premiumChannelsTotal} + Streaming $${streamingTotal} = $${monthlyRecurring}/mo
Payment: ${JSON.stringify(paymentInfo)}
Deposit: $${totalDueNow.toFixed(2)} pre-authorized`,
      } as any, {
        onConflict: 'client_request_id',
        ignoreDuplicates: false,
      }).select().single();

      if (orderError) throw orderError;
      if (!orderData) throw new Error("Order creation failed - no data returned");

      // Post-order steps wrapped in try-catch to not block order success
      // Create streaming subscriptions if any
      if (selectedStreamingServices.length > 0) {
        try {
          const subscriptions = selectedStreamingServices.map(service => ({
            user_id: user.id,
            streaming_service_id: service.id,
            monthly_price: service.price_monthly,
            status: "pending",
            internal_notes: `Created with order ${orderData.order_number}`,
          }));
          
          await supabase.from("client_streaming_subscriptions").insert(subscriptions);
        } catch (streamErr) {
          console.error("Streaming subscription creation failed:", streamErr);
        }
      }

      // Create appointment if scheduled
      if (selectedDate && selectedTime) {
        try {
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
          }
        } catch (apptErr) {
          console.error("Appointment step failed:", apptErr);
        }
      }

      return orderData;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["client-orders-all"] });
      queryClient.invalidateQueries({ queryKey: ["client-profile"] });
      queryClient.invalidateQueries({ queryKey: ["client-appointments-all"] });
      
      // Send confirmation email (non-blocking)
      try {
        const servicesForEmail = selectedPlan ? [{ name: selectedPlan.name, price: selectedPlan.price, period: "mois" }] : [];
        if (selectedPremiumChannels.length > 0) {
          servicesForEmail.push({ name: `Chaînes premium (${selectedPremiumChannels.length})`, price: premiumChannelsTotal, period: "mois" });
        }
        if (selectedStreamingServices.length > 0) {
          servicesForEmail.push({ name: `Streaming (${selectedStreamingServices.length})`, price: streamingTotal, period: "mois" });
        }
        
        await supabase.functions.invoke("send-order-confirmation", {
          body: {
            order_id: data.id,
            client_email: profile?.email || user?.email,
            client_first_name: profile?.full_name?.split(" ")[0] || "Client",
            order_number: data.order_number,
            services: servicesForEmail,
            monthly_total_tax_in: monthlyRecurring * 1.14975,
            one_time_total: totalDueNow,
            delivery_method: installationMethod,
            payment_reference: data.payment_reference,
          },
        });
        console.log("[OrderConfirmation] Email request sent for order:", data.order_number);
      } catch (emailErr) {
        console.error("[OrderConfirmation] Email sending failed (non-blocking):", emailErr);
      }
      
      setCreatedOrder(data);
      // Clear the draft after successful order
      clearDraft();
      setStep(5);
    },
    onError: (error) => {
      console.error("Order creation error:", error);
      toast.error(isFrench ? "Erreur lors de la soumission de la commande" : "Error submitting order");
    },
    onSettled: () => {
      // Reset the submit guard so user can try again if it truly failed
      submittingRef.current = false;
    },
  });

  const handleSubmit = async () => {
    // Prevent double-click race condition with synchronous guard
    if (submittingRef.current) return;
    submittingRef.current = true;
    
    // SERVER-SIDE: Check if account is blocked before proceeding
    const blockCheck = await checkAccountBlockedForAction(user?.id || "");
    if (!blockCheck.allowed) {
      submittingRef.current = false;
      toast.error(blockCheck.errorMessage);
      return;
    }
    
    if (!selectedPlan) {
      submittingRef.current = false;
      toast.error(isFrench ? "Veuillez sélectionner un forfait" : "Please select a plan");
      return;
    }

    // Validate phone number
    if (!validateCanadianPhone(checkoutPhone)) {
      submittingRef.current = false;
      setPhoneError(isFrench ? "Numéro de téléphone canadien invalide" : "Invalid Canadian phone number");
      toast.error(isFrench ? "Veuillez entrer un numéro de téléphone valide" : "Please enter a valid phone number");
      return;
    }
    setPhoneError("");
    
    // Validate payment method
    if (selectedPaymentMethod === "saved") {
      if (!selectedCardId) {
        submittingRef.current = false;
        toast.error(isFrench ? "Veuillez sélectionner une carte" : "Please select a card");
        return;
      }
      if (!savedCardCvv || savedCardCvv.length < 3) {
        submittingRef.current = false;
        setCvvError(isFrench ? "CVV requis (3-4 chiffres)" : "CVV required (3-4 digits)");
        toast.error(isFrench ? "Veuillez entrer le CVV de votre carte" : "Please enter your card CVV");
        return;
      }
      setCvvError("");
    } else {
      if (!newCardData.cardNumber || !newCardData.cardName || !newCardData.expiry || !newCardData.cvv) {
        submittingRef.current = false;
        toast.error(isFrench ? "Veuillez compléter les informations de la carte" : "Please complete card information");
        return;
      }
    }
    
    const idValidation = validateIDData(clientIdData, false);
    if (!idValidation.valid) {
      submittingRef.current = false;
      toast.error(isFrench ? "Veuillez compléter toutes les informations d'identité" : "Please complete all identity information");
      return;
    }
    
    // Equipment is auto-attached based on plan rules - no manual confirmation needed
    
    if (!selectedDate || !selectedTime) {
      submittingRef.current = false;
      toast.error(isFrench ? "Veuillez sélectionner une date et heure d'installation" : "Please select an installation date and time");
      return;
    }
    if (!termsAccepted) {
      submittingRef.current = false;
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

  // Steps configuration - equipment is auto-attached based on plan rules
  const steps = [
    { num: 1, label: isFrench ? "Adresse" : "Address" },
    { num: 2, label: isFrench ? "Forfait" : "Plan" },
    { num: 3, label: isFrench ? "Chaînes TV" : "TV Channels" },
    { num: 4, label: isFrench ? "Confirmation" : "Confirmation" },
    { num: 5, label: isFrench ? "Terminé" : "Complete" },
  ];

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
        <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto pb-2">
          {steps.map((s, i, arr) => (
            <div key={s.num} className="flex items-center gap-2 flex-shrink-0">
              <div className={`flex items-center gap-2 ${step >= s.num ? "text-purple-500" : "text-muted-foreground"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step > s.num ? "bg-emerald-500 text-white" : step === s.num ? "bg-purple-500 text-white" : "bg-muted"
                }`}>
                  {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                </div>
                <span className="text-xs font-medium hidden md:inline">{s.label}</span>
              </div>
              {i < arr.length - 1 && (
                <div className="w-8 h-0.5 bg-muted flex-shrink-0">
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
                    onValueChange={(value) => {
                      if (!value) {
                        setDraftAddress('', null);
                      }
                    }}
                    onSelect={handleAddressSelect}
                    placeholder={isFrench ? "Ex: 123 rue Exemple, Montréal, QC H2X 1Y4" : "E.g., 123 Example St, Montreal, QC H2X 1Y4"}
                    restrictToQuebec={true}
                  />
                </div>

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
                    onClick={() => {
                      setSelectedPlan(plan);
                      // Reset channel selections when plan changes
                      setSelectedFreeChannels([]);
                      setSelectedPremiumChannels([]);
                    }}
                  >
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

            {/* Bundle conflict warning */}
            {selectedPlan?.includesInternet && (
              <Card className="bg-blue-500/10 border-blue-500/30">
                <CardContent className="py-4 flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {isFrench ? "Forfait TV + Internet" : "TV + Internet Bundle"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isFrench 
                        ? "Ce forfait inclut déjà Internet. Vous ne pouvez pas ajouter un forfait Internet séparé."
                        : "This plan already includes Internet. You cannot add a separate Internet plan."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

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

        {/* Step 3: TV Channels & Streaming */}
        {step === 3 && selectedPlan && (
          <div className="space-y-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tv className="w-5 h-5 text-purple-500" />
                  {isFrench ? "Sélection des chaînes TV" : "TV Channel Selection"}
                </CardTitle>
                <CardDescription>
                  {isFrench 
                    ? "Personnalisez votre sélection de chaînes et ajoutez des services de streaming."
                    : "Customize your channel selection and add streaming services."}
                </CardDescription>
              </CardHeader>
            </Card>

            {/* TV Channel Selection Component */}
            <PortalTVChannelSelection
              channelChoicesLimit={selectedPlan.channelChoices}
              selectedFreeChannels={selectedFreeChannels}
              selectedPremiumChannels={selectedPremiumChannels}
              onFreeChannelsChange={setSelectedFreeChannels}
              onPremiumChannelsChange={setSelectedPremiumChannels}
              isFrench={isFrench}
            />

            {/* Streaming Services */}
            <PortalStreamingServiceSelection
              selectedServices={selectedStreamingServices}
              onServicesChange={setSelectedStreamingServices}
              isFrench={isFrench}
            />

            {/* Monthly summary for this step */}
            <Card className="bg-gradient-to-r from-purple-500/10 to-cyan-500/10 border-purple-500/30">
              <CardContent className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">{isFrench ? "Récapitulatif mensuel" : "Monthly Summary"}</p>
                    <p className="text-xs text-muted-foreground">
                      {isFrench ? "Forfait" : "Plan"}: ${planPrice} + 
                      {premiumChannelsTotal > 0 && ` ${isFrench ? "Chaînes premium" : "Premium"}: $${premiumChannelsTotal}`}
                      {streamingTotal > 0 && ` + Streaming: $${streamingTotal}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{isFrench ? "Total mensuel" : "Monthly total"}</p>
                    <p className="text-2xl font-bold text-foreground">${monthlyRecurring.toFixed(2)}/{isFrench ? "mois" : "mo"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {isFrench ? "Retour" : "Back"}
              </Button>
              <Button 
                variant="hero" 
                size="lg" 
                onClick={() => setStep(4)}
              >
                {isFrench ? "Continuer" : "Continue"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Confirmation & Payment (equipment auto-attached) */}
        {step === 4 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Auto-attached Equipment Notice */}
              <Card className="bg-emerald-500/10 border-emerald-500/30">
                <CardContent className="py-4 flex items-start gap-3">
                  <Package className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">
                      {isFrench ? "Équipement inclus automatiquement" : "Equipment automatically included"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isFrench 
                        ? `Votre commande inclut: ${terminalCount}× ${TERMINAL_DETAILS.name} ($${TERMINAL_DETAILS.price}/unité) + ${ROUTER_DETAILS.name} ($${ROUTER_DETAILS.price})`
                        : `Your order includes: ${terminalCount}× ${TERMINAL_DETAILS.name} ($${TERMINAL_DETAILS.price}/unit) + ${ROUTER_DETAILS.name} ($${ROUTER_DETAILS.price})`}
                    </p>
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

              {/* Auto-Billing PayPal Option */}
              <AutoPayPalOption
                isFrench={isFrench}
                isEnabled={enableAutoBilling}
                onEnabledChange={(enabled) => {
                  setEnableAutoBilling(enabled);
                  if (enabled) setSelectedPaymentMethod("paypal");
                }}
                monthlyAmount={selectedPlan?.price || 0}
                discountAmount={AUTO_BILLING_DISCOUNT}
              />

              {/* Essential Terms - Before Payment */}
              <CheckoutEssentialTerms
                isFrench={isFrench}
                acknowledged={essentialTermsAcknowledged}
                onAcknowledgeChange={setEssentialTermsAcknowledged}
                paymentMethod={selectedPaymentMethod}
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
                onPayPalSuccess={(captureId) => {
                  setPaypalCaptureId(captureId);
                  toast.success(isFrench ? "Paiement PayPal réussi!" : "PayPal payment successful!");
                  // Invalidate all billing-related caches for instant UI updates
                  queryClient.invalidateQueries({ queryKey: ["billing-invoices"] });
                  queryClient.invalidateQueries({ queryKey: ["billing-payments"] });
                  queryClient.invalidateQueries({ queryKey: ["client-monthly-invoices"] });
                  queryClient.invalidateQueries({ queryKey: ["client-balance"] });
                  queryClient.invalidateQueries({ queryKey: ["client-ledger"] });
                  setStep(4); // Move to final confirmation
                }}
              />
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

                  {/* Channels & Streaming */}
                  {(selectedFreeChannels.length > 0 || selectedPremiumChannels.length > 0 || selectedStreamingServices.length > 0) && (
                    <div className="space-y-2 text-sm">
                      {selectedFreeChannels.length > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>{selectedFreeChannels.length} {isFrench ? "chaînes au choix" : "free channels"}</span>
                          <span className="text-emerald-500">{isFrench ? "Inclus" : "Included"}</span>
                        </div>
                      )}
                      {selectedPremiumChannels.length > 0 && (
                        <div className="flex justify-between">
                          <span>{selectedPremiumChannels.length} {isFrench ? "chaînes premium" : "premium channels"}</span>
                          <span>+${premiumChannelsTotal}/{isFrench ? "mois" : "mo"}</span>
                        </div>
                      )}
                      {selectedStreamingServices.length > 0 && (
                        <div className="flex justify-between">
                          <span className="flex items-center gap-1">
                            <Play className="w-3 h-3" />
                            {selectedStreamingServices.length} streaming
                          </span>
                          <span>+${streamingTotal}/{isFrench ? "mois" : "mo"}</span>
                        </div>
                      )}
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
                      ? `Mensualité: $${monthlyRecurring.toFixed(2)}/mois (facturée après activation)`
                      : `Monthly: $${monthlyRecurring.toFixed(2)}/month (billed after activation)`}
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
                <BlockedActionWrapper action="order" showInlineNotice={isAccountBlocked}>
                  <Button 
                    variant="hero" 
                    size="lg" 
                    className="w-full"
                    onClick={handleSubmit}
                    disabled={isAccountBlocked || createOrderMutation.isPending || !routerAcknowledged || !essentialTermsAcknowledged || !validateIDData(clientIdData, false).valid || !termsAccepted || !selectedDate || !selectedTime}
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
                </BlockedActionWrapper>
                <Button variant="outline" onClick={() => setStep(3)}>
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
                        <span className="text-muted-foreground">{isFrench ? "Chaînes" : "Channels"}</span>
                        <span className="font-medium">
                          {selectedFreeChannels.length + selectedPremiumChannels.length} {isFrench ? "sélectionnées" : "selected"}
                        </span>
                      </div>
                      {selectedStreamingServices.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Streaming</span>
                          <span className="font-medium">{selectedStreamingServices.map(s => s.name).join(", ")}</span>
                        </div>
                      )}
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
                        {isFrench ? `Mensualité: $${monthlyRecurring.toFixed(2)}/mois` : `Monthly: $${monthlyRecurring.toFixed(2)}/month`}
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
