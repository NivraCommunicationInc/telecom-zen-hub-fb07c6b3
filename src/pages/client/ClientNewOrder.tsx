import { useState, useEffect, useRef } from "react";
import { estimateTaxes as estimateMonthlyTaxes } from "@/lib/pricing/serverTaxEngine";
import React from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { ProfessionalOrderSummary } from "@/components/checkout/ProfessionalOrderSummary";
import PayPalButton from "@/components/payment/PayPalButton";
import { StripeInlinePayment } from "@/components/payment/StripeInlinePayment";
import { createCheckoutDraftInvoice, type CheckoutDraftInvoiceResult } from "@/lib/checkout/createCheckoutDraftInvoice";
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
import { useCanonicalFees } from "@/hooks/useCanonicalFees";
import { fetchNivraProducts, submitNivraCheckout, mapProductTypeToCategory, findSkuByName, type NivraProduct, type NivraOrderItem, type NivraOrderResponse, type NivraFullCheckoutResponse, SKU } from "@/lib/api/nivraApi";
import { fallbackCheckout } from "@/lib/checkoutFallback";
import { notifyNivraCorePaid } from "@/lib/nivraCore";
import { useTransactionTraceability } from "@/hooks/useTransactionTraceability";
import { CheckoutProgress } from "@/components/checkout/CheckoutProgress";
import { SecurityTrustBox } from "@/components/checkout/SecurityTrustBox";
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
  MapPin,
  Gift
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
import { buildOrderLineItems, wrapLineItemsForOrder } from "@/lib/orderLineItems";
import { AuditNotes } from "@/lib/clientAuditNotes";
// useWelcomeDiscount REMOVED — welcome discount is now 100% server-side via compute_checkout_pricing RPC
import { getAdminPortalLink, notifyAdmin } from "@/hooks/useAdminNotification";
import { QRVerificationStep } from "@/components/checkout/QRVerificationStep";
import { KycSessionChoice } from "@/components/kyc/KycSessionChoice";
import { CheckoutAddressStep } from "@/components/checkout/CheckoutAddressStep";
import { FEATURES } from "@/config/features";
import { mapBillingError } from "@/lib/billing/errorMapping";
import { InstallationSection } from "@/components/checkout/InstallationSection";
import { normalizeServerPricingResult, sanitizeTaxes, toMoney, toNonNegativeMoney } from "@/lib/pricing/money";
import { ReferralCodeInput, type AppliedReferral } from "@/components/checkout/ReferralCodeInput";

interface Service {
  id: string;
  sku: string;
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
  pricing_snapshot?: any;
  installation_type?: string;
  delivery_method?: string;
  appointment_date?: string | null;
  appointment_time?: string | null;
  shipping_address?: string;
  shipping_city?: string;
  shipping_province?: string;
  shipping_postal_code?: string;
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

// Terminal equipment configuration — price now loaded from canonical operational_fees
const TERMINAL_CONFIG = {
  name: "Nivra 4K Smart Terminal",
  price: 50, // fallback; overridden by canonical fee at runtime
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

// Delivery configuration — fees now overridden at runtime by canonical operational_fees
const DELIVERY_CONFIG_DEFAULTS = {
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
const INSTALLATION_APPOINTMENT_ENABLED = true;
const DEFAULT_INSTALLATION_CHOICE: "auto" | "technician" = "auto";
const PROMO_ALREADY_APPLIED_MESSAGE = "Ce rabais est déjà appliqué à votre commande";
const PROMO_SINGLE_DISCOUNT_MESSAGE = "Un seul rabais promotionnel est permis par transaction";

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
  appointmentConfirmed?: boolean;
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
  // KYC session persistence (survives refresh/crash/order failure)
  verificationSessionId: string | null;
  idVerificationApproved: boolean;
  kycChoice: "reuse" | "restart" | null;
  existingKycStatus: string | null;
  existingKycCaseNumber: string | null;
  // Promo code details (persisted to survive PayPal redirect)
  appliedPromo: {
    id: string;
    code: string;
    name: string;
    discount_type: string;
    discount_value: number;
    discount_amount: number;
    is_referral_code?: boolean;
    referral_code_id?: string;
    influencer_id?: string;
  } | null;
  // Referral code details (persisted to survive PayPal redirect)
  appliedReferral: AppliedReferral | null;
  // Payment state (persisted to avoid double-charging after redirect)
  paypalCaptureId: string;
  paymentComplete: boolean;
  paymentConfirmationNumber: string;
  paymentMethod: "credit_card" | "etransfer" | "paypal" | "promo_free" | null;
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
  // Canonical fees from operational_fees table (replaces hardcoded constants)
  const canonicalFees = useCanonicalFees();
  
  // Build DELIVERY_CONFIG dynamically from canonical fees (with fallbacks)
  const DELIVERY_CONFIG = {
    standard: {
      ...DELIVERY_CONFIG_DEFAULTS.standard,
      fee: canonicalFees.deliveryStandard || DELIVERY_CONFIG_DEFAULTS.standard.fee,
    },
    uber: {
      ...DELIVERY_CONFIG_DEFAULTS.uber,
      fee: canonicalFees.deliveryUber || DELIVERY_CONFIG_DEFAULTS.uber.fee,
    },
    shipHome: {
      ...DELIVERY_CONFIG_DEFAULTS.shipHome,
      fee: canonicalFees.deliveryShipHome || DELIVERY_CONFIG_DEFAULTS.shipHome.fee,
    },
  };
  
  // Welcome discount is now computed server-side by compute_checkout_pricing RPC

  // Idempotency key: generated once per checkout session to prevent duplicate orders
  // Using useRef ensures it's stable across re-renders and never regenerates
  const clientRequestIdRef = useRef(crypto.randomUUID());
  const clientRequestId = clientRequestIdRef.current;

  // Synchronous guard to prevent double-click race conditions
  const submittingRef = useRef(false);

  // Transaction traceability — logs every checkout/payment/order event
  const { logEvent, logCheckoutStarted, logPaymentConfirmed, logPaymentFailed, logOrderCreated, logOrderFailed } = useTransactionTraceability();

  // Hydration flag to prevent step guards from redirecting before state is loaded
  const [isHydrated, setIsHydrated] = useState(false);
  const isInitialMount = useRef(true);

  // Promo: track last validated cart signature to prevent loops on silent revalidation
  const promoCartSignatureRef = useRef<string>("");

  // Detail breakdown visibility state
  const [showFeeDetails, setShowFeeDetails] = useState(false);
  
  const [step, setStep] = useState(1);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [notes, setNotes] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  // Promo state for database-validated promos (including referral codes)
  // IMPORTANT: Must be declared before the hydration useEffect that references it
  const [appliedPromo, setAppliedPromo] = useState<{
    id: string;
    code: string;
    name: string;
    discount_type: string;
    discount_value: number;
    discount_amount: number;
    applies_to?: Record<string, boolean>;
    duration?: string;
    // Referral code specific fields (influencer)
    is_referral_code?: boolean;
    referral_code_id?: string;
    influencer_id?: string;
    // Client referral fields
    is_client_referral?: boolean;
    referrer_user_id?: string;
  } | null>(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [promoValidationError, setPromoValidationError] = useState<string | null>(null);
  
  // Separate referral code state (independent of promo codes)
  const [appliedReferral, setAppliedReferral] = useState<AppliedReferral | null>(null);
  const [installationCredit, setInstallationCredit] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  
  // ID verification state (legacy fields)
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [idExpiration, setIdExpiration] = useState("");
  const [idProvince, setIdProvince] = useState("");
  
  // QR Identity Verification state (Rogers-grade) — persisted independently of order
  const [verificationSessionId, setVerificationSessionId] = useState<string | null>(() => {
    try { return localStorage.getItem('nivra_kyc_session_id') || null; } catch { return null; }
  });
  const [idVerificationApproved, setIdVerificationApproved] = useState(false);
  // KYC choice state: null = user hasn't decided yet, "reuse" or "restart"
  const [kycChoice, setKycChoice] = useState<"reuse" | "restart" | null>(null);
  const [existingKycStatus, setExistingKycStatus] = useState<string | null>(null);
  const [existingKycCaseNumber, setExistingKycCaseNumber] = useState<string | null>(null);
  
  // Customer info fields (DOB, name)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  
  // Checkout phone and service address state
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [serviceAddressStreet, setServiceAddressStreet] = useState("");
  const [serviceAddressApartment, setServiceAddressApartment] = useState("");
  const [serviceAddressCity, setServiceAddressCity] = useState("");
  const [serviceAddressProvince, setServiceAddressProvince] = useState("QC");
  const [serviceAddressPostalCode, setServiceAddressPostalCode] = useState("");
  
  // Installation choice state
  const [installationChoice, setInstallationChoice] = useState<"auto" | "technician" | null>(DEFAULT_INSTALLATION_CHOICE);
  
  // Delivery choice state (for delivery-only orders: Mobile, Streaming, Accessories, Equipment)
  const [deliveryChoice, setDeliveryChoice] = useState<"standard" | "uber" | "shipHome" | null>(null);
  
  // Appointment scheduling state
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [appointmentConfirmed, setAppointmentConfirmed] = useState(false);

  // Initialize installation choice for installable services (only on first selection, not on every change)
  useEffect(() => {
    const hasInstallableService = selectedServices.some((service) =>
      ["Internet", "TV", "Sécurité"].includes(service.category)
    );

    // Only set default if no choice has been made yet (null)
    if (hasInstallableService && installationChoice === null) {
      setInstallationChoice(DEFAULT_INSTALLATION_CHOICE);
    }
  }, [selectedServices]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const [preferredAreaCode, setPreferredAreaCode] = useState<string>("");
  
  // SIM type is plan-driven in this wizard (always physical; quantity = mobile lines)
  const [simType, setSimType] = useState<"esim" | "physical">("physical");

  const [paymentMethod, setPaymentMethod] = useState<"credit_card" | "etransfer" | "paypal" | "promo_free" | null>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [paymentConfirmationNumber, setPaymentConfirmationNumber] = useState("");
  const [paypalCaptureId, setPaypalCaptureId] = useState("");

  // Stripe inline state for checkout
  const [stripeDraft, setStripeDraft] = useState<CheckoutDraftInvoiceResult | null>(null);
  const [stripeDraftLoading, setStripeDraftLoading] = useState(false);
  const [stripeDraftError, setStripeDraftError] = useState<string | null>(null);

  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardName, setCardName] = useState("");
  const [etransferConfirmationNumber, setEtransferConfirmationNumber] = useState("");
  const [etransferSenderName, setEtransferSenderName] = useState("");
  
  // Pre-authorized payment state
  const [acceptPreauthorized, setAcceptPreauthorized] = useState(false);
  const PREAUTH_MONTHLY_DISCOUNT = 5;

  // === LIVE SERVER PRICING (authoritative for summary display) ===
  const [liveServerPricing, setLiveServerPricing] = useState<import("@/lib/pricing/serverPricing").ServerPricingResult | null>(null);
  const [nivraCoreOrderPricing, setNivraCoreOrderPricing] = useState<NivraOrderResponse | null>(null);
  const [isServerPricingLoading, setIsServerPricingLoading] = useState(false);
  const serverPricingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * UI lock to prevent totals from changing during the final submission (mutation pending).
   * This eliminates any “jump” caused by late live pricing refreshes.
   */
  const [lockedUiTotals, setLockedUiTotals] = useState<{
    monthlyRecurringWithTax: number;
    todayTotal: number;
    capturedPaymentAmount: number;
  } | null>(null);

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
        if (INSTALLATION_APPOINTMENT_ENABLED && draft.installationChoice) {
          setInstallationChoice(draft.installationChoice);
        } else {
          setInstallationChoice(DEFAULT_INSTALLATION_CHOICE);
        }
        if (draft.deliveryChoice) setDeliveryChoice(draft.deliveryChoice);
        if (draft.selectedDate) setSelectedDate(draft.selectedDate);
        if (draft.selectedTime) setSelectedTime(draft.selectedTime);
        if (typeof draft.appointmentConfirmed === "boolean") {
          setAppointmentConfirmed(draft.appointmentConfirmed);
        } else if (draft.selectedDate && draft.selectedTime) {
          // Backward compatibility for drafts saved before appointmentConfirmed existed
          setAppointmentConfirmed(true);
        }
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
        // KYC session persistence (independent of order)
        if (draft.verificationSessionId) {
          setVerificationSessionId(draft.verificationSessionId);
          localStorage.setItem('nivra_kyc_session_id', draft.verificationSessionId);
        }
        if (draft.idVerificationApproved) setIdVerificationApproved(draft.idVerificationApproved);
        if (draft.kycChoice) setKycChoice(draft.kycChoice);
        if (draft.existingKycStatus) setExistingKycStatus(draft.existingKycStatus);
        if (draft.existingKycCaseNumber) setExistingKycCaseNumber(draft.existingKycCaseNumber);
        // Promo/referral code details
        if (draft.appliedPromo) {
          setAppliedPromo(draft.appliedPromo);
          console.log("[OrderWizard] Restored appliedPromo:", draft.appliedPromo.code, "discount:", draft.appliedPromo.discount_amount);
        }
        if (draft.appliedReferral) {
          setAppliedReferral(draft.appliedReferral);
          console.log("[OrderWizard] Restored appliedReferral:", draft.appliedReferral.code, "type:", draft.appliedReferral.type);
        }
        // Payment state (critical — must restore ALL payment fields)
        if (draft.paypalCaptureId) setPaypalCaptureId(draft.paypalCaptureId);
        if (draft.paymentComplete) setPaymentComplete(draft.paymentComplete);
        if (draft.paymentConfirmationNumber) setPaymentConfirmationNumber(draft.paymentConfirmationNumber);
        if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
      }
    } catch (e) {
      console.error("[OrderWizard] Failed to hydrate from sessionStorage:", e);
    }
    
    // ─── TV Configurator handoff: read nivra_tv_cart (v3) and pre-populate wizard ───
    try {
      const tvCartRaw = sessionStorage.getItem("nivra_tv_cart");
      const hasDraft = !!sessionStorage.getItem(ORDER_DRAFT_KEY);
      if (tvCartRaw && !hasDraft) {
        const tvPayload = JSON.parse(tvCartRaw);
        
        // Validate payload version 3 and freshness (max 30 min)
        if (
          tvPayload?.source === "tv-configurator" &&
          tvPayload?.version === 3 &&
          tvPayload?.createdAt &&
          Date.now() - new Date(tvPayload.createdAt).getTime() < 30 * 60 * 1000
        ) {
          console.log("[OrderWizard] TV Configurator v3 handoff detected — exact ID mapping");
          
          // Store for deferred matching after services_public + streaming_services load
          sessionStorage.setItem("nivra_tv_cart_pending", JSON.stringify(tvPayload));
          
          // Set terminal quantity (exact from configurator)
          if (tvPayload.terminalQuantity > 0) {
            setTerminalQuantity(tvPayload.terminalQuantity);
          }
          
          // Set installation choice
          if (tvPayload.installationChoice) {
            setInstallationChoice(tvPayload.installationChoice);
          }
          
          // Clear the TV cart after consumption
          sessionStorage.removeItem("nivra_tv_cart");
        } else {
          sessionStorage.removeItem("nivra_tv_cart");
        }
      }
    } catch (tvErr) {
      console.error("[OrderWizard] TV configurator handoff error:", tvErr);
      sessionStorage.removeItem("nivra_tv_cart");
    }

    // Mark as hydrated after initial load
    setIsHydrated(true);
    isInitialMount.current = false;
  }, []);

  // Restore appointment hold from localStorage on mount (validates against DB)
  useEffect(() => {
    if (!isHydrated || !INSTALLATION_APPOINTMENT_ENABLED) return;
    const restoreHold = async () => {
      try {
        const { restoreAppointmentHold } = await import("@/lib/appointmentHold");
        const hold = await restoreAppointmentHold();
        if (hold) {
          console.log("[OrderWizard] Restored appointment hold:", hold.appointmentId, "date:", hold.scheduledAt, "time:", hold.timeSlot);
          // HOLD is the source of truth for appointment restoration on checkout reload/back navigation
          const normalizedHoldDate = (() => {
            const parsed = new Date(hold.scheduledAt);
            return Number.isNaN(parsed.getTime()) ? hold.scheduledAt : parsed.toISOString();
          })();

          setSelectedDate(normalizedHoldDate);
          setSelectedTime(hold.timeSlot || "");
          setAppointmentConfirmed(true);
        }
      } catch (err) {
        console.error("[OrderWizard] Failed to restore appointment hold:", err);
      }
    };
    restoreHold();
  }, [isHydrated]);

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
      appointmentConfirmed,
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
      // KYC session persistence (independent of order)
      verificationSessionId,
      idVerificationApproved,
      kycChoice,
      existingKycStatus,
      existingKycCaseNumber,
      // Promo/referral code details (persisted to survive PayPal redirect)
      appliedPromo,
      appliedReferral,
      // Payment state (all methods)
      paypalCaptureId,
      paymentComplete,
      paymentConfirmationNumber,
      paymentMethod,
    };
    
    console.log("[OrderWizard] Saving draft to sessionStorage, step:", step, "services:", selectedServices.length, "promo:", appliedPromo?.code || "none", "referral:", appliedReferral?.code || "none", "paymentComplete:", paymentComplete);
    sessionStorage.setItem(ORDER_DRAFT_KEY, JSON.stringify(draft));
  }, [
    isHydrated, step, selectedServices, selectedFreeChannels, selectedPaidChannels, selectedStreamingServices,
    terminalQuantity, mobileLineQuantities, mobileTransferChoice, transferPhoneNumber, transferCarrier,
    transferAccountNumber, transferServiceAccount, transferImei, transferValidationResult,
    assignedPhoneNumber, simType, installationChoice, deliveryChoice, selectedDate,
    selectedTime, appointmentConfirmed, notes, discountCode, installationCredit, idType, idNumber, idExpiration, idProvince,
    firstName, lastName, dateOfBirth,
    checkoutPhone, serviceAddressStreet, serviceAddressApartment, serviceAddressCity, serviceAddressProvince, serviceAddressPostalCode,
    verificationSessionId, idVerificationApproved, kycChoice, existingKycStatus, existingKycCaseNumber,
    appliedPromo, appliedReferral, paypalCaptureId, paymentComplete, paymentConfirmationNumber, paymentMethod
  ]);

  // Persist KYC session ID to localStorage whenever it changes (independent of order)
  useEffect(() => {
    if (verificationSessionId) {
      localStorage.setItem('nivra_kyc_session_id', verificationSessionId);
    }
  }, [verificationSessionId]);

  // Restore existing KYC session from DB on mount — strict policy, no silent bypass
  // CRITICAL: Skip if draft already hydrated valid KYC state (prevents overwriting completed state)
  useEffect(() => {
    if (!user?.id || !isHydrated) return;
    
    // If draft hydration already restored a valid KYC choice + session, don't re-query and risk resetting
    if (kycChoice && verificationSessionId && (idVerificationApproved || existingKycStatus)) {
      console.log("[KYC] Skipping DB restore — draft already has valid KYC state:", kycChoice, existingKycStatus);
      return;
    }
    
    const restoreKycSession = async () => {
      try {
        // Only look for non-terminal sessions
        const activeStatuses = ["created", "submitted", "manual_review", "approved"];
        
        const { data: activeSession } = await supabase
          .from("identity_verification_sessions")
          .select("id, status, case_number, reviewed_at, document_front_path")
          .eq("user_id", user.id)
          .in("status", activeStatuses)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (activeSession) {
          console.log("[KYC] Found existing session:", activeSession.id, "status:", activeSession.status);
          
          // FIX #1: Only auto-skip if APPROVED AND within 12 months
          const isApprovedRecently = activeSession.status === "approved" 
            && activeSession.reviewed_at 
            && (Date.now() - new Date(activeSession.reviewed_at).getTime()) < 365 * 24 * 60 * 60 * 1000;
          
          if (isApprovedRecently) {
            // Approved within 12 months → auto-skip, no choice needed
            console.log("[KYC] Session approved within 12 months, auto-skipping");
            setExistingKycStatus("approved");
            setExistingKycCaseNumber(activeSession.case_number || null);
            setKycChoice("reuse");
            setVerificationSessionId(activeSession.id);
            localStorage.setItem('nivra_kyc_session_id', activeSession.id);
            localStorage.setItem('nivra_kyc_choice', 'reuse');
            setIdVerificationApproved(true);
            return;
          }
          
          // For all other statuses (created, submitted, manual_review, expired approved):
          // NEVER auto-skip. Present choice or force new verification.
          setExistingKycStatus(activeSession.status);
          setExistingKycCaseNumber(activeSession.case_number || null);
          
          // Restore previous explicit choice if any
          const storedChoice = localStorage.getItem('nivra_kyc_choice');
          if (storedChoice === 'reuse' && activeSession.status !== "created") {
            // Only allow reuse if docs were actually submitted (not just "created")
            const hasDocuments = !!activeSession.document_front_path;
            if (hasDocuments) {
              setKycChoice('reuse');
              setVerificationSessionId(activeSession.id);
              localStorage.setItem('nivra_kyc_session_id', activeSession.id);
              // Only mark as approved if docs are in review+ status
              const reviewReady = ["submitted", "manual_review"];
              if (reviewReady.includes(activeSession.status)) {
                setIdVerificationApproved(true);
              }
            } else {
              // No documents exist → cannot reuse, force new choice
              localStorage.removeItem('nivra_kyc_choice');
              setKycChoice(null);
            }
          } else if (storedChoice === 'restart') {
            setKycChoice('restart');
            localStorage.removeItem('nivra_kyc_session_id');
            setVerificationSessionId(null);
            setIdVerificationApproved(false);
          } else {
            // No stored choice OR status is "created" → user must decide
            setKycChoice(null);
          }
        } else {
          // No existing session — clear any stale refs
          localStorage.removeItem('nivra_kyc_session_id');
          localStorage.removeItem('nivra_kyc_choice');
          setVerificationSessionId(null);
          setIdVerificationApproved(false);
          setKycChoice(null);
          setExistingKycStatus(null);
        }
      } catch (err) {
        console.error("[KYC] Failed to restore session from DB:", err);
      }
    };
    
    restoreKycSession();
  }, [user?.id, isHydrated]);

  // Clear draft when order is completed (called after successful order creation)
  const clearOrderDraft = () => {
    sessionStorage.removeItem(ORDER_DRAFT_KEY);
    sessionStorage.removeItem("nivra_tv_cart");
    sessionStorage.removeItem("nivra_tv_cart_pending");
    localStorage.removeItem('nivra_kyc_session_id');
    localStorage.removeItem('nivra_kyc_choice');
    // Clear appointment hold reference (hold is already confirmed at this point)
    import("@/lib/appointmentHold").then(m => m.clearAppointmentHold());
    console.log("[OrderWizard] Draft + KYC session + KYC choice + appointment hold + TV cart cleared");
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

  // Fetch available services from canonical catalog (checkout visibility)
  const { data: services, isLoading } = useQuery({
    queryKey: ["available-services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services_public")
        .select("id, name, category, price, short_description, description, visible_checkout, status, display_order")
        .eq("visible_checkout", true)
        .eq("status", "active")
        .order("category", { ascending: true })
        .order("display_order", { ascending: true, nullsFirst: false })
        .order("price", { ascending: true });

      if (error) {
        console.error("[ClientNewOrder] Failed to fetch services_public:", error);
        throw error;
      }

      const orderableCategories = ["Internet", "TV", "TV + Internet", "GIGA Bundles", "Combo", "Mobile", "Sécurité"];
      return (data || [])
        .filter((s) => s.category && orderableCategories.includes(s.category))
        .map((s): Service => ({
          id: s.id || "",
          sku: findSkuByName(allNivraProducts, s.name || "") || "",
          name: s.name || "",
          description: s.short_description || s.description || "",
          price: Number(s.price) || 0,
          category: s.category || "",
        }));
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // ─── TV Configurator v3: exact ID matching after services_public + streaming load ───
  useEffect(() => {
    if (!services?.length || !isHydrated) return;
    
    try {
      const pendingRaw = sessionStorage.getItem("nivra_tv_cart_pending");
      if (!pendingRaw) return;
      
      const tvPayload = JSON.parse(pendingRaw);
      if (tvPayload?.version !== 3) {
        // Legacy v2 payload — discard
        sessionStorage.removeItem("nivra_tv_cart_pending");
        return;
      }
      
      console.log("[OrderWizard] TV Configurator v3: exact ID matching");
      
      // ── 1. Match TV plan by exact services_public.id ──
      const matched: Service[] = [];
      if (tvPayload.selectedPlanId) {
        const plan = services.find(s => s.id === tvPayload.selectedPlanId);
        if (plan) {
          matched.push(plan);
          console.log(`[OrderWizard] TV exact match: plan "${plan.name}" (${plan.id})`);
        } else {
          console.warn(`[OrderWizard] TV plan ID not found in services_public: ${tvPayload.selectedPlanId}`);
        }
      }
      
      if (matched.length > 0) {
        setSelectedServices(matched);
        console.log("[OrderWizard] TV Configurator: pre-selected", matched.length, "service(s)");
      }
      
      // ── 2. Match streaming add-ons by exact streaming_services.id ──
      const streamingIds = tvPayload.selectedStreamingIds as string[] | undefined;
      if (streamingIds?.length) {
        // StreamingPlusSection loads from streaming_services table.
        // We need to fetch the exact records by ID and auto-select them.
        (async () => {
          try {
            const { data: streamingRecords, error } = await supabase
              .from("streaming_services")
              .select("id, name, description, monthly_price, category, features, is_active")
              .in("id", streamingIds)
              .eq("is_active", true);
            
            if (error) {
              console.error("[OrderWizard] Failed to fetch streaming services by ID:", error);
              return;
            }
            
            if (streamingRecords?.length) {
              const mapped: StreamingService[] = streamingRecords.map(r => ({
                id: r.id,
                name: r.name,
                description: r.description,
                monthly_price: r.monthly_price,
                category: r.category || "video",
                features: Array.isArray(r.features) ? r.features : [],
                is_active: r.is_active ?? true,
              }));
              setSelectedStreamingServices(mapped);
              console.log(`[OrderWizard] TV Configurator: auto-selected ${mapped.length} streaming service(s):`, mapped.map(s => s.name).join(", "));
            }
          } catch (streamErr) {
            console.error("[OrderWizard] Streaming auto-select error:", streamErr);
          }
        })();
      }
      
      // Consume pending payload
      sessionStorage.removeItem("nivra_tv_cart_pending");
    } catch (err) {
      console.error("[OrderWizard] TV deferred matching error:", err);
      sessionStorage.removeItem("nivra_tv_cart_pending");
    }
  }, [services, isHydrated]);

  const { data: allNivraProducts = [] } = useQuery({
    queryKey: ["nivra-products-all"],
    queryFn: fetchNivraProducts,
    staleTime: 5 * 60 * 1000,
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

  useEffect(() => {
    const channel = supabase
      .channel("checkout-live-catalog")
      .on("postgres_changes", { event: "*", schema: "public", table: "services" }, () => {
        queryClient.invalidateQueries({ queryKey: ["available-services"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

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
      // Date of birth — ALWAYS hydrate from profile (source of truth, read-only in checkout)
      // This prevents stale closure issues where dateOfBirth state is empty
      if (profile.date_of_birth) {
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
  
  // Check if Streaming service is selected (catalog service OR Streaming+ add-on)
  const hasStreamingService = selectedServices.some(s => s.category === "Streaming") || selectedStreamingServices.length > 0;
  
  // Check if Extras/Accessories service is selected
  const hasExtrasService = selectedServices.some(s => s.category === "Extras");
  
  const hasResidentialService = hasInternetService || hasTVService;
  const checkoutAddressCategory = hasInternetService && hasTVService
    ? "combo"
    : hasInternetService
      ? "internet"
      : hasTVService
        ? "tv"
        : "mobile";
  
  // Check if this is a delivery-only order (Mobile, Streaming, or Accessories only - no technician installation)
  const isDeliveryOnlyOrder = (hasMobileService || hasStreamingService || hasExtrasService) && 
    !hasTVService && !hasInternetService && !selectedServices.some(s => s.category === "Sécurité");
  
  // Check if this is an equipment/accessories-only order (no service plans requiring ID)
  // Equipment-only = Streaming OR Extras/Accessories (no Mobile, Internet, TV, or Security)
  const isEquipmentOnlyOrder = (hasStreamingService || hasExtrasService) && 
    !hasMobileService && !hasTVService && !hasInternetService && 
    !selectedServices.some(s => s.category === "Sécurité");
  
  // Count distinct service types for activation fee calculation
  // 1 service type = $25, 2+ service types = $45 (bundled cap)
  const countServiceTypes = (): number => {
    let count = 0;
    if (hasInternetService) count++;
    if (hasTVService) count++;
    if (hasMobileService) count++;
    return count;
  };
  
  // Calculate activation fee from canonical operational_fees
  const calculateActivationFee = (): number => {
    if (isEquipmentOnlyOrder) return 0;
    const serviceTypeCount = countServiceTypes();
    if (serviceTypeCount === 0) return 0;
    if (serviceTypeCount === 1) return canonicalFees.activationSingle || 25;
    return canonicalFees.activationBundle || 45;
  };
  
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

  // Handle new number selection (number assigned at activation, not during checkout)
  const handleNewNumberSelection = () => {
    setMobileTransferChoice("new");
    setAssignedPhoneNumber("");
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

  // Promo validation helpers
  type PromoCartItemType = "service" | "one_time_fee" | "equipment" | "delivery" | "installation";
  type PromoCartItem = { type: PromoCartItemType; amount: number; name: string };

  const buildPromoValidationPayload = (code: string) => {
    // Normalize: trim, uppercase, remove trailing punctuation (accepts "Bienvenue." etc.)
    const normalizedCode = code.trim().toUpperCase().replace(/[.,;:!?]+$/, "");

    const cartItems: PromoCartItem[] = [];

    // Services (include mobile quantities; avoid double-counting if a service exists in both arrays)
    const selectedMobileIds = new Set(selectedMobileServices.map((s) => s.id));

    selectedServices.forEach((s) => {
      if (selectedMobileIds.has(s.id)) return;
      const qty = s.category === "Mobile" ? (mobileLineQuantities[s.id] || 1) : 1;
      const amount = Number(s.price) * qty;
      cartItems.push({
        type: "service",
        amount,
        name: qty > 1 ? `${s.name} x${qty}` : s.name,
      });
    });

    selectedMobileServices.forEach((s) => {
      const qty = mobileLineQuantities[s.id] || 1;
      const amount = Number(s.price) * qty;
      cartItems.push({
        type: "service",
        amount,
        name: qty > 1 ? `${s.name} x${qty}` : s.name,
      });
    });

    // Paid channels
    selectedPaidChannels.forEach((ch) => {
      cartItems.push({
        type: "service",
        amount: Number(ch.price),
        name: ch.name,
      });
    });

    // Streaming+ add-ons (monthly)
    selectedStreamingServices.forEach((s) => {
      cartItems.push({
        type: "service",
        amount: Number(s.monthly_price),
        name: `Streaming+ — ${s.name}`,
      });
    });

    // Equipment fees
    if (hasTVService && terminalQuantity > 0) {
      cartItems.push({
        type: "equipment",
        amount: terminalQuantity * TERMINAL_CONFIG.price,
        name: `${TERMINAL_CONFIG.name} x${terminalQuantity}`,
      });
    }
    if (hasInternetService || hasTVService) {
      cartItems.push({
        type: "equipment",
        amount: ROUTER_CONFIG_DYNAMIC.price,
        name: ROUTER_CONFIG_DYNAMIC.name,
      });
    }
    if (hasMobileService) {
      cartItems.push({
        type: "equipment",
        amount: SIM_CONFIG_DYNAMIC.physical.price * totalMobileLineQuantity,
        name: `${SIM_CONFIG_DYNAMIC.physical.name} x${totalMobileLineQuantity}`,
      });
    }

    // Activation fee (matches checkout logic)
    const activationFeeForPromo = calculateActivationFee();
    if (activationFeeForPromo > 0) {
      cartItems.push({
        type: "one_time_fee",
        amount: activationFeeForPromo,
        name: "Frais d'activation",
      });
    }

    // Delivery fee if applicable
    if (isDeliveryOnlyOrder && deliveryChoice) {
      const deliveryFeeAmount =
        deliveryChoice === "uber"
          ? DELIVERY_CONFIG.uber.fee
          : deliveryChoice === "shipHome"
            ? DELIVERY_CONFIG.shipHome.fee
            : DELIVERY_CONFIG.standard.fee;

      cartItems.push({
        type: "delivery",
        amount: deliveryFeeAmount,
        name: "Frais de livraison",
      });
    } else if (!isDeliveryOnlyOrder && installationChoice === "auto") {
      cartItems.push({
        type: "delivery",
        amount: 30,
        name: "Frais de livraison",
      });
    }

    // Installation fee if technician
    if (!isDeliveryOnlyOrder && installationChoice === "technician") {
      cartItems.push({
        type: "installation",
        amount: 50,
        name: "Frais d'installation technicien",
      });
    }

    const subtotalBeforeDiscount = cartItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const signature = JSON.stringify({ normalizedCode, subtotalBeforeDiscount, cartItems });

    return { normalizedCode, cartItems, subtotalBeforeDiscount, signature };
  };

  const validateAndApplyPromo = async (
    code: string,
    options?: { silent?: boolean; allowExistingCodeRevalidation?: boolean }
  ): Promise<boolean> => {
    const silent = options?.silent === true;
    const allowExistingCodeRevalidation = options?.allowExistingCodeRevalidation === true;

    if (!code || !code.trim()) {
      if (!silent) toast.error("Veuillez entrer un code promo");
      return false;
    }

    const payload = buildPromoValidationPayload(code);
    const normalizedAppliedCode = appliedPromo?.code?.trim().toUpperCase().replace(/[.,;:!?]+$/, "") || null;
    const hasWelcomeDiscountAlreadyApplied =
      toNonNegativeMoney(liveServerPricing?.welcome_discount ?? 0) > 0 || !!liveServerPricing?.welcome_applied;

    if (!allowExistingCodeRevalidation) {
      if (normalizedAppliedCode === payload.normalizedCode) {
        setPromoValidationError(PROMO_ALREADY_APPLIED_MESSAGE);
        if (!silent) toast.error(PROMO_ALREADY_APPLIED_MESSAGE);
        return false;
      }

      if ((normalizedAppliedCode && normalizedAppliedCode !== payload.normalizedCode) || hasWelcomeDiscountAlreadyApplied) {
        setPromoValidationError(PROMO_SINGLE_DISCOUNT_MESSAGE);
        if (!silent) toast.error(PROMO_SINGLE_DISCOUNT_MESSAGE);
        return false;
      }
    }

    // Mark signature as the last validated cart to prevent immediate revalidation loops
    promoCartSignatureRef.current = payload.signature;

    setIsValidatingPromo(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("validate-promo", {
        body: {
          code: payload.normalizedCode,
          client_email: profile?.email || "",
          client_id: user?.id,
          cart_items: payload.cartItems,
          subtotal_before_discount: payload.subtotalBeforeDiscount,
        },
      });

      if (invokeError) throw invokeError;

      if (!data?.valid) {
        const promoErrorMessage = data?.error || "Code promo invalide";
        setAppliedPromo(null);
        setInstallationCredit(0);
        setPromoValidationError(promoErrorMessage);

        if (silent) {
          toast.error(data?.error || "Ce code promo ne s'applique plus à cette commande");
        } else {
          toast.error(promoErrorMessage);
        }
        return false;
      }

      const validatedDiscountAmount = toNonNegativeMoney(data?.discount_amount ?? 0);
      if (validatedDiscountAmount <= 0) {
        setAppliedPromo(null);
        setInstallationCredit(0);
        setPromoValidationError(PROMO_SINGLE_DISCOUNT_MESSAGE);
        if (!silent) toast.error(PROMO_SINGLE_DISCOUNT_MESSAGE);
        return false;
      }

      setAppliedPromo({
        id: data.promo.id,
        code: data.promo.code,
        name: data.promo.name,
        discount_type: data.promo.discount_type,
        discount_value: data.promo.discount_value,
        discount_amount: validatedDiscountAmount,
        applies_to: data.promo.applies_to,
        duration: data.promo.duration,
        // Influencer referral code specific fields
        is_referral_code: data.is_referral_code || false,
        referral_code_id: data.referral_code_id,
        influencer_id: data.influencer_id,
        // Client referral fields
        is_client_referral: data.is_client_referral || false,
        referrer_user_id: data.referrer_user_id,
      });
      setPromoValidationError(null);

      // IMPORTANT: Do not apply a separate installationCredit discount.
      // The promo is applied once via promoDiscount (discount_amount) in totals.
      setInstallationCredit(0);

      if (!silent) {
        toast.success(
          `Code promo "${data.promo.code}" appliqué! Réduction de ${validatedDiscountAmount.toFixed(2)} $`
        );
      }

      return true;
    } catch (err: any) {
      console.error("Error validating promo:", err);
      setPromoValidationError("Erreur lors de la validation du code promo");
      if (!silent) toast.error("Erreur lors de la validation du code promo");
      return false;
    } finally {
      setIsValidatingPromo(false);
    }
  };

  // Apply discount code using validate-promo edge function
  const applyDiscountCode = async () => {
    await validateAndApplyPromo(discountCode, { silent: false });
  };

  // Remove promo
  const removePromo = () => {
    setAppliedPromo(null);
    setInstallationCredit(0);
    setPromoValidationError(null);
    setDiscountCode("");
    // Note: removing promo does NOT remove referral code — they are independent
    toast.info("Code promo retiré");
  };

  // Remove referral
  const removeReferral = () => {
    setAppliedReferral(null);
  };

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const linkedSessionId = verificationSessionId;
      console.log("[ClientNewOrder] Starting order creation...", { userId: user?.id, clientRequestId, linkedSessionId });
      if (!user?.id) throw new Error("Utilisateur non authentifié. Veuillez vous reconnecter.");

      // Security check before sensitive action
      const { allowed, reason } = await verifyPortalSensitiveActionAllowed(user.id);
      if (!allowed) {
        throw new Error(reason || "Action non autorisée - compte suspendu");
      }

      if (!linkedSessionId) {
        throw new Error("Nous n'avons pas pu lier votre vérification d'identité. Veuillez rafraîchir le code QR et soumettre vos documents à nouveau.");
      }

      const activeStatuses = ["created", "submitted", "manual_review", "approved"];
      const reviewReadyStatuses = ["submitted", "manual_review", "approved"];

      const { data: latestActiveSession, error: latestSessionError } = await supabase
        .from("identity_verification_sessions")
        .select("id, status, created_at")
        .eq("user_id", user.id)
        .in("status", activeStatuses)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestSessionError) {
        throw new Error("Impossible de vérifier votre session d'identité. Veuillez réessayer.");
      }

      const effectiveSessionId = latestActiveSession?.id || linkedSessionId;
      const effectiveSessionStatus = latestActiveSession?.status || null;

      if (!effectiveSessionId || !effectiveSessionStatus || !reviewReadyStatuses.includes(effectiveSessionStatus)) {
        throw new Error("Votre vérification d'identité doit être soumise avant de finaliser la commande.");
      }
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
        : (installationChoice === "auto" ? (canonicalFees.deliverySelfInstall || 30) : 0);

      // Determine installation type for the order
      const orderInstallationType = isDeliveryOnlyOrder 
        ? (deliveryChoice === "uber" ? "uber_express" : 
           deliveryChoice === "shipHome" ? "ship_to_home" :
           "delivery_standard")
        : installationChoice;
      
      // For equipment-only orders, no activation fee (canonical)
      const orderActivationFee = isEquipmentOnlyOrder ? 0 : (canonicalFees.activationSingle || 25);

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
        ...(!isDeliveryOnlyOrder && installationChoice === "technician" ? [{ name: "Installation professionnelle", amount: Math.max(0, (canonicalFees.installationTechnician || 50) - installationCredit) }] : []),
      ];
      
      // Build discounts array (promo + preauth only - no auto SIM credits)
      const promoDiscountForLineItems = toNonNegativeMoney(liveServerPricing?.promo_discount ?? 0);
      const discountsForLineItems = [
        ...(appliedPromo && promoDiscountForLineItems > 0 ? [{
          name: `Rabais promotionnel (${appliedPromo.code})`,
          amount: promoDiscountForLineItems,
          description: appliedPromo.name,
        }] : []),
        ...((liveServerPricing?.welcome_discount ?? 0) > 0 ? [{
          name: "Rabais nouveau client (50% — 1er mois)",
          amount: liveServerPricing?.welcome_discount ?? 0,
          description: "50% de rabais sur les services — première facture uniquement",
        }] : []),
        ...(acceptPreauthorized ? [{
          name: "Rabais paiement préautorisé",
          amount: PREAUTH_MONTHLY_DISCOUNT,
          description: "5$/mois",
        }] : []),
      ];
      
      const lineItems = buildOrderLineItems({
        services: [...servicesForLineItems, ...streamingForLineItems, ...paidChannelsForLineItems],
        equipment: equipmentForLineItems,
        fees: feesForLineItems,
        discounts: discountsForLineItems,
      });

      // =====================================================================
      // NIVRA CORE — SINGLE SOURCE OF TRUTH FOR ORDER + BILLING CREATION
      // =====================================================================
      // Build the full checkout payload and submit to Nivra Core.
      // Nivra Core atomically creates: order, invoice, payment, subscription(s).
      // The frontend only collects inputs and displays the canonical response.
      // =====================================================================

      // Build SKU-based items array for Nivra Core
      const nivraItems: NivraOrderItem[] = [];
      for (const s of selectedServices) {
        const sku = s.sku || findSkuByName(allNivraProducts, s.name);
        if (sku) {
          nivraItems.push({
            sku,
            quantity: s.category === "Mobile" ? (mobileLineQuantities[s.id] || 1) : 1,
          });
        } else {
          console.warn("[NivraCheckout] No SKU found for service:", s.name);
        }
      }
      if (hasInternetService || hasTVService) nivraItems.push({ sku: SKU.ROUTER, quantity: 1 });
      if (hasTVService) nivraItems.push({ sku: SKU.TVBOX, quantity: terminalQuantity });
      if (hasMobileService) nivraItems.push({ sku: SKU.SIM, quantity: totalMobileLineQuantity });
      if (orderActivationFee > 0) {
        const uniqueCategories = new Set(selectedServices.map(s => s.category));
        nivraItems.push({ sku: uniqueCategories.size >= 2 ? SKU.ACTIVATION_2PLUS : SKU.ACTIVATION_1, quantity: 1 });
      }
      if (orderDeliveryFee > 0) nivraItems.push({ sku: SKU.DELIVERY, quantity: 1 });

      const customerName = `${firstName} ${lastName}`.trim();
      const customerEmail = profile?.email || user.email || "";

      // Use compute_checkout_pricing RPC as authoritative for ALL amounts
      const rpcPricing = liveServerPricing ? normalizeServerPricingResult(liveServerPricing) : null;
      const fallbackPricing = normalizeServerPricingResult({
        grand_total: 0,
        tps_amount: 0,
        tvq_amount: 0,
        taxable_base: monthlyRecurring + oneTimeFees,
        recurring_subtotal: monthlyRecurring,
        one_time_subtotal: oneTimeFees,
        discount_total_combined: 0,
        promo_discount: 0,
        welcome_discount: 0,
        preauth_discount: acceptPreauthorized ? PREAUTH_MONTHLY_DISCOUNT : 0,
      });
      const canonicalPricing = normalizeServerPricingResult({
        ...(rpcPricing || fallbackPricing),
        grand_total: rpcPricing?.grand_total ?? fallbackPricing.grand_total,
        tps_amount: rpcPricing?.tps_amount ?? fallbackPricing.tps_amount,
        tvq_amount: rpcPricing?.tvq_amount ?? fallbackPricing.tvq_amount,
        taxable_base: rpcPricing?.taxable_base ?? fallbackPricing.taxable_base,
        recurring_subtotal: rpcPricing?.recurring_subtotal ?? fallbackPricing.recurring_subtotal,
        one_time_subtotal: rpcPricing?.one_time_subtotal ?? fallbackPricing.one_time_subtotal,
        discount_total_combined: rpcPricing?.discount_total_combined ?? 0,
        promo_discount: rpcPricing?.promo_discount ?? 0,
        welcome_discount: rpcPricing?.welcome_discount ?? 0,
        preauth_discount: rpcPricing?.preauth_discount ?? (acceptPreauthorized ? PREAUTH_MONTHLY_DISCOUNT : 0),
      });

      // serverPricing snapshot — canonical references filled after Nivra Core responds
      const serverPricing = {
        ...canonicalPricing,
        welcome_applied: rpcPricing?.welcome_applied ?? false,
        is_new_customer: rpcPricing?.is_new_customer ?? false,
        promo_applied: rpcPricing?.promo_applied ?? null,
        computed_at: rpcPricing?.computed_at || new Date().toISOString(),
        nivra_order_number: '',
        nivra_payment_number: '',
        nivra_invoice_number: '',
        nivra_order_id: '',
        billing_cycle_day: new Date().getDate(),
      };

      // Resolve account_id for order linkage — BLOCKING: orders MUST have account_id
      // Auto-creates the canonical account if missing (imported/new/partial clients)
      let resolvedAccountId: string | null = null;
      {
        // Step 1: Try to find existing active account
        const { data: acctRows, error: acctErr } = await supabase
          .from("accounts")
          .select("id")
          .eq("client_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: true })
          .limit(1);
        if (acctErr) {
          console.error("[Checkout] Account resolution query failed:", acctErr);
        }
        resolvedAccountId = acctRows?.[0]?.id || null;

        // Step 2: Auto-create account if none exists
        if (!resolvedAccountId) {
          console.warn("[Checkout] No active account found for user:", user.id, "— auto-creating");
          const { data: newAcct, error: createErr } = await supabase
            .from("accounts")
            .insert({
              client_id: user.id,
              account_number: "000000", // trigger auto-generates valid number
              account_name: "Primary",
              status: "active",
              primary_service_address: serviceAddressStreet || null,
              primary_service_city: serviceAddressCity || null,
              primary_service_province: serviceAddressProvince || "QC",
              primary_service_postal_code: serviceAddressPostalCode || null,
            })
            .select("id")
            .single();

          if (createErr) {
            // Handle unique constraint — account may have been created concurrently
            if (createErr.code === "23505") {
              console.warn("[Checkout] Account already exists (race condition), re-fetching");
              const { data: retryRows } = await supabase
                .from("accounts")
                .select("id")
                .eq("client_id", user.id)
                .eq("status", "active")
                .limit(1);
              resolvedAccountId = retryRows?.[0]?.id || null;
            }
            if (!resolvedAccountId) {
              console.error("[Checkout] Failed to auto-create account:", createErr);
              throw new Error("Une erreur temporaire est survenue. Veuillez réessayer dans quelques instants.");
            }
          } else {
            resolvedAccountId = newAcct?.id || null;
            console.info("[Checkout] Auto-created account:", resolvedAccountId);
          }
        }

        if (!resolvedAccountId) {
          console.error("[Checkout] Account resolution exhausted for user:", user.id);
          throw new Error("Une erreur temporaire est survenue. Veuillez réessayer dans quelques instants.");
        }
      }

      // Determine payment method value
      const paymentMethodValue = paymentMethod === "paypal" ? "paypal" 
        : paymentMethod === "etransfer" ? "etransfer"
        : paymentMethod === "credit_card" ? "credit_card"
        : paymentMethod === "promo_free" ? "promo_free"
        : "etransfer";

      const canonicalPromoDiscount = toNonNegativeMoney(serverPricing.promo_discount);
      const orderTotalAmount = toNonNegativeMoney(serverPricing.grand_total);
      const orderTaxableBase = toNonNegativeMoney(serverPricing.taxable_base);
      const { tps: orderTpsAmount, tvq: orderTvqAmount } = sanitizeTaxes(
        orderTaxableBase,
        serverPricing.tps_amount,
        serverPricing.tvq_amount,
      );
      const shouldAttachPromoToCheckout = !!appliedPromo && canonicalPromoDiscount > 0;

      // ═══════════════════════════════════════════════════════════════
      // SUBMIT TO NIVRA CORE — Creates order, invoice, payment, subs
      // ═══════════════════════════════════════════════════════════════
      // ★ TRACEABILITY: Log order submission attempt
      logEvent({
        event_type: "order_submitted",
        event_category: "order",
        status: "pending",
        amount: orderTotalAmount,
        metadata: {
          services: selectedServices.map(s => s.name),
          payment_method: paymentMethodValue,
          client_request_id: clientRequestId,
        },
      });

      // ── Build the full checkout payload once ──
      const checkoutPayload: import("@/lib/api/nivraApi").NivraFullCheckoutPayload = {
        client_request_id: clientRequestId,
        customer: {
          user_id: user.id,
          first_name: firstName || profile?.first_name || '',
          last_name: lastName || profile?.last_name || '',
          email: customerEmail,
          phone: checkoutPhone || profile?.phone || '',
          date_of_birth: profile?.date_of_birth || dateOfBirth || null,
        },
        service_address: {
          street: serviceAddressStreet || '',
          apartment: serviceAddressApartment || null,
          city: serviceAddressCity || '',
          province: serviceAddressProvince || 'QC',
          postal_code: serviceAddressPostalCode || '',
        },
        services: selectedServices.map(s => ({
          sku: s.sku || findSkuByName(allNivraProducts, s.name) || s.id,
          name: s.name || 'Service Nivra',
          plan_code: s.id || s.name?.toUpperCase().replace(/\s+/g, '_') || 'UNKNOWN',
          plan_price: toMoney(s.price),
          category: s.category || 'Other',
          quantity: s.category === "Mobile" ? (mobileLineQuantities[s.id] || 1) : 1,
        })),
        equipment: [
          ...((hasInternetService || hasTVService) ? [{ sku: SKU.ROUTER, name: ROUTER_CONFIG_DYNAMIC.name, quantity: 1, unit_price: ROUTER_CONFIG_DYNAMIC.price }] : []),
          ...(hasTVService ? [{ sku: SKU.TVBOX, name: TERMINAL_CONFIG.name, quantity: terminalQuantity, unit_price: TERMINAL_CONFIG.price }] : []),
          ...(hasMobileService ? [{ sku: SKU.SIM, name: SIM_CONFIG_DYNAMIC.physical.name, quantity: totalMobileLineQuantity, unit_price: SIM_CONFIG_DYNAMIC.physical.price }] : []),
        ],
        fees: [
          ...(orderActivationFee > 0 ? [{ sku: new Set(selectedServices.map(s => s.category)).size >= 2 ? SKU.ACTIVATION_2PLUS : SKU.ACTIVATION_1, name: "Frais d'activation", amount: orderActivationFee }] : []),
          ...(orderDeliveryFee > 0 ? [{ sku: SKU.DELIVERY, name: isDeliveryOnlyOrder ? "Frais de livraison" : "Frais de livraison/installation", amount: orderDeliveryFee }] : []),
          ...(!isDeliveryOnlyOrder && installationChoice === "technician" ? [{ sku: "FEE-INSTALL", name: "Installation professionnelle", amount: Math.max(0, (canonicalFees.installationTechnician || 50) - installationCredit) }] : []),
        ],
        promo: shouldAttachPromoToCheckout && appliedPromo ? {
          code: appliedPromo.code,
          name: appliedPromo.name,
          discount_type: appliedPromo.discount_type,
          discount_value: appliedPromo.discount_value,
          discount_amount: canonicalPromoDiscount,
          is_referral_code: appliedPromo.is_referral_code || false,
          referral_code_id: appliedPromo.referral_code_id,
          influencer_id: appliedPromo.influencer_id,
        } : null,
        payment: {
          method: paymentMethodValue as any,
          status: paymentMethodValue === "paypal" && paypalCaptureId ? "captured" : "pre_authorized",
          reference: paymentMethodValue === "paypal" && paypalCaptureId ? paypalCaptureId : paymentConfirmationNumber || null,
          paypal_capture_id: paypalCaptureId || null,
          preauth_opt_in: acceptPreauthorized,
          preauth_discount: acceptPreauthorized ? PREAUTH_MONTHLY_DISCOUNT : 0,
        },
        identity: {
          verification_session_id: effectiveSessionId,
          id_type: idType || null,
          id_number: idNumber || null,
          id_expiration: idExpiration || null,
          id_province: idProvince || null,
        },
        installation: {
          type: orderInstallationType,
          delivery_fee: orderDeliveryFee,
          installation_fee: (!isDeliveryOnlyOrder && installationChoice === "technician") ? 50 : 0,
          scheduled_date: selectedDate || null,
          scheduled_time: selectedTime || null,
        },
        channels: hasTVService ? {
          base_channels: baseChannels.map(ch => ({ id: ch.id, name: ch.name })),
          free_channels: selectedFreeChannels.map(ch => ({ id: ch.id, name: ch.name })),
          paid_channels: selectedPaidChannels.map(ch => ({ id: ch.id, name: ch.name, price: ch.price })),
        } : null,
        streaming_addons: selectedStreamingServices.map(s => ({
          id: s.id,
          name: s.name,
          monthly_price: Number(s.monthly_price),
        })),
        port_request: portRequestData ? {
          port_in: true,
          phone_number: portRequestData.phone_number,
          carrier: portRequestData.carrier,
          account_number: portRequestData.account_number,
          service_account: portRequestData.service_account,
          imei: portRequestData.imei,
        } : null,
        pricing_snapshot: serverPricing,
        line_items: lineItems,
        notes: (notes || ''),
        account_id: resolvedAccountId,
        // Track referral code separately from promo
        referral: appliedReferral ? {
          code: appliedReferral.code,
          type: appliedReferral.type,
          referrer_user_id: appliedReferral.referrer_user_id,
          referral_code_id: appliedReferral.referral_code_id,
          influencer_id: appliedReferral.influencer_id,
        } : null,
      };

      // ── Try Nivra Core API first, fallback to direct Supabase creation ──
      let nivraCheckoutResponse: NivraFullCheckoutResponse;
      let usedFallback = false;

      try {
        nivraCheckoutResponse = await submitNivraCheckout(checkoutPayload);
        console.log("[NivraCore] Checkout response:", nivraCheckoutResponse);
      } catch (nivraErr: any) {
        console.warn("[NivraCore] External API unavailable, using direct Supabase fallback:", nivraErr.message);
        usedFallback = true;
        nivraCheckoutResponse = await fallbackCheckout(supabase, checkoutPayload);
        console.log("[FallbackCheckout] Response:", nivraCheckoutResponse);
      }

      // ★ TRACEABILITY: Log successful order creation from Nivra Core
      logOrderCreated({
        order_number: nivraCheckoutResponse.order_number,
        order_id: nivraCheckoutResponse.order_id,
        invoice_number: nivraCheckoutResponse.invoice_number,
        payment_number: nivraCheckoutResponse.payment_number,
        amount: orderTotalAmount,
      });

      // Backfill serverPricing with canonical Nivra Core references
      serverPricing.nivra_order_number = nivraCheckoutResponse.order_number;
      serverPricing.nivra_payment_number = nivraCheckoutResponse.payment_number;
      serverPricing.nivra_invoice_number = nivraCheckoutResponse.invoice_number;
      serverPricing.nivra_order_id = nivraCheckoutResponse.order_id;
      serverPricing.billing_cycle_day = nivraCheckoutResponse.billing_cycle_day;

      // ★ Notify Nivra Core that PayPal payment was captured (fire-and-forget)
      if (!usedFallback && paypalCaptureId && nivraCheckoutResponse.payment_number) {
        notifyNivraCorePaid({
          paymentNumber: nivraCheckoutResponse.payment_number,
          paypalOrderId: paypalCaptureId,
          paypalCaptureId: paypalCaptureId,
        });
      }

      // ★ CANONICAL SYNC: backend reconciliation (idempotent + auto-recovery)
      // Always run (including fallback mode) so missing canonical records are healed.
      const canonicalSyncErrors: string[] = [];
      try {
        const referralSyncContext = appliedReferral?.type === "client"
          ? {
              referral_code_used: appliedReferral.code,
              referrer_user_id: appliedReferral.referrer_user_id,
              referred_user_id: user?.id,
              referred_order_id: nivraCheckoutResponse.order_id,
            }
          : null;

        const syncPayload = {
          payload: {
            ...checkoutPayload,
            ...(referralSyncContext || {}),
          },
          response: nivraCheckoutResponse,
          referral_context: referralSyncContext,
        };

        let syncOk = false;
        let lastSyncError: string | null = null;

        for (let attempt = 1; attempt <= 2; attempt++) {
          const { data: syncData, error: syncError } = await supabase.functions.invoke("checkout-canonical-sync", {
            body: syncPayload,
          });

          if (syncError) {
            lastSyncError = syncError.message || "invoke_failed";
            console.error(`[CanonicalSync] Attempt ${attempt} invoke failed:`, syncError);
            continue;
          }

          if (syncData?.ok === true) {
            syncOk = true;
            break;
          }

          const returnedErrors = Array.isArray(syncData?.errors) ? syncData.errors : [];
          if (returnedErrors.length === 0) {
            syncOk = true;
            break;
          }

          lastSyncError = returnedErrors.join(" | ");
          console.error(`[CanonicalSync] Attempt ${attempt} returned errors:`, returnedErrors);
        }

        if (!syncOk) {
          canonicalSyncErrors.push("canonical_sync");
          console.error("[CanonicalSync] Non-blocking reconcile failure:", lastSyncError);
        }
      } catch (syncCatchErr) {
        canonicalSyncErrors.push("canonical_sync");
        console.error("[CanonicalSync] Unexpected error:", syncCatchErr);
      }

      // ═══════════════════════════════════════════════════════════════
      // USE NIVRA CORE RESPONSE AS CANONICAL DATA
      // ═══════════════════════════════════════════════════════════════
      const data = {
        id: nivraCheckoutResponse.order_id,
        order_number: nivraCheckoutResponse.order_number,
        payment_reference: nivraCheckoutResponse.payment_number,
        pricing_snapshot: serverPricing,
        service_type: selectedServices.map(s => s.name).join(", "),
        installation_type: orderInstallationType,
        delivery_method: isDeliveryOnlyOrder ? deliveryChoice : installationChoice,
        appointment_date: selectedDate || null,
        appointment_time: selectedTime || null,
        shipping_address: serviceAddressStreet,
        shipping_city: serviceAddressCity,
        shipping_province: serviceAddressProvince || "QC",
        shipping_postal_code: serviceAddressPostalCode,
      };

      let nivraPaymentRef = nivraCheckoutResponse.payment_number;
      const postStepErrors: string[] = [...canonicalSyncErrors];

      // ★ Update account billing_cycle_day (skip if fallback already handled it)
      if (!usedFallback) {
        try {
          if (resolvedAccountId && nivraCheckoutResponse.billing_cycle_day) {
            await supabase
              .from("accounts")
              .update({ billing_cycle_day: nivraCheckoutResponse.billing_cycle_day })
              .eq("id", resolvedAccountId);
            console.log("[BillingCycle] Account billing_cycle_day set to:", nivraCheckoutResponse.billing_cycle_day);
          }
        } catch (cyclErr) {
          console.warn("[BillingCycle] Failed to update (non-blocking):", cyclErr);
        }
      }

      // ============================================================
      // NOTE: Order, Invoice, Payment, Subscription are ALL created
      // by Nivra Core. The legacy supabase.from("payments").insert()
      // and supabase.functions.invoke("billing-create-order") blocks
      // have been REMOVED. Nivra Core is the single source of truth.
      // ============================================================

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

      // AUTO-CONFIRM APPOINTMENT HOLD for orders requiring installation (Internet/TV/Security)
      // The hold was already created when the user selected a slot (persisted in DB + localStorage)
      const requiresInstallationService = hasInternetService || hasTVService || selectedServices.some(s => s.category === "Sécurité");
      const hasScheduledSlot = selectedDate && selectedTime;
      const shouldConfirmAppointment = INSTALLATION_APPOINTMENT_ENABLED && requiresInstallationService && hasScheduledSlot;
      
      if (shouldConfirmAppointment) {
        try {
          const { confirmAppointmentHold } = await import("@/lib/appointmentHold");
          const confirmed = await confirmAppointmentHold(data.id);
          
          if (confirmed) {
            console.log("[Appointment] Hold confirmed for order:", data.order_number);
          } else {
            // Fallback: create appointment the old way if no hold exists
            console.warn("[Appointment] No hold to confirm, creating appointment directly");
            const { createAppointmentFromOrder } = await import("@/lib/appointmentUtils");
            
            const equipmentDetails = [];
            if (hasInternetService || hasTVService) {
              equipmentDetails.push({ type: "router", name: "Nivra Born Wifi", fee: ROUTER_CONFIG_DYNAMIC.price });
            }
            if (hasTVService) {
              equipmentDetails.push({ type: "terminal", name: "Nivra 4K Smart Terminal", quantity: terminalQuantity, fee: terminalQuantity * TERMINAL_CONFIG.price });
            }
            
            await createAppointmentFromOrder({
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
          }
        } catch (apptErr) {
          console.error("Appointment step failed:", apptErr);
          postStepErrors.push("appointment");
        }
      }

      // ========== CLIENT REFERRAL TRACKING ==========
      // Canonical server-side path only (checkout-canonical-sync).
      if (appliedReferral?.type === "client") {
        console.log("[Referral] Delegated to checkout-canonical-sync server insert", {
          code: appliedReferral.code,
          referrer_user_id: appliedReferral.referrer_user_id,
          referred_user_id: user?.id,
          referred_order_id: data.id,
        });
      }

      // Record promo/referral redemption only when promo discount was actually applied by authoritative pricing
      if (appliedPromo && user?.id && canonicalPromoDiscount > 0) {
        try {
          // Check if this is a referral code (influencer code)
          if (appliedPromo.is_referral_code && appliedPromo.referral_code_id && appliedPromo.influencer_id) {
            // Record in referral_attributions for influencer tracking
            const { error: attrError } = await supabase.from("referral_attributions").insert({
              referral_code_id: appliedPromo.referral_code_id,
              influencer_id: appliedPromo.influencer_id,
              order_id: data.id,
              customer_id: user.id,
              customer_email: (profile?.email || user.email || "").toLowerCase(),
              customer_discount_amount: canonicalPromoDiscount,
              status: 'pending',
            });
            
            if (attrError) {
              console.error("[Referral] Attribution insert failed:", attrError);
              postStepErrors.push("referral_attribution");
            } else {
              console.log("[Referral] Attribution recorded for order:", data.order_number, "influencer:", appliedPromo.influencer_id);
            }
            
            // Also increment usage_count on referral_codes
            const { error: rpcError } = await supabase.rpc('increment_referral_usage', { 
              code_id: appliedPromo.referral_code_id 
            });
            if (rpcError) {
              console.error("[Referral] Usage count increment failed:", rpcError);
            } else {
              console.log("[Referral] Usage count incremented for code:", appliedPromo.referral_code_id);
            }
          } else if (!appliedPromo.is_client_referral) {
            // Regular promo code - record in promotion_redemptions
            const { error: promoError } = await supabase.from("promotion_redemptions").insert({
              promotion_id: appliedPromo.id,
              order_id: data.id,
              order_number: data.order_number,
              client_id: user.id,
              client_email: (profile?.email || user.email || "").toLowerCase(),
              discount_amount: canonicalPromoDiscount,
            });
            if (promoError) {
              console.error("[Promo] Redemption insert failed:", promoError);
              postStepErrors.push("promo_redemption");
            } else {
              console.log("[Promo] Redemption recorded for order:", data.order_number);
            }
          }
          
          // Create audit note for promo/referral applied
          AuditNotes.promoApplied(
            user.id,
            data.id,
            appliedPromo.code,
            canonicalPromoDiscount
          );
        } catch (promoErr) {
          console.error("[Promo/Referral] Failed to record redemption (non-blocking):", promoErr);
          postStepErrors.push("promo_general");
        }
      }

      // CREATE ORDER SNAPSHOT for contract generation and admin visibility
      try {
        const snapshotData = {
          order_id: data.id,
          version: 1,
          client_snapshot: {
            first_name: firstName || profile?.first_name || null,
            last_name: lastName || profile?.last_name || null,
            full_name: `${firstName || ''} ${lastName || ''}`.trim() || profile?.full_name || null,
            email: profile?.email || user?.email || null,
            phone: checkoutPhone || profile?.phone || null,
            date_of_birth: profile?.date_of_birth || dateOfBirth || null,
            id_type: idType || null,
            id_number: idNumber || null,
            id_expiration: idExpiration || null,
            id_province: idProvince || null,
            // Individual address components
            service_address: serviceAddressStreet || null,
            service_city: serviceAddressCity || null,
            service_province: serviceAddressProvince || null,
            service_postal_code: serviceAddressPostalCode || null,
            service_apartment: serviceAddressApartment || null,
            // FULL FORMATTED ADDRESS for Admin/Contracts (v2.1)
            full_service_address: [
              serviceAddressApartment ? `${serviceAddressApartment} - ` : '',
              serviceAddressStreet,
              serviceAddressCity,
              serviceAddressProvince,
              serviceAddressPostalCode
            ].filter(Boolean).join(', ').replace(', ,', ',').trim() || profile?.service_address || null,
            // Also include billing address (fallback to service)
            billing_address: [
              serviceAddressApartment ? `${serviceAddressApartment} - ` : '',
              serviceAddressStreet,
              serviceAddressCity,
              serviceAddressProvince,
              serviceAddressPostalCode
            ].filter(Boolean).join(', ').replace(', ,', ',').trim() || profile?.billing_address || profile?.service_address || null,
          },
          services_snapshot: selectedServices.map(s => ({
            id: s.id,
            name: s.name,
            category: s.category,
            price: toMoney(s.price),
            quantity: s.category === "Mobile" ? (mobileLineQuantities[s.id] || 1) : 1,
          })),
          equipment_snapshot: {
            terminal: hasTVService ? { name: TERMINAL_CONFIG.name, quantity: terminalQuantity, unit_price: toMoney(TERMINAL_CONFIG.price) } : null,
            router: (hasInternetService || hasTVService) ? { name: ROUTER_CONFIG_DYNAMIC.name, quantity: 1, unit_price: toMoney(ROUTER_CONFIG_DYNAMIC.price) } : null,
            sim: hasMobileService ? { name: SIM_CONFIG_DYNAMIC.physical.name, quantity: totalMobileLineQuantity, unit_price: toMoney(SIM_CONFIG_DYNAMIC.physical.price) } : null,
          },
          fees_snapshot: {
            activation: toMoney(activationFee),
            delivery: toMoney(deliveryFee),
            installation: toMoney(installationFee),
            promo_discount: canonicalPromoDiscount,
            promo_code: appliedPromo?.code || null,
          },
          billing_snapshot: {
            subtotal: orderTaxableBase,
            one_time_fees: toNonNegativeMoney(serverPricing.one_time_subtotal),
            tps: orderTpsAmount,
            tvq: orderTvqAmount,
            total: orderTotalAmount,
            payment_method: paymentMethod || null,
            payment_reference: paymentConfirmationNumber || nivraPaymentRef || null,
          },
          selected_channels_snapshot: hasTVService ? {
            base_channels: baseChannels.map(ch => ch.name),
            free_channels: selectedFreeChannels.map(ch => ch.name),
            paid_channels: selectedPaidChannels.map(ch => ({ name: ch.name, price: ch.price })),
          } : null,
          payment_method_snapshot: {
            method: paymentMethod,
            reference: paymentConfirmationNumber || nivraPaymentRef,
            paypal_capture_id: paypalCaptureId || null,
          },
          accepted_at: new Date().toISOString(),
          accepted_method: 'web_checkout',
        };

        // USE GUARANTEED RPC FUNCTION (bypasses RLS issues)
        const { data: snapshotId, error: snapshotError } = await supabase
          .rpc("create_order_snapshot", {
            p_order_id: data.id,
            p_client_snapshot: snapshotData.client_snapshot,
            p_services_snapshot: snapshotData.services_snapshot,
            p_equipment_snapshot: snapshotData.equipment_snapshot,
            p_fees_snapshot: snapshotData.fees_snapshot,
            p_billing_snapshot: snapshotData.billing_snapshot,
            p_selected_channels_snapshot: snapshotData.selected_channels_snapshot,
            p_payment_method_snapshot: snapshotData.payment_method_snapshot,
          });

        if (snapshotError) {
          console.error("[OrderSnapshot] RPC failed to create snapshot:", snapshotError);
          postStepErrors.push("snapshot");
        } else {
          console.log("[OrderSnapshot] Snapshot created via RPC for order:", data.order_number, "snapshot_id:", snapshotId);
        }
      } catch (snapshotErr) {
        console.error("[OrderSnapshot] Error creating snapshot (non-blocking):", snapshotErr);
        postStepErrors.push("snapshot");
      }

      // === CARRIER-GRADE ORCHESTRATION (Phase 2A) ===
      // Create order_items, provisioning_jobs, shipments atomically
      try {
        const { orchestrateOrder } = await import("@/lib/orderOrchestration");
        const orchResult = await orchestrateOrder(data.id, supabase);
        if (orchResult.status === 'error') {
          console.error("[Orchestration] Failed (non-blocking):", orchResult.error);
          postStepErrors.push("orchestration");
        } else {
          console.log("[Orchestration] Order orchestrated:", orchResult);
        }
      } catch (orchErr) {
        console.error("[Orchestration] Exception (non-blocking):", orchErr);
        postStepErrors.push("orchestration");
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

      // ★ TRACEABILITY: Log checkout completed
      const orderData = result as unknown as CreatedOrder & { nivraPaymentRef?: string };
      logEvent({
        event_type: "checkout_completed",
        event_category: "checkout",
        status: "success",
        order_number: orderData.order_number,
        order_id: orderData.id,
        payment_reference: orderData.nivraPaymentRef,
      });
      
      // Navigate to dedicated confirmation page with order number
      
      // Note: Promo/referral redemption is now recorded in the mutation function
      // for better reliability (before returning from mutation)
      
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
        
        // Map payment method to human-readable label
        const paymentMethodLabel = paymentMethod === "paypal" 
          ? "PayPal" 
          : paymentMethod === "etransfer" 
            ? "Virement Interac" 
            : paymentMethod === "credit_card" 
              ? "Carte de crédit"
              : paymentMethod === "promo_free"
                ? "Gratuit (promo)"
                : "Non spécifié";
        
        await supabase.functions.invoke("send-order-confirmation", {
          body: {
            order_id: orderData.id,
            client_email: profile?.email || user?.email,
            client_first_name: profile?.full_name?.split(" ")[0] || firstName || "Client",
            client_phone: checkoutPhone || profile?.phone,
            order_number: orderData.order_number,
            services: servicesForEmail,
            monthly_total_tax_in: monthlyTotalWithTax,
            one_time_total: oneTimeFees,
            delivery_method: isDeliveryOnlyOrder ? deliveryChoice : installationChoice,
            payment_reference: orderData.nivraPaymentRef || paymentConfirmationNumber,
            payment_method: paymentMethodLabel,
          },
        });
        console.log("[OrderConfirmation] Email request sent for order:", orderData.order_number);
      } catch (emailErr) {
        console.error("[OrderConfirmation] Email sending failed (non-blocking):", emailErr);
      }
      
      // Send admin notification for new order (fire-and-forget)
      try {
        const servicesDesc = selectedServices.map(s => s.name).join(", ");
        notifyAdmin({
          event_type: "new_order",
          event_id: orderData.id,
          event_number: orderData.order_number,
          client_name: profile?.full_name || user?.email,
          client_email: profile?.email || user?.email,
          client_phone: profile?.phone,
          summary: `Nouvelle commande: ${servicesDesc}`,
          details: {
            "Services": servicesDesc,
            "Total": `$${(authoritativePricing?.total ?? 0).toFixed(2)}`,
            "Méthode paiement": paymentMethod === "paypal" ? "PayPal" : paymentMethod === "etransfer" ? "Virement Interac" : paymentMethod === "credit_card" ? "Carte de crédit" : paymentMethod || "Non spécifié",
          },
          priority: "normal",
          admin_portal_link: getAdminPortalLink(`/admin/orders?order=${orderData.order_number}`),
        });
      } catch (notifyErr) {
        console.error("[AdminNotification] Failed (non-blocking):", notifyErr);
      }
      
      // Navigate to confirmation page with order number (canonical Nivra Core reference)
      navigate(`/portal/order-confirmation?orderNumber=${orderData.order_number}`, {
        state: {
          nivraOrder: {
            id: orderData.id,
            order_number: orderData.order_number,
            payment_reference: orderData.nivraPaymentRef || paymentConfirmationNumber,
            pricing_snapshot: orderData.pricing_snapshot,
            service_type: orderData.service_type,
            status: "pending",
            created_at: new Date().toISOString(),
            installation_type: orderData.installation_type,
            delivery_method: orderData.delivery_method,
            appointment_date: orderData.appointment_date,
            appointment_time: orderData.appointment_time,
            shipping_address: orderData.shipping_address,
            shipping_city: orderData.shipping_city,
            shipping_province: orderData.shipping_province,
            shipping_postal_code: orderData.shipping_postal_code,
          },
        },
      });
    },
    onError: (error: any) => {
      console.error("[ClientNewOrder] Order creation error:", error);

      // ★ TRACEABILITY: Log order failure
      logOrderFailed({
        error_message: error?.message || "Unknown error",
        error_code: error?.code || error?.status?.toString(),
        metadata: { raw: String(error).slice(0, 500) },
      });
      
      // Parse error for user-friendly message
      let errorMessage = "Erreur lors de la soumission de la commande";
      // Use telco-grade error mapping
      const mapped = mapBillingError(error);
      
      toast.error(mapped.title, {
        description: mapped.description,
        duration: 10000,
      });
    },
    onSettled: () => {
      // Always unlock UI totals + reset guard so user can retry if it truly failed
      setLockedUiTotals(null);
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
  const mobileMonthlyTotal = toMoney(selectedMobileServices.reduce((sum, s) => {
    const qty = mobileLineQuantities[s.id] || 1;
    return sum + (toMoney(s.price) * qty);
  }, 0));

  // Calculate totals with fees and taxes based on installation/delivery choice
  // For mobile, multiply each plan by its quantity
  const subtotal = toMoney(selectedServices.reduce((sum, s) => {
    if (s.category === "Mobile") {
      const qty = mobileLineQuantities[s.id] || 1;
      return sum + (toMoney(s.price) * qty);
    }
    return sum + toMoney(s.price);
  }, 0));
  const paidChannelTotal = toMoney(selectedPaidChannels.reduce((sum, ch) => sum + toMoney(ch.price), 0));
  // Streaming+ add-ons monthly total
  const streamingAddonsTotal = toMoney(selectedStreamingServices.reduce((sum, s) => sum + toMoney(s.monthly_price), 0));
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
    // For Internet, TV, Security - use installation choice (canonical fee)
    return installationChoice === "auto" ? (canonicalFees.deliverySelfInstall || 30) : 0;
  };
  
  const deliveryFee = calculateDeliveryFee();
  // Activation fee from canonical operational_fees
  const activationFee = calculateActivationFee();
  // IMPORTANT: Promo discounts are applied via promoDiscount (discount_amount) below.
  // Do not also subtract an installationCredit here, otherwise the promo is applied twice.
  const installationFee = (!isDeliveryOnlyOrder && installationChoice === "technician") ? (canonicalFees.installationTechnician || 50) : 0;
  
  // Calculate one-time fees vs monthly fees (include Streaming+ add-ons)
  const oneTimeFeesGross = deliveryFee + activationFee + installationFee + terminalFee + routerFee + simFee;
  const monthlyRecurring = subtotal + paidChannelTotal + streamingAddonsTotal;
  
  // No auto-credits for SIM cards - clients pay full price
  const simCreditAmount = 0;
  const simDeliveryCreditAmount = 0;
  
  // One-time fees (no auto-credits applied)
  const oneTimeFees = oneTimeFeesGross;
  
  // Apply promo discount to base amount
  // IMPORTANT: discount_amount is computed server-side on eligible items.
  // To avoid stale discounts when the cart changes, we revalidate the promo (see useEffect below)
  // instead of guessing the discount client-side.
  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

  // ═══ ALL DISCOUNT VALUES ARE SERVER-AUTHORITATIVE ═══
  // NEVER use appliedPromo.discount_amount for display or calculation.
  // The RPC compute_checkout_pricing is the single source of truth for:
  //   - promo_discount (actual applied promo amount, 0 if blocked)
  //   - welcome_discount (50% new customer, 0 if not eligible)
  //   - discount_total_combined (sum of both, no stacking)
  const serverPromoDiscount = toNonNegativeMoney(liveServerPricing?.promo_discount ?? 0);
  const welcomeDiscountAmount = toNonNegativeMoney(liveServerPricing?.welcome_discount ?? 0);
  const hasWelcomeDiscountAlreadyApplied = welcomeDiscountAmount > 0 || !!liveServerPricing?.welcome_applied;
  const promoDiscount = serverPromoDiscount; // alias for backward compat

  // Total discount from server (promo + welcome, mutually exclusive / no stacking)
  const totalDiscount = toNonNegativeMoney(liveServerPricing?.discount_total_combined ?? 0);

  // Check if promo was blocked by the RPC (e.g., welcome discount takes priority)
  const promoBlockedReason = liveServerPricing?.promo_applied?.blocked_reason as string | undefined;
  const isPromoBlocked = !!promoBlockedReason;

  // Client-side fallback values removed — unified pricing object below is the single source of truth

  // Keep promo discount accurate when the cart changes (prevents “97% => 0$” stale/cap bugs)
  useEffect(() => {
    if (!appliedPromo?.code) return;
    if (isValidatingPromo) return;

    const payload = buildPromoValidationPayload(appliedPromo.code);
    if (!payload) return;

    // If cart signature hasn't changed since last validation, skip
    if (payload.signature === promoCartSignatureRef.current) return;

    // Silent revalidation (no success toast)
    void validateAndApplyPromo(appliedPromo.code, {
      silent: true,
      allowExistingCodeRevalidation: true,
    });
  }, [
    appliedPromo?.code,
    isValidatingPromo,
    selectedServices,
    selectedMobileServices,
    selectedPaidChannels,
    selectedStreamingServices,
    mobileLineQuantities,
    terminalQuantity,
    deliveryChoice,
    installationChoice,
    installationCredit,
    isDeliveryOnlyOrder,
    isEquipmentOnlyOrder,
    hasTVService,
    hasInternetService,
    hasMobileService,
    totalMobileLineQuantity,
    profile?.email,
    user?.id,
  ]);

  // === UNIFIED CHECKOUT PRICING — SINGLE AUTHORITATIVE OBJECT ===
  // CRITICAL: liveServerPricing (from compute_checkout_pricing RPC) is the SOLE authority
  // for pricing display. nivraCoreOrderPricing (from Nivra API) is ONLY used for
  // order/invoice/payment reference numbers — NEVER for amounts, because the Nivra API
  // returns gross totals that don't reflect discounts applied by the RPC.
  const normalizedLivePricing = liveServerPricing ? normalizeServerPricingResult(liveServerPricing) : null;

  const authoritativePricing = normalizedLivePricing
    ? {
        subtotal: normalizedLivePricing.taxable_base,
        gst: normalizedLivePricing.tps_amount,
        qst: normalizedLivePricing.tvq_amount,
        total: normalizedLivePricing.grand_total,
        // Reference numbers come from Nivra Core response (if available)
        orderNumber: nivraCoreOrderPricing?.order_number ?? undefined,
        invoiceNumber: nivraCoreOrderPricing?.invoice_number ?? undefined,
        paymentNumber: nivraCoreOrderPricing?.payment_number ?? undefined,
      }
    : {
        subtotal: 0,
        gst: 0,
        qst: 0,
        total: 0,
      };

  const { taxableBase: todayTaxableBase, tps: todayTps, tvq: todayTvq } = sanitizeTaxes(
    authoritativePricing?.subtotal ?? 0,
    authoritativePricing?.gst ?? 0,
    authoritativePricing?.qst ?? 0,
  );
  const todayTotal = toNonNegativeMoney(authoritativePricing?.total ?? 0);
  const authoritativeOneTimeSubtotal = toNonNegativeMoney(normalizedLivePricing?.one_time_subtotal ?? oneTimeFees);
  const authoritativeRecurringSubtotal = toNonNegativeMoney(normalizedLivePricing?.recurring_subtotal ?? monthlyRecurring);
  const firstInvoiceRecurringNet = toNonNegativeMoney(authoritativeRecurringSubtotal - totalDiscount);

  // === MONTHLY RECURRING WITH TAX (display only — from centralized server tax engine) ===
  const { tps: monthlyTps, tvq: monthlyTvq, total: monthlyTotalWithTax } = estimateMonthlyTaxes(monthlyRecurring);

  // ── SINGLE UI SOURCES OF TRUTH (locked during submission) ───────────────────
  // Monthly totals are pure local computations (from selectedServices) and NEVER change
  // during submission — no locking needed. Only todayTotal needs locking because
  // liveServerPricing can refresh mid-flight.
  const isUiLocked = createOrderMutation.isPending && !!lockedUiTotals;
  const uiTodayTotal = isUiLocked ? lockedUiTotals!.todayTotal : todayTotal;
  const capturedPaymentAmount = isUiLocked
    ? lockedUiTotals!.capturedPaymentAmount
    : todayTotal;

  // All display values come exclusively from authoritativePricing.
  // These aliases exist ONLY for backward-compat in the order-submission function
  // where serverPricing (Nivra Core response) is the authoritative source.
  // DO NOT use these for UI display — use authoritativePricing directly.

  // === LIVE PRICING: call server-side computeCheckoutPricing RPC ===
  useEffect(() => {
    // Freeze live pricing while the order is being submitted to prevent any late refresh
    // from changing the UI totals mid-confirmation.
    if (createOrderMutation.isPending || submittingRef.current) {
      if (serverPricingTimerRef.current) {
        clearTimeout(serverPricingTimerRef.current);
        serverPricingTimerRef.current = null;
      }
      return;
    }

    if (selectedServices.length === 0 && selectedStreamingServices.length === 0) {
      setLiveServerPricing(null);
      return;
    }

    if (serverPricingTimerRef.current) clearTimeout(serverPricingTimerRef.current);

    serverPricingTimerRef.current = setTimeout(async () => {
      setIsServerPricingLoading(true);
      try {
        const { computeCheckoutPricing } = await import("@/lib/pricing/serverPricing");
        const cartItems: import("@/lib/pricing/serverPricing").CartLineItem[] = [];

        // Add recurring services
        selectedServices.forEach(s => {
          const qty = s.category === "Mobile" ? (mobileLineQuantities[s.id] || 1) : 1;
          cartItems.push({ type: "service", name: s.name, amount: toMoney(s.price), quantity: qty });
        });

        // Add paid TV channels
        selectedPaidChannels.forEach(ch => {
          cartItems.push({ type: "service", name: ch.name, amount: toMoney(ch.price), quantity: 1 });
        });

        // Add streaming add-ons
        selectedStreamingServices.forEach(s => {
          cartItems.push({ type: "service", name: s.name, amount: toMoney(s.monthly_price), quantity: 1 });
        });

        // Add one-time fees
        if (activationFee > 0) cartItems.push({ type: "activation", name: "Frais d'activation", amount: activationFee });
        if (deliveryFee > 0) cartItems.push({ type: "delivery", name: "Frais de livraison", amount: deliveryFee });
        if (installationFee > 0) cartItems.push({ type: "installation", name: "Frais d'installation", amount: installationFee });
        if (routerFee > 0) cartItems.push({ type: "equipment", name: "Routeur", amount: routerFee });
        if (terminalFee > 0) cartItems.push({ type: "equipment", name: "Terminal TV", amount: terminalFee });
        if (simFee > 0) cartItems.push({ type: "equipment", name: "Carte SIM", amount: simFee });

        // Effective promo code: promo takes priority; if no promo but referral has discount, use referral
        const effectivePromoCode = appliedPromo?.code || ((appliedReferral?.discount_amount ?? 0) > 0 ? appliedReferral?.code : null) || null;
        
        const result = await computeCheckoutPricing(
          cartItems,
          effectivePromoCode,
          profile?.email || user?.email || null,
          user?.id || null,
          acceptPreauthorized ? 5 : 0,
        );
        console.log("[LivePricing] Server RPC response:", result);
        setLiveServerPricing(result);
      } catch (err) {
        console.error("[LivePricing] RPC error:", err);
      } finally {
        setIsServerPricingLoading(false);
      }
    }, 400);

    return () => {
      if (serverPricingTimerRef.current) clearTimeout(serverPricingTimerRef.current);
    };
  }, [
    selectedServices, selectedStreamingServices, selectedPaidChannels,
    mobileLineQuantities, activationFee, deliveryFee, installationFee,
    terminalFee, routerFee, simFee,
    acceptPreauthorized, appliedPromo?.code, appliedReferral?.code, appliedReferral?.discount_amount,
    profile?.email, user?.email, user?.id,
    createOrderMutation.isPending,
  ]);

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

  // Check if installation appointment is required (disabled in checkout flow)
  const requiresInstallation = INSTALLATION_APPOINTMENT_ENABLED && installationChoice === "technician" && selectedServices.some(s => ["Internet", "TV", "Sécurité"].includes(s.category));
  
  // Check if ID details are complete
  const isIdComplete = idType && idNumber && idExpiration && idProvince;
  
  // Check if payment is complete (paymentComplete is the authoritative flag, set only after valid confirmation)
  const isPaymentComplete = paymentComplete || 
    (paymentMethod === "paypal" && !!paypalCaptureId);
  
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
    
    // CRITICAL: DOB resolution — profile is the source of truth (locked field)
    // Priority: profile.date_of_birth > local dateOfBirth state
    const profileDob = profile?.date_of_birth?.trim() || "";
    let effectiveDob = profileDob || dateOfBirth?.trim() || "";
    
    if (effectiveDob && effectiveDob !== dateOfBirth) {
      setDateOfBirth(effectiveDob);
      console.log("[ClientNewOrder] DOB resolved from profile at submission:", effectiveDob);
    }
    
    // If DOB exists in profile, it was already validated at identity verification time — skip re-validation
    // Only validate if DOB comes from local state (not profile)
    if (!effectiveDob) {
      submittingRef.current = false;
      toast.error("La date de naissance est requise pour passer une commande");
      return;
    }
    
    // Only run format/age validation if DOB is NOT from the verified profile
    // Profile DOB is immutable and was validated at registration/identity verification
    if (!profileDob) {
      try {
        const parsed = parseISO(effectiveDob);
        if (!isValid(parsed)) {
          submittingRef.current = false;
          toast.error("Format de date invalide. Utilisez AAAA-MM-JJ.");
          return;
        }
        
        const dobResult = validateDob(effectiveDob, { minAge: MIN_AGE_TELECOM, required: true });
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
    }
    
    if (selectedServices.length === 0 && selectedStreamingServices.length === 0) {
      submittingRef.current = false;
      toast.error("Veuillez sélectionner au moins un service ou un forfait Streaming+");
      return;
    }
    if (!isIdComplete) {
      submittingRef.current = false;
      toast.error("Veuillez remplir tous les champs d'identification");
      return;
    }
    // BLOCK if QR identity verification not submitted (docs must be submitted for review)
    if (!idVerificationApproved || !verificationSessionId) {
      submittingRef.current = false;
      toast.error("Vérification d'identité QR requise avant de soumettre la commande.");
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
      if (requiresInstallation && !appointmentConfirmed) {
        submittingRef.current = false;
        toast.error("Veuillez confirmer le rendez-vous d'installation");
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

    // Lock UI totals during submission to prevent any mid-flight live pricing refresh
    // from changing the displayed amounts (e.g., 109,23$ -> 183,96$).
    setLockedUiTotals({
      monthlyRecurringWithTax: monthlyTotalWithTax,
      todayTotal,
      capturedPaymentAmount: todayTotal,
    });

    // Stop any scheduled live pricing refresh while we submit
    if (serverPricingTimerRef.current) {
      clearTimeout(serverPricingTimerRef.current);
      serverPricingTimerRef.current = null;
    }

    createOrderMutation.mutate();
  };


  // Dynamic checkout steps based on service selection
  const checkoutSteps = (() => {
    const steps = [{ id: 1, labelFr: "Services", labelEn: "Services" }];
    let stepNum = 2;
    if (hasTVService) {
      steps.push({ id: stepNum++, labelFr: "Chaînes TV", labelEn: "TV Channels" });
    }
    if (hasMobileService) {
      steps.push({ id: stepNum++, labelFr: "Transfert", labelEn: "Transfer" });
    }
    steps.push({ id: stepNum++, labelFr: "Adresse & Installation", labelEn: "Address & Installation" });
    steps.push({ id: stepNum++, labelFr: "Paiement", labelEn: "Payment" });
    steps.push({ id: stepNum++, labelFr: "Confirmation", labelEn: "Confirmation" });
    return steps;
  })();

  return (
    <ClientLayout>
      <div className="min-h-screen bg-white -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
        {/* Show loading while hydrating to prevent step guards from triggering */}
        {!isHydrated ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            <span className="ml-3 text-slate-500">Chargement...</span>
          </div>
        ) : (
          <>
            {/* Page Title - Rogers "Caisse" */}
            <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-8">Caisse</h1>

            {/* Progress Steps - Rogers style */}
            <CheckoutProgress
              currentStep={step}
              steps={checkoutSteps}
              isFrench={true}
              onStepClick={(s) => s < step && setStep(s)}
            />

        {/* Step 1: Service Selection - Professional 2-Column Layout */}
        {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Left Column: Service Selection */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
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
                                        <span className="text-muted-foreground">+ Frais d'activation ({countServiceTypes() >= 2 ? "forfait groupé" : "1 service"})</span>
                                        <span className="text-muted-foreground">{activationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
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

              {/* Spacer for fixed bottom bar on mobile */}
              {(selectedServices.length > 0 || selectedStreamingServices.length > 0) && <div className="lg:hidden h-28" />}

              {/* Mobile Order Summary — visible only on mobile when services selected */}
              {(selectedServices.length > 0 || selectedStreamingServices.length > 0) && (
                <div className="lg:hidden mt-4">
                  <ProfessionalOrderSummary
                    pricing={authoritativePricing}
                    isLoading={isServerPricingLoading}
                    isMobile
                    selectedServicesCount={selectedServices.length + selectedStreamingServices.length}
                    onContinue={() => setStep(2)}
                    continueDisabled={selectedServices.length === 0 && selectedStreamingServices.length === 0}
                  />
                </div>
              )}
            </div>

            {/* Right Column: Professional Order Summary (Sticky) */}
            <div className="hidden lg:block lg:col-span-5 xl:col-span-4">
              <div className="sticky top-6">
                <ProfessionalOrderSummary
                  pricing={authoritativePricing}
                  isLoading={isServerPricingLoading}
                  selectedServicesCount={selectedServices.length + selectedStreamingServices.length}
                  onContinue={() => setStep(2)}
                  continueDisabled={selectedServices.length === 0 && selectedStreamingServices.length === 0}
                />
                <SecurityTrustBox isFrench={true} />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Channel Selection (Only for TV orders) */}
        {step === 2 && hasTVService && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
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

            {/* Spacer for fixed bottom bar on mobile */}
            <div className="lg:hidden h-36" />

            {/* Channel Selection Summary */}
            <div className="hidden lg:block lg:col-span-5 xl:col-span-4">
              <div className="sticky top-6">
              <Card className="bg-white border border-slate-200 rounded-lg">
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
              <SecurityTrustBox isFrench={true} />
              </div>
            </div>
          </div>
        )}

        {/* Step 2 (no TV) or Step 3 (with TV): Mobile Transfer Eligibility */}
        {((step === 2 && !hasTVService && hasMobileService) || (step === 3 && hasTVService && hasMobileService)) && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Phone className="w-5 h-5 text-primary" />
                    Transfert de numéro mobile
                  </CardTitle>
                  <CardDescription>
                    Souhaitez-vous transférer votre numéro actuel ou obtenir un nouveau numéro québécois?
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Choice selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Transfer option */}
                    <Card
                      className={`cursor-pointer transition-all ${
                        mobileTransferChoice === "transfer"
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => {
                        setMobileTransferChoice("transfer");
                        setTransferValidationResult(null);
                      }}
                    >
                      <CardContent className="p-5 text-center">
                        <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3 ${
                          mobileTransferChoice === "transfer" ? "bg-primary text-primary-foreground" : "bg-muted"
                        }`}>
                          <ArrowRight className="w-6 h-6" />
                        </div>
                        <h3 className="font-semibold text-foreground">Transférer votre numéro actuel</h3>
                        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                          Conservez votre numéro actuel. Nous effectuerons le transfert auprès de votre fournisseur lors de l'activation de votre service.
                        </p>
                      </CardContent>
                    </Card>

                    {/* New number option */}
                    <Card
                      className={`cursor-pointer transition-all ${
                        mobileTransferChoice === "new"
                          ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/20"
                          : "border-border hover:border-emerald-500/50"
                      }`}
                      onClick={handleNewNumberSelection}
                    >
                      <CardContent className="p-5 text-center">
                        <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3 ${
                          mobileTransferChoice === "new" ? "bg-emerald-500 text-white" : "bg-muted"
                        }`}>
                          <Plus className="w-6 h-6" />
                        </div>
                        <h3 className="font-semibold text-foreground">Obtenir un nouveau numéro québécois</h3>
                        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                          Un numéro québécois disponible sera automatiquement attribué lors de l'activation de votre service.
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Transfer flow */}
                  {mobileTransferChoice === "transfer" && (
                    <div className="space-y-5 pt-5 border-t border-border">
                      {/* Transfer steps explanation */}
                      <div className="p-4 rounded-lg bg-muted/50 border border-border">
                        <h4 className="text-sm font-semibold text-foreground mb-3">Étapes du transfert :</h4>
                        <ol className="space-y-2 text-sm text-muted-foreground">
                          <li className="flex items-start gap-2.5">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                            Entrez le numéro à transférer
                          </li>
                          <li className="flex items-start gap-2.5">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                            Sélectionnez votre fournisseur actuel
                          </li>
                          <li className="flex items-start gap-2.5">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                            Fournissez les informations de votre compte
                          </li>
                          <li className="flex items-start gap-2.5">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">4</span>
                            Le transfert sera effectué lors de l'activation
                          </li>
                        </ol>
                      </div>

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

                      {/* Reassurance message */}
                      <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                        <div className="flex items-start gap-2">
                          <Shield className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-muted-foreground">
                            Votre service actuel restera actif jusqu'à la complétion du transfert.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* New number confirmation */}
                  {mobileTransferChoice === "new" && (
                    <div className="space-y-4 pt-5 border-t border-border">
                      <Card className="bg-emerald-500/5 border-emerald-500/30">
                        <CardContent className="py-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            <p className="font-semibold text-emerald-600">Nouveau numéro québécois</p>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            Un numéro québécois disponible sera automatiquement attribué lors de l'activation de votre service.
                          </p>
                          <ul className="text-sm text-muted-foreground space-y-1.5 mt-2">
                            <li className="flex items-start gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                              Indicatif régional attribué selon votre adresse ou préférence
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                              Numéro final confirmé lors de l'activation
                            </li>
                            <li className="flex items-start gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                              Aucun frais pour l'attribution du numéro
                            </li>
                          </ul>
                        </CardContent>
                      </Card>

                      {/* Area code preference */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Indicatif régional préféré (optionnel)</Label>
                        <p className="text-xs text-muted-foreground">Nous tenterons d'attribuer un numéro avec l'indicatif de votre choix selon la disponibilité.</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {["514", "438", "450", "819", "873"].map((code) => (
                            <button
                              key={code}
                              type="button"
                              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                                preferredAreaCode === code
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-background text-muted-foreground hover:border-primary/50"
                              }`}
                              onClick={() => setPreferredAreaCode(preferredAreaCode === code ? "" : code)}
                            >
                              ({code})
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Information block */}
              <Card className="bg-muted/30 border-border">
                <CardContent className="py-5 space-y-4">
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <Info className="w-4 h-4 text-primary" />
                    Comment fonctionne l'attribution ou le transfert de numéro
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      <span><strong className="text-foreground">Nouveau numéro :</strong> attribué automatiquement lors de l'activation du service</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      <span><strong className="text-foreground">Transfert de numéro :</strong> traité auprès de votre fournisseur actuel</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      Votre service actuel demeure actif jusqu'au transfert complet
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      Le transfert peut prendre entre 30 minutes et 2 heures après activation
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Visual process timeline */}
              <div className="flex items-center justify-between px-2 py-4">
                {[
                  { label: "Commande", active: true },
                  { label: "Vérification", active: false },
                  { label: "Activation", active: false },
                  { label: mobileTransferChoice === "transfer" ? "Transfert complété" : "Numéro attribué", active: false },
                ].map((timelineStep, idx, arr) => (
                  <div key={idx} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        timelineStep.active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {idx + 1}
                      </div>
                      <span className="text-[11px] text-muted-foreground mt-1.5 text-center max-w-[80px] leading-tight">{timelineStep.label}</span>
                    </div>
                    {idx < arr.length - 1 && (
                      <div className="flex-1 h-px bg-border mx-2 mt-[-16px]" />
                    )}
                  </div>
                ))}</div>

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

            {/* Spacer for fixed bottom bar on mobile */}
            <div className="lg:hidden h-36" />

            {/* Mobile Transfer Summary */}
            <div className="hidden lg:block lg:col-span-5 xl:col-span-4">
              <div className="sticky top-6">
              <Card className="bg-white border border-slate-200 rounded-lg">
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
              <SecurityTrustBox isFrench={true} />
              </div>
            </div>
          </div>
        )}

        {/* Verification Step */}
        {((step === 2 && !hasTVService && !hasMobileService) || 
          (step === 3 && hasMobileService && !hasTVService) ||
          (step === 3 && hasTVService && !hasMobileService) ||
          (step === 4 && hasTVService && hasMobileService)) && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
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

              {/* ——— SECTION 1: Contact + Service Address ——— */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-cyan-500" />
                    Coordonnées et adresse de service
                  </CardTitle>
                  <CardDescription>
                    Téléphone de contact et adresse où les services seront installés.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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

                    {hasResidentialService && user?.id && (
                      <CheckoutAddressStep
                        userId={user.id}
                        category={checkoutAddressCategory}
                        selectedAddressId={selectedAddressId}
                        onAddressSelected={(addressId, addressLine, city, postalCode) => {
                          setSelectedAddressId(addressId);
                          setServiceAddressStreet(addressLine || "");
                          setServiceAddressCity(city || "");
                          setServiceAddressPostalCode(postalCode || "");
                        }}
                      />
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2 space-y-2">
                        <Label htmlFor="service-address">Adresse (numéro + rue) <span className="text-destructive">*</span></Label>
                        <AddressAutocomplete
                          value={serviceAddressStreet}
                          onValueChange={(value) => setServiceAddressStreet(value)}
                          onSelect={(details: AddressValue) => {
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

                  {/* Address complete indicator */}
                  {serviceAddressStreet && serviceAddressCity && serviceAddressPostalCode.replace(/\s/g, "").length === 6 && (
                    <div className="flex items-center gap-2 text-sm text-emerald-500 p-3 bg-emerald-500/10 rounded-lg">
                      <CheckCircle2 className="w-4 h-4" />
                      Adresse de service complétée
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
                <InstallationSection
                  installationChoice={installationChoice}
                  onInstallationChoiceChange={(choice) => setInstallationChoice(choice)}
                  selectedDate={selectedDate}
                  selectedTime={selectedTime}
                  onDateTimeChange={(date, time) => {
                    setSelectedDate(date);
                    setSelectedTime(time);
                  }}
                  appointmentConfirmed={appointmentConfirmed}
                  onAppointmentConfirmedChange={(confirmed) => setAppointmentConfirmed(confirmed)}
                  onDecisionMade={(decision) => {
                    console.log("[Checkout] Installation decision:", decision);
                  }}
                />
              )}

              {/* ——— SECTION 4: Identity (read-only / locked) ——— */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-cyan-500" />
                    Identité du titulaire
                  </CardTitle>
                  <CardDescription>
                    🔒 Vos informations d'identité sont verrouillées pour votre sécurité. Pour les modifier, contactez le support.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first-name">Prénom</Label>
                      <Input
                        id="first-name"
                        value={firstName}
                        readOnly
                        disabled
                        className="bg-muted/50 cursor-not-allowed"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last-name">Nom de famille</Label>
                      <Input
                        id="last-name"
                        value={lastName}
                        readOnly
                        disabled
                        className="bg-muted/50 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date-of-birth" className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      Date de naissance
                    </Label>
                    <Input
                      id="date-of-birth"
                      type="date"
                      value={profile?.date_of_birth || dateOfBirth}
                      readOnly
                      disabled
                      className="bg-muted/50 cursor-not-allowed"
                    />
                    {(profile?.date_of_birth || dateOfBirth) && (() => {
                      const displayDob = profile?.date_of_birth || dateOfBirth;
                      // If DOB comes from verified profile, always show as valid (already validated)
                      if (profile?.date_of_birth) {
                        return (
                          <p className="text-xs text-emerald-500 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Âge vérifié
                          </p>
                        );
                      }
                      try {
                        const parsed = parseISO(displayDob);
                        if (!isValid(parsed)) {
                          return (
                            <p className="text-xs text-destructive flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Date invalide
                            </p>
                          );
                        }
                        const result = validateDob(displayDob, { minAge: MIN_AGE_TELECOM });
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
                        return (
                          <p className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Date invalide
                          </p>
                        );
                      }
                    })()}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg">
                    <Shield className="w-4 h-4 flex-shrink-0" />
                    Ces informations proviennent de votre profil vérifié et ne peuvent pas être modifiées dans le checkout.
                  </div>
                </CardContent>
              </Card>

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

                    {/* QR Identity Verification — strict KYC policy, no silent bypass */}
                    {isIdComplete && FEATURES.KYC_ENABLED && (
                      <div className="border-t border-border pt-6 mt-4">
                        {/* Case 1: User chose "reuse" and session is approved/submitted → show confirmation */}
                        {kycChoice === "reuse" && idVerificationApproved && verificationSessionId ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                              <div>
                                <p className="font-medium text-emerald-600">
                                  {existingKycStatus === "approved" 
                                    ? "Vérification d'identité approuvée ✓" 
                                    : "Vérification d'identité soumise ✓"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {existingKycStatus === "approved"
                                    ? "Votre identité est vérifiée. Vous pouvez continuer."
                                    : "Documents soumis — en vérification par un administrateur."}
                                </p>
                              </div>
                            </div>
                            <button 
                              type="button"
                              className="text-xs text-muted-foreground underline hover:text-foreground"
                              onClick={() => {
                                setKycChoice(null);
                                localStorage.removeItem('nivra_kyc_choice');
                                setIdVerificationApproved(false);
                                setVerificationSessionId(null);
                              }}
                            >
                              Changer de vérification
                            </button>
                          </div>
                        ) : existingKycStatus && existingKycStatus !== "created" && kycChoice === null ? (
                          /* Case 2: Existing non-created session, user hasn't chosen → show choice */
                          <KycSessionChoice
                            sessionStatus={existingKycStatus}
                            sessionId={verificationSessionId || ""}
                            caseNumber={existingKycCaseNumber || undefined}
                            onChoice={(choice) => {
                              setKycChoice(choice);
                              localStorage.setItem('nivra_kyc_choice', choice || '');
                              if (choice === "reuse") {
                                // Reuse: restore the session from DB — only if docs exist
                                supabase
                                  .from("identity_verification_sessions")
                                  .select("id, status, document_front_path")
                                  .eq("user_id", user?.id || "")
                                  .in("status", ["submitted", "manual_review", "approved"])
                                  .order("created_at", { ascending: false })
                                  .limit(1)
                                  .maybeSingle()
                                  .then(({ data }) => {
                                    if (data && data.document_front_path) {
                                      setVerificationSessionId(data.id);
                                      localStorage.setItem('nivra_kyc_session_id', data.id);
                                      setIdVerificationApproved(true);
                                    } else {
                                      // No documents → force restart
                                      toast.error("Aucun document trouvé. Veuillez soumettre de nouveaux documents.");
                                      setKycChoice("restart");
                                      localStorage.setItem('nivra_kyc_choice', 'restart');
                                      localStorage.removeItem('nivra_kyc_session_id');
                                      setVerificationSessionId(null);
                                      setIdVerificationApproved(false);
                                    }
                                  });
                              } else if (choice === "restart") {
                                localStorage.removeItem('nivra_kyc_session_id');
                                setVerificationSessionId(null);
                                setIdVerificationApproved(false);
                              }
                            }}
                          />
                        ) : (
                          /* Case 3: No existing session OR user chose "restart" → show QR flow */
                          <QRVerificationStep
                            userId={user?.id || ""}
                            checkoutType="mobile"
                            isFrench={true}
                            onSessionGenerated={(sessionId) => {
                              setVerificationSessionId(sessionId);
                              localStorage.setItem('nivra_kyc_session_id', sessionId);
                              setIdVerificationApproved(false);
                            }}
                            onVerified={(sessionId) => {
                              setVerificationSessionId(sessionId);
                              localStorage.setItem('nivra_kyc_session_id', sessionId);
                              setIdVerificationApproved(true);
                            }}
                            orderContext={{ services: selectedServices.map(s => s.id) }}
                            checkoutFields={{
                              first_name: firstName || "",
                              last_name: lastName || "",
                              date_of_birth: dateOfBirth || "",
                              document_number: idNumber || "",
                              expiry_date: idExpiration || "",
                              document_type: idType || "",
                              issuing_region: idProvince || "",
                            }}
                          />
                        )}
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

              {/* ═══ REFERRAL CODE (Code de parrainage) ═══ */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Gift className="w-4 h-4" />
                    Code de parrainage
                  </CardTitle>
                  <CardDescription>Un proche vous a recommandé Nivra?</CardDescription>
                </CardHeader>
                <CardContent>
                  <ReferralCodeInput
                    clientEmail={profile?.email || user?.email || ""}
                    clientId={user?.id}
                    cartItems={buildPromoValidationPayload(discountCode || "PLACEHOLDER").cartItems}
                    subtotalBeforeDiscount={buildPromoValidationPayload(discountCode || "PLACEHOLDER").subtotalBeforeDiscount}
                    appliedReferral={appliedReferral}
                    onReferralApplied={setAppliedReferral}
                    hasActivePromoDiscount={serverPromoDiscount > 0 || hasWelcomeDiscountAlreadyApplied}
                    disabled={createOrderMutation.isPending}
                  />
                </CardContent>
              </Card>

              {/* ═══ PROMO CODE (Code promotionnel) ═══ */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Code promotionnel</CardTitle>
                  <CardDescription>Avez-vous un code de réduction?</CardDescription>
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
                          {serverPromoDiscount > 0 ? (
                            <>
                              <p className="font-bold text-emerald-500">-{serverPromoDiscount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</p>
                              <p className="text-xs text-muted-foreground">
                                {appliedPromo.discount_type === 'percent' ? `${appliedPromo.discount_value}%` : 'Montant fixe'}
                              </p>
                            </>
                          ) : (
                            <p className="text-xs text-amber-500">{PROMO_SINGLE_DISCOUNT_MESSAGE}</p>
                          )}
                        </div>
                      </div>
                      {/* Overlap message: referral also has discount */}
                      {appliedReferral && (appliedReferral.discount_amount ?? 0) > 0 && serverPromoDiscount > 0 && (
                        <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 border border-amber-200">
                          <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-amber-700">
                            Le rabais de votre code de parrainage n'est pas cumulable avec cette promotion. Le code de parrainage reste enregistré pour le suivi.
                          </p>
                        </div>
                      )}
                      <Button variant="ghost" size="sm" onClick={removePromo} className="text-destructive">
                        Retirer le code promo
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Entrez votre code promo"
                          value={discountCode}
                          onChange={(e) => {
                            setDiscountCode(e.target.value);
                            if (promoValidationError) setPromoValidationError(null);
                          }}
                          disabled={isValidatingPromo || hasWelcomeDiscountAlreadyApplied}
                        />
                        <Button
                          variant="outline"
                          onClick={applyDiscountCode}
                          disabled={isValidatingPromo || hasWelcomeDiscountAlreadyApplied}
                        >
                          {isValidatingPromo ? "..." : "Appliquer"}
                        </Button>
                      </div>
                      {hasWelcomeDiscountAlreadyApplied && (
                        <p className="text-xs text-amber-500">{PROMO_SINGLE_DISCOUNT_MESSAGE}</p>
                      )}
                      {promoValidationError && (
                        <p className="text-xs text-destructive">{promoValidationError}</p>
                      )}
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

            {/* Spacer for fixed bottom bar on mobile */}
            <div className="lg:hidden h-36" />

            <div className="hidden lg:block lg:col-span-5 xl:col-span-4">
              <div className="sticky top-6">
              <Card className="bg-white border border-slate-200 rounded-lg">
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
                  
                    <div className="border-t border-border pt-3">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-foreground">Total mensuel estimé</span>
                        <span className="font-bold text-lg text-cyan-500">
                          {monthlyTotalWithTax.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Services récurrents, taxes incluses</p>
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
                  </div>
                  
                  {/* One-Time Fees Subtotal - NEVER show negative */}
                  <div className="border-t border-border pt-3">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-foreground">Frais uniques estimés</span>
                      <span className="font-bold text-foreground">
                        {authoritativeOneTimeSubtotal.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Équipements, livraison, activation</p>
                  </div>

                  {/* ── SECTION C: Paiement aujourd'hui ── */}
                  <div className="border-t border-border pt-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Paiement aujourd'hui</p>
                    
                    {/* One-time fees subtotal */}
                    {authoritativeOneTimeSubtotal > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Frais uniques</span>
                        <span className="text-foreground">{authoritativeOneTimeSubtotal.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}

                    {/* First month recurring — show gross then discount line */}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Services 1er mois</span>
                      <span className={totalDiscount > 0 ? "text-muted-foreground line-through" : "text-foreground"}>{authoritativeRecurringSubtotal.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    {totalDiscount > 0 && (
                      <>
                        <div className="flex justify-between text-sm text-emerald-500 font-medium">
                          <span>Rabais{appliedPromo ? ` (${appliedPromo.code})` : welcomeDiscountAmount > 0 ? " nouveau client" : ""}</span>
                          <span>-{totalDiscount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                        </div>
                        <div className="flex justify-between text-sm font-medium">
                          <span className="text-muted-foreground">Net 1er mois après rabais</span>
                          <span className="text-foreground">{firstInvoiceRecurringNet.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Taxes — on today's taxable base (one-time + discounted recurring) */}
                  <div className="border-t border-border pt-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">TPS (5%)</span>
                      <span className="text-foreground">{todayTps.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">TVQ (9.975%)</span>
                      <span className="text-foreground">{todayTvq.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                  </div>

                  {/* Total Due Today — unified: one-time + discounted recurring + taxes */}
                  <div className="border-t-2 border-cyan-500/50 pt-4 bg-gradient-to-r from-cyan-500/5 to-transparent -mx-6 px-6 pb-2 rounded-b-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-foreground">Total à payer aujourd'hui</span>
                      <span className="text-2xl font-bold text-cyan-500">
                        {uiTodayTotal.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Frais uniques + 1er mois, taxes incluses</p>
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
                            // For installation orders, need ID + installation choice + confirmed technician appointment
                            : (!isIdComplete || !installationChoice || (requiresInstallation && (!selectedDate || !selectedTime || !appointmentConfirmed)))
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
              <SecurityTrustBox isFrench={true} />
              </div>
            </div>
          </div>
        )}

        {/* Final Confirmation Step - Dynamic based on service selection */}
        {((step === 3 && !hasTVService && !hasMobileService) ||
          (step === 4 && ((hasTVService && !hasMobileService) || (hasMobileService && !hasTVService))) ||
          (step === 5 && hasTVService && hasMobileService)) && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
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
                      <span>{authoritativeOneTimeSubtotal.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    
                    {/* First month recurring breakdown */}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mensuel (1er mois)</span>
                      <span>{authoritativeRecurringSubtotal.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    
                    {/* Show all applicable discounts — SERVER-SIDE values only */}
                    {(liveServerPricing?.welcome_applied || welcomeDiscountAmount > 0) && (
                      <div className="flex justify-between text-emerald-500 font-medium">
                        <span>Rabais nouveau client (50%)</span>
                        <span>-{welcomeDiscountAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    {serverPromoDiscount > 0 && appliedPromo && (
                      <div className="flex justify-between text-emerald-500 font-medium">
                        <span>Rabais promo ({appliedPromo.code})</span>
                        <span>-{serverPromoDiscount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    {isPromoBlocked && appliedPromo && (
                      <div className="flex justify-between text-amber-500 text-xs">
                        <span>{appliedPromo.code} — non cumulable avec rabais bienvenue</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between font-medium">
                      <span className="text-muted-foreground">Base taxable aujourd'hui</span>
                      <span>{todayTaxableBase.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">TPS (5%) + TVQ (9.975%)</span>
                      <span>{round2(todayTps + todayTvq).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    <div className="flex justify-between pt-3 border-t-2 border-cyan-500/50">
                      <span className="font-bold text-cyan-500 text-base">Total à payer aujourd'hui</span>
                      <span className="font-bold text-cyan-500 text-lg">{uiTodayTotal.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
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
                      <span>{round2(monthlyTps + monthlyTvq).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    <div className="flex justify-between pt-3 border-t-2 border-purple-500/50">
                      <span className="font-bold text-purple-500 text-base">Total mensuel estimé</span>
                      <span className="font-bold text-purple-500 text-lg">{monthlyTotalWithTax.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Facturation le 1er de chaque mois après activation</p>
                  </CardContent>
                </Card>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                Montants estimatifs, taxes applicables selon votre adresse au Québec (TPS 5% + TVQ 9.975%).
              </p>

              {/* FREE ORDER - No payment required when total is 0 */}
              {(authoritativePricing?.total ?? 0) <= 0 && (
                <Card className="bg-emerald-500/10 border-emerald-500/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle2 className="w-5 h-5" />
                      Aucun paiement requis
                    </CardTitle>
                    <CardDescription>
                      Grâce à votre code promotionnel, cette commande est entièrement couverte!
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-emerald-500/20 rounded-lg text-center">
                      <p className="text-lg font-bold text-emerald-600">Total: 0,00 $</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Le rabais promotionnel couvre l'intégralité de votre commande.
                      </p>
                    </div>
                    <Button
                      className="w-full mt-4 bg-emerald-500 hover:bg-emerald-600 text-white"
                      onClick={() => {
                        setPaymentMethod("promo_free");
                        setPaymentComplete(true);
                        setPaymentConfirmationNumber("PROMO-FREE-" + Date.now());
                      }}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Confirmer la commande gratuite
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Payment Section - Required before order submission */}
              {(authoritativePricing?.total ?? 0) > 0 && (
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
                  {/* Payment method selection — All methods active */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 1. Credit Card - PRIMARY via Stripe */}
                    <div
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all relative ${
                        paymentMethod === "credit_card"
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => {
                        setPaymentMethod("credit_card");
                        setPaymentComplete(false);
                        setPaymentConfirmationNumber("");
                        setPaypalCaptureId("");
                        // Create draft invoice for Stripe if not already created
                        if (!stripeDraft && !stripeDraftLoading && user && authoritativePricing && uiTodayTotal > 0) {
                          setStripeDraftLoading(true);
                          setStripeDraftError(null);
                          createCheckoutDraftInvoice({
                            userId: user.id,
                            email: profile?.email || user.email || "",
                            firstName: firstName || profile?.first_name || "",
                            lastName: lastName || profile?.last_name || "",
                            phone: checkoutPhone || profile?.phone || "",
                            totalAmount: uiTodayTotal,
                            subtotal: authoritativePricing.subtotal ?? 0,
                            tpsAmount: (authoritativePricing as any).tps ?? (authoritativePricing as any).gst ?? 0,
                            tvqAmount: (authoritativePricing as any).tvq ?? (authoritativePricing as any).qst ?? 0,
                            serviceAddress: serviceAddressStreet || "",
                            serviceCity: serviceAddressCity || "",
                            servicePostalCode: serviceAddressPostalCode || "",
                            serviceType: selectedServices[0]?.category || "bundle",
                            description: `Checkout public — Commande Nivra`,
                          })
                            .then((result) => {
                              setStripeDraft(result);
                              setStripeDraftLoading(false);
                            })
                            .catch((err) => {
                              console.error("[Checkout] Stripe draft invoice error:", err);
                              setStripeDraftError(err instanceof Error ? err.message : "Erreur de préparation du paiement");
                              setStripeDraftLoading(false);
                            });
                        }
                      }}
                    >
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-primary text-primary-foreground text-xs">
                          Recommandé
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          paymentMethod === "credit_card" ? "bg-primary" : "bg-muted"
                        }`}>
                          <CreditCard className={`w-5 h-5 ${paymentMethod === "credit_card" ? "text-primary-foreground" : "text-muted-foreground"}`} />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Carte de crédit</p>
                          <p className="text-xs text-muted-foreground">Visa, Mastercard, Amex</p>
                        </div>
                      </div>
                    </div>

                    {/* 2. PayPal */}
                    <div
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all relative ${
                        paymentMethod === "paypal"
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-border hover:border-blue-500/50"
                      }`}
                      onClick={() => {
                        setPaymentMethod("paypal");
                        setPaymentComplete(false);
                        setPaymentConfirmationNumber("");
                        setPaypalCaptureId("");
                      }}
                    >
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-blue-500/20 text-blue-600 border-0 text-xs">
                          Sécurisé
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          paymentMethod === "paypal" ? "bg-blue-500" : "bg-muted"
                        }`}>
                          <svg className={`w-5 h-5 ${paymentMethod === "paypal" ? "text-white" : "text-muted-foreground"}`} viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19.554 9.488c.121.563.106 1.246-.04 2.017-.582 2.464-2.477 3.88-5.336 3.88h-.71c-.323 0-.6.216-.665.524l-.513 3.292-.146.935c-.033.211.127.403.34.403h2.398c.283 0 .526-.19.581-.468l.024-.123.46-2.922.03-.163c.055-.278.298-.468.58-.468h.367c2.369 0 4.221-1.042 4.762-4.057.226-1.261.11-2.314-.488-3.054a2.57 2.57 0 0 0-.644-.563c.138.244.252.505.34.78z"/>
                            <path d="M18.474 9.081a5.97 5.97 0 0 0-.74-.195 9.456 9.456 0 0 0-1.505-.11h-4.562c-.283 0-.526.19-.581.467l-.973 6.17-.028.18c.065-.308.342-.524.665-.524h1.386c2.84 0 5.062-1.155 5.713-4.495.019-.099.036-.195.05-.289a3.09 3.09 0 0 0-.425-.204z"/>
                            <path d="M10.663 9.243a.595.595 0 0 1 .58-.467h4.563c.541 0 1.047.037 1.505.11.129.02.254.045.375.073.128.03.25.063.365.1.058.018.113.038.168.058a3.1 3.1 0 0 1 .257.103c.086-.55.085-1.106-.027-1.648-.376-1.822-1.667-2.573-3.612-2.573h-5.8c-.323 0-.6.216-.665.524L6.67 17.403c-.04.253.152.48.408.48h2.972l.746-4.733.867-3.907z"/>
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">PayPal</p>
                          <p className="text-xs text-muted-foreground">Carte ou compte</p>
                        </div>
                      </div>
                    </div>

                    {/* 3. Interac E-Transfer */}
                    <div
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all relative ${
                        paymentMethod === "etransfer"
                          ? "border-emerald-500 bg-emerald-500/10"
                          : "border-border hover:border-emerald-500/50"
                      }`}
                      onClick={() => {
                        setPaymentMethod("etransfer");
                        setPaymentComplete(false);
                        setPaymentConfirmationNumber("");
                        setPaypalCaptureId("");
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          paymentMethod === "etransfer" ? "bg-emerald-500" : "bg-muted"
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

                  {/* Stripe Inline Payment Form for Credit Card */}
                  {paymentMethod === "credit_card" && !paymentComplete && (
                    <div className="space-y-4 p-4 bg-primary/10 rounded-lg border border-primary/30">
                      {stripeDraftLoading && (
                        <div className="flex items-center justify-center gap-2 py-6">
                          <svg className="w-5 h-5 animate-spin text-primary" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                          <span className="text-sm text-muted-foreground">Préparation du formulaire de paiement…</span>
                        </div>
                      )}
                      {stripeDraftError && (
                        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                          {stripeDraftError}
                        </div>
                      )}
                      {stripeDraft && !stripeDraftLoading && (
                        <StripeInlinePayment
                          invoiceId={stripeDraft.invoiceId}
                          amount={uiTodayTotal}
                          customerEmail={profile?.email || user?.email || ""}
                          customerId={stripeDraft.customerId}
                          collectBillingDetails
                          defaultBillingDetails={{
                            firstName: firstName || profile?.first_name || "",
                            lastName: lastName || profile?.last_name || "",
                            addressLine1: [serviceAddressStreet, serviceAddressApartment].filter(Boolean).join(" "),
                            city: serviceAddressCity || "",
                            state: serviceAddressProvince || "QC",
                            postalCode: serviceAddressPostalCode || "",
                            country: "CA",
                            email: profile?.email || user?.email || "",
                          }}
                          onSuccess={() => {
                            setPaymentComplete(true);
                            setPaymentConfirmationNumber(`STRIPE-${stripeDraft.invoiceNumber}`);
                            toast.success("Paiement par carte confirmé !");
                            // Traceability
                            logPaymentConfirmed({
                              payment_reference: `STRIPE-${stripeDraft.invoiceNumber}`,
                              amount: uiTodayTotal,
                              method: "card",
                            });
                            // Invalidate billing caches
                            queryClient.invalidateQueries({ queryKey: ["billing-invoices"] });
                            queryClient.invalidateQueries({ queryKey: ["billing-payments"] });
                            queryClient.invalidateQueries({ queryKey: ["client-monthly-invoices"] });
                            queryClient.invalidateQueries({ queryKey: ["client-balance"] });
                            queryClient.invalidateQueries({ queryKey: ["client-ledger"] });
                          }}
                          onError={(msg) => {
                            toast.error(msg);
                            logPaymentFailed({
                              error_message: msg,
                              method: "card",
                              amount: uiTodayTotal,
                            });
                          }}
                        />
                      )}
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
                                <li>Envoyez <strong className="text-amber-500">{uiTodayTotal.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</strong> à:</li>
                                <li className="ml-4"><strong className="text-foreground">Support@nivra-telecom.ca</strong></li>
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

                  {/* PayPal Form - Only show if not already paid via PayPal */}
                  {paymentMethod === "paypal" && !paymentComplete && !paypalCaptureId && (
                    <div className="space-y-4 p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                      <p className="text-sm text-muted-foreground mb-4">
                        Payez de façon sécurisée avec votre compte PayPal ou carte de crédit/débit.
                      </p>
                      <PayPalButton
                        amount={uiTodayTotal}
                        paymentNumber={authoritativePricing?.paymentNumber}
                        description="Commande Nivra Telecom"
                        disabled={!authoritativePricing || uiTodayTotal <= 0}
                        onSuccess={(captureId) => {
                          setPaypalCaptureId(captureId);
                          setPaymentConfirmationNumber(captureId);
                          setPaymentComplete(true);
                          toast.success(`Paiement PayPal réussi! Confirmation: ${captureId}`);
                          // ★ TRACEABILITY: PayPal payment confirmed
                          logPaymentConfirmed({
                            paypal_capture_id: captureId,
                            amount: uiTodayTotal,
                            method: "paypal",
                          });
                          // Invalidate all billing-related caches for instant UI updates
                          queryClient.invalidateQueries({ queryKey: ["billing-invoices"] });
                          queryClient.invalidateQueries({ queryKey: ["billing-payments"] });
                          queryClient.invalidateQueries({ queryKey: ["client-monthly-invoices"] });
                          queryClient.invalidateQueries({ queryKey: ["client-balance"] });
                          queryClient.invalidateQueries({ queryKey: ["client-ledger"] });
                        }}
                        onError={(error) => {
                          console.error("PayPal error:", error);
                          toast.error("Erreur PayPal. Veuillez réessayer.");
                          // ★ TRACEABILITY: PayPal payment failed
                          logPaymentFailed({
                            error_message: String(error),
                            method: "paypal",
                            amount: uiTodayTotal,
                          });
                        }}
                      />
                      <div className="flex items-start gap-2 p-3 bg-muted/50 border border-border rounded-lg">
                        <Info className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground">
                          Vous serez redirigé vers PayPal pour compléter le paiement. Votre commande sera confirmée automatiquement.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* PayPal Already Captured (from redirect/session restore) - Allow proceeding without repaying */}
                  {paymentMethod === "paypal" && !paymentComplete && paypalCaptureId && (
                    <div className="p-4 bg-emerald-500/20 border border-emerald-500/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
                          <CheckCircle2 className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-emerald-500">Paiement PayPal confirmé!</p>
                          <p className="text-sm text-muted-foreground">
                            Réf. PayPal: <span className="font-mono font-bold text-foreground">{paypalCaptureId}</span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Montant: <span className="font-bold text-emerald-500">{(authoritativePricing?.total ?? 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                          </p>
                          <p className="text-xs text-emerald-600 mt-1">
                            ✓ Votre paiement a été capturé. Vous pouvez soumettre votre commande.
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full"
                        onClick={() => {
                          // Mark payment as complete to proceed
                          setPaymentComplete(true);
                          setPaymentConfirmationNumber(paypalCaptureId);
                        }}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Continuer avec ce paiement
                      </Button>
                    </div>
                  )}

                  {/* Payment Confirmed (any method) */}
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
                            Montant: <span className="font-bold text-emerald-500">{(authoritativePricing?.total ?? 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                          </p>
                          {paymentMethod === "paypal" && (
                            <Badge className="mt-2 bg-blue-500/20 text-blue-600 border-0">
                              PayPal — Payé
                            </Badge>
                          )}
                          {paymentMethod === "etransfer" && (
                            <Badge className="mt-2 bg-amber-500/20 text-amber-600 border-0">
                              Interac — En attente de confirmation
                            </Badge>
                          )}
                          {paymentMethod === "credit_card" && (
                            <Badge className="mt-2 bg-purple-500/20 text-purple-600 border-0">
                              Carte — Autorisé
                            </Badge>
                          )}
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
              )}

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

            {/* Spacer for fixed bottom bar on mobile */}
            <div className="lg:hidden h-36" />

            <div className="hidden lg:block lg:col-span-5 xl:col-span-4">
              <div className="sticky top-6">
              <Card className="bg-white border border-slate-200 rounded-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-cyan-500" />
                    Total de la commande
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    {/* ═══ SECTION A: Recurring Monthly ═══ */}
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Services mensuels</p>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Services récurrents</span>
                      <span>{monthlyRecurring.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">TPS + TVQ</span>
                      <span>{round2(monthlyTps + monthlyTvq).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois</span>
                    </div>
                    <div className="flex justify-between font-medium pt-1 border-t border-purple-500/30">
                      <span className="text-purple-500">Total mensuel estimé</span>
                      <span className="text-purple-500">{monthlyTotalWithTax.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois</span>
                    </div>

                    <Separator className="my-1" />
                    
                    {/* ═══ SECTION B: One-time Fees ═══ */}
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Frais uniques</p>
                    {(hasInternetService || hasTVService) && routerFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{ROUTER_CONFIG_DYNAMIC.name}</span>
                        <span>{routerFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    {hasTVService && terminalFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{TERMINAL_CONFIG.name} (×{terminalQuantity})</span>
                        <span>{terminalFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    {hasMobileService && simFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{SIM_CONFIG_DYNAMIC[simType].name}</span>
                        <span>{simFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    {deliveryFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Livraison</span>
                        <span>{deliveryFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    {!isEquipmentOnlyOrder && activationFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Activation</span>
                        <span>{activationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    {installationFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Installation</span>
                        <span>{installationFee.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-medium">
                      <span className="text-muted-foreground">Total frais uniques</span>
                      <span>{authoritativeOneTimeSubtotal.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>

                    <Separator className="my-1" />

                    {/* ═══ SECTION C: Today's Payment ═══ */}
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Paiement aujourd'hui</p>
                    {authoritativeOneTimeSubtotal > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Frais uniques</span>
                        <span>{authoritativeOneTimeSubtotal.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Services 1er mois</span>
                      <span className={totalDiscount > 0 ? "text-muted-foreground line-through" : ""}>{authoritativeRecurringSubtotal.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                    {totalDiscount > 0 && (
                      <>
                        <div className="flex justify-between text-xs text-emerald-500 font-medium">
                          <span>Rabais{appliedPromo ? ` (${appliedPromo.code})` : ""}</span>
                          <span>-{totalDiscount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                        </div>
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-muted-foreground">Net 1er mois</span>
                          <span>{firstInvoiceRecurringNet.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">TPS + TVQ</span>
                      <span>{round2(todayTps + todayTvq).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                  </div>

                   <div className="border-t-2 border-cyan-500/50 pt-4">
                     <div className="flex justify-between items-center">
                       <span className="font-medium text-foreground">Total à payer aujourd'hui</span>
                       <span className="text-2xl font-bold text-cyan-500">
                         {uiTodayTotal.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                       </span>
                     </div>
                     <p className="text-xs text-muted-foreground mt-1">Frais uniques + 1er mois, taxes incluses</p>
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
                        disabled={isAccountBlocked || createOrderMutation.isPending || !termsAccepted || !isPaymentComplete || (requiresInstallation && (!selectedDate || !selectedTime || !appointmentConfirmed))}
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
              <SecurityTrustBox isFrench={true} />
              </div>
            </div>
          </div>
        )}
          </>
        )}

        {/* ═══ MOBILE FIXED BOTTOM BAR — Always visible on phone ═══ */}
        {isHydrated && (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.1)] px-4 py-3 safe-area-bottom" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            {/* Step 1: Service Selection */}
            {step === 1 && (selectedServices.length > 0 || selectedStreamingServices.length > 0) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{selectedServices.length + selectedStreamingServices.length} service(s)</span>
                  <span className="font-bold text-foreground">
                    {monthlyTotalWithTax.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois
                  </span>
                </div>
                <Button variant="hero" className="w-full" size="lg" onClick={() => setStep(2)}>
                  Continuer <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}

            {/* Step 2: TV Channels */}
            {step === 2 && hasTVService && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total mensuel</span>
                  <span className="font-bold text-foreground">{(subtotal + paidChannelTotal).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}/mois</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Retour
                  </Button>
                  <Button variant="hero" className="flex-1" onClick={() => setStep(hasMobileService ? 3 : 4)}>
                    Continuer <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2/3: Mobile Transfer */}
            {((step === 2 && !hasTVService && hasMobileService) || (step === 3 && hasTVService && hasMobileService)) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">SIM (×{totalMobileLineQuantity})</span>
                  <span className="font-bold text-foreground">{(SIM_CONFIG_DYNAMIC.physical.price * totalMobileLineQuantity).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(hasTVService ? 2 : 1)}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Retour
                  </Button>
                  <Button variant="hero" className="flex-1" onClick={() => setStep(hasTVService ? 4 : 3)} disabled={!isMobileTransferComplete()}>
                    Continuer <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* Verification/Installation step */}
            {((step === 2 && !hasTVService && !hasMobileService) ||
              (step === 3 && !hasTVService && hasMobileService) ||
              (step === 3 && hasTVService && !hasMobileService) ||
              (step === 4 && hasTVService && hasMobileService)) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total aujourd'hui</span>
                  <span className="font-bold text-foreground">{uiTodayTotal.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => {
                    if (hasMobileService && !hasTVService) setStep(2);
                    else if (hasTVService && !hasMobileService) setStep(2);
                    else if (hasTVService && hasMobileService) setStep(3);
                    else setStep(1);
                  }}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Retour
                  </Button>
                  <Button variant="hero" className="flex-1" onClick={() => {
                    let nextStep = 4;
                    if (hasTVService && hasMobileService) nextStep = 5;
                    else if (hasTVService || hasMobileService) nextStep = 4;
                    else nextStep = 3;
                    setStep(nextStep);
                  }} disabled={
                    isEquipmentOnlyOrder 
                      ? !deliveryChoice
                      : isDeliveryOnlyOrder 
                        ? (!isIdComplete || !deliveryChoice)
                        : (!isIdComplete || !installationChoice || (requiresInstallation && (!selectedDate || !selectedTime || !appointmentConfirmed)))
                  }>
                    Réviser <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* Final Confirmation step */}
            {((step === 3 && !hasTVService && !hasMobileService) ||
              (step === 4 && ((hasTVService && !hasMobileService) || (hasMobileService && !hasTVService))) ||
              (step === 5 && hasTVService && hasMobileService)) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total à payer</span>
                  <span className="font-bold text-foreground">{uiTodayTotal.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(step - 1)}>
                    <ArrowLeft className="w-4 h-4 mr-1" /> Retour
                  </Button>
                  <BlockedActionWrapper action="order" showInlineNotice={isAccountBlocked}>
                    <Button variant="hero" className="flex-1" size="lg" onClick={handleSubmit}
                      disabled={isAccountBlocked || createOrderMutation.isPending || !termsAccepted || !isPaymentComplete || (requiresInstallation && (!selectedDate || !selectedTime || !appointmentConfirmed))}>
                      {createOrderMutation.isPending ? "..." : "Confirmer"}
                    </Button>
                  </BlockedActionWrapper>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ClientLayout>
  );
};

export default ClientNewOrder;
