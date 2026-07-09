/**
 * AutopayModule — Client 360 unified "AutoPay & méthode de paiement".
 *
 * Standard identique aux autres modules du 360 :
 *  - Contexte compte + carte Square enregistrée + statut AutoPay
 *  - Historique des tentatives AutoPay (square_payment_attempts)
 *  - Factures en échec (autopay_retry_count, autopay_next_attempt_at, autopay_stopped)
 *  - Actions : activer/suspendre AutoPay, forcer une tentative, remplacer/retirer carte
 *  - Simulation d'impact + audit (module_tag='autopay')
 *
 * Écritures via l'Edge Function canonique `core-apply-autopay-action`.
 * Remplacement de carte : widget Square existant (`SquareCardForm`) → `square-save-card`.
 * Aucune logique PayPal.
 */
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClientModuleShell, ImpactRow, ImpactedTable } from "./ClientModuleShell";
import { callCoreAction } from "@/core-app/lib/callCoreAction";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { SquareCardForm } from "@/components/client/SquareCardForm";
import { CreditCard, RotateCcw, ShieldOff, ShieldCheck, PauseCircle, AlertTriangle, Zap } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  open: boolean;
  onClose: () => void;
  accountId: string;
  clientId: string;
  customerId?: string | null;
  clientName: string;
  clientEmail?: string | null;
  canonicalData: any;
}

type AutopayAction =
  | "enable_autopay"
  | "disable_autopay"
  | "detach_card"
  | "retry_now"
  | "replace_card";

const fmtCAD = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(Number(n));

const fmtDate = (d?: string | null) =>
  d ? format(new Date(d), "dd MMM yyyy HH:mm", { locale: fr }) : "—";

export function AutopayModule({
  open, onClose, accountId, clientId, customerId, clientName, clientEmail, canonicalData,
}: Props) {
  const qc = useQueryClient();
  const [action, setAction] = useState<AutopayAction>("enable_autopay");
  const [loading, setLoading] = useState(false);

  // Live billing customer
  const bcQ = useQuery({
    queryKey: ["core-autopay-bc", customerId, clientId],
    enabled: open && (!!customerId || !!clientId),
    queryFn: async () => {
      const base = supabase
        .from("billing_customers")
        .select("id, email, first_name, last_name, autopay_enabled, autopay_discount_active, autopay_consent_at, square_customer_id, square_card_id, square_card_brand, square_card_last4, square_card_exp_month, square_card_exp_year, user_id");
      const q = customerId ? base.eq("id", customerId) : base.eq("user_id", clientId);
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const bc = bcQ.data;
  const effectiveCustomerId = bc?.id ?? customerId ?? null;

  // Failed/pending autopay invoices for THIS customer
  const invoicesQ = useQuery({
    queryKey: ["core-autopay-invoices", effectiveCustomerId],
    enabled: open && !!effectiveCustomerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_invoices")
        .select("id, invoice_number, status, balance_due, total, autopay_retry_count, autopay_last_attempt_at, autopay_next_attempt_at, autopay_stopped, due_date")
        .eq("customer_id", effectiveCustomerId!)
        .in("status", ["unpaid", "overdue", "failed", "partially_paid"])
        .gt("balance_due", 0)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Recent Square payment attempts (log)
  const attemptsQ = useQuery({
    queryKey: ["core-autopay-attempts", effectiveCustomerId],
    enabled: open && !!effectiveCustomerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("square_payment_attempts")
        .select("id, amount, status, square_error_code, square_error_detail, attempt_number, created_at, invoice_id, square_payment_id")
        .eq("customer_id", effectiveCustomerId!)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data ?? [];
    },
  });

  const invoices = invoicesQ.data ?? [];
  const attempts = attemptsQ.data ?? [];

  const totalFailedBalance = useMemo(
    () => invoices.reduce((s, i: any) => s + Number(i.balance_due || 0), 0),
    [invoices],
  );
  const hasCard = !!bc?.square_card_id;
  const autopayOn = !!bc?.autopay_enabled;

  // ── Impact simulation ────────────────────────────────────────────────
  const impact: ImpactRow[] = useMemo(() => {
    switch (action) {
      case "enable_autopay":
        return [
          { label: "AutoPay", before: autopayOn ? "Activé" : "Désactivé", after: "Activé", delta: autopayOn ? "aucun changement" : "→ prélèvement auto." },
          { label: "Carte", before: hasCard ? `${bc?.square_card_brand} •••• ${bc?.square_card_last4}` : "Aucune", after: hasCard ? `${bc?.square_card_brand} •••• ${bc?.square_card_last4}` : "Aucune", delta: hasCard ? "" : "requis" },
          { label: "Rabais AutoPay", before: bc?.autopay_discount_active ? "Actif" : "Inactif", after: "Éligible (au prochain cycle)", delta: "" },
        ];
      case "disable_autopay":
        return [
          { label: "AutoPay", before: autopayOn ? "Activé" : "Désactivé", after: "Désactivé", delta: autopayOn ? "→ paiement manuel" : "aucun changement" },
          { label: "Rabais AutoPay", before: bc?.autopay_discount_active ? "Actif" : "Inactif", after: "Retiré", delta: "" },
          { label: "Carte", before: hasCard ? `${bc?.square_card_brand} •••• ${bc?.square_card_last4}` : "Aucune", after: hasCard ? `${bc?.square_card_brand} •••• ${bc?.square_card_last4} (conservée)` : "Aucune", delta: "" },
        ];
      case "detach_card":
        return [
          { label: "Carte", before: hasCard ? `${bc?.square_card_brand} •••• ${bc?.square_card_last4}` : "Aucune", after: "Aucune", delta: "supprimée + désactivée côté Square" },
          { label: "AutoPay", before: autopayOn ? "Activé" : "Désactivé", after: "Désactivé", delta: "" },
        ];
      case "retry_now":
        return [
          { label: "Factures relancées", before: `${invoices.length} en attente`, after: `${invoices.length} planifiées maintenant`, delta: "reset autopay_next_attempt_at" },
          { label: "Montant total tenté", before: fmtCAD(totalFailedBalance), after: fmtCAD(totalFailedBalance), delta: "" },
        ];
      case "replace_card":
        return [
          { label: "Carte", before: hasCard ? `${bc?.square_card_brand} •••• ${bc?.square_card_last4}` : "Aucune", after: "Nouvelle carte (saisie ci-dessus)", delta: "via widget Square" },
        ];
    }
  }, [action, autopayOn, hasCard, bc, invoices.length, totalFailedBalance]);

  const impactedTables: ImpactedTable[] = useMemo(() => {
    switch (action) {
      case "enable_autopay":
      case "disable_autopay":
        return [{ table: "billing_customers", rows: 1, note: "flag autopay_enabled" }];
      case "detach_card":
        return [
          { table: "billing_customers", rows: 1, note: "carte + autopay effacés" },
          { table: "email_queue", rows: 1, note: "template autopay_cancelled" },
        ];
      case "retry_now":
        return [
          { table: "billing_invoices", rows: invoices.length, note: "autopay_next_attempt_at = now()" },
          { table: "square_payment_attempts", note: "insertions selon résultat" },
        ];
      case "replace_card":
        return [{ table: "billing_customers", rows: 1, note: "square_card_id/brand/last4 remplacés" }];
    }
  }, [action, invoices.length]);

  const canConfirm =
    (action === "enable_autopay" && hasCard && !autopayOn) ||
    (action === "disable_autopay" && autopayOn) ||
    (action === "detach_card" && hasCard) ||
    (action === "retry_now" && autopayOn && hasCard && invoices.length > 0);
  // replace_card is confirmed by the SquareCardForm widget itself

  const runAction = async (reason: string) => {
    if (!effectiveCustomerId) return;
    setLoading(true);
    try {
      const res = await callCoreAction("core-apply-autopay-action", {
        action,
        customer_id: effectiveCustomerId,
        client_id: clientId,
        account_id: accountId,
      }, {
        reason,
        successMessage: "Action AutoPay appliquée",
        queryClient: qc,
      });
      if (res.ok) {
        qc.invalidateQueries({ queryKey: ["core-autopay-bc"] });
        qc.invalidateQueries({ queryKey: ["core-autopay-invoices"] });
        qc.invalidateQueries({ queryKey: ["core-autopay-attempts"] });
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  // ── State tab content ────────────────────────────────────────────────
  const stateContent = (
    <div className="space-y-3">
      <div className="grid md:grid-cols-3 gap-2">
        <div className="border rounded-md p-3">
          <p className="text-[10px] uppercase text-muted-foreground">AutoPay</p>
          <p className="font-semibold mt-1 flex items-center gap-1">
            {autopayOn ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <ShieldOff className="h-4 w-4 text-muted-foreground" />}
            {autopayOn ? "Activé" : "Désactivé"}
          </p>
          {bc?.autopay_consent_at && (
            <p className="text-[11px] text-muted-foreground mt-1">Consentement: {fmtDate(bc.autopay_consent_at)}</p>
          )}
        </div>
        <div className="border rounded-md p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Carte Square enregistrée</p>
          {hasCard ? (
            <>
              <p className="font-semibold mt-1 flex items-center gap-1">
                <CreditCard className="h-4 w-4" /> {bc?.square_card_brand} •••• {bc?.square_card_last4}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Exp: {bc?.square_card_exp_month?.toString().padStart(2, "0")}/{bc?.square_card_exp_year}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">Aucune carte au dossier</p>
          )}
        </div>
        <div className="border rounded-md p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Rabais AutoPay</p>
          <p className="font-semibold mt-1">{bc?.autopay_discount_active ? "Actif" : "Inactif"}</p>
        </div>
      </div>

      {invoices.length > 0 && (
        <div className="border rounded-md p-3">
          <p className="text-xs font-semibold mb-2 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-500" /> Factures en attente AutoPay ({invoices.length}) — {fmtCAD(totalFailedBalance)}
          </p>
          <div className="space-y-1 text-xs">
            {invoices.slice(0, 6).map((i: any) => (
              <div key={i.id} className="flex justify-between gap-2 border-b last:border-b-0 py-1">
                <span className="font-mono">{i.invoice_number}</span>
                <span>{fmtCAD(i.balance_due)}</span>
                <span className="text-muted-foreground">Tentatives {i.autopay_retry_count ?? 0}/10</span>
                <span className={i.autopay_stopped ? "text-red-500" : "text-muted-foreground"}>
                  {i.autopay_stopped ? "Arrêté" : `Prochaine: ${fmtDate(i.autopay_next_attempt_at)}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const historyContent = (
    <div className="space-y-2">
      <p className="text-xs font-semibold">Tentatives Square récentes</p>
      {attempts.length === 0 && <p className="text-sm text-muted-foreground">Aucune tentative Square enregistrée.</p>}
      {attempts.map((a: any) => (
        <div key={a.id} className="border rounded-md p-2 text-xs">
          <div className="flex justify-between">
            <span>#{a.attempt_number ?? "?"} · {fmtCAD(a.amount)} · <Badge variant={a.status === "success" ? "default" : "destructive"}>{a.status}</Badge></span>
            <span className="text-muted-foreground">{fmtDate(a.created_at)}</span>
          </div>
          {a.square_error_code && (
            <p className="text-red-500 mt-1">{a.square_error_code} — {a.square_error_detail}</p>
          )}
          {a.square_payment_id && <p className="text-muted-foreground">Square ID: {a.square_payment_id}</p>}
        </div>
      ))}
    </div>
  );

  const actionsContent = (
    <div className="space-y-4">
      <div>
        <Label className="text-xs">Action</Label>
        <RadioGroup value={action} onValueChange={(v) => setAction(v as AutopayAction)} className="grid md:grid-cols-2 gap-2 mt-2">
          {[
            { id: "enable_autopay", label: "Activer AutoPay", icon: ShieldCheck, hint: "Nécessite une carte enregistrée." },
            { id: "disable_autopay", label: "Suspendre AutoPay", icon: PauseCircle, hint: "La carte reste au dossier." },
            { id: "retry_now", label: "Forcer une tentative maintenant", icon: Zap, hint: "Reprogramme toutes les factures en attente." },
            { id: "replace_card", label: "Remplacer la méthode de paiement", icon: CreditCard, hint: "Saisie sécurisée via Square." },
            { id: "detach_card", label: "Retirer la carte", icon: ShieldOff, hint: "Supprime la carte + désactive AutoPay + email client." },
          ].map((o) => (
            <label key={o.id} className={`border rounded-md p-3 cursor-pointer flex gap-2 items-start ${action === o.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}>
              <RadioGroupItem value={o.id} className="mt-0.5" />
              <div>
                <p className="text-sm font-medium flex items-center gap-1"><o.icon className="h-3.5 w-3.5" /> {o.label}</p>
                <p className="text-[11px] text-muted-foreground">{o.hint}</p>
              </div>
            </label>
          ))}
        </RadioGroup>
      </div>

      {action === "enable_autopay" && !hasCard && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Aucune carte Square enregistrée — choisir « Remplacer la méthode de paiement » d'abord.</AlertDescription>
        </Alert>
      )}
      {action === "retry_now" && invoices.length === 0 && (
        <Alert>
          <AlertDescription>Aucune facture en attente AutoPay pour ce client.</AlertDescription>
        </Alert>
      )}

      {action === "replace_card" && (
        <div className="border rounded-md p-3 space-y-2">
          <p className="text-xs font-semibold">Nouvelle carte (Square)</p>
          {!bc?.square_customer_id ? (
            <Alert variant="destructive">
              <AlertDescription>Le client n'a pas encore de square_customer_id — impossible d'attacher une carte depuis Core. Passez par le portail client.</AlertDescription>
            </Alert>
          ) : (
            <SquareCardForm
              customerId={bc.square_customer_id}
              onSaved={(brand, last4) => {
                qc.invalidateQueries({ queryKey: ["core-autopay-bc"] });
                // Audit trail via a lightweight admin_audit_log row through the Edge Function:
                supabase.from("admin_audit_log").insert({
                  admin_user_id: null,
                  admin_email: null,
                  action: "core_autopay_replace_card",
                  target_type: "billing_customers",
                  target_id: bc.id,
                  details: {
                    module_tag: "autopay",
                    action: "replace_card",
                    client_id: clientId,
                    account_id: accountId,
                    after_state: { square_card_brand: brand, square_card_last4: last4 },
                  },
                }).then(() => {});
              }}
            />
          )}
        </div>
      )}
    </div>
  );

  return (
    <ClientModuleShell
      open={open}
      onClose={onClose}
      title="AutoPay & méthode de paiement"
      subtitle={clientName}
      clientId={clientId}
      moduleTag="autopay"
      badges={[
        { label: autopayOn ? "AutoPay actif" : "AutoPay inactif", variant: autopayOn ? "default" : "outline" },
        { label: hasCard ? `Carte ${bc?.square_card_brand}` : "Sans carte", variant: hasCard ? "secondary" : "destructive" },
      ]}
      state={stateContent}
      history={historyContent}
      actions={actionsContent}
      impact={action !== "replace_card" ? impact : undefined}
      impactedTables={action !== "replace_card" ? impactedTables : undefined}
      plannedEmails={action === "detach_card" ? [{ template: "autopay_cancelled", recipient: clientEmail ?? undefined }] : undefined}
      requireReason
      confirmLabel={action === "replace_card" ? "Utiliser le widget ci-dessus" : "Appliquer"}
      disabled={!canConfirm || action === "replace_card"}
      loading={loading}
      onConfirm={action === "replace_card" ? undefined : runAction}
    />
  );
}
