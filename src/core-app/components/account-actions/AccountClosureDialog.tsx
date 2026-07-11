/**
 * AccountClosureDialog — Files a service_cancellation_requests row for EACH
 * active subscription on the account, sets accounts.status = 'pending_closure',
 * and queues the account_closure_requested email.
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
import { Checkbox } from "@/components/ui/checkbox";
import { differenceInCalendarDays, format } from "date-fns";
import { Loader2 } from "lucide-react";

type RefundMode = "none" | "full" | "partial" | "credit";

interface Subscription {
  id: string;
  plan_name: string;
  plan_price: number;
  service_category: string | null;
  cycle_end_date: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientUserId: string;
  clientEmail: string | null;
  clientName: string;
  accountId: string | null;
  subscriptions: Subscription[];
}

export function AccountClosureDialog({
  open, onOpenChange, clientUserId, clientEmail, clientName, accountId, subscriptions,
}: Props) {
  const navigate = useNavigate();
  const [reasonText, setReasonText] = useState("");
  const [refundMode, setRefundMode] = useState<RefundMode>("none");
  const [partialAmount, setPartialAmount] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Auto-calculated full refund across ALL active subscriptions
  const computedFullRefund = useMemo(() => {
    return subscriptions.reduce((sum, s) => {
      if (!s.cycle_end_date) return sum;
      const days = Math.max(0, differenceInCalendarDays(new Date(s.cycle_end_date), new Date()));
      return sum + (days / 30) * Number(s.plan_price || 0);
    }, 0);
  }, [subscriptions]);

  const refundAmount = useMemo(() => {
    if (refundMode === "full") return Math.round(computedFullRefund * 100) / 100;
    if (refundMode === "partial") return Math.max(0, Number(partialAmount) || 0);
    if (refundMode === "credit") return Math.max(0, Number(partialAmount) || computedFullRefund);
    return 0;
  }, [refundMode, computedFullRefund, partialAmount]);

  const reset = () => {
    setReasonText("");
    setRefundMode("none");
    setPartialAmount("");
    setConfirm(false);
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    if (!confirm) {
      toast.error("Vous devez confirmer la fermeture du compte");
      return;
    }
    if (subscriptions.length === 0) {
      toast.error("Aucun abonnement actif à résilier");
      return;
    }
    setSubmitting(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const allowed = ["mobile", "internet", "tv", "security", "streaming", "bundle"];

      // 1) One service_cancellation_requests row per active subscription
      const rows = subscriptions.map((s) => {
        const svc = (s.service_category ?? "internet").toLowerCase();
        return {
          user_id: clientUserId,
          account_id: accountId,
          service_type: (allowed.includes(svc) ? svc : "internet") as any,
          service_identifier: s.id,
          reason_code: "not_needed" as any,
          reason_details: reasonText || "Fermeture de compte demandée",
          requested_effective_date: today,
          status: "requested" as any,
          created_by_role: "admin",
          staff_notes: JSON.stringify({
            closure: true,
            refund_mode: refundMode,
            refund_amount_total: refundAmount,
            refund_amount_per_sub: rows_count_safe(refundAmount, subscriptions.length),
            admin_notes: reasonText || null,
          }),
        };
      });

      const { error: insErr } = await supabase
        .from("service_cancellation_requests")
        .insert(rows as any);
      if (insErr) throw insErr;

      // 2) Mark account as pending_closure
      if (accountId) {
        const { error: acctErr } = await supabase
          .from("accounts")
          .update({ status: "pending_closure", updated_at: new Date().toISOString() } as any)
          .eq("id", accountId);
        if (acctErr) console.warn("[AccountClosureDialog] account update warning:", acctErr);
      }

      // 3) Queue closure-requested email
      if (clientEmail) {
        await supabase.from("email_queue").insert({
          event_key: `account-closure-requested:${accountId ?? clientEmail}`,
          to_email: clientEmail,
          template_key: "account_closure_requested",
          variables: {
            client_name: clientName,
            reason: reasonText || "Demande du client",
            refund_amount: refundAmount,
            refund_mode: refundMode,
            subscriptions_count: subscriptions.length,
          },
          status: "pending",
        } as any);
      }

      toast.success("Demande de fermeture de compte créée");
      reset();
      onOpenChange(false);
      navigate(corePath("/cancellations"));
    } catch (e: any) {
      console.error("[AccountClosureDialog] failed:", e);
      toast.error(e?.message ?? "Échec de la fermeture");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Fermer le compte</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-xs text-muted-foreground bg-amber-500/10 border border-amber-500/30 rounded p-2">
            {subscriptions.length} abonnement(s) actif(s) seront résiliés. Le compte passera en
            <strong> pending_closure</strong> en attendant l'approbation dans la file Résiliations.
          </div>

          <div className="space-y-2">
            <Label>Raison de fermeture</Label>
            <Textarea value={reasonText} onChange={(e) => setReasonText(e.target.value)} rows={3}
              placeholder="Pourquoi le compte est-il fermé ?" />
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
                  <Input type="number" step="0.01" min="0" value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)} className="h-7 w-28 ml-2" placeholder="0.00" />
                )}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={refundMode === "credit"} onChange={() => setRefundMode("credit")} />
                Crédit sur prochain compte
              </label>
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={confirm} onCheckedChange={(v) => setConfirm(!!v)} className="mt-0.5" />
            <span>Je confirme vouloir fermer ce compte</span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={submitting || !confirm} variant="destructive">
            {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Fermer le compte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function rows_count_safe(total: number, n: number): number {
  if (!n) return 0;
  return Math.round((total / n) * 100) / 100;
}
