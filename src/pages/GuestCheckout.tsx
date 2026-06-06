/**
 * GuestCheckout — Public checkout flow (no account required)
 * 6 steps: Forfait → Adresse → Infos client → Vérification & Options → Paiement → Confirmation
 * 
 * After successful order:
 * 1. Order created via canonical flow (Nivra Core or fallback)
 * 2. Client account auto-created via auto-create-client-account edge function
 * 3. Password reset email sent to client
 */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { trackLiveActivity } from "@/hooks/useLiveActivityTracker";
import { usePublicServices } from "@/hooks/usePublicServices";
import { useEquipmentPrices } from "@/hooks/usePublicServices";
import { useCanonicalFees } from "@/hooks/useCanonicalFees";
import { CheckoutProgress } from "@/components/checkout/CheckoutProgress";
import { SecurityTrustBox } from "@/components/checkout/SecurityTrustBox";
import { PromoCodeInput } from "@/components/checkout/PromoCodeInput";
import { ReferralCodeInput, type AppliedReferral } from "@/components/checkout/ReferralCodeInput";
import { InstallationSection } from "@/components/checkout/InstallationSection";
import {
  CheckoutShippingAndActivation,
  DEFAULT_SHIPPING,
  DEFAULT_ACTIVATION,
  DEFAULT_INSTALLATION_DETAILS,
  validateShipping,
  validateActivation,
  type ShippingAddressData,
  type ActivationData,
  type InstallationDetailsData,
} from "@/components/checkout/CheckoutShippingAndActivation";
import { CheckoutEssentialTermsBase, isChecklistComplete, type ChecklistState } from "@/components/checkout/CheckoutEssentialTermsBase";
import { ConfirmationSuccess } from "@/components/checkout/ConfirmationSuccess";

import { PhotoBg } from "@/components/PhotoBg";
import { PayPalButton } from "@/components/payment/PayPalButton";
import { AutoPayPalOption } from "@/components/checkout/AutoPayPalOption";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { AddressAutocomplete, type AddressValue } from "@/components/shared/AddressAutocomplete";
import { validateDob, MIN_AGE_TELECOM } from "@/lib/validation/dob";
import { validateCanadianPhone, formatCanadianPhone } from "@/components/checkout/CheckoutPhoneField";
import { validateCanadianPostalCode, formatPostalCode } from "@/components/checkout/CheckoutServiceAddress";
import { computeCheckoutPricing, type CartLineItem } from "@/lib/pricing/serverPricing";
import { normalizeServerPricingResult, sanitizeTaxes, toMoney, toNonNegativeMoney } from "@/lib/pricing/money";
import { estimateTaxes as estimateMonthlyTaxes } from "@/lib/pricing/serverTaxEngine";
import { submitNivraCheckout, type NivraFullCheckoutPayload, type NivraFullCheckoutResponse } from "@/lib/api/nivraApi";
import { fallbackCheckout } from "@/lib/checkoutFallback";
import { buildOrderLineItems, wrapLineItemsForOrder } from "@/lib/orderLineItems";
import { toast } from "sonner";
import {
  ShoppingCart, ArrowRight, ArrowLeft, Check, Wifi, Tv, Smartphone, Shield,
  Package, MonitorPlay, User, MapPin, CreditCard, Calendar, Gift, Info,
  AlertCircle, Lock, Mail, Phone, Home, Star, CheckCircle2, Loader2
} from "lucide-react";
import Header from "@/components/Header";

// ── Types ──
interface Service {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  category: string;
  plan_code?: string;
}

const categoryIcons: Record<string, any> = {
  Mobile: Smartphone, Internet: Wifi, TV: Tv, Streaming: MonitorPlay,
  "Streaming+": MonitorPlay, Sécurité: Shield, Extras: Package,
};

const CHECKOUT_STEPS = [
  { id: 1, labelFr: "Forfait", labelEn: "Plan" },
  { id: 2, labelFr: "Adresse", labelEn: "Address" },
  { id: 3, labelFr: "Informations", labelEn: "Info" },
  { id: 4, labelFr: "Options", labelEn: "Options" },
  { id: 5, labelFr: "Paiement", labelEn: "Payment" },
  { id: 6, labelFr: "Confirmation", labelEn: "Confirmation" },
];

const CHECKOUT_DRAFT_KEY = "nivra_checkout_draft";
const ABANDONMENT_EMAIL_KEY = "nivra_abandonment_email_id";

const GuestCheckout = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientRequestIdRef = useRef(crypto.randomUUID());
  const submittingRef = useRef(false);
  const abandonmentTrackedRef = useRef(false);

  // ── Step state ──
  const [step, setStep] = useState(1);

  // ── Service selection ──
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);

  // ── Address ──
  const [addressStreet, setAddressStreet] = useState("");
  const [addressApartment, setAddressApartment] = useState("");
  const [addressCity, setAddressCity] = useState("");
  const [addressProvince, setAddressProvince] = useState("QC");
  const [addressPostalCode, setAddressPostalCode] = useState("");

  // ── Client info ──
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");

  // ── Port-in (conservation du numéro) ──
  const [wantsPortIn, setWantsPortIn] = useState(false);
  const [portInNumber, setPortInNumber] = useState("");
  const [portInCarrier, setPortInCarrier] = useState("Rogers");
  const [portInAccountNumber, setPortInAccountNumber] = useState("");
  const [portInPin, setPortInPin] = useState("");
  const [portInCarrierDetected, setPortInCarrierDetected] = useState<string | null>(null);
  const [portInCarrierLoading, setPortInCarrierLoading] = useState(false);
  const portInLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Options ──
  const [installationChoice, setInstallationChoice] = useState<"auto" | "technician" | null>("auto");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [appointmentConfirmed, setAppointmentConfirmed] = useState(false);
  const [notes, setNotes] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [autoAppliedPromo, setAutoAppliedPromo] = useState(false);
  const [autoApplyAttempted, setAutoApplyAttempted] = useState(false);
  const [appliedReferral, setAppliedReferral] = useState<AppliedReferral | null>(null);

  // ── Phase 2: Shipping override + activation date + installation details ──
  const [shippingData, setShippingData] = useState<ShippingAddressData>(DEFAULT_SHIPPING);
  const [activationData, setActivationData] = useState<ActivationData>(DEFAULT_ACTIVATION);
  const [installationDetailsData, setInstallationDetailsData] =
    useState<InstallationDetailsData>(DEFAULT_INSTALLATION_DETAILS);

  // ── KYC / Identity ──
  // Identity verification (KYC) removed from public checkout — handled post-purchase if needed.

  // ── Payment ──
  // Nivra n'accepte que PayPal (incluant cartes de crédit via PayPal).
  // Le virement Interac n'est plus accepté.
  const [paymentMethod, setPaymentMethod] = useState<"paypal">("paypal");
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [paypalCaptureId, setPaypalCaptureId] = useState("");
  // Legacy etransfer state retained as no-op for back-compat with old serialized
  // refs but no longer surfaced in the UI.
  const etransferRef = "";

  // ── PayPal pre-authorized (auto-billing) recurring payment opt-in ──
  // When enabled, the order routes through billing-create-order-with-paypal-subscription
  // and the client is redirected to PayPal to approve a recurring billing agreement.
  // They get a $5/month discount on every future invoice.
  const [enableAutoBilling, setEnableAutoBilling] = useState(false);
  const AUTOPAY_DISCOUNT = 5;

  // ── Legal checklist (replaces simple termsAccepted) ──
  const [legalChecklist, setLegalChecklist] = useState<ChecklistState>({
    prepaid: false,
    delays: false,
    notices: false,
    etransfer: false,
    rescission: false,
  });

  // ── Pricing ──
  const [liveServerPricing, setLiveServerPricing] = useState<any>(null);
  const [isServerPricingLoading, setIsServerPricingLoading] = useState(false);
  const serverPricingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Order result ──
  const [orderResult, setOrderResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stable cart UUID — satisfies paypal-create-order guard without creating a DB record first.
  const clientCartIdRef = useRef<string>('cart_' + crypto.randomUUID());

  // ── Restaurer le state depuis sessionStorage au montage ──
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CHECKOUT_DRAFT_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.step > 1) setStep(s.step);
      if (s.selectedServices?.length) setSelectedServices(s.selectedServices);
      if (s.addressStreet)     setAddressStreet(s.addressStreet);
      if (s.addressApartment)  setAddressApartment(s.addressApartment);
      if (s.addressCity)       setAddressCity(s.addressCity);
      if (s.addressProvince)   setAddressProvince(s.addressProvince);
      if (s.addressPostalCode) setAddressPostalCode(s.addressPostalCode);
      if (s.firstName)         setFirstName(s.firstName);
      if (s.lastName)          setLastName(s.lastName);
      if (s.email)             setEmail(s.email);
      if (s.phone)             setPhone(s.phone);
      if (s.dateOfBirth)       setDateOfBirth(s.dateOfBirth);
      if (s.installationChoice) setInstallationChoice(s.installationChoice);
      if (s.selectedDate)      setSelectedDate(s.selectedDate);
      if (s.selectedTime)      setSelectedTime(s.selectedTime);
      if (s.notes)             setNotes(s.notes);
      if (s.wantsPortIn)        setWantsPortIn(s.wantsPortIn);
      if (s.portInNumber)      setPortInNumber(s.portInNumber);
      if (s.portInCarrier)     setPortInCarrier(s.portInCarrier);
      if (s.portInAccountNumber) setPortInAccountNumber(s.portInAccountNumber);
      if (s.paypalCaptureId)   { setPaypalCaptureId(s.paypalCaptureId); setPaymentComplete(true); }
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sauvegarder le state dans sessionStorage à chaque changement ──
  useEffect(() => {
    if (step === 6) { sessionStorage.removeItem(CHECKOUT_DRAFT_KEY); return; }
    if (step < 2) return;
    try {
      sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify({
        step, selectedServices,
        addressStreet, addressApartment, addressCity, addressProvince, addressPostalCode,
        firstName, lastName, email, phone, dateOfBirth,
        installationChoice, selectedDate, selectedTime, notes,
        wantsPortIn, portInNumber, portInCarrier, portInAccountNumber,
        paypalCaptureId, paymentComplete,
      }));
    } catch {}
  }, [step, selectedServices, addressStreet, addressApartment, addressCity, addressProvince,
      addressPostalCode, firstName, lastName, email, phone, dateOfBirth,
      installationChoice, selectedDate, selectedTime, notes,
      wantsPortIn, portInNumber, portInCarrier, portInAccountNumber,
      paypalCaptureId, paymentComplete]);

  // ── Annuler l'email d'abandon quand la commande est complétée ──
  const cancelAbandonmentEmail = () => {
    const emailId = sessionStorage.getItem(ABANDONMENT_EMAIL_KEY);
    if (!emailId) return;
    sessionStorage.removeItem(ABANDONMENT_EMAIL_KEY);
    supabase.functions.invoke("checkout-abandonment-track", {
      body: { action: "cancel", email_id: emailId },
    }).catch(() => {}); // fire and forget
  };

  // ── Abandon de panier — déclenche email de récupération après 60 min ──
  useEffect(() => {
    // Conditions : step 4+ (options), email connu, services sélectionnés, pas encore tracké
    if (step < 4 || !email || selectedServices.length === 0 || abandonmentTrackedRef.current) return;
    abandonmentTrackedRef.current = true;

    const track = async () => {
      try {
        const { data } = await supabase.functions.invoke("checkout-abandonment-track", {
          body: {
            action: "start",
            email: email.trim().toLowerCase(),
            first_name: firstName.trim() || "Client",
            last_name: lastName.trim(),
            services: selectedServices.map(s => ({ name: s.name, price: s.price })),
            session_id: clientRequestIdRef.current,
          },
        });
        if (data?.email_id) {
          sessionStorage.setItem(ABANDONMENT_EMAIL_KEY, data.email_id);
        }
      } catch (e) {
        console.warn("[GuestCheckout] abandonment track failed (non-fatal):", e);
      }
    };
    track();
  }, [step, email, selectedServices.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Port-in carrier auto-detection (debounced, 900ms) ──
  useEffect(() => {
    if (portInLookupTimer.current) clearTimeout(portInLookupTimer.current);
    const digits = portInNumber.replace(/\D/g, "");
    if (!wantsPortIn || digits.length < 10) {
      setPortInCarrierDetected(null);
      return;
    }
    setPortInCarrierLoading(true);
    portInLookupTimer.current = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke("lookup-phone-carrier", {
          body: { phone_number: digits },
        });
        if (data?.carrier_normalized) {
          // Show as hint only — Numverify shows original carrier, not post-port carrier
          setPortInCarrierDetected(data.carrier_normalized);
        } else {
          setPortInCarrierDetected(null);
        }
      } catch {
        setPortInCarrierDetected(null);
      } finally {
        setPortInCarrierLoading(false);
      }
    }, 900);
    return () => {
      if (portInLookupTimer.current) clearTimeout(portInLookupTimer.current);
    };
  }, [portInNumber, wantsPortIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data hooks ──
  const { data: services, isLoading: servicesLoading } = usePublicServices({ surface: "checkout" });
  const { routerPrice, simPrice, terminalPrice } = useEquipmentPrices();
  const canonicalFees = useCanonicalFees();

  // Pre-select from URL param
  useEffect(() => {
    const planId = searchParams.get("plan");
    if (!planId) return;

    if (services?.length) {
      const svc = services.find(s => s.id === planId || s.sku === planId);
      if (svc && !selectedServices.some(s => s.id === svc.id)) {
        setSelectedServices([{
          id: svc.id, sku: svc.sku, name: svc.name,
          description: svc.description || svc.short_description || "",
          price: Number(svc.price), category: svc.category, plan_code: svc.sku,
        }]);
        setStep(2);
      }
    }
  }, [searchParams, services]);

  // ── Pre-populate from TVConfigurator sessionStorage cart ──

  // ── Referral code capture: URL ?ref=CODE → localStorage (30-day expiry) ──
  useEffect(() => {
    const refFromUrl = searchParams.get("ref");
    if (refFromUrl && refFromUrl.trim().length > 0) {
      try {
        localStorage.setItem(
          "nivra_ref_code",
          JSON.stringify({
            code: refFromUrl.trim().toUpperCase(),
            expires: Date.now() + 30 * 24 * 60 * 60 * 1000,
          })
        );
      } catch { /* localStorage may be blocked — non-fatal */ }
    }
  }, [searchParams]);

  // ── Auto-apply stored referral code once email is provided ──
  useEffect(() => {
    if (appliedReferral) return;
    if (!email || !email.includes("@")) return;
    let stored: { code: string; expires: number } | null = null;
    try {
      const raw = localStorage.getItem("nivra_ref_code");
      if (raw) stored = JSON.parse(raw);
    } catch { /* ignore parse errors */ }
    if (!stored || !stored.code) return;
    if (stored.expires <= Date.now()) {
      try { localStorage.removeItem("nivra_ref_code"); } catch { /* noop */ }
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("validate-promo", {
          body: {
            code: stored!.code,
            client_email: email,
            client_id: undefined,
            cart_items: [],
            subtotal_before_discount: 0,
          },
        });
        if (cancelled) return;
        if (data?.valid && (data.is_client_referral || data.is_referral_code)) {
          setAppliedReferral({
            code: data.promo?.code || stored!.code,
            type: data.is_client_referral ? "client" : "influencer",
            referrer_user_id: data.referrer_user_id,
            referrer_name: data.referrer_name,
            referral_code_id: data.referral_code_id,
            influencer_id: data.influencer_id,
            discount_type: data.promo?.discount_type || "fixed_amount",
            discount_value: data.promo?.discount_value || 0,
            discount_amount: data.discount_amount || 0,
            applies_to: data.promo?.applies_to || {},
            duration: data.promo?.duration,
            name: data.promo?.name || "Code de parrainage",
          });
        }
      } catch { /* non-blocking — user can still enter the code manually */ }
    })();
    return () => { cancelled = true; };
  }, [email, appliedReferral]);

  // ── Live activity tracking for funnel steps ──
  const lastTrackedStep = useRef<number>(0);
  useEffect(() => {
    if (step === lastTrackedStep.current) return;
    lastTrackedStep.current = step;
    const stepLabels: Record<number, { type: "checkout_started" | "checkout_step_completed" | "payment_started" | "order_completed"; label: string }> = {
      1: { type: "checkout_started", label: "Guest Checkout: Sélection forfait" },
      2: { type: "checkout_step_completed", label: "Guest Checkout: Adresse" },
      3: { type: "checkout_step_completed", label: "Guest Checkout: Informations client" },
      4: { type: "checkout_step_completed", label: "Guest Checkout: Vérification & Options" },
      5: { type: "payment_started", label: "Guest Checkout: Paiement" },
      6: { type: "order_completed", label: "Guest Checkout: Confirmation" },
    };
    const info = stepLabels[step];
    if (info) {
      trackLiveActivity(info.type, info.label, { metadata: { step, path: "/commander" } });
    }
  }, [step]);

  // ── Equipment quantities ──
  const [wifiRouterQty, setWifiRouterQty] = useState(1);
  const [tvTerminalQty, setTvTerminalQty] = useState(1);

  // ── SIM type (physical | esim) — required only when a Mobile plan is in cart ──
  const [simType, setSimType] = useState<"physical" | "esim">("physical");

  // ── Welcome discount ──
  const [welcomeDiscountDismissed, setWelcomeDiscountDismissed] = useState(false);

  // ── Derived ──
  const hasInternetService = selectedServices.some(s => s.category === "Internet");
  const hasTVService = selectedServices.some(s => s.category === "TV");
  const hasMobileService = selectedServices.some(s => s.category === "Mobile");
  const hasStreamingService = selectedServices.some(s => s.category === "Streaming" || s.category === "Streaming+");
  const isStreamingOnlyOrder = selectedServices.length > 0 && selectedServices.every(s => s.category === "Streaming" || s.category === "Streaming+");
  const requiresInstallation = installationChoice === "technician" && (hasInternetService || hasTVService);
  const needsAddress = !isStreamingOnlyOrder;
  const isETransfer = false; // Interac retiré — Nivra n'accepte que PayPal
  const isLegalComplete = isChecklistComplete(legalChecklist, isETransfer);
  // KYC removed — always treated as not required at checkout time.
  const isKycComplete = true;

  const ROUTER_PRICE = routerPrice ?? 100;
  const SIM_PRICE = simPrice ?? 25;
  const ESIM_PRICE = SIM_PRICE; // Per nivra-telecom.ca/frais-possibles — eSIM and physical SIM both $25

  const subtotal = toMoney(selectedServices.reduce((sum, s) => sum + toMoney(s.price), 0));
  const routerFee = (hasInternetService || hasTVService) ? ROUTER_PRICE * Math.min(wifiRouterQty, 1) : 0;
  // Both physical SIM and eSIM are billed at SIM_PRICE ($25) per nivra-telecom.ca/frais-possibles.
  const simFee = hasMobileService ? (simType === "esim" ? ESIM_PRICE : SIM_PRICE) : 0;
  const terminalFee = hasTVService ? (terminalPrice ?? 0) * Math.min(Math.max(tvTerminalQty, 1), 4) : 0;
  const activationFee = isStreamingOnlyOrder ? 0 : (canonicalFees.activationSingle || 10);
  const deliveryFee = isStreamingOnlyOrder ? 0 : (installationChoice === "auto" ? (canonicalFees.deliverySelfInstall || 20) : 0);
  const installationFee = isStreamingOnlyOrder ? 0 : (installationChoice === "technician" ? (canonicalFees.installationTechnician || 25) : 0);
  const oneTimeFees = routerFee + simFee + terminalFee + activationFee + deliveryFee + installationFee;

  // ── Live server pricing ──
  useEffect(() => {
    if (selectedServices.length === 0) { setLiveServerPricing(null); return; }
    if (serverPricingTimerRef.current) clearTimeout(serverPricingTimerRef.current);
    // Reset immediately so client-side fallback shows while server call is in flight
    setLiveServerPricing(null);

    serverPricingTimerRef.current = setTimeout(async () => {
      setIsServerPricingLoading(true);
      try {
        const cartItems: CartLineItem[] = [];
        selectedServices.forEach(s => {
          cartItems.push({ type: "service", name: s.name, amount: toMoney(s.price), quantity: 1 });
        });
        if (activationFee > 0) cartItems.push({ type: "activation", name: "Frais d'activation", amount: activationFee });
        if (deliveryFee > 0) cartItems.push({ type: "delivery", name: "Frais de livraison", amount: deliveryFee });
        if (installationFee > 0) cartItems.push({ type: "installation", name: "Frais d'installation", amount: installationFee });
        if (routerFee > 0) cartItems.push({ type: "equipment", name: "Routeur", amount: ROUTER_PRICE, quantity: Math.min(wifiRouterQty, 1) });
        if (terminalFee > 0) cartItems.push({ type: "equipment", name: "Terminal TV", amount: terminalPrice ?? 0, quantity: Math.min(Math.max(tvTerminalQty, 1), 4) });
        if (simFee > 0) cartItems.push({ type: "equipment", name: "Carte SIM", amount: simFee });

        const effectivePromoCode = appliedPromo?.code || ((appliedReferral?.discount_amount ?? 0) > 0 ? appliedReferral?.code : null) || null;
        // Pass the autopay discount ($5/mo) to the server pricing engine so
        // it's reflected in totals, taxes and the displayed grand total.
        // Without this the customer sees the wrong total before paying.
        const preauthDiscount = enableAutoBilling && paymentMethod === "paypal" ? AUTOPAY_DISCOUNT : 0;
        const result = await computeCheckoutPricing(cartItems, effectivePromoCode, email || null, null, preauthDiscount);
        setLiveServerPricing(result);
      } catch (err) {
        console.error("[GuestCheckout] Pricing error:", err);
        setLiveServerPricing(null); // reset so client-side fallback kicks in
      } finally {
        setIsServerPricingLoading(false);
      }
    }, 400);

    return () => { if (serverPricingTimerRef.current) clearTimeout(serverPricingTimerRef.current); };
  }, [selectedServices, activationFee, deliveryFee, installationFee, routerFee, simFee, terminalFee, wifiRouterQty, tvTerminalQty, appliedPromo?.code, appliedReferral?.code, email, enableAutoBilling, paymentMethod]);

  const normalizedPricing = liveServerPricing ? normalizeServerPricingResult(liveServerPricing) : null;
  // Client-side fallback so price updates immediately even when server pricing is loading/unavailable
  const clientSideGrandTotal = toNonNegativeMoney((subtotal + oneTimeFees) * 1.14975);
  const todayTotal = toNonNegativeMoney(normalizedPricing?.grand_total ?? clientSideGrandTotal);
  const { total: monthlyTotalWithTax } = estimateMonthlyTaxes(subtotal);

  // ── Service toggle with compatibility rules ──
  const toggleService = (service: Service) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.id === service.id);
      if (exists) return prev.filter(s => s.id !== service.id);

      // Rule 1: Only 1 Internet per order
      if (service.category === "Internet" && prev.some(s => s.category === "Internet")) {
        toast.error("Un seul plan Internet est permis par adresse.");
        return prev;
      }
      // Rule 2: Only 1 TV per order
      if (service.category === "TV" && prev.some(s => s.category === "TV")) {
        toast.error("Un seul forfait TV est permis par adresse.");
        return prev;
      }
      // Rule 3: TV + Internet incompatibility — TV bundles include Internet
      if (service.category === "Internet" && prev.some(s => s.category === "TV")) {
        toast.error("Le forfait TV inclut déjà Internet. Vous ne pouvez pas ajouter un plan Internet séparé.");
        return prev;
      }
      if (service.category === "TV" && prev.some(s => s.category === "Internet")) {
        toast.error("Ce forfait TV inclut Internet. Veuillez d'abord retirer le plan Internet du panier.");
        return prev;
      }

      return [...prev, service];
    });
  };

  // ── Group services by category ──
  const groupedServices = useMemo(() => {
    if (!services) return {};
    return services.reduce((acc, s) => {
      const cat = s.category;
      if (cat.toLowerCase().includes("équipement") || cat.toLowerCase().includes("equipment")) return acc;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push({
        id: s.id, sku: s.sku, name: s.name,
        description: s.description || s.short_description || "",
        price: Number(s.price), category: s.category, plan_code: s.sku,
      });
      return acc;
    }, {} as Record<string, Service[]>);
  }, [services]);

  // ── Validations ──
  const isAddressValid = addressStreet.length > 3 && addressCity.length > 1 && addressPostalCode.length >= 6;
  const isClientInfoValid = firstName.length >= 2 && lastName.length >= 2 && email.includes("@") && phone.length >= 10 && dateOfBirth.length === 10;
  const isPaymentDone = paymentComplete || (paymentMethod === "paypal" && !!paypalCaptureId);

  // ── Auto-apply BIENVENUE2026 (first-month-free) for new clients after Step 3 ──
  const tryAutoApplyFirstMonthFree = async () => {
    // Skip if already applied or if user manually applied a different code
    if (appliedPromo) return;
    if (autoApplyAttempted) return;
    if (isStreamingOnlyOrder) return;
    if (selectedServices.length === 0) return;
    setAutoApplyAttempted(true);

    try {
      const cartItems = selectedServices.map(s => ({ type: 'service' as const, amount: s.price, name: s.name }));
      const { data, error } = await supabase.functions.invoke("validate-promo", {
        body: {
          code: "BIENVENUE2026",
          client_email: email.trim().toLowerCase(),
          client_dob: dateOfBirth,
          client_phone: phone,
          cart_items: cartItems,
          subtotal_before_discount: subtotal,
          auto_apply: true,
        },
      });

      if (error || !data?.valid || !data?.is_new_client) {
        console.log("[GuestCheckout] Auto-apply skipped:", data?.error || "not eligible");
        return;
      }

      const promo = {
        id: data.promo.id,
        code: data.promo.code,
        name: data.promo.name,
        discount_type: data.promo.discount_type,
        discount_value: data.promo.discount_value,
        discount_amount: data.discount_amount,
        applies_to: data.promo.applies_to,
        stackable: data.promo.stackable,
        new_customers_only: data.promo.new_customers_only,
        duration: data.promo.duration,
      };
      setAppliedPromo(promo);
      setAutoAppliedPromo(true);
      setWelcomeDiscountDismissed(true);
    } catch (err) {
      // Fail silently — never block checkout on auto-apply
      console.error("[GuestCheckout] Auto-apply error:", err);
    }
  };

  // ── Submit order ──
  const handleSubmit = async () => {
    if (submittingRef.current || isSubmitting) return;
    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      // Validate DOB
      const dobResult = validateDob(dateOfBirth, { minAge: MIN_AGE_TELECOM, required: true });
      if (!dobResult.isValid) {
        toast.error(dobResult.error?.fr || "Date de naissance invalide");
        return;
      }

      if (!isLegalComplete) {
        toast.error("Veuillez compléter la checklist des conditions essentielles");
        return;
      }


      if (!isPaymentDone) {
        toast.error("Veuillez compléter le paiement");
        return;
      }

      // ── Sauvegarder le paiement immédiatement — avant toute autre opération ──
      // Si le client rafraîchit la page après paiement, on garde la trace
      if (paypalCaptureId) {
        sessionStorage.setItem("nivra_pending_payment", JSON.stringify({
          captureId: paypalCaptureId,
          amount: todayTotal,
          email: email.trim().toLowerCase(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          timestamp: new Date().toISOString(),
        }));
      }

      // ── Full creation flow ──
      // Step 1: Create/find account — try edge function first, fall back to signUp
      let userId: string | null = null;
      try {
        const { data: accountResult, error: accountError } = await supabase.functions.invoke("auto-create-client-account", {
          body: {
            email: email.trim().toLowerCase(),
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: phone.trim(),
            service_address: addressStreet,
            service_city: addressCity,
            service_postal_code: addressPostalCode,
            date_of_birth: dateOfBirth,
          },
        });
        if (!accountError && accountResult?.success) {
          userId = accountResult.user_id;
          console.log("[GuestCheckout] Account via edge function:", userId);
        }
      } catch (e) {
        console.warn("[GuestCheckout] auto-create-client-account failed:", e);
      }

      // Fallback 1: signUp direct (nouveaux clients)
      if (!userId) {
        try {
          const { data: sd } = await supabase.auth.signUp({
            email: email.trim().toLowerCase(),
            password: `${Date.now()}${crypto.randomUUID()}Aa1!`,
            options: { data: { first_name: firstName.trim(), last_name: lastName.trim(), phone: phone.trim() } },
          });
          if (sd?.user?.id) {
            userId = sd.user.id;
            console.log("[GuestCheckout] Account via signUp:", userId);
          }
        } catch (e2) {
          console.warn("[GuestCheckout] signUp fallback failed:", e2);
        }
      }

      // Fallback 2: chercher le profil existant par email
      if (!userId) {
        try {
          const { data: prof } = await supabase.from("profiles").select("user_id").eq("email", email.trim().toLowerCase()).maybeSingle();
          userId = (prof as any)?.user_id || null;
          if (userId) console.log("[GuestCheckout] Account via profile lookup:", userId);
        } catch (e3) {
          console.warn("[GuestCheckout] Profile lookup failed:", e3);
        }
      }

      // Si aucun userId — le paiement est confirmé mais on ne peut pas créer la commande.
      // On affiche quand même la confirmation avec le numéro de capture PayPal.
      if (!userId) {
        console.error("[GuestCheckout] All account creation methods failed. Payment captured:", paypalCaptureId);
        setOrderResult({
          orderNumber: paypalCaptureId,
          orderId: paypalCaptureId,
          isNewAccount: false,
          paymentOnly: true,
        });
        cancelAbandonmentEmail();
        setStep(6);
        sessionStorage.removeItem("nivra_pending_payment");
        toast.success("Paiement confirmé ! Notre équipe va compléter votre commande sous peu.");
        return;
      }

      // Step 1b: KYC removed from public checkout — always not_required.
      const kycStatusForOrder = "not_required";

      // Step 2: Resolve account_id
      const { data: acctRows } = await supabase
        .from("accounts")
        .select("id")
        .eq("client_id", userId)
        .eq("status", "active")
        .limit(1);
      
      let accountId = acctRows?.[0]?.id || null;
      if (!accountId) {
        const { data: newAcct } = await supabase
          .from("accounts")
          .insert({
            client_id: userId,
            account_number: "000000",
            account_name: "Primary",
            status: "active",
            primary_service_address: addressStreet,
            primary_service_city: addressCity,
            primary_service_province: addressProvince,
            primary_service_postal_code: addressPostalCode,
          })
          .select("id")
          .single();
        accountId = newAcct?.id || null;
      }

      // Step 3: Build pricing
      const cartItems: CartLineItem[] = [];
      selectedServices.forEach(s => {
        cartItems.push({ type: "service", name: s.name, amount: toMoney(s.price), quantity: 1 });
      });
      if (activationFee > 0) cartItems.push({ type: "activation", name: "Frais d'activation", amount: activationFee });
      if (deliveryFee > 0) cartItems.push({ type: "delivery", name: "Frais de livraison", amount: deliveryFee });
      if (installationFee > 0) cartItems.push({ type: "installation", name: "Frais d'installation", amount: installationFee });
      if (routerFee > 0) cartItems.push({ type: "equipment", name: "Routeur", amount: ROUTER_PRICE, quantity: 1 });
      if (terminalFee > 0) cartItems.push({ type: "equipment", name: "Terminal TV", amount: terminalPrice ?? 0, quantity: Math.min(Math.max(tvTerminalQty, 1), 4) });
      if (simFee > 0) cartItems.push({ type: "equipment", name: "Carte SIM", amount: simFee });

      let rpcPricing: any;
      try {
        // Mirror the autopay discount that the user accepted on screen, so the
        // server-authoritative totals match what they were quoted.
        const preauthDiscountFinal = enableAutoBilling && paymentMethod === "paypal" ? AUTOPAY_DISCOUNT : 0;
        rpcPricing = await computeCheckoutPricing(cartItems, appliedPromo?.code || null, email, userId, preauthDiscountFinal);
      } catch { rpcPricing = null; }

      const serverPricing = rpcPricing ? normalizeServerPricingResult(rpcPricing) : {
        grand_total: todayTotal, tps_amount: 0, tvq_amount: 0, taxable_base: subtotal + oneTimeFees,
        recurring_subtotal: subtotal, one_time_subtotal: oneTimeFees,
        discount_total_combined: 0, promo_discount: 0, welcome_discount: 0, preauth_discount: 0,
      };

      const paymentMethodValue = "paypal";

      // Step 4: Submit checkout
      // ★ FIX #8 — Persist guest language preference at checkout.
      const guestLanguage: "fr" | "en" =
        (typeof window !== "undefined" && window.localStorage?.getItem("nivra-language") === "en")
          ? "en"
          : "fr";

      const checkoutPayload: NivraFullCheckoutPayload = {
        client_request_id: clientRequestIdRef.current,
        client_language: guestLanguage,
        customer: {
          user_id: userId,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          date_of_birth: dateOfBirth,
        },
        service_address: {
          street: addressStreet,
          apartment: addressApartment || null,
          city: addressCity,
          province: addressProvince,
          postal_code: addressPostalCode,
        },
        services: selectedServices.map(s => ({
          sku: s.sku || s.id,
          name: s.name,
          plan_code: s.plan_code || s.sku || s.name.toLowerCase().replace(/\s+/g, "_"),
          plan_price: toMoney(s.price),
          category: s.category,
          quantity: 1,
        })),
        equipment: [
          ...((hasInternetService || hasTVService) ? [{ sku: "EQ-ROUTER", name: "Routeur Nivra Born WiFi 6", quantity: 1, unit_price: ROUTER_PRICE }] : []),
          ...(hasTVService ? [{ sku: "EQ-TERMINAL-TV", name: "Terminal TV", quantity: Math.min(Math.max(tvTerminalQty, 1), 4), unit_price: terminalPrice ?? 0 }] : []),
          ...(hasMobileService
            ? [
                simType === "esim"
                  ? { sku: "EQ-SIM-ESIM", name: "eSIM", quantity: 1, unit_price: ESIM_PRICE }
                  : { sku: "EQ-SIM-PHY", name: "Carte SIM physique", quantity: 1, unit_price: SIM_PRICE },
              ]
            : []),
        ],
        fees: [
          ...(activationFee > 0 ? [{ sku: "FEE-ACTIVATION-1", name: "Frais d'activation", amount: activationFee }] : []),
          ...(deliveryFee > 0 ? [{ sku: "FEE-DELIVERY", name: "Frais de livraison", amount: deliveryFee }] : []),
          ...(installationFee > 0 ? [{ sku: "FEE-INSTALL", name: "Installation professionnelle", amount: installationFee }] : []),
        ],
        promo: appliedPromo ? {
          code: appliedPromo.code, name: appliedPromo.name,
          discount_type: appliedPromo.discount_type, discount_value: appliedPromo.discount_value,
          discount_amount: toNonNegativeMoney(serverPricing.promo_discount),
        } : null,
        payment: {
          method: paymentMethodValue as any,
          status: paymentMethod === "paypal" && paypalCaptureId ? "captured" : "pending",
          reference: paypalCaptureId || etransferRef || null,
          paypal_capture_id: paypalCaptureId || null,
        },
        identity: isStreamingOnlyOrder ? null : {
          verification_session_id: `guest_${clientRequestIdRef.current}`,
          id_type: null,
          id_number: null,
          id_expiration: null,
          id_province: null,
        },
        installation: {
          type: installationChoice || "auto",
          delivery_fee: deliveryFee,
          installation_fee: installationFee,
          scheduled_date: selectedDate || null,
          scheduled_time: selectedTime || null,
        },
        pricing_snapshot: serverPricing as any,
        line_items: [],
        notes: notes || "",
        account_id: accountId,
        // sim_type is passed as additional metadata for fulfillment routing (physical vs eSIM).
        ...(hasMobileService ? { sim_type: simType } as any : {}),
        // Port-in: conservation du numéro existant
        port_request: hasMobileService && wantsPortIn && portInNumber ? {
          port_in: true,
          phone_number: portInNumber.trim(),
          carrier: portInCarrier || null,
          account_number: portInAccountNumber.trim() || null,
          service_account: portInPin.trim() || null,
          imei: null,
        } : null,
        referral: appliedReferral ? {
          code: appliedReferral.code,
          type: appliedReferral.type,
          referrer_user_id: appliedReferral.referrer_user_id,
          referral_code_id: appliedReferral.referral_code_id,
          influencer_id: appliedReferral.influencer_id,
        } : null,
      };

      let response: NivraFullCheckoutResponse;
      try {
        response = await submitNivraCheckout(checkoutPayload);
      } catch {
        // Nivra Core unavailable — run canonical sync FIRST to create billing_customer,
        // then use fallback for remaining records.
        try {
          await supabase.functions.invoke("checkout-canonical-sync", {
            body: { payload: checkoutPayload },
          });
        } catch (syncErr) {
          console.warn("[GuestCheckout] Pre-fallback canonical sync failed:", syncErr);
        }
        response = await fallbackCheckout(supabase as any, checkoutPayload);
      }

      // Step 4b: Set kyc_status on the created order
      try {
        await supabase
          .from("orders")
          .update({ kyc_status: kycStatusForOrder } as any)
          .eq("id", response.order_id);
      } catch (e) {
        console.error("[GuestCheckout] Failed to set kyc_status:", e);
      }

      // Step 4c (Phase 2): Persist shipping override + activation date + installation details on order.
      // Stored on the order so orchestrate_order can resolve shipping address and pass the activation note.
      try {
        const orderPatch: Record<string, unknown> = {
          ship_to_different_address: shippingData.shipToDifferentAddress,
          activation_preference: activationData.activationPreference,
          requested_activation_date: activationData.requestedActivationDate
            ? activationData.requestedActivationDate.toISOString().slice(0, 10)
            : null,
          installation_details: {
            coax_available: installationDetailsData.coaxAvailable || null,
            occupancy_status: installationDetailsData.occupancyStatus || null,
            access_notes: installationDetailsData.accessNotes || null,
          },
        };
        if (shippingData.shipToDifferentAddress) {
          Object.assign(orderPatch, {
            shipping_first_name: shippingData.shippingFirstName.trim() || null,
            shipping_last_name: shippingData.shippingLastName.trim() || null,
            shipping_address_line: shippingData.shippingAddressLine.trim() || null,
            shipping_apartment: shippingData.shippingApartment.trim() || null,
            shipping_city: shippingData.shippingCity.trim() || null,
            shipping_province: shippingData.shippingProvince || "QC",
            shipping_postal_code: shippingData.shippingPostalCode.trim() || null,
            shipping_instructions: shippingData.shippingInstructions.trim() || null,
          });
        }
        await supabase
          .from("orders")
          .update(orderPatch as any)
          .eq("id", response.order_id);
      } catch (e) {
        console.error("[GuestCheckout] Failed to persist shipping/activation/install details:", e);
      }

      // Step 5: Canonical sync (idempotent — safe to call again if already called in fallback path)
      try {
        await supabase.functions.invoke("checkout-canonical-sync", {
          body: { payload: checkoutPayload, response },
        });
      } catch (e) {
        console.warn("[GuestCheckout] Canonical sync failed (non-blocking):", e);
      }

      // Step 6: Consent record (BLOCKING — must succeed)
      let consentRetries = 0;
      let consentSaved = false;
      while (consentRetries < 3 && !consentSaved) {
        try {
          const { error: consentError } = await supabase.from("checkout_consent_records" as any).insert({
            order_id: response.order_id,
            user_id: userId,
            terms_accepted: isLegalComplete,
            // Pre-authorized PayPal recurring billing — flipped true when the client
            // opts in via AutoPayPalOption. The webhook (paypal-webhook) is the
            // source of truth; this is the consent record snapshot.
            recurring_payment_accepted: enableAutoBilling,
            total_amount_displayed: todayTotal,
            payment_method: paymentMethodValue,
            services_displayed: selectedServices.map(s => ({ name: s.name, price: s.price, category: s.category })),
            legal_versions: { terms: "2026-03-23", privacy: "2026-03-23", refund: "2026-03-23", payment: "2026-03-23" },
            user_agent: navigator.userAgent,
            consent_timestamp: new Date().toISOString(),
          });
          if (!consentError) consentSaved = true;
          else throw consentError;
        } catch (e) {
          consentRetries++;
          console.error(`[GuestCheckout] Consent record attempt ${consentRetries} failed:`, e);
          if (consentRetries >= 3) {
            toast.error("Erreur critique : impossible d'enregistrer le consentement légal. Contactez le support.");
            // Note: order was already created, but we flag the issue
            console.error("[GuestCheckout] CRITICAL: Consent record failed after 3 retries for order", response.order_id);
          }
        }
      }

      // Step 6c: Client-referral tracking (non-blocking).
      // For client codes (peer-to-peer), record in client_referrals and activate the
      // 5$/mois × 10 mois discount on the new billing_subscription.
      // Influencer codes continue to flow through promotion_redemptions / referral_attributions.
      if (appliedReferral && appliedReferral.type === "client" && appliedReferral.referrer_user_id) {
        try {
          // Resolve referrer's account_id
          const { data: referrerAcct } = await supabase
            .from("accounts")
            .select("id")
            .eq("client_id", appliedReferral.referrer_user_id)
            .limit(1)
            .maybeSingle();

          await supabase.from("client_referrals" as any).insert({
            referral_code_used: appliedReferral.code,
            referrer_user_id: appliedReferral.referrer_user_id,
            referrer_account_id: referrerAcct?.id || null,
            referred_user_id: userId,
            referred_account_id: accountId,
            referred_order_id: response.order_id,
            status: "pending",
            qualifying_cycles_paid: 0,
            required_cycles: 2,
            reward_status: "not_eligible",
            reward_type: "gift_card",
            reward_amount: 25.00,
            discount_total_months: 10,
          });

          // Activate referral discount on the new subscription tied to this account.
          // billing_subscriptions.customer_id → billing_customers.id ; billing_customers.user_id → accounts.client_id
          const { data: bcRows } = await supabase
            .from("billing_customers")
            .select("id")
            .eq("user_id", userId)
            .limit(1);
          const bcId = bcRows?.[0]?.id;
          if (bcId) {
            await supabase
              .from("billing_subscriptions")
              .update({
                referral_discount_active: true,
                referral_discount_amount: 5.00,
                referral_discount_months_remaining: 10,
                referral_code_used: appliedReferral.code,
              } as any)
              .eq("customer_id", bcId)
              .eq("order_id", response.order_id);
          }

          // Clear the saved referral code — used now.
          try { localStorage.removeItem("nivra_ref_code"); } catch { /* noop */ }
        } catch (e) {
          console.warn("[GuestCheckout] Client-referral tracking failed (non-blocking):", e);
        }
      }

      try {
        const checks = await Promise.allSettled([
          supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle(),
          supabase.from("accounts").select("id").eq("client_id", userId).limit(1),
          supabase.from("billing_invoices").select("id").eq("order_id", response.order_id).limit(1),
          supabase.from("orders").select("pricing_snapshot").eq("id", response.order_id).maybeSingle(),
          supabase.from("billing_invoice_lines").select("id").eq("invoice_id", response.invoice_id).limit(1),
          supabase.from("billing_payments").select("id").eq("invoice_id", response.invoice_id).limit(1),
          supabase.from("checkout_consent_records" as any).select("id").eq("order_id", response.order_id).limit(1),
        ]);
        const labels = ["profile", "account", "invoice", "pricing_snapshot", "invoice_lines", "payment", "consent_record"];
        for (let i = 0; i < checks.length; i++) {
          const result = checks[i];
          const hasData = result.status === "fulfilled" && (
            Array.isArray(result.value?.data) ? result.value.data.length > 0 : !!result.value?.data
          );
          if (!hasData) {
            try {
              await supabase.from("billing_system_alerts" as any).insert({
                alert_type: "data_integrity",
                entity_type: labels[i],
                entity_id: response.order_id,
                entity_reference: response.order_number,
                details: { missing: labels[i], order_id: response.order_id, user_id: userId },
                is_resolved: false,
              });
            } catch { /* non-blocking */ }
          }
        }
      } catch (e) {
        console.warn("[GuestCheckout] Data integrity check failed:", e);
      }

      // Step 8 (optional): PayPal pre-authorized recurring billing enrollment.
      // When the client opted in via AutoPayPalOption, create a PayPal subscription
      // and redirect to PayPal's approval page. The webhook + return handler
      // (/commander/paypal-retour) take over from there.
      if (enableAutoBilling && paymentMethod === "paypal") {
        try {
          const monthlyAfterDiscount = Math.max(0, monthlyTotalWithTax - AUTOPAY_DISCOUNT);
          const planLabel = selectedServices.map(s => s.name).join(" + ") || "Forfait Nivra";

          const { data: subData, error: subErr } = await supabase.functions.invoke(
            "billing-create-order-with-paypal-subscription",
            {
              body: {
                user_id: userId,
                first_name: firstName.trim(),
                last_name: lastName.trim(),
                email: email.trim().toLowerCase(),
                phone: phone.trim(),
                order_id: response.order_id,
                order_number: response.order_number,
                enable_auto_billing: true,
                services: selectedServices.map(s => ({
                  plan_code: s.plan_code || s.sku || s.id,
                  plan_name: s.name,
                  plan_price: toMoney(s.price),
                  category: s.category,
                })),
              },
            }
          );

          if (subErr) throw subErr;
          if (!subData?.success || !subData?.approval_url) {
            throw new Error(subData?.error || "Réponse PayPal invalide");
          }

          // Persist pending order so /commander/paypal-retour can reconcile.
          try {
            localStorage.setItem(
              "nivra-paypal-pending-order",
              JSON.stringify({
                order_id: response.order_id,
                order_number: response.order_number,
                paypal_subscription_id: subData.paypal_subscription_id,
                monthly_after_discount: monthlyAfterDiscount,
                plan_label: planLabel,
              })
            );
          } catch { /* localStorage may be blocked — non-fatal */ }

          toast.success("Redirection vers PayPal pour approuver le paiement automatique...");
          window.location.href = subData.approval_url;
          return; // halt — PayPal takes over
        } catch (autopayErr: any) {
          console.error("[GuestCheckout] Auto-billing enrollment failed:", autopayErr);
          toast.error(
            "Le paiement automatique n'a pas pu être activé. Votre commande est confirmée et facturée manuellement."
          );
          // fall through to normal confirmation
        }
      }

      cancelAbandonmentEmail();
      setOrderResult({
        orderNumber: response.order_number,
        orderId: response.order_id,
        isNewAccount: accountResult.is_new_account,
      });
      setStep(6);
      toast.success("Commande confirmée !");

    } catch (error: any) {
      console.error("[GuestCheckout] Submit error:", error);
      toast.error(error?.message || "Erreur lors de la soumission");
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // ── Format currency ──
  const fmt = (v: number) => v.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

  return (
    <div style={{ background: '#020209' }} className="relative min-h-screen overflow-hidden">
      <PhotoBg url="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1920&q=80" opacity={0.08} filter="saturate(0.6) brightness(0.65)" />
      <div aria-hidden style={{ position: 'absolute', top: '-15%', right: '-8%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.14) 0%, transparent 65%)', animation: 'n-aurora-1 14s ease-in-out infinite', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', bottom: '-15%', left: '-6%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(6,182,212,0.08) 0%, transparent 65%)', animation: 'n-aurora-2 18s ease-in-out infinite', pointerEvents: 'none' }} />
      <Header />

      <div className="relative container mx-auto px-4 sm:px-6 max-w-[1200px] py-8 lg:py-12">
        <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-2">Commander</h1>
        <p className="text-muted-foreground mb-8">Aucun compte requis — commandez en quelques minutes</p>

        <CheckoutProgress currentStep={step} steps={CHECKOUT_STEPS} isFrench onStepClick={(s) => s < step && step < 6 && setStep(s)} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* ── LEFT COLUMN ── */}
          <div className="lg:col-span-7 xl:col-span-8">

            {/* ═══ STEP 1: FORFAIT ═══ */}
            {step === 1 && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-primary" />
                      Choisissez votre forfait
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {servicesLoading ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {Object.entries(groupedServices).map(([category, items]) => {
                          const Icon = categoryIcons[category] || Package;
                          return (
                            <div key={category}>
                              <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                <Icon className="w-4 h-4" /> {category}
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {items.map(service => {
                                  const selected = selectedServices.some(s => s.id === service.id);
                                  return (
                                    <button
                                      key={service.id}
                                      onClick={() => toggleService(service)}
                                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                                        selected
                                          ? "border-primary bg-primary/5 shadow-sm"
                                          : "border-border hover:border-primary/30 hover:shadow-sm"
                                      }`}
                                    >
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                          <p className="font-semibold text-foreground text-sm">{service.name}</p>
                                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{service.description}</p>
                                        </div>
                                        <div className="flex flex-col items-end ml-3">
                                          <span className="text-lg font-bold text-foreground">{service.price.toFixed(0)}$</span>
                                          <span className="text-xs text-muted-foreground">/mois</span>
                                        </div>
                                      </div>
                                      {selected && (
                                        <div className="mt-2 flex items-center gap-1 text-xs text-primary font-medium">
                                          <Check className="w-3.5 h-3.5" /> Sélectionné
                                        </div>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Button
                  className="w-full h-12 text-base font-bold"
                  disabled={selectedServices.length === 0}
                  onClick={() => setStep(isStreamingOnlyOrder ? 3 : 2)}
                >
                  Continuer <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            )}

            {/* ═══ STEP 2: ADRESSE ═══ */}
            {step === 2 && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-primary" />
                      Adresse de service
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Adresse</Label>
                      <AddressAutocomplete
                        placeholder="Commencez à taper votre adresse..."
                        value={addressStreet}
                        onValueChange={(v) => setAddressStreet(v)}
                        onSelect={(addr: AddressValue) => {
                          setAddressStreet(addr.line1 || addr.formatted);
                          if (addr.city) setAddressCity(addr.city);
                          if (addr.region) setAddressProvince(addr.region);
                          if (addr.postalCode) setAddressPostalCode(addr.postalCode);
                        }}
                        restrictToQuebec
                      />
                    </div>
                    <div>
                      <Label>Appartement (optionnel)</Label>
                      <Input
                        placeholder="Apt 4B"
                        value={addressApartment}
                        onChange={e => setAddressApartment(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Ville</Label>
                        <Input
                          placeholder="Montréal"
                          value={addressCity}
                          onChange={e => setAddressCity(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>Code postal</Label>
                        <Input
                          placeholder="H1A 1A1"
                          value={addressPostalCode}
                          onChange={e => setAddressPostalCode(formatPostalCode(e.target.value))}
                          maxLength={7}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Province</Label>
                      <Input value="Québec" disabled className="bg-muted" />
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Retour
                  </Button>
                  <Button className="flex-1" disabled={!isAddressValid} onClick={() => setStep(3)}>
                    Continuer <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* ═══ STEP 3: INFORMATIONS CLIENT ═══ */}
            {step === 3 && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5 text-primary" />
                      Vos informations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Prénom *</Label>
                        <Input placeholder="Jean" value={firstName} onChange={e => setFirstName(e.target.value)} />
                      </div>
                      <div>
                        <Label>Nom *</Label>
                        <Input placeholder="Tremblay" value={lastName} onChange={e => setLastName(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <Label>Courriel *</Label>
                      <Input type="email" placeholder="jean@exemple.com" value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                    <div>
                      <Label>Téléphone *</Label>
                      <Input
                        type="tel"
                        placeholder="514-555-1234"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Date de naissance *</Label>
                      <Input
                        type="date"
                        value={dateOfBirth}
                        onChange={e => setDateOfBirth(e.target.value)}
                        max={new Date(new Date().setFullYear(new Date().getFullYear() - MIN_AGE_TELECOM)).toISOString().split("T")[0]}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Requis par la réglementation CRTC pour les services de télécommunications. Vous devez avoir {MIN_AGE_TELECOM} ans ou plus.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(isStreamingOnlyOrder ? 1 : 2)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Retour
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={!isClientInfoValid}
                    onClick={async () => {
                      await tryAutoApplyFirstMonthFree();
                      setStep(4);
                    }}
                  >
                    Continuer <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* ═══ STEP 4: OPTIONS ═══ */}
            {step === 4 && (
              <div className="space-y-6">
                {/* Installation */}
                {(hasInternetService || hasTVService) && (
                  <InstallationSection
                    installationChoice={installationChoice}
                    onInstallationChoiceChange={c => setInstallationChoice(c)}
                    selectedDate={selectedDate}
                    selectedTime={selectedTime}
                    onDateTimeChange={(d, t) => { setSelectedDate(d); setSelectedTime(t); }}
                    appointmentConfirmed={appointmentConfirmed}
                    onAppointmentConfirmedChange={setAppointmentConfirmed}
                  />
                )}

                {/* Equipment constraints */}
                {(hasInternetService || hasTVService) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Package className="w-5 h-5 text-primary" />
                        Équipement
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* WiFi Router — max 1 */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">Borne WiFi 6</p>
                          <p className="text-xs text-muted-foreground">Maximum 1 par adresse • {fmt(ROUTER_PRICE)}</p>
                        </div>
                        <Badge variant="secondary">1</Badge>
                      </div>

                      {/* TV Terminals — min 1 if TV, max 4 */}
                      {hasTVService && (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">Terminal TV</p>
                            <p className="text-xs text-muted-foreground">Min 1 avec service TV • Max 4 par adresse • {fmt(terminalPrice ?? 0)}/unité</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm" variant="outline"
                              disabled={tvTerminalQty <= 1}
                              onClick={() => setTvTerminalQty(q => Math.max(1, q - 1))}
                            >−</Button>
                            <span className="w-8 text-center font-semibold text-foreground">{tvTerminalQty}</span>
                            <Button
                              size="sm" variant="outline"
                              disabled={tvTerminalQty >= 4}
                              onClick={() => setTvTerminalQty(q => Math.min(4, q + 1))}
                            >+</Button>
                          </div>
                        </div>
                      )}

                      {hasMobileService && (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {simType === "esim" ? "eSIM" : "Carte SIM physique"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {simType === "esim" ? `${fmt(ESIM_PRICE)}` : `${fmt(SIM_PRICE)}`}
                            </p>
                          </div>
                          <Badge variant="secondary">1</Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* SIM type selector — shown whenever a Mobile plan is in the cart */}
                {hasMobileService && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Smartphone className="w-5 h-5 text-primary" />
                        Quel type de SIM votre appareil utilise-t-il ?
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setSimType("physical")}
                          className={`text-left p-4 rounded-xl border-2 transition-all ${
                            simType === "physical"
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border hover:border-primary/30 hover:shadow-sm"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-foreground text-sm">SIM physique</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Pour la majorité des appareils — Android, iPhone 13 et versions antérieures.
                              </p>
                            </div>
                            <span className="text-sm font-bold text-foreground ml-3">{fmt(SIM_PRICE)}</span>
                          </div>
                          {simType === "physical" && (
                            <div className="mt-2 flex items-center gap-1 text-xs text-primary font-medium">
                              <Check className="w-3.5 h-3.5" /> Sélectionné
                            </div>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => setSimType("esim")}
                          className={`text-left p-4 rounded-xl border-2 transition-all ${
                            simType === "esim"
                              ? "border-primary bg-primary/5 shadow-sm"
                              : "border-border hover:border-primary/30 hover:shadow-sm"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-foreground text-sm">eSIM</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Pour les appareils compatibles — iPhone 14+, Pixel 6+, Samsung Galaxy S21+ et plus récents.
                              </p>
                            </div>
                            <span className="text-sm font-bold text-foreground ml-3">{fmt(ESIM_PRICE)}</span>
                          </div>
                          {simType === "esim" && (
                            <div className="mt-2 flex items-center gap-1 text-xs text-primary font-medium">
                              <Check className="w-3.5 h-3.5" /> Sélectionné
                            </div>
                          )}
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-3">
                        Vérifiez la compatibilité dans les réglages de votre appareil avant de choisir l'eSIM.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* ── Port-in : conservation du numéro ── */}
                {hasMobileService && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Phone className="w-5 h-5 text-primary" />
                        Voulez-vous conserver votre numéro actuel ?
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setWantsPortIn(false)}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${!wantsPortIn ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                        >
                          <p className="font-semibold text-sm">Nouveau numéro</p>
                          <p className="text-xs text-muted-foreground mt-1">Un numéro Nivra vous sera assigné</p>
                          {!wantsPortIn && <p className="text-xs text-primary font-medium mt-2 flex items-center gap-1"><Check className="w-3 h-3" /> Sélectionné</p>}
                        </button>
                        <button
                          type="button"
                          onClick={() => setWantsPortIn(true)}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${wantsPortIn ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                        >
                          <p className="font-semibold text-sm">Garder mon numéro</p>
                          <p className="text-xs text-muted-foreground mt-1">Transférer depuis votre opérateur actuel</p>
                          {wantsPortIn && <p className="text-xs text-primary font-medium mt-2 flex items-center gap-1"><Check className="w-3 h-3" /> Sélectionné</p>}
                        </button>
                      </div>

                      {wantsPortIn && (
                        <div className="space-y-3 pt-1">
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            Ayez votre contrat ou votre facture de votre opérateur actuel sous la main — vous aurez besoin de votre numéro de compte.
                          </div>
                          <div>
                            <Label className="text-xs font-medium mb-1.5 block">Numéro à transférer <span className="text-destructive">*</span></Label>
                            <div className="relative">
                              <Input
                                value={portInNumber}
                                onChange={e => {
                                  setPortInNumber(e.target.value);
                                  setPortInCarrierDetected(null);
                                }}
                                placeholder="514 555-1234"
                                className="h-11 pr-10"
                                inputMode="numeric"
                              />
                              {portInCarrierLoading && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                              )}
                            </div>
                            {portInCarrierDetected && !portInCarrierLoading && (
                              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Transporteur d'origine probable : {portInCarrierDetected} — sélectionnez votre transporteur actuel ci-dessous
                              </p>
                            )}
                          </div>
                          <div>
                            <Label className="text-xs font-medium mb-1.5 block">Opérateur actuel <span className="text-destructive">*</span></Label>
                            <select
                              value={portInCarrier}
                              onChange={e => setPortInCarrier(e.target.value)}
                              className="w-full h-11 rounded-md border border-input bg-background px-3 text-sm"
                            >
                              {["Rogers", "Bell", "Telus", "Fido", "Koodo", "Vidéotron", "Fizz", "Public Mobile", "Autre"].map(c => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label className="text-xs font-medium mb-1.5 block">Numéro de compte chez l'opérateur actuel <span className="text-destructive">*</span></Label>
                            <Input
                              value={portInAccountNumber}
                              onChange={e => setPortInAccountNumber(e.target.value)}
                              placeholder="Ex: 12345678"
                              className="h-11"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-medium mb-1.5 block">NIP / PIN de transfert <span className="text-muted-foreground font-normal">(si requis par votre opérateur)</span></Label>
                            <Input
                              value={portInPin}
                              onChange={e => setPortInPin(e.target.value)}
                              placeholder="4 chiffres"
                              maxLength={8}
                              className="h-11"
                            />
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Le transfert de numéro prend généralement 1-3 jours ouvrables. Votre service actuel reste actif jusqu'à la complétion du transfert.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {!welcomeDiscountDismissed && !appliedPromo && normalizedPricing?.welcome_applied && (
                  <Card className="bg-emerald-500/10 border-emerald-500/30">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Star className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                          <div>
                            <p className="font-semibold text-foreground text-sm">Rabais bienvenue appliqué !</p>
                            <p className="text-xs text-muted-foreground">
                              50% de rabais sur votre premier mois — appliqué automatiquement.
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setWelcomeDiscountDismissed(true)}
                        >
                          Retirer
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Auto-applied first-month-free banner */}
                {autoAppliedPromo && appliedPromo?.code === "BIENVENUE2026" && (
                  <Card className="bg-emerald-50 border-emerald-300">
                    <CardContent className="py-4">
                      <div className="flex items-start gap-3">
                        <Gift className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-emerald-700 text-sm mb-1">
                            🎉 Premier mois gratuit appliqué automatiquement!
                          </p>
                          <p className="text-xs text-emerald-800 leading-relaxed">
                            Nous avons détecté que vous êtes un nouveau client Nivra Telecom.
                            Votre premier mois de service est entièrement gratuit — aucun code requis.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ── Phase 2: Shipping override + activation date + installation details ── */}
                <CheckoutShippingAndActivation
                  shipping={shippingData}
                  onShippingChange={setShippingData}
                  activation={activationData}
                  onActivationChange={setActivationData}
                  installationDetails={installationDetailsData}
                  onInstallationDetailsChange={setInstallationDetailsData}
                  showInstallationDetails={hasInternetService || hasTVService}
                />

                {/* Promo / Referral */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Gift className="w-5 h-5 text-primary" />
                      Promotions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <PromoCodeInput
                      clientEmail={email}
                      cartItems={selectedServices.map(s => ({ type: 'service' as const, amount: s.price, name: s.name }))}
                      subtotalBeforeDiscount={subtotal}
                      onPromoApplied={(promo) => {
                        setAppliedPromo(promo);
                        if (!promo) setAutoAppliedPromo(false);
                        if (promo) setWelcomeDiscountDismissed(true);
                      }}
                      appliedPromo={appliedPromo}
                      duplicateFirstMonthFreeMessage={
                        autoAppliedPromo
                          ? "Votre premier mois gratuit est déjà appliqué automatiquement."
                          : undefined
                      }
                    />
                    <ReferralCodeInput
                      clientEmail={email}
                      cartItems={selectedServices.map(s => ({ type: 'service', amount: s.price, name: s.name }))}
                      subtotalBeforeDiscount={subtotal}
                      hasActivePromoDiscount={!!appliedPromo && appliedPromo.discount_amount > 0}
                      onReferralApplied={setAppliedReferral}
                      appliedReferral={appliedReferral}
                    />
                  </CardContent>
                </Card>

                {/* Notes */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Notes (optionnel)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Instructions spéciales, commentaires..."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={3}
                    />
                  </CardContent>
                </Card>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Retour
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={
                      (requiresInstallation && (!selectedDate || !selectedTime)) ||
                      !!validateShipping(shippingData) ||
                      !!validateActivation(activationData)
                    }
                    onClick={() => {
                      const shipErr = validateShipping(shippingData);
                      if (shipErr) { toast.error(shipErr); return; }
                      const actErr = validateActivation(activationData);
                      if (actErr) { toast.error(actErr); return; }
                      setStep(5);
                    }}
                  >
                    Continuer au paiement <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* ═══ STEP 5: PAIEMENT ═══ */}
            {step === 5 && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-primary" />
                      Paiement
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* ── Card-only payment (processed by PayPal, no account required) ── */}
                    <div>
                      <div className="text-[10px] tracking-[2px] uppercase text-muted-foreground mb-3">
                        Méthode de paiement
                      </div>

                      {/* Card brand badges */}
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-[11px] font-extrabold text-white px-2.5 py-1 rounded" style={{ background: '#1A1F71' }}>VISA</span>
                        <span className="text-[11px] font-extrabold text-white px-2.5 py-1 rounded" style={{ background: '#EB001B' }}>MC</span>
                        <span className="text-[11px] font-extrabold text-white px-2.5 py-1 rounded -ml-1" style={{ background: '#F79E1B' }}>●</span>
                      </div>

                      {/* Reassurance box — first month free + 30-day guarantee */}
                      <div
                        className="rounded-xl border p-4 mb-3"
                        style={{ background: '#ECFDF5', borderColor: '#A7F3D0' }}
                      >
                        <ul className="space-y-1.5 text-[13px] leading-relaxed" style={{ color: '#065F46' }}>
                          <li className="flex items-start gap-2">
                            <span className="shrink-0">✅</span>
                            <span>
                              <strong>Premier mois 100% gratuit</strong> — vous ne payez que l'équipement aujourd'hui
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="shrink-0">🔄</span>
                            <span>
                              <strong>Satisfait ou remboursé</strong> — retournez l'équipement dans 30 jours si insatisfait
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="shrink-0">📦</span>
                            <span>Nivra paie les frais de retour</span>
                          </li>
                        </ul>
                      </div>

                      {/* Reassurance box */}
                      <div className="rounded-xl border p-4 mb-4 flex items-start gap-3" style={{ background: '#F0F7FF', borderColor: '#BFDBFE' }}>
                        <div className="text-xl shrink-0">💳</div>
                        <div>
                          <div className="text-sm font-bold mb-1" style={{ color: '#1E40AF' }}>
                            Payez par carte de crédit ou débit — aucun compte PayPal requis
                          </div>
                          <div className="text-[13px] leading-relaxed" style={{ color: '#3B82F6' }}>
                            Notre système de paiement sécurisé accepte Visa et Mastercard directement.
                            Vous n'avez pas besoin d'un compte PayPal pour compléter votre achat.
                          </div>
                        </div>
                      </div>

                      {/* Payment buttons */}
                      {!paypalCaptureId && (
                        <PayPalButton
                          amount={todayTotal}
                          orderId={clientCartIdRef.current}
                          description={`Nivra — ${selectedServices.map(s => s.name).join(", ")}`}
                          customer={{
                            first_name: firstName,
                            last_name: lastName,
                            email,
                            phone,
                            address: {
                              address_line_1: addressStreet,
                              admin_area_2: addressCity,
                              admin_area_1: addressProvince,
                              postal_code: addressPostalCode.replace(/\s/g, ""),
                              country_code: "CA",
                            },
                          }}
                          onSuccess={(captureId) => {
                            setPaypalCaptureId(captureId);
                            setPaymentComplete(true);
                            toast.success("Paiement confirmé !");
                          }}
                          onError={(err) => console.error("[PayPal]", err)}
                          disabled={todayTotal <= 0}
                        />
                      )}

                      {!!paypalCaptureId && (
                        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                          <div>
                            <p className="font-semibold text-emerald-800">Paiement confirmé</p>
                            <p className="text-xs text-emerald-600">Réf: {paypalCaptureId}</p>
                          </div>
                        </div>
                      )}

                      <div className="text-center text-xs text-muted-foreground mt-3">
                        🔒 Paiement traité de façon sécurisée par PayPal · Vos informations bancaires ne sont jamais partagées
                      </div>
                    </div>

                    <Separator />

                    {/* ── PayPal Pre-Authorized Auto-Billing Option (Step 1+2) ── */}
                    {paymentMethod === "paypal" && monthlyTotalWithTax > AUTOPAY_DISCOUNT && (
                      <AutoPayPalOption
                        isFrench
                        isEnabled={enableAutoBilling}
                        onEnabledChange={setEnableAutoBilling}
                        monthlyAmount={monthlyTotalWithTax}
                        discountAmount={AUTOPAY_DISCOUNT}
                      />
                    )}

                    <Separator />

                    {/* Legal Checklist - Full CheckoutEssentialTerms */}
                    <CheckoutEssentialTermsBase
                      isFrench
                      checklist={legalChecklist}
                      onChecklistChange={(key, checked) => setLegalChecklist(prev => ({ ...prev, [key]: checked }))}
                      paymentMethod={paymentMethod || undefined}
                    />

                    {/* Trust badges */}
                    <div className="flex flex-wrap items-center justify-center gap-4 pt-4 pb-2 border-t border-border mt-4">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Lock className="w-3.5 h-3.5 text-emerald-600" />
                        SSL 256-bit
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        Sans contrat
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Shield className="w-3.5 h-3.5 text-emerald-600" />
                        Remboursement 30 jours
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        🇨🇦 Entreprise québécoise
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(4)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Retour
                  </Button>
                  <Button
                    className="flex-1 h-12 text-base font-bold"
                    disabled={!isPaymentDone || !isLegalComplete || isSubmitting}
                    onClick={handleSubmit}
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Traitement...</>
                    ) : enableAutoBilling ? (
                      <>Activer le paiement automatique <ArrowRight className="w-5 h-5 ml-2" /></>
                    ) : (
                      <>Confirmer la commande <Check className="w-5 h-5 ml-2" /></>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* ═══ STEP 6: CONFIRMATION ═══ */}
            {step === 6 && orderResult && (
              <ConfirmationSuccess
                isFrench
                orderNumber={orderResult.orderNumber}
                serviceName={selectedServices.map(s => s.name).join(", ") || "Forfait Nivra"}
                serviceDescription={selectedServices.length > 1 ? `${selectedServices.length} services` : undefined}
                totalPaid={todayTotal}
                monthlyAmount={monthlyTotalWithTax}
                installationAddress={addressStreet ? `${addressStreet}, ${addressCity}` : undefined}
                installationDate={selectedDate || undefined}
                installationTime={selectedTime || undefined}
                installationMethod={installationChoice === "technician" ? "technician" : "auto"}
                onViewOrders={() => navigate("/portal")}
                onPrint={() => window.print()}
              />
            )}
          </div>

          {/* ── RIGHT COLUMN: ORDER SUMMARY (sticky) ── */}
          {step < 6 && (
            <div className="hidden lg:block lg:col-span-5 xl:col-span-4">
              <div className="sticky top-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4 text-primary" />
                      Résumé de commande
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedServices.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Aucun forfait sélectionné</p>
                    ) : (
                      <>
                        {/* Services */}
                        {selectedServices.map(s => (
                          <div key={s.id} className="flex justify-between text-sm">
                            <span className="text-foreground">{s.name}</span>
                            <span className="font-medium">{fmt(s.price)}/mois</span>
                          </div>
                        ))}

                        <Separator />

                        {/* Monthly */}
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Mensuel (taxes incl.)</span>
                          <span className="font-semibold text-foreground">{fmt(monthlyTotalWithTax)}</span>
                        </div>

                        <Separator />

                        {/* One-time fees */}
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Frais aujourd'hui</p>
                          {activationFee > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Activation</span>
                              <span>{fmt(activationFee)}</span>
                            </div>
                          )}
                          {routerFee > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Routeur</span>
                              <span>{fmt(routerFee)}</span>
                            </div>
                          )}
                          {terminalFee > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Terminal TV ×{tvTerminalQty}</span>
                              <span>{fmt(terminalFee)}</span>
                            </div>
                          )}
                          {simFee > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Carte SIM</span>
                              <span>{fmt(simFee)}</span>
                            </div>
                          )}
                          {deliveryFee > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Livraison</span>
                              <span>{fmt(deliveryFee)}</span>
                            </div>
                          )}
                          {installationFee > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">Installation</span>
                              <span>{fmt(installationFee)}</span>
                            </div>
                          )}
                        </div>

                        {/* Discount */}
                        {normalizedPricing && toNonNegativeMoney(normalizedPricing.discount_total_combined) > 0 && (
                          <div className="flex justify-between text-xs text-emerald-600">
                            <span>Rabais</span>
                            <span>-{fmt(toNonNegativeMoney(normalizedPricing.discount_total_combined))}</span>
                          </div>
                        )}

                        {/* Pre-authorized auto-billing discount (recurring monthly) */}
                        {enableAutoBilling && (
                          <div className="flex justify-between text-xs text-emerald-600">
                            <span>Rabais pré-autorisé (mensuel)</span>
                            <span>-{fmt(AUTOPAY_DISCOUNT)}/mois</span>
                          </div>
                        )}

                        {/* Taxes */}
                        {normalizedPricing && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>TPS (5%)</span>
                              <span>{fmt(normalizedPricing.tps_amount)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>TVQ (9,975%)</span>
                              <span>{fmt(normalizedPricing.tvq_amount)}</span>
                            </div>
                          </div>
                        )}

                        <Separator />

                        {/* Total */}
                        <div className="flex justify-between items-baseline">
                          <span className="font-bold text-foreground">Total aujourd'hui</span>
                          {isServerPricingLoading ? (
                            <Skeleton className="h-6 w-20" />
                          ) : (
                            <span className="text-xl font-black text-foreground">{fmt(todayTotal)}</span>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
                <div className="mt-4"><SecurityTrustBox isFrench /></div>
              </div>
            </div>
          )}
        </div>

        {/* ═══ MOBILE FIXED BOTTOM BAR ═══ */}
        {step < 6 && selectedServices.length > 0 && (
          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border shadow-lg px-4 py-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Total aujourd'hui</span>
              <span className="font-bold text-foreground">{fmt(todayTotal)}</span>
            </div>
            <div className="text-[10px] text-muted-foreground text-center">
              Étape {step} / 5 • {fmt(monthlyTotalWithTax)}/mois après
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GuestCheckout;
