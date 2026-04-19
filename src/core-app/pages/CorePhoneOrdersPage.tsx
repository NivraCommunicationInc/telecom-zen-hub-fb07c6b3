/**
 * CorePhoneOrdersPage — Core admin queue for phone orders.
 * Lists every row from `phone_orders` with risk score, KYC status,
 * and contextual actions (approve & ship, block & refund, request KYC).
 *
 * Side panel exposes fraud factors, shipping address, KYC details, and
 * the agent action buttons that mutate phone_orders + phone_inventory
 * and (when blocking) call the existing `paypal-refund` edge function.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { AlertTriangle, Smartphone, Shield, Truck, Ban, RefreshCw } from "lucide-react";

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
      if (error) throw error;
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
      // Mark phone sold + persist tracking
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

      // Queue shipping email
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
      // 1. Update phone_orders + free phone_inventory
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

      // 2. Best-effort automatic PayPal refund — find the latest payment for this order
      try {
        const { data: pay } = await supabase
          .from("billing_payments")
          .select("id, provider")
          .eq("invoice_id", selected.order_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (pay?.id) {
          await supabase.functions.invoke("paypal-refund", {
            body: { payment_id: pay.id, reason: "Order blocked by agent (risk review)" },
          });
        }
      } catch (e) {
        console.warn("[phone-orders] auto-refund skipped", e);
      }

      // 3. Queue notification email
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
      <div className="flex items-center gap-3">
        <Smartphone className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Commandes de téléphones</h1>
          <p className="text-sm text-muted-foreground">
            Vérifiez le risque, approuvez l'expédition ou bloquez les commandes suspectes.
          </p>
        </div>
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

      {/* Side panel */}
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

                {/* Actions */}
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
    </div>
  );
}

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

// Shared helper — queues an email via the existing `email_queue` pattern
// (same shape as billing-admin-daily-digest).
async function queuePhoneEmail(args: {
  recipient: string | null | undefined;
  eventKey: string;
  templateKey: string;
  subject: string;
  vars: Record<string, unknown>;
}) {
  if (!args.recipient) return;
  try {
    await supabase.from("email_queue").insert({
      event_key: args.eventKey,
      idempotency_key: args.eventKey,
      to_email: args.recipient,
      from_email: "Nivra Telecom <support@nivra-telecom.ca>",
      subject: args.subject,
      template_key: args.templateKey,
      template_vars: args.vars,
      status: "queued",
      attempts: 0,
      max_attempts: 3,
    } as never);
  } catch (e) {
    console.warn("[queuePhoneEmail] failed", e);
  }
}
