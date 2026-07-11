/**
 * PlanChangeRequests — Core admin panel for client plan-change requests.
 * Lists pending requests for a client and lets admins approve/reject.
 * On approve: updates billing_subscriptions (if effective_date <= now() or
 * admin explicitly opts in), issues prorated credit on downgrades, marks
 * request approved, enqueues bilingual confirmation email. Warns admin
 * when the subscription is on PayPal so they update PayPal manually.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Check, X, ArrowRight, AlertTriangle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { addClientAutoNote } from "@/core-app/lib/clientAutoNotes";

import { enqueueCommunication } from "@/lib/enqueueCommunication";
interface PlanChangeRequestsProps {
  clientId: string;
  accountId?: string;
}

type Row = {
  id: string;
  account_id: string;
  client_id: string;
  subscription_id: string | null;
  current_plan_name: string | null;
  requested_plan_id: string | null;
  requested_plan_name: string;
  change_type: string;
  status: string;
  effective_date: string | null;
  created_at: string;
};

type SubMeta = {
  next_renewal_at: string | null;
  paypal_subscription_id: string | null;
  plan_price: number | null;
  cycle_end_date: string | null;
};

export default function PlanChangeRequests({ clientId }: PlanChangeRequestsProps) {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [applyNow, setApplyNow] = useState<Record<string, boolean>>({});

  const { data: requests, isLoading } = useQuery({
    queryKey: ["plan-change-requests", clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("service_change_requests")
        .select("id, account_id, client_id, subscription_id, current_plan_name, requested_plan_id, requested_plan_name, change_type, status, effective_date, created_at")
        .eq("client_id", clientId)
        .in("status", ["pending", "approved", "rejected"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Row[]) || [];
    },
  });

  // Fetch metadata (paypal id, current price, renewal) for each subscription
  const subIds = (requests || []).map((r) => r.subscription_id).filter(Boolean) as string[];
  const { data: subMeta } = useQuery({
    queryKey: ["plan-change-sub-meta", subIds.sort().join(",")],
    enabled: subIds.length > 0,
    queryFn: async (): Promise<Record<string, SubMeta>> => {
      const { data, error } = await supabase
        .from("billing_subscriptions")
        .select("id, next_renewal_at, paypal_subscription_id, plan_price, cycle_end_date")
        .in("id", subIds);
      if (error) throw error;
      const map: Record<string, SubMeta> = {};
      (data || []).forEach((s: any) => {
        map[s.id] = {
          next_renewal_at: s.next_renewal_at,
          paypal_subscription_id: s.paypal_subscription_id,
          plan_price: s.plan_price,
          cycle_end_date: s.cycle_end_date ?? null,
        };
      });
      return map;
    },
  });

  const handleApprove = async (req: Row) => {
    setBusyId(req.id);
    try {
      // Resolve new plan price
      let newPrice: number | null = null;
      if (req.requested_plan_id) {
        const { data: svc } = await supabase
          .from("services")
          .select("price")
          .eq("id", req.requested_plan_id)
          .maybeSingle();
        newPrice = (svc?.price as number) ?? null;
      }

      const meta = req.subscription_id ? subMeta?.[req.subscription_id] : undefined;
      const currentPrice = meta?.plan_price ?? null;
      const effDate = req.effective_date ? new Date(req.effective_date) : null;
      const now = new Date();
      const isDue = effDate ? effDate.getTime() <= now.getTime() : true;
      const force = !!applyNow[req.id];

      // Apply subscription update only if effective_date elapsed OR admin forced
      if (req.subscription_id && (isDue || force)) {
        const update: any = { plan_name: req.requested_plan_name };
        if (newPrice !== null) update.plan_price = newPrice;
        const { error: subErr } = await supabase
          .from("billing_subscriptions")
          .update(update)
          .eq("id", req.subscription_id);
        if (subErr) throw subErr;
      }

      // Downgrade prorated credit (only when applied immediately on an active cycle)
      if (
        force &&
        currentPrice !== null &&
        newPrice !== null &&
        newPrice < currentPrice &&
        effDate
      ) {
        const daysInCycle = 30;
        // Renewal is in the future; compute remaining days from now until renewal
        const msRemaining = effDate.getTime() - now.getTime();
        const daysRemaining = Math.max(
          0,
          Math.min(daysInCycle, Math.floor(msRemaining / (1000 * 60 * 60 * 24))),
        );
        const priceDiff = currentPrice - newPrice;
        const proratedCredit = Number(((priceDiff / daysInCycle) * daysRemaining).toFixed(2));
        if (proratedCredit > 0) {
          const { error: adjErr } = await supabase.from("account_adjustments").insert({
            account_id: req.account_id,
            type: "credit",
            amount: proratedCredit,
            description: `Crédit prorata — changement de forfait ${req.current_plan_name || "—"} → ${req.requested_plan_name}`,
            months_total: 1,
            months_remaining: 1,
            status: "active",
          });
          if (adjErr) console.warn("[PlanChangeRequests] credit insert failed", adjErr);
        }
      }

      // Mark request approved
      const { error: updErr } = await supabase
        .from("service_change_requests")
        .update({ status: "approved", approved_at: new Date().toISOString() })
        .eq("id", req.id);
      if (updErr) throw updErr;

      // Fetch client email
      const { data: client } = await supabase
        .from("profiles")
        .select("email, first_name")
        .eq("user_id", req.client_id)
        .maybeSingle();

      // ─── Upgrade proration invoice ─────────────────────────────────────
      // When an upgrade is applied immediately, charge the prorated difference
      // for the remaining days of the current billing cycle.
      if ((isDue || force) && req.subscription_id && newPrice !== null && currentPrice !== null && newPrice > currentPrice) {
        try {
          const priceDiff = newPrice - currentPrice;
          const cycleEndDate = meta?.cycle_end_date ? new Date(meta.cycle_end_date) : null;
          if (cycleEndDate && priceDiff > 0) {
            const daysRemaining = Math.max(1, Math.ceil(
              (cycleEndDate.getTime() - new Date().getTime()) / 86_400_000
            ));
            const subtotal = Math.round(priceDiff * (daysRemaining / 30) * 100) / 100;
            if (subtotal >= 0.01) {
              const tps = Math.round(subtotal * 0.05 * 100) / 100;
              const tvq = Math.round(subtotal * 0.09975 * 100) / 100;
              const total = Math.round((subtotal + tps + tvq) * 100) / 100;
              const { data: invNum } = await supabase.rpc("generate_billing_invoice_number");
              const invoiceNumber = (invNum as string | null) || `INV-PRO-${Date.now()}`;
              const { data: bc } = await supabase
                .from("billing_customers").select("id").eq("user_id", req.client_id).maybeSingle();
              if (bc?.id) {
                const today = new Date().toISOString().split("T")[0];
                const { data: invoice } = await supabase
                  .from("billing_invoices")
                  .insert({
                    subscription_id: req.subscription_id,
                    customer_id: bc.id,
                    invoice_number: invoiceNumber,
                    type: "adjustment",
                    subtotal,
                    tps_amount: tps,
                    tvq_amount: tvq,
                    total,
                    balance_due: total,
                    currency: "CAD",
                    payment_method: meta?.paypal_subscription_id ? "paypal" : "interac",
                    status: "pending",
                    cycle_start_date: today,
                    cycle_end_date: meta?.cycle_end_date,
                    due_date: today,
                    notes: `Ajustement proratisé — ${req.current_plan_name || "—"} → ${req.requested_plan_name} (${daysRemaining} jours restants)`,
                  })
                  .select().single();
                if (invoice?.id) {
                  await supabase.from("billing_invoice_lines").insert({
                    invoice_id: invoice.id,
                    description: `Différence proratisée — ${req.current_plan_name || "ancien forfait"} → ${req.requested_plan_name} (${daysRemaining}/30 jours)`,
                    unit_price: subtotal,
                    quantity: 1,
                    line_total: subtotal,
                    line_type: "service",
                  });
                  if (client?.email) {
                    await enqueueCommunication({
                      channel: "email",
                      templateKey: "invoice_created",
                      recipient: client.email,
                      idempotencyKey: `proration_invoice_${invoice.id}`,
                      templateVars: {
                        client_name: client.first_name || client.email,
                        invoice_number: invoiceNumber,
                        plan_name: req.requested_plan_name,
                        total: total.toFixed(2),
                        amount: total.toFixed(2),
                        due_date: today,
                      },
                    });
                  }
                  console.log(`[PlanChangeRequests] Proration invoice ${invoiceNumber} created: ${subtotal.toFixed(2)}$ (${daysRemaining} days, delta ${priceDiff}$)`);
                }
              }
            }
          }
        } catch (proErr) {
          console.error("[PlanChangeRequests] proration invoice error:", proErr);
        }
      }

      const effectiveDateLabel = effDate
        ? format(effDate, "d MMMM yyyy", { locale: fr })
        : "votre prochain renouvellement";

      if (client?.email) {
        await enqueueCommunication({
          channel: "email",
          templateKey: "plan_change_approved",
          recipient: client.email,
          idempotencyKey: "plan_change_approved",
          templateVars: {
            client_name: client.first_name || client.email,
            current_plan_name: req.current_plan_name || "—",
            requested_plan_name: req.requested_plan_name,
            effective_date: effectiveDateLabel,
          },
        });
      }

      addClientAutoNote({
        clientId,
        event: "plan_changed",
        detail: `${req.current_plan_name || "—"} → ${req.requested_plan_name}`,
      });
      toast.success(
        meta?.paypal_subscription_id
          ? "Approuvé — n'oubliez pas de mettre à jour PayPal manuellement"
          : "Changement de forfait approuvé",
      );
      qc.invalidateQueries({ queryKey: ["plan-change-requests", clientId] });
    } catch (e: any) {
      console.error("[PlanChangeRequests.approve]", e);
      toast.error(e?.message || "Erreur lors de l'approbation");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (req: Row) => {
    setBusyId(req.id);
    try {
      const { error } = await supabase
        .from("service_change_requests")
        .update({ status: "rejected", approved_at: new Date().toISOString() })
        .eq("id", req.id);
      if (error) throw error;
      toast.success("Demande rejetée");
      qc.invalidateQueries({ queryKey: ["plan-change-requests", clientId] });
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!requests || requests.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Demandes de changement de forfait</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.map((r) => {
          const meta = r.subscription_id ? subMeta?.[r.subscription_id] : undefined;
          const onPayPal = !!meta?.paypal_subscription_id;
          const effLabel = r.effective_date
            ? format(new Date(r.effective_date), "d MMM yyyy", { locale: fr })
            : "—";
          return (
            <div
              key={r.id}
              className="flex flex-col gap-3 p-3 border border-border rounded-lg"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{r.current_plan_name || "—"}</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{r.requested_plan_name}</span>
                    <Badge
                      variant={
                        r.status === "pending"
                          ? "secondary"
                          : r.status === "approved"
                            ? "default"
                            : "destructive"
                      }
                    >
                      {r.status}
                    </Badge>
                    <Badge variant="outline">{r.change_type}</Badge>
                    {onPayPal && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> PayPal — MAJ manuelle requise
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Demandé le {format(new Date(r.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                    {" · "}Effectif le <span className="font-medium">{effLabel}</span>
                  </div>
                </div>
                {r.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(r)}
                      disabled={busyId === r.id}
                      className="flex items-center gap-1"
                    >
                      {busyId === r.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Approuver
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(r)}
                      disabled={busyId === r.id}
                      className="flex items-center gap-1"
                    >
                      <X className="w-4 h-4" />
                      Rejeter
                    </Button>
                  </div>
                )}
              </div>
              {r.status === "pending" && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground select-none">
                  <Checkbox
                    checked={!!applyNow[r.id]}
                    onCheckedChange={(v) =>
                      setApplyNow((s) => ({ ...s, [r.id]: !!v }))
                    }
                  />
                  Appliquer immédiatement (au lieu d'attendre le {effLabel}).
                  Un crédit prorata sera émis automatiquement en cas de downgrade.
                </label>
              )}
              {onPayPal && r.status === "pending" && (
                <div className="flex items-start gap-2 p-2 bg-destructive/10 border border-destructive/30 rounded text-xs text-destructive">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    ⚠️ Client sur PayPal — Mettre à jour manuellement dans PayPal après approbation
                    (l'abonnement récurrent PayPal ne sera pas synchronisé automatiquement).
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
