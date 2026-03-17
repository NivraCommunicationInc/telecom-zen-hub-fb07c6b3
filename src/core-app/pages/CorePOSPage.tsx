/**
 * CorePOSPage — Full telecom POS for Nivra Core internal operations.
 * 3-column layout: Client + Catalog | Cart | Financial Summary
 * Connected to: services_public, equipment_inventory, profiles, accounts, orders, commit_order_atomic
 */
import { useState, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { backendClient } from "@/integrations/backend/client";
import { useFieldSalesOffers, FieldSalesOffer, SelectedService } from "@/hooks/useFieldSalesOffers";
import { estimateTaxes, estimateMonthlyWithTax } from "@/lib/pricing/serverTaxEngine";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search, UserPlus, UserCheck, ShoppingCart, Package, Wrench, DollarSign,
  Plus, Minus, X, Loader2, CreditCard, Banknote, ArrowRight, Check,
  Wifi, Tv, Smartphone, Shield, Truck, FileText, Receipt, ChevronDown, ChevronUp,
  Hash, Mail, Phone, MapPin, Calendar, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AddressAutocomplete, type AddressValue } from "@/components/shared/AddressAutocomplete";
import { cn } from "@/lib/utils";

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

interface EquipmentItem {
  id: string;
  type: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  serialNumber?: string;
}

interface AdjustmentItem {
  id: string;
  type: string;
  name: string;
  amount: number;
}

interface ClientResult {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  account_number?: string;
  account_id?: string;
  source: "profile" | "billing_customer" | "account";
}

interface NewClientForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  service_address: string;
  service_city: string;
  service_postal_code: string;
  billing_address: string;
  billing_city: string;
  billing_postal_code: string;
  internal_notes: string;
}

type PaymentMethod = "paypal" | "interac" | "cash" | "debit" | "bank_transfer" | "deferred";

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ElementType }[] = [
  { value: "paypal", label: "PayPal", icon: CreditCard },
  { value: "interac", label: "Interac e-Transfer", icon: Banknote },
  { value: "cash", label: "Argent comptant", icon: Banknote },
  { value: "debit", label: "Débit / Crédit", icon: CreditCard },
  { value: "bank_transfer", label: "Virement bancaire", icon: Banknote },
  { value: "deferred", label: "Payer plus tard", icon: Calendar },
];

const DELIVERY_PRESETS = [
  { name: "Livraison standard", amount: 30 },
  { name: "Livraison Express", amount: 45 },
  { name: "Expédition", amount: 15 },
];

const INSTALL_PRESETS = [
  { name: "Installation technicien", amount: 50 },
];

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function mapPaymentMethodForDB(method: PaymentMethod): string {
  if (method === "interac") return "interac";
  if (method === "paypal") return "paypal";
  return "manual";
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════

export default function CorePOSPage() {
  // ── Data Sources ──
  const { data: offers = [], isLoading: offersLoading } = useFieldSalesOffers();
  
  // Equipment from real inventory (in_stock items only)
  const { data: equipmentCatalog = [], isLoading: eqLoading } = useQuery({
    queryKey: ["pos-equipment-inventory-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_inventory")
        .select("id, catalog_name, catalog_item_id, sku, serial_number, imei, mac_address, price_client, cost_internal, condition, status")
        .eq("status", "in_stock")
        .order("catalog_name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 15_000,
  });

  // ── Client State ──
  const [clientMode, setClientMode] = useState<"search" | "new">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ClientResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientResult | null>(null);
  const [newClient, setNewClient] = useState<NewClientForm>({
    first_name: "", last_name: "", email: "", phone: "", date_of_birth: "",
    service_address: "", service_city: "", service_postal_code: "",
    billing_address: "", billing_city: "", billing_postal_code: "",
    internal_notes: "",
  });

  // ── Cart State ──
  const [services, setServices] = useState<SelectedService[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentItem[]>([]);
  const [promoCode, setPromoCode] = useState("");

  // ── Catalog UI ──
  const [catalogTab, setCatalogTab] = useState<"services" | "equipment" | "adjustments">("services");
  const [serviceFilter, setServiceFilter] = useState<"all" | "internet" | "tv" | "mobile">("all");
  const [serviceSearch, setServiceSearch] = useState("");
  const [eqTab, setEqTab] = useState<string>("router");

  // ── Payment State ──
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("interac");
  const [paymentMode, setPaymentMode] = useState<"full" | "partial">("full");
  const [partialAmount, setPartialAmount] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState<{ orderId: string; orderNumber: string } | null>(null);

  // ── Address Qualification ──
  const [qualificationResult, setQualificationResult] = useState<any>(null);
  const [qualifyingAddress, setQualifyingAddress] = useState(false);

  const qualifyAddress = useCallback(async (addr: AddressValue) => {
    setQualifyingAddress(true);
    setQualificationResult(null);
    try {
      const { data, error } = await backendClient.functions.invoke("address-qualify", {
        body: {
          postal_code: addr.postalCode,
          city: addr.city,
          province: addr.region,
          address_line: addr.line1 || addr.formatted,
        },
      });
      if (error) throw error;
      if (data?.ok) {
        setQualificationResult(data);
      }
    } catch (e) {
      console.error("[CorePOS] Qualification error:", e);
    } finally {
      setQualifyingAddress(false);
    }
  }, []);

  // ── Sections expanded ──
  const [clientExpanded, setClientExpanded] = useState(true);

  // ═══ CLIENT SEARCH ═══
  const handleSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearchLoading(true);
    try {
      // Search profiles, billing_customers, accounts in parallel
      const isEmail = q.includes("@");
      const isAccountNum = /^\d{6}$/.test(q);
      const isPhone = /^\d{7,}$/.test(q.replace(/[^0-9]/g, ""));

      const results: ClientResult[] = [];

      if (isAccountNum) {
        const { data } = await supabase
          .from("accounts")
          .select("id, account_number, client_id, account_name, billing_address, billing_city")
          .eq("account_number", q)
          .limit(5);
        for (const a of data || []) {
          // Get profile for this client
          const { data: prof } = await supabase
            .from("profiles")
            .select("id, email, full_name, phone")
            .eq("id", a.client_id)
            .maybeSingle();
          results.push({
            id: a.client_id,
            email: prof?.email || "",
            full_name: prof?.full_name || a.account_name || "",
            phone: prof?.phone || null,
            account_number: a.account_number,
            account_id: a.id,
            source: "account",
          });
        }
      } else {
        // Search profiles
        let profileQuery = supabase
          .from("profiles")
          .select("id, email, full_name, phone")
          .limit(10);

        if (isEmail) {
          profileQuery = profileQuery.ilike("email", `%${q}%`);
        } else if (isPhone) {
          profileQuery = profileQuery.ilike("phone", `%${q.replace(/[^0-9]/g, "")}%`);
        } else {
          profileQuery = profileQuery.ilike("full_name", `%${q}%`);
        }

        const { data: profiles } = await profileQuery;
        for (const p of profiles || []) {
          // Check if they have an account
          const { data: acct } = await supabase
            .from("accounts")
            .select("id, account_number")
            .eq("client_id", p.id)
            .limit(1)
            .maybeSingle();
          results.push({
            id: p.id,
            email: p.email || "",
            full_name: p.full_name || "",
            phone: p.phone,
            account_number: acct?.account_number,
            account_id: acct?.id,
            source: "profile",
          });
        }
      }

      setSearchResults(results);
      if (results.length === 0) {
        toast.info("Aucun client trouvé");
      }
    } catch (err) {
      console.error("[CorePOS] Search error:", err);
      toast.error("Erreur de recherche");
    } finally {
      setSearchLoading(false);
    }
  }, [searchQuery]);

  // ═══ CART CALCULATIONS ═══
  const totals = useMemo(() => {
    const monthlySubtotal = services.reduce((s, sv) => s + sv.priceMonthly * sv.quantity, 0);
    const setupSubtotal = services.reduce((s, sv) => s + sv.priceSetup * sv.quantity, 0);
    const equipmentTotal = equipment.reduce((s, e) => s + e.price * e.quantity, 0);
    const adjustmentsTotal = adjustments.reduce((s, a) => s + a.amount, 0);
    const serviceCount = services.length;
    const activationFee = serviceCount === 0 ? 0 : serviceCount === 1 ? 25 : 45;
    const oneTimeSubtotal = setupSubtotal + equipmentTotal + activationFee + adjustmentsTotal;
    const taxableAmount = monthlySubtotal + oneTimeSubtotal;
    const { tps, tvq } = estimateTaxes(taxableAmount);
    const firstMonthTotal = Math.round((taxableAmount + tps + tvq) * 100) / 100;
    const recurringMonthly = estimateMonthlyWithTax(monthlySubtotal);

    return {
      monthlySubtotal, setupSubtotal, equipmentTotal, adjustmentsTotal,
      activationFee, oneTimeSubtotal, taxableAmount, tps, tvq,
      firstMonthTotal, recurringMonthly,
    };
  }, [services, equipment, adjustments]);

  const cartItemCount = services.length + equipment.length + adjustments.length;
  const cartEmpty = cartItemCount === 0;

  // ═══ SERVICE ACTIONS ═══
  const toggleService = (offer: FieldSalesOffer) => {
    const exists = services.find(s => s.offerId === offer.id);
    if (exists) {
      setServices(prev => prev.filter(s => s.offerId !== offer.id));
    } else {
      setServices(prev => [...prev, {
        offerId: offer.id,
        name: offer.name_fr,
        category: offer.category,
        priceMonthly: offer.price_monthly || 0,
        priceSetup: offer.price_setup || 0,
        quantity: 1,
      }]);
    }
  };

  // ═══ EQUIPMENT ACTIONS ═══
  const inferEqType = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("sim") || n.includes("esim")) return "sim";
    if (n.includes("terminal") || n.includes("décodeur") || n.includes("decodeur")) return "decoder";
    if (n.includes("caméra") || n.includes("sécurité")) return "security";
    return "router";
  };

  const eqCatalogGrouped = useMemo(() => {
    const groups: Record<string, typeof equipmentCatalog> = { router: [], decoder: [], sim: [], security: [] };
    for (const item of equipmentCatalog) {
      const t = inferEqType(item.catalog_name);
      groups[t] = groups[t] || [];
      groups[t].push(item);
    }
    return groups;
  }, [equipmentCatalog]);

  const addEquipmentItem = (item: typeof equipmentCatalog[0]) => {
    setEquipment(prev => [...prev, {
      id: genId(),
      type: inferEqType(item.catalog_name),
      name: item.catalog_name,
      description: item.serial_number ? `S/N: ${item.serial_number}` : (item.sku || ""),
      price: Number(item.price_client) || 0,
      quantity: 1,
      serialNumber: item.serial_number || undefined,
    }]);
    // Reserve in inventory
    supabase.from("equipment_inventory").update({ status: "reserved" } as any).eq("id", item.id).then(() => {});
  };

  // ═══ ADJUSTMENT ACTIONS ═══
  const addAdjustment = (name: string, amount: number, type: string = "fee") => {
    setAdjustments(prev => [...prev, { id: genId(), type, name, amount }]);
  };

  // ═══ FILTERED OFFERS ═══
  const filteredOffers = useMemo(() => {
    let result = offers;
    if (serviceFilter !== "all") {
      result = result.filter(o => o.category === serviceFilter);
    }
    if (serviceSearch.trim()) {
      const q = serviceSearch.toLowerCase();
      result = result.filter(o => o.name_fr.toLowerCase().includes(q));
    }
    return result;
  }, [offers, serviceFilter, serviceSearch]);

  // ═══ CHECKOUT ═══
  const canCheckout = !cartEmpty && (!!selectedClient || (newClient.first_name && newClient.email && newClient.phone && newClient.date_of_birth));

  const handleProceedToPayment = () => {
    if (cartEmpty) { toast.error("Panier vide"); return; }
    if (!selectedClient && !newClient.email) { toast.error("Sélectionnez ou créez un client"); return; }
    if (!selectedClient && !newClient.date_of_birth) { toast.error("Date de naissance requise"); return; }
    setShowPayment(true);
  };

  const handleConfirmOrder = async () => {
    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { toast.error("Session expirée"); return; }

      const clientEmail = selectedClient?.email || newClient.email;
      const clientName = selectedClient?.full_name || `${newClient.first_name} ${newClient.last_name}`.trim();
      const clientPhone = selectedClient?.phone || newClient.phone;
      const firstName = selectedClient ? (selectedClient.full_name?.split(" ")[0] || "") : newClient.first_name;
      const lastName = selectedClient ? (selectedClient.full_name?.split(" ").slice(1).join(" ") || "") : newClient.last_name;
      const dob = newClient.date_of_birth || null;
      const clientId = selectedClient?.id || null;

      if (!dob && !selectedClient) {
        toast.error("Date de naissance requise pour un nouveau client");
        return;
      }

      const orderPayload = {
        services: services.map(s => ({
          offer_id: s.offerId, name: s.name, category: s.category,
          price_monthly: s.priceMonthly, price_setup: s.priceSetup, quantity: s.quantity,
        })),
        equipment: equipment.map(e => ({
          type: e.type, name: e.name, description: e.description,
          price: e.price, quantity: e.quantity, serial_number: e.serialNumber || null,
        })),
        adjustments: adjustments.map(a => ({ type: a.type, name: a.name, amount: a.amount })),
        totals: {
          monthly_subtotal: totals.monthlySubtotal,
          equipment_total: totals.equipmentTotal,
          adjustments_total: totals.adjustmentsTotal,
          activation_fee: totals.activationFee,
          tps: totals.tps,
          tvq: totals.tvq,
          first_month_total: totals.firstMonthTotal,
          recurring_monthly: totals.recurringMonthly,
        },
        promo_code: promoCode || null,
      };

      const isPaid = paymentMethod !== "deferred";

      // Create order
      const { data: newOrder, error: orderErr } = await supabase
        .from("orders")
        .insert([{
          user_id: clientId,
          service_type: services[0]?.category || "bundle",
          client_email: clientEmail,
          client_dob: dob,
          client_first_name: firstName,
          client_last_name: lastName,
          client_phone: clientPhone,
          service_address: newClient.service_address || undefined,
          service_city: newClient.service_city || undefined,
          service_postal_code: newClient.service_postal_code || undefined,
          equipment_details: JSON.parse(JSON.stringify(orderPayload)),
          subtotal: totals.taxableAmount,
          tps_amount: totals.tps,
          tvq_amount: totals.tvq,
          total_amount: totals.firstMonthTotal,
          payment_status: isPaid ? "confirmed" : "pending",
          payment_reference: paymentRef || null,
          internal_notes: `[POS Core] ${paymentNote || ""}\nMéthode: ${paymentMethod}${paymentMode === "partial" ? ` (partiel: ${partialAmount}$)` : ""}`.trim(),
          status: "pending",
          promo_code: promoCode || null,
        }])
        .select("id, order_number")
        .single();

      if (orderErr) throw orderErr;

      // Auto-create client account if new client
      if (!clientId) {
        try {
          await supabase.functions.invoke("auto-create-client-account", {
            body: {
              email: clientEmail,
              first_name: firstName,
              last_name: lastName,
              phone: clientPhone,
              order_id: newOrder.id,
              order_number: newOrder.order_number || undefined,
              service_address: newClient.service_address,
              service_city: newClient.service_city,
              service_postal_code: newClient.service_postal_code,
              date_of_birth: dob,
            },
          });
        } catch (e) {
          console.warn("[CorePOS] auto-create-client-account failed (non-blocking):", e);
        }
      }

      // Orchestrate order (non-blocking)
      try {
        const { orchestrateOrder } = await import("@/lib/orderOrchestration");
        await orchestrateOrder(newOrder.id);
      } catch (e) {
        console.warn("[CorePOS] Orchestration failed (non-blocking):", e);
      }

      setOrderComplete({ orderId: newOrder.id, orderNumber: newOrder.order_number || "" });
      setShowPayment(false);
      toast.success(`Commande ${newOrder.order_number || newOrder.id.slice(0, 8)} créée!`);
    } catch (err: any) {
      console.error("[CorePOS] Order error:", err);
      toast.error("Erreur de création", { description: err?.message || "Erreur inconnue" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetPOS = () => {
    setServices([]);
    setEquipment([]);
    setAdjustments([]);
    setPromoCode("");
    setSelectedClient(null);
    setSearchQuery("");
    setSearchResults([]);
    setNewClient({
      first_name: "", last_name: "", email: "", phone: "", date_of_birth: "",
      service_address: "", service_city: "", service_postal_code: "",
      billing_address: "", billing_city: "", billing_postal_code: "",
      internal_notes: "",
    });
    setPaymentRef("");
    setPaymentNote("");
    setOrderComplete(null);
    setClientMode("search");
  };

  // ═══════════════════════════════════════════
  // ORDER COMPLETE VIEW
  // ═══════════════════════════════════════════
  if (orderComplete) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6">
        <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Check className="h-8 w-8 text-emerald-400" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-1">Commande créée</h2>
          <p className="text-[#A1A1AA] text-sm">
            #{orderComplete.orderNumber || orderComplete.orderId.slice(0, 8)}
          </p>
          <p className="text-[#A1A1AA] text-xs mt-2">
            Total: {totals.firstMonthTotal.toFixed(2)} $ • Méthode: {paymentMethod}
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={resetPOS} className="bg-emerald-600 hover:bg-emerald-500 text-white">
            Nouvelle vente
          </Button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════
  // MAIN POS LAYOUT
  // ═══════════════════════════════════════════
  return (
    <div className="flex flex-col gap-4">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Point de Vente</h1>
          <p className="text-xs text-[#A1A1AA]">Créer commande, facturer et encaisser — Nivra Core POS</p>
        </div>
        <div className="flex items-center gap-2">
          {!cartEmpty && (
            <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30">
              {cartItemCount} article{cartItemCount > 1 ? "s" : ""} • {totals.firstMonthTotal.toFixed(2)} $
            </Badge>
          )}
        </div>
      </div>

      {/* ═══ CLIENT SECTION ═══ */}
      <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,10%)] overflow-hidden">
        <button
          onClick={() => setClientExpanded(!clientExpanded)}
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[hsl(220,15%,14%)] transition-colors"
        >
          <div className="flex items-center gap-2">
            {selectedClient ? (
              <UserCheck className="h-4 w-4 text-emerald-400" />
            ) : (
              <Search className="h-4 w-4 text-[#A1A1AA]" />
            )}
            <span className="text-sm font-medium text-[#E4E4E7]">
              {selectedClient
                ? `${selectedClient.full_name} — ${selectedClient.email}${selectedClient.account_number ? ` (Compte #${selectedClient.account_number})` : ""}`
                : "Client"}
            </span>
          </div>
          {clientExpanded ? <ChevronUp className="h-4 w-4 text-[#A1A1AA]" /> : <ChevronDown className="h-4 w-4 text-[#A1A1AA]" />}
        </button>

        {clientExpanded && (
          <div className="px-4 pb-4 border-t border-[hsl(220,15%,16%)]">
            {/* Mode Toggle */}
            <div className="flex gap-2 my-3">
              <button
                onClick={() => setClientMode("search")}
                className={cn(
                  "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                  clientMode === "search"
                    ? "bg-emerald-600/20 text-emerald-400 border border-emerald-600/40"
                    : "text-[#A1A1AA] hover:text-white border border-[hsl(220,15%,20%)]"
                )}
              >
                <Search className="h-3 w-3 inline mr-1" /> Rechercher
              </button>
              <button
                onClick={() => setClientMode("new")}
                className={cn(
                  "px-3 py-1.5 rounded text-xs font-medium transition-colors",
                  clientMode === "new"
                    ? "bg-emerald-600/20 text-emerald-400 border border-emerald-600/40"
                    : "text-[#A1A1AA] hover:text-white border border-[hsl(220,15%,20%)]"
                )}
              >
                <UserPlus className="h-3 w-3 inline mr-1" /> Nouveau client
              </button>
            </div>

            {clientMode === "search" ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nom, email, téléphone ou # compte (6 chiffres)"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSearch()}
                    className="flex-1 h-9 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white placeholder:text-[hsl(220,10%,40%)]"
                  />
                  <Button size="sm" onClick={handleSearch} disabled={searchLoading} className="bg-emerald-600 hover:bg-emerald-500 text-white h-9">
                    {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {searchResults.map(r => (
                      <button
                        key={`${r.source}-${r.id}`}
                        onClick={() => {
                          setSelectedClient(r);
                          setClientExpanded(false);
                          toast.success(`Client sélectionné: ${r.full_name}`);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-colors",
                          selectedClient?.id === r.id
                            ? "bg-emerald-600/15 border border-emerald-600/40"
                            : "hover:bg-[hsl(220,15%,14%)] border border-transparent"
                        )}
                      >
                        <UserCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#E4E4E7] truncate">{r.full_name || "—"}</p>
                          <p className="text-xs text-[#A1A1AA] truncate">
                            {r.email}{r.phone ? ` • ${r.phone}` : ""}{r.account_number ? ` • Compte #${r.account_number}` : ""}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedClient && (
                  <div className="flex items-center gap-2 p-2 rounded bg-emerald-600/10 border border-emerald-600/30">
                    <UserCheck className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm text-emerald-300 flex-1">{selectedClient.full_name} — {selectedClient.email}</span>
                    <button onClick={() => setSelectedClient(null)} className="text-[#A1A1AA] hover:text-white">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* NEW CLIENT FORM */
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <Label className="text-[11px] text-[#A1A1AA]">Prénom *</Label>
                  <Input value={newClient.first_name} onChange={e => setNewClient(p => ({ ...p, first_name: e.target.value }))}
                    className="h-8 text-sm bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white" />
                </div>
                <div>
                  <Label className="text-[11px] text-[#A1A1AA]">Nom *</Label>
                  <Input value={newClient.last_name} onChange={e => setNewClient(p => ({ ...p, last_name: e.target.value }))}
                    className="h-8 text-sm bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white" />
                </div>
                <div>
                  <Label className="text-[11px] text-[#A1A1AA]">Courriel *</Label>
                  <Input type="email" value={newClient.email} onChange={e => setNewClient(p => ({ ...p, email: e.target.value }))}
                    className="h-8 text-sm bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white" />
                </div>
                <div>
                  <Label className="text-[11px] text-[#A1A1AA]">Téléphone *</Label>
                  <Input value={newClient.phone} onChange={e => setNewClient(p => ({ ...p, phone: e.target.value }))}
                    className="h-8 text-sm bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white" />
                </div>
                <div>
                  <Label className="text-[11px] text-[#A1A1AA]">Date de naissance *</Label>
                  <Input type="date" value={newClient.date_of_birth} onChange={e => setNewClient(p => ({ ...p, date_of_birth: e.target.value }))}
                    className="h-8 text-sm bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white" />
                </div>
                <div className="col-span-2 lg:col-span-3">
                  <Label className="text-[11px] text-[#A1A1AA]">Adresse service *</Label>
                  <AddressAutocomplete
                    value={newClient.service_address}
                    onValueChange={(v) => setNewClient(p => ({ ...p, service_address: v }))}
                    onSelect={(addr) => {
                      setNewClient(p => ({
                        ...p,
                        service_address: addr.line1 || addr.formatted,
                        service_city: addr.city || p.service_city,
                        service_postal_code: addr.postalCode || p.service_postal_code,
                      }));
                      // Trigger qualification check
                      if (addr.postalCode) {
                        qualifyAddress(addr);
                      }
                    }}
                    placeholder="Commencez à taper l'adresse..."
                    restrictToQuebec={true}
                    className="h-8 text-sm bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-[#A1A1AA]">Ville service</Label>
                  <Input value={newClient.service_city} onChange={e => setNewClient(p => ({ ...p, service_city: e.target.value }))}
                    className="h-8 text-sm bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white" />
                </div>
                <div>
                  <Label className="text-[11px] text-[#A1A1AA]">Code postal service</Label>
                  <Input value={newClient.service_postal_code} onChange={e => setNewClient(p => ({ ...p, service_postal_code: e.target.value }))}
                    className="h-8 text-sm bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white" />
                </div>
                {/* Service Qualification Result */}
                {qualificationResult && (
                  <div className={cn(
                    "col-span-2 lg:col-span-3 p-3 rounded-lg border text-xs",
                    qualificationResult.serviceable
                      ? "bg-emerald-950/30 border-emerald-600/30"
                      : "bg-red-950/30 border-red-600/30"
                  )}>
                    <div className="flex items-center gap-2 mb-1.5">
                      {qualificationResult.serviceable
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        : <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                      }
                      <span className={cn("font-semibold", qualificationResult.serviceable ? "text-emerald-300" : "text-red-300")}>
                        {qualificationResult.serviceable ? "Adresse desservie" : "Hors couverture"}
                      </span>
                      <Badge variant="outline" className="text-[10px] h-5 border-[hsl(220,15%,20%)] text-[#A1A1AA]">
                        {qualificationResult.technology_label}
                      </Badge>
                      {qualificationResult.max_speed_mbps > 0 && (
                        <Badge variant="outline" className="text-[10px] h-5 border-emerald-600/30 text-emerald-400">
                          Max {qualificationResult.max_speed_mbps} Mbps
                        </Badge>
                      )}
                    </div>
                    <p className="text-[#A1A1AA]">{qualificationResult.notes}</p>
                    {qualificationResult.existing_services?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-[hsl(220,15%,16%)]">
                        <p className="text-amber-400 font-medium mb-1">Services existants à cette adresse:</p>
                        {qualificationResult.existing_services.map((s: any, i: number) => (
                          <p key={i} className="text-[#A1A1AA]">• {s.plan_name} ({s.category}) — {s.status}</p>
                        ))}
                      </div>
                    )}
                    {qualificationResult.available_categories?.length > 0 && qualificationResult.serviceable && (
                      <div className="mt-1">
                        <span className="text-[#A1A1AA]">Catégories disponibles: </span>
                        {qualificationResult.available_categories.map((c: string) => (
                          <Badge key={c} variant="outline" className="text-[10px] h-4 mr-1 border-emerald-600/30 text-emerald-400">{c}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {qualifyingAddress && (
                  <div className="col-span-2 lg:col-span-3 flex items-center gap-2 text-xs text-[#A1A1AA]">
                    <Loader2 className="h-3 w-3 animate-spin" /> Vérification de la couverture...
                  </div>
                )}
                <div className="col-span-2 lg:col-span-3">
                  <Label className="text-[11px] text-[#A1A1AA]">Notes internes</Label>
                  <Textarea value={newClient.internal_notes} onChange={e => setNewClient(p => ({ ...p, internal_notes: e.target.value }))}
                    rows={2} className="text-sm bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ MAIN 2-COLUMN: CATALOG + CART/SUMMARY ═══ */}
      <div className="flex gap-4 min-h-[500px]">
        {/* LEFT: CATALOG */}
        <div className="flex-1 flex flex-col rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,10%)] overflow-hidden">
          {/* Catalog Tab Bar */}
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[hsl(220,15%,16%)]">
            {([
              { key: "services", label: "Services", icon: Package, count: services.length },
              { key: "equipment", label: "Équipements", icon: Wrench, count: equipment.length },
              { key: "adjustments", label: "Frais / Ajust.", icon: DollarSign, count: adjustments.length },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setCatalogTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors",
                  catalogTab === tab.key
                    ? "bg-emerald-600/20 text-emerald-400"
                    : "text-[#A1A1AA] hover:text-white hover:bg-[hsl(220,15%,14%)]"
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
                {tab.count > 0 && (
                  <span className="ml-1 h-4 min-w-[16px] px-1 rounded-full bg-emerald-600/30 text-emerald-300 text-[10px] font-bold flex items-center justify-center">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Catalog Content */}
          <ScrollArea className="flex-1">
            <div className="p-3">
              {catalogTab === "services" && (
                <>
                  {/* Filters */}
                  <div className="flex items-center gap-2 mb-3">
                    <Input
                      placeholder="Rechercher un forfait..."
                      value={serviceSearch}
                      onChange={e => setServiceSearch(e.target.value)}
                      className="h-8 flex-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white text-xs placeholder:text-[hsl(220,10%,40%)]"
                    />
                    {(["all", "internet", "tv", "mobile"] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setServiceFilter(f)}
                        className={cn(
                          "px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap",
                          serviceFilter === f
                            ? "bg-emerald-600/20 text-emerald-400"
                            : "text-[#A1A1AA] hover:text-white"
                        )}
                      >
                        {f === "all" ? "Tout" : f === "internet" ? "Internet" : f === "tv" ? "TV" : "Mobile"}
                      </button>
                    ))}
                  </div>

                  {offersLoading ? (
                    <div className="py-12 text-center text-[#A1A1AA] text-sm">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Chargement du catalogue...
                    </div>
                  ) : filteredOffers.length === 0 ? (
                    <p className="py-12 text-center text-[#A1A1AA] text-sm">Aucun forfait trouvé</p>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                      {filteredOffers.map(offer => {
                        const selected = services.some(s => s.offerId === offer.id);
                        return (
                          <button
                            key={offer.id}
                            onClick={() => toggleService(offer)}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg text-left transition-all border",
                              selected
                                ? "bg-emerald-600/10 border-emerald-600/40"
                                : "bg-[hsl(220,20%,12%)] border-[hsl(220,15%,18%)] hover:border-[hsl(220,15%,25%)]"
                            )}
                          >
                            <div className={cn(
                              "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                              offer.category === "internet" ? "bg-cyan-500/20" :
                              offer.category === "tv" ? "bg-purple-500/20" :
                              "bg-emerald-500/20"
                            )}>
                              {offer.category === "internet" ? <Wifi className="h-4 w-4 text-cyan-400" /> :
                               offer.category === "tv" ? <Tv className="h-4 w-4 text-purple-400" /> :
                               <Smartphone className="h-4 w-4 text-emerald-400" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#E4E4E7] truncate">{offer.name_fr}</p>
                              {offer.features_json?.speed && (
                                <p className="text-[11px] text-[#A1A1AA]">{offer.features_json.speed}</p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-emerald-400">{(offer.price_monthly || 0).toFixed(2)} $</p>
                              <p className="text-[10px] text-[#A1A1AA]">/mois</p>
                            </div>
                            {selected && <Check className="h-4 w-4 text-emerald-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {catalogTab === "equipment" && (
                <>
                  <div className="flex gap-2 mb-3">
                    {(["router", "decoder", "sim", "security"] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setEqTab(t)}
                        className={cn(
                          "px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors",
                          eqTab === t ? "bg-cyan-600/20 text-cyan-400" : "text-[#A1A1AA] hover:text-white"
                        )}
                      >
                        {t === "router" ? "Routeur" : t === "decoder" ? "Décodeur" : t === "sim" ? "SIM" : "Sécurité"}
                      </button>
                    ))}
                  </div>
                  {eqLoading ? (
                    <div className="py-8 text-center text-[#A1A1AA] text-sm"><Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />Chargement...</div>
                  ) : (eqCatalogGrouped[eqTab] || []).length === 0 ? (
                    <p className="py-8 text-center text-[#A1A1AA] text-sm">Aucun équipement dans cette catégorie</p>
                  ) : (
                    <div className="space-y-2">
                      {(eqCatalogGrouped[eqTab] || []).map(item => (
                        <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(220,20%,12%)] border border-[hsl(220,15%,18%)]">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#E4E4E7]">{item.catalog_name}</p>
                            <p className="text-xs text-[#A1A1AA] truncate">
                              {item.serial_number ? `S/N: ${item.serial_number}` : ""}{item.sku ? ` · SKU: ${item.sku}` : ""}{item.condition ? ` · ${item.condition}` : ""}
                            </p>
                          </div>
                          <p className="text-sm font-bold text-cyan-400">{(Number(item.price_client) || 0).toFixed(2)} $</p>
                          <Button size="sm" onClick={() => addEquipmentItem(item)} className="bg-cyan-600 hover:bg-cyan-500 text-white h-7 px-2">
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {catalogTab === "adjustments" && (
                <div className="space-y-4">
                  {/* Delivery */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-[#A1A1AA] mb-2 flex items-center gap-1"><Truck className="h-3 w-3" /> Livraison</p>
                    <div className="flex flex-wrap gap-2">
                      {DELIVERY_PRESETS.map(p => (
                        <Button key={p.name} variant="outline" size="sm"
                          onClick={() => addAdjustment(p.name, p.amount, "delivery")}
                          className="border-[hsl(220,15%,20%)] bg-[hsl(220,20%,12%)] text-[#E4E4E7] hover:bg-blue-600/10 hover:text-blue-400 hover:border-blue-600/40 text-xs">
                          {p.name} <span className="ml-1 text-[#A1A1AA]">+{p.amount}$</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                  {/* Installation */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-[#A1A1AA] mb-2 flex items-center gap-1"><Wrench className="h-3 w-3" /> Installation</p>
                    <div className="flex flex-wrap gap-2">
                      {INSTALL_PRESETS.map(p => (
                        <Button key={p.name} variant="outline" size="sm"
                          onClick={() => addAdjustment(p.name, p.amount, "installation")}
                          className="border-[hsl(220,15%,20%)] bg-[hsl(220,20%,12%)] text-[#E4E4E7] hover:bg-amber-600/10 hover:text-amber-400 hover:border-amber-600/40 text-xs">
                          {p.name} <span className="ml-1 text-[#A1A1AA]">+{p.amount}$</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                  {/* Custom */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase text-[#A1A1AA] mb-2">Ligne personnalisée</p>
                    <CustomAdjustmentForm onAdd={(name, amount) => addAdjustment(name, amount, amount < 0 ? "credit" : "fee")} />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* RIGHT: CART + SUMMARY */}
        <div className="w-[380px] shrink-0 flex flex-col gap-4">
          {/* CART */}
          <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,10%)] flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[hsl(220,15%,16%)] flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-[#E4E4E7]">Panier</span>
              {!cartEmpty && (
                <Badge variant="outline" className="ml-auto text-[10px] border-[hsl(220,15%,20%)] text-[#A1A1AA]">
                  {cartItemCount}
                </Badge>
              )}
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-1.5">
                {cartEmpty && (
                  <p className="py-8 text-center text-[#A1A1AA] text-xs">Panier vide — ajoutez des services ou équipements</p>
                )}

                {/* Services */}
                {services.map(s => (
                  <div key={s.offerId} className="flex items-center gap-2 p-2 rounded bg-[hsl(220,20%,12%)] border border-[hsl(220,15%,18%)]">
                    <Package className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#E4E4E7] truncate">{s.name}</p>
                      <p className="text-[10px] text-[#A1A1AA]">{s.priceMonthly.toFixed(2)} $/mois</p>
                    </div>
                    <button onClick={() => setServices(prev => prev.filter(sv => sv.offerId !== s.offerId))} className="text-[#A1A1AA] hover:text-red-400">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                {/* Equipment */}
                {equipment.map(e => (
                  <div key={e.id} className="flex items-center gap-2 p-2 rounded bg-[hsl(220,20%,12%)] border border-[hsl(220,15%,18%)]">
                    <Wrench className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#E4E4E7] truncate">{e.name}</p>
                      <p className="text-[10px] text-[#A1A1AA]">{e.price.toFixed(2)} $ × {e.quantity}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEquipment(prev => prev.map(eq => eq.id === e.id ? { ...eq, quantity: Math.max(1, eq.quantity - 1) } : eq))}
                        className="text-[#A1A1AA] hover:text-white"><Minus className="h-3 w-3" /></button>
                      <span className="text-xs text-white w-4 text-center">{e.quantity}</span>
                      <button onClick={() => setEquipment(prev => prev.map(eq => eq.id === e.id ? { ...eq, quantity: eq.quantity + 1 } : eq))}
                        className="text-[#A1A1AA] hover:text-white"><Plus className="h-3 w-3" /></button>
                    </div>
                    <button onClick={() => setEquipment(prev => prev.filter(eq => eq.id !== e.id))} className="text-[#A1A1AA] hover:text-red-400">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                {/* Adjustments */}
                {adjustments.map(a => (
                  <div key={a.id} className="flex items-center gap-2 p-2 rounded bg-[hsl(220,20%,12%)] border border-[hsl(220,15%,18%)]">
                    <DollarSign className={cn("h-3.5 w-3.5 shrink-0", a.amount < 0 ? "text-emerald-400" : "text-amber-400")} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[#E4E4E7] truncate">{a.name}</p>
                    </div>
                    <span className={cn("text-xs font-bold", a.amount < 0 ? "text-emerald-400" : "text-amber-400")}>
                      {a.amount >= 0 ? "+" : ""}{a.amount.toFixed(2)} $
                    </span>
                    <button onClick={() => setAdjustments(prev => prev.filter(adj => adj.id !== a.id))} className="text-[#A1A1AA] hover:text-red-400">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* PROMO */}
          <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,10%)] px-4 py-3">
            <Label className="text-[11px] text-[#A1A1AA] uppercase">Code promo</Label>
            <Input
              value={promoCode}
              onChange={e => setPromoCode(e.target.value.toUpperCase())}
              placeholder="EX: BIENVENUE"
              className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white text-xs"
            />
          </div>

          {/* FINANCIAL SUMMARY */}
          <div className="rounded-lg border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,10%)] px-4 py-3 space-y-2">
            <p className="text-[11px] font-semibold uppercase text-[#A1A1AA] tracking-wider">Résumé financier</p>
            <SummaryRow label="Mensuel" value={totals.monthlySubtotal} />
            {totals.equipmentTotal > 0 && <SummaryRow label="Équipements" value={totals.equipmentTotal} />}
            {totals.activationFee > 0 && <SummaryRow label="Activation" value={totals.activationFee} />}
            {totals.adjustmentsTotal !== 0 && <SummaryRow label="Ajustements" value={totals.adjustmentsTotal} />}
            <div className="border-t border-[hsl(220,15%,16%)] pt-1.5">
              <SummaryRow label="Sous-total" value={totals.taxableAmount} />
              <SummaryRow label="TPS (5%)" value={totals.tps} />
              <SummaryRow label="TVQ (9.975%)" value={totals.tvq} />
            </div>
            <div className="border-t border-[hsl(220,15%,16%)] pt-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-white">Total 1er mois</span>
                <span className="text-lg font-bold text-emerald-400">{totals.firstMonthTotal.toFixed(2)} $</span>
              </div>
              {totals.recurringMonthly > 0 && (
                <div className="flex justify-between mt-1">
                  <span className="text-[11px] text-[#A1A1AA]">Récurrent mensuel</span>
                  <span className="text-xs text-[#A1A1AA]">{totals.recurringMonthly.toFixed(2)} $/mois</span>
                </div>
              )}
            </div>

            <Button
              onClick={handleProceedToPayment}
              disabled={!canCheckout}
              className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              <Receipt className="h-4 w-4 mr-2" />
              Passer au paiement
            </Button>
          </div>
        </div>
      </div>

      {/* ═══ PAYMENT DIALOG ═══ */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="bg-[hsl(220,20%,10%)] border-[hsl(220,15%,16%)] text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Paiement — {totals.firstMonthTotal.toFixed(2)} $</DialogTitle>
            <DialogDescription className="text-[#A1A1AA]">
              {selectedClient ? selectedClient.full_name : `${newClient.first_name} ${newClient.last_name}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Method */}
            <div>
              <Label className="text-[11px] text-[#A1A1AA] uppercase">Méthode de paiement</Label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {PAYMENT_METHODS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setPaymentMethod(m.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2.5 rounded-lg border text-xs font-medium transition-colors",
                      paymentMethod === m.value
                        ? "bg-emerald-600/15 border-emerald-600/40 text-emerald-400"
                        : "border-[hsl(220,15%,20%)] text-[#A1A1AA] hover:text-white hover:border-[hsl(220,15%,30%)]"
                    )}
                  >
                    <m.icon className="h-4 w-4" />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Full / Partial */}
            {paymentMethod !== "deferred" && (
              <div>
                <Label className="text-[11px] text-[#A1A1AA] uppercase">Mode</Label>
                <div className="flex gap-2 mt-1.5">
                  <button
                    onClick={() => setPaymentMode("full")}
                    className={cn(
                      "flex-1 py-2 rounded-lg border text-xs font-medium transition-colors",
                      paymentMode === "full"
                        ? "bg-emerald-600/15 border-emerald-600/40 text-emerald-400"
                        : "border-[hsl(220,15%,20%)] text-[#A1A1AA] hover:text-white"
                    )}
                  >
                    Complet ({totals.firstMonthTotal.toFixed(2)} $)
                  </button>
                  <button
                    onClick={() => setPaymentMode("partial")}
                    className={cn(
                      "flex-1 py-2 rounded-lg border text-xs font-medium transition-colors",
                      paymentMode === "partial"
                        ? "bg-amber-600/15 border-amber-600/40 text-amber-400"
                        : "border-[hsl(220,15%,20%)] text-[#A1A1AA] hover:text-white"
                    )}
                  >
                    Partiel
                  </button>
                </div>
                {paymentMode === "partial" && (
                  <Input
                    type="number" step="0.01" placeholder="Montant partiel"
                    value={partialAmount} onChange={e => setPartialAmount(e.target.value)}
                    className="mt-2 h-8 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white text-sm"
                  />
                )}
              </div>
            )}

            {/* Reference */}
            <div>
              <Label className="text-[11px] text-[#A1A1AA] uppercase">Référence transaction</Label>
              <Input
                value={paymentRef} onChange={e => setPaymentRef(e.target.value)}
                placeholder="# transaction, confirmation, etc."
                className="h-8 mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white text-sm"
              />
            </div>

            {/* Note */}
            <div>
              <Label className="text-[11px] text-[#A1A1AA] uppercase">Note interne</Label>
              <Textarea
                value={paymentNote} onChange={e => setPaymentNote(e.target.value)}
                rows={2} placeholder="Note visible uniquement par l'équipe"
                className="mt-1 bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white text-sm"
              />
            </div>

            <Button
              onClick={handleConfirmOrder}
              disabled={isSubmitting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Confirmer la commande
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-[#A1A1AA]">{label}</span>
      <span className={cn("font-medium", value < 0 ? "text-emerald-400" : "text-[#E4E4E7]")}>
        {value >= 0 ? "" : "−"}{Math.abs(value).toFixed(2)} $
      </span>
    </div>
  );
}

function CustomAdjustmentForm({ onAdd }: { onAdd: (name: string, amount: number) => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [isCredit, setIsCredit] = useState(false);

  const handleAdd = () => {
    const val = parseFloat(amount);
    if (!name.trim() || isNaN(val)) return;
    onAdd(name.trim(), isCredit ? -Math.abs(val) : Math.abs(val));
    setName("");
    setAmount("");
  };

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Description"
          className="h-8 text-xs bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white" />
      </div>
      <div className="w-24">
        <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
          className="h-8 text-xs bg-[hsl(220,20%,12%)] border-[hsl(220,15%,20%)] text-white" />
      </div>
      <button onClick={() => setIsCredit(!isCredit)}
        className={cn("h-8 px-2 rounded text-[10px] font-bold border transition-colors",
          isCredit ? "text-emerald-400 border-emerald-600/40 bg-emerald-600/10" : "text-amber-400 border-amber-600/40 bg-amber-600/10"
        )}>
        {isCredit ? "−" : "+"}
      </button>
      <Button size="sm" onClick={handleAdd} disabled={!name.trim() || !amount} className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white">
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
