/**
 * EmployeeCreateOrder — Agent order intake form.
 * Creates orders through the canonical pipeline (edge function).
 * No pricing override — all pricing is server-side.
 */
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { employeePath } from "@/employee-app/lib/employeePaths";
import { logInternalAudit } from "@/lib/security/internalAuditLogger";
import {
  ArrowLeft, Loader2, Search, User, ShoppingCart, MapPin,
  CheckCircle2, AlertTriangle, ChevronRight, UserPlus,
} from "lucide-react";

type Step = "client" | "plan" | "address" | "review" | "submitted";

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

// Direct-apply ceiling: aligned with Field policy (max $50/mo, 24 months).
// Anything beyond requires Core escalation.
const EMPLOYEE_DIRECT_DISCOUNT_MONTHLY_CAP = 50;

interface AgentDiscountRow {
  id: string;
  name: string;
  type: string;
  value: number;
  duration_months: number | null;
  applies_to: string;
}

export default function EmployeeCreateOrder() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetClientId = searchParams.get("clientId");

  const [step, setStep] = useState<Step>("client");
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<SelectedClient | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SelectedPlan | null>(null);
  const [address, setAddress] = useState({ street: "", city: "", postal: "", province: "QC" });
  const [agentNotes, setAgentNotes] = useState("");
  const [selectedDiscount, setSelectedDiscount] = useState<AgentDiscountRow | null>(null);

  // If preset client, load directly
  useEffect(() => {
    if (presetClientId) {
      supabase
        .from("profiles")
        .select("user_id, full_name, email, phone")
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
            `Rabais > ${EMPLOYEE_DIRECT_DISCOUNT_MONTHLY_CAP}$/mois — escalation Core requise. Annulez la sélection ou choisissez un rabais plus petit.`,
          );
        }
        appliedDiscount = selectedDiscount;
      }

      // Resolve or create account (DB trigger fn_require_order_account_id mandates account_id)
      let accountId = selectedClient.account_id;
      if (!accountId) {
        const { data: existingAcc } = await supabase
          .from("accounts")
          .select("id")
          .eq("client_id", selectedClient.user_id)
          .maybeSingle();
        if (existingAcc?.id) {
          accountId = existingAcc.id;
        } else {
          const newAccountNumber = `ACC-${Date.now().toString(36).toUpperCase()}`;
          const { data: createdAcc, error: accErr } = await supabase
            .from("accounts")
            .insert({ client_id: selectedClient.user_id, account_number: newAccountNumber })
            .select("id")
            .single();
          if (accErr) throw new Error(`Création compte échouée: ${accErr.message}`);
          accountId = createdAcc.id;
        }
      }

      // Create the order via direct insert (canonical-sync will handle billing)
      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

      const nameParts = (selectedClient.full_name || "").trim().split(/\s+/);
      const firstName = nameParts.shift() || selectedClient.full_name || "Client";
      const lastName = nameParts.join(" ") || "";

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: selectedClient.user_id,
          account_id: accountId,
          order_number: orderNumber,
          status: "submitted",
          payment_status: "pending",
          service_type: selectedPlan.category,
          total_amount: selectedPlan.price,
          environment: "live",
          source: "employee_portal",
          created_by: user.id,
          created_by_agent_id: user.id,
          agent_name: agentProfile?.full_name ?? user.email ?? null,
          client_first_name: firstName,
          client_last_name: lastName,
          client_email: selectedClient.email,
          client_phone: selectedClient.phone ?? null,
          client_full_address: [address.street, address.city, address.postal].filter(Boolean).join(", ") || null,
          shipping_address: address.street || null,
          shipping_city: address.city || null,
          shipping_postal_code: address.postal || null,
          notes: agentNotes || null,
          discount_code: appliedDiscount?.id ?? null,
          discount_amount: appliedDiscount?.type === "fixed_monthly" ? Number(appliedDiscount.value) : 0,
          pricing_snapshot: {
            portal: "employee",
            plan_id: selectedPlan.id,
            plan_name: selectedPlan.name,
            plan_price: selectedPlan.price,
            plan_category: selectedPlan.category,
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
          },
        })
        .select("id, order_number")
        .single();

      if (orderError) throw orderError;

      // Log audit
      await logInternalAudit({
        action: "order_created_by_agent",
        category: "operations",
        portal: "employee",
        targetType: "order",
        targetId: order.id,
        details: {
          order_number: order.order_number,
          client_id: selectedClient.user_id,
          plan: selectedPlan.name,
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

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(employeePath("/orders"))} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </button>
        <div>
          <h1 className="text-base font-semibold text-foreground">Nouvelle commande</h1>
          <p className="text-[11px] text-muted-foreground">Création pour un client existant</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {(["client", "plan", "address", "review"] as Step[]).map((s, i) => {
          const labels = { client: "Client", plan: "Forfait", address: "Adresse", review: "Révision" };
          const isCurrent = s === step;
          const isPast = ["client", "plan", "address", "review"].indexOf(step) > i;
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                isCurrent ? "bg-primary/10 text-primary border border-primary/30" :
                isPast ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                "bg-muted/50 text-muted-foreground border border-border"
              }`}>
                {isPast ? <CheckCircle2 className="h-3 w-3" /> : <span className="text-[10px]">{i + 1}</span>}
                {labels[s]}
              </div>
              {i < 3 && <ChevronRight className="h-3 w-3 text-muted-foreground/30" />}
            </div>
          );
        })}
      </div>

      {/* Step: Client */}
      {step === "client" && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Sélectionner un client</h2>
          </div>
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
            <p className="text-xs text-muted-foreground text-center py-4">Aucun client trouvé.</p>
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
                    onClick={() => { setSelectedPlan({ id: s.id, name: s.name, price: s.price, category: s.category ?? "other" }); setStep("address"); }}
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
              <input
                type="text" value={address.street}
                onChange={(e) => setAddress(a => ({ ...a, street: e.target.value }))}
                placeholder="123 rue Exemple"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Ville</label>
              <input
                type="text" value={address.city}
                onChange={(e) => setAddress(a => ({ ...a, city: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Code postal</label>
              <input
                type="text" value={address.postal}
                onChange={(e) => setAddress(a => ({ ...a, postal: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Notes agent (optionnel)</label>
            <textarea
              value={agentNotes}
              onChange={(e) => setAgentNotes(e.target.value)}
              placeholder="Instructions spéciales, contexte de la demande…"
              rows={3}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep("plan")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Forfait</button>
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

          {/* Discount selector — direct apply, capped at $50/mo (Field policy) */}
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
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground focus:outline-none focus:border-primary/50 min-h-[44px]"
            >
              <option value="">Aucun rabais</option>
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
          </div>

          <div className="bg-muted rounded-lg p-4 space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Client</span>
              <span className="text-foreground font-medium">{selectedClient.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Courriel</span>
              <span className="text-foreground">{selectedClient.email}</span>
            </div>
            {selectedClient.account_number && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Compte</span>
                <span className="text-foreground font-mono">{selectedClient.account_number}</span>
              </div>
            )}
            <div className="border-t border-border pt-2 flex justify-between">
              <span className="text-muted-foreground">Forfait</span>
              <span className="text-foreground font-medium">{selectedPlan.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Prix catalogue</span>
              <span className="text-primary font-semibold">{selectedPlan.price.toFixed(2)} $/mois</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between">
              <span className="text-muted-foreground">Adresse</span>
              <span className="text-foreground text-right">{address.street}{address.city ? `, ${address.city}` : ""}{address.postal ? ` ${address.postal}` : ""}</span>
            </div>
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
              <p>Le prix final sera calculé par le serveur. Le prix affiché est le tarif catalogue avant taxes et promotions.</p>
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
          <p className="text-xs text-muted-foreground">La commande a été soumise et sera traitée par l'équipe opérations.</p>
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
