/**
 * CrmSaleModal — Integrated sale flow opened when CRM agent picks "Vendu".
 * 6 tabs : Client · Forfait · Équipement · Rabais · Installation · Récap+Confirmation.
 * Calls edge function `crm-create-sale` which generates the order + commission.
 */
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle2, User, Package, Wrench, Calendar, Receipt, Tag, Percent, DollarSign, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { CrmContact } from "../lib/crmTypes";
import { getInvokeErrorMessage } from "@/lib/functionsInvokeError";

interface Service { id: string; name: string; price: number; category: string }
interface EquipLine { key: string; name: string; price: number; selected: boolean; quantity: number }

interface AgentDiscount {
  id: string;
  name: string;
  type: string; // 'percentage' | 'fixed' | 'fixed_monthly' | 'remove_fee' | 'first_month_free'
  value: number;
  applies_to: string; // 'all' | 'plan_only' | 'installation' | ...
  description: string | null;
  duration_months: number | null;
  min_plan_price: number | null;
}

const DEFAULT_EQUIPMENT: EquipLine[] = [
  { key: "router",   name: "Borne WiFi",      price: 60, selected: false, quantity: 1 },
  { key: "terminal", name: "Terminal TV",     price: 50, selected: false, quantity: 1 },
  { key: "sim",      name: "Carte SIM",       price: 30, selected: false, quantity: 1 },
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

// Eligibility (mirrors fieldDiscountMath.isDiscountEligible, scoped to CRM modal).
function discountEligibility(d: AgentDiscount | null, monthly: number): { eligible: boolean; reason?: string } {
  if (!d) return { eligible: true };
  const min = Number(d.min_plan_price ?? 0);
  if (min > 0 && monthly < min) {
    return { eligible: false, reason: `Forfait ≥ ${min.toFixed(0)} $ requis` };
  }
  if (d.applies_to === "installation") {
    // CRM modal does not bill an installation fee, so this rabais doesn't apply here.
    return { eligible: false, reason: "Aucun frais d'installation à supprimer dans cette vente" };
  }
  if ((d.applies_to === "plan_only" || d.type === "first_month_free") && monthly <= 0) {
    return { eligible: false, reason: "Aucun forfait sélectionné" };
  }
  return { eligible: true };
}

// Compute amounts (mirrors fieldDiscountMath.computeDiscountBreakdown for CRM scope).
function computeDiscount(d: AgentDiscount | null, monthly: number): {
  monthlyDiscountAmount: number;
  firstMonthCredit: number;
} {
  if (!d) return { monthlyDiscountAmount: 0, firstMonthCredit: 0 };
  const elig = discountEligibility(d, monthly);
  if (!elig.eligible) return { monthlyDiscountAmount: 0, firstMonthCredit: 0 };

  switch (d.type) {
    case "first_month_free":
      return { monthlyDiscountAmount: 0, firstMonthCredit: monthly };
    case "percentage":
      return { monthlyDiscountAmount: Math.max(0, (monthly * Number(d.value || 0)) / 100), firstMonthCredit: 0 };
    case "remove_fee":
      return { monthlyDiscountAmount: 0, firstMonthCredit: 0 };
    case "fixed":
    case "fixed_monthly":
    default:
      return { monthlyDiscountAmount: Math.max(0, Math.min(Number(d.value || 0), monthly)), firstMonthCredit: 0 };
  }
}

const valueLabel = (d: AgentDiscount): string => {
  if (d.type === "remove_fee") return "Gratuit";
  if (d.type === "first_month_free") return "1er mois";
  if (d.type === "percentage") return `${d.value}%`;
  return `${Number(d.value || 0).toFixed(2)} $`;
};

const iconFor = (type: string) => {
  if (type === "remove_fee") return Wrench;
  if (type === "first_month_free") return Sparkles;
  if (type === "percentage") return Percent;
  return DollarSign;
};

interface Props {
  contact: CrmContact | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CrmSaleModal({ contact, onClose, onSuccess }: Props) {
  const [tab, setTab] = useState("client");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ order: string; commission: number; paypalUrl: string | null } | null>(null);

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [email, setEmail]         = useState("");
  const [phone, setPhone]         = useState("");
  const [dob, setDob]             = useState("");
  const [address, setAddress]     = useState("");
  const [city, setCity]           = useState("");
  const [postal, setPostal]       = useState("");

  const [selectedPlan, setSelectedPlan] = useState<Service | null>(null);
  const [equipment, setEquipment]       = useState<EquipLine[]>(DEFAULT_EQUIPMENT);
  const [discount, setDiscount]         = useState<AgentDiscount | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [installDate, setInstallDate]   = useState<string>(minInstallDate());
  const [installSlot, setInstallSlot]   = useState<typeof SLOTS[number]["key"]>("morning");
  const [notes, setNotes]               = useState("");

  // Prefill on contact change
  useEffect(() => {
    if (!contact) return;
    setTab("client");
    setSuccess(null);
    setFirstName(contact.first_name ?? "");
    setLastName(contact.last_name ?? "");
    setEmail(contact.email ?? "");
    setPhone(contact.phone ?? "");
    setDob(contact.date_of_birth ?? "");
    setAddress(contact.service_address ?? contact.address ?? "");
    setCity(contact.service_city ?? contact.city ?? "");
    setPostal(contact.service_postal_code ?? contact.postal_code ?? "");
    setSelectedPlan(null);
    setEquipment(DEFAULT_EQUIPMENT.map(e => ({ ...e })));
    setDiscount(null);
    setDiscountError(null);
    setInstallDate(minInstallDate());
    setInstallSlot("morning");
    setNotes("");
  }, [contact?.id]);

  // Load services (plans)
  const { data: services = [], isLoading: loadingServices } = useQuery<Service[]>({
    queryKey: ["crm-sale-services"],
    queryFn: async () => {
      const { data } = await supabase
        .from("services")
        .select("id, name, price, category")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .order("price", { ascending: true });
      return (data ?? []) as Service[];
    },
  });

  // Load agent discounts (same source as Field portal).
  const { data: { user } = { user: null } } = useQuery({
    queryKey: ["crm-sale-current-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return { user: data.user };
    },
    staleTime: 5 * 60_000,
  });

  const { data: discounts = [], isLoading: loadingDiscounts } = useQuery<AgentDiscount[]>({
    queryKey: ["crm-agent-discounts", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: assignments, error: aerr } = await supabase
        .from("agent_discount_assignments")
        .select("discount_id, applies_to_all, agent_id, role")
        .or(`agent_id.eq.${user!.id},applies_to_all.eq.true,role.eq.field_sales,role.eq.employee,role.eq.sales`);
      if (aerr) throw aerr;
      const ids = Array.from(new Set((assignments ?? []).map((a) => a.discount_id)));
      if (!ids.length) return [];
      const { data: rows, error: derr } = await supabase
        .from("agent_discounts")
        .select("id,name,type,value,applies_to,description,expires_at,max_uses,uses_count,is_active,duration_months,min_plan_price")
        .in("id", ids)
        .eq("is_active", true);
      if (derr) throw derr;
      const now = Date.now();
      return (rows ?? []).filter((d: any) => {
        // first_month_free is handled automatically server-side, never user-selectable.
        if (String(d.type) === "first_month_free") return false;
        const notExpired = !d.expires_at || new Date(d.expires_at).getTime() > now;
        const hasCapacity = d.max_uses == null || (d.uses_count ?? 0) < d.max_uses;
        return notExpired && hasCapacity;
      }) as AgentDiscount[];
    },
    staleTime: 30_000,
  });

  const selectedEquipment = useMemo(() => equipment.filter(e => e.selected), [equipment]);
  const equipmentTotal    = selectedEquipment.reduce((s, e) => s + e.price * e.quantity, 0);
  const monthly           = selectedPlan?.price ?? 0;

  // Drop discount if it becomes ineligible when plan/equipment changes
  useEffect(() => {
    if (!discount) return;
    const { eligible } = discountEligibility(discount, monthly);
    if (!eligible) { setDiscount(null); setDiscountError(null); }
  }, [discount, monthly]);

  const { monthlyDiscountAmount, firstMonthCredit } = useMemo(
    () => computeDiscount(discount, monthly),
    [discount, monthly],
  );
  const automaticWelcomeFirstMonth = monthly > 0 ? monthly : 0;

  const monthlyAfterDiscount = Math.max(0, +(monthly - monthlyDiscountAmount).toFixed(2));
  const firstMonthTotalCredit = +(firstMonthCredit + automaticWelcomeFirstMonth).toFixed(2);
  const firstMonthBillablePlan = +Math.max(0, monthlyAfterDiscount - firstMonthTotalCredit).toFixed(2);
  // Subtotal for tax/total = first invoice recurring after credits + equipment one-time.
  const subtotal          = +(firstMonthBillablePlan + equipmentTotal).toFixed(2);
  const tps               = +(subtotal * 0.05).toFixed(2);
  const tvq               = +(subtotal * 0.09975).toFixed(2);
  const total             = +(subtotal + tps + tvq).toFixed(2);
  const commissionEst     = +(monthlyAfterDiscount * 0.30 + equipmentTotal * 0.05).toFixed(2);

  const canSubmit = !!selectedPlan && !!firstName && !!lastName && !!email && !!installDate;

  const selectDiscount = (d: AgentDiscount) => {
    if (discount?.id === d.id) { setDiscount(null); setDiscountError(null); return; }
    const { eligible, reason } = discountEligibility(d, monthly);
    if (!eligible) { setDiscountError(reason ?? "Rabais non applicable"); return; }
    setDiscountError(null);
    setDiscount(d);
  };

  const handleSubmit = async () => {
    if (!contact || !selectedPlan) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("crm-create-sale", {
        body: {
          contact_id: contact.id,
          client: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim(),
            phone: phone.trim() || undefined,
            date_of_birth: dob || undefined,
            service_address: address.trim() || undefined,
            service_city: city.trim() || undefined,
            service_postal_code: postal.trim() || undefined,
          },
          plan: { service_id: selectedPlan.id, name: selectedPlan.name, monthly_price: selectedPlan.price, category: selectedPlan.category },
          equipment: selectedEquipment.map(e => ({ name: e.name, price: e.price, quantity: e.quantity })),
          discount: discount ? {
            id: discount.id,
            name: discount.name,
            type: discount.type,
            value: discount.value,
            applies_to: discount.applies_to,
            duration_months: discount.duration_months,
            monthly_discount_amount: monthlyDiscountAmount,
            first_month_credit: firstMonthCredit,
          } : null,
          install: { date: installDate, slot: installSlot },
          notes: notes.trim() || undefined,
        },
      });
      if (error || (data as any)?.error) {
        const message = (data as any)?.error ?? (error ? await getInvokeErrorMessage(error) : "Erreur inconnue");
        toast.error(`Erreur: ${message}`);
        return;
      }
      const r = data as { order_number: string; commission_estimate: number; paypal_approve_url: string | null };
      setSuccess({ order: r.order_number, commission: r.commission_estimate, paypalUrl: r.paypal_approve_url ?? null });
      toast.success(`Vente complétée! Commande ${r.order_number} • Commission: ${r.commission_estimate.toFixed(2)}$`);
      onSuccess?.();
    } catch (e: any) {
      const message = e?.context ? await getInvokeErrorMessage(e) : (e?.message ?? "Erreur lors de la création de la vente");
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!contact) return null;

  return (
    <Dialog open={!!contact} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="!w-[min(96vw,52rem)] max-w-none p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Vente CRM — {contact.first_name} {contact.last_name}</DialogTitle>
          <DialogDescription>Complétez les étapes pour finaliser la vente OneView CS.</DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500" />
            <h3 className="text-xl font-bold">Vente complétée!</h3>
            <p className="text-sm text-muted-foreground">Commande <span className="font-mono font-semibold">{success.order}</span></p>
            <p className="text-sm">Commission estimée : <span className="font-bold text-emerald-500">{success.commission.toFixed(2)} $</span></p>
            <p className="text-xs text-muted-foreground">📧 Email de confirmation envoyé au client · Commande liée à Nivra Core</p>
            {success.paypalUrl && (
              <a
                href={success.paypalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#ffc439] text-[#003087] font-bold text-sm hover:brightness-95"
              >
                💳 Ouvrir le paiement PayPal
              </a>
            )}
            <div className="pt-2">
              <Button onClick={onClose} variant="outline">Fermer</Button>
            </div>
          </div>

        ) : (
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid grid-cols-6 mx-4 mt-3">
              <TabsTrigger value="client"><User className="h-3.5 w-3.5 mr-1" />Client</TabsTrigger>
              <TabsTrigger value="plan" disabled={!firstName || !lastName || !email}><Package className="h-3.5 w-3.5 mr-1" />Forfait</TabsTrigger>
              <TabsTrigger value="equipment" disabled={!selectedPlan}><Wrench className="h-3.5 w-3.5 mr-1" />Équip.</TabsTrigger>
              <TabsTrigger value="discount" disabled={!selectedPlan}><Tag className="h-3.5 w-3.5 mr-1" />Rabais</TabsTrigger>
              <TabsTrigger value="install" disabled={!selectedPlan}><Calendar className="h-3.5 w-3.5 mr-1" />Install</TabsTrigger>
              <TabsTrigger value="recap" disabled={!canSubmit}><Receipt className="h-3.5 w-3.5 mr-1" />Récap</TabsTrigger>
            </TabsList>

            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <TabsContent value="client" className="space-y-3 mt-0">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Prénom *</Label><Input value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
                  <div><Label>Nom *</Label><Input value={lastName} onChange={e => setLastName(e.target.value)} /></div>
                  <div><Label>Courriel *</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
                  <div><Label>Téléphone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
                  <div><Label>Date de naissance</Label><Input type="date" value={dob} onChange={e => setDob(e.target.value)} /></div>
                  <div><Label>Code postal</Label><Input value={postal} onChange={e => setPostal(e.target.value)} /></div>
                  <div className="col-span-2"><Label>Adresse de service</Label><Input value={address} onChange={e => setAddress(e.target.value)} /></div>
                  <div className="col-span-2"><Label>Ville</Label><Input value={city} onChange={e => setCity(e.target.value)} /></div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={() => setTab("plan")} disabled={!firstName || !lastName || !email}>Continuer</Button>
                </div>
              </TabsContent>

              <TabsContent value="plan" className="space-y-2 mt-0">
                {loadingServices ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : services.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Aucun forfait disponible.</p>
                ) : services.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedPlan(s)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedPlan?.id === s.id
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-border hover:border-violet-500/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-sm">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{s.category}</div>
                      </div>
                      <div className="text-violet-500 font-bold">{Number(s.price).toFixed(2)} $/mois</div>
                    </div>
                  </button>
                ))}
                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={() => setTab("client")}>Retour</Button>
                  <Button onClick={() => setTab("equipment")} disabled={!selectedPlan}>Continuer</Button>
                </div>
              </TabsContent>

              <TabsContent value="equipment" className="space-y-2 mt-0">
                <p className="text-xs text-muted-foreground">Équipement requis (sélectionnez ce que le client commande).</p>
                {equipment.map((e, idx) => (
                  <div key={e.key} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={e.selected}
                        onChange={(ev) => setEquipment(prev => prev.map((x, i) => i === idx ? { ...x, selected: ev.target.checked } : x))}
                        className="h-4 w-4"
                      />
                      <span className="font-medium text-sm">{e.name}</span>
                    </label>
                    <div className="flex items-center gap-2">
                      {e.selected && (
                        <Input
                          type="number" min={1} max={4}
                          value={e.quantity}
                          onChange={(ev) => setEquipment(prev => prev.map((x, i) => i === idx ? { ...x, quantity: Math.max(1, +ev.target.value) } : x))}
                          className="w-16 h-8"
                        />
                      )}
                      <span className="text-sm font-semibold w-20 text-right">{(e.price * e.quantity).toFixed(2)} $</span>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={() => setTab("plan")}>Retour</Button>
                  <Button onClick={() => setTab("discount")}>Continuer</Button>
                </div>
              </TabsContent>

              <TabsContent value="discount" className="space-y-3 mt-0">
                <div>
                  <p className="text-sm font-semibold">Rabais agent (optionnel)</p>
                  <p className="text-xs text-muted-foreground">Sélectionnez un rabais Nivra à appliquer. Le « 1er mois offert » est appliqué automatiquement à la finalisation.</p>
                </div>

                {discountError && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">{discountError}</p>
                  </div>
                )}

                {loadingDiscounts ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : discounts.length === 0 ? (
                  <div className="p-4 rounded-lg border border-dashed border-border text-center">
                    <p className="text-sm text-muted-foreground">Aucun rabais assigné à votre profil. Les rabais sont gérés par Nivra Core.</p>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {discounts.map((d) => {
                      const active = discount?.id === d.id;
                      const { eligible, reason } = discountEligibility(d, monthly);
                      const Icon = iconFor(d.type);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => selectDiscount(d)}
                          disabled={!eligible && !active}
                          title={!eligible ? reason : undefined}
                          className={cn(
                            "text-left p-3 rounded-lg border transition-colors",
                            active
                              ? "border-violet-500 bg-violet-500/10"
                              : eligible
                                ? "border-border hover:border-violet-500/50"
                                : "border-border opacity-50 cursor-not-allowed",
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0",
                              active ? "bg-violet-500 text-white" : "bg-muted text-violet-500",
                            )}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-sm">{d.name}</span>
                                <span className="text-sm font-bold text-violet-500">{valueLabel(d)}</span>
                              </div>
                              {d.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.description}</p>}
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                {d.duration_months ? (
                                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-600 border border-violet-500/30">
                                    {d.duration_months} mois
                                  </span>
                                ) : null}
                                {d.min_plan_price ? (
                                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                                    Min. {Number(d.min_plan_price).toFixed(0)} $
                                  </span>
                                ) : null}
                                {!eligible && <span className="text-[10px] text-amber-600">{reason ?? "Non applicable"}</span>}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {discount && (
                  <button
                    type="button"
                    onClick={() => { setDiscount(null); setDiscountError(null); }}
                    className="w-full text-xs text-muted-foreground hover:text-foreground py-2 rounded-lg border border-dashed border-border"
                  >
                    Retirer le rabais sélectionné
                  </button>
                )}

                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={() => setTab("equipment")}>Retour</Button>
                  <Button onClick={() => setTab("install")}>Continuer</Button>
                </div>
              </TabsContent>

              <TabsContent value="install" className="space-y-3 mt-0">
                <div>
                  <Label>Date d'installation (minimum 2 jours)</Label>
                  <Input type="date" min={minInstallDate()} value={installDate} onChange={e => setInstallDate(e.target.value)} />
                </div>
                <div>
                  <Label>Plage horaire</Label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {SLOTS.map(s => (
                      <button
                        key={s.key}
                        onClick={() => setInstallSlot(s.key)}
                        className={`p-2 rounded-lg border text-xs font-medium transition-colors ${
                          installSlot === s.key ? "border-violet-500 bg-violet-500/10 text-violet-500" : "border-border hover:border-violet-500/50"
                        }`}
                      >{s.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Notes (optionnel)</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Instructions spéciales, codes d'accès, etc." rows={2} />
                </div>
                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={() => setTab("discount")}>Retour</Button>
                  <Button onClick={() => setTab("recap")} disabled={!canSubmit}>Voir récapitulatif</Button>
                </div>
              </TabsContent>

              <TabsContent value="recap" className="space-y-3 mt-0">
                <div className="rounded-lg border border-border p-3 space-y-2 text-sm">
                  <div className="font-semibold">Client</div>
                  <div className="text-xs text-muted-foreground">{firstName} {lastName} · {email}{phone ? ` · ${phone}` : ""}</div>
                  {(address || city || postal) && (
                    <div className="text-xs text-muted-foreground">{[address, city, postal].filter(Boolean).join(", ")}</div>
                  )}
                </div>
                <div className="rounded-lg border border-border p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span>Forfait : {selectedPlan?.name}</span><span className="font-semibold">{monthly.toFixed(2)} $/mois</span></div>
                  {discount && monthlyDiscountAmount > 0 && (
                    <div className="flex justify-between text-xs text-emerald-600">
                      <span>Rabais : {discount.name}{discount.duration_months ? ` (${discount.duration_months} mois)` : ""}</span>
                      <span>− {monthlyDiscountAmount.toFixed(2)} $/mois</span>
                    </div>
                  )}
                  {discount && firstMonthCredit > 0 && (
                    <div className="flex justify-between text-xs text-emerald-600">
                      <span>Rabais : {discount.name} (1er mois)</span>
                      <span>− {firstMonthCredit.toFixed(2)} $</span>
                    </div>
                  )}
                  {automaticWelcomeFirstMonth > 0 && (
                    <div className="flex justify-between text-xs text-emerald-600">
                      <span>Premier mois gratuit (forfait seulement)</span>
                      <span>− {automaticWelcomeFirstMonth.toFixed(2)} $</span>
                    </div>
                  )}
                  {selectedEquipment.map(e => (
                    <div key={e.key} className="flex justify-between text-xs text-muted-foreground">
                      <span>{e.name} × {e.quantity}</span><span>{(e.price * e.quantity).toFixed(2)} $</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Forfait facturable sur 1re facture</span><span>{firstMonthBillablePlan.toFixed(2)} $</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border"><span>Sous-total 1re facture</span><span>{subtotal.toFixed(2)} $</span></div>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>TPS (5%)</span><span>{tps.toFixed(2)} $</span></div>
                  <div className="flex justify-between text-xs text-muted-foreground"><span>TVQ (9.975%)</span><span>{tvq.toFixed(2)} $</span></div>
                  <div className="flex justify-between font-bold text-base pt-1 border-t border-border"><span>Total à facturer</span><span className="text-violet-500">{total.toFixed(2)} $</span></div>
                </div>
                <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-500 font-medium">💰 Votre commission estimée</span>
                    <span className="text-emerald-500 font-bold">{commissionEst.toFixed(2)} $</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">30% du forfait mensuel (après rabais) + 5% de l'équipement</p>
                </div>
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
                  📋 La commande sera créée avec statut <strong>pending payment</strong>, liée à Nivra Core,
                  et un courriel de confirmation officiel sera envoyé au client avec le lien PayPal.
                </div>
                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={() => setTab("install")} disabled={submitting}>Retour</Button>
                  <Button onClick={handleSubmit} disabled={!canSubmit || submitting} className="bg-emerald-600 hover:bg-emerald-700">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                    Confirmer la vente
                  </Button>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
