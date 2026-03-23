/**
 * GuestCheckout — Public checkout flow (no account required)
 * 6 steps: Forfait → Adresse → Infos client → Vérification & Options → Paiement → Confirmation
 * 
 * After successful order:
 * 1. Order created via canonical flow (Nivra Core or fallback)
 * 2. Client account auto-created via auto-create-client-account edge function
 * 3. Password reset email sent to client
 */
import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePublicServices } from "@/hooks/usePublicServices";
import { useEquipmentPrices } from "@/hooks/usePublicServices";
import { useCanonicalFees } from "@/hooks/useCanonicalFees";
import { CheckoutProgress } from "@/components/checkout/CheckoutProgress";
import { SecurityTrustBox } from "@/components/checkout/SecurityTrustBox";
import { PromoCodeInput } from "@/components/checkout/PromoCodeInput";
import { ReferralCodeInput, type AppliedReferral } from "@/components/checkout/ReferralCodeInput";
import { InstallationSection } from "@/components/checkout/InstallationSection";
import { CheckoutEssentialTermsBase, isChecklistComplete, type ChecklistState } from "@/components/checkout/CheckoutEssentialTermsBase";
import { GuestIdentityVerification, createEmptyIdentityData, type GuestIdentityData } from "@/components/checkout/GuestIdentityVerification";
import { PayPalButton } from "@/components/payment/PayPalButton";
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
  Sécurité: Shield, Extras: Package,
};

const CHECKOUT_STEPS = [
  { id: 1, labelFr: "Forfait", labelEn: "Plan" },
  { id: 2, labelFr: "Adresse", labelEn: "Address" },
  { id: 3, labelFr: "Informations", labelEn: "Info" },
  { id: 4, labelFr: "Options", labelEn: "Options" },
  { id: 5, labelFr: "Paiement", labelEn: "Payment" },
  { id: 6, labelFr: "Confirmation", labelEn: "Confirmation" },
];

const GuestCheckout = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientRequestIdRef = useRef(crypto.randomUUID());
  const submittingRef = useRef(false);

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

  // ── Options ──
  const [installationChoice, setInstallationChoice] = useState<"auto" | "technician" | null>("auto");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [appointmentConfirmed, setAppointmentConfirmed] = useState(false);
  const [notes, setNotes] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<any>(null);
  const [appliedReferral, setAppliedReferral] = useState<AppliedReferral | null>(null);

  // ── KYC / Identity ──
  const [identityData, setIdentityData] = useState<GuestIdentityData>(createEmptyIdentityData());

  // ── Payment ──
  const [paymentMethod, setPaymentMethod] = useState<"paypal" | "etransfer" | null>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [paypalCaptureId, setPaypalCaptureId] = useState("");
  const [etransferRef, setEtransferRef] = useState("");
  const [etransferSender, setEtransferSender] = useState("");

  // ── Legal checklist (replaces simple termsAccepted) ──
  const [legalChecklist, setLegalChecklist] = useState<ChecklistState>({
    prepaid: false,
    delays: false,
    notices: false,
    etransfer: false,
  });

  // ── Pricing ──
  const [liveServerPricing, setLiveServerPricing] = useState<any>(null);
  const [isServerPricingLoading, setIsServerPricingLoading] = useState(false);
  const serverPricingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Order result ──
  const [orderResult, setOrderResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Data hooks ──
  const { data: services, isLoading: servicesLoading } = usePublicServices({ surface: "checkout" });
  const { routerPrice, simPrice, terminalPrice } = useEquipmentPrices();
  const canonicalFees = useCanonicalFees();

  // Pre-select from URL param
  useEffect(() => {
    const planId = searchParams.get("plan");
    if (planId && services?.length) {
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

  // ── Derived ──
  const hasInternetService = selectedServices.some(s => s.category === "Internet");
  const hasTVService = selectedServices.some(s => s.category === "TV");
  const hasMobileService = selectedServices.some(s => s.category === "Mobile");
  const hasStreamingService = selectedServices.some(s => s.category === "Streaming" || s.category === "Streaming+");
  const isStreamingOnlyOrder = hasStreamingService && !hasInternetService && !hasTVService && !hasMobileService;
  const requiresInstallation = installationChoice === "technician" && (hasInternetService || hasTVService);
  const isETransfer = paymentMethod === "etransfer";
  const isLegalComplete = isChecklistComplete(legalChecklist, isETransfer);
  const isKycComplete = isStreamingOnlyOrder || identityData.status === "complete";

  const ROUTER_PRICE = routerPrice ?? 100;
  const SIM_PRICE = simPrice ?? 10;

  const subtotal = toMoney(selectedServices.reduce((sum, s) => sum + toMoney(s.price), 0));
  const routerFee = (hasInternetService || hasTVService) ? ROUTER_PRICE : 0;
  const simFee = hasMobileService ? SIM_PRICE : 0;
  const activationFee = canonicalFees.activationSingle || 25;
  const deliveryFee = installationChoice === "auto" ? (canonicalFees.deliverySelfInstall || 30) : 0;
  const installationFee = installationChoice === "technician" ? (canonicalFees.installationTechnician || 50) : 0;
  const oneTimeFees = routerFee + simFee + activationFee + deliveryFee + installationFee;

  // ── Live server pricing ──
  useEffect(() => {
    if (selectedServices.length === 0) { setLiveServerPricing(null); return; }
    if (serverPricingTimerRef.current) clearTimeout(serverPricingTimerRef.current);

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
        if (routerFee > 0) cartItems.push({ type: "equipment", name: "Routeur", amount: routerFee });
        if (simFee > 0) cartItems.push({ type: "equipment", name: "Carte SIM", amount: simFee });

        const effectivePromoCode = appliedPromo?.code || ((appliedReferral?.discount_amount ?? 0) > 0 ? appliedReferral?.code : null) || null;
        const result = await computeCheckoutPricing(cartItems, effectivePromoCode, email || null, null, 0);
        setLiveServerPricing(result);
      } catch (err) {
        console.error("[GuestCheckout] Pricing error:", err);
      } finally {
        setIsServerPricingLoading(false);
      }
    }, 400);

    return () => { if (serverPricingTimerRef.current) clearTimeout(serverPricingTimerRef.current); };
  }, [selectedServices, activationFee, deliveryFee, installationFee, routerFee, simFee, appliedPromo?.code, appliedReferral?.code, email]);

  const normalizedPricing = liveServerPricing ? normalizeServerPricingResult(liveServerPricing) : null;
  const todayTotal = toNonNegativeMoney(normalizedPricing?.grand_total ?? 0);
  const { total: monthlyTotalWithTax } = estimateMonthlyTaxes(subtotal);

  // ── Service toggle ──
  const toggleService = (service: Service) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.id === service.id);
      if (exists) return prev.filter(s => s.id !== service.id);
      // Only 1 Internet per order
      if (service.category === "Internet" && prev.some(s => s.category === "Internet")) {
        toast.error("Une seule offre Internet par commande");
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

      if (!termsAccepted) {
        toast.error("Veuillez accepter les termes et conditions");
        return;
      }

      if (!isPaymentDone) {
        toast.error("Veuillez compléter le paiement");
        return;
      }

      // Step 1: Create account via edge function
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

      if (accountError || !accountResult?.success) {
        console.error("[GuestCheckout] Account creation failed:", accountError || accountResult);
        toast.error("Erreur lors de la création du compte. Veuillez réessayer.");
        return;
      }

      const userId = accountResult.user_id;
      console.log("[GuestCheckout] Account created/found:", userId, "isNew:", accountResult.is_new_account);

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
      if (routerFee > 0) cartItems.push({ type: "equipment", name: "Routeur", amount: routerFee });
      if (simFee > 0) cartItems.push({ type: "equipment", name: "Carte SIM", amount: simFee });

      let rpcPricing: any;
      try {
        rpcPricing = await computeCheckoutPricing(cartItems, appliedPromo?.code || null, email, userId, 0);
      } catch { rpcPricing = null; }

      const serverPricing = rpcPricing ? normalizeServerPricingResult(rpcPricing) : {
        grand_total: todayTotal, tps_amount: 0, tvq_amount: 0, taxable_base: subtotal + oneTimeFees,
        recurring_subtotal: subtotal, one_time_subtotal: oneTimeFees,
        discount_total_combined: 0, promo_discount: 0, welcome_discount: 0, preauth_discount: 0,
      };

      const paymentMethodValue = paymentMethod === "paypal" ? "paypal" : "etransfer";

      // Step 4: Submit checkout
      const checkoutPayload: NivraFullCheckoutPayload = {
        client_request_id: clientRequestIdRef.current,
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
          ...(hasMobileService ? [{ sku: "EQ-SIM-PHY", name: "Carte SIM physique", quantity: 1, unit_price: SIM_PRICE }] : []),
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
        identity: null,
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
        response = await fallbackCheckout(supabase as any, checkoutPayload);
      }

      // Step 5: Canonical sync
      try {
        await supabase.functions.invoke("checkout-canonical-sync", {
          body: { payload: checkoutPayload, response },
        });
      } catch (e) {
        console.warn("[GuestCheckout] Canonical sync failed (non-blocking):", e);
      }

      // Step 6: Consent record
      try {
        await supabase.from("checkout_consent_records" as any).insert({
          order_id: response.order_id,
          user_id: userId,
          terms_accepted: termsAccepted,
          recurring_payment_accepted: false,
          total_amount_displayed: todayTotal,
          payment_method: paymentMethodValue,
          services_displayed: selectedServices.map(s => ({ name: s.name, price: s.price, category: s.category })),
          legal_versions: { terms: "2026-03-19", privacy: "2026-03-19", refund: "2026-03-19", payment: "2026-03-19" },
          user_agent: navigator.userAgent,
          consent_timestamp: new Date().toISOString(),
        });
      } catch (e) {
        console.warn("[GuestCheckout] Consent record failed:", e);
      }

      // Step 7: Send confirmation email
      try {
        await supabase.functions.invoke("send-order-confirmation", {
          body: {
            order_id: response.order_id,
            client_email: email,
            client_first_name: firstName,
            order_number: response.order_number,
            services: selectedServices.map(s => ({ name: s.name, price: s.price, period: "mois" })),
            monthly_total_tax_in: monthlyTotalWithTax,
            one_time_total: oneTimeFees,
            payment_reference: paypalCaptureId || etransferRef,
            payment_method: paymentMethod === "paypal" ? "PayPal" : "Virement Interac",
          },
        });
      } catch (e) {
        console.warn("[GuestCheckout] Email failed:", e);
      }

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
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 sm:px-6 max-w-[1200px] py-8 lg:py-12">
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
                  onClick={() => setStep(2)}
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
                      <Input
                        placeholder="123 Rue Principale"
                        value={addressStreet}
                        onChange={e => setAddressStreet(e.target.value)}
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
                        Requis pour la validation du client — vous devez avoir au moins {MIN_AGE_TELECOM} ans
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Retour
                  </Button>
                  <Button className="flex-1" disabled={!isClientInfoValid} onClick={() => setStep(4)}>
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
                      onPromoApplied={setAppliedPromo}
                      appliedPromo={appliedPromo}
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
                    disabled={requiresInstallation && (!selectedDate || !selectedTime || !appointmentConfirmed)}
                    onClick={() => setStep(5)}
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
                    {/* Payment method selection */}
                    <div className="space-y-3">
                      <button
                        onClick={() => setPaymentMethod("paypal")}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                          paymentMethod === "paypal"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#0070ba] rounded-lg flex items-center justify-center">
                              <span className="text-white font-bold text-xs">PP</span>
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">PayPal</p>
                              <p className="text-xs text-muted-foreground">Paiement sécurisé — Carte de crédit ou débit via PayPal</p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-xs">Recommandé</Badge>
                        </div>
                      </button>

                      <button
                        onClick={() => setPaymentMethod("etransfer")}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                          paymentMethod === "etransfer"
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-xs">ET</span>
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Virement Interac</p>
                            <p className="text-xs text-muted-foreground">Envoyez un virement à Support@nivra-telecom.ca</p>
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* PayPal */}
                    {paymentMethod === "paypal" && !paypalCaptureId && (
                      <div className="pt-2">
                        <PayPalButton
                          amount={todayTotal}
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
                            toast.success("Paiement PayPal confirmé !");
                          }}
                          onError={(err) => toast.error(`Erreur PayPal: ${err}`)}
                          disabled={todayTotal <= 0}
                        />
                      </div>
                    )}

                    {paymentMethod === "paypal" && !!paypalCaptureId && (
                      <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        <div>
                          <p className="font-semibold text-emerald-800">Paiement PayPal confirmé</p>
                          <p className="text-xs text-emerald-600">Réf: {paypalCaptureId}</p>
                        </div>
                      </div>
                    )}

                    {/* E-Transfer */}
                    {paymentMethod === "etransfer" && (
                      <div className="space-y-4 pt-2">
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                          <p className="text-sm font-medium text-amber-800 mb-2">Instructions de virement</p>
                          <p className="text-xs text-amber-700">
                            Envoyez <strong>{fmt(todayTotal)}</strong> par Interac à <strong>Support@nivra-telecom.ca</strong>
                          </p>
                          <p className="text-xs text-amber-600 mt-1">
                            Mot de question/réponse : Nivra / Nivra2026
                          </p>
                        </div>
                        <div>
                          <Label>Numéro de confirmation Interac</Label>
                          <Input
                            placeholder="Ex: CA1234567890"
                            value={etransferRef}
                            onChange={e => setEtransferRef(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Nom de l'expéditeur</Label>
                          <Input
                            placeholder="Votre nom complet"
                            value={etransferSender}
                            onChange={e => setEtransferSender(e.target.value)}
                          />
                        </div>
                        {etransferRef.length >= 6 && etransferSender.length >= 2 && (
                          <Button
                            className="w-full"
                            onClick={() => { setPaymentComplete(true); toast.success("Référence Interac enregistrée"); }}
                          >
                            Confirmer le virement
                          </Button>
                        )}
                      </div>
                    )}

                    <Separator />

                    {/* Terms */}
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="terms"
                          checked={termsAccepted}
                          onCheckedChange={v => setTermsAccepted(!!v)}
                        />
                        <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                          J'accepte les{" "}
                          <a href="/legal/terms" target="_blank" className="text-primary underline">conditions d'utilisation</a>,{" "}
                          la{" "}
                          <a href="/legal/privacy" target="_blank" className="text-primary underline">politique de confidentialité</a>{" "}
                          et la{" "}
                          <a href="/legal/refund" target="_blank" className="text-primary underline">politique de remboursement</a>.
                        </label>
                      </div>
                    </div>

                    {/* Security badges */}
                    <div className="flex items-center gap-4 pt-2">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Lock className="w-3.5 h-3.5 text-emerald-600" />
                        Paiement sécurisé
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Shield className="w-3.5 h-3.5 text-emerald-600" />
                        Aucun frais caché
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(4)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Retour
                  </Button>
                  <Button
                    className="flex-1 h-12 text-base font-bold"
                    disabled={!isPaymentDone || !termsAccepted || isSubmitting}
                    onClick={handleSubmit}
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Traitement...</>
                    ) : (
                      <>Confirmer la commande <Check className="w-5 h-5 ml-2" /></>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* ═══ STEP 6: CONFIRMATION ═══ */}
            {step === 6 && orderResult && (
              <div className="space-y-6">
                <Card className="border-emerald-200 bg-emerald-50/50">
                  <CardContent className="py-8 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">Commande confirmée !</h2>
                    <p className="text-muted-foreground mb-4">
                      Commande #{orderResult.orderNumber}
                    </p>

                    <div className="bg-white rounded-xl p-6 text-left space-y-4 max-w-md mx-auto border border-emerald-200">
                      <h3 className="font-semibold text-foreground">Résumé</h3>
                      {selectedServices.map(s => (
                        <div key={s.id} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{s.name}</span>
                          <span className="font-medium text-foreground">{fmt(s.price)}/mois</span>
                        </div>
                      ))}
                      <Separator />
                      <div className="flex justify-between text-sm font-bold">
                        <span>Total payé aujourd'hui</span>
                        <span>{fmt(todayTotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Prochaine facturation</span>
                        <span>{fmt(monthlyTotalWithTax)}/mois</span>
                      </div>
                    </div>

                    {/* Account setup CTA */}
                    <div className="mt-6 p-4 bg-primary/5 rounded-xl border border-primary/20 max-w-md mx-auto">
                      <Mail className="w-6 h-6 text-primary mx-auto mb-2" />
                      <p className="text-sm font-semibold text-foreground mb-1">
                        Vérifiez votre courriel
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Un courriel a été envoyé à <strong>{email}</strong> pour compléter la création de votre compte
                        et accéder à votre portail client.
                      </p>
                    </div>

                    {/* Next steps */}
                    <div className="mt-6 text-left max-w-md mx-auto space-y-3">
                      <h3 className="font-semibold text-foreground text-sm">Prochaines étapes</h3>
                      <div className="flex items-start gap-3 text-sm">
                        <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-primary">1</span>
                        </div>
                        <p className="text-muted-foreground">Cliquez sur le lien dans votre courriel pour définir votre mot de passe</p>
                      </div>
                      <div className="flex items-start gap-3 text-sm">
                        <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-primary">2</span>
                        </div>
                        <p className="text-muted-foreground">Connectez-vous à votre portail pour suivre votre commande</p>
                      </div>
                      <div className="flex items-start gap-3 text-sm">
                        <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-primary">3</span>
                        </div>
                        <p className="text-muted-foreground">
                          {requiresInstallation
                            ? `Rendez-vous d'installation: ${selectedDate} à ${selectedTime}`
                            : "Votre équipement sera expédié sous 2-5 jours ouvrables"
                          }
                        </p>
                      </div>
                    </div>

                    <Button className="mt-6" onClick={() => navigate("/")}>
                      Retour à l'accueil
                    </Button>
                  </CardContent>
                </Card>
              </div>
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
