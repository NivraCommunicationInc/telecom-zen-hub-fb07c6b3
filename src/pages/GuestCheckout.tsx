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
import { CartResumeBanner } from "@/components/checkout/CartResumeBanner";
import { useCheckoutDraft } from "@/hooks/useCheckoutDraft";
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
import { SquarePaymentForm } from "@/components/payment/SquarePaymentForm";
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
import { confirmAppointmentHold } from "@/lib/appointmentHold";
import { readPrecheckedAddress, clearPrecheckedAddress } from "@/lib/checkout/prechekedAddress";
import { buildOrderLineItems, wrapLineItemsForOrder } from "@/lib/orderLineItems";
import { toast } from "sonner";
import {
  ShoppingCart, ArrowRight, ArrowLeft, Check, Wifi, Tv, Smartphone, Shield,
  Package, MonitorPlay, User, MapPin, CreditCard, Calendar, Gift, Info,
  AlertCircle, Lock, Mail, Phone, Home, Star, CheckCircle2, Loader2, Zap, FileCheck
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

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
  { id: 4, labelFr: "Installation", labelEn: "Installation" },
  { id: 5, labelFr: "Options & Livraison", labelEn: "Options & Delivery" },
  { id: 6, labelFr: "Paiement", labelEn: "Payment" },
  { id: 7, labelFr: "Confirmation", labelEn: "Confirmation" },
];

const CHECKOUT_DRAFT_KEY = "nivra_checkout_draft";
const ABANDONMENT_EMAIL_KEY = "nivra_abandonment_email_id";

const GuestCheckout = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientRequestIdRef = useRef(crypto.randomUUID());
  const submittingRef = useRef(false);
  const abandonmentTrackedRef = useRef(false);
  const precreatedCheckoutRef = useRef<NivraFullCheckoutResponse | null>(null);

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
  // Sub-phase inside step 4: "choice" (installation type + questionnaire) → "schedule" (calendar)
  const [installationPhase, setInstallationPhase] = useState<"choice" | "schedule">("choice");
  // Raw coaxial questionnaire answers — mirrored onto orders.coaxial_survey after submit
  // for cross-portal consistency with UnifiedPOS / Field flows.
  const [coaxialSurveyPayload, setCoaxialSurveyPayload] = useState<Record<string, unknown> | null>(null);
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

  // ── Panier persistant 30 jours (localStorage + DB mirror) ──
  const [draftDismissed, setDraftDismissed] = useState(false);
  const {
    draft: savedDraft,
    hasDraft,
    save: saveDraft,
    clear: clearDraft,
  } = useCheckoutDraft<{
    selectedServices: Service[];
    addressStreet: string;
    addressApartment: string;
    addressCity: string;
    addressProvince: string;
    addressPostalCode: string;
  }>("guest_checkout");

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

    // ── Hydrate service address from the pre-checkout coverage step ──
    // (customer already validated their address on /internet or /tv-plus)
    try {
      const pre = readPrecheckedAddress();
      if (pre) {
        // Only pre-fill fields the customer hasn't already touched in a saved draft.
        setAddressStreet(prev => prev || pre.line1);
        setAddressCity(prev => prev || pre.city);
        setAddressProvince(prev => prev || (pre.region || "QC"));
        setAddressPostalCode(prev => prev || pre.postalCode);
        clearPrecheckedAddress();
      }
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sauvegarder le state dans sessionStorage à chaque changement ──
  useEffect(() => {
    if (step === 7) { sessionStorage.removeItem(CHECKOUT_DRAFT_KEY); return; }
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

  // ── Mirror panier vers localStorage 30 jours (survit à la fermeture du navigateur) ──
  useEffect(() => {
    if (step === 7) { clearDraft(); return; }
    if (selectedServices.length === 0) return;
    saveDraft({
      selectedServices,
      addressStreet, addressApartment, addressCity, addressProvince, addressPostalCode,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedServices, addressStreet, addressApartment, addressCity, addressProvince, addressPostalCode]);

  const handleResumeDraft = () => {
    if (!savedDraft) return;
    if (savedDraft.selectedServices?.length) setSelectedServices(savedDraft.selectedServices);
    if (savedDraft.addressStreet) setAddressStreet(savedDraft.addressStreet);
    if (savedDraft.addressApartment) setAddressApartment(savedDraft.addressApartment);
    if (savedDraft.addressCity) setAddressCity(savedDraft.addressCity);
    if (savedDraft.addressProvince) setAddressProvince(savedDraft.addressProvince);
    if (savedDraft.addressPostalCode) setAddressPostalCode(savedDraft.addressPostalCode);
    setDraftDismissed(true);
  };
  const handleDismissDraft = () => { clearDraft(); setDraftDismissed(true); };

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
  // Auto-installation is always free — no delivery/shipping fee charged to customer for self-install.
  const deliveryFee = 0;
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
  const handleSubmit = async (
    captureOverride?: string,
    options?: { allowIncompleteLegal?: boolean; precreateOnly?: boolean },
  ): Promise<NivraFullCheckoutResponse | void> => {
    if (submittingRef.current || isSubmitting) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    const effectiveCaptureId = captureOverride || paypalCaptureId;
    const effectivePaymentDone = paymentComplete || !!effectiveCaptureId || !!options?.precreateOnly;

    try {
      // Validate DOB
      const dobResult = validateDob(dateOfBirth, { minAge: MIN_AGE_TELECOM, required: true });
      if (!dobResult.isValid) {
        toast.error(dobResult.error?.fr || "Date de naissance invalide");
        return;
      }

      if (!isLegalComplete && !options?.allowIncompleteLegal) {
        toast.error("Veuillez compléter la checklist des conditions essentielles");
        return;
      }


      if (!effectivePaymentDone) {
        toast.error("Veuillez compléter le paiement");
        return;
      }

      // ── Sauvegarder le paiement immédiatement — avant toute autre opération ──
      // Si le client rafraîchit la page après paiement, on garde la trace
      if (effectiveCaptureId) {
        sessionStorage.setItem("nivra_pending_payment", JSON.stringify({
          captureId: effectiveCaptureId,
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
        console.error("[GuestCheckout] All account creation methods failed. Payment captured:", effectiveCaptureId);
        setOrderResult({
          orderNumber: effectiveCaptureId,
          orderId: effectiveCaptureId,
          isNewAccount: false,
          paymentOnly: true,
        });
        cancelAbandonmentEmail();
        setStep(7);
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

      const paymentMethodValue = "card";

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
          status: effectiveCaptureId ? "captured" : "pending",
          reference: effectiveCaptureId || etransferRef || null,
          paypal_capture_id: effectiveCaptureId || null,
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
          coaxial_survey: coaxialSurveyPayload,
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

      // Link the public checkout appointment hold to the final order when available.
      // If the buyer was a guest before account creation, no backend hold existed yet;
      // create the confirmed appointment now so Core and public capacity stay synchronized.
      if (requiresInstallation && installationChoice === "technician" && selectedDate && selectedTime) {
        try {
          const linkedExistingHold = await confirmAppointmentHold(response.order_id);
          if (!linkedExistingHold) {
            await supabase.from("appointments").insert({
              order_id: response.order_id,
              client_id: userId,
              client_email: email.trim().toLowerCase(),
              client_phone: phone.trim() || null,
              title: `Installation Technicien - ${selectedServices.map(s => s.name).join(" + ") || "Service Nivra"}`,
              description: selectedTime,
              service_type: selectedServices.map(s => s.category || s.name).join(" + ") || "Internet",
              service_address: addressStreet,
              service_city: addressCity || null,
              service_postal_code: addressPostalCode || null,
              installation_method: "technician",
              scheduled_at: selectedDate,
              delivery_fee: deliveryFee,
              installation_fee: installationFee,
              equipment_details: checkoutPayload.equipment as any,
              status: "confirmed",
              created_by: userId,
              environment: "live",
              internal_notes: [
                installationDetailsData.coaxAvailable ? `Coax: ${installationDetailsData.coaxAvailable}` : null,
                installationDetailsData.occupancyStatus ? `Statut: ${installationDetailsData.occupancyStatus}` : null,
                installationDetailsData.accessNotes ? `Accès: ${installationDetailsData.accessNotes}` : null,
              ].filter(Boolean).join("\n") || null,
            } as any);
          }
        } catch (e) {
          console.warn("[GuestCheckout] Appointment link/create failed (non-blocking):", e);
        }
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
      // F33-2/F33-3 — Client-referral attach is now server-side only.
      // Direct writes on client_referrals + billing_subscriptions from the
      // browser are blocked at DB level (Phase A part 1).
      if (appliedReferral && appliedReferral.type === "client" && appliedReferral.referrer_user_id) {
        try {
          await supabase.functions.invoke("referrals-attach-on-order", {
            body: {
              referral_code: appliedReferral.code,
              order_id: response.order_id,
              referred_user_id: userId,
              referred_email: (email || "").toLowerCase() || undefined,
              idempotency_key: `guest:${response.order_id}:${appliedReferral.code}`,
            },
          });
          try { localStorage.removeItem("nivra_ref_code"); } catch { /* noop */ }
        } catch (e) {
          console.warn("[GuestCheckout] referrals-attach-on-order failed (non-blocking):", e);
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

      // Phase 3.B.3 — PayPal recurring enrollment removed.
      // Autopay is now handled by Square post-checkout (Phase 3.C).
      // Any legacy client that still opts into `enableAutoBilling` falls
      // through to the normal confirmation path (single Square capture already
      // completed above); recurring will be re-enrolled via Square later.


      if (options?.precreateOnly) {
        precreatedCheckoutRef.current = response;
        return response;
      }

      cancelAbandonmentEmail();
      setOrderResult({
        orderNumber: response.order_number,
        orderId: response.order_id,
        isNewAccount: false,
      });
      setStep(7);
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

  // ── Auto-scroll to active step on step change ──
  useEffect(() => {
    if (step >= 6) return;
    const el = document.getElementById(`step-${step}`);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 140;
      window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
    }
  }, [step]);

  // ── Mobile summary sheet ──
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);

  // ── Step accordion metadata ──
  const stepTitles: Record<number, { title: string; icon: any }> = {
    1: { title: "Choisissez votre forfait", icon: ShoppingCart },
    2: { title: "Adresse de service", icon: MapPin },
    3: { title: "Vos informations", icon: User },
    4: { title: "Installation", icon: Package },
    5: { title: "Options et livraison", icon: Gift },
    6: { title: "Paiement sécurisé", icon: CreditCard },
  };

  const stepSummary = (id: number): string => {
    switch (id) {
      case 1:
        return selectedServices.length > 0 ? selectedServices.map(s => s.name).join(", ") : "";
      case 2:
        return addressStreet
          ? `${addressStreet}${addressApartment ? " apt " + addressApartment : ""}, ${addressCity} ${addressPostalCode}`.trim()
          : "";
      case 3:
        return (firstName || lastName || email)
          ? [
              `${firstName} ${lastName}`.trim(),
              email,
              phone,
            ].filter(Boolean).join(" · ")
          : "";
      case 4:
        return [
          (hasInternetService || hasTVService)
            ? (installationChoice === "technician" ? "Installation par technicien" : "Auto-installation")
            : null,
          selectedDate ? `${selectedDate} ${selectedTime || ""}`.trim() : null,
        ].filter(Boolean).join(" · ");
      case 5:
        return [
          hasMobileService ? (simType === "esim" ? "eSIM" : "SIM physique") : null,
          hasMobileService ? (wantsPortIn ? `Transfert (${portInCarrier})` : "Nouveau numéro") : null,
          shippingData.shipToDifferentAddress ? "Livraison alternative" : null,
          activationData.activationPreference === "SCHEDULED" && activationData.requestedActivationDate
            ? `Activation ${activationData.requestedActivationDate.toLocaleDateString("fr-CA")}`
            : "Activation dès que possible",
          appliedPromo ? `Code ${appliedPromo.code}` : null,
        ].filter(Boolean).join(" · ");
      default:
        return "";
    }
  };

  const renderStepShell = (id: number, content: React.ReactNode) => {
    const meta = stepTitles[id];
    const Icon = meta.icon;
    const isOpen = step === id;
    const isDone = step > id;
    if (isOpen) {
      return (
        <div id={`step-${id}`} key={id} className="scroll-mt-32 animate-fade-in">
          {content}
        </div>
      );
    }
    if (isDone) {
      return (
        <div
          id={`step-${id}`}
          key={id}
          className="scroll-mt-32 bg-white rounded-xl border border-[#E5E7EB] shadow-sm px-4 py-3.5 flex items-center justify-between gap-3 transition-all duration-300"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-full bg-[#00A651] text-white flex items-center justify-center shrink-0">
              <Check className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-[#00A651] uppercase tracking-wide">Étape {id} · Complétée</p>
              <p className="text-sm font-semibold text-[#1A1A2E] truncate">
                {meta.title}
                {stepSummary(id) ? <span className="font-normal text-[#6B7280]"> — {stepSummary(id)}</span> : null}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStep(id)}
            className="text-sm font-semibold text-[#0066CC] hover:text-[#0052A3] hover:underline shrink-0"
          >
            Modifier
          </button>
        </div>
      );
    }
    return (
      <div
        id={`step-${id}`}
        key={id}
        className="scroll-mt-32 bg-white/70 rounded-xl border border-dashed border-[#E5E7EB] px-4 py-3.5 flex items-center gap-3 opacity-70 transition-all"
      >
        <div className="w-9 h-9 rounded-full bg-[#F3F4F6] text-[#6B7280] flex items-center justify-center text-sm font-bold shrink-0">{id}</div>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-[#9CA3AF]" />
          <p className="text-sm font-semibold text-[#6B7280]">{meta.title}</p>
        </div>
      </div>
    );
  };

  // ── Bell-style horizontal progress bar (desktop) — inserts a virtual "Rendez-vous" chip after step 4 when technician install is required ──
  const renderDesktopProgress = () => {
    const base = CHECKOUT_STEPS.filter(s => s.id <= 6);
    type Chip = { id: number; virtualPhase?: "schedule"; labelFr: string };
    const chips: Chip[] = [];
    base.forEach(s => {
      chips.push({ id: s.id, labelFr: s.id === 4 ? "Installation" : s.labelFr });
      if (s.id === 4 && requiresInstallation) {
        chips.push({ id: 4, virtualPhase: "schedule", labelFr: "Rendez-vous" });
      }
    });
    return (
      <div className="hidden md:flex items-center">
        {chips.map((c, idx, arr) => {
          const isSchedulePhase = c.virtualPhase === "schedule";
          // Done logic: step passed OR (still on step 4 and past the choice phase for the schedule chip)
          const isDone = isSchedulePhase
            ? step > 4 || (step === 4 && installationPhase === "schedule" && appointmentConfirmed)
            : c.id === 4
              ? step > 4 || (step === 4 && installationPhase === "schedule")
              : step > c.id;
          const isCurrent = isSchedulePhase
            ? step === 4 && installationPhase === "schedule"
            : c.id === 4
              ? step === 4 && installationPhase === "choice"
              : step === c.id;
          return (
            <div key={`${c.id}-${c.virtualPhase || "main"}`} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    if (!isDone) return;
                    if (isSchedulePhase) { setStep(4); setInstallationPhase("schedule"); }
                    else if (c.id === 4) { setStep(4); setInstallationPhase("choice"); }
                    else setStep(c.id);
                  }}
                  disabled={!isDone}
                  className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all shrink-0 ${isDone ? "cursor-pointer hover:scale-105" : "cursor-default"}`}
                  style={
                    isDone
                      ? { background: "#00A651", borderColor: "#00A651", color: "#fff" }
                      : isCurrent
                        ? { background: "#0066CC", borderColor: "#0066CC", color: "#fff", boxShadow: "0 0 0 5px rgba(0,102,204,0.15)" }
                        : { background: "#fff", borderColor: "#E5E7EB", color: "#9CA3AF" }
                  }
                >
                  {isDone ? <Check className="w-5 h-5" /> : (idx + 1)}
                </button>
                <span
                  className={`text-xs font-semibold whitespace-nowrap ${isDone ? "text-[#00A651]" : isCurrent ? "text-[#0066CC]" : "text-[#9CA3AF]"}`}
                >
                  {c.labelFr}
                </span>
              </div>
              {idx < arr.length - 1 && (
                <div className="flex-1 h-[3px] mx-2 lg:mx-3 rounded-full overflow-hidden bg-[#E5E7EB] mb-6">
                  <div
                    className="h-full transition-all duration-500 rounded-full"
                    style={{ width: isDone ? "100%" : "0%", background: "#00A651" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col">
      {/* ═══ CHECKOUT HEADER — slim, focus purchase ═══ */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#E5E7EB] shadow-sm">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-2 group"
            aria-label="Retour à l'accueil Nivra"
          >
            <span className="text-2xl font-black tracking-tight text-[#0066CC] group-hover:text-[#0052A3] transition-colors">nivra</span>
            <span className="hidden sm:inline text-[10px] font-bold text-[#6B7280] uppercase tracking-widest mt-1">Telecom</span>
          </button>
          <div className="flex items-center gap-4">
            <span className="hidden sm:flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#00A651]">
              <Lock className="w-4 h-4" /> Commande sécurisée
            </span>
            <button
              type="button"
              onClick={() => navigate("/aide")}
              className="text-xs sm:text-sm text-[#6B7280] hover:text-[#1A1A2E] font-medium"
            >
              Besoin d'aide ?
            </button>
          </div>
        </div>
      </header>

      {/* ═══ BELL-STYLE PROGRESS BAR ═══ */}
      {step < 7 && (
        <div className="bg-white border-b border-[#E5E7EB]">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
            {renderDesktopProgress()}
            {/* Mobile compact */}
            <div className="md:hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wide">
                  Étape {step === 4 && installationPhase === "schedule" ? "4b" : step} / 6
                </span>
                <span className="text-sm font-bold text-[#0066CC]">
                  {step === 4 && installationPhase === "schedule" ? "Rendez-vous" : CHECKOUT_STEPS.find(s => s.id === step)?.labelFr}
                </span>
              </div>
              <div className="h-2 w-full rounded-full overflow-hidden bg-[#E5E7EB]">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round(((step - 1) / 5) * 100)}%`,
                    background: "#0066CC",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
        {/* Trust signals bar */}
        {step < 7 && (
          <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm font-medium text-[#374151]">
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-[#00A651]" /> Sans contrat</span>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-[#00A651]" /> Sans vérification de crédit</span>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-[#00A651]" /> Activation rapide</span>
            <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-[#00A651]" /> Support québécois</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ml-auto" style={{ background: '#00A651', color: '#fff' }}>
              <Gift className="w-3 h-3" /> 1er mois GRATUIT
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">

          {/* ── LEFT COLUMN — accordion form ── */}
          <div className={step < 7 ? "lg:col-span-3 space-y-4 pb-40 lg:pb-0" : "lg:col-span-5"}>

            {/* ═══ STEP 1: FORFAIT ═══ */}
            {step < 7 && renderStepShell(1, step === 1 && (

              <div className="space-y-6">
                {hasDraft && selectedServices.length === 0 && !draftDismissed && (
                  <CartResumeBanner
                    itemCount={savedDraft?.selectedServices?.length || 0}
                    onResume={handleResumeDraft}
                    onDismiss={handleDismissDraft}
                  />
                )}
                <Card className="overflow-hidden border border-[#E5E7EB] rounded-xl shadow-sm bg-white">
                  <CardHeader className="pb-4 border-b border-[#E5E7EB]" style={{ background: '#F0F6FC' }}>
                    <CardTitle className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#0066CC' }}>
                        <ShoppingCart className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-lg font-bold text-[#0066CC]">Choisissez votre forfait</span>
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
                              <h3 className="flex items-center gap-2 text-sm font-semibold text-[#4B5563] uppercase tracking-wider mb-3">
                                <Icon className="w-4 h-4" /> {category}
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {items.map(service => {
                                  const selected = selectedServices.some(s => s.id === service.id);
                                  return (
                                    <button
                                      key={service.id}
                                      onClick={() => toggleService(service)}
                                      className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
                                        selected
                                          ? "border-primary bg-primary/5"
                                          : "border-[#E5E7EB] hover:border-primary/40 hover:bg-primary/5"
                                      }`}
                                      style={selected ? { boxShadow: '0 0 0 2px rgba(124,58,237,0.25), 0 4px 16px rgba(124,58,237,0.15)' } : {}}
                                    >
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                          <p className="font-semibold text-[#1A1A2E] text-sm">{service.name}</p>
                                          <p className="text-xs text-[#4B5563] mt-1 line-clamp-2">{service.description}</p>
                                        </div>
                                        <div className="flex flex-col items-end ml-3">
                                          <span className="text-lg font-bold text-[#0066CC]">{service.price.toFixed(0)}$</span>
                                          <span className="text-xs text-[#4B5563]">/mois</span>
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
                  className="w-full h-14 text-base font-bold rounded-xl"
                  disabled={selectedServices.length === 0}
                  onClick={() => setStep(isStreamingOnlyOrder ? 3 : 2)}
                  style={{ background: selectedServices.length > 0 ? '#0066CC' : undefined, boxShadow: selectedServices.length > 0 ? '0 4px 20px rgba(0,102,204,0.30)' : undefined }}
                >
                  Continuer <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            ))}

            {/* ═══ STEP 2: ADRESSE ═══ */}
            {step < 7 && renderStepShell(2, step === 2 && (
              <div className="space-y-6">
                <Card className="overflow-hidden border border-[#E5E7EB] rounded-xl shadow-sm bg-white">
                  <CardHeader className="pb-4 border-b border-[#E5E7EB]" style={{ background: '#F0F6FC' }}>
                    <CardTitle className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#0066CC' }}>
                        <MapPin className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-lg font-bold text-[#0066CC]">Adresse de service</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-5">
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wide text-[#4B5563] mb-1.5 block">Adresse</Label>
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
                      <Label className="text-xs font-semibold uppercase tracking-wide text-[#4B5563] mb-1.5 block">Appartement (optionnel)</Label>
                      <Input
                        placeholder="Apt 4B"
                        value={addressApartment}
                        onChange={e => setAddressApartment(e.target.value)}
                        className="h-12"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wide text-[#4B5563] mb-1.5 block">Ville</Label>
                        <Input
                          placeholder="Montréal"
                          value={addressCity}
                          onChange={e => setAddressCity(e.target.value)}
                          className="h-12"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wide text-[#4B5563] mb-1.5 block">Code postal</Label>
                        <Input
                          placeholder="H1A 1A1"
                          value={addressPostalCode}
                          onChange={e => setAddressPostalCode(formatPostalCode(e.target.value))}
                          maxLength={7}
                          className="h-12"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wide text-[#4B5563] mb-1.5 block">Province</Label>
                      <Input value="Québec" disabled className="bg-[#F5F7FA] h-12 text-[#1A1A2E]" />
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setStep(1)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Retour
                  </Button>
                  <Button
                    className="flex-1 h-12 font-bold rounded-xl"
                    disabled={!isAddressValid}
                    onClick={() => setStep(3)}
                    style={{ background: isAddressValid ? '#0066CC' : undefined }}
                  >
                    Continuer <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            ))}

            {/* ═══ STEP 3: INFORMATIONS CLIENT ═══ */}
            {step < 7 && renderStepShell(3, step === 3 && (
              <div className="space-y-6">
                <Card className="overflow-hidden border border-[#E5E7EB] rounded-xl shadow-sm bg-white">
                  <CardHeader className="pb-4 border-b border-[#E5E7EB]" style={{ background: '#F0F6FC' }}>
                    <CardTitle className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#0066CC' }}>
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-lg font-bold text-[#0066CC]">Vos informations</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wide text-[#4B5563] mb-1.5 block">Prénom *</Label>
                        <Input placeholder="Jean" value={firstName} onChange={e => setFirstName(e.target.value)} className="h-12" />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wide text-[#4B5563] mb-1.5 block">Nom *</Label>
                        <Input placeholder="Tremblay" value={lastName} onChange={e => setLastName(e.target.value)} className="h-12" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wide text-[#4B5563] mb-1.5 block">Courriel *</Label>
                      <Input type="email" placeholder="jean@exemple.com" value={email} onChange={e => setEmail(e.target.value)} className="h-12" />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wide text-[#4B5563] mb-1.5 block">Téléphone *</Label>
                      <Input
                        type="tel"
                        placeholder="514-555-1234"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="h-12"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wide text-[#4B5563] mb-1.5 block">Date de naissance *</Label>
                      <Input
                        type="date"
                        value={dateOfBirth}
                        onChange={e => setDateOfBirth(e.target.value)}
                        max={new Date(new Date().setFullYear(new Date().getFullYear() - MIN_AGE_TELECOM)).toISOString().split("T")[0]}
                        className="h-12"
                      />
                      <p className="text-xs text-[#4B5563] mt-1.5">
                        Requis par la réglementation CRTC. Vous devez avoir {MIN_AGE_TELECOM} ans ou plus.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setStep(isStreamingOnlyOrder ? 1 : 2)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Retour
                  </Button>
                  <Button
                    className="flex-1 h-12 font-bold rounded-xl"
                    disabled={!isClientInfoValid}
                    onClick={async () => {
                      await tryAutoApplyFirstMonthFree();
                      setStep(4);
                    }}
                    style={{ background: isClientInfoValid ? '#0066CC' : undefined }}
                  >
                    Continuer <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            ))}

            {/* ═══ STEP 4: OPTIONS ═══ */}
            {step < 7 && renderStepShell(4, step === 4 && (
              <div className="space-y-6">
                {/* Installation */}
                {(hasInternetService || hasTVService) && (
                  <InstallationSection
                    installationChoice={installationChoice}
                    onInstallationChoiceChange={c => {
                      setInstallationChoice(c);
                      // If user re-picks auto, reset phase back to choice
                      if (c === "auto") setInstallationPhase("choice");
                    }}
                    selectedDate={selectedDate}
                    selectedTime={selectedTime}
                    onDateTimeChange={(d, t) => { setSelectedDate(d); setSelectedTime(t); }}
                    appointmentConfirmed={appointmentConfirmed}
                    onAppointmentConfirmedChange={setAppointmentConfirmed}
                    phase={installationPhase}
                    onCablingAnswered={(a) => setCoaxialSurveyPayload({
                      has_coaxial: a.hasCoaxial,
                      cable_status: a.cableStatus,
                      previous_service: a.previousService,
                      captured_at: new Date().toISOString(),
                      source: "guest_checkout",
                    })}
                  />
                )}

                {/* Equipment constraints */}
                {(hasInternetService || hasTVService) && (
                  <Card className="overflow-hidden border border-[#E5E7EB] rounded-xl shadow-sm bg-white">
                    <CardHeader className="pb-4 border-b border-[#E5E7EB]" style={{ background: '#F0F6FC' }}>
                      <CardTitle className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#0066CC' }}>
                          <Package className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-base font-bold text-[#1A1A2E]">Équipement</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* WiFi Router — max 1 */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-[#1A1A2E]">Borne WiFi 6</p>
                          <p className="text-xs text-[#4B5563]">Maximum 1 par adresse • {fmt(ROUTER_PRICE)}</p>
                        </div>
                        <Badge variant="secondary">1</Badge>
                      </div>

                      {/* TV Terminals — min 1 if TV, max 4 */}
                      {hasTVService && (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-[#1A1A2E]">Terminal TV</p>
                            <p className="text-xs text-[#4B5563]">Min 1 avec service TV • Max 4 par adresse • {fmt(terminalPrice ?? 0)}/unité</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm" variant="outline"
                              disabled={tvTerminalQty <= 1}
                              onClick={() => setTvTerminalQty(q => Math.max(1, q - 1))}
                            >−</Button>
                            <span className="w-8 text-center font-semibold text-[#1A1A2E]">{tvTerminalQty}</span>
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
                            <p className="text-sm font-medium text-[#1A1A2E]">
                              {simType === "esim" ? "eSIM" : "Carte SIM physique"}
                            </p>
                            <p className="text-xs text-[#4B5563]">
                              {simType === "esim" ? `${fmt(ESIM_PRICE)}` : `${fmt(SIM_PRICE)}`}
                            </p>
                          </div>
                          <Badge variant="secondary">1</Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* ── Installation details only (câblage, statut, notes d'accès) ── */}
                <CheckoutShippingAndActivation
                  shipping={shippingData}
                  onShippingChange={setShippingData}
                  activation={activationData}
                  onActivationChange={setActivationData}
                  installationDetails={installationDetailsData}
                  onInstallationDetailsChange={setInstallationDetailsData}
                  showShippingActivation={false}
                  showInstallationDetails={hasInternetService || hasTVService}
                />

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1 h-12 rounded-xl"
                    onClick={() => {
                      if (installationPhase === "schedule" && requiresInstallation) {
                        setInstallationPhase("choice");
                      } else {
                        setStep(3);
                      }
                    }}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" /> Retour
                  </Button>
                  <Button
                    className="flex-1 h-12 font-bold rounded-xl"
                    disabled={(() => {
                      if (!requiresInstallation) return !installationChoice;
                      if (installationPhase === "choice") return !installationChoice;
                      return !appointmentConfirmed || !selectedDate || !selectedTime;
                    })()}
                    onClick={() => {
                      if (requiresInstallation && installationPhase === "choice") {
                        setInstallationPhase("schedule");
                        setTimeout(() => document.getElementById("step-4")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                        return;
                      }
                      setStep(5);
                    }}
                    style={{ background: '#0066CC', boxShadow: '0 4px 20px rgba(0,102,204,0.30)' }}
                  >
                    {requiresInstallation && installationPhase === "choice"
                      ? <>Choisir le rendez-vous <ArrowRight className="w-4 h-4 ml-2" /></>
                      : <>Continuer <ArrowRight className="w-4 h-4 ml-2" /></>}
                  </Button>
                </div>
              </div>
            ))}

            {/* ═══ STEP 5: OPTIONS & LIVRAISON ═══ */}
            {step < 7 && renderStepShell(5, step === 5 && (
              <div className="space-y-6">
                {/* Premier mois gratuit — welcome banner */}
                {!welcomeDiscountDismissed && !appliedPromo && normalizedPricing?.welcome_applied && (
                  <div className="rounded-xl border border-[#00A651]/30 bg-[#00A651]/[0.06] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#00A651]/15 flex items-center justify-center flex-shrink-0">
                          <Star className="w-5 h-5 text-[#00A651]" />
                        </div>
                        <div>
                          <p className="font-semibold text-[#1A1A2E] text-sm">Rabais bienvenue appliqué</p>
                          <p className="text-xs text-[#6B7280]">
                            50 % de rabais sur votre premier mois — appliqué automatiquement.
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-[#6B7280] hover:text-[#1A1A2E]"
                        onClick={() => setWelcomeDiscountDismissed(true)}
                      >
                        Retirer
                      </Button>
                    </div>
                  </div>
                )}

                {/* Auto-applied first-month-free banner */}
                {autoAppliedPromo && appliedPromo?.code === "BIENVENUE2026" && (
                  <div className="rounded-xl border border-[#00A651]/30 bg-[#00A651]/[0.06] p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#00A651]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Gift className="w-5 h-5 text-[#00A651]" />
                      </div>
                      <div>
                        <p className="font-semibold text-[#1A1A2E] text-sm mb-1">
                          Premier mois gratuit appliqué automatiquement
                        </p>
                        <p className="text-xs text-[#6B7280] leading-relaxed">
                          Nous avons détecté que vous êtes un nouveau client Nivra Telecom.
                          Votre premier mois de service est entièrement gratuit — aucun code requis.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* SIM type selector */}
                {hasMobileService && (
                  <Card className="overflow-hidden border border-[#E5E7EB] rounded-xl shadow-sm bg-white">
                    <CardHeader className="pb-4 border-b border-[#E5E7EB]" style={{ background: '#F0F6FC' }}>
                      <CardTitle className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#0066CC' }}>
                          <Smartphone className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-base font-bold text-[#1A1A2E]">Type de SIM</span>
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
                              : "border-[#E5E7EB] hover:border-primary/30 hover:shadow-sm"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-[#1A1A2E] text-sm">SIM physique</p>
                              <p className="text-xs text-[#4B5563] mt-1">
                                Pour la majorité des appareils — Android, iPhone 13 et versions antérieures.
                              </p>
                            </div>
                            <span className="text-sm font-bold text-[#1A1A2E] ml-3">{fmt(SIM_PRICE)}</span>
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
                              : "border-[#E5E7EB] hover:border-primary/30 hover:shadow-sm"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-[#1A1A2E] text-sm">eSIM</p>
                              <p className="text-xs text-[#4B5563] mt-1">
                                Pour les appareils compatibles — iPhone 14+, Pixel 6+, Samsung Galaxy S21+ et plus récents.
                              </p>
                            </div>
                            <span className="text-sm font-bold text-[#1A1A2E] ml-3">{fmt(ESIM_PRICE)}</span>
                          </div>
                          {simType === "esim" && (
                            <div className="mt-2 flex items-center gap-1 text-xs text-primary font-medium">
                              <Check className="w-3.5 h-3.5" /> Sélectionné
                            </div>
                          )}
                        </button>
                      </div>
                      <p className="text-[11px] text-[#4B5563] mt-3">
                        Vérifiez la compatibilité dans les réglages de votre appareil avant de choisir l'eSIM.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Port-in : conservation du numéro */}
                {hasMobileService && (
                  <Card className="overflow-hidden border border-[#E5E7EB] rounded-xl shadow-sm bg-white">
                    <CardHeader className="pb-4 border-b border-[#E5E7EB]" style={{ background: '#F0F6FC' }}>
                      <CardTitle className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#0066CC' }}>
                          <Phone className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-base font-bold text-[#1A1A2E]">Conserver votre numéro ?</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setWantsPortIn(false)}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${!wantsPortIn ? "border-primary bg-primary/5" : "border-[#E5E7EB] hover:border-primary/30"}`}
                        >
                          <p className="font-semibold text-sm">Nouveau numéro</p>
                          <p className="text-xs text-[#4B5563] mt-1">Un numéro Nivra vous sera assigné</p>
                          {!wantsPortIn && <p className="text-xs text-primary font-medium mt-2 flex items-center gap-1"><Check className="w-3 h-3" /> Sélectionné</p>}
                        </button>
                        <button
                          type="button"
                          onClick={() => setWantsPortIn(true)}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${wantsPortIn ? "border-primary bg-primary/5" : "border-[#E5E7EB] hover:border-primary/30"}`}
                        >
                          <p className="font-semibold text-sm">Garder mon numéro</p>
                          <p className="text-xs text-[#4B5563] mt-1">Transférer depuis votre opérateur actuel</p>
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
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#4B5563]" />
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
                              className="w-full h-11 rounded-md border border-input bg-white px-3 text-sm"
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
                            <Label className="text-xs font-medium mb-1.5 block">NIP / PIN de transfert <span className="text-[#4B5563] font-normal">(si requis par votre opérateur)</span></Label>
                            <Input
                              value={portInPin}
                              onChange={e => setPortInPin(e.target.value)}
                              placeholder="4 chiffres"
                              maxLength={8}
                              className="h-11"
                            />
                          </div>
                          <p className="text-[11px] text-[#4B5563]">
                            Le transfert de numéro prend généralement 1-3 jours ouvrables. Votre service actuel reste actif jusqu'à la complétion du transfert.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Shipping override + activation date */}
                <CheckoutShippingAndActivation
                  shipping={shippingData}
                  onShippingChange={setShippingData}
                  activation={activationData}
                  onActivationChange={setActivationData}
                  installationDetails={installationDetailsData}
                  onInstallationDetailsChange={setInstallationDetailsData}
                  showShippingActivation={true}
                  showInstallationDetails={false}
                />

                {/* Promo / Referral */}
                <Card className="overflow-hidden border border-[#E5E7EB] rounded-xl shadow-sm bg-white">
                  <CardHeader className="pb-4 border-b border-[#E5E7EB]" style={{ background: '#EAF7EF' }}>
                    <CardTitle className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#00A651' }}>
                        <Gift className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-base font-bold text-[#1A1A2E]">Promotions</span>
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

                {/* Notes de commande */}
                <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 sm:px-6 py-4 border-b border-[#E5E7EB]" style={{ background: '#F0F6FC' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#0066CC]/10 flex items-center justify-center flex-shrink-0">
                        <Info className="w-5 h-5 text-[#0066CC]" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-[#1A1A2E]">Notes de commande</h3>
                        <p className="text-xs text-[#6B7280] mt-0.5">Optionnel — instructions particulières pour votre commande</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-5 sm:p-6">
                    <Textarea
                      placeholder="Instructions spéciales, commentaires..."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={3}
                      className="border-[#E5E7EB] focus-visible:ring-[#0066CC]/40 focus-visible:border-[#0066CC]"
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setStep(4)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Retour
                  </Button>
                  <Button
                    className="flex-1 h-12 font-bold rounded-xl"
                    disabled={!!validateShipping(shippingData) || !!validateActivation(activationData)}
                    onClick={() => {
                      const shipErr = validateShipping(shippingData);
                      if (shipErr) { toast.error(shipErr); return; }
                      const actErr = validateActivation(activationData);
                      if (actErr) { toast.error(actErr); return; }
                      setStep(6);
                    }}
                    style={{ background: '#0066CC', boxShadow: '0 4px 20px rgba(0,102,204,0.30)' }}
                  >
                    Continuer au paiement <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </div>
            ))}

            {/* ═══ STEP 6: PAIEMENT ═══ */}
            {step < 7 && renderStepShell(6, step === 6 && (

              <div className="space-y-6">
                <Card className="overflow-hidden border border-[#E5E7EB] rounded-xl shadow-sm bg-white">
                  <CardHeader className="pb-4 border-b border-[#E5E7EB]" style={{ background: '#F0F6FC' }}>
                    <CardTitle className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#0066CC' }}>
                        <CreditCard className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <span className="text-lg font-bold text-[#0066CC]">Paiement sécurisé</span>
                        <span className="flex items-center gap-1 text-xs text-[#00A651] font-medium mt-0.5">
                          <Lock className="w-3 h-3" /> Chiffrement SSL 256-bit — PCI-DSS Level 1
                        </span>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* ── Card payment via Square ── */}
                    <div>
                      <div className="text-[10px] tracking-[2px] uppercase text-[#4B5563] mb-3">
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

                      {/* Square security strip */}
                      <div className="rounded-xl border border-[#E5E7EB] bg-white p-3 mb-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-lg bg-[#0F172A] flex items-center justify-center shrink-0">
                            <Lock className="w-4 h-4 text-white" />
                          </div>
                          <div className="leading-tight">
                            <p className="text-[13px] font-bold text-[#1A1A2E]">Traitement sécurisé par Square</p>
                            <p className="text-[11px] text-[#6B7280]">Aucune donnée bancaire conservée sur nos serveurs</p>
                          </div>
                        </div>
                        <Shield className="w-5 h-5 text-[#00A651] shrink-0 hidden sm:block" />
                      </div>


                      {/* Square payment widget */}
                      {!paypalCaptureId && (
                        <SquarePaymentForm
                          amount={todayTotal}
                          customerEmail={email}
                          customerName={`${firstName} ${lastName}`.trim()}
                          onBeforeCharge={async () => {
                            // Public checkout must create the real Core order before Square charges.
                            // This prevents orphan FIELD-* payment intents if the browser refreshes
                            // or a post-payment step fails.
                            const existing = precreatedCheckoutRef.current;
                            const response = existing || await handleSubmit(undefined, {
                              allowIncompleteLegal: true,
                              precreateOnly: true,
                            });
                            const invoiceId = (response as NivraFullCheckoutResponse | undefined)?.invoice_id;
                            if (!invoiceId) throw new Error("Impossible de créer la facture Core avant paiement.");
                            return { invoice_id: invoiceId };
                          }}
                          onSuccess={(_receiptUrl, paymentId) => {
                            setPaypalCaptureId(paymentId || "");
                            setPaymentComplete(true);
                            toast.success("Paiement confirmé !");
                            const precreated = precreatedCheckoutRef.current;
                            if (precreated) {
                              setOrderResult({
                                orderNumber: precreated.order_number,
                                orderId: precreated.order_id,
                                isNewAccount: false,
                              });
                              cancelAbandonmentEmail();
                              setStep(7);
                              sessionStorage.removeItem("nivra_pending_payment");
                              return;
                            }
                            if (paymentId) {
                              void handleSubmit(paymentId, { allowIncompleteLegal: true });
                            }
                          }}
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

                      <div className="text-center text-xs text-[#6B7280] mt-3 flex items-center justify-center gap-1.5">
                        <Lock className="w-3.5 h-3.5" /> Chiffrement 256-bit SSL — Square PCI-DSS Level 1
                      </div>
                    </div>

                    <Separator />

                    {/* Legal Checklist - Full CheckoutEssentialTerms */}
                    <CheckoutEssentialTermsBase
                      isFrench
                      checklist={legalChecklist}
                      onChecklistChange={(key, checked) => setLegalChecklist(prev => ({ ...prev, [key]: checked }))}
                      paymentMethod={paymentMethod || undefined}
                    />

                    {/* Trust row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 border-t border-[#E5E7EB] mt-4">
                      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#F5F7FA]">
                        <Lock className="w-3.5 h-3.5 text-[#00A651]" />
                        <span className="text-[11px] font-semibold text-[#1A1A2E]">SSL 256-bit</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#F5F7FA]">
                        <Shield className="w-3.5 h-3.5 text-[#00A651]" />
                        <span className="text-[11px] font-semibold text-[#1A1A2E]">PCI-DSS L1</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#F5F7FA]">
                        <Check className="w-3.5 h-3.5 text-[#00A651]" />
                        <span className="text-[11px] font-semibold text-[#1A1A2E]">Sans contrat</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[#F5F7FA]">
                        <span className="text-xs leading-none">🇨🇦</span>
                        <span className="text-[11px] font-semibold text-[#1A1A2E]">Québec</span>
                      </div>
                    </div>

                  </CardContent>
                </Card>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-14 rounded-xl" onClick={() => setStep(5)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Retour
                  </Button>
                  <Button
                    className="flex-1 h-14 text-base font-bold rounded-xl text-white"
                    disabled={!isPaymentDone || !isLegalComplete || isSubmitting}
                    onClick={() => handleSubmit()}
                    style={(!isPaymentDone || !isLegalComplete || isSubmitting) ? {} : { background: '#0066CC', boxShadow: '0 4px 20px rgba(0,102,204,0.30)' }}
                    onMouseEnter={(e) => { if (isPaymentDone && isLegalComplete && !isSubmitting) e.currentTarget.style.background = '#0052A3'; }}
                    onMouseLeave={(e) => { if (isPaymentDone && isLegalComplete && !isSubmitting) e.currentTarget.style.background = '#0066CC'; }}
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Traitement en cours...</>
                    ) : enableAutoBilling ? (
                      <><Lock className="w-5 h-5 mr-2" /> Activer le paiement automatique</>
                    ) : (
                      <><Lock className="w-5 h-5 mr-2" /> Confirmer et payer {fmt(todayTotal)}</>
                    )}
                  </Button>
                </div>
              </div>
            ))}

            {/* ═══ STEP 6: CONFIRMATION ═══ */}
            {step === 7 && orderResult && (
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
          {step < 7 && (
            <aside className="hidden lg:block lg:col-span-2">
              <div className="sticky top-32 space-y-3">

                {/* Devis header */}
                <div className="rounded-2xl overflow-hidden bg-white border border-[#E5E7EB] shadow-sm">
                  <div className="px-5 py-3 bg-[#1A1A2E] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-white" />
                      <span className="text-[11px] font-bold text-white tracking-widest uppercase">Votre devis Nivra</span>
                    </div>
                    <span className="text-[10px] font-semibold text-white/70 tracking-wide">N° {new Date().getFullYear()}-{String(Date.now()).slice(-5)}</span>
                  </div>

                  {selectedServices.length === 0 ? (
                    <div className="px-5 py-6 text-center">
                      <ShoppingCart className="w-8 h-8 text-[#E5E7EB] mx-auto mb-2" />
                      <p className="text-sm text-[#6B7280]">Aucun forfait sélectionné</p>
                    </div>
                  ) : (
                    <>
                      {/* ── Hero forfait ── */}
                      <div className="px-5 py-4 bg-gradient-to-b from-[#F0F6FC] to-white border-b border-[#E5E7EB]">
                        {selectedServices.map(s => {
                          const Icon = categoryIcons[s.category] || Package;
                          const speedMatch = s.category === "Internet" ? s.name.match(/(\d{2,4})\s*Mbps/i) : null;
                          return (
                            <div key={s.id} className="mb-3 last:mb-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                <div className="w-6 h-6 rounded-md bg-[#0066CC] flex items-center justify-center">
                                  <Icon className="w-3.5 h-3.5 text-white" />
                                </div>
                                <span className="text-[10px] font-bold text-[#0066CC] uppercase tracking-widest">{s.category}</span>
                              </div>
                              <p className="text-lg font-black text-[#1A1A2E] leading-tight">{s.name}</p>
                              {speedMatch && (
                                <div className="mt-2 inline-flex items-baseline gap-1 text-[#0066CC]">
                                  <Zap className="w-4 h-4 fill-[#0066CC]" />
                                  <span className="text-2xl font-black leading-none">{speedMatch[1]}</span>
                                  <span className="text-sm font-bold">Mbps</span>
                                </div>
                              )}
                              <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-dashed border-[#E5E7EB]">
                                <span className="text-xs text-[#6B7280]">Prix mensuel</span>
                                <span className="text-base font-bold text-[#1A1A2E]">{fmt(s.price)}<span className="text-xs text-[#6B7280] font-normal">/mois</span></span>
                              </div>
                            </div>
                          );
                        })}

                        {!isStreamingOnlyOrder && (
                          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#00A651]/15 border border-[#00A651]/30 text-[#00A651]">
                            <Gift className="w-3 h-3" />
                            1ER MOIS 100% GRATUIT
                          </div>
                        )}
                      </div>

                      {/* ── Équipements & frais uniques ── */}
                      {(routerFee > 0 || terminalFee > 0 || simFee > 0 || activationFee > 0 || deliveryFee > 0 || installationFee > 0) && (
                        <div className="px-5 py-3 border-b border-[#E5E7EB]">
                          <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest mb-2">Frais uniques (aujourd'hui)</p>
                          <div className="space-y-1.5">
                            {routerFee > 0 && (
                              <div className="flex justify-between text-xs"><span className="text-[#374151] flex items-center gap-1.5"><Wifi className="w-3 h-3 text-[#6B7280]" />Borne WiFi 6</span><span className="text-[#1A1A2E] font-medium">{fmt(routerFee)}</span></div>
                            )}
                            {terminalFee > 0 && (
                              <div className="flex justify-between text-xs"><span className="text-[#374151] flex items-center gap-1.5"><Tv className="w-3 h-3 text-[#6B7280]" />Terminal TV ×{tvTerminalQty}</span><span className="text-[#1A1A2E] font-medium">{fmt(terminalFee)}</span></div>
                            )}
                            {simFee > 0 && (
                              <div className="flex justify-between text-xs"><span className="text-[#374151] flex items-center gap-1.5"><Smartphone className="w-3 h-3 text-[#6B7280]" />{simType === "esim" ? "eSIM" : "Carte SIM"}</span><span className="text-[#1A1A2E] font-medium">{fmt(simFee)}</span></div>
                            )}
                            {activationFee > 0 && (
                              <div className="flex justify-between text-xs"><span className="text-[#374151]">Activation</span><span className="text-[#1A1A2E] font-medium">{fmt(activationFee)}</span></div>
                            )}
                            {deliveryFee > 0 && (
                              <div className="flex justify-between text-xs"><span className="text-[#374151]">Livraison</span><span className="text-[#1A1A2E] font-medium">{fmt(deliveryFee)}</span></div>
                            )}
                            {installationFee > 0 && (
                              <div className="flex justify-between text-xs"><span className="text-[#374151]">Installation technicien</span><span className="text-[#1A1A2E] font-medium">{fmt(installationFee)}</span></div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ── Rabais ── */}
                      {((normalizedPricing && toNonNegativeMoney(normalizedPricing.discount_total_combined) > 0) || enableAutoBilling) && (
                        <div className="px-5 py-2.5 border-b border-[#E5E7EB] bg-[#00A651]/5">
                          {normalizedPricing && toNonNegativeMoney(normalizedPricing.discount_total_combined) > 0 && (
                            <div className="flex justify-between text-xs font-semibold text-[#00A651]">
                              <span className="flex items-center gap-1"><Star className="w-3 h-3" /> Rabais appliqués</span>
                              <span>-{fmt(toNonNegativeMoney(normalizedPricing.discount_total_combined))}</span>
                            </div>
                          )}
                          {enableAutoBilling && (
                            <div className="flex justify-between text-xs text-[#00A651] mt-1">
                              <span>Rabais pré-autorisé</span>
                              <span>-{fmt(AUTOPAY_DISCOUNT)}/mois</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── Taxes ── */}
                      {normalizedPricing && (
                        <div className="px-5 py-2.5 border-b border-[#E5E7EB]">
                          <div className="flex justify-between text-[11px] text-[#6B7280]"><span>TPS (5%)</span><span>{fmt(normalizedPricing.tps_amount)}</span></div>
                          <div className="flex justify-between text-[11px] text-[#6B7280] mt-0.5"><span>TVQ (9,975%)</span><span>{fmt(normalizedPricing.tvq_amount)}</span></div>
                        </div>
                      )}

                      {/* ── Total aujourd'hui — hero ── */}
                      <div className="px-5 py-4 bg-[#0066CC] text-white">
                        <div className="flex items-baseline justify-between">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">Total aujourd'hui</p>
                            <p className="text-[10px] text-white/70 mt-0.5">Paiement unique</p>
                          </div>
                          {isServerPricingLoading ? (
                            <Skeleton className="h-8 w-24 bg-white/20" />
                          ) : (
                            <span className="text-3xl font-black leading-none">{fmt(todayTotal)}</span>
                          )}
                        </div>
                      </div>

                      {/* ── Mensuel après premier mois ── */}
                      <div className="px-5 py-3 bg-[#F5F7FA] border-t border-[#E5E7EB]">
                        <div className="flex items-baseline justify-between">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B7280]">Puis chaque mois</p>
                            <p className="text-[10px] text-[#6B7280] mt-0.5">Taxes incluses · Sans engagement</p>
                          </div>
                          <span className="text-xl font-bold text-[#1A1A2E]">{fmt(monthlyTotalWithTax)}<span className="text-xs text-[#6B7280] font-normal">/mois</span></span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Trust pills */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-white border border-[#E5E7EB] px-3 py-2.5 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#00A651] shrink-0" />
                    <span className="text-[11px] font-semibold text-[#1A1A2E] leading-tight">Aucun contrat</span>
                  </div>
                  <div className="rounded-lg bg-white border border-[#E5E7EB] px-3 py-2.5 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#00A651] shrink-0" />
                    <span className="text-[11px] font-semibold text-[#1A1A2E] leading-tight">Paiement sécurisé</span>
                  </div>
                  <div className="rounded-lg bg-white border border-[#E5E7EB] px-3 py-2.5 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#00A651] shrink-0" />
                    <span className="text-[11px] font-semibold text-[#1A1A2E] leading-tight">Satisfait 30 jours</span>
                  </div>
                  <div className="rounded-lg bg-white border border-[#E5E7EB] px-3 py-2.5 flex items-center gap-2">
                    <span className="text-base leading-none">🇨🇦</span>
                    <span className="text-[11px] font-semibold text-[#1A1A2E] leading-tight">Entreprise québécoise</span>
                  </div>
                </div>

              </div>
            </aside>
          )}
        </div>
      </main>


      {/* ═══ MOBILE FIXED BOTTOM SUMMARY ═══ */}
      {step < 7 && selectedServices.length > 0 && (
        <>
          {mobileSummaryOpen && (
            <div
              className="lg:hidden fixed inset-0 z-40 bg-black/40 animate-fade-in"
              onClick={() => setMobileSummaryOpen(false)}
              aria-hidden
            />
          )}
          <div
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#E5E7EB] transition-all duration-300"
            style={{
              paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
              boxShadow: '0 -8px 24px rgba(0,0,0,0.08)',
              maxHeight: mobileSummaryOpen ? '85vh' : 'auto',
              overflowY: mobileSummaryOpen ? 'auto' : 'visible',
            }}
          >
            {mobileSummaryOpen && (
              <div className="px-4 pt-4 pb-2 border-b border-[#E5E7EB] bg-[#F5F7FA]">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-[#1A1A2E] uppercase tracking-wide">Détail de la commande</p>
                  <button
                    type="button"
                    onClick={() => setMobileSummaryOpen(false)}
                    className="text-xs font-semibold text-[#0066CC]"
                  >
                    Fermer ✕
                  </button>
                </div>
                <div className="space-y-2 text-sm">
                  {selectedServices.map(s => (
                    <div key={s.id} className="flex justify-between">
                      <span className="text-[#1A1A2E] font-medium">{s.name}</span>
                      <span className="text-[#1A1A2E] font-bold">{fmt(s.price)}<span className="text-[#6B7280] text-xs font-normal">/mois</span></span>
                    </div>
                  ))}
                  <div className="h-px bg-[#E5E7EB] my-2" />
                  {activationFee > 0 && (<div className="flex justify-between text-xs"><span className="text-[#6B7280]">Activation</span><span>{fmt(activationFee)}</span></div>)}
                  {routerFee > 0 && (<div className="flex justify-between text-xs"><span className="text-[#6B7280]">Routeur WiFi 6</span><span>{fmt(routerFee)}</span></div>)}
                  {terminalFee > 0 && (<div className="flex justify-between text-xs"><span className="text-[#6B7280]">Terminal TV ×{tvTerminalQty}</span><span>{fmt(terminalFee)}</span></div>)}
                  {simFee > 0 && (<div className="flex justify-between text-xs"><span className="text-[#6B7280]">Carte SIM</span><span>{fmt(simFee)}</span></div>)}
                  {deliveryFee > 0 && (<div className="flex justify-between text-xs"><span className="text-[#6B7280]">Livraison</span><span>{fmt(deliveryFee)}</span></div>)}
                  {installationFee > 0 && (<div className="flex justify-between text-xs"><span className="text-[#6B7280]">Installation</span><span>{fmt(installationFee)}</span></div>)}
                  {normalizedPricing && (
                    <>
                      <div className="flex justify-between text-[11px] text-[#6B7280]"><span>TPS (5%)</span><span>{fmt(normalizedPricing.tps_amount)}</span></div>
                      <div className="flex justify-between text-[11px] text-[#6B7280]"><span>TVQ (9,975%)</span><span>{fmt(normalizedPricing.tvq_amount)}</span></div>
                    </>
                  )}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setMobileSummaryOpen(v => !v)}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left min-h-[64px] active:bg-[#F5F7FA]"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0066CC]/10 flex items-center justify-center shrink-0">
                  <ShoppingCart className="w-5 h-5 text-[#0066CC]" />
                </div>
                <div className="leading-tight">
                  <p className="text-[10px] text-[#6B7280] uppercase tracking-wider font-bold">Total aujourd'hui</p>
                  <p className="font-black text-xl text-[#0066CC]">{fmt(todayTotal)}</p>
                  <p className="text-[10px] text-[#6B7280] font-medium">puis {fmt(monthlyTotalWithTax)}/mois</p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-[#0066CC] flex items-center gap-1 px-3 py-2 rounded-full bg-[#0066CC]/10">
                {mobileSummaryOpen ? 'Masquer' : 'Détail'}
                <span className="text-xs">{mobileSummaryOpen ? '▼' : '▲'}</span>
              </span>
            </button>

          </div>
        </>
      )}
      <Footer />
    </div>
  );
};

export default GuestCheckout;
