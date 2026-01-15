import { useState, useEffect, useRef } from "react";
import React from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { ProfessionalOrderSummary } from "@/components/checkout/ProfessionalOrderSummary";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useClientAuth } from "@/hooks/useClientAuth";
import { usePortalRoleAccess } from "@/hooks/usePortalRoleAccess";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { portalClient as supabase } from "@/integrations/backend";
import { useEquipmentPrices } from "@/hooks/usePublicServices";
import { 
  ShoppingCart, 
  Smartphone, 
  Wifi, 
  Tv, 
  Shield, 
  Check,
  ArrowRight,
  ArrowLeft,
  Package,
  AlertCircle,
  User,
  FileCheck,
  CheckCircle2,
  Calendar,
  Clock,
  CreditCard,
  FileText,
  Receipt,
  Info,
  Phone,
  Mail,
  Building2,
  Truck,
  Wrench,
  Zap,
  ScrollText,
  Download,
  Printer,
  Star,
  MonitorPlay,
  Plus,
  Minus,
  CalendarPlus,
  ChevronDown,
  ChevronUp,
  MapPin
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { format, addDays, addMonths, isValid, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { verifyPortalSensitiveActionAllowed } from "@/lib/portalSecurityUtils";
import { checkAccountBlockedForAction } from "@/lib/accountBlockCheck";
import { useClientBlockStatus } from "@/hooks/useClientBlockStatus";
import BlockedActionWrapper from "@/components/client/BlockedActionWrapper";
import { AddressAutocomplete, type AddressValue } from "@/components/shared/AddressAutocomplete";
import { validateDob, MIN_AGE_TELECOM, parseDate as parseDobDate } from "@/lib/validation/dob";

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
}

interface CreatedOrder {
  id: string;
  order_number: string;
  service_type: string;
  category: string;
  subtotal: number;
  delivery_fee: number;
  activation_fee: number;
  installation_fee: number;
  installation_credit: number;
  tps_amount: number;
  tvq_amount: number;
  total_amount: number;
  status: string;
  created_at: string;
  selected_channels?: any[];
}

interface Channel {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  is_hd: boolean;
  is_4k: boolean;
  group_key?: string | null;
  display_label?: string | null;
  base_pack?: string | null;
}

const categoryIcons: Record<string, any> = {
  Mobile: Smartphone,
  Internet: Wifi,
  TV: Tv,
  Streaming: MonitorPlay,
  Sécurité: Shield,
  Extras: Package,
};

// Terminal equipment configuration
const TERMINAL_CONFIG = {
  name: "Nivra 4K Smart Terminal",
  price: 50,
  maxQuantity: 4,
  warranty: "Garantie fabricant 1 an (défauts de fabrication uniquement)",
};

// Note: Router and SIM configs are now dynamically loaded from database via useEquipmentPrices()
// See ROUTER_CONFIG_DYNAMIC and SIM_CONFIG_DYNAMIC inside the component

// Quebec phone prefixes (area codes)
const QUEBEC_PREFIXES = ["514", "450", "418", "438", "819", "367", "263", "579", "354", "873", "468"];

// Uber Express delivery eligible area codes
const UBER_ELIGIBLE_AREA_CODES = ["514", "450", "579", "438"];

// Uber Express delivery eligible cities
const UBER_ELIGIBLE_CITIES = [
  "Montreal", "Montréal", "Laval", "Terrebonne", "Mascouche", 
  "Repentigny", "Longueuil", "Saint-Hubert", "Brossard"
];

// Delivery configuration
const DELIVERY_CONFIG = {
  standard: {
    name: "Livraison standard",
    fee: 30,
    timeframe: "24 à 78 heures ouvrables",
    description: "Livraison partout au Québec"
  },
  uber: {
    name: "Livraison Express Uber",
    fee: 45,
    timeframe: "10 heures",
    description: "Disponible à Montréal, Laval, Terrebonne, Mascouche, Repentigny, Longueuil, Saint-Hubert, Brossard"
  },
  shipHome: {
    name: "Expédition à domicile",
    fee: 15,
    timeframe: "3 à 5 jours ouvrables",
    description: "Expédition postale partout au Québec"
  }
};

// Quebec carriers for transfer selection (competitors only - Nivra is our brand)
const QUEBEC_CARRIERS = [
  "Bell",
  "Rogers",
  "Telus",
  "Fido",
  "Koodo",
  "Virgin Plus",
  "Chatr",
  "Freedom Mobile",
  "Lucky Mobile",
  "Public Mobile",
  "Fizz",
  "Autre",
];

const categoryColors: Record<string, string> = {
  Mobile: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  Internet: "bg-purple-500/20 text-purple-500 border-purple-500/30",
  TV: "bg-pink-500/20 text-pink-500 border-pink-500/30",
  Streaming: "bg-orange-500/20 text-orange-500 border-orange-500/30",
  Sécurité: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
  Extras: "bg-amber-500/20 text-amber-500 border-amber-500/30",
};

// Generate a random Quebec phone number
const generateQuebecPhoneNumber = (): string => {
  const prefix = QUEBEC_PREFIXES[Math.floor(Math.random() * QUEBEC_PREFIXES.length)];
  const middle = String(Math.floor(Math.random() * 900) + 100);
  const end = String(Math.floor(Math.random() * 9000) + 1000);
  return `${prefix}-${middle}-${end}`;
};

const ORDER_DRAFT_KEY = "nivra_order_draft";

// Streaming service interface for Streaming+ add-ons
interface StreamingService {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  category: string;
  features: string[];
  is_active: boolean;
}

interface OrderDraft {
  step: number;
  selectedServices: Service[];
  selectedFreeChannels: Channel[];
  selectedPaidChannels: Channel[];
  selectedStreamingServices: StreamingService[]; // Streaming+ add-ons
  terminalQuantity: number;
  mobileLineQuantities: Record<string, number>; // Per-plan quantities: { serviceId: quantity }
  mobileTransferChoice: "transfer" | "new" | null;
  transferPhoneNumber: string;
  transferCarrier: string;
  transferAccountNumber: string;
  transferServiceAccount: string;
  transferImei: string;
  transferValidationResult: "valid" | "invalid" | null;
  assignedPhoneNumber: string;
  simType: "esim" | "physical";
  installationChoice: "auto" | "technician" | null;
  deliveryChoice: "standard" | "uber" | "shipHome" | null;
  selectedDate: string;
  selectedTime: string;
  notes: string;
  discountCode: string;
  installationCredit: number;
  idType: string;
  idNumber: string;
  idExpiration: string;
  idProvince: string;
  // Customer info fields
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  checkoutPhone: string;
  serviceAddressStreet: string;
  serviceAddressApartment: string;
  serviceAddressCity: string;
  serviceAddressProvince: string;
  serviceAddressPostalCode: string;
}

// Streaming+ Add-ons Section Component
interface StreamingPlusSectionProps {
  selectedStreamingServices: StreamingService[];
  onStreamingServicesChange: (services: StreamingService[]) => void;
}

const StreamingPlusSection = ({ selectedStreamingServices, onStreamingServicesChange }: StreamingPlusSectionProps) => {
  const { data: streamingServices = [], isLoading } = useQuery({
    queryKey: ["streaming-services-checkout"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streaming_services")
        .select("*")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("monthly_price", { ascending: true });
      if (error) throw error;
      return data as StreamingService[];
    },
  });

  const toggleStreamingService = (service: StreamingService) => {
    const isSelected = selectedStreamingServices.some(s => s.id === service.id);
    if (isSelected) {
      onStreamingServicesChange(selectedStreamingServices.filter(s => s.id !== service.id));
    } else {
      onStreamingServicesChange([...selectedStreamingServices, service]);
    }
  };

  const totalMonthly = selectedStreamingServices.reduce((sum, s) => sum + Number(s.monthly_price), 0);
  const videoServices = streamingServices.filter(s => s.category === "video");
  const musicServices = streamingServices.filter(s => s.category === "music");

  if (isLoading) {
    return (
      <div className="mt-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-cyan-500/20">
            <MonitorPlay className="w-5 h-5 text-cyan-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Streaming+</h2>
            <p className="text-xs text-cyan-500">Ajoutez des services de streaming à votre forfait</p>
          </div>
        </div>
        <Card className="bg-card border-border">
          <CardContent className="py-8 text-center">
            <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Chargement des services...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (streamingServices.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-cyan-500/20">
            <MonitorPlay className="w-5 h-5 text-cyan-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Streaming+ (optionnel)</h2>
            <p className="text-xs text-cyan-500">Ajoutez des services de streaming à votre forfait mensuel</p>
          </div>
        </div>
        {totalMonthly > 0 && (
          <Badge className="bg-cyan-500">
            +{totalMonthly.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois
          </Badge>
        )}
      </div>

      <Card className="bg-card border-cyan-500/30">
        <CardContent className="p-4 space-y-4">
          {/* Video Services */}
          {videoServices.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <MonitorPlay className="w-4 h-4" /> Vidéo & Films
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {videoServices.map(service => {
                  const isSelected = selectedStreamingServices.some(s => s.id === service.id);
                  const features = Array.isArray(service.features) ? service.features : [];
                  
                  return (
                    <div 
                      key={service.id}
                      className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                        isSelected 
                          ? "border-cyan-500 bg-cyan-500/5" 
                          : "border-border hover:border-cyan-500/50"
                      }`}
                      onClick={() => toggleStreamingService(service)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          isSelected ? "bg-cyan-500 text-white" : "border-2 border-muted-foreground/30"
                        }`}>
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">{service.name}</span>
                            <span className="font-bold text-cyan-500">
                              {Number(service.monthly_price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois
                            </span>
                          </div>
                          {service.description && (
                            <p className="text-xs text-muted-foreground mt-1">{service.description}</p>
                          )}
                          {features.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {features.slice(0, 3).map((feature, idx) => (
                                <Badge key={idx} variant="outline" className="text-[10px] px-1.5">
                                  {feature}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Music Services */}
          {musicServices.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Star className="w-4 h-4" /> Musique
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {musicServices.map(service => {
                  const isSelected = selectedStreamingServices.some(s => s.id === service.id);
                  const features = Array.isArray(service.features) ? service.features : [];
                  
                  return (
                    <div 
                      key={service.id}
                      className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                        isSelected 
                          ? "border-cyan-500 bg-cyan-500/5" 
                          : "border-border hover:border-cyan-500/50"
                      }`}
                      onClick={() => toggleStreamingService(service)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          isSelected ? "bg-cyan-500 text-white" : "border-2 border-muted-foreground/30"
                        }`}>
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold">{service.name}</span>
                            <span className="font-bold text-cyan-500">
                              {Number(service.monthly_price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois
                            </span>
                          </div>
                          {service.description && (
                            <p className="text-xs text-muted-foreground mt-1">{service.description}</p>
                          )}
                          {features.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {features.slice(0, 3).map((feature, idx) => (
                                <Badge key={idx} variant="outline" className="text-[10px] px-1.5">
                                  {feature}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selection Summary */}
          {selectedStreamingServices.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-cyan-500/10 rounded-lg mt-4">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-cyan-500" />
                <span className="text-sm font-medium">
                  {selectedStreamingServices.length} service(s) Streaming+ sélectionné(s)
                </span>
              </div>
              <span className="font-bold text-cyan-500">
                +{totalMonthly.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const ClientNewOrder = () => {
  const { user } = useClientAuth();
  const { isClient } = usePortalRoleAccess();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAccountBlocked } = useClientBlockStatus();
  
  // Idempotency key: generated once per checkout session to prevent duplicate orders
  // Using useRef ensures it's stable across re-renders and never regenerates
  const clientRequestIdRef = useRef(crypto.randomUUID());
  const clientRequestId = clientRequestIdRef.current;
  
  // Synchronous guard to prevent double-click race conditions
  const submittingRef = useRef(false);
  
  // Hydration flag to prevent step guards from redirecting before state is loaded
  const [isHydrated, setIsHydrated] = useState(false);
  const isInitialMount = useRef(true);
  
  // Detail breakdown visibility state
  const [showFeeDetails, setShowFeeDetails] = useState(false);
  
  const [step, setStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [notes, setNotes] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [installationCredit, setInstallationCredit] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  
  // ID verification state
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idExpiration, setIdExpiration] = useState("");
  const [idProvince, setIdProvince] = useState("");
  
  // Customer info fields (DOB, name)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  
  // Checkout phone and service address state
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [serviceAddressStreet, setServiceAddressStreet] = useState("");
  const [serviceAddressApartment, setServiceAddressApartment] = useState("");
  const [serviceAddressCity, setServiceAddressCity] = useState("");
  const [serviceAddressProvince, setServiceAddressProvince] = useState("QC");
  const [serviceAddressPostalCode, setServiceAddressPostalCode] = useState("");
  
  // Installation choice state
  const [installationChoice, setInstallationChoice] = useState<"auto" | "technician" | null>(null);
  
  // Delivery choice state (for delivery-only orders: Mobile, Streaming, Accessories, Equipment)
  const [deliveryChoice, setDeliveryChoice] = useState<"standard" | "uber" | "shipHome" | null>(null);
  
  // Appointment scheduling state
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");

  // Channel selection state (for TV orders)
  const [selectedFreeChannels, setSelectedFreeChannels] = useState<Channel[]>([]);
  const [selectedPaidChannels, setSelectedPaidChannels] = useState<Channel[]>([]);
  
  // Streaming+ add-ons state
  const [selectedStreamingServices, setSelectedStreamingServices] = useState<StreamingService[]>([]);
  
  // TV Terminal equipment state
  const [terminalQuantity, setTerminalQuantity] = useState<number>(1);
  
  // Mobile line quantities per plan (serviceId -> quantity)
  const [mobileLineQuantities, setMobileLineQuantities] = useState<Record<string, number>>({});
  
  // Mobile transfer state
  const [mobileTransferChoice, setMobileTransferChoice] = useState<"transfer" | "new" | null>(null);
  const [transferPhoneNumber, setTransferPhoneNumber] = useState("");
  const [transferCarrier, setTransferCarrier] = useState("");
  const [transferAccountNumber, setTransferAccountNumber] = useState("");
  const [transferServiceAccount, setTransferServiceAccount] = useState("");
  const [transferImei, setTransferImei] = useState("");
  const [transferValidationResult, setTransferValidationResult] = useState<"valid" | "invalid" | null>(null);
  const [assignedPhoneNumber, setAssignedPhoneNumber] = useState<string>("");
  
  // SIM type is plan-driven in this wizard (always physical; quantity = mobile lines)
  const [simType, setSimType] = useState<"esim" | "physical">("physical");

  const [paymentMethod, setPaymentMethod] = useState<"credit_card" | "etransfer" | null>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [paymentConfirmationNumber, setPaymentConfirmationNumber] = useState("");
  
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [etransferConfirmationNumber, setEtransferConfirmationNumber] = useState("");
  const [etransferSenderName, setEtransferSenderName] = useState("");
  
  // Pre-authorized payment state
  const [acceptPreauthorized, setAcceptPreauthorized] = useState(false);
  const PREAUTH_MONTHLY_DISCOUNT = 5;
  
  // Query client billing preferences to check if preauth already opted-in
  const { data: billingPreferences, isLoading: isBillingPrefsLoading } = useQuery({
    queryKey: ["client-billing-preferences", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("client_billing_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        console.warn("[ClientNewOrder] Failed to load billing preferences:", error);
        return null;
      }
      return data;
    },
    enabled: !!user?.id,
  });
  
  // Derived: has client already opted into preauth?
  const hasExistingPreauthOptIn = billingPreferences?.preauth_opt_in === true;
  
  // If client already has preauth, auto-set and show badge instead of checkbox
  useEffect(() => {
    if (hasExistingPreauthOptIn) {
      setAcceptPreauthorized(true);
    }
  }, [hasExistingPreauthOptIn]);

  // Hydrate state from sessionStorage on mount
  useEffect(() => {
    try {
      const savedDraft = sessionStorage.getItem(ORDER_DRAFT_KEY);
      if (savedDraft) {
        const draft: OrderDraft = JSON.parse(savedDraft);
        console.log("[OrderWizard] Hydrating from sessionStorage:", draft.step, "services:", draft.selectedServices?.length);
        
        if (draft.step) setStep(draft.step);
        if (draft.selectedServices?.length) setSelectedServices(draft.selectedServices);
        if (draft.selectedFreeChannels?.length) setSelectedFreeChannels(draft.selectedFreeChannels);
        if (draft.selectedPaidChannels?.length) setSelectedPaidChannels(draft.selectedPaidChannels);
        if (draft.selectedStreamingServices?.length) setSelectedStreamingServices(draft.selectedStreamingServices);
        if (draft.terminalQuantity) setTerminalQuantity(draft.terminalQuantity);
        if (draft.mobileLineQuantities) setMobileLineQuantities(draft.mobileLineQuantities);
        if (draft.mobileTransferChoice) setMobileTransferChoice(draft.mobileTransferChoice);
        if (draft.transferPhoneNumber) setTransferPhoneNumber(draft.transferPhoneNumber);
        if (draft.transferCarrier) setTransferCarrier(draft.transferCarrier);
        if (draft.transferAccountNumber) setTransferAccountNumber(draft.transferAccountNumber);
        if (draft.transferServiceAccount) setTransferServiceAccount(draft.transferServiceAccount);
        if (draft.transferImei) setTransferImei(draft.transferImei);
        if (draft.transferValidationResult) setTransferValidationResult(draft.transferValidationResult);
        if (draft.assignedPhoneNumber) setAssignedPhoneNumber(draft.assignedPhoneNumber);
        setSimType("physical"); // enforced: no SIM choice in client checkout
        if (draft.installationChoice) setInstallationChoice(draft.installationChoice);
        if (draft.deliveryChoice) setDeliveryChoice(draft.deliveryChoice);
        if (draft.selectedDate) setSelectedDate(draft.selectedDate);
        if (draft.selectedTime) setSelectedTime(draft.selectedTime);
        if (draft.notes) setNotes(draft.notes);
        if (draft.discountCode) setDiscountCode(draft.discountCode);
        if (draft.installationCredit) setInstallationCredit(draft.installationCredit);
        if (draft.idType) setIdType(draft.idType);
        if (draft.idNumber) setIdNumber(draft.idNumber);
        if (draft.idExpiration) setIdExpiration(draft.idExpiration);
        if (draft.idProvince) setIdProvince(draft.idProvince);
        // Customer info fields
        if (draft.firstName) setFirstName(draft.firstName);
        if (draft.lastName) setLastName(draft.lastName);
        if (draft.dateOfBirth) setDateOfBirth(draft.dateOfBirth);
        if (draft.checkoutPhone) setCheckoutPhone(draft.checkoutPhone);
        if (draft.serviceAddressStreet) setServiceAddressStreet(draft.serviceAddressStreet);
        if (draft.serviceAddressApartment) setServiceAddressApartment(draft.serviceAddressApartment);
        if (draft.serviceAddressCity) setServiceAddressCity(draft.serviceAddressCity);
        if (draft.serviceAddressProvince) setServiceAddressProvince(draft.serviceAddressProvince);
        if (draft.serviceAddressPostalCode) setServiceAddressPostalCode(draft.serviceAddressPostalCode);
      }
    } catch (e) {
      console.error("[OrderWizard] Failed to hydrate from sessionStorage:", e);
    }
    
    // Mark as hydrated after initial load
    setIsHydrated(true);
    isInitialMount.current = false;
  }, []);

  // Persist state to sessionStorage on changes (after hydration)
  useEffect(() => {
    if (!isHydrated) return;
    
    const draft: OrderDraft = {
      step,
      selectedServices,
      selectedFreeChannels,
      selectedPaidChannels,
      selectedStreamingServices,
      terminalQuantity,
      mobileLineQuantities,
      mobileTransferChoice,
      transferPhoneNumber,
      transferCarrier,
      transferAccountNumber,
      transferServiceAccount,
      transferImei,
      transferValidationResult,
      assignedPhoneNumber,
      simType: "physical",
      installationChoice,
      deliveryChoice,
      selectedDate,
      selectedTime,
      notes,
      discountCode,
      installationCredit,
      idType,
      idNumber,
      idExpiration,
      idProvince,
      firstName,
      lastName,
      dateOfBirth,
      checkoutPhone,
      serviceAddressStreet,
      serviceAddressApartment,
      serviceAddressCity,
      serviceAddressProvince,
      serviceAddressPostalCode,
    };
    
    console.log("[OrderWizard] Saving draft to sessionStorage, step:", step, "services:", selectedServices.length, "streaming:", selectedStreamingServices.length);
    sessionStorage.setItem(ORDER_DRAFT_KEY, JSON.stringify(draft));
  }, [
    isHydrated, step, selectedServices, selectedFreeChannels, selectedPaidChannels, selectedStreamingServices,
    terminalQuantity, mobileLineQuantities, mobileTransferChoice, transferPhoneNumber, transferCarrier,
    transferAccountNumber, transferServiceAccount, transferImei, transferValidationResult,
    assignedPhoneNumber, simType, installationChoice, deliveryChoice, selectedDate,
    selectedTime, notes, discountCode, installationCredit, idType, idNumber, idExpiration, idProvince,
    firstName, lastName, dateOfBirth,
    checkoutPhone, serviceAddressStreet, serviceAddressApartment, serviceAddressCity, serviceAddressProvince, serviceAddressPostalCode
  ]);

  // Clear draft when order is completed (called after successful order creation)
  const clearOrderDraft = () => {
    sessionStorage.removeItem(ORDER_DRAFT_KEY);
    console.log("[OrderWizard] Draft cleared");
  };

  // Fetch dynamic equipment prices from database
  const { routerPrice, simPrice, esimPrice, terminalPrice } = useEquipmentPrices();

  // Dynamic configs using database prices
  const ROUTER_CONFIG_DYNAMIC = {
    name: "Nivra Born Wifi Router",
    price: routerPrice,
    warranty: "Garantie fabricant 1 an (défauts de fabrication uniquement)",
  };

  const SIM_CONFIG_DYNAMIC = {
    esim: {
      name: "Nivra eSIM",
      price: esimPrice,
    },
    physical: {
      name: "Nivra Physical SIM",
      price: simPrice,
    },
    warranty: "Garantie fabricant 1 an (défauts de fabrication uniquement)",
    notes: "Aucune vérification de crédit • Pièce d'identité gouvernementale requise • Frais unique pour nouveau numéro ou transfert",
  };

  // Fetch available services
  const { data: services, isLoading } = useQuery({
    queryKey: ["available-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("is_active", true)
        .order("category", { ascending: true });

      if (error) throw error;
      return data as Service[];
    },
  });

  // Fetch TV channels for selection with error handling + logging
  const { data: tvChannels = [], isLoading: channelsLoading, error: channelsError, refetch: refetchChannels } = useQuery({
    queryKey: ["tv-channels-order"],
    queryFn: async () => {
      console.log("[TVChannels] fetch start");
      const { data, error } = await supabase
        .from("tv_channels")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) {
        console.error("[TVChannels] fetch error", error);
        throw error;
      }
      console.log("[TVChannels] fetched", data?.length, "channels");
      return data as Channel[];
    },
  });

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

  // Pre-fill from client profile when profile loads (if not already set from draft)
  // This ensures checkout forms are autofilled from the single source of truth (profiles table)
  // ROBUST: Handles full_name fallback when first_name/last_name are missing
  useEffect(() => {
    if (profile && isHydrated) {
      // Only pre-fill if fields are empty (draft takes priority) - dirty-safe logic
      
      // Name fields with full_name fallback
      if (!firstName) {
        if (profile.first_name) {
          setFirstName(profile.first_name);
        } else if (profile.full_name && !profile.first_name && !profile.last_name) {
          // Split full_name: last token = last name, rest = first name
          const nameParts = profile.full_name.trim().split(/\s+/);
          if (nameParts.length === 1) {
            setFirstName(nameParts[0]);
          } else {
            setFirstName(nameParts.slice(0, -1).join(" "));
          }
        }
      }
      if (!lastName) {
        if (profile.last_name) {
          setLastName(profile.last_name);
        } else if (profile.full_name && !profile.first_name && !profile.last_name) {
          // Split full_name: last token = last name
          const nameParts = profile.full_name.trim().split(/\s+/);
          if (nameParts.length > 1) {
            setLastName(nameParts[nameParts.length - 1]);
          } else {
            setLastName(""); // Single word name
          }
        }
      }
      // Date of birth
      if (!dateOfBirth && profile.date_of_birth) {
        setDateOfBirth(profile.date_of_birth);
      }
      // Phone
      if (!checkoutPhone && profile.phone) {
        setCheckoutPhone(profile.phone);
      }
      // Address fields
      if (!serviceAddressStreet && profile.service_address) {
        setServiceAddressStreet(profile.service_address);
      }
      if (!serviceAddressCity && profile.service_city) {
        setServiceAddressCity(profile.service_city);
      }
      if (!serviceAddressProvince && profile.service_province) {
        setServiceAddressProvince(profile.service_province);
      }
      if (!serviceAddressPostalCode && profile.service_postal_code) {
        setServiceAddressPostalCode(profile.service_postal_code);
      }
      // Identity document fields (for returning customers)
      if (!idType && profile.id_type) {
        setIdType(profile.id_type);
      }
      if (!idNumber && profile.id_number) {
        setIdNumber(profile.id_number);
      }
      if (!idExpiration && profile.id_expiration) {
        setIdExpiration(profile.id_expiration);
      }
      if (!idProvince && profile.id_province) {
        setIdProvince(profile.id_province);
      }
      
      console.log("[ClientNewOrder] Profile autofill applied:", {
        firstName: firstName || profile.first_name || "(from full_name)",
        lastName: lastName || profile.last_name || "(from full_name)",
        dateOfBirth: dateOfBirth || profile.date_of_birth,
        phone: checkoutPhone || profile.phone,
      });
    }
  }, [profile, isHydrated]);

  // Categorize channels - strict pack filter for La Base (26 channels)
  const baseChannels = tvChannels.filter(ch => ch.base_pack === 'LA_BASE_26');
  const freeChoiceChannels = tvChannels.filter(ch => ch.category === 'free_choice');
  const premiumChannels = tvChannels.filter(ch => ch.category === 'premium');
  const paidChannels = tvChannels.filter(ch => ch.category === 'paid');
  
  // Log categorized counts for debugging
  console.log("[TVChannels] baseChannels:", baseChannels.length, "freeChoice:", freeChoiceChannels.length, "premium:", premiumChannels.length, "paid:", paidChannels.length);

  // Count unique selections for free_choice (bundled channels count as 1)
  const countFreeChoiceSelections = (channels: Channel[]): number => {
    const groupKeys = new Set<string>();
    let nonBundledCount = 0;
    
    channels.forEach(ch => {
      if (ch.group_key) {
        groupKeys.add(ch.group_key);
      } else {
        nonBundledCount++;
      }
    });
    
    return groupKeys.size + nonBundledCount;
  };
  
  const freeChoiceSelectionCount = countFreeChoiceSelections(selectedFreeChannels);

  // Check if TV service is selected
  const hasTVService = selectedServices.some(s => s.category === "TV");
  
  // Check if Internet service is selected (standalone, not as part of TV bundle)
  const hasInternetService = selectedServices.some(s => s.category === "Internet");
  
  // Check if Mobile service is selected
  const hasMobileService = selectedServices.some(s => s.category === "Mobile");
  
  // Check if Streaming service is selected
  const hasStreamingService = selectedServices.some(s => s.category === "Streaming");
  
  // Check if Extras/Accessories service is selected
  const hasExtrasService = selectedServices.some(s => s.category === "Extras");
  
  // Check if this is a delivery-only order (Mobile, Streaming, or Accessories only - no technician installation)
  const isDeliveryOnlyOrder = (hasMobileService || hasStreamingService || hasExtrasService) && 
    !hasTVService && !hasInternetService && !selectedServices.some(s => s.category === "Sécurité");
  
  // Check if this is an equipment/accessories-only order (no service plans requiring ID)
  // Equipment-only = Streaming OR Extras/Accessories (no Mobile, Internet, TV, or Security)
  const isEquipmentOnlyOrder = (hasStreamingService || hasExtrasService) && 
    !hasMobileService && !hasTVService && !hasInternetService && 
    !selectedServices.some(s => s.category === "Sécurité");
  
  // Check if Uber delivery is available based on client's phone area code
  const isUberDeliveryAvailable = (): boolean => {
    if (!profile?.phone) return false;
    const cleanNumber = profile.phone.replace(/\D/g, '');
    if (cleanNumber.length < 10) return false;
    const areaCode = cleanNumber.substring(0, 3);
    return UBER_ELIGIBLE_AREA_CODES.includes(areaCode);
  };
  
  // Get selected TV service to determine free channel limit
  const selectedTVService = selectedServices.find(s => s.category === "TV");
  const freeChannelLimit = selectedTVService ? (
    selectedTVService.name.toLowerCase().includes('25 choix') ? 25 :
    selectedTVService.name.toLowerCase().includes('15 choix') ? 15 :
    selectedTVService.name.toLowerCase().includes('10 choix') ? 10 :
    selectedTVService.name.toLowerCase().includes('5 choix') ? 5 :
    selectedTVService.name.toLowerCase().includes('basic') ? 0 : 0
  ) : 0;

  // Validate Quebec phone number for transfer
  const validateQuebecPhoneNumber = (phone: string): boolean => {
    const cleanNumber = phone.replace(/\D/g, '');
    if (cleanNumber.length !== 10) return false;
    const prefix = cleanNumber.substring(0, 3);
    return QUEBEC_PREFIXES.includes(prefix);
  };

  // Handle transfer phone validation
  const handleTransferPhoneValidation = () => {
    const isValid = validateQuebecPhoneNumber(transferPhoneNumber);
    setTransferValidationResult(isValid ? "valid" : "invalid");
    if (isValid) {
      toast.success("Numéro québécois valide! Veuillez compléter les informations de transfert.");
    } else {
      toast.error("Ce numéro n'est pas un numéro québécois valide ou n'est pas éligible au transfert.");
    }
  };

  // Handle new number assignment
  const handleNewNumberSelection = () => {
    setMobileTransferChoice("new");
    const newNumber = generateQuebecPhoneNumber();
    setAssignedPhoneNumber(newNumber);
    toast.success("Un numéro québécois vous sera attribué après confirmation de la commande.");
  };

  // Check if mobile transfer step is complete
  const isMobileTransferComplete = (): boolean => {
    if (!hasMobileService) return true;
    if (mobileTransferChoice === "new") return true;
    if (mobileTransferChoice === "transfer" && transferValidationResult === "valid" && transferCarrier && transferAccountNumber && transferServiceAccount) {
      return true;
    }
    return false;
  };

  // Promo state for database-validated promos (including referral codes)
  const [appliedPromo, setAppliedPromo] = useState<{
    id: string;
    code: string;
    name: string;
    discount_type: string;
    discount_value: number;
    discount_amount: number;
    // Referral code specific fields
    is_referral_code?: boolean;
    referral_code_id?: string;
    influencer_id?: string;
  } | null>(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);

  // Apply discount code using validate-promo edge function
  const applyDiscountCode = async () => {
    if (!discountCode.trim()) {
      toast.error("Veuillez entrer un code promo");
      return;
    }

    // Build cart items for promo validation
    type CartItemType = 'service' | 'one_time_fee' | 'equipment' | 'delivery' | 'installation';
    const cartItems: Array<{ type: CartItemType; amount: number; name: string }> = [];
    
    // Services
    selectedServices.forEach(s => {
      cartItems.push({
        type: 'service',
        amount: Number(s.price),
        name: s.name,
      });
    });
    
    // Paid channels
    selectedPaidChannels.forEach(ch => {
      cartItems.push({
        type: 'service',
        amount: Number(ch.price),
        name: ch.name,
      });
    });

    // Add equipment fees
    if (hasTVService && terminalQuantity > 0) {
      cartItems.push({
        type: 'equipment',
        amount: terminalQuantity * TERMINAL_CONFIG.price,
        name: `${TERMINAL_CONFIG.name} x${terminalQuantity}`,
      });
    }
    if (hasInternetService || hasTVService) {
      cartItems.push({
        type: 'equipment',
        amount: ROUTER_CONFIG_DYNAMIC.price,
        name: ROUTER_CONFIG_DYNAMIC.name,
      });
    }
    if (hasMobileService) {
      cartItems.push({
        type: 'equipment',
        amount: SIM_CONFIG_DYNAMIC.physical.price * totalMobileLineQuantity,
        name: `${SIM_CONFIG_DYNAMIC.physical.name} x${totalMobileLineQuantity}`,
      });
    }

    // Add activation fee
    cartItems.push({
      type: 'one_time_fee',
      amount: 25,
      name: 'Frais d\'activation',
    });

    // Add delivery fee if applicable
    if (isDeliveryOnlyOrder && deliveryChoice) {
      const deliveryFee = deliveryChoice === "uber" ? DELIVERY_CONFIG.uber.fee : 
                          deliveryChoice === "shipHome" ? DELIVERY_CONFIG.shipHome.fee : 
                          DELIVERY_CONFIG.standard.fee;
      cartItems.push({
        type: 'delivery',
        amount: deliveryFee,
        name: 'Frais de livraison',
      });
    } else if (!isDeliveryOnlyOrder && installationChoice === "auto") {
      cartItems.push({
        type: 'delivery',
        amount: 30,
        name: 'Frais de livraison',
      });
    }

    // Add installation fee if technician
    if (!isDeliveryOnlyOrder && installationChoice === "technician") {
      cartItems.push({
        type: 'installation',
        amount: 50,
        name: 'Frais d\'installation technicien',
      });
    }

    const subtotalBeforeDiscount = cartItems.reduce((sum, item) => sum + item.amount, 0);

    setIsValidatingPromo(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("validate-promo", {
        body: {
          code: discountCode.trim(),
          client_email: profile?.email || '',
          client_id: user?.id,
          cart_items: cartItems,
          subtotal_before_discount: subtotalBeforeDiscount,
        },
      });

      if (invokeError) throw invokeError;

      if (!data.valid) {
        toast.error(data.error || "Code promo invalide");
        return;
      }

      // Apply the promo (capture referral code fields if present)
      setAppliedPromo({
        id: data.promo.id,
        code: data.promo.code,
        name: data.promo.name,
        discount_type: data.promo.discount_type,
        discount_value: data.promo.discount_value,
        discount_amount: data.discount_amount,
        // Referral code specific fields
        is_referral_code: data.is_referral_code || false,
        referral_code_id: data.referral_code_id,
        influencer_id: data.influencer_id,
      });

      // If it applies to installation, set installation credit
      if (data.promo.applies_to?.installation) {
        const installCredit = Math.min(data.discount_amount, 50);
        setInstallationCredit(installCredit);
      }

      toast.success(`Code promo "${data.promo.code}" appliqué! Réduction de ${data.discount_amount.toFixed(2)} $`);
    } catch (err: any) {
      console.error("Error validating promo:", err);
      toast.error("Erreur lors de la validation du code promo");
    } finally {
      setIsValidatingPromo(false);
    }
  };

  // Remove promo
  const removePromo = () => {
    setAppliedPromo(null);
    setInstallationCredit(0);
    setDiscountCode("");
    toast.info("Code promo retiré");
  };

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      console.log("[ClientNewOrder] Starting order creation...", { userId: user?.id, clientRequestId });
      if (!user?.id) throw new Error("Utilisateur non authentifié. Veuillez vous reconnecter.");

      // Security check before sensitive action
      const { allowed, reason } = await verifyPortalSensitiveActionAllowed(user.id);
      if (!allowed) {
        throw new Error(reason || "Action non autorisée - compte suspendu");
      }

      const subtotal = selectedServices.reduce((sum, s) => sum + Number(s.price), 0);
      const paidChannelTotal = selectedPaidChannels.reduce((sum, ch) => sum + Number(ch.price), 0);
      const serviceNames = selectedServices.map(s => s.name).join(", ");
      const categories = [...new Set(selectedServices.map(s => s.category))].join(", ");

      // Prepare channel data for TV orders
      const channelData = hasTVService ? [
        // All base channels are automatically included
        ...baseChannels.map(ch => ({
          id: ch.id,
          name: ch.name,
          category: 'base',
          price: 0,
          is_hd: ch.is_hd,
          type: 'base_included',
        })),
        // Selected free-choice channels
        ...selectedFreeChannels.map(ch => ({
          id: ch.id,
          name: ch.name,
          category: 'free_choice',
          price: 0,
          is_hd: ch.is_hd,
          type: 'free_choice',
        })),
        // Selected paid channels
        ...selectedPaidChannels.map(ch => ({
          id: ch.id,
          name: ch.name,
          category: 'paid',
          price: ch.price,
          is_hd: ch.is_hd,
          type: 'paid_addon',
        })),
      ] : [];

      // Prepare equipment info for notes
      const routerInfo = (hasInternetService || hasTVService)
        ? `\n\n**Routeur:**\n${ROUTER_CONFIG_DYNAMIC.name} = ${ROUTER_CONFIG_DYNAMIC.price.toFixed(2)}$ (frais unique)\n${ROUTER_CONFIG_DYNAMIC.warranty}`
        : '';
      
      const equipmentInfo = hasTVService 
        ? `\n\n**Équipement TV:**\n${TERMINAL_CONFIG.name} x${terminalQuantity} = ${(terminalQuantity * TERMINAL_CONFIG.price).toFixed(2)}$\n${TERMINAL_CONFIG.warranty}`
        : '';
      
      // Prepare SIM info for notes (always physical SIM, quantity matches mobile lines)
      const simInfo = hasMobileService
        ? `\n\n**Cartes SIM physiques:**\n${SIM_CONFIG_DYNAMIC.physical.name} x${totalMobileLineQuantity} = ${(SIM_CONFIG_DYNAMIC.physical.price * totalMobileLineQuantity).toFixed(2)}$ (frais unique)\n${SIM_CONFIG_DYNAMIC.warranty}\n${SIM_CONFIG_DYNAMIC.notes}`
        : '';

      // Prepare delivery info for notes
      const deliveryInfo = isDeliveryOnlyOrder 
        ? `\n\n**Livraison:**\n${deliveryChoice === "uber" ? DELIVERY_CONFIG.uber.name : DELIVERY_CONFIG.standard.name}\nDélai: ${deliveryChoice === "uber" ? DELIVERY_CONFIG.uber.timeframe : DELIVERY_CONFIG.standard.timeframe}\nFrais: ${deliveryChoice === "uber" ? DELIVERY_CONFIG.uber.fee.toFixed(2) : DELIVERY_CONFIG.standard.fee.toFixed(2)}$`
        : '';

      // Prepare Streaming+ add-ons info for notes
      const streamingAddonsInfo = selectedStreamingServices.length > 0
        ? `\n\n**Streaming+ (activation requise):**\n${selectedStreamingServices.map(s => `${s.name} — ${Number(s.monthly_price).toFixed(2)}$/mois`).join('\n')}\nTotal Streaming+: ${selectedStreamingServices.reduce((sum, s) => sum + Number(s.monthly_price), 0).toFixed(2)}$/mois`
        : '';

      const equipmentSubtotal = 
        (hasTVService ? terminalQuantity * TERMINAL_CONFIG.price : 0) + 
        ((hasInternetService || hasTVService) ? ROUTER_CONFIG_DYNAMIC.price : 0) + 
        (hasMobileService ? SIM_CONFIG_DYNAMIC.physical.price * totalMobileLineQuantity : 0);

      // Calculate delivery fee based on order type
      const orderDeliveryFee = isDeliveryOnlyOrder 
        ? (deliveryChoice === "uber" ? DELIVERY_CONFIG.uber.fee : 
           deliveryChoice === "shipHome" ? DELIVERY_CONFIG.shipHome.fee : 
           DELIVERY_CONFIG.standard.fee)
        : (installationChoice === "auto" ? 30 : 0);

      // Determine installation type for the order
      const orderInstallationType = isDeliveryOnlyOrder 
        ? (deliveryChoice === "uber" ? "uber_express" : 
           deliveryChoice === "shipHome" ? "ship_to_home" :
           "delivery_standard")
        : installationChoice;
      
      // For equipment-only orders, no activation fee
      const orderActivationFee = isEquipmentOnlyOrder ? 0 : 25;

      // Save pre-authorized payment method if credit card and checkbox selected
      // Use UPSERT to prevent duplicate cards (unique on user_id + payment_fingerprint)
      let savedPaymentMethodId: string | null = null;
      if (paymentMethod === "credit_card" && acceptPreauthorized) {
        const cardNum = cardNumber.replace(/\s/g, '');
        const lastFour = cardNum.slice(-4);
        const cardType = cardNum.startsWith('4') ? 'Visa' : cardNum.startsWith('5') ? 'Mastercard' : 'Card';
        const [month, year] = cardExpiry.split('/');
        const expiryMonth = parseInt(month);
        const expiryYear = 2000 + parseInt(year);
        
        // Generate deterministic fingerprint for deduplication
        // Format: network-last4-MM-YYYY (no cardholder name to avoid variations)
        const paymentFingerprint = `${cardType}-${lastFour}-${expiryMonth}-${expiryYear}`;
        
        // Simple encryption for storage (in production, use proper encryption)
        const encryptedCard = btoa(cardNum); // Base64 encode for demo purposes
        
        // UPSERT: insert or return existing card if duplicate
        const { data: paymentMethodData, error: paymentMethodError } = await supabase
          .from("payment_methods")
          .upsert({
            user_id: user.id,
            card_type: cardType,
            last_four: lastFour,
            expiry_month: expiryMonth,
            expiry_year: expiryYear,
            payment_fingerprint: paymentFingerprint,
            is_default: true,
            is_preauthorized: true,
            preauthorized_at: new Date().toISOString(),
            encrypted_card_number: encryptedCard,
            cardholder_name: cardName,
          }, {
            onConflict: 'user_id,payment_fingerprint',
            ignoreDuplicates: false,
          })
          .select()
          .single();
        
        if (paymentMethodError) {
          // If it's a duplicate key error, try to find existing card
          if (paymentMethodError.code === '23505') {
            console.log("[ClientNewOrder] Card already exists, finding existing...");
            const { data: existingCard } = await supabase
              .from("payment_methods")
              .select("id")
              .eq("user_id", user.id)
              .eq("payment_fingerprint", paymentFingerprint)
              .single();
            
            if (existingCard) {
              savedPaymentMethodId = existingCard.id;
              toast.info("Cette carte est déjà enregistrée. Nous l'avons sélectionnée pour vous.");
            }
          } else {
            console.error("[ClientNewOrder] Payment method error:", paymentMethodError);
          }
        } else if (paymentMethodData) {
          savedPaymentMethodId = paymentMethodData.id;
          
          // Set this as default, unset others
          await supabase
            .from("payment_methods")
            .update({ is_default: false })
            .eq("user_id", user.id)
            .neq("id", paymentMethodData.id);
        }
        
        // Save/update billing preferences for preauth opt-in (only if first time)
        if (!hasExistingPreauthOptIn) {
          await supabase
            .from("client_billing_preferences")
            .upsert({
              user_id: user.id,
              preauth_opt_in: true,
              preauth_opt_in_at: new Date().toISOString(),
              preauth_discount_active: true,
            }, {
              onConflict: 'user_id',
            });
          
          // Invalidate billing preferences query to reflect new state
          queryClient.invalidateQueries({ queryKey: ["client-billing-preferences", user.id] });
        }
      }

      // Prepare service address for notes
      const fullServiceAddress = [
        serviceAddressStreet,
        serviceAddressApartment,
        serviceAddressCity,
        serviceAddressProvince,
        serviceAddressPostalCode
      ].filter(Boolean).join(", ");
      
      const addressInfo = `\n\n**Adresse de service:**\n${fullServiceAddress}\n**Téléphone client:** ${checkoutPhone}`;

      // Build port-in request object if transfer selected
      const portRequestData = (hasMobileService && mobileTransferChoice === "transfer" && transferPhoneNumber) ? {
        port_in: true,
        phone_number: transferPhoneNumber,
        carrier: transferCarrier || null,
        account_number: transferAccountNumber || null,
        service_account: transferServiceAccount || null,
        imei: transferImei || null,
        consent: true,
        consent_at: new Date().toISOString(),
      } : null;

      // Build identity snapshot object
      const identitySnapshotData = (idType || idNumber || idExpiration || idProvince) ? {
        id_type: idType || null,
        id_number: idNumber || null,
        id_expiration: idExpiration || null,
        id_province: idProvince || null,
      } : null;

      // Build structured line_items for contract PDF
      const { buildOrderLineItems, wrapLineItemsForOrder } = await import("@/lib/orderLineItems");
      
      // Build services array from selected services
      type ServiceType = "Internet" | "TV" | "Mobile" | "Streaming" | "Security" | "Other";
      const servicesForLineItems = selectedServices.map(service => {
        const serviceType = service.category?.toLowerCase() || 'other';
        let type: ServiceType = "Other";
        let priceLabel = "/mois";
        
        if (serviceType.includes('internet')) type = "Internet";
        else if (serviceType.includes('tv')) type = "TV";
        else if (serviceType.includes('mobile')) { type = "Mobile"; priceLabel = "/30 jours"; }
        else if (serviceType.includes('streaming')) type = "Streaming";
        else if (serviceType.includes('security')) type = "Security";
        
        return {
          type,
          name: service.name,
          price: Number(service.price),
          priceLabel,
          refId: service.id,
        };
      });
      
      // Add streaming services
      const streamingForLineItems = selectedStreamingServices.map(s => ({
        type: "Streaming" as const,
        name: s.name,
        price: Number(s.monthly_price),
        priceLabel: "/mois",
        refId: s.id,
      }));
      
      // Add paid channels as services
      const paidChannelsForLineItems = selectedPaidChannels.length > 0 ? [{
        type: "TV" as const,
        name: `Chaînes premium (${selectedPaidChannels.length})`,
        price: paidChannelTotal,
        priceLabel: "/mois",
        description: selectedPaidChannels.map(ch => ch.name).slice(0, 3).join(", ") + (selectedPaidChannels.length > 3 ? "..." : ""),
      }] : [];
      
      // Build equipment array
      const equipmentForLineItems = [
        ...((hasInternetService || hasTVService) ? [{ name: "Routeur Nivra Born WiFi", quantity: 1, unitPrice: ROUTER_CONFIG_DYNAMIC.price }] : []),
        ...(hasTVService ? [{ name: "Terminal Nivra 4K Smart", quantity: terminalQuantity, unitPrice: TERMINAL_CONFIG.price }] : []),
        ...(hasMobileService ? [{ name: "Carte SIM physique", quantity: totalMobileLineQuantity, unitPrice: SIM_CONFIG_DYNAMIC.physical.price }] : []),
      ];
      
      // Build fees array
      const feesForLineItems = [
        ...(orderActivationFee > 0 ? [{ name: "Frais d'activation", amount: orderActivationFee }] : []),
        ...(orderDeliveryFee > 0 ? [{ name: isDeliveryOnlyOrder ? "Frais de livraison" : "Frais de livraison/installation", amount: orderDeliveryFee }] : []),
        ...(!isDeliveryOnlyOrder && installationChoice === "technician" ? [{ name: "Installation professionnelle", amount: Math.max(0, 50 - installationCredit) }] : []),
      ];
      
      // Build discounts array (promo + preauth + SIM credits for mobile orders)
      // Auto-credit SIM fee and SIM delivery fee for orders with mobile services
      const simCreditAmount = hasMobileService ? SIM_CONFIG_DYNAMIC.physical.price * totalMobileLineQuantity : 0;
      const simDeliveryCreditAmount = hasMobileService ? orderDeliveryFee : 0;
      
      const discountsForLineItems = [
        ...(appliedPromo && appliedPromo.discount_amount > 0 ? [{
          name: `Rabais promotionnel (${appliedPromo.code})`,
          amount: appliedPromo.discount_amount,
          description: appliedPromo.name,
        }] : []),
        ...(acceptPreauthorized ? [{
          name: "Rabais paiement préautorisé",
          amount: PREAUTH_MONTHLY_DISCOUNT,
          description: "5$/mois",
        }] : []),
        // Auto-credit SIM fee for mobile orders (per SIM quantity)
        ...(simCreditAmount > 0 ? [{
          name: "Crédit — Carte SIM offerte",
          amount: simCreditAmount,
          description: totalMobileLineQuantity > 1 ? `${totalMobileLineQuantity} cartes SIM` : "Carte SIM",
        }] : []),
        // Auto-credit SIM delivery fee for mobile orders
        ...(simDeliveryCreditAmount > 0 ? [{
          name: "Crédit — Livraison SIM offerte",
          amount: simDeliveryCreditAmount,
          description: "Livraison gratuite",
        }] : []),
      ];
      
      const lineItems = buildOrderLineItems({
        services: [...servicesForLineItems, ...streamingForLineItems, ...paidChannelsForLineItems],
        equipment: equipmentForLineItems,
        fees: feesForLineItems,
        discounts: discountsForLineItems,
      });

      // Use upsert with client_request_id for idempotency — if this request was already processed, return existing order
      const { data, error } = await supabase.from("orders").upsert({
        client_request_id: clientRequestId,
        user_id: user.id,
        client_email: profile?.email || user.email,
        // Client identity fields for profile sync trigger
        client_first_name: firstName || null,
        client_last_name: lastName || null,
        client_dob: dateOfBirth, // REQUIRED - never null (validated above)
        client_phone: checkoutPhone || null,
        // Shipping/service address fields
        shipping_address: serviceAddressStreet || null,
        shipping_city: serviceAddressCity || null,
        shipping_province: serviceAddressProvince || null,
        shipping_postal_code: serviceAddressPostalCode || null,
        service_type: serviceNames,
        category: isDeliveryOnlyOrder ? "Delivery" : categories,
        subtotal: subtotal + paidChannelTotal + equipmentSubtotal + selectedStreamingServices.reduce((sum, s) => sum + Number(s.monthly_price), 0),
        delivery_fee: orderDeliveryFee,
        activation_fee: orderActivationFee,
        installation_fee: (!isDeliveryOnlyOrder && installationChoice === "technician") ? 50 : 0,
        installation_credit: installationCredit,
        installation_type: orderInstallationType,
        discount_code: appliedPromo?.code || discountCode || null,
        discount_amount: appliedPromo?.discount_amount || 0,
        promo_code: appliedPromo?.code || null,
        promo_discount_amount: appliedPromo?.discount_amount || 0,
        promo_details: appliedPromo ? {
          id: appliedPromo.id,
          code: appliedPromo.code,
          name: appliedPromo.name,
          discount_type: appliedPromo.discount_type,
          discount_value: appliedPromo.discount_value,
          discount_amount: appliedPromo.discount_amount,
        } : null,
        status: "pending",
        payment_status: "pre_authorized",
        amount_paid: 0,
        created_by: "client",
        notes: (notes || '') + addressInfo + routerInfo + equipmentInfo + simInfo + deliveryInfo + streamingAddonsInfo + 
          (acceptPreauthorized ? '\n\n**Paiement pré-autorisé:** Oui (rabais 5$/mois appliqué)' : '') +
          (appliedPromo ? `\n\n**Code promo:** ${appliedPromo.code} — Rabais de ${appliedPromo.discount_amount.toFixed(2)}$` : ''),
        selected_channels: channelData,
        channel_selection_locked: false,
        channel_assigned_by: hasTVService && channelData.length > 0 ? 'client' : null,
        equipment_details: wrapLineItemsForOrder(lineItems),
        equipment_id: hasTVService ? `TERMINAL-${terminalQuantity}x` : (hasInternetService ? 'ROUTER' : null),
        preauth_discount: acceptPreauthorized ? PREAUTH_MONTHLY_DISCOUNT : 0,
        preauth_card_id: savedPaymentMethodId,
        port_request: portRequestData,
        identity_snapshot: identitySnapshotData,
      } as any, {
        onConflict: 'client_request_id',
        ignoreDuplicates: false,
      }).select().single();

      if (error) throw error;
      
      // Note: Profile sync is now handled by database trigger (trg_sync_order_to_profile)
      // This ensures fill-missing-only logic is applied at the database level

      // Post-order steps: payment, billing, tickets, appointments
      // These are wrapped in try-catch so that order success is not blocked by post-step failures
      let nivraPaymentRef = '';
      const postStepErrors: string[] = [];

      try {
        // Generate NIVRA payment reference
        const year = new Date().getFullYear();
        const random = Math.floor(10000 + Math.random() * 90000);
        nivraPaymentRef = `NIVRA-PAY-QC-${year}-${random}`;

        // Create payment record with pending/pre-authorized status
        const paymentRef = paymentConfirmationNumber || nivraPaymentRef;
        const { error: paymentError } = await supabase.from("payments").insert({
          user_id: user.id,
          amount: totalAmount,
          payment_method: paymentMethod === "credit_card" ? "credit_card" : "etransfer",
          reference_number: paymentRef,
          payment_reference: nivraPaymentRef,
          status: "pending",
          card_type: paymentMethod === "credit_card" ? "Visa/Mastercard" : null,
          card_last_four: paymentMethod === "credit_card" ? cardNumber.slice(-4) : null,
          etransfer_amount: paymentMethod === "etransfer" ? totalAmount : null,
          etransfer_sender_name: paymentMethod === "etransfer" ? etransferSenderName : null,
          notes: `Pré-autorisation pour commande ${data.order_number} - En attente de validation admin`,
        });

        if (paymentError) {
          console.error("Payment record error:", paymentError);
          postStepErrors.push("payment");
        } else {
          // Update order with payment reference
          await supabase.from("orders").update({
            payment_reference: nivraPaymentRef,
          }).eq("id", data.id);
        }
      } catch (paymentErr) {
        console.error("Payment step failed:", paymentErr);
        postStepErrors.push("payment");
      }

      try {
        // Create billing/invoice record for client portal
        const invoiceEquipmentSubtotal = 
          (hasTVService ? terminalQuantity * TERMINAL_CONFIG.price : 0) + 
          ((hasInternetService || hasTVService) ? ROUTER_CONFIG_DYNAMIC.price : 0) + 
          (hasMobileService ? SIM_CONFIG_DYNAMIC.physical.price * totalMobileLineQuantity : 0);
        const invoiceSubtotal = subtotal + paidChannelTotal + invoiceEquipmentSubtotal;
        
        // Calculate invoice delivery fee based on order type
        const invoiceDeliveryFee = isDeliveryOnlyOrder 
          ? (deliveryChoice === "uber" ? DELIVERY_CONFIG.uber.fee : 
             deliveryChoice === "shipHome" ? DELIVERY_CONFIG.shipHome.fee :
             DELIVERY_CONFIG.standard.fee)
          : (installationChoice === "auto" ? 30 : 0);
        
        // For equipment-only orders, no activation fee on invoice
        const invoiceActivationFee = isEquipmentOnlyOrder ? 0 : 25;
        const invoiceInstallationFee = (!isDeliveryOnlyOrder && installationChoice === "technician") ? Math.max(0, 50 - installationCredit) : 0;
        const invoiceBaseAmount = invoiceSubtotal + invoiceDeliveryFee + invoiceActivationFee + invoiceInstallationFee;
        const invoiceTps = Math.round(invoiceBaseAmount * 0.05 * 100) / 100;
        const invoiceTvq = Math.round(invoiceBaseAmount * 0.09975 * 100) / 100;
        
        // Prepare delivery type note
        const deliveryTypeNote = isDeliveryOnlyOrder 
          ? `\nType de livraison: ${deliveryChoice === "uber" ? "Express Uber (10h)" : 
             deliveryChoice === "shipHome" ? "Expédition à domicile (3-5 jours)" :
             "Standard (24-78h)"}`
          : '';
        
        const { error: billingError } = await supabase.from("billing").insert({
          user_id: user.id,
          client_email: profile?.email || user.email,
          order_id: data.id,
          related_order_number: data.order_number,
          payment_reference: nivraPaymentRef,
          amount: totalAmount,
          subtotal: invoiceSubtotal,
          delivery_fee: invoiceDeliveryFee,
          activation_fee: invoiceActivationFee,
          installation_fee: invoiceInstallationFee,
          discount_amount: appliedPromo?.discount_amount || 0,
          tps_amount: invoiceTps,
          tvq_amount: invoiceTvq,
          equipment_id: hasTVService ? `TERMINAL-${terminalQuantity}x` : (hasInternetService ? 'ROUTER' : (hasMobileService ? `SIM-${totalMobileLineQuantity}x` : null)),
          status: "pending",
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          notes: `Numéro de commande: ${data.order_number}\nRéférence paiement: ${nivraPaymentRef}\nServices: ${serviceNames}${deliveryTypeNote}` +
            (appliedPromo ? `\nCode promo: ${appliedPromo.code} — Rabais: ${appliedPromo.discount_amount.toFixed(2)}$` : ''),
          preauth_discount: acceptPreauthorized ? PREAUTH_MONTHLY_DISCOUNT : 0,
          preauth_discount_applied: acceptPreauthorized,
        });

        if (billingError) {
          console.error("Billing record error:", billingError);
          postStepErrors.push("billing");
        }
      } catch (billingErr) {
        console.error("Billing step failed:", billingErr);
        postStepErrors.push("billing");
      }

      // Create support ticket for TV channel configuration if TV service is included
      if (hasTVService && channelData.length > 0) {
        try {
          const baseChannelsList = baseChannels.map(ch => ch.name).join(', ');
          const freeChannelsList = selectedFreeChannels.map(ch => ch.name).join(', ') || 'Aucune';
          const paidChannelsList = selectedPaidChannels.map(ch => `${ch.name} ($${ch.price}/mois)`).join(', ') || 'Aucune';

          const ticketDescription = `
**Nouvelle commande TV - Configuration des chaînes requise**

**Client:** ${profile?.full_name || user?.email}
**Courriel:** ${profile?.email || user?.email}
**Commande:** ${data.order_number}

**Chaînes de base (incluses automatiquement):**
${baseChannelsList}

**Chaînes au choix sélectionnées (${selectedFreeChannels.length}/${freeChannelLimit}):**
${freeChannelsList}

**Chaînes payantes sélectionnées:**
${paidChannelsList}

**Délai estimé:** 2 à 24 heures

Veuillez confirmer les chaînes et procéder à l'activation du service.
          `.trim();

          const { error: ticketError } = await supabase.from("support_tickets").insert({
            user_id: user.id,
            owner_user_id: user.id, // REQUIRED: Must match auth.uid() for RLS
            client_email: profile?.email || user.email,
            subject: `Configuration TV - Commande ${data.order_number}`,
            description: ticketDescription,
            priority: "high",
            status: "open",
            category: "tv_setup",
            issue_type: "TV_CONFIGURATION",
            related_order_id: data.id,
            related_order_reference: data.order_number,
            id_verification_status: "not_received",
          });
          if (ticketError) {
            console.error("TV ticket creation failed (non-blocking):", ticketError);
            postStepErrors.push("ticket");
          }
        } catch (ticketErr) {
          console.error("TV ticket creation failed:", ticketErr);
          postStepErrors.push("ticket");
        }
      }

      // AUTO-CREATE APPOINTMENT for orders requiring installation (Internet/TV/Security)
      // Only create appointment if date and time are selected AND service requires installation
      const requiresInstallationService = hasInternetService || hasTVService || selectedServices.some(s => s.category === "Sécurité");
      const hasScheduledSlot = selectedDate && selectedTime;
      const shouldCreateAppointment = requiresInstallationService && hasScheduledSlot;
      
      if (shouldCreateAppointment) {
        try {
          const { createAppointmentFromOrder } = await import("@/lib/appointmentUtils");
          
          const equipmentDetails = [];
          if (hasInternetService || hasTVService) {
            equipmentDetails.push({ type: "router", name: "Nivra Born Wifi", fee: ROUTER_CONFIG_DYNAMIC.price });
          }
          if (hasTVService) {
            equipmentDetails.push({ type: "terminal", name: "Nivra 4K Smart Terminal", quantity: terminalQuantity, fee: terminalQuantity * TERMINAL_CONFIG.price });
          }
          
          const appointmentResult = await createAppointmentFromOrder({
            orderId: data.id,
            orderNumber: data.order_number,
            userId: user.id,
            clientEmail: profile?.email || user.email || "",
            clientPhone: profile?.phone || "",
            clientName: profile?.full_name || user.email?.split("@")[0] || "",
            serviceType: serviceNames,
            category: categories,
            serviceAddress: profile?.service_address || "",
            serviceCity: profile?.service_city || "",
            servicePostalCode: profile?.service_postal_code || "",
            scheduledDate: selectedDate,
            scheduledTime: selectedTime,
            installationMethod: (installationChoice as "auto" | "technician") || "auto",
            deliveryFee: orderDeliveryFee,
            installationFee: (!isDeliveryOnlyOrder && installationChoice === "technician") ? 50 : 0,
            equipmentDetails,
            notes: notes || "",
          });

          if (!appointmentResult.success) {
            console.error("Appointment creation failed:", appointmentResult.error);
            postStepErrors.push("appointment");
          } else {
            console.log("Appointment created successfully:", appointmentResult.appointment?.appointment_number);
          }
        } catch (apptErr) {
          console.error("Appointment step failed:", apptErr);
          postStepErrors.push("appointment");
        }
      }

      // Log any post-step errors but don't block order success
      if (postStepErrors.length > 0) {
        console.warn("Order created but some post-steps failed:", postStepErrors);
      }

      return { ...data, nivraPaymentRef, postStepErrors };
    },
    onSuccess: async (result) => {
      // Clear the order draft from sessionStorage
      clearOrderDraft();
      
      // Navigate to dedicated confirmation page with order ID
      const orderData = result as CreatedOrder & { nivraPaymentRef?: string };
      
      // Record promo/referral redemption if promo was applied
      if (appliedPromo && user?.id) {
        try {
          // Check if this is a referral code (influencer code)
          if (appliedPromo.is_referral_code && appliedPromo.referral_code_id && appliedPromo.influencer_id) {
            // Record in referral_attributions for influencer tracking
            await supabase.from("referral_attributions").insert({
              referral_code_id: appliedPromo.referral_code_id,
              influencer_id: appliedPromo.influencer_id,
              order_id: orderData.id,
              customer_id: user.id,
              customer_email: (profile?.email || user.email || "").toLowerCase(),
              customer_discount_amount: appliedPromo.discount_amount,
              status: 'pending',
            });
            console.log("[Referral] Attribution recorded for order:", orderData.order_number, "influencer:", appliedPromo.influencer_id);
            
            // Also increment usage_count on referral_codes
            await supabase.rpc('increment_referral_usage', { 
              code_id: appliedPromo.referral_code_id 
            });
            console.log("[Referral] Usage count incremented for code:", appliedPromo.referral_code_id);
          } else {
            // Regular promo code - record in promotion_redemptions
            await supabase.from("promotion_redemptions").insert({
              promotion_id: appliedPromo.id,
              order_id: orderData.id,
              order_number: orderData.order_number,
              client_id: user.id,
              client_email: (profile?.email || user.email || "").toLowerCase(),
              discount_amount: appliedPromo.discount_amount,
            });
            console.log("[Promo] Redemption recorded for order:", orderData.order_number);
          }
          
          // Create audit note for promo/referral applied
          const { AuditNotes } = await import("@/lib/clientAuditNotes");
          AuditNotes.promoApplied(
            user.id,
            orderData.id,
            appliedPromo.code,
            appliedPromo.discount_amount
          );
        } catch (promoErr) {
          console.error("[Promo/Referral] Failed to record redemption (non-blocking):", promoErr);
        }
      }
      
      // Invalidate queries so orders/invoices/appointments appear in admin & client views
      queryClient.invalidateQueries({ queryKey: ["client-orders-all"] });
      queryClient.invalidateQueries({ queryKey: ["client-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["client-invoices-all"] });
      queryClient.invalidateQueries({ queryKey: ["client-payments"] });
      queryClient.invalidateQueries({ queryKey: ["client-appointments-all"] });
      queryClient.invalidateQueries({ queryKey: ["admin-appointments-full"] });
      
      // Send confirmation email (non-blocking, wrapped in try-catch)
      try {
        const servicesForEmail = selectedServices.map(s => ({
          name: s.name,
          price: Number(s.price),
          period: s.category === "Mobile" ? "30 jours" : "mois",
        }));
        
        await supabase.functions.invoke("send-order-confirmation", {
          body: {
            order_id: orderData.id,
            client_email: profile?.email || user?.email,
            client_first_name: profile?.full_name?.split(" ")[0] || firstName || "Client",
            order_number: orderData.order_number,
            services: servicesForEmail,
            monthly_total_tax_in: monthlyRecurringWithTax,
            one_time_total: oneTimeFeesWithTax,
            delivery_method: isDeliveryOnlyOrder ? deliveryChoice : installationChoice,
            payment_reference: orderData.nivraPaymentRef || paymentConfirmationNumber,
          },
        });
        console.log("[OrderConfirmation] Email request sent for order:", orderData.order_number);
      } catch (emailErr) {
        console.error("[OrderConfirmation] Email sending failed (non-blocking):", emailErr);
      }
      
      // Navigate to confirmation page with order ID
      navigate(`/portal/order-confirmation?orderId=${orderData.id}`);
    },
    onError: (error: any) => {
      console.error("[ClientNewOrder] Order creation error:", error);
      
      // Parse error for user-friendly message
      let errorMessage = "Erreur lors de la soumission de la commande";
      let errorDescription = "Veuillez réessayer. Si le problème persiste, contactez le support.";
      
      if (error?.message) {
        errorMessage = error.message;
      }
      if (error?.code) {
        // Supabase/PostgreSQL error codes
        if (error.code === "42501" || error.message?.includes("permission denied")) {
          errorMessage = "Erreur de permissions";
          errorDescription = "Votre session a peut-être expiré. Veuillez vous reconnecter et réessayer.";
        } else if (error.code === "23505") {
          errorMessage = "Commande déjà créée";
          errorDescription = "Cette commande existe déjà. Vérifiez votre historique de commandes.";
        } else if (error.code === "PGRST301") {
          errorMessage = "Session expirée";
          errorDescription = "Veuillez vous reconnecter pour continuer.";
        }
      }
      
      toast.error(errorMessage, {
        description: errorDescription,
        duration: 10000,
      });
    },
    onSettled: () => {
      // Reset the submit guard so user can try again if it truly failed
      submittingRef.current = false;
    },
  });

  const toggleService = (service: Service) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.id === service.id);
      if (exists) {
        // If removing TV service, clear channel selections
        if (service.category === "TV") {
          setSelectedFreeChannels([]);
          setSelectedPaidChannels([]);
        }
        // If removing Mobile, remove from quantities
        if (service.category === "Mobile") {
          setMobileLineQuantities(q => {
            const newQ = { ...q };
            delete newQ[service.id];
            return newQ;
          });
        }
        return prev.filter(s => s.id !== service.id);
      }
      
      // RULE: Only 1 Internet plan per order/address
      if (service.category === "Internet") {
        const hasInternet = prev.some(s => s.category === "Internet");
        if (hasInternet) {
          toast.error("Une seule offre Internet par adresse est autorisée par commande. Pour une autre adresse, veuillez finaliser cette commande puis créer une nouvelle commande dans le même compte.");
          return prev;
        }
        // Check if TV combo already selected
        const tvInSelection = prev.find(s => s.category === "TV");
        if (tvInSelection) {
          const isTVComboPlan = tvInSelection.name.toLowerCase().includes('internet') || tvInSelection.name.toLowerCase().includes('giga');
          if (isTVComboPlan) {
            toast.info("Votre forfait TV inclut déjà Internet. Retirez-le d'abord pour sélectionner un autre forfait Internet.");
            return prev;
          }
        }
      }
      
      // RULE: Only 1 TV plan per order/address
      if (service.category === "TV") {
        const hasTV = prev.some(s => s.category === "TV");
        if (hasTV) {
          toast.error("Un seul forfait TV par adresse est autorisé par commande. Pour une autre adresse, veuillez finaliser cette commande puis créer une nouvelle commande dans le même compte.");
          return prev;
        }
        
        const hasInternet = prev.some(s => s.category === "Internet");
        const isComboPlan = service.name.toLowerCase().includes('internet') || service.name.toLowerCase().includes('giga');
        
        // If it's a combo plan (includes Internet), no need to check for separate Internet
        if (!hasInternet && !isComboPlan) {
          toast.error("Les forfaits TV nécessitent un service Internet actif. Veuillez d'abord sélectionner un forfait Internet.");
          return prev;
        }
        
        // If selecting a TV combo plan that includes Internet, remove any standalone Internet plan
        if (isComboPlan) {
          const filteredPrev = prev.filter(s => s.category !== "Internet");
          setTerminalQuantity(1);
          return [...filteredPrev, service];
        }
        
        // Reset terminal quantity when adding TV
        setTerminalQuantity(1);
      }
      
      // RULE: Only 1 Security plan per order/address
      if (service.category === "Sécurité") {
        const hasSecurity = prev.some(s => s.category === "Sécurité");
        if (hasSecurity) {
          toast.error("Un seul forfait Sécurité par adresse est autorisé par commande. Pour une autre adresse, veuillez finaliser cette commande puis créer une nouvelle commande dans le même compte.");
          return prev;
        }
      }
      
      // RULE: Mobile - allow multiple plans, each with its own quantity
      if (service.category === "Mobile") {
        // Initialize quantity for this plan to 1
        setMobileLineQuantities(q => ({ ...q, [service.id]: 1 }));
      }
      
      return [...prev, service];
    });
  };

  const toggleFreeChannel = (channel: Channel) => {
    setSelectedFreeChannels(prev => {
      const exists = prev.find(ch => ch.id === channel.id);
      if (exists) {
        return prev.filter(ch => ch.id !== channel.id);
      }
      
      // Count unique selections (bundled channels count as 1)
      const currentCount = countFreeChoiceSelections(prev);
      
      // Check if adding this channel would exceed the limit
      // If this channel has a group_key that's already selected, it doesn't count as new
      const wouldExceedLimit = channel.group_key 
        ? !prev.some(ch => ch.group_key === channel.group_key) && currentCount >= freeChannelLimit
        : currentCount >= freeChannelLimit;
        
      if (wouldExceedLimit) {
        toast.error(`Vous avez atteint la limite de ${freeChannelLimit} chaînes au choix pour votre forfait`);
        return prev;
      }
      return [...prev, channel];
    });
  };

  // Toggle premium channel (premium channels are paid separately)
  const togglePremiumChannel = (channel: Channel) => {
    setSelectedPaidChannels(prev => {
      const exists = prev.find(ch => ch.id === channel.id);
      if (exists) {
        return prev.filter(ch => ch.id !== channel.id);
      }
      return [...prev, channel];
    });
  };

  const togglePaidChannel = (channel: Channel) => {
    setSelectedPaidChannels(prev => {
      const exists = prev.find(ch => ch.id === channel.id);
      if (exists) {
        return prev.filter(ch => ch.id !== channel.id);
      }
      return [...prev, channel];
    });
  };

  const isSelected = (serviceId: string) => selectedServices.some(s => s.id === serviceId);

  // Get all selected mobile services
  const selectedMobileServices = selectedServices.filter(s => s.category === "Mobile");
  
  // Calculate total mobile lines across all plans
  const totalMobileLineQuantity = selectedMobileServices.reduce((sum, s) => sum + (mobileLineQuantities[s.id] || 1), 0);
  
  // Calculate mobile monthly total (sum of each plan * its quantity)
  const mobileMonthlyTotal = selectedMobileServices.reduce((sum, s) => {
    const qty = mobileLineQuantities[s.id] || 1;
    return sum + (Number(s.price) * qty);
  }, 0);
  
  // Calculate totals with fees and taxes based on installation/delivery choice
  // For mobile, multiply each plan by its quantity
  const subtotal = selectedServices.reduce((sum, s) => {
    if (s.category === "Mobile") {
      const qty = mobileLineQuantities[s.id] || 1;
      return sum + (Number(s.price) * qty);
    }
    return sum + Number(s.price);
  }, 0);
  const paidChannelTotal = selectedPaidChannels.reduce((sum, ch) => sum + Number(ch.price), 0);
  // Streaming+ add-ons monthly total
  const streamingAddonsTotal = selectedStreamingServices.reduce((sum, s) => sum + Number(s.monthly_price), 0);
  const terminalFee = hasTVService ? terminalQuantity * TERMINAL_CONFIG.price : 0;
  const routerFee = (hasInternetService || hasTVService) ? ROUTER_CONFIG_DYNAMIC.price : 0;
  // SIM: Always physical, quantity matches total mobile lines
  const simFee = hasMobileService ? SIM_CONFIG_DYNAMIC.physical.price * totalMobileLineQuantity : 0;
  
  // Fee logic based on installation choice OR delivery choice for delivery-only orders
  const calculateDeliveryFee = (): number => {
    if (isDeliveryOnlyOrder) {
      // For Mobile, Streaming, Accessories - use delivery choice
      if (deliveryChoice === "uber") return DELIVERY_CONFIG.uber.fee;
      if (deliveryChoice === "shipHome") return DELIVERY_CONFIG.shipHome.fee;
      if (deliveryChoice === "standard") return DELIVERY_CONFIG.standard.fee;
      return 0;
    }
    // For Internet, TV, Security - use installation choice
    return installationChoice === "auto" ? 30 : 0;
  };
  
  const deliveryFee = calculateDeliveryFee();
  // For equipment-only orders, no activation fee
  const activationFee = isEquipmentOnlyOrder ? 0 : 25;
  const installationFee = (!isDeliveryOnlyOrder && installationChoice === "technician") ? Math.max(0, 50 - installationCredit) : 0;
  
  // Calculate one-time fees vs monthly fees (include Streaming+ add-ons)
  const oneTimeFeesGross = deliveryFee + activationFee + installationFee + terminalFee + routerFee + simFee;
  const monthlyRecurring = subtotal + paidChannelTotal + streamingAddonsTotal;
  
  // Auto-credits for mobile orders (SIM fee + SIM delivery credited)
  const simCreditAmount = hasMobileService ? simFee : 0; // Credit all SIM fees
  const simDeliveryCreditAmount = hasMobileService ? deliveryFee : 0; // Credit delivery fee for mobile
  const autoCredits = simCreditAmount + simDeliveryCreditAmount;
  
  // Net one-time fees after credits
  const oneTimeFees = Math.max(0, oneTimeFeesGross - autoCredits);
  
  // Apply promo discount to base amount
  const promoDiscount = appliedPromo?.discount_amount || 0;
  const baseAmount = Math.max(0, monthlyRecurring + oneTimeFees - promoDiscount);
  const tpsAmount = Math.round(baseAmount * 0.05 * 100) / 100;
  const tvqAmount = Math.round(baseAmount * 0.09975 * 100) / 100;
  const totalAmount = baseAmount + tpsAmount + tvqAmount;

  // Separate tax calculations for bill preview
  const oneTimeFeesWithTax = oneTimeFees + Math.round(oneTimeFees * 0.14975 * 100) / 100;
  const monthlyRecurringWithTax = monthlyRecurring + Math.round(monthlyRecurring * 0.14975 * 100) / 100;

  // Canadian provinces for ID
  const CANADIAN_PROVINCES = [
    { value: "AB", label: "Alberta" },
    { value: "BC", label: "Colombie-Britannique" },
    { value: "MB", label: "Manitoba" },
    { value: "NB", label: "Nouveau-Brunswick" },
    { value: "NL", label: "Terre-Neuve-et-Labrador" },
    { value: "NS", label: "Nouvelle-Écosse" },
    { value: "NT", label: "Territoires du Nord-Ouest" },
    { value: "NU", label: "Nunavut" },
    { value: "ON", label: "Ontario" },
    { value: "PE", label: "Île-du-Prince-Édouard" },
    { value: "QC", label: "Québec" },
    { value: "SK", label: "Saskatchewan" },
    { value: "YT", label: "Yukon" },
  ];

  // ID types
  const ID_TYPES = [
    { value: "drivers_license", label: "Permis de conduire" },
    { value: "health_card", label: "Carte d'assurance maladie" },
    { value: "passport", label: "Passeport" },
    { value: "residency_card", label: "Carte de résidence permanente" },
  ];

  // Group services by category - filter out "Sécurité entreprise" + hide equipment catalog for clients
  const groupedServices = services?.reduce((acc, service) => {
    // RULE: Remove "Sécurité entreprise" from catalog
    if (service.name.toLowerCase().includes("entreprise") && service.category === "Sécurité") {
      return acc;
    }

    const categoryLower = (service.category || "").toLowerCase();
    const nameLower = (service.name || "").toLowerCase();

    const isEquipmentCategory =
      categoryLower.includes("équipement") ||
      categoryLower.includes("equipement") ||
      categoryLower === "equipment";

    const isEquipmentName = [
      "terminal nivra",
      "router nivra",
      "nivra born wifi",
      "esim",
      "physical sim",
    ].some((k) => nameLower.includes(k));

    // Defensive: never render equipment selection UI for clients
    if (isClient && (isEquipmentCategory || isEquipmentName)) {
      return acc;
    }

    if (!acc[service.category]) {
      acc[service.category] = [];
    }
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  // Check if installation appointment is required (only for technician installation)
  const requiresInstallation = installationChoice === "technician" && selectedServices.some(s => ["Internet", "TV", "Sécurité"].includes(s.category));
  
  // Check if ID details are complete
  const isIdComplete = idType && idNumber && idExpiration && idProvince;
  
  // Check if payment is complete
  const isPaymentComplete = paymentComplete && paymentConfirmationNumber;
  
  // Validate credit card format
  const isCardValid = cardNumber.replace(/\s/g, '').length >= 15 && 
    cardExpiry.length === 5 && 
    cardCvv.length >= 3 && 
    cardName.length >= 2;
  
  // Validate e-transfer info
  const isEtransferValid = etransferConfirmationNumber.length >= 6 && etransferSenderName.length >= 2;

  // Process credit card payment (simulated)
  const processCardPayment = () => {
    if (!isCardValid) {
      toast.error("Veuillez vérifier les informations de votre carte");
      return;
    }
    const confirmNumber = `CC-${Date.now().toString().slice(-8)}`;
    setPaymentConfirmationNumber(confirmNumber);
    setPaymentComplete(true);
    toast.success(`Paiement accepté! Confirmation: ${confirmNumber}`);
  };

  // Process e-transfer payment confirmation
  const processEtransferPayment = () => {
    if (!isEtransferValid) {
      toast.error("Veuillez entrer le numéro de confirmation Interac et votre nom");
      return;
    }
    setPaymentConfirmationNumber(etransferConfirmationNumber);
    setPaymentComplete(true);
    toast.success(`Paiement E-Transfer confirmé! Référence: ${etransferConfirmationNumber}`);
  };

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
    
    // CRITICAL VALIDATION: DOB is ALWAYS required for orders (enforced by DB trigger + CHECK constraint)
    // This UI validation prevents wasted DB roundtrips
    
    // Step 1: DOB must be provided (non-empty)
    if (!dateOfBirth || !dateOfBirth.trim()) {
      submittingRef.current = false;
      toast.error("La date de naissance est requise pour passer une commande");
      return;
    }
    
    // Step 2: DOB must be parseable (valid date format YYYY-MM-DD)
    // Safe validation with try/catch to prevent any crash
    try {
      const parsed = parseISO(dateOfBirth);
      if (!isValid(parsed)) {
        submittingRef.current = false;
        toast.error("Format de date invalide. Utilisez AAAA-MM-JJ.");
        return;
      }
      
      // Step 3: DOB must pass all validation rules (not future, >= 13 years, <= 120 years)
      const dobResult = validateDob(dateOfBirth, { minAge: MIN_AGE_TELECOM, required: true });
      if (!dobResult.isValid) {
        submittingRef.current = false;
        toast.error(dobResult.error?.fr || "Date de naissance invalide");
        return;
      }
    } catch {
      submittingRef.current = false;
      toast.error("Date de naissance invalide");
      return;
    }
    
    if (selectedServices.length === 0) {
      submittingRef.current = false;
      toast.error("Veuillez sélectionner au moins un service");
      return;
    }
    if (!isIdComplete) {
      submittingRef.current = false;
      toast.error("Veuillez remplir tous les champs d'identification");
      return;
    }
    // Validate delivery/installation choice based on order type
    if (isDeliveryOnlyOrder) {
      if (!deliveryChoice) {
        submittingRef.current = false;
        toast.error("Veuillez choisir un mode de livraison");
        return;
      }
    } else {
      if (!installationChoice) {
        submittingRef.current = false;
        toast.error("Veuillez choisir un type d'installation");
        return;
      }
      if (requiresInstallation && (!selectedDate || !selectedTime)) {
        submittingRef.current = false;
        toast.error("Veuillez sélectionner une date et heure d'installation");
        return;
      }
    }
    if (!isPaymentComplete) {
      submittingRef.current = false;
      toast.error("Veuillez compléter le paiement avant de soumettre votre commande");
      return;
    }
    if (!termsAccepted) {
      submittingRef.current = false;
      toast.error("Veuillez accepter les termes et conditions");
      return;
    }
    createOrderMutation.mutate();
  };


  return (
    <ClientLayout>
      <div className="space-y-6">
        {/* Show loading while hydrating to prevent step guards from triggering */}
        {!isHydrated ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-muted-foreground">Chargement...</span>
          </div>
        ) : (
          <>
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground">Nouvelle commande</h1>
              <p className="text-muted-foreground mt-1">Sélectionnez les services que vous souhaitez commander</p>
            </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 sm:gap-4">
          {(() => {
            // Determine steps based on selected services
            const steps = [{ num: 1, label: "Services" }];
            let stepNum = 2;
            
            if (hasTVService) {
              steps.push({ num: stepNum++, label: "Chaînes TV" });
            }
            if (hasMobileService) {
              steps.push({ num: stepNum++, label: "Transfert" });
            }
            steps.push({ num: stepNum++, label: "Vérification" });
            steps.push({ num: stepNum++, label: "Confirmation" });
            steps.push({ num: stepNum++, label: "Terminé" });
            
            return steps.map((s, i, arr) => (
              <React.Fragment key={s.num}>
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
              </React.Fragment>
            ));
          })()}
        </div>

        {/* Step 1: Service Selection - Professional 2-Column Layout */}
        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Service Selection */}
            <div className="lg:col-span-2 space-y-6">
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : groupedServices && Object.keys(groupedServices).length > 0 ? (
                <div className="space-y-8">
                  {/* TV + Internet Bundle Notice */}
                  <Card className="bg-blue-500/10 border-blue-500/30">
                    <CardContent className="py-4 flex items-start gap-3">
                      <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-foreground mb-1">Forfaits TV + Internet</p>
                        <p className="text-muted-foreground">
                          Les forfaits TV incluent déjà Internet (500 Mbps ou 1 Gbps). 
                          Si vous sélectionnez un forfait TV, vous ne pouvez pas ajouter un forfait Internet séparé.
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Conflict Warning */}
                  {hasTVService && hasInternetService && (
                    <Card className="bg-destructive/10 border-destructive/30">
                      <CardContent className="py-4 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-destructive mb-1">Conflit de forfait détecté</p>
                          <p className="text-muted-foreground">
                            Votre forfait TV inclut déjà Internet. Veuillez retirer le forfait Internet ou le forfait TV.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Service Categories */}
                  {Object.entries(groupedServices).map(([category, categoryServices]) => {
                    const CategoryIcon = categoryIcons[category] || Package;
                    return (
                      <div key={category}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${categoryColors[category]?.split(' ')[0] || 'bg-muted'}`}>
                            <CategoryIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-foreground">{category}</h2>
                            {category === "TV" && (
                              <p className="text-xs text-pink-500">Inclut Internet • La Base (37 chaînes HD) + chaînes au choix</p>
                            )}
                            {category === "Internet" && hasTVService && (
                              <p className="text-xs text-destructive">⚠️ Non disponible - votre forfait TV inclut déjà Internet</p>
                            )}
                            {category === "Mobile" && (
                              <p className="text-xs text-blue-500">Aucune vérification de crédit • ID gouvernemental requis</p>
                            )}
                            {category === "Streaming" && (
                              <p className="text-xs text-orange-500">Accès navigateur uniquement</p>
                            )}
                            {category === "Sécurité" && (
                              <p className="text-xs text-emerald-500">Protection résidentielle complète</p>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {categoryServices.map((service) => {
                            const isServiceSelected = isSelected(service.id);
                            const qty = service.category === "Mobile" ? (mobileLineQuantities[service.id] || 1) : 1;
                            const monthlyPrice = Number(service.price) * qty;
                            
                            // Calculate one-time fees for this specific service
                            let serviceOneTimeFee = 0;
                            if (service.category === "Mobile" && isServiceSelected) {
                              serviceOneTimeFee = SIM_CONFIG_DYNAMIC.physical.price * qty;
                            }
                            if (service.category === "TV" && isServiceSelected) {
                              serviceOneTimeFee = TERMINAL_CONFIG.price + ROUTER_CONFIG_DYNAMIC.price;
                            }
                            if (service.category === "Internet" && isServiceSelected && !hasTVService) {
                              serviceOneTimeFee = ROUTER_CONFIG_DYNAMIC.price;
                            }
                            
                            return (
                              <Card
                                key={service.id}
                                className={`cursor-pointer transition-all hover:shadow-lg ${
                                  isServiceSelected
                                    ? "border-cyan-500 bg-cyan-500/5 shadow-cyan-500/20 ring-1 ring-cyan-500/30"
                                    : "border-border hover:border-cyan-500/50"
                                }`}
                                onClick={() => toggleService(service)}
                              >
                                <CardContent className="p-4">
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                      <h3 className="font-semibold text-foreground">{service.name}</h3>
                                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{service.description}</p>
                                    </div>
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ml-2 ${
                                      isServiceSelected
                                        ? "bg-cyan-500 text-white"
                                        : "border-2 border-muted-foreground/30"
                                    }`}>
                                      {isServiceSelected && <Check className="w-4 h-4" />}
                                    </div>
                                  </div>
                                  
                                  {/* Professional pricing display */}
                                  <div className="space-y-1 pt-2 border-t border-border/50">
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-muted-foreground">Mensuel (récurrent)</span>
                                      <span className="text-lg font-bold text-cyan-500">
                                        {monthlyPrice.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                                        <span className="text-xs font-normal">/mois</span>
                                      </span>
                                    </div>
                                    {isServiceSelected && serviceOneTimeFee > 0 && (
                                      <div className="flex justify-between items-center text-xs">
                                        <span className="text-amber-500">Frais uniques (équipement)</span>
                                        <span className="text-amber-500">{serviceOneTimeFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                                      </div>
                                    )}
                                    {!isEquipmentOnlyOrder && isServiceSelected && (
                                      <div className="flex justify-between items-center text-xs">
                                        <span className="text-muted-foreground">+ Frais d'activation</span>
                                        <span className="text-muted-foreground">25,00 $</span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Mobile quantity selector inline */}
                                  {service.category === "Mobile" && isServiceSelected && (
                                    <div className="mt-3 pt-3 border-t border-border/50">
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Lignes</span>
                                        <div className="flex items-center gap-2">
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setMobileLineQuantities(q => ({ ...q, [service.id]: Math.max(1, qty - 1) }));
                                            }}
                                            disabled={qty <= 1}
                                          >
                                            <Minus className="w-3 h-3" />
                                          </Button>
                                          <span className="text-lg font-bold text-blue-500 w-6 text-center">{qty}</span>
                                          <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setMobileLineQuantities(q => ({ ...q, [service.id]: Math.min(10, qty + 1) }));
                                            }}
                                            disabled={qty >= 10}
                                          >
                                            <Plus className="w-3 h-3" />
                                          </Button>
                                        </div>
                                      </div>
                                      <p className="text-xs text-emerald-500 mt-1">
                                        + {qty} carte(s) SIM incluse(s) automatiquement
                                      </p>
                                    </div>
                                  )}
                                  
                                  <div className="flex items-center justify-between mt-3">
                                    <Badge className={`${categoryColors[category] || "bg-muted"} text-xs`}>
                                      {category}
                                    </Badge>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Streaming+ Add-ons Section */}
                  <StreamingPlusSection 
                    selectedStreamingServices={selectedStreamingServices}
                    onStreamingServicesChange={setSelectedStreamingServices}
                  />
                </div>
              ) : (
                <Card className="bg-card border-border">
                  <CardContent className="py-12 text-center">
                    <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Aucun service disponible pour le moment</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column: Professional Order Summary (Sticky) */}
            <div className="lg:col-span-1">
              <div className="hidden lg:block">
                <ProfessionalOrderSummary
                  selectedServices={selectedServices}
                  selectedMobileServices={selectedMobileServices}
                  mobileLineQuantities={mobileLineQuantities}
                  totalMobileLineQuantity={totalMobileLineQuantity}
                  selectedPaidChannels={selectedPaidChannels}
                  paidChannelTotal={paidChannelTotal}
                  selectedStreamingAddons={selectedStreamingServices}
                  streamingAddonsTotal={streamingAddonsTotal}
                  monthlyRecurring={monthlyRecurring}
                  oneTimeFees={oneTimeFees}
                  oneTimeFeesGross={oneTimeFeesGross}
                  activationFee={activationFee}
                  deliveryFee={deliveryFee}
                  installationFee={installationFee}
                  terminalFee={terminalFee}
                  routerFee={routerFee}
                  simFee={simFee}
                  simCreditAmount={simCreditAmount}
                  simDeliveryCreditAmount={simDeliveryCreditAmount}
                  terminalQuantity={terminalQuantity}
                  baseAmount={baseAmount}
                  tpsAmount={tpsAmount}
                  tvqAmount={tvqAmount}
                  totalAmount={totalAmount}
                  oneTimeFeesWithTax={oneTimeFeesWithTax}
                  monthlyRecurringWithTax={monthlyRecurringWithTax}
                  hasMobileService={hasMobileService}
                  hasTVService={hasTVService}
                  hasInternetService={hasInternetService}
                  isEquipmentOnlyOrder={isEquipmentOnlyOrder}
                  isDeliveryOnlyOrder={isDeliveryOnlyOrder}
                  deliveryChoice={deliveryChoice}
                  installationChoice={installationChoice}
                  onContinue={() => setStep(2)}
                  continueDisabled={selectedServices.length === 0}
                />
              </div>
              
              {/* Mobile: Collapsible summary at bottom */}
              <div className="lg:hidden">
                {selectedServices.length > 0 && (
                  <ProfessionalOrderSummary
                    selectedServices={selectedServices}
                    selectedMobileServices={selectedMobileServices}
                    mobileLineQuantities={mobileLineQuantities}
                    totalMobileLineQuantity={totalMobileLineQuantity}
                    selectedPaidChannels={selectedPaidChannels}
                    paidChannelTotal={paidChannelTotal}
                    selectedStreamingAddons={selectedStreamingServices}
                    streamingAddonsTotal={streamingAddonsTotal}
                    monthlyRecurring={monthlyRecurring}
                    oneTimeFees={oneTimeFees}
                    oneTimeFeesGross={oneTimeFeesGross}
                    activationFee={activationFee}
                    deliveryFee={deliveryFee}
                    installationFee={installationFee}
                    terminalFee={terminalFee}
                    routerFee={routerFee}
                    simFee={simFee}
                    simCreditAmount={simCreditAmount}
                    simDeliveryCreditAmount={simDeliveryCreditAmount}
                    terminalQuantity={terminalQuantity}
                    baseAmount={baseAmount}
                    tpsAmount={tpsAmount}
                    tvqAmount={tvqAmount}
                    totalAmount={totalAmount}
                    oneTimeFeesWithTax={oneTimeFeesWithTax}
                    monthlyRecurringWithTax={monthlyRecurringWithTax}
                    hasMobileService={hasMobileService}
                    hasTVService={hasTVService}
                    hasInternetService={hasInternetService}
                    isEquipmentOnlyOrder={isEquipmentOnlyOrder}
                    isDeliveryOnlyOrder={isDeliveryOnlyOrder}
                    deliveryChoice={deliveryChoice}
                    installationChoice={installationChoice}
                    onContinue={() => setStep(2)}
                    continueDisabled={selectedServices.length === 0}
                    isMobile={true}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Channel Selection (Only for TV orders) */}
        {step === 2 && hasTVService && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Global channel loading/error state */}
              {channelsLoading && (
                <Card className="bg-card border-border">
                  <CardContent className="py-12 text-center">
                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">Chargement des chaînes TV...</p>
                  </CardContent>
                </Card>
              )}
              
              {channelsError && (
                <Card className="bg-destructive/10 border-destructive/30">
                  <CardContent className="py-8 text-center">
                    <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-4" />
                    <p className="text-destructive font-medium mb-2">Erreur lors du chargement des chaînes</p>
                    <p className="text-sm text-muted-foreground mb-4">Veuillez réessayer</p>
                    <Button variant="outline" onClick={() => refetchChannels()}>
                      Réessayer
                    </Button>
                  </CardContent>
                </Card>
              )}
              
              {!channelsLoading && !channelsError && (
                <>
              {/* Base Channels - "La Base" Always Included - strict 26 */}
              <Card className="bg-emerald-500/10 border-emerald-500/30">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <MonitorPlay className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          La Base — 26 chaînes HD
                        </CardTitle>
                        <CardDescription>
                          Incluant les réseaux généralistes canadiens. Toujours inclus avec votre forfait.
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className="bg-emerald-500">INCLUS</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {baseChannels.length === 0 ? (
                    <div className="text-center py-6">
                      <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
                      <p className="text-sm text-amber-600 font-medium">Catalogue de base indisponible</p>
                      <p className="text-xs text-muted-foreground mt-1">Veuillez réessayer ou contacter le support.</p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => refetchChannels()}>
                        Réessayer
                      </Button>
                    </div>
                  ) : baseChannels.length < 26 ? (
                    <div className="text-center py-6">
                      <AlertCircle className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                      <p className="text-sm text-amber-600">Catalogue de base incomplet ({baseChannels.length}/26 chaînes)</p>
                      <ScrollArea className="h-48 mt-3">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {baseChannels.map((channel) => (
                            <div key={channel.id} className="flex items-center gap-2 p-2 bg-accent/30 rounded text-sm">
                              <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                              <span className="truncate">{channel.name}</span>
                              {channel.is_hd && <Badge variant="outline" className="text-[10px] px-1">HD</Badge>}
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  ) : (
                    <ScrollArea className="h-48">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {baseChannels.map((channel) => (
                          <div key={channel.id} className="flex items-center gap-2 p-2 bg-accent/30 rounded text-sm">
                            <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                            <span className="truncate">{channel.name}</span>
                            {channel.is_hd && <Badge variant="outline" className="text-[10px] px-1">HD</Badge>}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                  <p className="text-xs text-muted-foreground mt-3 text-center">
                    {baseChannels.length} chaînes de base disponibles dans votre région
                  </p>
                </CardContent>
              </Card>

              {/* Free-Choice Channels (Populaires) */}
              {freeChannelLimit > 0 && (
              <Card className="bg-card border-cyan-500/30">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                        <Star className="w-5 h-5 text-cyan-500" />
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          Chaînes au choix (Populaires)
                          <Badge variant="outline" className={`${
                            freeChoiceSelectionCount === freeChannelLimit 
                              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" 
                              : "bg-cyan-500/10 text-cyan-500 border-cyan-500/30"
                          }`}>
                            {freeChoiceSelectionCount}/{freeChannelLimit} sélectionnées
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          Choisissez {freeChannelLimit} chaînes incluses avec votre forfait. Les chaînes jumelées comptent comme 1 choix.
                        </CardDescription>
                      </div>
                    </div>
                    {/* Random selection button */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-cyan-500 border-cyan-500/30 hover:bg-cyan-500/10"
                      onClick={() => {
                        // Randomly select free-choice channels respecting limit
                        const shuffled = [...freeChoiceChannels].sort(() => Math.random() - 0.5);
                        const selected: Channel[] = [];
                        let count = 0;
                        const usedGroups = new Set<string>();
                        
                        for (const ch of shuffled) {
                          if (count >= freeChannelLimit) break;
                          if (ch.group_key) {
                            if (!usedGroups.has(ch.group_key)) {
                              // Add all channels in this group
                              const groupChannels = freeChoiceChannels.filter(c => c.group_key === ch.group_key);
                              selected.push(...groupChannels);
                              usedGroups.add(ch.group_key);
                              count++;
                            }
                          } else {
                            selected.push(ch);
                            count++;
                          }
                        }
                        setSelectedFreeChannels(selected);
                      }}
                      disabled={freeChoiceChannels.length === 0}
                    >
                      🎲 Choisir au hasard
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {freeChoiceChannels.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Chargement des chaînes...</p>
                    </div>
                  ) : (
                  <ScrollArea className="h-72">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {freeChoiceChannels.map((channel) => {
                        const isChannelSelected = selectedFreeChannels.some(ch => ch.id === channel.id);
                        const currentCount = freeChoiceSelectionCount;
                        // Check if adding this channel would exceed limit
                        const wouldExceedLimit = channel.group_key 
                          ? !selectedFreeChannels.some(ch => ch.group_key === channel.group_key) && currentCount >= freeChannelLimit
                          : currentCount >= freeChannelLimit;
                        const isDisabled = !isChannelSelected && wouldExceedLimit;
                        const displayName = channel.display_label || channel.name;
                        const isBundled = !!channel.group_key;
                        
                        return (
                          <div
                            key={channel.id}
                            className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                              isChannelSelected
                                ? "bg-cyan-500/20 border border-cyan-500 cursor-pointer"
                                : isDisabled 
                                  ? "bg-muted/30 border border-transparent opacity-50 cursor-not-allowed"
                                  : "bg-accent/30 hover:bg-accent/50 border border-transparent cursor-pointer"
                            }`}
                            onClick={() => !isDisabled && toggleFreeChannel(channel)}
                          >
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                              isChannelSelected ? "bg-cyan-500 text-white" : "border-2 border-muted-foreground/30"
                            }`}>
                              {isChannelSelected && <Check className="w-3 h-3" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{displayName}</p>
                              {isBundled && (
                                <p className="text-xs text-amber-500">Chaînes jumelées = 1 choix</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {channel.is_hd && <Badge variant="outline" className="text-xs px-1">HD</Badge>}
                              <Badge className="bg-emerald-500/20 text-emerald-500 border-0">Gratuit</Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  )}
                  {freeChoiceSelectionCount >= freeChannelLimit && (
                    <div className="flex items-center gap-2 p-3 mt-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      <p className="text-sm text-amber-700">
                        Limite atteinte. Désélectionnez une chaîne pour en choisir une autre.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
              )}

              {/* Premium Channels */}
              {premiumChannels.length > 0 && (
              <Card className="bg-card border-purple-500/30">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <Star className="w-5 h-5 text-purple-500" />
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          Chaînes Premium
                        </CardTitle>
                        <CardDescription>
                          Forfaits premium avec abonnement mensuel supplémentaire
                        </CardDescription>
                      </div>
                    </div>
                    {selectedPaidChannels.filter(ch => ch.category === 'premium').length > 0 && (
                      <Badge className="bg-purple-500">
                        +{selectedPaidChannels.filter(ch => ch.category === 'premium').reduce((sum, ch) => sum + Number(ch.price), 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {premiumChannels.map((channel) => {
                      const isChannelSelected = selectedPaidChannels.some(ch => ch.id === channel.id);
                      return (
                        <div
                          key={channel.id}
                          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                            isChannelSelected
                              ? "bg-purple-500/20 border border-purple-500"
                              : "bg-accent/30 hover:bg-accent/50 border border-transparent"
                          }`}
                          onClick={() => togglePremiumChannel(channel)}
                        >
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isChannelSelected ? "bg-purple-500 text-white" : "border-2 border-muted-foreground/30"
                          }`}>
                            {isChannelSelected && <Check className="w-3 h-3" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{channel.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{channel.description}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {channel.is_hd && <Badge variant="outline" className="text-xs px-1">HD</Badge>}
                            <Badge className="bg-purple-500/20 text-purple-500 border-0">
                              {Number(channel.price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
              )}

              {/* Paid Channels (À la carte) */}
              <Card className="bg-card border-amber-500/30">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <Star className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          Chaînes payantes (À la carte)
                        </CardTitle>
                        <CardDescription>
                          Chaînes avec frais mensuels supplémentaires
                        </CardDescription>
                      </div>
                    </div>
                    {selectedPaidChannels.filter(ch => ch.category === 'paid').length > 0 && (
                      <Badge className="bg-amber-500">
                        +{selectedPaidChannels.filter(ch => ch.category === 'paid').reduce((sum, ch) => sum + Number(ch.price), 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {paidChannels.length === 0 ? (
                    <div className="text-center py-6">
                      <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Chargement des chaînes...</p>
                    </div>
                  ) : (
                  <ScrollArea className="h-64">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {paidChannels.map((channel) => {
                        const isChannelSelected = selectedPaidChannels.some(ch => ch.id === channel.id);
                        return (
                          <div
                            key={channel.id}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                              isChannelSelected
                                ? "bg-amber-500/20 border border-amber-500"
                                : "bg-accent/30 hover:bg-accent/50 border border-transparent"
                            }`}
                            onClick={() => togglePaidChannel(channel)}
                          >
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                              isChannelSelected ? "bg-amber-500 text-white" : "border-2 border-muted-foreground/30"
                            }`}>
                              {isChannelSelected && <Check className="w-3 h-3" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{channel.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{channel.description}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              {channel.is_hd && <Badge variant="outline" className="text-xs px-1">HD</Badge>}
                              <Badge className="bg-amber-500/20 text-amber-500 border-0">
                                {Number(channel.price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  )}
                </CardContent>
              </Card>
              </>
              )}
            </div>

            {/* Equipment is auto-attached based on plan rules - no manual selection */}

            {/* Channel Selection Summary */}
            <div className="lg:col-span-1">
              <Card className="bg-card border-cyan-500/30 sticky top-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tv className="w-5 h-5 text-cyan-500" />
                    Résumé des chaînes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Chaînes de base</span>
                      <span className="text-emerald-500">{baseChannels.length} incluses</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Chaînes au choix</span>
                      <span className="text-cyan-500">{selectedFreeChannels.length}/{freeChannelLimit}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Chaînes premium</span>
                      <span className="text-amber-500">{selectedPaidChannels.length} sélectionnées</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between font-medium">
                      <span>Total chaînes</span>
                      <span>{baseChannels.length + selectedFreeChannels.length + selectedPaidChannels.length}</span>
                    </div>
                    {paidChannelTotal > 0 && (
                      <div className="flex justify-between text-amber-500">
                        <span>Chaînes premium</span>
                        <span>+{paidChannelTotal.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois</span>
                      </div>
                    )}
                    <div className="flex justify-between text-cyan-500">
                      <span>{TERMINAL_CONFIG.name} (inclus)</span>
                      <span>{TERMINAL_CONFIG.price.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    <div className="flex justify-between text-cyan-500">
                      <span>{ROUTER_CONFIG_DYNAMIC.name} (inclus)</span>
                      <span>{ROUTER_CONFIG_DYNAMIC.price.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center">
                    <span className="font-medium text-foreground">Total mensuel</span>
                    <span className="text-xl font-bold text-cyan-500">
                      {(subtotal + paidChannelTotal).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                    </span>
                  </div>

                  <div className="pt-4 space-y-3">
                    <Button
                      variant="hero"
                      className="w-full"
                      size="lg"
                      onClick={() => setStep(hasMobileService ? 3 : 4)}
                    >
                      Continuer
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setStep(1)}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Modifier les services
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Step 2 (no TV) or Step 3 (with TV): Mobile Transfer Eligibility */}
        {((step === 2 && !hasTVService && hasMobileService) || (step === 3 && hasTVService && hasMobileService)) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-card border-blue-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-blue-500" />
                    Transfert de numéro mobile
                  </CardTitle>
                  <CardDescription>
                    Souhaitez-vous transférer votre numéro actuel ou obtenir un nouveau numéro québécois?
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Choice selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card
                      className={`cursor-pointer transition-all ${
                        mobileTransferChoice === "transfer"
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-border hover:border-blue-500/50"
                      }`}
                      onClick={() => {
                        setMobileTransferChoice("transfer");
                        setTransferValidationResult(null);
                      }}
                    >
                      <CardContent className="p-4 text-center">
                        <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3 ${
                          mobileTransferChoice === "transfer" ? "bg-blue-500 text-white" : "bg-muted"
                        }`}>
                          <ArrowRight className="w-6 h-6" />
                        </div>
                        <h3 className="font-semibold text-foreground">Transférer mon numéro</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Garder votre numéro québécois actuel
                        </p>
                      </CardContent>
                    </Card>

                    <Card
                      className={`cursor-pointer transition-all ${
                        mobileTransferChoice === "new"
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-border hover:border-emerald-500/50"
                      }`}
                      onClick={handleNewNumberSelection}
                    >
                      <CardContent className="p-4 text-center">
                        <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3 ${
                          mobileTransferChoice === "new" ? "bg-emerald-500 text-white" : "bg-muted"
                        }`}>
                          <Plus className="w-6 h-6" />
                        </div>
                        <h3 className="font-semibold text-foreground">Nouveau numéro</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Obtenir un nouveau numéro québécois
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Transfer flow */}
                  {mobileTransferChoice === "transfer" && (
                    <div className="space-y-4 pt-4 border-t border-border">
                      <div className="space-y-2">
                        <Label>Numéro à transférer</Label>
                        <div className="flex gap-2">
                          <Input
                            placeholder="Ex: 514-555-1234"
                            value={transferPhoneNumber}
                            onChange={(e) => {
                              setTransferPhoneNumber(e.target.value);
                              setTransferValidationResult(null);
                            }}
                          />
                          <Button variant="outline" onClick={handleTransferPhoneValidation}>
                            Vérifier
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Seuls les numéros québécois sont acceptés (418, 367, 514, 263, 450, 579, 354, 819, 873, 468)
                        </p>
                      </div>

                      {transferValidationResult === "invalid" && (
                        <Card className="bg-destructive/10 border-destructive/30">
                          <CardContent className="py-3 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-destructive">
                              Ce numéro n'est pas un numéro québécois valide ou n'est pas éligible au transfert. 
                              Veuillez vérifier le numéro ou choisir un nouveau numéro.
                            </p>
                          </CardContent>
                        </Card>
                      )}

                      {transferValidationResult === "valid" && (
                        <div className="space-y-4">
                          <Card className="bg-emerald-500/10 border-emerald-500/30">
                            <CardContent className="py-3 flex items-start gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                              <p className="text-sm text-emerald-500">
                                Numéro québécois valide! Veuillez compléter les informations de transfert.
                              </p>
                            </CardContent>
                          </Card>

                          <div className="space-y-2">
                            <Label>Fournisseur actuel</Label>
                            <select
                              className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                              value={transferCarrier}
                              onChange={(e) => setTransferCarrier(e.target.value)}
                            >
                              <option value="">Sélectionner votre fournisseur</option>
                              {QUEBEC_CARRIERS.map((carrier) => (
                                <option key={carrier} value={carrier}>{carrier}</option>
                              ))}
                            </select>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Numéro de compte télécommunications</Label>
                              <Input
                                placeholder="Ex: 123456789"
                                value={transferAccountNumber}
                                onChange={(e) => setTransferAccountNumber(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Numéro de compte de service</Label>
                              <Input
                                placeholder="Ex: 987654321"
                                value={transferServiceAccount}
                                onChange={(e) => setTransferServiceAccount(e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>IMEI / Numéro de série (optionnel)</Label>
                            <Input
                              placeholder="Ex: 123456789012345"
                              value={transferImei}
                              onChange={(e) => setTransferImei(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              Composez *#06# sur votre téléphone pour obtenir votre IMEI
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* New number confirmation */}
                  {mobileTransferChoice === "new" && (
                    <Card className="bg-emerald-500/10 border-emerald-500/30">
                      <CardContent className="py-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          <p className="font-medium text-emerald-500">Nouveau numéro québécois</p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Un nouveau numéro québécois vous sera attribué automatiquement après la confirmation de votre commande. 
                          Vous ne pouvez pas choisir ou réserver un numéro spécifique.
                        </p>
                        <p className="text-xs text-muted-foreground italic">
                          Le numéro sera actif uniquement après validation de la commande.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>

              {/* SIM Cards (auto-attached; no manual selection) */}
              <Card className="bg-card border-blue-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-blue-500" />
                    Cartes SIM
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Cartes SIM physiques incluses automatiquement selon le nombre de lignes mobiles.
                  </p>

                  <div className="flex justify-between text-sm">
                    <span className="text-blue-500">{SIM_CONFIG_DYNAMIC.physical.name} (×{totalMobileLineQuantity})</span>
                    <span className="text-blue-500">
                      {(SIM_CONFIG_DYNAMIC.physical.price * totalMobileLineQuantity).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                    </span>
                  </div>

                  <div className="text-sm text-muted-foreground space-y-1 pt-2">
                    <p>• {SIM_CONFIG_DYNAMIC.warranty}</p>
                    <p>• {SIM_CONFIG_DYNAMIC.notes}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Mobile Transfer Summary */}
            <div className="lg:col-span-1">
              <Card className="bg-card border-blue-500/30 sticky top-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="w-5 h-5 text-blue-500" />
                    Résumé Mobile
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="text-foreground">
                        {mobileTransferChoice === "transfer" ? "Transfert" : mobileTransferChoice === "new" ? "Nouveau numéro" : "Non sélectionné"}
                      </span>
                    </div>
                    {mobileTransferChoice === "transfer" && transferValidationResult === "valid" && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Numéro</span>
                          <span className="text-foreground">{transferPhoneNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Fournisseur</span>
                          <span className="text-foreground">{transferCarrier || "Non sélectionné"}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between">
                      <span className="text-blue-500">{SIM_CONFIG_DYNAMIC.physical.name} (×{totalMobileLineQuantity})</span>
                      <span className="text-blue-500">
                        {(SIM_CONFIG_DYNAMIC.physical.price * totalMobileLineQuantity).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                      </span>
                    </div>
                  </div>

                  <Separator />

                  <div className="pt-4 space-y-3">
                    <Button
                      variant="hero"
                      className="w-full"
                      size="lg"
                      onClick={() => setStep(hasTVService ? 4 : 3)}
                      disabled={!isMobileTransferComplete()}
                    >
                      Continuer
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setStep(hasTVService ? 2 : 1)}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Retour
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Verification Step */}
        {((step === 2 && !hasTVService && !hasMobileService) || 
          (step === 3 && hasMobileService && !hasTVService) ||
          (step === 3 && hasTVService && !hasMobileService) ||
          (step === 4 && hasTVService && hasMobileService)) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Fee Explanation Notice */}
              <Card className="bg-blue-500/10 border-blue-500/30">
                <CardContent className="py-4 flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Frais applicables:</strong> Les frais de livraison s'appliquent à tout équipement expédié. 
                    Les frais d'installation s'appliquent à toute configuration par un technicien.
                  </p>
                </CardContent>
              </Card>

              {/* Customer Information Section - DOB + Contact */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-cyan-500" />
                    Informations client
                  </CardTitle>
                  <CardDescription>
                    Ces informations seront utilisées pour la livraison et la facturation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Name fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first-name">Prénom <span className="text-destructive">*</span></Label>
                      <Input
                        id="first-name"
                        placeholder="Ex: Jean"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last-name">Nom de famille <span className="text-destructive">*</span></Label>
                      <Input
                        id="last-name"
                        placeholder="Ex: Tremblay"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Date of Birth */}
                  <div className="space-y-2">
                    <Label htmlFor="date-of-birth" className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      Date de naissance <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="date-of-birth"
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      max={(() => {
                        const maxDate = new Date();
                        maxDate.setFullYear(maxDate.getFullYear() - 13);
                        return maxDate.toISOString().split('T')[0];
                      })()}
                    />
                    {dateOfBirth && (() => {
                      // Safe DOB validation with try/catch to prevent crashes
                      try {
                        // First verify the date string is valid before validation
                        const parsed = parseISO(dateOfBirth);
                        if (!isValid(parsed)) {
                          return (
                            <p className="text-xs text-destructive flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Date invalide
                            </p>
                          );
                        }
                        
                        const result = validateDob(dateOfBirth, { minAge: MIN_AGE_TELECOM });
                        if (!result.isValid) {
                          return (
                            <p className="text-xs text-destructive flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {result.error?.fr || `Vous devez avoir au moins ${MIN_AGE_TELECOM} ans pour souscrire à nos services.`}
                            </p>
                          );
                        }
                        return (
                          <p className="text-xs text-emerald-500 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Âge vérifié
                          </p>
                        );
                      } catch {
                        // Guard: never crash, just show error
                        return (
                          <p className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Date invalide
                          </p>
                        );
                      }
                    })()}
                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <Label htmlFor="checkout-phone" className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      Téléphone <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="checkout-phone"
                      type="tel"
                      placeholder="(514) 555-1234"
                      value={checkoutPhone}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                        if (digits.length === 0) {
                          setCheckoutPhone("");
                        } else if (digits.length <= 3) {
                          setCheckoutPhone(`(${digits}`);
                        } else if (digits.length <= 6) {
                          setCheckoutPhone(`(${digits.slice(0, 3)}) ${digits.slice(3)}`);
                        } else {
                          setCheckoutPhone(`(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`);
                        }
                      }}
                      maxLength={14}
                    />
                    <p className="text-xs text-muted-foreground">
                      Nous vous contacterons à ce numéro pour coordonner l'installation.
                    </p>
                  </div>

                  {/* Service Address */}
                  <Separator />
                  <div className="space-y-4 pt-2">
                    <h4 className="font-medium text-foreground flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-cyan-500" />
                      Adresse de service
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="service-address">Adresse (numéro + rue) <span className="text-destructive">*</span></Label>
                        <AddressAutocomplete
                          value={serviceAddressStreet}
                          onValueChange={(value) => setServiceAddressStreet(value)}
                          onSelect={(details: AddressValue) => {
                            // Defense-in-depth: set street with formatted or line1
                            const addressText = details.formatted || details.line1;
                            setServiceAddressStreet(addressText);
                            if (details.city) setServiceAddressCity(details.city);
                            if (details.region) {
                              setServiceAddressProvince(details.region);
                            }
                            if (details.postalCode) {
                              setServiceAddressPostalCode(details.postalCode);
                            }
                          }}
                          placeholder="Rechercher une adresse..."
                          restrictToQuebec={true}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="service-apartment">Appartement / Unité</Label>
                        <Input
                          id="service-apartment"
                          placeholder="Ex: Apt 4B"
                          value={serviceAddressApartment}
                          onChange={(e) => setServiceAddressApartment(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="service-city">Ville <span className="text-destructive">*</span></Label>
                        <Input
                          id="service-city"
                          placeholder="Ex: Montréal"
                          value={serviceAddressCity}
                          onChange={(e) => setServiceAddressCity(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="service-province">Province <span className="text-destructive">*</span></Label>
                        <select
                          id="service-province"
                          className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                          value={serviceAddressProvince}
                          onChange={(e) => setServiceAddressProvince(e.target.value)}
                        >
                          <option value="QC">Québec</option>
                        </select>
                        <p className="text-xs text-muted-foreground">Services disponibles au Québec uniquement</p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="service-postal-code">Code postal <span className="text-destructive">*</span></Label>
                        <Input
                          id="service-postal-code"
                          placeholder="Ex: H2X 1Y4"
                          value={serviceAddressPostalCode}
                          onChange={(e) => {
                            const cleaned = e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
                            if (cleaned.length <= 3) {
                              setServiceAddressPostalCode(cleaned);
                            } else {
                              setServiceAddressPostalCode(`${cleaned.slice(0, 3)} ${cleaned.slice(3)}`);
                            }
                          }}
                          maxLength={7}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Taxes calculées selon l'adresse de service (TPS 5% + TVQ 9.975% pour le Québec).
                    </p>
                  </div>

                  {/* Customer info complete indicator */}
                  {firstName && lastName && dateOfBirth && checkoutPhone.replace(/\D/g, "").length === 10 && serviceAddressStreet && serviceAddressCity && serviceAddressPostalCode.replace(/\s/g, "").length === 6 && (() => {
                    const dob = new Date(dateOfBirth);
                    const today = new Date();
                    const age = today.getFullYear() - dob.getFullYear();
                    const isAdult = age > 18 || (age === 18 && today >= new Date(dob.getFullYear() + 18, dob.getMonth(), dob.getDate()));
                    return isAdult;
                  })() && (
                    <div className="flex items-center gap-2 text-sm text-emerald-500 p-3 bg-emerald-500/10 rounded-lg">
                      <CheckCircle2 className="w-4 h-4" />
                      Informations client complétées
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* SIM Delivery Estimate - Show for any order with Mobile service */}
              {hasMobileService && (
                <Card className="bg-blue-500/10 border-blue-500/30">
                  <CardContent className="py-4 flex items-start gap-3">
                    <Smartphone className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-foreground mb-1">Livraison carte SIM</p>
                      <p className="text-sm text-muted-foreground">
                        Votre carte SIM sera livrée directement à l'adresse indiquée lors de la commande.
                      </p>
                      <p className="text-xs text-emerald-500 mt-2 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Carte SIM et livraison offertes
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Delivery/Installation Choice Selector */}
              {isDeliveryOnlyOrder ? (
                /* Delivery Options for Mobile, Streaming, Accessories */
                <Card className="bg-card border-blue-500/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Truck className="w-5 h-5 text-blue-500" />
                      Mode de livraison
                    </CardTitle>
                    <CardDescription>
                      Choisissez votre mode de livraison pour recevoir votre équipement
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Standard Delivery */}
                      <div
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          deliveryChoice === "standard"
                            ? "border-cyan-500 bg-cyan-500/10"
                            : "border-border hover:border-cyan-500/50"
                        }`}
                        onClick={() => setDeliveryChoice("standard")}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            deliveryChoice === "standard" ? "bg-cyan-500" : "bg-muted"
                          }`}>
                            <Truck className={`w-5 h-5 ${deliveryChoice === "standard" ? "text-white" : "text-muted-foreground"}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-foreground">{DELIVERY_CONFIG.standard.name}</p>
                              <Badge variant="secondary" className="text-xs">{DELIVERY_CONFIG.standard.fee.toFixed(2)} $</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {DELIVERY_CONFIG.standard.description}
                            </p>
                            <p className="text-xs text-cyan-500 mt-2">
                              Délai: {DELIVERY_CONFIG.standard.timeframe}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Ship to Home - Always available */}
                      <div
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          deliveryChoice === "shipHome"
                            ? "border-emerald-500 bg-emerald-500/10"
                            : "border-border hover:border-emerald-500/50"
                        }`}
                        onClick={() => setDeliveryChoice("shipHome")}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            deliveryChoice === "shipHome" ? "bg-emerald-500" : "bg-muted"
                          }`}>
                            <Package className={`w-5 h-5 ${deliveryChoice === "shipHome" ? "text-white" : "text-muted-foreground"}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-foreground">{DELIVERY_CONFIG.shipHome.name}</p>
                              <Badge className="bg-emerald-500/20 text-emerald-500 border-0 text-xs">{DELIVERY_CONFIG.shipHome.fee.toFixed(2)} $</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {DELIVERY_CONFIG.shipHome.description}
                            </p>
                            <p className="text-xs text-emerald-500 mt-2">
                              Délai: {DELIVERY_CONFIG.shipHome.timeframe}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Uber Express Delivery - only if eligible */}
                      {isUberDeliveryAvailable() && (
                        <div
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            deliveryChoice === "uber"
                              ? "border-purple-500 bg-purple-500/10"
                              : "border-border hover:border-purple-500/50"
                          }`}
                          onClick={() => setDeliveryChoice("uber")}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              deliveryChoice === "uber" ? "bg-purple-500" : "bg-muted"
                            }`}>
                              <Zap className={`w-5 h-5 ${deliveryChoice === "uber" ? "text-white" : "text-muted-foreground"}`} />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <p className="font-medium text-foreground">{DELIVERY_CONFIG.uber.name}</p>
                                <Badge className="bg-purple-500/20 text-purple-500 border-0 text-xs">{DELIVERY_CONFIG.uber.fee.toFixed(2)} $</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {DELIVERY_CONFIG.uber.description}
                              </p>
                              <p className="text-xs text-purple-500 mt-2">
                                Délai: {DELIVERY_CONFIG.uber.timeframe}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {!isUberDeliveryAvailable() && (
                      <Card className="bg-amber-500/10 border-amber-500/30">
                        <CardContent className="py-3 flex items-start gap-2">
                          <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-muted-foreground">
                            La livraison Express Uber (10h) est disponible uniquement pour les indicatifs régionaux 514, 450, 579, 438 
                            (Montréal, Laval, Terrebonne, Mascouche, Repentigny, Longueuil, Saint-Hubert, Brossard).
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    {!deliveryChoice && (
                      <p className="text-sm text-amber-500 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Veuillez sélectionner un mode de livraison
                      </p>
                    )}

                    {deliveryChoice && (
                      <div className="flex items-center gap-2 text-sm text-emerald-500 p-3 bg-emerald-500/10 rounded-lg">
                        <CheckCircle2 className="w-4 h-4" />
                        {deliveryChoice === "uber" 
                          ? `Livraison Express Uber sélectionnée (${DELIVERY_CONFIG.uber.timeframe})`
                          : deliveryChoice === "shipHome"
                          ? `Expédition à domicile sélectionnée (${DELIVERY_CONFIG.shipHome.timeframe})`
                          : `Livraison standard sélectionnée (${DELIVERY_CONFIG.standard.timeframe})`
                        }
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                /* Installation Options for Internet, TV, Security */
                <Card className="bg-card border-purple-500/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="w-5 h-5 text-purple-500" />
                      Type d'installation
                    </CardTitle>
                    <CardDescription>
                      Choisissez comment vous souhaitez installer vos services
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          installationChoice === "auto"
                            ? "border-cyan-500 bg-cyan-500/10"
                            : "border-border hover:border-cyan-500/50"
                        }`}
                        onClick={() => setInstallationChoice("auto")}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            installationChoice === "auto" ? "bg-cyan-500" : "bg-muted"
                          }`}>
                            <Truck className={`w-5 h-5 ${installationChoice === "auto" ? "text-white" : "text-muted-foreground"}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-foreground">Auto-installation</p>
                              <Badge variant="secondary" className="text-xs">30,00 $</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Équipement livré à domicile. Vous installez vous-même avec nos instructions.
                            </p>
                            <p className="text-xs text-cyan-500 mt-2">
                              Frais de livraison: 30,00 $
                            </p>
                          </div>
                        </div>
                      </div>

                      <div
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          installationChoice === "technician"
                            ? "border-purple-500 bg-purple-500/10"
                            : "border-border hover:border-purple-500/50"
                        }`}
                        onClick={() => setInstallationChoice("technician")}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            installationChoice === "technician" ? "bg-purple-500" : "bg-muted"
                          }`}>
                            <Wrench className={`w-5 h-5 ${installationChoice === "technician" ? "text-white" : "text-muted-foreground"}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-foreground">Technicien Nivra</p>
                              <Badge variant="secondary" className="text-xs">{installationFee > 0 ? `${installationFee.toFixed(2)} $` : "50,00 $"}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Un technicien se déplace pour installer et configurer vos services.
                            </p>
                            <p className="text-xs text-purple-500 mt-2">
                              Frais d'installation: {installationFee > 0 ? `${installationFee.toFixed(2)} $` : "50,00 $"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {!installationChoice && (
                      <p className="text-sm text-amber-500 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Veuillez sélectionner un type d'installation
                      </p>
                    )}

                    {/* Quebec address validation notice */}
                    <Card className="bg-blue-500/10 border-blue-500/30">
                      <CardContent className="py-3 flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-muted-foreground">
                          L'installation par technicien est disponible uniquement pour les adresses au Québec.
                        </p>
                      </CardContent>
                    </Card>
                  </CardContent>
                </Card>
              )}

              {/* Appointment Scheduling - only for technician installation (non-delivery orders) */}
              {!isDeliveryOnlyOrder && installationChoice === "technician" && selectedServices.some(s => ["Internet", "TV", "Sécurité"].includes(s.category)) && (
                <Card className="bg-card border-purple-500/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-purple-500" />
                      Planifier l'installation
                    </CardTitle>
                    <CardDescription>
                      Un technicien se déplacera pour installer vos services. Choisissez une date et une plage horaire.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Date préférée *</Label>
                        <select
                          className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                        >
                          <option value="">Sélectionner une date</option>
                          {[...Array(14)].map((_, i) => {
                            const date = addDays(new Date(), i + 3);
                            const dayOfWeek = date.getDay();
                            if (dayOfWeek === 0 || dayOfWeek === 6) return null;
                            return (
                              <option key={i} value={format(date, "d MMMM yyyy", { locale: fr })}>
                                {format(date, "EEEE d MMMM yyyy", { locale: fr })}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Plage horaire *</Label>
                        <select
                          className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                          value={selectedTime}
                          onChange={(e) => setSelectedTime(e.target.value)}
                        >
                          <option value="">Sélectionner une plage</option>
                          <option value="8h00 - 10h00">8h00 - 10h00 (Matin)</option>
                          <option value="10h00 - 12h00">10h00 - 12h00 (Matin)</option>
                          <option value="13h00 - 15h00">13h00 - 15h00 (Après-midi)</option>
                          <option value="15h00 - 17h00">15h00 - 17h00 (Après-midi)</option>
                        </select>
                      </div>
                    </div>
                    
                    <Card className="bg-blue-500/10 border-blue-500/30">
                      <CardContent className="py-3 flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-muted-foreground">
                          <p>Le technicien vous contactera 30 minutes avant son arrivée.</p>
                          <p>Durée estimée de l'installation: 1 à 2 heures.</p>
                        </div>
                      </CardContent>
                    </Card>
                  </CardContent>
                </Card>
              )}

              {/* ID Verification - Only for telecom services, not equipment-only orders */}
              {!isEquipmentOnlyOrder ? (
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5 text-cyan-500" />
                      Vérification d'identité
                    </CardTitle>
                    <CardDescription>
                      Une pièce d'identité gouvernementale valide est requise pour les services télécom. Aucune vérification de crédit.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Card className="bg-amber-500/10 border-amber-500/30">
                      <CardContent className="py-3 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-muted-foreground">
                          <strong className="text-foreground">Important:</strong> Votre pièce d'identité sera vérifiée lors de la confirmation de votre commande. Aucune vérification de crédit n'est effectuée.
                        </p>
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="id-type">Type de pièce d'identité *</Label>
                        <select
                          id="id-type"
                          className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                          value={idType}
                          onChange={(e) => setIdType(e.target.value)}
                        >
                          <option value="">Sélectionner un type</option>
                          {ID_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="id-number">Numéro de pièce d'identité *</Label>
                        <Input
                          id="id-number"
                          placeholder="Ex: A1234567"
                          value={idNumber}
                          onChange={(e) => setIdNumber(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="id-expiration">Date d'expiration *</Label>
                        <Input
                          id="id-expiration"
                          type="date"
                          value={idExpiration}
                          onChange={(e) => setIdExpiration(e.target.value)}
                          min={format(new Date(), "yyyy-MM-dd")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="id-province">Province d'émission *</Label>
                        <select
                          id="id-province"
                          className="w-full h-10 px-3 rounded-md border border-input bg-background text-foreground"
                          value={idProvince}
                          onChange={(e) => setIdProvince(e.target.value)}
                        >
                          <option value="">Sélectionner une province</option>
                          {CANADIAN_PROVINCES.map((province) => (
                            <option key={province.value} value={province.value}>
                              {province.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {isIdComplete && (
                      <div className="flex items-center gap-2 text-sm text-emerald-500 p-3 bg-emerald-500/10 rounded-lg">
                        <CheckCircle2 className="w-4 h-4" />
                        Informations d'identité complétées
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-emerald-500/10 border-emerald-500/30">
                  <CardContent className="py-4 flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-emerald-600 mb-1">Commande d'équipement/accessoires</p>
                      <p className="text-muted-foreground">
                        Aucune vérification d'identité requise pour les commandes d'équipement et accessoires uniquement.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Code promotionnel</CardTitle>
                  <CardDescription>Avez-vous un code de réduction pour l'installation?</CardDescription>
                </CardHeader>
                <CardContent>
                  {appliedPromo ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Check className="w-5 h-5 text-emerald-500" />
                          <div>
                            <p className="font-medium text-emerald-600">{appliedPromo.code}</p>
                            <p className="text-xs text-muted-foreground">{appliedPromo.name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-500">-{appliedPromo.discount_amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</p>
                          <p className="text-xs text-muted-foreground">
                            {appliedPromo.discount_type === 'percent' ? `${appliedPromo.discount_value}%` : 'Montant fixe'}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={removePromo} className="text-destructive">
                        Retirer le code promo
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Entrez votre code promo"
                        value={discountCode}
                        onChange={(e) => setDiscountCode(e.target.value)}
                        disabled={isValidatingPromo}
                      />
                      <Button variant="outline" onClick={applyDiscountCode} disabled={isValidatingPromo}>
                        {isValidatingPromo ? "..." : "Appliquer"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Notes additionnelles</CardTitle>
                  <CardDescription>Ajoutez des informations pour votre commande (adresse de livraison différente, etc.)</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    placeholder="Ex: Livrer à une autre adresse, instructions spéciales..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1">
              <Card className="bg-card border-cyan-500/30 sticky top-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-cyan-500" />
                    Résumé de commande
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Monthly Recurring Services */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Services mensuels</p>
                    {selectedServices.map((service) => (
                      <div key={service.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{service.name}</span>
                        <span className="text-foreground">{Number(service.price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois</span>
                      </div>
                    ))}
                    {paidChannelTotal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-amber-500">Chaînes premium ({selectedPaidChannels.length})</span>
                        <span className="text-amber-500">+{paidChannelTotal.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Monthly Total */}
                  <div className="border-t border-border pt-3">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-foreground">Total mensuel estimé</span>
                      <span className="font-bold text-lg text-cyan-500">
                        {(subtotal + paidChannelTotal).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Avant taxes, services récurrents</p>
                  </div>
                  
                  {/* One-Time Fees Section */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Frais uniques</p>
                    {/* Delivery fee for delivery-only orders OR installation choice */}
                    {isDeliveryOnlyOrder ? (
                      deliveryChoice && (
                        <div className="flex justify-between text-sm">
                          <span className={
                            deliveryChoice === "uber" ? "text-purple-500" : 
                            deliveryChoice === "shipHome" ? "text-emerald-500" : 
                            "text-cyan-500"
                          }>
                            {deliveryChoice === "uber" ? DELIVERY_CONFIG.uber.name : 
                             deliveryChoice === "shipHome" ? DELIVERY_CONFIG.shipHome.name :
                             DELIVERY_CONFIG.standard.name}
                          </span>
                          <span className={
                            deliveryChoice === "uber" ? "text-purple-500" : 
                            deliveryChoice === "shipHome" ? "text-emerald-500" : 
                            "text-cyan-500"
                          }>
                            {deliveryFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                          </span>
                        </div>
                      )
                    ) : (
                      <>
                        {installationChoice === "auto" && (
                          <div className="flex justify-between text-sm">
                            <span className="text-cyan-500">Frais de livraison (QC)</span>
                            <span className="text-cyan-500">{deliveryFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                          </div>
                        )}
                        {installationChoice === "technician" && (
                          <div className="flex justify-between text-sm">
                            <span className="text-purple-500">Frais d'installation</span>
                            <span className={installationCredit > 0 ? "text-emerald-500" : "text-purple-500"}>
                              {installationCredit > 0 && <span className="line-through text-muted-foreground mr-1">50,00 $</span>}
                              {installationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                    {/* Prompt to select delivery/installation */}
                    {isDeliveryOnlyOrder ? (
                      !deliveryChoice && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground italic">Sélectionnez un mode de livraison</span>
                          <span className="text-muted-foreground">—</span>
                        </div>
                      )
                    ) : (
                      !installationChoice && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground italic">Sélectionnez un type d'installation</span>
                          <span className="text-muted-foreground">—</span>
                        </div>
                      )
                    )}
                    {/* Show activation fee only if not equipment-only order */}
                    {!isEquipmentOnlyOrder && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Frais d'activation</span>
                        <span className="text-foreground">{activationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    {(hasInternetService || hasTVService) && routerFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-cyan-500">{ROUTER_CONFIG_DYNAMIC.name}</span>
                        <span className="text-cyan-500">{routerFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    {hasTVService && terminalFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-purple-500">{TERMINAL_CONFIG.name} (×{terminalQuantity})</span>
                        <span className="text-purple-500">{terminalFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    {hasMobileService && simFee > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-blue-500">{SIM_CONFIG_DYNAMIC[simType].name}</span>
                        <span className="text-blue-500">{simFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    
                    {/* Promo discount line */}
                    {appliedPromo && appliedPromo.discount_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-emerald-500 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Rabais promotionnel ({appliedPromo.code})
                        </span>
                        <span className="text-emerald-500 font-medium">
                          -{appliedPromo.discount_amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* One-Time Fees Subtotal */}
                  <div className="border-t border-border pt-3">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-foreground">Frais uniques estimés</span>
                      <span className="font-bold text-foreground">
                        {(() => {
                          let oneTimeFees = activationFee + routerFee + terminalFee + simFee;
                          if (isDeliveryOnlyOrder) {
                            oneTimeFees += deliveryFee;
                          } else if (installationChoice === "auto") {
                            oneTimeFees += deliveryFee;
                          } else if (installationChoice === "technician") {
                            oneTimeFees += installationFee;
                          }
                          const promoDiscount = appliedPromo?.discount_amount || 0;
                          return (oneTimeFees - promoDiscount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" });
                        })()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Équipements, livraison, activation</p>
                  </div>

                  {/* Taxes */}
                  <div className="border-t border-border pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">TPS (5%)</span>
                      <span className="text-foreground">{tpsAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">TVQ (9.975%)</span>
                      <span className="text-foreground">{tvqAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                  </div>

                  {/* Total Due Today */}
                  <div className="border-t-2 border-cyan-500/50 pt-4 bg-gradient-to-r from-cyan-500/5 to-transparent -mx-6 px-6 pb-2 rounded-b-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-foreground">Total à payer aujourd'hui</span>
                      <span className="text-2xl font-bold text-cyan-500">
                        {totalAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Taxes incluses</p>
                  </div>

                  <div className="pt-4 space-y-3">
                    <Button
                      variant="hero"
                      className="w-full"
                      size="lg"
                      onClick={() => {
                        // Dynamic step calculation for final confirmation
                        let nextStep = 4;
                        if (hasTVService && hasMobileService) nextStep = 5;
                        else if (hasTVService || hasMobileService) nextStep = 4;
                        else nextStep = 3;
                        setStep(nextStep);
                      }}
                      disabled={
                        // For equipment-only orders, only need delivery choice (no ID required)
                        isEquipmentOnlyOrder 
                          ? !deliveryChoice
                          // For other delivery-only orders (mobile), need ID + delivery choice
                          : isDeliveryOnlyOrder 
                            ? (!isIdComplete || !deliveryChoice)
                            // For installation orders, need ID + installation choice + appointment if technician
                            : (!isIdComplete || !installationChoice || (requiresInstallation && (!selectedDate || !selectedTime)))
                      }
                    >
                      Réviser et confirmer
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        if (hasMobileService && !hasTVService) setStep(2);
                        else if (hasTVService && !hasMobileService) setStep(2);
                        else if (hasTVService && hasMobileService) setStep(3);
                        else setStep(1);
                      }}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Retour
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Final Confirmation Step - Dynamic based on service selection */}
        {((step === 3 && !hasTVService && !hasMobileService) ||
          (step === 4 && ((hasTVService && !hasMobileService) || (hasMobileService && !hasTVService))) ||
          (step === 5 && hasTVService && hasMobileService)) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-cyan-500" />
                    Récapitulatif final
                  </CardTitle>
                  <CardDescription>Vérifiez les détails avant de soumettre votre commande</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedServices.map((service) => {
                    const CategoryIcon = categoryIcons[service.category] || Package;
                    return (
                      <div
                        key={service.id}
                        className="flex items-center justify-between p-4 bg-accent/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${categoryColors[service.category]?.split(' ')[0] || 'bg-muted'}`}>
                            <CategoryIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{service.name}</p>
                            <p className="text-sm text-muted-foreground">{service.category}</p>
                          </div>
                        </div>
                        <p className="font-bold text-foreground">
                          {Number(service.price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                          <span className="text-xs text-muted-foreground font-normal">/mois</span>
                        </p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              {/* TV Equipment Summary (without channel details per user request) */}
              {hasTVService && (
                <Card className="bg-card border-cyan-500/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MonitorPlay className="w-5 h-5 text-cyan-500" />
                      Équipement TV
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                          <MonitorPlay className="w-5 h-5 text-cyan-500" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{TERMINAL_CONFIG.name}</p>
                          <p className="text-sm text-muted-foreground">Quantité: {terminalQuantity}</p>
                        </div>
                      </div>
                      <p className="font-bold text-cyan-500">
                        {(terminalQuantity * TERMINAL_CONFIG.price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {TERMINAL_CONFIG.warranty}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Mobile SIM Equipment Summary */}
              {hasMobileService && (
                <Card className="bg-card border-blue-500/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Smartphone className="w-5 h-5 text-blue-500" />
                      Équipement Mobile
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-accent/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                          <Smartphone className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{SIM_CONFIG_DYNAMIC[simType].name}</p>
                          <p className="text-sm text-muted-foreground">Frais unique (payé à la commande)</p>
                        </div>
                      </div>
                      <p className="font-bold text-blue-500">
                        {SIM_CONFIG_DYNAMIC[simType].price.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                      </p>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>• {SIM_CONFIG_DYNAMIC.warranty}</p>
                      <p>• {SIM_CONFIG_DYNAMIC.notes}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle>Informations client</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between p-3 bg-accent/50 rounded-lg">
                    <span className="text-muted-foreground">Nom</span>
                    <span className="text-foreground font-medium">{profile?.full_name || "Non spécifié"}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-accent/50 rounded-lg">
                    <span className="text-muted-foreground">Courriel</span>
                    <span className="text-foreground font-medium">{profile?.email || user?.email}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-accent/50 rounded-lg">
                    <span className="text-muted-foreground">Téléphone</span>
                    <span className="text-foreground font-medium">{profile?.phone || "Non spécifié"}</span>
                  </div>
                  {profile?.client_number && (
                    <div className="flex justify-between p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                      <span className="text-cyan-500">Numéro client</span>
                      <span className="text-cyan-500 font-mono font-bold">{profile.client_number}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {notes && (
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle>Notes additionnelles</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">{notes}</p>
                  </CardContent>
                </Card>
              )}

              {/* Installation Appointment Summary */}
              {requiresInstallation && selectedDate && selectedTime && (
                <Card className="bg-purple-500/10 border-purple-500/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-purple-500" />
                      Rendez-vous d'installation
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2 p-3 bg-accent/50 rounded-lg">
                        <Calendar className="w-4 h-4 text-purple-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Date</p>
                          <p className="font-medium text-foreground">{selectedDate}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-3 bg-accent/50 rounded-lg">
                        <Clock className="w-4 h-4 text-purple-500" />
                        <div>
                          <p className="text-xs text-muted-foreground">Heure</p>
                          <p className="font-medium text-foreground">{selectedTime}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Bill Preview Section - 1st and 2nd Invoice */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* First Bill Preview - One-time Fees */}
                <Card className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Receipt className="w-5 h-5 text-cyan-500" />
                      <CardTitle className="text-base">Frais uniques estimés</CardTitle>
                    </div>
                    <CardDescription className="text-xs">Équipements et frais payables à la commande</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {/* Equipment fees */}
                    {routerFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Routeur Nivra Born Wifi</span>
                        <span>{routerFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    {terminalFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Terminal TV 4K (×{terminalQuantity})</span>
                        <span>{terminalFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    {simFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cartes SIM (×{totalMobileLineQuantity})</span>
                        <span>{simFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    
                    {/* Service fees */}
                    {activationFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Frais d'activation</span>
                        <span>{activationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    {installationFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Installation technicien</span>
                        <span>{installationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    {deliveryFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Livraison</span>
                        <span>{deliveryFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    
                    <Separator className="my-2" />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sous-total frais uniques</span>
                      <span>{oneTimeFees.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">TPS (5%) + TVQ (9.975%)</span>
                      <span>{(Math.round(oneTimeFees * 0.14975 * 100) / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    <div className="flex justify-between pt-3 border-t-2 border-cyan-500/50">
                      <span className="font-bold text-cyan-500 text-base">Total à payer aujourd'hui</span>
                      <span className="font-bold text-cyan-500 text-lg">{oneTimeFeesWithTax.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Second Bill Preview - Monthly Estimate */}
                <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-purple-500" />
                      <CardTitle className="text-base">Total mensuel estimé</CardTitle>
                    </div>
                    <CardDescription className="text-xs">Services récurrents chaque mois</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {/* Monthly services breakdown */}
                    {selectedServices.filter(s => s.category === "Internet").map(s => (
                      <div key={s.id} className="flex justify-between">
                        <span className="text-muted-foreground">Internet — {s.name}</span>
                        <span>{Number(s.price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois</span>
                      </div>
                    ))}
                    {selectedServices.filter(s => s.category === "TV").map(s => (
                      <div key={s.id} className="flex justify-between">
                        <span className="text-muted-foreground">TV — {s.name}</span>
                        <span>{Number(s.price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois</span>
                      </div>
                    ))}
                    {selectedServices.filter(s => s.category === "Sécurité").map(s => (
                      <div key={s.id} className="flex justify-between">
                        <span className="text-muted-foreground">Sécurité — {s.name}</span>
                        <span>{Number(s.price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois</span>
                      </div>
                    ))}
                    {selectedMobileServices.length > 0 && selectedMobileServices.map(s => {
                      const qty = mobileLineQuantities[s.id] || 1;
                      return (
                        <div key={s.id} className="flex justify-between">
                          <span className="text-muted-foreground">Mobile — {s.name} (×{qty})</span>
                          <span>{(Number(s.price) * qty).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois</span>
                        </div>
                      );
                    })}
                    {selectedServices.filter(s => s.category === "Streaming").map(s => (
                      <div key={s.id} className="flex justify-between">
                        <span className="text-muted-foreground">Streaming — {s.name}</span>
                        <span>{Number(s.price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois</span>
                      </div>
                    ))}
                    {selectedStreamingServices.length > 0 && selectedStreamingServices.map(s => (
                      <div key={s.id} className="flex justify-between">
                        <span className="text-muted-foreground">Streaming+ — {s.name}</span>
                        <span>{Number(s.monthly_price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois</span>
                      </div>
                    ))}
                    {selectedPaidChannels.length > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Chaînes premium ({selectedPaidChannels.length})</span>
                        <span>{paidChannelTotal.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois</span>
                      </div>
                    )}
                    
                    <Separator className="my-2" />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sous-total mensuel</span>
                      <span>{monthlyRecurring.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">TPS (5%) + TVQ (9.975%)</span>
                      <span>{(Math.round(monthlyRecurring * 0.14975 * 100) / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    <div className="flex justify-between pt-3 border-t-2 border-purple-500/50">
                      <span className="font-bold text-purple-500 text-base">Total mensuel estimé</span>
                      <span className="font-bold text-purple-500 text-lg">{monthlyRecurringWithTax.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Facturation le 1er de chaque mois après activation</p>
                  </CardContent>
                </Card>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                Montants estimatifs, taxes applicables selon votre adresse au Québec (TPS 5% + TVQ 9.975%).
              </p>

              {/* Payment Section - Required before order submission */}
              <Card className="bg-card border-emerald-500/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-emerald-500" />
                    Paiement requis
                  </CardTitle>
                  <CardDescription>
                    Le paiement complet est requis avant la confirmation de votre commande
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Payment method selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        paymentMethod === "credit_card"
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-border hover:border-emerald-500/50"
                      }`}
                      onClick={() => {
                        setPaymentMethod("credit_card");
                        setPaymentComplete(false);
                        setPaymentConfirmationNumber("");
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          paymentMethod === "credit_card" ? "bg-emerald-500" : "bg-muted"
                        }`}>
                          <CreditCard className={`w-5 h-5 ${paymentMethod === "credit_card" ? "text-white" : "text-muted-foreground"}`} />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Carte de crédit</p>
                          <p className="text-xs text-muted-foreground">Visa, Mastercard, Amex</p>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        paymentMethod === "etransfer"
                          ? "border-amber-500 bg-amber-500/10"
                          : "border-border hover:border-amber-500/50"
                      }`}
                      onClick={() => {
                        setPaymentMethod("etransfer");
                        setPaymentComplete(false);
                        setPaymentConfirmationNumber("");
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          paymentMethod === "etransfer" ? "bg-amber-500" : "bg-muted"
                        }`}>
                          <Mail className={`w-5 h-5 ${paymentMethod === "etransfer" ? "text-white" : "text-muted-foreground"}`} />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Virement Interac</p>
                          <p className="text-xs text-muted-foreground">E-Transfer</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Credit Card Form */}
                  {paymentMethod === "credit_card" && !paymentComplete && (
                    <div className="space-y-4 p-4 bg-accent/30 rounded-lg">
                      <div className="space-y-2">
                        <Label htmlFor="card-name">Nom sur la carte *</Label>
                        <Input
                          id="card-name"
                          placeholder="Jean Tremblay"
                          value={cardName}
                          onChange={(e) => setCardName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="card-number">Numéro de carte *</Label>
                        <Input
                          id="card-number"
                          placeholder="4242 4242 4242 4242"
                          value={cardNumber}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 16);
                            const formatted = value.replace(/(\d{4})/g, '$1 ').trim();
                            setCardNumber(formatted);
                          }}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="card-expiry">Expiration *</Label>
                          <Input
                            id="card-expiry"
                            placeholder="MM/AA"
                            value={cardExpiry}
                            onChange={(e) => {
                              let value = e.target.value.replace(/\D/g, '').slice(0, 4);
                              if (value.length >= 2) {
                                value = value.slice(0, 2) + '/' + value.slice(2);
                              }
                              setCardExpiry(value);
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="card-cvv">CVV *</Label>
                          <Input
                            id="card-cvv"
                            placeholder="123"
                            type="password"
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          />
                        </div>
                      </div>
                      
                      {/* Pre-authorized Payment - Show different UI based on existing opt-in */}
                      {hasExistingPreauthOptIn ? (
                        /* Already opted-in: show badge, no checkbox */
                        <div className="p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                              <Check className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                                Paiement préautorisé déjà activé
                              </p>
                              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                                Votre rabais de 5$/mois est automatiquement appliqué sur toutes vos factures.
                              </p>
                            </div>
                            <Badge className="bg-emerald-500 text-white">
                              <Star className="w-3 h-3 mr-1" />
                              -5$/mois
                            </Badge>
                          </div>
                        </div>
                      ) : (
                        /* First time: show checkbox to opt-in */
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg space-y-3">
                          <div className="flex items-start gap-3">
                            <Checkbox
                              id="preauth-accept"
                              checked={acceptPreauthorized}
                              onCheckedChange={(checked) => setAcceptPreauthorized(checked === true)}
                              className="mt-0.5"
                            />
                            <div className="flex-1">
                              <Label htmlFor="preauth-accept" className="text-sm font-medium cursor-pointer leading-relaxed">
                                J'autorise Nivra à débiter automatiquement cette carte pour mes paiements mensuels futurs
                              </Label>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
                                  <Star className="w-3 h-3 mr-1" />
                                  Économisez 5$/mois
                                </Badge>
                                <span className="text-xs text-muted-foreground">Rabais automatique appliqué</span>
                              </div>
                            </div>
                          </div>
                          {acceptPreauthorized && (
                            <div className="text-xs text-emerald-600 bg-emerald-500/20 p-2 rounded">
                              ✓ Votre carte sera enregistrée de façon sécurisée pour les paiements automatiques.
                              Un rabais de 5$/mois sera appliqué sur toutes vos factures mensuelles.
                            </div>
                          )}
                        </div>
                      )}

                      <Button
                        variant="hero"
                        className="w-full"
                        onClick={processCardPayment}
                        disabled={!isCardValid}
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        Payer {totalAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                      </Button>
                    </div>
                  )}

                  {/* E-Transfer Form */}
                  {paymentMethod === "etransfer" && !paymentComplete && (
                    <div className="space-y-4 p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
                      <Card className="bg-amber-500/20 border-amber-500/50">
                        <CardContent className="py-4">
                          <div className="flex items-start gap-3">
                            <Mail className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <div className="text-sm">
                              <p className="font-medium text-foreground mb-2">Instructions de paiement Interac</p>
                              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                                <li>Envoyez <strong className="text-amber-500">{totalAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</strong> à:</li>
                                <li className="ml-4"><strong className="text-foreground">Support@nivratelecom.ca</strong></li>
                                <li>Entrez le numéro de confirmation Interac ci-dessous</li>
                              </ol>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <div className="space-y-2">
                        <Label htmlFor="etransfer-sender">Votre nom (expéditeur) *</Label>
                        <Input
                          id="etransfer-sender"
                          placeholder="Jean Tremblay"
                          value={etransferSenderName}
                          onChange={(e) => setEtransferSenderName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="etransfer-confirmation">Numéro de confirmation Interac *</Label>
                        <Input
                          id="etransfer-confirmation"
                          placeholder="Ex: CAbcd123456"
                          value={etransferConfirmationNumber}
                          onChange={(e) => setEtransferConfirmationNumber(e.target.value)}
                        />
                      </div>
                      <Button
                        className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                        onClick={processEtransferPayment}
                        disabled={!isEtransferValid}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Confirmer le paiement E-Transfer
                      </Button>
                    </div>
                  )}

                  {/* Payment Confirmed */}
                  {paymentComplete && (
                    <div className="p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
                          <CheckCircle2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <p className="font-bold text-emerald-500">Paiement accepté!</p>
                          <p className="text-sm text-muted-foreground">
                            Confirmation: <span className="font-mono font-bold text-foreground">{paymentConfirmationNumber}</span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Montant: <span className="font-bold text-emerald-500">{totalAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {!paymentMethod && (
                    <p className="text-sm text-amber-500 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Veuillez sélectionner un mode de paiement
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Terms and Conditions Acceptance */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ScrollText className="w-5 h-5 text-cyan-500" />
                    Termes et conditions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-accent/30 rounded-lg text-sm text-muted-foreground space-y-2 max-h-40 overflow-y-auto">
                    <p><strong>Politique d'annulation:</strong> Vous pouvez annuler en tout temps. Après l'installation, 1 mois de frais sera facturé. Avant 1 mois d'utilisation, les frais d'installation seront facturés.</p>
                    <p><strong>Équipement:</strong> Location gratuite. Retour à vos frais en cas d'annulation. Équipement endommagé: frais applicables.</p>
                    <p><strong>Paiement:</strong> Paiement direct à Nivra. Retard de paiement: 5% de frais supplémentaires.</p>
                    <p><strong>Vérification:</strong> Pièce d'identité avec photo requise. Aucune vérification de crédit effectuée.</p>
                  </div>
                  
                  <div className="flex items-start gap-3 p-4 bg-accent/50 rounded-lg border border-cyan-500/30">
                    <Checkbox 
                      id="terms-accept" 
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                    />
                    <Label htmlFor="terms-accept" className="text-sm leading-relaxed cursor-pointer">
                      J'ai lu et j'accepte les <a href="/terms" className="text-cyan-500 underline">Conditions d'utilisation</a>, 
                      la <a href="/privacy" className="text-cyan-500 underline">Politique de confidentialité</a>, 
                      et les termes de facturation ci-dessus.
                    </Label>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1">
              <Card className="bg-card border-cyan-500/30 sticky top-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-cyan-500" />
                    Total de la commande
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sous-total</span>
                      <span>{(subtotal + paidChannelTotal).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    {hasTVService && terminalFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{TERMINAL_CONFIG.name} (×{terminalQuantity})</span>
                        <span>{terminalFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Livraison</span>
                      <span>{deliveryFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Activation</span>
                      <span>{activationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Installation</span>
                      <span>{installationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    {hasMobileService && simFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-blue-500">{SIM_CONFIG_DYNAMIC[simType].name}</span>
                        <span className="text-blue-500">{simFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">TPS + TVQ</span>
                      <span>{(tpsAmount + tvqAmount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-foreground">Total à payer</span>
                      <span className="text-2xl font-bold text-cyan-500">
                        {totalAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                      </span>
                    </div>
                  </div>

                  {/* Payment Status Indicator */}
                  {isPaymentComplete && (
                    <div className="p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-lg text-center">
                      <p className="text-sm font-medium text-emerald-500 flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Paiement complété
                      </p>
                    </div>
                  )}

                  <div className="pt-4 space-y-3">
                    <BlockedActionWrapper action="order" showInlineNotice={isAccountBlocked}>
                      <Button
                        variant="hero"
                        className="w-full"
                        size="lg"
                        onClick={handleSubmit}
                        disabled={isAccountBlocked || createOrderMutation.isPending || !termsAccepted || !isPaymentComplete || (requiresInstallation && (!selectedDate || !selectedTime))}
                      >
                        {createOrderMutation.isPending ? "Traitement..." : "Confirmer la commande"}
                      </Button>
                    </BlockedActionWrapper>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setStep(3)}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Retour
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    En confirmant, vous acceptez nos conditions d'utilisation et notre politique de confidentialité.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </ClientLayout>
  );
};

export default ClientNewOrder;
