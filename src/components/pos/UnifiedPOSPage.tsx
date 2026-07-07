/**
 * UnifiedPOSPage - Unified Point of Sale interface for all portals
 * Used by: Admin, Employee, Technician
 * Admin portal gets enhanced features (client search, PIN, inline Square card charge)
 */
import { useState, useMemo, useEffect, useRef } from "react";
import { useCheckoutDraft } from "@/hooks/useCheckoutDraft";
import { CartResumeBanner } from "@/components/checkout/CartResumeBanner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useFieldSalesOffers, FieldSalesOffer, SelectedService } from "@/hooks/useFieldSalesOffers";
import { useUnifiedPOS, calculateUnifiedPOSTotals } from "@/hooks/useUnifiedPOS";
import { EquipmentItem } from "@/components/pos/POSEquipmentSelector";
import { AdjustmentItem } from "@/components/pos/POSAdjustments";
import { toast } from "sonner";
import { Loader2, ChevronLeft, Check, ShoppingCart, Package, Wrench, DollarSign, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import StaffBackground from "@/components/staff/StaffBackground";
import { POSHeader } from "@/components/pos/POSHeader";
import { POSCategoryTabs, POSCategory } from "@/components/pos/POSCategoryTabs";
import { POSSearchBar } from "@/components/pos/POSSearchBar";
import { POSProductGrid } from "@/components/pos/POSProductGrid";
import { POSCustomerForm, CustomerData } from "@/components/pos/POSCustomerForm";
import { POSCustomerFormAdmin, AdminCustomerData } from "@/components/pos/POSCustomerFormAdmin";
import { POSPaymentForm, PaymentData } from "@/components/pos/POSPaymentForm";
import { POSPaymentFormAdmin, AdminPaymentData } from "@/components/pos/POSPaymentFormAdmin";
import { POSOrderSummary } from "@/components/pos/POSOrderSummary";
import { POSEquipmentSelector } from "@/components/pos/POSEquipmentSelector";
import { POSAdjustments } from "@/components/pos/POSAdjustments";
import { POSUnifiedCart } from "@/components/pos/POSUnifiedCart";
import InstallSlotPicker from "@/components/shared/InstallSlotPicker";
import CoaxialSurvey, { initialCoaxialAnswers, type CoaxialAnswers } from "@/components/shared/CoaxialSurvey";
import { useIsMobile } from "@/hooks/use-mobile";
import { createPOSDraftInvoice, finalizePOSCardPayment, type POSDraftInvoiceResult } from "@/lib/pos/createPOSDraftInvoice";




/** Resolve or create account for a client (used by non-card POS flow) */
async function resolveAccountForOrder(clientId: string, serviceAddress: string, serviceCity: string, servicePostalCode: string): Promise<string> {
  const { data: existing } = await supabase
    .from("accounts")
    .select("id")
    .eq("client_id", clientId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("accounts")
    .insert({
      client_id: clientId,
      status: "active",
      primary_service_address: serviceAddress || null,
      primary_service_city: serviceCity || null,
      primary_service_province: "QC",
      primary_service_postal_code: servicePostalCode || null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: reFetched } = await supabase
        .from("accounts")
        .select("id")
        .eq("client_id", clientId)
        .eq("status", "active")
        .maybeSingle();
      if (reFetched) return reFetched.id;
    }
    throw new Error(`Échec résolution compte: ${error.message}`);
  }
  return created.id;
}

type POSStep = "catalog" | "customer" | "payment" | "confirmation";
type CatalogTab = "services" | "equipment" | "adjustments";

const STEP_TITLES: Record<POSStep, string> = {
  catalog: "Catalogue",
  customer: "Client",
  payment: "Paiement",
  confirmation: "Confirmation",
};

interface UnifiedPOSPageProps {
  portalType: "admin" | "staff" | "technician";
  backPath: string;
  repName?: string;
  onOrderComplete?: (orderId: string) => void;
}

export default function UnifiedPOSPage({
  portalType,
  backPath,
  repName = "",
  onOrderComplete,
}: UnifiedPOSPageProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: offers = [], isLoading: offersLoading } = useFieldSalesOffers();
  
  // POS State
  const pos = useUnifiedPOS();
  
  // UI State
  const [step, setStep] = useState<POSStep>("catalog");
  const [catalogTab, setCatalogTab] = useState<CatalogTab>("services");
  const [activeCategory, setActiveCategory] = useState<POSCategory>("all");
  const [customerData, setCustomerData] = useState<CustomerData | AdminCustomerData | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentData | AdminPaymentData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [precreatedCardOrder, setPrecreatedCardOrder] = useState<POSDraftInvoiceResult | null>(null);
  const [installSlot, setInstallSlot] = useState<{ date: string; time_slot: string } | null>(null);
  const [coaxSurvey, setCoaxSurvey] = useState<CoaxialAnswers>(initialCoaxialAnswers());
  const [draftDismissed, setDraftDismissed] = useState(false);

  // Cart persistence — per portal
  const draftSource = `pos_${portalType}`;
  const {
    draft: savedDraft,
    hasDraft,
    save: saveDraft,
    clear: clearDraft,
  } = useCheckoutDraft<{
    services: SelectedService[];
    equipment: EquipmentItem[];
    adjustments: AdjustmentItem[];
  }>(draftSource);

  // Autosave whenever cart changes (skip empty)
  const skipNextSaveRef = useRef(true);
  useEffect(() => {
    if (skipNextSaveRef.current) { skipNextSaveRef.current = false; return; }
    if (pos.isEmpty) return;
    saveDraft({ services: pos.services, equipment: pos.equipment, adjustments: pos.adjustments });
  }, [pos.services, pos.equipment, pos.adjustments, pos.isEmpty, saveDraft]);

  const handleResumeDraft = () => {
    if (!savedDraft) return;
    pos.setServices(savedDraft.services || []);
    pos.setEquipment(savedDraft.equipment || []);
    pos.setAdjustments(savedDraft.adjustments || []);
    setDraftDismissed(true);
    toast.success("Panier restauré");
  };

  const handleDismissDraft = () => {
    clearDraft();
    setDraftDismissed(true);
  };
  
  
  // Is this the admin portal with full features?
  const isAdminPortal = portalType === "admin";

  // Requires installation appointment: Internet or TV services in cart trigger it.
  const requiresInstall = useMemo(
    () => pos.services.some((s) => s.category === "internet" || s.category === "tv"),
    [pos.services],
  );
  const requiresCoax = useMemo(
    () => pos.services.some((s) => s.category === "tv"),
    [pos.services],
  );
  const coaxComplete =
    !requiresCoax ||
    (coaxSurvey.has_outlet !== null &&
      (coaxSurvey.has_outlet === "no" ||
        (coaxSurvey.outlet_works !== null && coaxSurvey.outlet_count !== null && coaxSurvey.outlet_count > 0)));
  const installComplete = !requiresInstall || !!installSlot;
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [showFeatured, setShowFeatured] = useState(false);
  const [showDiscounted, setShowDiscounted] = useState(false);

  // Filter offers
  const filteredOffers = useMemo(() => {
    let result = offers;

    if (activeCategory !== "all") {
      result = result.filter(o => o.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(o => 
        o.name_fr.toLowerCase().includes(query) ||
        o.description_fr?.toLowerCase().includes(query)
      );
    }

    if (showFeatured) {
      result = result.filter(o => o.is_featured);
    }

    if (showDiscounted) {
      result = result.filter(o => o.discount_percent && o.discount_percent > 0);
    }

    return result;
  }, [offers, activeCategory, searchQuery, showFeatured, showDiscounted]);

  const featuredCount = offers.filter(o => o.is_featured).length;
  const discountedCount = offers.filter(o => o.discount_percent && o.discount_percent > 0).length;

  // Service toggle
  const toggleService = (offer: FieldSalesOffer) => {
    const exists = pos.services.find(s => s.offerId === offer.id);
    if (exists) {
      pos.removeService(offer.id);
    } else {
      pos.addService({
        offerId: offer.id,
        name: offer.name_fr,
        category: offer.category,
        priceMonthly: offer.price_monthly || 0,
        priceSetup: offer.price_setup || 0,
        quantity: 1,
      });
    }
  };

  // Category counts
  const selectedCounts = pos.services.reduce((acc, s) => {
    acc[s.category] = (acc[s.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Step handlers
  const handleCheckout = () => {
    if (pos.isEmpty) {
      toast.error("Ajoutez au moins un article");
      return;
    }
    setStep("customer");
    setCartOpen(false);
  };

  const handleCustomerSubmit = (data: CustomerData | AdminCustomerData) => {
    if (requiresCoax && !coaxComplete) {
      toast.error("Veuillez compléter le questionnaire coaxial");
      return;
    }
    if (requiresInstall && !installComplete) {
      toast.error("Veuillez choisir un créneau d'installation");
      return;
    }
    setCustomerData(data);
    setStep("payment");
  };

  const handlePaymentSubmit = (data: PaymentData | AdminPaymentData) => {
    setPaymentData(data);
    setStep("confirmation");
  };

  const createCardInvoiceBeforeCharge = async () => {
    if (!customerData || pos.isEmpty) throw new Error("Client ou panier manquant");
    if (precreatedCardOrder) {
      return {
        invoice_id: precreatedCardOrder.invoiceId,
        order_id: precreatedCardOrder.orderId,
        order_number: precreatedCardOrder.orderNumber,
      };
    }

    const custInfo = buildCustomerInfo();
    if (!custInfo) throw new Error("Client invalide");
    const payload = pos.getOrderPayload();
    const draft = await createPOSDraftInvoice({
      customer: custInfo,
      services: pos.services,
      equipment: pos.equipment,
      adjustments: pos.adjustments,
      totals: pos.totals,
      portalType,
      notes: "Paiement Square initialisé avant encaissement",
      orderPayload: {
        customer: custInfo,
        services: payload.services,
        equipment: payload.equipment,
        adjustments: payload.adjustments,
        installation: requiresInstall && installSlot
          ? { date: installSlot.date, time_slot: installSlot.time_slot, required: true }
          : { required: false },
        coaxial_survey: requiresCoax ? coaxSurvey : null,
      },
    });
    setPrecreatedCardOrder(draft);
    return { invoice_id: draft.invoiceId, order_id: draft.orderId, order_number: draft.orderNumber };
  };

  // ── Build customer info shared by both card and non-card flows ──
  const buildCustomerInfo = () => {
    if (!customerData) return null;
    const normalizedDob = (customerData.date_of_birth || "").trim() || null;
    if (!normalizedDob) throw new Error("Date de naissance manquante");

    const adminData = (customerData as unknown as Partial<AdminCustomerData>) || {};
    const derivedFirstName =
      (typeof adminData.first_name === "string" && adminData.first_name.trim())
        ? adminData.first_name.trim()
        : (customerData.full_name.split(" ")[0] || null);
    const derivedLastName =
      (typeof adminData.last_name === "string" && adminData.last_name.trim())
        ? adminData.last_name.trim()
        : (customerData.full_name.split(" ").slice(1).join(" ") || null);

    const isExistingClient = isAdminPortal && adminData.is_new_client === false && !!adminData.client_id;

    return {
      full_name: customerData.full_name,
      first_name: derivedFirstName || "",
      last_name: derivedLastName || "",
      email: customerData.email,
      phone: customerData.phone,
      service_address: customerData.service_address,
      service_city: customerData.service_city,
      service_postal_code: customerData.service_postal_code,
      date_of_birth: normalizedDob,
      client_id: isExistingClient ? (adminData.client_id as string) : null,
    };
  };

  const handleConfirmOrder = async () => {
    if (!customerData || !paymentData || pos.isEmpty) return;

    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("Session expirée");
        navigate(backPath);
        return;
      }

      const custInfo = buildCustomerInfo();
      if (!custInfo) return;

      // Ensure client has auth account + billing account before creating order
      let resolvedClientId = custInfo.client_id;
      if (!resolvedClientId) {
        try {
          const { data: autoResult } = await supabase.functions.invoke("auto-create-client-account", {
            body: {
              email: custInfo.email,
              first_name: custInfo.first_name,
              last_name: custInfo.last_name,
              phone: custInfo.phone,
              service_address: custInfo.service_address,
              service_city: custInfo.service_city,
              service_postal_code: custInfo.service_postal_code,
              date_of_birth: custInfo.date_of_birth,
            },
          });
          resolvedClientId = autoResult?.user_id || null;
        } catch (linkErr) {
          console.warn("[POS] auto-create-client-account failed:", linkErr);
        }
      }

      if (!resolvedClientId) {
        throw new Error("Impossible de résoudre le compte client. Veuillez réessayer.");
      }

      const accountId = await resolveAccountForOrder(
        resolvedClientId,
        custInfo.service_address,
        custInfo.service_city,
        custInfo.service_postal_code
      );

      const payload = pos.getOrderPayload();
      const paymentMethod = paymentData.payment_method;
      const paymentReference = 'payment_reference' in paymentData ? paymentData.payment_reference : undefined;
      const squarePaymentId = 'square_payment_id' in paymentData ? (paymentData as AdminPaymentData).square_payment_id : undefined;
      const precreatedOrderId = 'precreated_order_id' in paymentData ? (paymentData as AdminPaymentData).precreated_order_id : undefined;

      if (precreatedOrderId) {
        await finalizePOSCardPayment(precreatedOrderId, portalType);
        onOrderComplete?.(precreatedOrderId);
        toast.success("🎉 Commande créée avec succès!", {
          description: `Total: ${payload.totals.first_month_total.toFixed(2)} $`,
        });
        pos.clearCart();
        clearDraft();
        setCustomerData(null);
        setPaymentData(null);
        setPrecreatedCardOrder(null);
        setStep("catalog");
        return;
      }

      const { data: newOrder, error } = await supabase
        .from("orders")
        .insert([{
          user_id: resolvedClientId,
          account_id: accountId,
          service_type: pos.services[0]?.category || "bundle",
          client_email: custInfo.email,
          client_dob: custInfo.date_of_birth,
          client_first_name: custInfo.first_name,
          client_last_name: custInfo.last_name,
          client_phone: custInfo.phone,
          service_address: custInfo.service_address,
          service_city: custInfo.service_city,
          service_postal_code: custInfo.service_postal_code,
          equipment_details: JSON.parse(JSON.stringify({
            customer: custInfo,
            services: payload.services,
            equipment: payload.equipment,
            adjustments: payload.adjustments,
            installation: requiresInstall && installSlot
              ? { date: installSlot.date, time_slot: installSlot.time_slot, required: true }
              : { required: false },
            coaxial_survey: requiresCoax ? coaxSurvey : null,
            ...((customerData as AdminCustomerData).is_new_client !== undefined && {
              is_new_client: (customerData as AdminCustomerData).is_new_client,
              client_id: (customerData as AdminCustomerData).client_id,
              accept_marketing: (customerData as AdminCustomerData).accept_marketing,
              accept_sms_notifications: (customerData as AdminCustomerData).accept_sms_notifications,
              pin: (customerData as AdminCustomerData).pin || null,
            }),
            ...(squarePaymentId && { square_payment_id: squarePaymentId }),
          })),
          coaxial_survey: requiresCoax ? (coaxSurvey as unknown as never) : null,
          subtotal: payload.totals.monthly_subtotal + payload.totals.equipment_total + payload.totals.adjustments_total,
          tps_amount: payload.totals.tps,
          tvq_amount: payload.totals.tvq,
          total_amount: payload.totals.first_month_total,
          payment_status: paymentMethod === "deferred" ? "pending" : (squarePaymentId ? "paid" : "confirmed"),
          payment_reference: squarePaymentId || paymentReference || null,
          internal_notes: `[POS ${portalType.toUpperCase()}] ${paymentData.notes || ""}`,
          status: "pending",
        }])
        .select("id, order_number")
        .single();

      if (error) throw error;

      // Orchestration
      try {
        const { orchestrateOrder } = await import("@/lib/orderOrchestration");
        const orchResult = await orchestrateOrder(newOrder.id);
        console.log("[POS Orchestration] Result:", orchResult);
      } catch (orchErr) {
        console.warn("[POS Orchestration] Failed (non-blocking):", orchErr);
      }

      onOrderComplete?.(newOrder.id);

      toast.success("🎉 Commande créée avec succès!", {
        description: `Total: ${payload.totals.first_month_total.toFixed(2)} $`,
      });

      pos.clearCart();
      clearDraft();
      setCustomerData(null);
      setPaymentData(null);
      
      setStep("catalog");

    } catch (error: any) {
      console.error("Order error:", error);
      const description = [error?.message, error?.details, error?.hint].filter(Boolean).join(" • ");
      toast.error("Erreur", { description: description || "Erreur inconnue" });
    } finally {
      setIsSubmitting(false);
    }
  };

  
  

  const goBack = () => {
    if (step === "customer") setStep("catalog");
    else if (step === "payment") setStep("customer");
    else if (step === "confirmation") setStep("payment");
    else navigate(backPath);
  };

  if (offersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <StaffBackground />
        <div className="flex flex-col items-center gap-4 z-10">
          <Loader2 className="h-10 w-10 animate-spin text-orange-400" />
          <p className="text-slate-400">Chargement du catalogue...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <StaffBackground />
      
      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <POSHeader repName={repName} />

        {/* Step Progress */}
        {step !== "catalog" && (
          <div className="px-4 py-3 border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={goBack}
                className="text-slate-400 hover:text-white shrink-0"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {(["catalog", "customer", "payment", "confirmation"] as POSStep[]).map((s, i) => (
                    <div key={s} className="flex items-center gap-2">
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                        step === s 
                          ? "bg-orange-500 text-white"
                          : (["catalog", "customer", "payment", "confirmation"].indexOf(step) > i)
                            ? "bg-emerald-500 text-white"
                            : "bg-slate-700 text-slate-400"
                      )}>
                        {(["catalog", "customer", "payment", "confirmation"].indexOf(step) > i) ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          i + 1
                        )}
                      </div>
                      {i < 3 && (
                        <div className={cn(
                          "w-6 h-0.5 rounded-full",
                          (["catalog", "customer", "payment", "confirmation"].indexOf(step) > i)
                            ? "bg-emerald-500"
                            : "bg-slate-700"
                        )} />
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-white font-medium mt-1">{STEP_TITLES[step]}</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          {step === "catalog" && (
            <div className={cn("h-full flex", isMobile ? "flex-col" : "")}>
              {hasDraft && pos.isEmpty && !draftDismissed && (
                <div className="absolute top-2 left-2 right-2 z-20 md:left-4 md:right-4">
                  <CartResumeBanner
                    itemCount={
                      (savedDraft?.services?.length || 0) +
                      (savedDraft?.equipment?.length || 0) +
                      (savedDraft?.adjustments?.length || 0)
                    }
                    onResume={handleResumeDraft}
                    onDismiss={handleDismissDraft}
                  />
                </div>
              )}
              <div className={cn("flex-1 flex flex-col", !isMobile && "border-r border-slate-700/50")}>
                {/* Catalog Tabs */}
                <div className="border-b border-slate-700/50 bg-slate-900/30">
                  <Tabs value={catalogTab} onValueChange={(v) => setCatalogTab(v as CatalogTab)}>
                    <TabsList className="w-full justify-start bg-transparent h-auto p-2 gap-2">
                      <TabsTrigger
                        value="services"
                        className="data-[state=active]:bg-orange-500 data-[state=active]:text-white bg-slate-800/50 border border-slate-700/50"
                      >
                        <Package className="h-4 w-4 mr-2" />
                        Services
                        {pos.services.length > 0 && (
                          <Badge className="ml-2 bg-white/20 text-white h-5 px-1.5">{pos.services.length}</Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger
                        value="equipment"
                        className="data-[state=active]:bg-cyan-500 data-[state=active]:text-white bg-slate-800/50 border border-slate-700/50"
                      >
                        <Wrench className="h-4 w-4 mr-2" />
                        Équipements
                        {pos.equipment.length > 0 && (
                          <Badge className="ml-2 bg-white/20 text-white h-5 px-1.5">{pos.equipment.length}</Badge>
                        )}
                      </TabsTrigger>
                      <TabsTrigger
                        value="adjustments"
                        className="data-[state=active]:bg-purple-500 data-[state=active]:text-white bg-slate-800/50 border border-slate-700/50"
                      >
                        <DollarSign className="h-4 w-4 mr-2" />
                        Ajustements
                        {pos.adjustments.length > 0 && (
                          <Badge className="ml-2 bg-white/20 text-white h-5 px-1.5">{pos.adjustments.length}</Badge>
                        )}
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="services" className="mt-0 flex-1 flex flex-col">
                      <POSCategoryTabs
                        activeCategory={activeCategory}
                        onCategoryChange={setActiveCategory}
                        selectedCounts={selectedCounts}
                      />
                      <POSSearchBar
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        showFeatured={showFeatured}
                        onFeaturedToggle={() => setShowFeatured(!showFeatured)}
                        showDiscounted={showDiscounted}
                        onDiscountedToggle={() => setShowDiscounted(!showDiscounted)}
                        featuredCount={featuredCount}
                        discountedCount={discountedCount}
                      />
                      <POSProductGrid
                        offers={filteredOffers}
                        allOffers={offers}
                        selectedServices={pos.services}
                        onToggleService={toggleService}
                        onQuantityChange={(id, delta) => pos.updateServiceQuantity(id, delta)}
                        isMobile={isMobile}
                      />
                    </TabsContent>

                    <TabsContent value="equipment" className="mt-0 p-4">
                      <POSEquipmentSelector
                        selectedEquipment={pos.equipment}
                        onEquipmentChange={pos.setEquipment}
                      />
                    </TabsContent>

                    <TabsContent value="adjustments" className="mt-0 p-4">
                      <POSAdjustments
                        adjustments={pos.adjustments}
                        onAdjustmentsChange={pos.setAdjustments}
                      />
                    </TabsContent>
                  </Tabs>
                </div>

                {/* Mobile Cart Button */}
                {isMobile && !pos.isEmpty && (
                  <Sheet open={cartOpen} onOpenChange={setCartOpen}>
                    <SheetTrigger asChild>
                      <div className="p-4 border-t border-slate-700/50 bg-slate-900/90 backdrop-blur-xl">
                        <Button className="w-full h-14 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold text-lg shadow-lg">
                          <ShoppingCart className="h-5 w-5 mr-3" />
                          Voir panier ({pos.itemCount})
                          <span className="ml-auto">{pos.totals.firstMonthTotal.toFixed(2)} $</span>
                        </Button>
                      </div>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-[80vh] p-0 bg-transparent border-0">
                      <POSUnifiedCart
                        services={pos.services}
                        equipment={pos.equipment}
                        adjustments={pos.adjustments}
                        totals={pos.totals}
                        onRemoveService={pos.removeService}
                        onRemoveEquipment={pos.removeEquipment}
                        onRemoveAdjustment={pos.removeAdjustment}
                        onClearCart={pos.clearCart}
                        onCheckout={handleCheckout}
                      />
                    </SheetContent>
                  </Sheet>
                )}
              </div>

              {/* Desktop Cart Sidebar */}
              {!isMobile && (
                <div className="w-80 xl:w-96">
                  <POSUnifiedCart
                    services={pos.services}
                    equipment={pos.equipment}
                    adjustments={pos.adjustments}
                    totals={pos.totals}
                    onRemoveService={pos.removeService}
                    onRemoveEquipment={pos.removeEquipment}
                    onRemoveAdjustment={pos.removeAdjustment}
                    onClearCart={pos.clearCart}
                    onCheckout={handleCheckout}
                  />
                </div>
              )}
            </div>
          )}

          {step === "customer" && (
            <div className="h-full overflow-auto">
              <div className={cn("p-4 mx-auto space-y-4", isAdminPortal ? "max-w-2xl" : "max-w-lg")}>
                {requiresCoax && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <h3 className="text-sm font-semibold text-white mb-3">Questionnaire câble coaxial</h3>
                    <CoaxialSurvey value={coaxSurvey} onChange={setCoaxSurvey} variant="compact" />
                  </div>
                )}
                {requiresInstall && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <h3 className="text-sm font-semibold text-white mb-3">Rendez-vous d'installation</h3>
                    <InstallSlotPicker value={installSlot} onChange={setInstallSlot} variant="compact" />
                  </div>
                )}
                {isAdminPortal ? (
                  <POSCustomerFormAdmin
                    onSubmit={handleCustomerSubmit}
                    isSubmitting={isSubmitting}
                  />
                ) : (
                  <POSCustomerForm
                    onSubmit={handleCustomerSubmit}
                    isSubmitting={isSubmitting}
                  />
                )}
              </div>
            </div>
          )}

          {step === "payment" && (
            <div className="h-full overflow-auto">
              <div className={cn("p-4 mx-auto", isAdminPortal ? "max-w-2xl" : "max-w-lg")}>
                {isAdminPortal ? (
                  <POSPaymentFormAdmin
                    onSubmit={handlePaymentSubmit}
                    isSubmitting={isSubmitting}
                    totalAmount={pos.totals.firstMonthTotal}
                    customerName={customerData?.full_name}
                    customerEmail={customerData?.email}
                    onBeforeCardCharge={createCardInvoiceBeforeCharge}
                  />
                ) : (
                  <POSPaymentForm
                    onSubmit={handlePaymentSubmit}
                    isSubmitting={isSubmitting}
                    totalAmount={pos.totals.firstMonthTotal}
                  />
                )}
              </div>
            </div>
          )}

          {step === "confirmation" && customerData && paymentData && (
            <div className="h-full overflow-auto">
              <div className="p-4 max-w-lg mx-auto space-y-4">
                <POSOrderSummary
                  services={pos.services}
                  customer={customerData as CustomerData}
                  payment={paymentData as PaymentData}
                />
                {/* Equipment summary */}
                {pos.equipment.length > 0 && (
                  <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                    <h4 className="text-white font-semibold mb-2">Équipements ({pos.equipment.length})</h4>
                    {pos.equipment.map(e => (
                      <div key={e.id} className="flex justify-between text-sm py-1">
                        <span className="text-slate-300">{e.name} x{e.quantity}</span>
                        <span className="text-cyan-400">{(e.price * e.quantity).toFixed(2)}$</span>
                      </div>
                    ))}
                  </div>
                )}
                {/* Adjustments summary */}
                {pos.adjustments.length > 0 && (
                  <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                    <h4 className="text-white font-semibold mb-2">Ajustements ({pos.adjustments.length})</h4>
                    {pos.adjustments.map(a => (
                      <div key={a.id} className="flex justify-between text-sm py-1">
                        <span className="text-slate-300">{a.name}</span>
                        <span className={a.amount < 0 ? "text-emerald-400" : "text-red-400"}>
                          {a.amount >= 0 ? "+" : ""}{a.amount.toFixed(2)}$
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Confirmation — bouton simple, le paiement Square (si applicable) a déjà été pris à l'étape précédente */}
                <Button
                  onClick={handleConfirmOrder}
                  disabled={isSubmitting}
                  className="w-full h-14 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold text-lg shadow-lg"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <Check className="h-5 w-5 mr-2" />
                  )}
                  Confirmer et enregistrer
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
