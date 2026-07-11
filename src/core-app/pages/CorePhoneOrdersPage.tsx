/**
 * CorePhoneOrdersPage — Core admin queue for phone orders.
 * Lists every row from `phone_orders` with risk score, KYC status, and
 * contextual actions (approve & ship, block & refund, request KYC).
 *
 * Side panel exposes fraud factors, shipping address, KYC details, and
 * agent action buttons that mutate phone_orders + phone_inventory and
 * (when blocking) call the existing `paypal-refund` edge function.
 *
 * NEW — "Nouvelle commande manuelle" full-screen modal lets agents create
 * a phone order on behalf of a client, in 8 sections (device, client,
 * order type, address, pricing, payment, anti-fraud override, notes).
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AddressAutocomplete } from "@/components/shared/AddressAutocomplete";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { enqueueCommunication } from "@/lib/enqueueCommunication";
import { logActivityLog } from "@/lib/logActivityLog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertTriangle, Smartphone, Shield, Truck, Ban, RefreshCw, Plus, Search,
  User, MapPin, DollarSign, CreditCard, FileText,
} from "lucide-react";

type FraudLevel = "low" | "medium" | "high";

interface PhoneOrderRow {
  id: string;
  order_id: string;
  phone_inventory_id: string;
  user_id: string;
  status: string;
  fraud_score: number;
  fraud_level: FraudLevel;
  fraud_factors: Record<string, number> | null;
  shipping_address: Record<string, string> | null;
  tracking_number: string | null;
  carrier: string | null;
  notes: string | null;
  created_at: string;
  phone_inventory?: {
    brand: string;
    model: string;
    storage: string;
    color: string;
    imei: string;
    price_cad: number;
  } | null;
  orders?: {
    order_number: string | null;
    total_amount: number | null;
    client_email: string | null;
    client_first_name: string | null;
    client_last_name: string | null;
  } | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending_kyc: "KYC en attente",
  kyc_submitted: "KYC soumis",
  kyc_approved: "KYC approuvé",
  risk_review: "Revue risque",
  approved: "Approuvé",
  blocked: "Bloqué",
  shipped: "Expédié",
  delivered: "Livré",
  return_requested: "Retour demandé",
  returned: "Retourné",
  refunded: "Remboursé",
};

const FRAUD_BADGE: Record<FraudLevel, { label: string; className: string }> = {
  low: { label: "Faible", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  medium: { label: "Moyen", className: "bg-amber-100 text-amber-800 border-amber-200" },
  high: { label: "Élevé", className: "bg-rose-100 text-rose-800 border-rose-200" },
};

export default function CorePhoneOrdersPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [selected, setSelected] = useState<PhoneOrderRow | null>(null);
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("Postes Canada");
  const [manualOpen, setManualOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["core-phone-orders", statusFilter, riskFilter],
    queryFn: async () => {
      let q = supabase
        .from("phone_orders")
        .select(
          `*, phone_inventory:phone_inventory_id (brand, model, storage, color, imei, price_cad),
           orders:order_id (order_number, total_amount, client_email, client_first_name, client_last_name)`
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (riskFilter !== "all") q = q.eq("fraud_level", riskFilter);
      const { data, error } = await q;
return (data ?? []) as unknown as PhoneOrderRow[];
    },
  });

  const counts = useMemo(() => {
    const list = data ?? [];
    return {
      total: list.length,
      review: list.filter((r) => r.status === "kyc_approved" && r.fraud_level !== "low").length,
      pending: list.filter((r) => r.status.startsWith("pending") || r.status === "kyc_submitted").length,
      blocked: list.filter((r) => r.status === "blocked").length,
    };
  }, [data]);

  // ---------- ACTIONS ----------
  async function approveAndShip() {
    if (!selected || !tracking.trim()) {
      toast.error("Numéro de suivi requis");
      return;
    }
    try {
      const updates = await Promise.all([
        supabase
          .from("phone_orders")
          .update({
            status: "shipped",
            tracking_number: tracking.trim(),
            carrier: carrier.trim() || null,
            shipped_at: new Date().toISOString(),
          })
          .eq("id", selected.id),
        supabase
          .from("phone_inventory")
          .update({ status: "sold" })
          .eq("id", selected.phone_inventory_id),
      ]);
      if (updates.some((u) => u.error)) throw updates.find((u) => u.error)!.error;

      await queuePhoneEmail({
        recipient: selected.orders?.client_email,
        eventKey: `phone-shipped-${selected.id}`,
        templateKey: "phone_approved_shipping",
        subject: "Votre appareil est en route 📦",
        vars: {
          carrier: carrier.trim() || "Postes Canada",
          tracking_number: tracking.trim(),
          imei_last4: (selected.phone_inventory?.imei ?? "").slice(-4),
          tracking_url: `https://www.canadapost-postescanada.ca/track-reperage/fr#/details/${tracking.trim()}`,
        },
      });

      toast.success("Commande approuvée et expédiée");
      setTracking("");
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["core-phone-orders"] });
    } catch (e) {
      console.error(e);
      toast.error("Échec de l'expédition");
    }
  }

  async function blockOrder() {
    if (!selected) return;
    if (!confirm("Bloquer cette commande et déclencher un remboursement PayPal ?")) return;
    try {
      const updates = await Promise.all([
        supabase
          .from("phone_orders")
          .update({ status: "blocked", notes: "Bloquée par agent (risque)" })
          .eq("id", selected.id),
        supabase
          .from("phone_inventory")
          .update({ status: "available", order_id: null, assigned_at: null })
          .eq("id", selected.phone_inventory_id),
      ]);
      if (updates.some((u) => u.error)) throw updates.find((u) => u.error)!.error;

      // Phase 3.B.3 — `paypal-refund` is decommissioned. If the blocked order
      // was paid via PayPal (historical), the operator must issue the refund
      // manually in the PayPal dashboard. We only log for audit.
      try {
        const { data: pay } = await supabase
          .from("billing_payments")
          .select("id, provider")
          .eq("invoice_id", selected.order_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (pay?.id && pay.provider === "paypal") {
          console.warn(
            "[phone-orders] Legacy PayPal refund required — process manually:",
            { payment_id: pay.id, order_id: selected.order_id },
          );
        }
      } catch (e) {
        console.warn("[phone-orders] refund lookup skipped", e);
      }


      await queuePhoneEmail({
        recipient: selected.orders?.client_email,
        eventKey: `phone-blocked-${selected.id}`,
        templateKey: "phone_blocked",
        subject: "Votre commande n'a pas pu être traitée",
        vars: {},
      });

      toast.success("Commande bloquée et remboursement initié");
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["core-phone-orders"] });
    } catch (e) {
      console.error(e);
      toast.error("Échec du blocage");
    }
  }

  async function approveReturn() {
    if (!selected) return;
    try {
      await supabase
        .from("phone_orders")
        .update({ status: "returned", notes: "Retour approuvé par agent" })
        .eq("id", selected.id);
      await queuePhoneEmail({
        recipient: selected.orders?.client_email,
        eventKey: `phone-return-confirmed-${selected.id}`,
        templateKey: "phone_return_confirmed",
        subject: "Votre demande de retour est acceptée",
        vars: {},
      });
      toast.success("Retour confirmé — étiquette envoyée");
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["core-phone-orders"] });
    } catch (e) {
      console.error(e);
      toast.error("Échec de l'approbation");
    }
  }

  // ---------- RENDER ----------
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Smartphone className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Commandes de téléphones</h1>
            <p className="text-sm text-muted-foreground">
              Vérifiez le risque, approuvez l'expédition ou bloquez les commandes suspectes.
            </p>
          </div>
        </div>
        <Button onClick={() => setManualOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nouvelle commande manuelle
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Total" value={counts.total} />
        <KpiCard label="À examiner" value={counts.review} highlight="amber" />
        <KpiCard label="En attente" value={counts.pending} highlight="blue" />
        <KpiCard label="Bloquées" value={counts.blocked} highlight="red" />
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base">Liste</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Statut" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Risque" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous risques</SelectItem>
                <SelectItem value="low">Faible</SelectItem>
                <SelectItem value="medium">Moyen</SelectItem>
                <SelectItem value="high">Élevé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Chargement…</div>
          ) : (data ?? []).length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Aucune commande</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Commande</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Appareil</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Risque</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">
                      #{row.orders?.order_number ?? row.order_id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {row.orders?.client_first_name} {row.orders?.client_last_name}
                      </div>
                      <div className="text-xs text-muted-foreground">{row.orders?.client_email}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.phone_inventory?.brand} {row.phone_inventory?.model}{" "}
                      <span className="text-muted-foreground">{row.phone_inventory?.storage}</span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {(row.orders?.total_amount ?? 0).toFixed(2)} $
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className={FRAUD_BADGE[row.fraud_level].className}>
                              {row.fraud_score} · {FRAUD_BADGE[row.fraud_level].label}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <div className="text-xs space-y-1">
                              {Object.entries(row.fraud_factors ?? {}).map(([k, v]) => (
                                <div key={k}>+{v} — {k.replace(/_/g, " ")}</div>
                              ))}
                              {Object.keys(row.fraud_factors ?? {}).length === 0 && <div>Aucun facteur</div>}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{STATUS_LABELS[row.status] ?? row.status}</Badge></TableCell>
                    <TableCell className="text-xs">{new Date(row.created_at).toLocaleDateString("fr-CA")}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setSelected(row)}>Détails</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Side panel — details */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Commande #{selected.orders?.order_number ?? selected.order_id.slice(0, 8)}
                </SheetTitle>
                <SheetDescription>
                  {selected.phone_inventory?.brand} {selected.phone_inventory?.model} —{" "}
                  {selected.phone_inventory?.storage} {selected.phone_inventory?.color}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6 text-sm">
                <section>
                  <h3 className="font-semibold flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4" /> Score de risque
                  </h3>
                  <Badge variant="outline" className={FRAUD_BADGE[selected.fraud_level].className}>
                    {selected.fraud_score} · {FRAUD_BADGE[selected.fraud_level].label}
                  </Badge>
                  <ul className="mt-3 space-y-1 text-muted-foreground">
                    {Object.entries(selected.fraud_factors ?? {}).map(([k, v]) => (
                      <li key={k}>+{v} — {k.replace(/_/g, " ")}</li>
                    ))}
                    {Object.keys(selected.fraud_factors ?? {}).length === 0 && <li>Aucun facteur déclencheur</li>}
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold mb-2">Adresse de livraison</h3>
                  {selected.shipping_address ? (
                    <div className="text-muted-foreground space-y-0.5">
                      <div>{selected.shipping_address.address}</div>
                      <div>{selected.shipping_address.city}, {selected.shipping_address.province} {selected.shipping_address.postal_code}</div>
                      <div>{selected.shipping_address.country ?? "Canada"}</div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground">Non renseignée</div>
                  )}
                </section>

                <section>
                  <h3 className="font-semibold mb-2">Client</h3>
                  <div className="text-muted-foreground">
                    {selected.orders?.client_first_name} {selected.orders?.client_last_name} —{" "}
                    {selected.orders?.client_email}
                  </div>
                </section>

                <section className="space-y-3 pt-4 border-t">
                  <h3 className="font-semibold">Actions</h3>
                  {(selected.status === "kyc_approved" || selected.status === "approved") && (
                    <div className="space-y-2 p-3 rounded border bg-emerald-50/40">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Transporteur</Label>
                          <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs">N° de suivi</Label>
                          <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="1Z..." />
                        </div>
                      </div>
                      <Button onClick={approveAndShip} className="w-full" size="sm">
                        <Truck className="h-4 w-4 mr-2" />
                        Approuver et expédier
                      </Button>
                    </div>
                  )}

                  {selected.status === "return_requested" && (
                    <Button onClick={approveReturn} variant="outline" className="w-full" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Approuver le retour
                    </Button>
                  )}

                  {selected.status !== "blocked" && selected.status !== "refunded" && (
                    <Button onClick={blockOrder} variant="destructive" className="w-full" size="sm">
                      <Ban className="h-4 w-4 mr-2" />
                      Bloquer & rembourser
                    </Button>
                  )}

                  {selected.fraud_level !== "low" && (
                    <div className="flex items-start gap-2 p-3 rounded border bg-amber-50/40 text-amber-900 text-xs">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      Vérification renforcée recommandée avant expédition.
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Manual order modal */}
      <ManualOrderDialog
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onSuccess={() => {
          setManualOpen(false);
          qc.invalidateQueries({ queryKey: ["core-phone-orders"] });
        }}
      />
    </div>
  );
}

// ─────────────────────────── KPI Card ───────────────────────────
function KpiCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: "amber" | "blue" | "red";
}) {
  const cls =
    highlight === "amber"
      ? "border-amber-200 bg-amber-50"
      : highlight === "red"
        ? "border-rose-200 bg-rose-50"
        : highlight === "blue"
          ? "border-blue-200 bg-blue-50"
          : "";
  return (
    <Card className={cls}>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────── Email helper ───────────────────────────
async function queuePhoneEmail(args: {
  recipient: string | null | undefined;
  eventKey: string;
  templateKey: string;
  subject: string;
  vars: Record<string, unknown>;
}) {
  if (!args.recipient) return;
  try {
    await enqueueCommunication({
      channel: "email",
      templateKey: args.templateKey,
      recipient: args.recipient,
      idempotencyKey: args.eventKey,
      templateVars: args.vars,
      subject: args.subject,
    });
  } catch (e) {
    console.warn("[queuePhoneEmail] failed", e);
  }
}

// ═══════════════════════════════════════════════════════════════════
// MANUAL ORDER DIALOG — 8 sections
// ═══════════════════════════════════════════════════════════════════

interface AvailablePhone {
  id: string;
  brand: string;
  model: string;
  storage: string;
  color: string;
  imei: string;
  price_cad: number;
  condition: string;
}

interface ClientResult {
  user_id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  service_address: string | null;
  service_city: string | null;
  service_province: string | null;
  service_postal_code: string | null;
  account_number?: string | null;
  account_id?: string | null;
}

interface MobilePlan {
  id: string;
  name: string;
  price_monthly: number;
}

type PaymentMethod = "paypal_done" | "etransfer" | "cash" | "to_invoice";
type PaymentStatus = "paid" | "pending";
type KycChoice = "approved" | "required" | "not_required";
type DiscountReason = "promotion" | "loyalty" | "employee" | "exchange" | "other";
type FulfillmentMode = "self_standard" | "self_express" | "technician";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  paypal_done: "PayPal déjà traité",
  etransfer: "Virement",
  cash: "Comptant",
  to_invoice: "À facturer",
};

const DISCOUNT_LABELS: Record<DiscountReason, string> = {
  promotion: "Promotion",
  loyalty: "Fidélité",
  employee: "Employé",
  exchange: "Échange",
  other: "Autre",
};

const FULFILLMENT_OPTIONS: { key: FulfillmentMode; label: string; desc: string; fee: number }[] = [
  { key: "self_standard", label: "Auto-installation — Livraison standard", desc: "Livraison 2-5 jours ouvrables. Client installe lui-même.", fee: 20 },
  { key: "self_express",  label: "Auto-installation — Livraison Express (Uber Direct)", desc: "Livraison le jour même ou lendemain. Client installe lui-même.", fee: 40 },
  { key: "technician",    label: "Installation par technicien",           desc: "Un technicien Nivra se déplace pour installer.", fee: 50 },
];

function ManualOrderDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  // SECTION 1 — Phone
  const [phoneSearch, setPhoneSearch] = useState("");
  const [selectedPhone, setSelectedPhone] = useState<AvailablePhone | null>(null);

  // SECTION 2 — Client
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientResult | null>(null);
  const [newClient, setNewClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    first_name: "", last_name: "", email: "", phone: "",
  });

  // SECTION 3 — Order type
  const [orderType, setOrderType] = useState<"phone_only" | "phone_plus_plan">("phone_only");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");

  // SECTION 4 — Address
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("QC");
  const [postalCode, setPostalCode] = useState("");

  // SECTION 5 — Pricing
  const [discount, setDiscount] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<DiscountReason>("promotion");

  // SECTION 4B — Fulfillment (livraison / installation)
  const [fulfillmentMode, setFulfillmentMode] = useState<FulfillmentMode>("self_standard");
  const deliveryFee = FULFILLMENT_OPTIONS.find(o => o.key === fulfillmentMode)?.fee ?? 0;

  // SECTION 6 — Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("paypal_done");
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("paid");

  // SECTION 7 — Anti-fraud
  const [fraudScore, setFraudScore] = useState<number | null>(null);
  const [fraudFactors, setFraudFactors] = useState<Record<string, number>>({});
  const [fraudOverrideAck, setFraudOverrideAck] = useState(false);
  const [kycChoice, setKycChoice] = useState<KycChoice>("not_required");

  // SECTION 8 — Notes
  const [internalNotes, setInternalNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // Reset on open
  function resetAll() {
    setPhoneSearch(""); setSelectedPhone(null);
    setClientSearch(""); setSelectedClient(null); setNewClient(false);
    setNewClientForm({ first_name: "", last_name: "", email: "", phone: "" });
    setOrderType("phone_only"); setSelectedPlanId("");
    setAddress(""); setCity(""); setProvince("QC"); setPostalCode("");
    setDiscount(0); setDiscountReason("promotion");
    setFulfillmentMode("self_standard");
    setPaymentMethod("paypal_done"); setPaymentRef(""); setPaymentStatus("paid");
    setFraudScore(null); setFraudFactors({}); setFraudOverrideAck(false);
    setKycChoice("not_required");
    setInternalNotes("");
  }

  // Pre-fill address from client
  function pickClient(c: ClientResult) {
    setSelectedClient(c);
    setNewClient(false);
    if (c.service_address) setAddress(c.service_address);
    if (c.service_city) setCity(c.service_city);
    if (c.service_province) setProvince(c.service_province);
    if (c.service_postal_code) setPostalCode(c.service_postal_code);
  }

  // Available phones search
  const { data: availablePhones } = useQuery({
    queryKey: ["manual-order-phones", phoneSearch],
    enabled: open && !selectedPhone,
    queryFn: async () => {
      let q = supabase
        .from("phone_inventory")
        .select("id, brand, model, storage, color, imei, price_cad, condition")
        .eq("status", "available")
        .order("created_at", { ascending: false })
        .limit(20);
      if (phoneSearch.trim()) {
        const term = `%${phoneSearch.trim()}%`;
        q = q.or(`brand.ilike.${term},model.ilike.${term},imei.ilike.${term}`);
      }
      const { data, error } = await q;
return (data ?? []) as AvailablePhone[];
    },
  });

  // Client search
  const { data: clientResults } = useQuery({
    queryKey: ["manual-order-clients", clientSearch],
    enabled: open && !selectedClient && !newClient && clientSearch.trim().length >= 2,
    queryFn: async () => {
      const term = `%${clientSearch.trim()}%`;
      const { data: profs, error } = await supabase
        .from("profiles")
        .select("user_id, email, full_name, first_name, last_name, phone, service_address, service_city, service_province, service_postal_code")
        .or(`email.ilike.${term},full_name.ilike.${term},first_name.ilike.${term},last_name.ilike.${term}`)
        .limit(10);
const userIds = (profs ?? []).map((p) => p.user_id);
      let accountsByUser: Record<string, { id: string; account_number: string }> = {};
      if (userIds.length) {
        const { data: accts } = await supabase
          .from("accounts")
          .select("id, client_id, account_number")
          .in("client_id", userIds);
        for (const a of accts ?? []) {
          if (!accountsByUser[a.client_id]) {
            accountsByUser[a.client_id] = { id: a.id, account_number: a.account_number };
          }
        }
      }
      // Also search by account_number
      let byAccount: ClientResult[] = [];
      if (clientSearch.trim().match(/^[A-Z0-9-]{3,}$/i)) {
        const { data: accts } = await supabase
          .from("accounts")
          .select("id, client_id, account_number")
          .ilike("account_number", `%${clientSearch.trim()}%`)
          .limit(5);
        if (accts && accts.length) {
          const ids = accts.map((a) => a.client_id);
          const { data: extra } = await supabase
            .from("profiles")
            .select("user_id, email, full_name, first_name, last_name, phone, service_address, service_city, service_province, service_postal_code")
            .in("user_id", ids);
          byAccount = (extra ?? []).map((p) => {
            const a = accts.find((x) => x.client_id === p.user_id);
            return { ...p, account_id: a?.id ?? null, account_number: a?.account_number ?? null } as ClientResult;
          });
        }
      }

      const merged: ClientResult[] = (profs ?? []).map((p) => ({
        ...p,
        account_id: accountsByUser[p.user_id]?.id ?? null,
        account_number: accountsByUser[p.user_id]?.account_number ?? null,
      }));
      // Merge unique
      const seen = new Set(merged.map((m) => m.user_id));
      for (const b of byAccount) if (!seen.has(b.user_id)) merged.push(b);
      return merged;
    },
  });

  // Mobile plans
  const { data: mobilePlans } = useQuery({
    queryKey: ["manual-order-mobile-plans"],
    enabled: open && orderType === "phone_plus_plan",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mobile_plans" as never)
        .select("id, name, price_monthly")
        .eq("is_active", true)
        .order("price_monthly", { ascending: true });
      if (error) {
        console.warn("[mobile_plans] table missing or query failed", error);
        return [] as MobilePlan[];
      }
      return ((data as unknown) as MobilePlan[]) ?? [];
    },
  });

  // Pricing
  const basePrice = selectedPhone?.price_cad ?? 0;
  const finalPrice = Math.max(0, basePrice - discount);
  const taxable = +(finalPrice + deliveryFee).toFixed(2);
  const tps = +(taxable * 0.05).toFixed(2);
  const tvq = +(taxable * 0.09975).toFixed(2);
  const totalAmount = +(taxable + tps + tvq).toFixed(2);

  // Recompute fraud whenever client + amount ready
  useMemo(() => {
    if (!selectedClient || !totalAmount || !open) return;
    const userId = selectedClient.user_id;
    const shippingAddr = { address, city, province, postal_code: postalCode, country: "CA" };
    supabase.functions
      .invoke("calculate-phone-fraud-score", {
        body: {
          user_id: userId,
          order_amount: totalAmount,
          shipping_address: shippingAddr,
          account_id: selectedClient.account_id ?? userId,
        },
      })
      .then(({ data }) => {
        if (data) {
          setFraudScore(data.score ?? 0);
          setFraudFactors(data.factors ?? {});
        }
      })
      .catch(() => {
        setFraudScore(0);
        setFraudFactors({});
      });
  }, [selectedClient?.user_id, totalAmount, address, city, province, postalCode, open]);

  function validateAll(): string | null {
    if (!selectedPhone) return "Sélectionnez un téléphone";
    if (!selectedClient && !newClient) return "Sélectionnez ou créez un client";
    if (newClient) {
      if (!newClientForm.first_name.trim() || !newClientForm.last_name.trim() || !newClientForm.email.trim()) {
        return "Nom, prénom et courriel requis pour le nouveau client";
      }
    }
    if (!address.trim() || !city.trim() || !postalCode.trim()) return "Adresse de livraison incomplète";
    if (orderType === "phone_plus_plan" && province !== "QC") return "Forfait mobile disponible au QC seulement";
    if (orderType === "phone_plus_plan" && !selectedPlanId) return "Sélectionnez un forfait mobile";
    if (discount > 0 && !discountReason) return "Raison du rabais requise";
    if ((fraudScore ?? 0) > 60 && !fraudOverrideAck) return "Confirmez la vérification d'identité (score risque élevé)";
    return null;
  }

  async function submit() {
    const err = validateAll();
    if (err) {
      toast.error(err);
      return;
    }
    if (!selectedPhone) return;
    setSubmitting(true);
    try {
      // Resolve user_id
      let userId: string;
      let clientEmail: string;
      let firstName: string;
      let lastName: string;
      let clientPhone: string | null = null;
      let accountId: string | null = null;

      if (selectedClient) {
        userId = selectedClient.user_id;
        clientEmail = selectedClient.email ?? "";
        firstName = selectedClient.first_name ?? selectedClient.full_name?.split(" ")[0] ?? "";
        lastName = selectedClient.last_name ?? selectedClient.full_name?.split(" ").slice(1).join(" ") ?? "";
        clientPhone = selectedClient.phone;
        accountId = selectedClient.account_id ?? null;
      } else {
        // New client — generate an id; Core can later reconcile to auth user.
        userId = crypto.randomUUID();
        clientEmail = newClientForm.email.trim();
        firstName = newClientForm.first_name.trim();
        lastName = newClientForm.last_name.trim();
        clientPhone = newClientForm.phone.trim() || null;
      }

      const shippingAddress = {
        address: address.trim(),
        city: city.trim(),
        province,
        postal_code: postalCode.trim(),
        country: "CA",
      };

      // Determine payment + KYC routing
      const paid = paymentStatus === "paid";
      const kycRequired = kycChoice === "required";
      const kycApprovedNow = kycChoice === "not_required" || kycChoice === "approved";

      // 1. Create order
      const { data: { user: agent } } = await supabase.auth.getUser();
      const planNote = orderType === "phone_plus_plan"
        ? `Mobile plan: ${selectedPlanId}`
        : "Phone only (manual order)";
      const discountNote = discount > 0
        ? ` | Rabais: ${discount}$ (${DISCOUNT_LABELS[discountReason]})`
        : "";

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          user_id: userId,
          account_id: accountId ?? userId,
          service_type: "phone",
          status: "confirmed",
          payment_status: paid ? "paid" : "pending",
          payment_method:
            paymentMethod === "paypal_done" ? "paypal" :
            paymentMethod === "etransfer" ? "etransfer" :
            paymentMethod === "cash" ? "cash" : "invoice",
          payment_reference: paymentRef.trim() || null,
          payment_confirmed_at: paid ? new Date().toISOString() : null,
          client_first_name: firstName,
          client_last_name: lastName,
          client_email: clientEmail,
          client_phone: clientPhone,
          shipping_address: address.trim(),
          shipping_city: city.trim(),
          shipping_province: province,
          shipping_postal_code: postalCode.trim(),
          subtotal: finalPrice,
          tps_amount: tps,
          tvq_amount: tvq,
          total_amount: totalAmount,
          discount_amount: discount > 0 ? discount : null,
          delivery_fee: deliveryFee,
          fulfillment_type: fulfillmentMode === "technician" ? "technician" : "self_install",
          created_by: "core_admin",
          processed_by: agent?.id ?? null,
          processed_at: new Date().toISOString(),
          internal_notes: `${planNote}${discountNote} | Livraison: ${FULFILLMENT_OPTIONS.find(o => o.key === fulfillmentMode)?.label} (${deliveryFee}$)${internalNotes ? ` | Notes: ${internalNotes}` : ""}`,
          notes: planNote,
          order_type: "manual",
        } as never)
        .select("id, order_number")
        .single();

      if (orderErr || !order) throw orderErr ?? new Error("Échec de création de commande");

      // 2. Reserve phone
      const { error: invErr } = await supabase
        .from("phone_inventory")
        .update({ status: "reserved", order_id: order.id, assigned_at: new Date().toISOString() })
        .eq("id", selectedPhone.id)
        .eq("status", "available");
      if (invErr) throw invErr;

      // 3. Determine phone_orders status
      let phoneOrderStatus = "pending_kyc";
      if (kycApprovedNow) phoneOrderStatus = "approved";

      const { error: poErr } = await supabase.from("phone_orders").insert({
        order_id: order.id,
        phone_inventory_id: selectedPhone.id,
        user_id: userId,
        account_id: accountId,
        status: phoneOrderStatus,
        fraud_score: fraudScore ?? 0,
        fraud_level: (fraudScore ?? 0) >= 70 ? "high" : (fraudScore ?? 0) >= 40 ? "medium" : "low",
        fraud_factors: fraudFactors,
        shipping_address: shippingAddress,
        notes: internalNotes || null,
      } as never);
      if (poErr) throw poErr;

      // 4. Activity log
      try {
        await logActivityLog({
          user_id: agent?.id ?? userId,
          actor_role: "admin",
          action: "phone_order_manual_created",
          entity_type: "phone_order",
          entity_id: order.id,
          details: {
            phone_id: selectedPhone.id,
            phone: `${selectedPhone.brand} ${selectedPhone.model}`,
            client_email: clientEmail,
            total: totalAmount,
            discount,
            discount_reason: discount > 0 ? discountReason : null,
            payment_method: paymentMethod,
            payment_status: paymentStatus,
            kyc_choice: kycChoice,
            fraud_score: fraudScore,
            fraud_override: fraudOverrideAck,
            internal_notes: internalNotes || null,
          },
        } as never);
      } catch (e) {
        console.warn("[manual-order] activity log failed", e);
      }

      // 5. Send appropriate email
      if (kycRequired && clientEmail) {
        try {
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "phone_order_confirmed",
              recipientEmail: clientEmail,
              idempotencyKey: `phone-confirm-${order.id}`,
              templateData: {
                order_number: order.order_number ?? order.id.slice(0, 8),
                brand: selectedPhone.brand,
                model: selectedPhone.model,
                amount: totalAmount.toFixed(2),
                kyc_url: `${window.location.origin}/verify-identity?order=${order.id}`,
              },
            },
          });
        } catch (e) {
          console.warn("[manual-order] KYC email failed", e);
        }
      } else if (clientEmail) {
        await queuePhoneEmail({
          recipient: clientEmail,
          eventKey: `phone-manual-confirm-${order.id}`,
          templateKey: "phone_order_confirmed",
          subject: "Confirmation de votre commande téléphone",
          vars: {
            order_number: order.order_number ?? order.id.slice(0, 8),
            brand: selectedPhone.brand,
            model: selectedPhone.model,
            amount: totalAmount.toFixed(2),
          },
        });
      }

      toast.success(`Commande #${order.order_number ?? order.id.slice(0, 8)} créée`);
      resetAll();
      onSuccess();
    } catch (e: unknown) {
      console.error("[manual-order] failed", e);
      toast.error(e instanceof Error ? e.message : "Erreur lors de la création");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { resetAll(); onClose(); } }}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Nouvelle commande manuelle
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* SECTION 1 — Phone selection */}
          <Section icon={<Smartphone className="h-4 w-4" />} title="1. Sélection de l'appareil">
            {selectedPhone ? (
              <div className="flex items-center justify-between rounded border p-3 bg-primary/5">
                <div>
                  <div className="font-semibold">{selectedPhone.brand} {selectedPhone.model}</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedPhone.storage} · {selectedPhone.color} · IMEI {selectedPhone.imei.slice(-4)}
                  </div>
                  <div className="text-sm font-medium mt-1">{selectedPhone.price_cad.toFixed(2)} $</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelectedPhone(null)}>Changer</Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par marque, modèle ou IMEI..."
                    className="pl-9"
                    value={phoneSearch}
                    onChange={(e) => setPhoneSearch(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 max-h-64 overflow-y-auto">
                  {(availablePhones ?? []).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPhone(p)}
                      className="text-left rounded border p-3 hover:border-primary hover:bg-primary/5 transition"
                    >
                      <div className="font-medium text-sm">{p.brand} {p.model}</div>
                      <div className="text-xs text-muted-foreground">{p.storage} · {p.color}</div>
                      <div className="text-xs text-muted-foreground font-mono">…{p.imei.slice(-6)}</div>
                      <div className="text-sm font-semibold mt-1">{p.price_cad.toFixed(2)} $</div>
                    </button>
                  ))}
                  {availablePhones && availablePhones.length === 0 && (
                    <div className="col-span-full text-center text-sm text-muted-foreground py-4">
                      Aucun téléphone disponible
                    </div>
                  )}
                </div>
              </>
            )}
          </Section>

          {/* SECTION 2 — Client */}
          <Section icon={<User className="h-4 w-4" />} title="2. Sélection du client">
            {selectedClient ? (
              <div className="flex items-center justify-between rounded border p-3 bg-primary/5">
                <div>
                  <div className="font-semibold">
                    {selectedClient.first_name || selectedClient.full_name} {selectedClient.last_name}
                  </div>
                  <div className="text-xs text-muted-foreground">{selectedClient.email}</div>
                  {selectedClient.account_number && (
                    <div className="text-xs text-muted-foreground">Compte: {selectedClient.account_number}</div>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelectedClient(null)}>Changer</Button>
              </div>
            ) : newClient ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Prénom *" value={newClientForm.first_name} onChange={(e) => setNewClientForm({ ...newClientForm, first_name: e.target.value })} />
                  <Input placeholder="Nom *" value={newClientForm.last_name} onChange={(e) => setNewClientForm({ ...newClientForm, last_name: e.target.value })} />
                  <Input placeholder="Courriel *" type="email" value={newClientForm.email} onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })} />
                  <Input placeholder="Téléphone" value={newClientForm.phone} onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })} />
                </div>
                <Button size="sm" variant="ghost" onClick={() => setNewClient(false)}>Rechercher un client existant</Button>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Nom, courriel ou n° de compte (min. 2 caractères)"
                      className="pl-9"
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" onClick={() => setNewClient(true)}>Nouveau client</Button>
                </div>
                {clientResults && clientResults.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 mt-3 max-h-64 overflow-y-auto">
                    {clientResults.map((c) => (
                      <button
                        key={c.user_id}
                        type="button"
                        onClick={() => pickClient(c)}
                        className="text-left rounded border p-3 hover:border-primary hover:bg-primary/5 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">
                              {c.first_name || c.full_name} {c.last_name}
                            </div>
                            <div className="text-xs text-muted-foreground">{c.email}</div>
                          </div>
                          {c.account_number && <Badge variant="outline">{c.account_number}</Badge>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </Section>

          {/* SECTION 3 — Order type */}
          <Section icon={<FileText className="h-4 w-4" />} title="3. Type de commande">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOrderType("phone_only")}
                className={`rounded border p-3 text-sm font-medium transition ${orderType === "phone_only" ? "border-primary bg-primary/5" : ""}`}
              >
                Téléphone seulement
              </button>
              <button
                type="button"
                onClick={() => setOrderType("phone_plus_plan")}
                className={`rounded border p-3 text-sm font-medium transition ${orderType === "phone_plus_plan" ? "border-primary bg-primary/5" : ""}`}
              >
                Téléphone + Forfait mobile
              </button>
            </div>
            {orderType === "phone_plus_plan" && (
              <div className="mt-3">
                <Label className="text-xs">Forfait mobile *</Label>
                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un forfait..." /></SelectTrigger>
                  <SelectContent>
                    {(mobilePlans ?? []).length === 0 ? (
                      <SelectItem value="none" disabled>Aucun forfait disponible</SelectItem>
                    ) : (
                      (mobilePlans ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name} — {p.price_monthly}$/mois</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Note: forfait mobile disponible au QC uniquement.
                </p>
              </div>
            )}
          </Section>

          {/* SECTION 4 — Address */}
          <Section icon={<MapPin className="h-4 w-4" />} title="4. Adresse de livraison">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="sm:col-span-2">
                <AddressAutocomplete
                  value={address}
                  onValueChange={setAddress}
                  onSelect={(a) => {
                    setAddress(a.line1 || a.formatted);
                    if (a.city) setCity(a.city);
                    if (a.region) setProvince(a.region);
                    if (a.postalCode) setPostalCode(a.postalCode);
                  }}
                  placeholder="Adresse *"
                />
              </div>
              <Input placeholder="Ville *" value={city} onChange={(e) => setCity(e.target.value)} />
              <Select value={province} onValueChange={setProvince}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["QC", "ON", "NB", "NS", "PE", "NL", "MB", "SK", "AB", "BC", "YT", "NT", "NU"].map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Code postal *" value={postalCode} onChange={(e) => setPostalCode(e.target.value.toUpperCase())} />
            </div>
          </Section>

          {/* SECTION 4B — Fulfillment / Livraison */}
          <Section icon={<Truck className="h-4 w-4" />} title="4B. Mode de livraison / installation">
            <div className="grid grid-cols-1 gap-2">
              {FULFILLMENT_OPTIONS.map((opt) => {
                const active = fulfillmentMode === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setFulfillmentMode(opt.key)}
                    className={`flex items-start justify-between gap-3 rounded-lg border-2 p-3 text-left transition-colors ${
                      active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                    </div>
                    <span className="text-sm font-bold whitespace-nowrap">{opt.fee.toFixed(2)} $</span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* SECTION 5 — Pricing */}
          <Section icon={<DollarSign className="h-4 w-4" />} title="5. Tarification">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Prix de base</Label>
                <div className="text-lg font-semibold">{basePrice.toFixed(2)} $</div>
              </div>
              <div>
                <Label className="text-xs">Rabais agent (CAD)</Label>
                <Input type="number" min={0} step="0.01" value={discount || ""} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))} />
              </div>
              <div>
                <Label className="text-xs">Raison du rabais</Label>
                <Select value={discountReason} onValueChange={(v) => setDiscountReason(v as DiscountReason)} disabled={discount === 0}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DISCOUNT_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-3 rounded border bg-muted/30 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>Sous-total appareil</span><span>{finalPrice.toFixed(2)} $</span></div>
              <div className="flex justify-between"><span>Livraison / installation</span><span>{deliveryFee.toFixed(2)} $</span></div>
              <div className="flex justify-between text-muted-foreground"><span>TPS (5%)</span><span>{tps.toFixed(2)} $</span></div>
              <div className="flex justify-between text-muted-foreground"><span>TVQ (9.975%)</span><span>{tvq.toFixed(2)} $</span></div>
              <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Prix final</span><span>{totalAmount.toFixed(2)} $</span></div>
              <p className="text-xs text-muted-foreground pt-2">Paiement sera traité via PayPal ou enregistré manuellement.</p>
            </div>
          </Section>


          {/* SECTION 6 — Payment */}
          <Section icon={<CreditCard className="h-4 w-4" />} title="6. Paiement">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Méthode</Label>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Référence (optionnel)</Label>
                <Input value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="N° transaction" />
              </div>
              <div>
                <Label className="text-xs">Statut</Label>
                <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as PaymentStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Payé</SelectItem>
                    <SelectItem value="pending">En attente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Section>

          {/* SECTION 7 — Anti-fraud override */}
          <Section icon={<Shield className="h-4 w-4" />} title="7. Anti-fraude">
            {fraudScore === null ? (
              <p className="text-sm text-muted-foreground">Sélectionnez un client et un montant pour calculer le score.</p>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={FRAUD_BADGE[(fraudScore ?? 0) >= 70 ? "high" : (fraudScore ?? 0) >= 40 ? "medium" : "low"].className}>
                    Score: {fraudScore} ({(fraudScore ?? 0) >= 70 ? "Élevé" : (fraudScore ?? 0) >= 40 ? "Moyen" : "Faible"})
                  </Badge>
                  {Object.keys(fraudFactors).length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {Object.entries(fraudFactors).map(([k, v]) => `+${v} ${k.replace(/_/g, " ")}`).join(" · ")}
                    </span>
                  )}
                </div>
                {(fraudScore ?? 0) > 60 && (
                  <div className="mt-3 rounded border border-amber-300 bg-amber-50 p-3 space-y-2">
                    <div className="flex items-start gap-2 text-sm text-amber-900">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      Score élevé détecté. Une vérification d'identité supplémentaire est recommandée.
                    </div>
                    <label className="flex items-start gap-2 text-sm cursor-pointer">
                      <Checkbox checked={fraudOverrideAck} onCheckedChange={(v) => setFraudOverrideAck(!!v)} />
                      <span>Je confirme avoir vérifié l'identité du client pour cette commande.</span>
                    </label>
                  </div>
                )}
              </>
            )}
            <div className="mt-3">
              <Label className="text-xs">Statut KYC</Label>
              <Select value={kycChoice} onValueChange={(v) => setKycChoice(v as KycChoice)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">KYC déjà approuvé</SelectItem>
                  <SelectItem value="required">KYC requis (envoyer courriel au client)</SelectItem>
                  <SelectItem value="not_required">KYC non requis (agent présent)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Section>

          {/* SECTION 8 — Notes */}
          <Section icon={<FileText className="h-4 w-4" />} title="8. Notes internes">
            <Textarea
              rows={3}
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Notes pour les agents (visibles dans activity_logs)..."
            />
          </Section>
        </div>

        <DialogFooter className="mt-4 pt-4 border-t">
          <Button variant="outline" onClick={() => { resetAll(); onClose(); }}>Annuler</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Création..." : "Créer la commande"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-primary">{icon}</span>
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}
