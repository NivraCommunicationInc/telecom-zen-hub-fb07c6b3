/**
 * FieldSalesPOS - Professional Point of Sale interface for field sales representatives
 * Complete POS experience with product grid, cart, customer info, and payment
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useFieldSalesOffers, SelectedService, calculateFieldSalesTotals } from "@/hooks/useFieldSalesOffers";
import { toast } from "sonner";
import { Loader2, ArrowLeft, ShoppingCart, X, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import StaffBackground from "@/components/staff/StaffBackground";
import { POSHeader } from "@/components/field-sales/POSHeader";
import { POSQuickStats } from "@/components/field-sales/POSQuickStats";
import { POSCategoryTabs, POSCategory } from "@/components/field-sales/POSCategoryTabs";
import { POSServiceCard } from "@/components/field-sales/POSServiceCard";
import { POSCart } from "@/components/field-sales/POSCart";
import { POSCustomerForm, CustomerData } from "@/components/field-sales/POSCustomerForm";
import { POSPaymentForm, PaymentData } from "@/components/field-sales/POSPaymentForm";
import { useIsMobile } from "@/hooks/use-mobile";

type POSStep = "catalog" | "customer" | "payment" | "confirmation";

export default function FieldSalesPOS() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: offers = [], isLoading: offersLoading } = useFieldSalesOffers();
  
  // State
  const [step, setStep] = useState<POSStep>("catalog");
  const [activeCategory, setActiveCategory] = useState<POSCategory>("all");
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [repName, setRepName] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  
  // Stats
  const [stats, setStats] = useState({
    todaySales: 0,
    todayRevenue: 0,
    pendingSales: 0,
    weekCommissions: 0,
  });

  // Load rep name and stats
  useEffect(() => {
    const loadData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Get profile name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", session.user.id)
        .maybeSingle();
      
      setRepName(profile?.full_name || session.user.email?.split("@")[0] || "");

      // Get today stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 7);
      const weekStartISO = weekStart.toISOString();

      const [todayRes, pendingRes, commissionsRes] = await Promise.all([
        supabase
          .from("field_sales_orders")
          .select("id, total_amount")
          .eq("salesperson_id", session.user.id)
          .gte("created_at", todayISO),
        supabase
          .from("field_sales_orders")
          .select("id", { count: "exact", head: true })
          .eq("salesperson_id", session.user.id)
          .eq("payment_status", "pending"),
        supabase
          .from("sales_commissions")
          .select("commission_amount")
          .eq("salesperson_id", session.user.id)
          .gte("created_at", weekStartISO)
          .in("status", ["pending", "validated"]),
      ]);

      const todayTotal = (todayRes.data || []).reduce((sum, s) => sum + (s.total_amount || 0), 0);
      const weekCommTotal = (commissionsRes.data || []).reduce((sum, c) => sum + (c.commission_amount || 0), 0);

      setStats({
        todaySales: todayRes.data?.length || 0,
        todayRevenue: todayTotal,
        pendingSales: pendingRes.count || 0,
        weekCommissions: weekCommTotal,
      });
    };

    loadData();
  }, []);

  // Filter offers by category
  const filteredOffers = activeCategory === "all" 
    ? offers 
    : offers.filter(o => o.category === activeCategory);

  // Selection handlers
  const isSelected = (offerId: string) => selectedServices.some(s => s.offerId === offerId);
  
  const getQuantity = (offerId: string) => {
    const service = selectedServices.find(s => s.offerId === offerId);
    return service?.quantity || 0;
  };

  const toggleService = (offer: typeof offers[0]) => {
    if (isSelected(offer.id)) {
      setSelectedServices(prev => prev.filter(s => s.offerId !== offer.id));
    } else {
      setSelectedServices(prev => [
        ...prev,
        {
          offerId: offer.id,
          name: offer.name_fr,
          category: offer.category,
          priceMonthly: offer.price_monthly || 0,
          priceSetup: offer.price_setup || 0,
          quantity: 1,
        },
      ]);
    }
  };

  const updateQuantity = (offerId: string, delta: number) => {
    setSelectedServices(prev =>
      prev.map(s => {
        if (s.offerId === offerId) {
          return { ...s, quantity: Math.max(1, s.quantity + delta) };
        }
        return s;
      })
    );
  };

  const removeService = (offerId: string) => {
    setSelectedServices(prev => prev.filter(s => s.offerId !== offerId));
  };

  const clearCart = () => {
    setSelectedServices([]);
  };

  // Category counts for badges
  const selectedCounts = selectedServices.reduce((acc, s) => {
    acc[s.category] = (acc[s.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Step handlers
  const handleCheckout = () => {
    if (selectedServices.length === 0) {
      toast.error("Ajoutez au moins un service");
      return;
    }
    setStep("customer");
    setCartOpen(false);
  };

  const handleCustomerSubmit = (data: CustomerData) => {
    setCustomerData(data);
    setStep("payment");
  };

  const handlePaymentSubmit = async (paymentData: PaymentData) => {
    if (!customerData || selectedServices.length === 0) return;

    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("Session expirée");
        navigate("/field-sales");
        return;
      }

      const totals = calculateFieldSalesTotals(selectedServices);

      // Build services JSON
      const servicesJson = selectedServices.map(s => ({
        offer_id: s.offerId,
        name: s.name,
        category: s.category,
        price_monthly: s.priceMonthly,
        price_setup: s.priceSetup,
        quantity: s.quantity,
      }));

      // Insert order
      const { error } = await supabase
        .from("field_sales_orders")
        .insert({
          salesperson_id: session.user.id,
          customer_name: customerData.full_name,
          customer_email: customerData.email,
          customer_phone: customerData.phone,
          customer_address: customerData.service_address,
          customer_city: customerData.service_city,
          customer_postal_code: customerData.service_postal_code,
          customer_date_of_birth: customerData.date_of_birth || null,
          services: servicesJson,
          total_amount: totals.total,
          payment_method: paymentData.payment_method,
          payment_reference: paymentData.payment_reference || null,
          payment_status: paymentData.payment_method === "deferred" ? "pending" : "confirmed",
          internal_notes: paymentData.notes || null,
          sync_status: "synced",
          synced_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success("🎉 Vente enregistrée!", {
        description: `Total: ${totals.total.toFixed(2)} $`,
      });

      // Reset and go back to catalog
      setSelectedServices([]);
      setCustomerData(null);
      setStep("catalog");
      
      // Refresh stats
      setStats(prev => ({
        ...prev,
        todaySales: prev.todaySales + 1,
        todayRevenue: prev.todayRevenue + totals.total,
      }));

    } catch (error: any) {
      console.error("Error saving sale:", error);
      toast.error("Erreur", { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBack = () => {
    if (step === "customer") setStep("catalog");
    else if (step === "payment") setStep("customer");
    else navigate("/field-sales/dashboard");
  };

  const totals = calculateFieldSalesTotals(selectedServices);
  const cartItemCount = selectedServices.reduce((sum, s) => sum + s.quantity, 0);

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
        {/* POS Header */}
        <POSHeader repName={repName} />

        {/* Stats Bar */}
        <POSQuickStats
          todaySales={stats.todaySales}
          todayRevenue={stats.todayRevenue}
          pendingSales={stats.pendingSales}
          weekCommissions={stats.weekCommissions}
        />

        {/* Step Navigation */}
        {step !== "catalog" && (
          <div className="px-4 py-2 border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={goBack}
              className="text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden">
          {step === "catalog" && (
            <div className={cn("h-full flex", isMobile ? "flex-col" : "")}>
              {/* Product Grid */}
              <div className={cn("flex-1 flex flex-col", !isMobile && "border-r border-slate-700/50")}>
                {/* Category Tabs */}
                <POSCategoryTabs
                  activeCategory={activeCategory}
                  onCategoryChange={setActiveCategory}
                  selectedCounts={selectedCounts}
                />

                {/* Products Grid */}
                <ScrollArea className="flex-1">
                  <div className="p-4">
                    {filteredOffers.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-slate-400">Aucune offre dans cette catégorie</p>
                      </div>
                    ) : (
                      <div className={cn(
                        "grid gap-3",
                        isMobile ? "grid-cols-1" : "grid-cols-2 xl:grid-cols-3"
                      )}>
                        {filteredOffers.map(offer => (
                          <POSServiceCard
                            key={offer.id}
                            offer={offer}
                            isSelected={isSelected(offer.id)}
                            quantity={getQuantity(offer.id)}
                            onToggle={() => toggleService(offer)}
                            onQuantityChange={(delta) => updateQuantity(offer.id, delta)}
                            compact={isMobile}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Mobile Cart Button */}
                {isMobile && selectedServices.length > 0 && (
                  <Sheet open={cartOpen} onOpenChange={setCartOpen}>
                    <SheetTrigger asChild>
                      <div className="p-4 border-t border-slate-700/50 bg-slate-900/90 backdrop-blur-xl">
                        <Button
                          className="w-full h-14 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold text-lg shadow-lg"
                        >
                          <ShoppingCart className="h-5 w-5 mr-3" />
                          Voir panier ({cartItemCount})
                          <span className="ml-auto">{totals.total.toFixed(2)} $</span>
                        </Button>
                      </div>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-[80vh] p-0 bg-transparent border-0">
                      <POSCart
                        services={selectedServices}
                        onRemoveService={removeService}
                        onClearCart={clearCart}
                        onCheckout={handleCheckout}
                      />
                    </SheetContent>
                  </Sheet>
                )}
              </div>

              {/* Desktop Cart Sidebar */}
              {!isMobile && (
                <div className="w-80 xl:w-96">
                  <POSCart
                    services={selectedServices}
                    onRemoveService={removeService}
                    onClearCart={clearCart}
                    onCheckout={handleCheckout}
                  />
                </div>
              )}
            </div>
          )}

          {step === "customer" && (
            <ScrollArea className="h-full">
              <div className="p-4 max-w-lg mx-auto">
                <POSCustomerForm
                  onSubmit={handleCustomerSubmit}
                  isSubmitting={isSubmitting}
                />
              </div>
            </ScrollArea>
          )}

          {step === "payment" && (
            <ScrollArea className="h-full">
              <div className="p-4 max-w-lg mx-auto">
                <POSPaymentForm
                  onSubmit={handlePaymentSubmit}
                  isSubmitting={isSubmitting}
                  totalAmount={totals.total}
                />
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    </div>
  );
}
