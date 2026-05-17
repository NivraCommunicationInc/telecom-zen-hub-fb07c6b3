/**
 * ReactivateAccountDialog — Reactivates a suspended or cancelled account.
 * Optionally also reactivates suspended services (and cancelled services if checked).
 */
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PlayCircle } from "lucide-react";

interface Props {
  accountId: string | undefined;
  customerId?: string;
  accountStatus: string | null;
  subscriptions?: any[];
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function ReactivateAccountDialog({ accountId, customerId, accountStatus, subscriptions = [], open, onClose, onRefresh }: Props) {
  const suspendedSubs = useMemo(() => subscriptions.filter((s: any) => s?.status === "suspended"), [subscriptions]);
  const cancelledSubs = useMemo(() => subscriptions.filter((s: any) => s?.status === "cancelled"), [subscriptions]);

  const [resumeSuspended, setResumeSuspended] = useState(true);
  const [reactivateCancelled, setReactivateCancelled] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase.from("accounts").update({
        status: "active",
        reactivated_at: nowIso,
        cancelled_at: null,
        cancellation_reason: null,
        updated_at: nowIso,
      }).eq("id", accountId);
      if (error) throw error;

      const idsToActivate: string[] = [];
      if (resumeSuspended) idsToActivate.push(...suspendedSubs.map((s: any) => s.id));
      if (reactivateCancelled) idsToActivate.push(...cancelledSubs.map((s: any) => s.id));

      if (idsToActivate.length > 0) {
        const { error: subErr } = await supabase
          .from("billing_subscriptions")
          .update({ status: "active", updated_at: nowIso })
          .in("id", idsToActivate);
        if (subErr) throw subErr;

        if (customerId) {
          await supabase.from("billing_subscription_trace_audit").insert(
            idsToActivate.map((id) => ({
              subscription_id: id,
              customer_id: customerId,
              action: "service_resumed",
              reason: reason || "Réactivation compte",
              details: { source: "account_360_reactivate" },
            })),
          );
        }
      }

      toast.success(
        idsToActivate.length > 0
          ? `Compte réactivé + ${idsToActivate.length} service(s) réactivé(s)`
          : "Compte réactivé",
      );
      onRefresh();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la réactivation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <PlayCircle className="h-4 w-4 text-emerald-400" />
            Réactiver le compte
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-[12px] text-core-text-secondary">
          <p>
            Le statut du compte passera de <strong className="text-amber-400">{accountStatus || "—"}</strong> à{" "}
            <strong className="text-emerald-400">actif</strong>.
          </p>

          {suspendedSubs.length > 0 && (
            <label className="flex items-start gap-2 rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] p-2.5 cursor-pointer">
              <input type="checkbox" checked={resumeSuspended} onChange={(e) => setResumeSuspended(e.target.checked)} className="mt-0.5" />
              <span>
                Reprendre <strong className="text-emerald-400">{suspendedSubs.length}</strong> service(s) suspendu(s)
              </span>
            </label>
          )}

          {cancelledSubs.length > 0 && (
            <label className="flex items-start gap-2 rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] p-2.5 cursor-pointer">
              <input type="checkbox" checked={reactivateCancelled} onChange={(e) => setReactivateCancelled(e.target.checked)} className="mt-0.5" />
              <span>
                Réactiver <strong className="text-amber-400">{cancelledSubs.length}</strong> service(s) annulé(s)
              </span>
            </label>
          )}

          {suspendedSubs.length === 0 && cancelledSubs.length === 0 && (
            <p className="text-[11px] text-core-text-label italic">Aucun service à réactiver.</p>
          )}

          <div>
            <label className="text-[10px] uppercase tracking-wider text-core-text-label block mb-1">Raison (optionnel)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Client a régularisé son solde"
              className="w-full rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] px-2.5 py-1.5 text-[11px] text-white placeholder:text-[hsl(220,10%,30%)] outline-none focus:border-emerald-500/50"
            />
          </div>
        </div>

        <DialogFooter>
          <button onClick={onClose} disabled={loading} className="rounded-md border border-[hsl(220,15%,16%)] px-4 py-1.5 text-[11px] font-medium text-[hsl(220,10%,50%)] hover:text-white">
            Annuler
          </button>
          <button onClick={handleSubmit} disabled={loading} className="rounded-md bg-emerald-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-40">
            {loading ? "Réactivation..." : "Réactiver"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
