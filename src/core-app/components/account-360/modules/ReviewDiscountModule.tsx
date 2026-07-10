/**
 * ReviewDiscountModule — Client 360: manage the "$5 Google review" reward.
 *
 * État : montre si l'email d'avis a été envoyé, si un rabais est en attente
 * et s'il a déjà été appliqué. Actions : marquer avis confirmé (5 $ en
 * attente), appliquer immédiatement le crédit de 5 $ sur la prochaine
 * facture (via account_adjustments · billing-lifecycle), ou annuler.
 * Tout passe par l'edge review-discount-apply avec audit obligatoire.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClientModuleShell, ImpactRow, ImpactedTable, PlannedEmail } from "./ClientModuleShell";
import { callCoreAction } from "@/core-app/lib/callCoreAction";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Star, CheckCircle2, Undo2, Info } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Action = "confirm_pending" | "apply_credit" | "reset";

interface Props {
  open: boolean;
  onClose: () => void;
  accountId: string;
  clientId: string;
  clientName: string;
  clientEmail?: string | null;
}

const fmtDate = (d: string | null | undefined) =>
  d ? format(new Date(d), "dd MMM yyyy HH:mm", { locale: fr }) : "—";

export function ReviewDiscountModule({ open, onClose, accountId, clientId, clientName, clientEmail }: Props) {
  const qc = useQueryClient();
  const [action, setAction] = useState<Action>("confirm_pending");
  const [loading, setLoading] = useState(false);

  const ctxQ = useQuery({
    queryKey: ["review-discount-ctx", accountId],
    enabled: open && !!accountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("id, review_email_sent, review_email_sent_at, review_discount_pending, review_discount_applied_at, review_discount_amount_cents")
        .eq("id", accountId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const acct = ctxQ.data;
  const emailSent = !!acct?.review_email_sent;
  const pending = !!acct?.review_discount_pending;
  const applied = !!acct?.review_discount_applied_at;

  // Auto-pick sensible default action
  useMemo(() => {
    if (!open) return;
    if (applied) setAction("reset");
    else if (pending) setAction("apply_credit");
    else setAction("confirm_pending");
  }, [open, applied, pending]);

  const impact: ImpactRow[] = useMemo(() => {
    if (action === "confirm_pending") {
      return [
        { label: "Rabais en attente", before: pending ? "Oui" : "Non", after: "Oui", delta: "→ pending" },
      ];
    }
    if (action === "apply_credit") {
      return [
        { label: "Crédit récurrent (1 mois)", before: "—", after: "5,00 $", delta: "prochaine facture" },
        { label: "Rabais appliqué", before: applied ? "Oui" : "Non", after: "Oui" },
        { label: "En attente", before: pending ? "Oui" : "Non", after: "Non" },
      ];
    }
    return [
      { label: "En attente", before: pending ? "Oui" : "Non", after: "Non", delta: "annulé" },
    ];
  }, [action, pending, applied]);

  const impactedTables: ImpactedTable[] = useMemo(() => {
    if (action === "apply_credit") {
      return [
        { table: "account_adjustments", rows: 1, note: "type=credit · 5 $ · 1 mois" },
        { table: "accounts", rows: 1, note: "review_discount_applied_at" },
        { table: "admin_audit_log", rows: 1, note: "review_discount_apply_credit" },
      ];
    }
    return [
      { table: "accounts", rows: 1, note: "review_discount_pending flag" },
      { table: "admin_audit_log", rows: 1, note: `review_discount_${action}` },
    ];
  }, [action]);

  const plannedEmails: PlannedEmail[] = [];

  const disabled =
    loading ||
    !acct ||
    (action === "apply_credit" && applied) ||
    (action === "confirm_pending" && pending && !applied);

  const onConfirm = async (reason: string) => {
    if (disabled || !acct) return;
    setLoading(true);
    try {
      const res = await callCoreAction("review-discount-apply", {
        action,
        account_id: accountId,
      }, {
        reason,
        queryClient: qc,
        successMessage:
          action === "apply_credit" ? "Crédit de 5 $ appliqué"
          : action === "confirm_pending" ? "Avis confirmé — 5 $ en attente"
          : "Rabais annulé",
      });
      if (res.ok) {
        ctxQ.refetch();
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  const clientContext = (
    <div className="grid md:grid-cols-4 gap-3">
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Client</div>
        <div className="font-medium">{clientName}</div>
        <div className="text-muted-foreground">{clientEmail ?? "—"}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Courriel d'avis</div>
        <div className="font-semibold">{emailSent ? "Envoyé" : "Non envoyé"}</div>
        <div className="text-muted-foreground">{fmtDate(acct?.review_email_sent_at)}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Rabais en attente</div>
        <div className="font-semibold">{pending ? "Oui" : "Non"}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Rabais appliqué</div>
        <div className="font-semibold">
          {applied ? `${((acct?.review_discount_amount_cents ?? 500) / 100).toFixed(2)} $` : "—"}
        </div>
        <div className="text-muted-foreground">{fmtDate(acct?.review_discount_applied_at)}</div>
      </div>
    </div>
  );

  const state = (
    <div className="space-y-3">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Le crédit de 5 $ est appliqué comme un ajustement mensuel non renouvelable
          (1 mois) via <code className="text-[11px]">account_adjustments</code>.
          Il est consommé automatiquement par <code className="text-[11px]">billing-lifecycle</code>
          sur la prochaine facture du compte.
        </AlertDescription>
      </Alert>

      <div className="border rounded-md p-3 space-y-2">
        <div className="text-xs font-semibold flex items-center gap-2"><Star className="h-3 w-3 text-amber-400" /> Statut du rabais avis Google</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>Courriel d'avis envoyé</div>
          <div className="text-right">
            {emailSent
              ? <Badge variant="secondary">Envoyé {fmtDate(acct?.review_email_sent_at)}</Badge>
              : <Badge variant="outline">Non</Badge>}
          </div>
          <div>Rabais en attente (avis confirmé)</div>
          <div className="text-right">
            {pending
              ? <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">En attente</Badge>
              : <Badge variant="outline">Non</Badge>}
          </div>
          <div>Rabais appliqué</div>
          <div className="text-right">
            {applied
              ? <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                  {((acct?.review_discount_amount_cents ?? 500) / 100).toFixed(2)} $ · {fmtDate(acct?.review_discount_applied_at)}
                </Badge>
              : <Badge variant="outline">Non</Badge>}
          </div>
        </div>
      </div>
    </div>
  );

  const actions = (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Button
          type="button"
          variant={action === "confirm_pending" ? "default" : "outline"}
          size="sm"
          disabled={applied}
          onClick={() => setAction("confirm_pending")}
          className="justify-start"
        >
          <Star className="h-3.5 w-3.5 mr-2" /> Marquer avis confirmé
        </Button>
        <Button
          type="button"
          variant={action === "apply_credit" ? "default" : "outline"}
          size="sm"
          disabled={applied}
          onClick={() => setAction("apply_credit")}
          className="justify-start"
        >
          <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Appliquer 5 $ maintenant
        </Button>
        <Button
          type="button"
          variant={action === "reset" ? "default" : "outline"}
          size="sm"
          disabled={!pending && !applied}
          onClick={() => setAction("reset")}
          className="justify-start"
        >
          <Undo2 className="h-3.5 w-3.5 mr-2" /> Annuler en attente
        </Button>
      </div>

      {applied && (
        <Alert variant="destructive" className="text-xs">
          <AlertDescription>
            Un rabais avis a déjà été appliqué le {fmtDate(acct?.review_discount_applied_at)}.
            Un seul rabais par client (voir mémoire de conformité).
          </AlertDescription>
        </Alert>
      )}
    </div>
  );

  return (
    <ClientModuleShell
      open={open}
      onClose={onClose}
      title="Rabais avis Google"
      subtitle="Suivi du 5 $ promis pour un avis Google après activation"
      clientId={clientId}
      moduleTag="review_discount"
      badges={applied
        ? [{ label: "Appliqué", variant: "secondary" }]
        : pending
          ? [{ label: "En attente", variant: "outline" }]
          : emailSent
            ? [{ label: "Courriel envoyé", variant: "outline" }]
            : []}
      clientContext={clientContext}
      state={state}
      actions={actions}
      impact={impact}
      impactedTables={impactedTables}
      plannedEmails={plannedEmails}
      requireReason
      confirmLabel={
        action === "apply_credit" ? "Appliquer 5 $"
        : action === "confirm_pending" ? "Confirmer avis"
        : "Annuler en attente"
      }
      disabled={disabled}
      loading={loading}
      onConfirm={onConfirm}
    />
  );
}
