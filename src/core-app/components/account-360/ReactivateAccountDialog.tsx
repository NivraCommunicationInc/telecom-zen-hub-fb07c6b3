/**
 * ReactivateAccountDialog — Module 6.
 * Reactivates a suspended or cancelled account via the canonical
 * `account-ops-actions.reactivate_account` Edge Function.
 *
 * Rules:
 *  - Motif obligatoire (min 3 chars) → audit trail
 *  - EF gère: statut compte, cascade abonnements (suspendus par défaut,
 *    annulés opt-in), audit, activity log, note interne système.
 *  - Aucune écriture directe frontend → base.
 *  - Aucun email généré par cette action (le trigger DB de review-request
 *    activation reste hors périmètre — documenté au backlog du Module 5).
 */
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PlayCircle } from "lucide-react";
import { callCoreAction } from "@/core-app/lib/callCoreAction";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  accountId: string | undefined;
  clientId?: string;
  customerId?: string;
  accountStatus: string | null;
  subscriptions?: any[];
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export function ReactivateAccountDialog({
  accountId,
  clientId,
  accountStatus,
  subscriptions = [],
  open,
  onClose,
  onRefresh,
}: Props) {
  const suspendedSubs = useMemo(
    () => subscriptions.filter((s: any) => s?.status === "suspended"),
    [subscriptions],
  );
  const cancelledSubs = useMemo(
    () => subscriptions.filter((s: any) => s?.status === "cancelled"),
    [subscriptions],
  );

  const [resumeSuspended, setResumeSuspended] = useState(true);
  const [reactivateCancelled, setReactivateCancelled] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      setReason("");
      setResumeSuspended(true);
      setReactivateCancelled(false);
    }
  }, [open]);

  const alreadyActive = accountStatus === "active";
  const clientUserId = clientId;

  const handleSubmit = async () => {
    if (!accountId || !clientUserId) {
      toast.error("Contexte compte incomplet");
      return;
    }
    if (reason.trim().length < 3) {
      toast.error("Motif requis (min. 3 caractères)");
      return;
    }
    setLoading(true);
    const res = await callCoreAction<{
      reactivated_subscriptions: number;
      previous_status: string;
    }>(
      "account-ops-actions",
      {
        action: "reactivate_account",
        account_id: accountId,
        client_user_id: clientUserId,
        reason: reason.trim(),
        resume_suspended: resumeSuspended,
        reactivate_cancelled: reactivateCancelled,
      },
      {
        reason: reason.trim(),
        successMessage: "Compte réactivé",
        errorMessage: "Échec de la réactivation",
        queryClient: qc,
      },
    );
    setLoading(false);
    if (res.ok) {
      const n = res.data?.reactivated_subscriptions ?? 0;
      if (n > 0) toast.success(`${n} service(s) réactivé(s)`);
      onRefresh();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !loading) onClose(); }}>
      <DialogContent className="bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <PlayCircle className="h-4 w-4 text-emerald-400" />
            Réactiver le compte
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-[12px] text-core-text-secondary">
          {alreadyActive ? (
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-[11px] text-emerald-300">
              Ce compte est déjà <strong>actif</strong>. Aucune action requise.
            </p>
          ) : (
            <p>
              Le statut du compte passera de{" "}
              <strong className="text-amber-400">{accountStatus || "—"}</strong> à{" "}
              <strong className="text-emerald-400">actif</strong>.
            </p>
          )}

          {!alreadyActive && suspendedSubs.length > 0 && (
            <label className="flex items-start gap-2 rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] p-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={resumeSuspended}
                onChange={(e) => setResumeSuspended(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Reprendre <strong className="text-emerald-400">{suspendedSubs.length}</strong>{" "}
                service(s) suspendu(s)
              </span>
            </label>
          )}

          {!alreadyActive && cancelledSubs.length > 0 && (
            <label className="flex items-start gap-2 rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] p-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={reactivateCancelled}
                onChange={(e) => setReactivateCancelled(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Réactiver <strong className="text-amber-400">{cancelledSubs.length}</strong>{" "}
                service(s) annulé(s)
              </span>
            </label>
          )}

          {!alreadyActive && suspendedSubs.length === 0 && cancelledSubs.length === 0 && (
            <p className="text-[11px] text-core-text-label italic">
              Aucun service à réactiver — seul le statut du compte sera mis à jour.
            </p>
          )}

          {!alreadyActive && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-core-text-label block mb-1">
                Motif <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Client a régularisé son solde"
                className="w-full rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] px-2.5 py-1.5 text-[11px] text-white placeholder:text-[hsl(220,10%,30%)] outline-none focus:border-emerald-500/50"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-md border border-[hsl(220,15%,16%)] px-4 py-1.5 text-[11px] font-medium text-[hsl(220,10%,50%)] hover:text-white"
          >
            {alreadyActive ? "Fermer" : "Annuler"}
          </button>
          {!alreadyActive && (
            <button
              onClick={handleSubmit}
              disabled={loading || reason.trim().length < 3}
              className="rounded-md bg-emerald-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              {loading ? "Réactivation..." : "Réactiver"}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
