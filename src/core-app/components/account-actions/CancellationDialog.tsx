/**
 * CancellationDialog — Core admin tool to file a service cancellation request
 * for a single billing_subscription. Inserts a row in service_cancellation_requests;
 * the actual cancellation/refund execution happens when an admin approves
 * the request from CoreCancellationsPage.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { corePath } from "@/core-app/lib/corePaths";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { differenceInCalendarDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { Loader2 } from "lucide-react";

// UI label → DB enum (cancellation_reason_code: price | moving | not_needed | service_issue | billing_issue | other)
const REASONS: Array<{ label: string; value: string }> = [
  { label: "Demande du client", value: "not_needed" },
  { label: "Non-paiement", value: "billing_issue" },
  { label: "Déménagement", value: "moving" },
  { label: "Insatisfaction", value: "service_issue" },
  { label: "Autre", value: "other" },
];

type RefundMode = "none" | "full" | "partial" | "credit";

interface Subscription {
  id: string;
  plan_name: string;
  plan_price: number;
  service_category: string | null;
  cycle_end_date: string | null;
  cycle_start_date: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientUserId: string;
  accountId: string | null;
  subscriptions: Subscription[];
}

export function CancellationDialog({ open, onOpenChange, clientUserId, accountId, subscriptions }: Props) {
  const navigate = useNavigate();
  const [subscriptionId, setSubscriptionId] = useState<string>("");
  const [reason, setReason] = useState<string>("not_needed");
  const [effectiveMode, setEffectiveMode] = useState<"end_of_cycle" | "immediate">("end_of_cycle");
  const [refundMode, setRefundMode] = useState<RefundMode>("none");
  const [partialAmount, setPartialAmount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const sub = useMemo(
    () => subscriptions.find((s) => s.id === subscriptionId) ?? null,
    [subscriptions, subscriptionId],
  );

  // Auto-calculated full refund: days remaining / 30 * plan_price
  const computedFullRefund = useMemo(() => {
    if (!sub?.cycle_end_date) return 0;
    const days = Math.max(0, differenceInCalendarDays(new Date(sub.cycle_end_date), new Date()));
    return Math.round((days / 30) * Number(sub.plan_price || 0) * 100) / 100;
  }, [sub]);

  const refundAmount = useMemo(() => {
    if (refundMode === "full") return computedFullRefund;
    if (refundMode === "partial") return Math.max(0, Number(partialAmount) || 0);
    if (refundMode === "credit") return Math.max(0, Number(partialAmount) || computedFullRefund);
    return 0;
  }, [refundMode, computedFullRefund, partialAmount]);

  const reset = () => {
    setSubscriptionId("");
    setReason("not_needed");
    setEffectiveMode("end_of_cycle");
    setRefundMode("none");
    setPartialAmount("");
    setNotes("");
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    if (!sub) {
      toast.error("Sélectionnez un abonnement à annuler");
      return;
    }
    setSubmitting(true);
    try {
      const effectiveDate =
        effectiveMode === "immediate"
          ? format(new Date(), "yyyy-MM-dd")
          : sub.cycle_end_date ?? format(new Date(), "yyyy-MM-dd");

      // Refund metadata is persisted in staff_notes as JSON so the approve
      // flow in CoreCancellationsPage can parse it and trigger paypal-refund.
      const staffNotesPayload = JSON.stringify({
        refund_mode: refundMode,
        refund_amount: refundAmount,
        effective_mode: effectiveMode,
        admin_notes: notes || null,
      });

      const serviceType = (sub.service_category ?? "internet").toLowerCase();
      const allowed = ["mobile", "internet", "tv", "security", "streaming", "bundle"];
      const finalServiceType = allowed.includes(serviceType) ? serviceType : "internet";

      const { error } = await supabase
        .from("service_cancellation_requests")
        .insert({
          user_id: clientUserId,
          account_id: accountId,
          service_type: finalServiceType as any,
          service_identifier: sub.id,
          reason_code: reason as any,
          reason_details: notes || null,
          requested_effective_date: effectiveDate,
          status: "requested" as any,
          created_by_role: "admin",
          staff_notes: staffNotesPayload,
        } as any);
      if (error) throw error;

      toast.success("Demande de résiliation créée");
      reset();
      onOpenChange(false);
      navigate(corePath("/cancellations"));
    } catch (e: any) {
      console.error("[CancellationDialog] insert failed:", e);
      toast.error(e?.message ?? "Échec de la création");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Résilier un service</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Service à annuler</Label>
            <Select value={subscriptionId} onValueChange={setSubscriptionId}>
              <SelectTrigger><SelectValue placeholder="Choisir un abonnement actif…" /></SelectTrigger>
              <SelectContent>
                {subscriptions.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Aucun abonnement actif</div>
                )}
                {subscriptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.plan_name} — {Number(s.plan_price).toFixed(2)} $/mois
                    {s.cycle_end_date ? ` · fin ${format(new Date(s.cycle_end_date), "d MMM yyyy", { locale: fr })}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Raison</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Date effective</Label>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={effectiveMode === "end_of_cycle"} onChange={() => setEffectiveMode("end_of_cycle")} />
                Fin du cycle actuel
                {sub?.cycle_end_date && (
                  <span className="text-xs text-muted-foreground">
                    ({format(new Date(sub.cycle_end_date), "d MMM yyyy", { locale: fr })})
                  </span>
                )}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={effectiveMode === "immediate"} onChange={() => setEffectiveMode("immediate")} />
                Immédiatement
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Remboursement</Label>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={refundMode === "none"} onChange={() => setRefundMode("none")} />
                Aucun remboursement
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={refundMode === "full"} onChange={() => setRefundMode("full")} />
                Remboursement complet (auto: {computedFullRefund.toFixed(2)} $)
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={refundMode === "partial"} onChange={() => setRefundMode("partial")} />
                Remboursement partiel
                {refundMode === "partial" && (
                  <Input
                    type="number" step="0.01" min="0"
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder="0.00"
                    className="h-7 w-28 ml-2"
                  />
                )}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={refundMode === "credit"} onChange={() => setRefundMode("credit")} />
                Crédit sur prochain compte
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes internes (optionnel)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Contexte interne…" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={submitting || !sub}>
            {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Créer la demande
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
