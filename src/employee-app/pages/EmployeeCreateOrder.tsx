/**
 * EmployeeCreateOrder — Agent order intake form (Nivra OneView CS).
 * Steps: client → plan → equipment → install → address → review
 * - Equipment rules: max 1 Borne WiFi, max 4 Terminal TV, max 1 SIM
 * - Auto vs Professional install with chosen date
 * - First month free auto-applied (display) per BIENVENUE2026 / NIVRA2026 policy
 * - Auto install triggers send-auto-installation-email (PDF + official template)
 * - Create-client form collects DOB + full address (passed to auto-create-client-account)
 * All pricing is server-side; this UI shows catalog price + first-month-free preview only.
 */
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeCheckoutPricing, type CartLineItem } from "@/lib/pricing/serverPricing";
import { toast } from "sonner";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";
import {
  ArrowLeft, Loader2, Search, User, ShoppingCart, MapPin,
  CheckCircle2, AlertTriangle, ChevronRight, UserPlus, Wrench,
  Calendar, Package, Sparkles,
} from "lucide-react";

type Step = "client" | "plan" | "equipment" | "install" | "address" | "review" | "submitted";

interface SelectedClient {
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  account_number?: string;
  account_id?: string;
}

interface SelectedPlan {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface EquipLine {
  key: "router" | "terminal" | "sim";
  name: string;
  price: number;
  selected: boolean;
  quantity: number;
  maxQuantity: number;
}

// Direct-apply ceiling: aligned with Field policy (max $50/mo, 24 months).
const EMPLOYEE_DIRECT_DISCOUNT_MONTHLY_CAP = 50;

// Required equipment per business rules (memory: equipment-pricing-rules)
const DEFAULT_EQUIPMENT: EquipLine[] = [
  { key: "router",   name: "Borne WiFi",  price: 60, selected: false, quantity: 1, maxQuantity: 1 },
  { key: "terminal", name: "Terminal TV", price: 50, selected: false, quantity: 1, maxQuantity: 4 },
  { key: "sim",      name: "Carte SIM",   price: 30, selected: false, quantity: 1, maxQuantity: 1 },
];

const SLOTS = [
  { key: "morning",   label: "Matin (8h - 12h)" },
  { key: "afternoon", label: "Après-midi (12h - 17h)" },
  { key: "evening",   label: "Soir (17h - 20h)" },
] as const;

function minInstallDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
}

interface AgentDiscountRow {
  id: string;
  name: string;
  type: string;
  value: number;
  duration_months: number | null;
  applies_to: string;
}

interface CreatedClientOnboarding {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  date_of_birth?: string;
  service_address?: string;
  service_city?: string;
  service_postal_code?: string;
}

export default function EmployeeCreateOrder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetClientId = searchParams.get("clientId");

  const [step, setStep] = useState<Step>("client");
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<SelectedClient | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan | null>(null);
  const [equipment, setEquipment] = useState<EquipLine[]>(DEFAULT_EQUIPMENT.map(e => ({ ...e })));
  const [installType, setInstallType] = useState<"auto" | "professional">("auto");
  const [installDate, setInstallDate] = useState<string>(minInstallDate());
  const [installSlot, setInstallSlot] = useState<typeof SLOTS[number]["key"]>("morning");
  const [address, setAddress] = useState({ street: "", city: "", postal: "", province: "QC" });
  const [agentNotes, setAgentNotes] = useState("");
  const [selectedDiscount, setSelectedDiscount] = useState<AgentDiscountRow | null>(null);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [newClient, setNewClient] = useState({
    first_name: "", last_name: "", email: "", phone: "",
    date_of_birth: "", street: "", city: "", postal: "",
  });
  const [creatingClient, setCreatingClient] = useState(false);
  const [createdClientOnboarding, setCreatedClientOnboarding] = useState<CreatedClientOnboarding | null>(null);

  // If preset client, load directly
  useEffect(() => {
    if (presetClientId) {
      supabase
        .from("profiles")
        .select("user_id, full_name, email, phone, service_address, service_city, service_postal_code")
        .eq("user_id", presetClientId)
        .maybeSingle()
        .then(async ({ data: profile }) => {
          if (!profile) return;
          const { data: acc } = await supabase
            .from("accounts")
            .select("id, account_number")
            .eq("client_id", presetClientId)
            .maybeSingle();
          setSelectedClient({
            user_id: profile.user_id,
            full_name: profile.full_name ?? "",
            email: profile.email ?? "",
            phone: profile.phone ?? undefined,
            account_number: acc?.account_number ?? undefined,
            account_id: acc?.id ?? undefined,
          });
          if (profile.service_address) {
            setAddress({
              street: profile.service_address ?? "",
              city: profile.service_city ?? "",
              postal: profile.service_postal_code ?? "",
              province: "QC",
            });
          }
          setStep("plan");
        });
    }
  }, [presetClientId]);

  // Client search
  const { data: searchResults, isLoading: searching } = useQuery({
    queryKey: ["employee-client-search", clientSearch],
    enabled: clientSearch.length >= 2 && step === "client",
    staleTime: 5000,
    queryFn: async () => {
      const term = `%${clientSearch}%`;
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, phone")
        .or(`full_name.ilike.${term},email.ilike.${term},phone.ilike.${term}`)
        .limit(10);
      return data ?? [];
    },
  });

  // Catalog: active services
  const { data: catalog } = useQuery({
    queryKey: ["employee-service-catalog"],
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data } = await supabase
        .from("services")
        .select("id, name, price, category, is_active")
        .eq("is_active", true)
        .order("category")
        .order("name");
      return data ?? [];
    },
  });

  // Active agent_discounts available for direct apply
  const { data: discounts } = useQuery({
    queryKey: ["employee-agent-discounts"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_discounts")
        .select("id, name, type, value, duration_months, applies_to")
        .eq("is_active", true)
        .order("value", { ascending: true });
      return (data ?? []) as AgentDiscountRow[];
    },
  });

  const selectClient = async (profile: any) => {
    const { data: acc } = await supabase
      .from("accounts")
      .select("id, account_number, primary_service_address, primary_service_city, primary_service_postal_code, primary_service_province")
      .eq("client_id", profile.user_id)
      .maybeSingle();
    setSelectedClient({
      user_id: profile.user_id,
      full_name: profile.full_name ?? "",
      email: profile.email ?? "",
      phone: profile.phone ?? undefined,
      account_number: acc?.account_number ?? undefined,
      account_id: acc?.id ?? undefined,
    });
    setCreatedClientOnboarding(null);
    if (acc?.primary_service_address) {
      setAddress({
        street: acc.primary_service_address ?? "",
        city: acc.primary_service_city ?? "",
        postal: acc.primary_service_postal_code ?? "",
        province: acc.primary_service_province ?? "QC",
      });
    }
    setStep("plan");
  };

  const handleCreateClient = async () => {
    const email = newClient.email.trim().toLowerCase();
    const first = newClient.first_name.trim();
    const last = newClient.last_name.trim();
    if (!first || !last || !email) {
      toast.error("Prénom, nom et courriel sont requis");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Courriel invalide");
      return;
    }
    if (!newClient.street.trim() || !newClient.city.trim() || !newClient.postal.trim()) {
      toast.error("Adresse complète requise (rue, ville, code postal)");
      return;
    }
    if (!newClient.date_of_birth) {
      toast.error("Date de naissance requise");
      return;
    }
    setCreatingClient(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-create-client-account", {
        body: {
          email,
          first_name: first,
          last_name: last,
          phone: newClient.phone.trim() || undefined,
          date_of_birth: newClient.date_of_birth,
          service_address: newClient.street.trim(),
          service_city: newClient.city.trim(),
          service_postal_code: newClient.postal.trim(),
        },
      });
      if (error) throw error;
      if (!data?.success || !data?.user_id) {
        throw new Error(data?.error || "Création échouée");
      }
      const userId = data.user_id as string;
      const { data: acc } = await supabase
        .from("accounts")
        .select("id, account_number")
        .eq("client_id", userId)
        .maybeSingle();
      setSelectedClient({
        user_id: userId,
        full_name: `${first} ${last}`.trim(),
        email,
        phone: newClient.phone.trim() || undefined,
        account_number: acc?.account_number ?? undefined,
        account_id: acc?.id ?? undefined,
      });
      // Prefill service address
      setAddress({
        street: newClient.street.trim(),
        city: newClient.city.trim(),
        postal: newClient.postal.trim(),
        province: "QC",
      });
      toast.success(data.is_new_account ? "Client créé" : "Client existant lié");
      setCreatedClientOnboarding(data.is_new_account ? {
        user_id: userId,
        email,
        first_name: first,
        last_name: last,
        phone: newClient.phone.trim() || undefined,
        date_of_birth: newClient.date_of_birth,
        service_address: newClient.street.trim(),
        service_city: newClient.city.trim(),
        service_postal_code: newClient.postal.trim(),
      } : null);
      setShowCreateClient(false);
      setStep("plan");
    } catch (err: any) {
      console.error("[CreateClient] error:", err);
      toast.error(err?.message || "Erreur lors de la création du client");
    } finally {
      setCreatingClient(false);
    }
  };

  // Group catalog by category
  const groupedCatalog = (catalog ?? []).reduce((acc: Record<string, any[]>, s: any) => {
    const cat = s.category ?? "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  const categoryLabels: Record<string, string> = {
    internet: "Internet",
    tv: "Télévision",
    mobile: "Mobile",
    streaming: "Streaming",
    security: "Sécurité",
    other: "Autre",
  };

  // Equipment totals
  const selectedEquipment = equipment.filter(e => e.selected);
  const equipmentTotal = selectedEquipment.reduce((s, e) => s + e.price * e.quantity, 0);

  // First-month-free preview (forfait seulement, équipement chargé)
  const monthlyPlan = selectedPlan?.price ?? 0;
  const firstMonthFreeCredit = monthlyPlan; // automatic per business rule

  // Submit order via canonical sync edge function
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClient || !selectedPlan) throw new Error("Données manquantes");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data: agentProfile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", user.id)
        .maybeSingle();

      // Direct-apply discount cap (aligned with Field policy: max $50/mo)
      let appliedDiscount: AgentDiscountRow | null = null;
      if (selectedDiscount) {
        const monthlyValue = selectedDiscount.type === "fixed_monthly" ? Number(selectedDiscount.value) : 0;
        if (monthlyValue > EMPLOYEE_DIRECT_DISCOUNT_MONTHLY_CAP) {
          throw new Error(
            `Rabais > ${EMPLOYEE_DIRECT_DISCOUNT_MONTHLY_CAP}$/mois — escalation Core requise.`,
          );
        }
        appliedDiscount = selectedDiscount;
      }

      const nameParts = (selectedClient.full_name || "").trim().split(/\s+/);
      const firstName = nameParts.shift() || selectedClient.full_name || "Client";
      const lastName = nameParts.join(" ") || "";

      const equipment_line_details = selectedEquipment.map(e => ({
        sku: e.key,
        name: e.name,
        unit_price: e.price,
        quantity: e.quantity,
        line_total: +(e.price * e.quantity).toFixed(2),
      }));

      const cartItems: CartLineItem[] = [
        { type: "service", name: selectedPlan.name, amount: selectedPlan.price, quantity: 1 },
        ...selectedEquipment.map((e) => ({ type: "equipment" as const, name: e.name, amount: e.price, quantity: e.quantity })),
      ];
      const serverPricing = await computeCheckoutPricing(
        cartItems,
        null,
        selectedClient.email,
        selectedClient.user_id,
        appliedDiscount?.type === "fixed_monthly" ? Number(appliedDiscount.value) : 0,
      );

      const pricingSnapshot = {
        ...serverPricing,
        portal: "employee",
        source: "nivra_oneview_cs",
        plan_id: selectedPlan.id,
        plan_name: selectedPlan.name,
        plan_price: selectedPlan.price,
        plan_category: selectedPlan.category,
        equipment: equipment_line_details,
        equipment_total: equipmentTotal,
        install_type: installType,
        install_date: installType === "professional" ? installDate : null,
        install_slot: installType === "professional" ? installSlot : null,
        created_by_agent: agentProfile?.full_name ?? user.email,
        created_by_agent_id: user.id,
        agent_discount: appliedDiscount
          ? {
              id: appliedDiscount.id,
              name: appliedDiscount.name,
              type: appliedDiscount.type,
              value: Number(appliedDiscount.value),
              duration_months: appliedDiscount.duration_months,
            }
          : null,
      };

      const checkoutPayload = {
        customer: {
          user_id: selectedClient.user_id,
          first_name: firstName,
          last_name: lastName,
          email: selectedClient.email,
          phone: selectedClient.phone,
          date_of_birth: createdClientOnboarding?.date_of_birth ?? null,
        },
        client_language: "fr" as const,
        service_address: {
          street: address.street.trim(),
          city: address.city.trim(),
          province: address.province || "QC",
          postal_code: address.postal.trim(),
        },
        services: [{
          name: selectedPlan.name,
          plan_code: selectedPlan.id,
          plan_price: selectedPlan.price,
          category: selectedPlan.category,
          quantity: 1,
        }],
        equipment: equipment_line_details,
        payment: { method: "manual", status: "pending", reference: null },
        installation: {
          type: installType,
          delivery_fee: 0,
          installation_fee: 0,
          scheduled_date: installType === "professional" ? installDate : null,
          scheduled_time: installType === "professional" ? installSlot : null,
        },
        pricing_snapshot: pricingSnapshot,
        notes: agentNotes || "Commande créée via Nivra OneView CS",
        account_id: selectedClient.account_id ?? null,
      };

      const { data: syncData, error: syncError } = await supabase.functions.invoke("checkout-canonical-sync", {
        body: { payload: checkoutPayload },
      });
      if (syncError) throw syncError;
      if (!syncData?.ok) throw new Error((syncData?.errors || ["Synchronisation canonique échouée"]).join(" | "));

      const order = syncData.response as { order_id: string; order_number: string; invoice_id?: string; invoice_number?: string };
      if (!order?.order_id) throw new Error("Commande canonique non retournée");

      await logInternalAudit({
        action: "order_created_by_agent",
        category: "operations",
        portal: "employee",
        targetType: "order",
        targetId: order.order_id,
        details: {
          order_number: order.order_number,
          invoice_number: order.invoice_number,
          client_id: selectedClient.user_id,
          plan: selectedPlan.name,
          install_type: installType,
          equipment_count: selectedEquipment.length,
          agent: agentProfile?.full_name ?? user.email,
        },
      });

      return order;
    },
    onSuccess: (order) => {
      toast.success(`Commande ${order.order_number} créée`);
      setStep("submitted");
    },
    onError: (err: any) => toast.error(`Erreur: ${err.message}`),
  });

  const canSubmit = selectedClient && selectedPlan && address.street.trim().length > 0;
  const STEP_ORDER: Step[] = ["client", "plan", "equipment", "install", "address", "review"];

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(employeePath("/orders"))} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div>
          <h1 className="text-base font-semibold text-foreground">Nouvelle commande</h1>
          <p className="text-[11px] text-muted-foreground">Nivra OneView CS — création complète</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-1 flex-wrap">
        {STEP_ORDER.map((s, i) => {
          const labels: Record<Step, string> = {
            client: "Client", plan: "Forfait", equipment: "Équip.",
            install: "Install", address: "Adresse", review: "Révision",
            submitted: "Soumis",
          };
          const isCurrent = s === step;
          const isPast = STEP_ORDER.indexOf(step as Step) > i;
          return (
            <div key={s} className="flex items-center gap-1">
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                isCurrent ? "bg-primary/10 text-primary border border-primary/30" :
                isPast ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                "bg-muted/50 text-muted-foreground border border-border"
              }`}>
                {isPast ? <CheckCircle2 className="h-3 w-3" /> : <span className="text-[10px]">{i + 1}</span>}
                {labels[s]}
              </div>
              {i < STEP_ORDER.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/30" />}
            </div>
          );
        })}
      </div>

      {/* Step: Client */}
      {step === "client" && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">
                {showCreateClient ? "Créer un nouveau client" : "Sélectionner un client"}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateClient((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/5 text-primary text-xs font-medium hover:bg-primary/10 transition-colors"
            >
              {showCreateClient ? <>← Rechercher</> : <><UserPlus className="h-3.5 w-3.5" /> Nouveau client</>}
            </button>
          </div>

          {!showCreateClient && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text" value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  placeholder="Rechercher par nom, courriel ou téléphone…"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
                  autoFocus
                />
              </div>
              {searching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />}
              {searchResults && searchResults.length > 0 && (
                <div className="space-y-1 max-h-[300px] overflow-y-auto">
                  {searchResults.map((p: any) => (
                    <button
                      key={p.user_id}
                      onClick={() => selectClient(p)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors text-left"
                    >
                      <div>
                        <p className="text-sm text-foreground font-medium">{p.full_name ?? "—"}</p>
                        <p className="text-xs text-muted-foreground">{p.email}</p>
                      </div>
                      {p.phone && <span className="text-xs text-muted-foreground font-mono">{p.phone}</span>}
                    </button>
                  ))}
                </div>
              )}
              {searchResults && searchResults.length === 0 && clientSearch.length >= 2 && (
                <div className="text-center py-4 space-y-2">
                  <p className="text-xs text-muted-foreground">Aucun client trouvé.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateClient(true);
                      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientSearch)) {
                        setNewClient((c) => ({ ...c, email: clientSearch }));
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Créer ce client
                  </button>
                </div>
              )}
            </>
          )}

          {showCreateClient && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Prénom *</label>
                  <input type="text" value={newClient.first_name}
                    onChange={(e) => setNewClient((c) => ({ ...c, first_name: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Nom *</label>
                  <input type="text" value={newClient.last_name}
                    onChange={(e) => setNewClient((c) => ({ ...c, last_name: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Courriel *</label>
                  <input type="email" value={newClient.email}
                    onChange={(e) => setNewClient((c) => ({ ...c, email: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Téléphone</label>
                  <input type="tel" value={newClient.phone}
                    onChange={(e) => setNewClient((c) => ({ ...c, phone: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary/50" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Date de naissance *</label>
                  <input type="date" value={newClient.date_of_birth}
                    onChange={(e) => setNewClient((c) => ({ ...c, date_of_birth: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary/50" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Adresse *</label>
                  <input type="text" value={newClient.street}
                    onChange={(e) => setNewClient((c) => ({ ...c, street: e.target.value }))}
                    placeholder="123 rue Exemple"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Ville *</label>
                  <input type="text" value={newClient.city}
                    onChange={(e) => setNewClient((c) => ({ ...c, city: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary/50" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Code postal *</label>
                  <input type="text" value={newClient.postal}
                    onChange={(e) => setNewClient((c) => ({ ...c, postal: e.target.value.toUpperCase() }))}
                    placeholder="H1H 1H1"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary/50" />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Un compte client sera créé et un courriel de bienvenue avec lien de mot de passe sera envoyé.
              </p>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleCreateClient}
                  disabled={creatingClient}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
                >
                  {creatingClient ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Créer et continuer
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step: Plan */}
      {step === "plan" && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Choisir un forfait</h2>
            </div>
            {selectedClient && (
              <span className="text-xs text-muted-foreground">
                Client: <span className="text-foreground font-medium">{selectedClient.full_name}</span>
              </span>
            )}
          </div>
          {Object.entries(groupedCatalog).map(([cat, services]) => (
            <div key={cat} className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {categoryLabels[cat] ?? cat}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(services as any[]).map((s: any) => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedPlan({ id: s.id, name: s.name, price: s.price, category: s.category ?? "other" }); setStep("equipment"); }}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      selectedPlan?.id === s.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30 hover:bg-primary/5"
                    }`}
                  >
                    <p className="text-sm text-foreground font-medium">{s.name}</p>
                    <p className="text-xs text-primary font-semibold mt-1">{Number(s.price).toFixed(2)} $/mois</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => setStep("client")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Changer de client
          </button>
        </div>
      )}

      {/* Step: Equipment */}
      {step === "equipment" && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Équipement requis</h2>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Règles: max <strong>1 Borne WiFi</strong> par commande, jusqu'à <strong>4 Terminaux TV</strong>, max <strong>1 carte SIM</strong>.
            L'équipement est <strong>requis</strong> (non inclus) et facturé sur la première facture.
          </p>
          <div className="space-y-2">
            {equipment.map((e, idx) => (
              <div key={e.key} className="flex items-center justify-between p-3 rounded-lg border border-border bg-background">
                <label className="flex items-center gap-3 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={e.selected}
                    onChange={(ev) => setEquipment(prev => prev.map((x, i) => i === idx ? { ...x, selected: ev.target.checked } : x))}
                    className="h-4 w-4"
                  />
                  <div>
                    <p className="text-sm text-foreground font-medium">{e.name}</p>
                    <p className="text-[11px] text-muted-foreground">{e.price.toFixed(2)} $ — max {e.maxQuantity}</p>
                  </div>
                </label>
                <div className="flex items-center gap-2">
                  {e.selected && e.maxQuantity > 1 && (
                    <input
                      type="number" min={1} max={e.maxQuantity}
                      value={e.quantity}
                      onChange={(ev) => {
                        const q = Math.max(1, Math.min(e.maxQuantity, Number(ev.target.value) || 1));
                        setEquipment(prev => prev.map((x, i) => i === idx ? { ...x, quantity: q } : x));
                      }}
                      className="w-16 h-9 px-2 rounded-lg border border-border bg-background text-sm text-center"
                    />
                  )}
                  <span className="text-sm font-semibold text-foreground w-20 text-right">
                    {(e.selected ? e.price * e.quantity : 0).toFixed(2)} $
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Total équipement</span>
            <span className="text-foreground font-semibold">{equipmentTotal.toFixed(2)} $</span>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setStep("plan")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Forfait</button>
            <button
              onClick={() => setStep("install")}
              className="ml-auto px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              Installation →
            </button>
          </div>
        </div>
      )}

      {/* Step: Install */}
      {step === "install" && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Type d'installation</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setInstallType("auto")}
              className={`p-4 rounded-lg border text-left transition-colors ${
                installType === "auto" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Auto-installation</p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Le client recevra par courriel le guide PDF officiel d'installation (template Nivra).
              </p>
            </button>
            <button
              type="button"
              onClick={() => setInstallType("professional")}
              className={`p-4 rounded-lg border text-left transition-colors ${
                installType === "professional" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Installation professionnelle</p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Un technicien se déplace à la date et plage horaire choisies par le client.
              </p>
            </button>
          </div>

          {installType === "professional" && (
            <div className="space-y-3 p-3 rounded-lg border border-border bg-background">
              <div>
                <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Date souhaitée (min. 2 jours)</label>
                <input
                  type="date" min={minInstallDate()} value={installDate}
                  onChange={(e) => setInstallDate(e.target.value)}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-1 block">Plage horaire</label>
                <div className="grid grid-cols-3 gap-2">
                  {SLOTS.map(s => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setInstallSlot(s.key)}
                      className={`p-2 rounded-lg border text-xs font-medium transition-colors ${
                        installSlot === s.key ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"
                      }`}
                    >{s.label}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={() => setStep("equipment")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Équipement</button>
            <button
              onClick={() => setStep("address")}
              className="ml-auto px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              Adresse →
            </button>
          </div>
        </div>
      )}

      {/* Step: Address */}
      {step === "address" && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Adresse de service</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Adresse *</label>
              <input type="text" value={address.street}
                onChange={(e) => setAddress(a => ({ ...a, street: e.target.value }))}
                placeholder="123 rue Exemple"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Ville</label>
              <input type="text" value={address.city}
                onChange={(e) => setAddress(a => ({ ...a, city: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Code postal</label>
              <input type="text" value={address.postal}
                onChange={(e) => setAddress(a => ({ ...a, postal: e.target.value.toUpperCase() }))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary/50" />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Notes agent (optionnel)</label>
            <textarea
              value={agentNotes}
              onChange={(e) => setAgentNotes(e.target.value)}
              placeholder="Instructions spéciales, contexte de la demande…"
              rows={3}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:border-primary/50 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep("install")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Installation</button>
            <button
              onClick={() => setStep("review")}
              disabled={!address.street.trim()}
              className="ml-auto px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              Réviser →
            </button>
          </div>
        </div>
      )}

      {/* Step: Review */}
      {step === "review" && selectedClient && selectedPlan && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Révision de la commande</h2>

          {/* Discount selector */}
          <div className="rounded-lg border border-border bg-background p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Appliquer un rabais
              </span>
              <span className="text-[10px] text-muted-foreground">
                Max {EMPLOYEE_DIRECT_DISCOUNT_MONTHLY_CAP}$/mois — au-delà: escalation Core
              </span>
            </div>
            <select
              value={selectedDiscount?.id ?? ""}
              onChange={(e) => {
                const id = e.target.value;
                setSelectedDiscount(id ? (discounts ?? []).find((d) => d.id === id) ?? null : null);
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:border-primary/50 min-h-[44px]"
            >
              <option value="">Aucun rabais additionnel</option>
              {(discounts ?? []).map((d) => {
                const monthly = d.type === "fixed_monthly" ? Number(d.value) : 0;
                const overCap = monthly > EMPLOYEE_DIRECT_DISCOUNT_MONTHLY_CAP;
                return (
                  <option key={d.id} value={d.id} disabled={overCap}>
                    {d.name} {overCap ? "— escalation Core requise" : ""}
                  </option>
                );
              })}
            </select>
            {selectedDiscount && (
              <p className="text-[11px] text-emerald-400">
                Rabais sélectionné: {selectedDiscount.name}
                {selectedDiscount.type === "fixed_monthly" && ` (-${Number(selectedDiscount.value).toFixed(2)} $/mois`}
                {selectedDiscount.duration_months ? ` × ${selectedDiscount.duration_months} mois)` : selectedDiscount.type === "fixed_monthly" ? ")" : ""}
              </p>
            )}
            <p className="text-[11px] text-emerald-400 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Premier mois forfait gratuit (BIENVENUE2026) — appliqué automatiquement.
            </p>
          </div>

          <div className="bg-muted rounded-lg p-4 space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Client</span><span className="text-foreground font-medium">{selectedClient.full_name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Courriel</span><span className="text-foreground">{selectedClient.email}</span></div>
            {selectedClient.account_number && (
              <div className="flex justify-between"><span className="text-muted-foreground">Compte</span><span className="text-foreground font-mono">{selectedClient.account_number}</span></div>
            )}
            <div className="border-t border-border pt-2 flex justify-between"><span className="text-muted-foreground">Forfait</span><span className="text-foreground font-medium">{selectedPlan.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Prix mensuel</span><span className="text-primary font-semibold">{selectedPlan.price.toFixed(2)} $/mois</span></div>
            <div className="flex justify-between text-emerald-400"><span>Premier mois forfait</span><span>− {firstMonthFreeCredit.toFixed(2)} $ (gratuit)</span></div>

            {selectedEquipment.length > 0 && (
              <div className="border-t border-border pt-2 space-y-1">
                <span className="text-muted-foreground">Équipement (1re facture)</span>
                {selectedEquipment.map(e => (
                  <div key={e.key} className="flex justify-between pl-2">
                    <span className="text-foreground">{e.name} × {e.quantity}</span>
                    <span className="text-foreground">{(e.price * e.quantity).toFixed(2)} $</span>
                  </div>
                ))}
                <div className="flex justify-between pl-2 font-medium">
                  <span className="text-foreground">Sous-total équipement</span>
                  <span className="text-foreground">{equipmentTotal.toFixed(2)} $</span>
                </div>
              </div>
            )}

            <div className="border-t border-border pt-2 flex justify-between">
              <span className="text-muted-foreground">Installation</span>
              <span className="text-foreground">
                {installType === "auto"
                  ? "Auto-installation (guide PDF envoyé par courriel)"
                  : `Professionnelle — ${installDate} (${SLOTS.find(s => s.key === installSlot)?.label ?? installSlot})`}
              </span>
            </div>

            <div className="border-t border-border pt-2 flex justify-between"><span className="text-muted-foreground">Adresse</span><span className="text-foreground text-right">{address.street}{address.city ? `, ${address.city}` : ""}{address.postal ? ` ${address.postal}` : ""}</span></div>
            {agentNotes && (
              <div className="border-t border-border pt-2">
                <span className="text-muted-foreground">Notes</span>
                <p className="text-foreground mt-1">{agentNotes}</p>
              </div>
            )}
          </div>

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-300/80">
              <p className="font-medium text-amber-400">Tarification serveur</p>
              <p>Le total final (taxes TPS/TVQ et crédits) sera recalculé par le serveur lors de la facturation.</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep("address")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Modifier</button>
            <button
              onClick={() => submitMutation.mutate()}
              disabled={!canSubmit || submitMutation.isPending}
              className="ml-auto flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
              Créer la commande
            </button>
          </div>
        </div>
      )}

      {/* Step: Submitted */}
      {step === "submitted" && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center space-y-3">
          <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
          <h2 className="text-base font-semibold text-foreground">Commande créée</h2>
          <p className="text-xs text-muted-foreground">
            La commande a été soumise.
            {installType === "auto" && " Un courriel d'auto-installation (template officiel + PDF) a été envoyé au client."}
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button
              onClick={() => navigate(employeePath("/orders"))}
              className="px-4 py-2 rounded-lg border border-border text-xs text-foreground hover:bg-secondary transition-colors"
            >
              Voir les commandes
            </button>
            {selectedClient && (
              <button
                onClick={() => navigate(employeePath(`/clients/${selectedClient.user_id}`))}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                Retour au client
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
