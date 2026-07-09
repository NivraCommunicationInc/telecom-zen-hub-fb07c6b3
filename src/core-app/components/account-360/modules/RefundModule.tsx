/**
 * RefundModule — Client 360 "Remboursement" command center.
 *
 * Standard identique à RecordPaymentModule / PlanChangeModule / KycModule :
 *  - Contexte : soldes, factures ouvertes, paiements récents, remboursements passés
 *  - Sélection d'un paiement source + calcul du montant remboursable restant
 *  - Simulation d'impact avant confirmation (impact sur billing_payments + facture)
 *  - Audit admin_audit_log via ClientModuleShell (module_tag='refund')
 *  - Écriture unique via `billing-account-actions` action `create_direct_refund`
 *    → RPC canonique `refund_payment` (aucune mutation directe des tables financières)
 *  - Email officiel : template `client_direct_refund_processed`
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClientModuleShell, ImpactRow, ImpactedTable, PlannedEmail } from "./ClientModuleShell";
import { callCoreAction } from "@/core-app/lib/callCoreAction";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertTriangle, Info, Undo2, Landmark, Banknote, CreditCard, Wallet, HandCoins } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  open: boolean;
  onClose: () => void;
  accountId: string;
  clientId: string;
  clientName: string;
  clientEmail?: string | null;
  canonicalData: any;
}

type RefundMethod = "square" | "interac" | "cheque" | "bank_transfer" | "credit_balance";

const METHOD_META: Record<RefundMethod, { label: string; icon: any; hint: string }> = {
  square:         { label: "Retour Square (carte originale)", icon: CreditCard, hint: "Rembourse sur la carte originale via Square. Nécessite un paiement Square source." },
  interac:        { label: "Interac / Virement",              icon: Landmark,   hint: "Virement Interac ou dépôt bancaire manuel." },
  cheque:         { label: "Chèque",                          icon: Banknote,   hint: "Chèque émis au client." },
  bank_transfer:  { label: "Transfert bancaire",              icon: Landmark,   hint: "Virement bancaire direct (EFT)." },
  credit_balance: { label: "Crédit au compte",                icon: Wallet,     hint: "Applique un crédit non-remboursable au compte client." },
};

const fmtCAD = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(Number(n));

export function RefundModule({ open, onClose, accountId, clientId, clientName, clientEmail, canonicalData }: Props) {
  const qc = useQueryClient();

  const invoices: any[] = canonicalData?.invoices ?? [];
  const payments: any[] = canonicalData?.payments ?? [];

  // Only payments that can still be refunded (confirmed / captured / completed)
  const eligiblePayments = useMemo(
    () => payments
      .filter((p) => ["confirmed", "completed", "captured", "paid", "partially_refunded"].includes(String(p.status ?? "").toLowerCase()))
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()),
    [payments],
  );

  // ── Form ───────────────────────────────────────────────────────────────
  const [paymentId, setPaymentId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<RefundMethod>("square");
  const [reason, setReason] = useState<string>("");
  const [externalRef, setExternalRef] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const selectedPayment = eligiblePayments.find((p) => p.id === paymentId);

  // ── Previous refunds for the selected payment ──────────────────────────
  const prevRefundsQ = useQuery({
    queryKey: ["core-refund-prior", paymentId],
    enabled: open && !!paymentId,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_direct_refunds")
        .select("id, amount, refund_method, status, created_at, reason, external_reference")
        .eq("payment_id", paymentId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  const prevRefunds = prevRefundsQ.data ?? [];
  const refundedSoFar = prevRefunds
    .filter((r: any) => r.status !== "cancelled" && r.status !== "failed")
    .reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);

  const paymentAmount = Number(selectedPayment?.amount ?? 0);
  const remainingRefundable = Math.max(0, paymentAmount - refundedSoFar);

  // ── All-account previous refunds (history tab) ─────────────────────────
  const allRefundsQ = useQuery({
    queryKey: ["core-refund-history", clientId],
    enabled: open && !!clientId,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_direct_refunds")
        .select("id, amount, refund_method, status, created_at, reason, external_reference, payment_id, invoice_id")
        .eq("user_id", clientId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (open) {
      const first = eligiblePayments[0];
      setPaymentId(first?.id ?? "");
      setAmount(first ? String(Number(first.amount).toFixed(2)) : "");
      setMethod(first?.provider === "square" || first?.square_payment_id ? "square" : "interac");
      setReason("");
      setExternalRef("");
    }
  }, [open, eligiblePayments.length]);

  useEffect(() => {
    if (selectedPayment) {
      const remaining = Math.max(0, Number(selectedPayment.amount ?? 0) - refundedSoFar);
      setAmount(String(remaining.toFixed(2)));
      if (selectedPayment.provider === "square" || selectedPayment.square_payment_id) {
        setMethod("square");
      } else if (method === "square") {
        setMethod("interac");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId, refundedSoFar]);

  // ── Simulation (client-side, deterministic) ────────────────────────────
  const amt = Number(amount || 0);
  const isFullRefund = selectedPayment && Math.abs(amt - remainingRefundable) < 0.005 && refundedSoFar === 0;
  const isPartial = selectedPayment && amt > 0 && amt < remainingRefundable + 0.005 && !isFullRefund;

  const linkedInvoice = selectedPayment ? invoices.find((i) => i.id === selectedPayment.invoice_id) : null;

  const impact: ImpactRow[] = selectedPayment ? [
    {
      label: "Paiement source",
      before: `${fmtCAD(paymentAmount)} · ${selectedPayment.status}`,
      after: `${fmtCAD(paymentAmount)} · ${isFullRefund ? "refunded" : isPartial ? "partially_refunded" : selectedPayment.status}`,
    },
    {
      label: "Déjà remboursé",
      before: fmtCAD(refundedSoFar),
      after: fmtCAD(refundedSoFar + amt),
      delta: `+${fmtCAD(amt)}`,
    },
    {
      label: "Solde remboursable restant",
      before: fmtCAD(remainingRefundable),
      after: fmtCAD(Math.max(0, remainingRefundable - amt)),
    },
    ...(linkedInvoice ? [{
      label: `Facture ${linkedInvoice.invoice_number ?? linkedInvoice.id.slice(0, 8)}`,
      before: `${linkedInvoice.status} · payé ${fmtCAD(linkedInvoice.amount_paid)}`,
      after: isFullRefund ? "peut être ré-ouverte (selon triggers)" : "payé partiellement",
    }] : []),
    {
      label: "Méthode de remboursement",
      before: "—",
      after: METHOD_META[method].label,
    },
  ] : [];

  const impactedTables: ImpactedTable[] = [
    { table: "client_direct_refunds", rows: 1, note: `status=processed, method=${method}` },
    ...(method === "square" ? [
      { table: "billing_payments", rows: 1, note: "RPC refund_payment (status/refunded_amount)" },
      { table: "billing_invoices", rows: 1, note: "recalcul solde par triggers" },
    ] : []),
    ...(method === "credit_balance" ? [
      { table: "account_adjustments", rows: 1, note: "credit non-remboursable au compte" },
    ] : []),
    { table: "admin_audit_log", rows: 1, note: "billing-account-actions:create_direct_refund" },
    { table: "email_queue", rows: 1, note: "template client_direct_refund_processed" },
  ];

  const plannedEmails: PlannedEmail[] = [
    { template: "client_direct_refund_processed", recipient: clientEmail ?? "—", note: `${METHOD_META[method].label} · ${fmtCAD(amt)}` },
  ];

  // ── Guards ─────────────────────────────────────────────────────────────
  const invalidAmount = !(amt > 0);
  const overRefund = selectedPayment && amt > remainingRefundable + 0.005;
  const squareWithoutSource =
    method === "square" &&
    (!selectedPayment || !(selectedPayment.provider === "square" || selectedPayment.square_payment_id));
  const shortReason = reason.trim().length < 5;
  const missingPayment = !paymentId && method !== "credit_balance";

  const disabled =
    loading || invalidAmount || !!overRefund || !!squareWithoutSource || shortReason || missingPayment;

  // ── Confirm ────────────────────────────────────────────────────────────
  const onConfirm = async (auditReason: string) => {
    if (disabled) return;
    setLoading(true);
    try {
      const idempotency_key = `refund-${paymentId || clientId}-${Date.now()}`;
      const res = await callCoreAction("billing-account-actions", {
        action: "create_direct_refund",
        client_user_id: clientId,
        account_id: accountId,
        payment_id: paymentId || undefined,
        invoice_id: selectedPayment?.invoice_id ?? undefined,
        amount: amt,
        refund_method: method,
        external_reference: externalRef.trim() || undefined,
        reason: reason.trim(),
        idempotency_key,
      }, {
        reason: auditReason,
        queryClient: qc,
        successMessage: `Remboursement de ${fmtCAD(amt)} enregistré`,
      });
      if (res.ok) onClose();
    } finally {
      setLoading(false);
    }
  };

  // ── Context banner ─────────────────────────────────────────────────────
  const totalRefundedLifetime = (allRefundsQ.data ?? [])
    .filter((r: any) => r.status !== "cancelled" && r.status !== "failed")
    .reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);

  const clientContext = (
    <div className="grid md:grid-cols-4 gap-3">
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Client</div>
        <div className="font-medium">{clientName}</div>
        <div className="text-muted-foreground">{clientEmail ?? "—"}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Paiements éligibles</div>
        <div className="font-semibold text-lg">{eligiblePayments.length}</div>
        <div className="text-muted-foreground">
          Total: {fmtCAD(eligiblePayments.reduce((s, p) => s + Number(p.amount ?? 0), 0))}
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Déjà remboursé (vie)</div>
        <div className="font-semibold text-lg">{fmtCAD(totalRefundedLifetime)}</div>
        <div className="text-muted-foreground">{allRefundsQ.data?.length ?? 0} opération(s)</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Sélection</div>
        <div className="font-medium">
          {selectedPayment ? `${fmtCAD(paymentAmount)} · ${selectedPayment.method ?? selectedPayment.provider ?? "—"}` : "Aucune"}
        </div>
        <div className="text-muted-foreground">
          Restant: {selectedPayment ? fmtCAD(remainingRefundable) : "—"}
        </div>
      </div>
    </div>
  );

  // ── État ───────────────────────────────────────────────────────────────
  const state = (
    <>
      <div className="border rounded-md p-3">
        <div className="text-xs font-semibold mb-2 flex items-center gap-2">
          <Undo2 className="h-3 w-3" /> Paiements remboursables
        </div>
        {eligiblePayments.length === 0 && (
          <p className="text-xs text-muted-foreground">Aucun paiement éligible au remboursement.</p>
        )}
        <div className="space-y-1">
          {eligiblePayments.slice(0, 10).map((p) => (
            <div key={p.id} className="flex items-center justify-between text-xs border-b last:border-0 py-1">
              <div>
                <div className="font-medium">
                  {fmtCAD(p.amount)} · {p.provider ?? p.method ?? "—"}
                  {p.square_payment_id && <Badge variant="secondary" className="ml-2 text-[10px]">Square</Badge>}
                </div>
                <div className="text-muted-foreground">
                  {p.created_at ? format(new Date(p.created_at), "dd MMM yyyy HH:mm", { locale: fr }) : "—"}
                  {p.reference ? ` · ${p.reference}` : ""}
                </div>
              </div>
              <Badge variant={p.status === "refunded" ? "outline" : "secondary"}>{p.status}</Badge>
            </div>
          ))}
        </div>
      </div>

      {selectedPayment && prevRefunds.length > 0 && (
        <div className="border rounded-md p-3">
          <div className="text-xs font-semibold mb-2">Remboursements déjà appliqués à ce paiement</div>
          {prevRefunds.map((r: any) => (
            <div key={r.id} className="flex justify-between text-xs border-b last:border-0 py-1">
              <div>
                <div className="font-medium">{fmtCAD(r.amount)} · {r.refund_method}</div>
                <div className="text-muted-foreground">
                  {format(new Date(r.created_at), "dd MMM yyyy", { locale: fr })} · {r.reason?.slice(0, 60)}
                </div>
              </div>
              <Badge variant="outline">{r.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </>
  );

  // ── Historique global ──────────────────────────────────────────────────
  const history = (
    <div className="space-y-1">
      {(allRefundsQ.data ?? []).map((r: any) => (
        <div key={r.id} className="flex justify-between text-xs border-b last:border-0 py-1">
          <div>
            <div className="font-medium">{fmtCAD(r.amount)} · {METHOD_META[r.refund_method as RefundMethod]?.label ?? r.refund_method}</div>
            <div className="text-muted-foreground">
              {format(new Date(r.created_at), "dd MMM yyyy HH:mm", { locale: fr })}
              {r.external_reference ? ` · ref ${r.external_reference}` : ""}
              {r.reason ? ` · ${r.reason.slice(0, 80)}` : ""}
            </div>
          </div>
          <Badge variant={r.status === "processed" ? "secondary" : "outline"}>{r.status}</Badge>
        </div>
      ))}
      {(allRefundsQ.data ?? []).length === 0 && (
        <p className="text-xs text-muted-foreground">Aucun remboursement passé sur ce compte.</p>
      )}
    </div>
  );

  // ── Actions ────────────────────────────────────────────────────────────
  const actions = (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Route canonique : <b>billing-account-actions → create_direct_refund</b>.
          Les remboursements Square passent par la RPC <code>refund_payment</code>. Aucune écriture directe
          sur <code>billing_payments</code> ou <code>billing_invoices</code>.
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label>Paiement à rembourser</Label>
          <Select value={paymentId} onValueChange={setPaymentId}>
            <SelectTrigger>
              <SelectValue placeholder={eligiblePayments.length ? "Choisir un paiement" : "Aucun paiement éligible"} />
            </SelectTrigger>
            <SelectContent>
              {eligiblePayments.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {fmtCAD(p.amount)} · {p.provider ?? p.method ?? "—"} ·{" "}
                  {p.created_at ? format(new Date(p.created_at), "dd MMM yy", { locale: fr }) : "—"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Montant à rembourser (CAD)</Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            max={remainingRefundable || undefined}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {selectedPayment && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Max remboursable: {fmtCAD(remainingRefundable)}
              {refundedSoFar > 0 && ` (déjà ${fmtCAD(refundedSoFar)} remboursés)`}
            </p>
          )}
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Méthode de remboursement</Label>
        <RadioGroup value={method} onValueChange={(v) => setMethod(v as RefundMethod)} className="grid md:grid-cols-2 gap-2">
          {(Object.keys(METHOD_META) as RefundMethod[]).map((m) => {
            const Icon = METHOD_META[m].icon;
            const isSquareDisabled = m === "square" && squareWithoutSource;
            return (
              <label
                key={m}
                className={`flex items-start gap-2 border rounded-md p-2 cursor-pointer ${method === m ? "border-primary bg-muted/40" : ""} ${isSquareDisabled ? "opacity-50 pointer-events-none" : ""}`}
              >
                <RadioGroupItem value={m} id={`rm-${m}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="h-3 w-3" /> {METHOD_META[m].label}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{METHOD_META[m].hint}</div>
                </div>
              </label>
            );
          })}
        </RadioGroup>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label>Référence externe (optionnel)</Label>
          <Input
            value={externalRef}
            onChange={(e) => setExternalRef(e.target.value)}
            placeholder={method === "cheque" ? "N° de chèque" : method === "interac" ? "ID transfert" : "Référence bancaire"}
          />
        </div>
        <div>
          <Label>Raison du remboursement (obligatoire, min. 5 car.)</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
        </div>
      </div>

      {overRefund && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Montant supérieur au restant remboursable ({fmtCAD(remainingRefundable)}).
          </AlertDescription>
        </Alert>
      )}
      {squareWithoutSource && method === "square" && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Retour Square impossible : le paiement sélectionné n'a pas d'ID Square. Choisis une autre méthode.
          </AlertDescription>
        </Alert>
      )}
      {amt > 10000 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Remboursement &gt; 10 000 $ — approbation senior requise (bloqué côté backend).
          </AlertDescription>
        </Alert>
      )}
    </div>
  );

  return (
    <ClientModuleShell
      open={open}
      onClose={onClose}
      title="Remboursement"
      subtitle={`${clientName} · ${eligiblePayments.length} paiement(s) éligible(s) · ${fmtCAD(totalRefundedLifetime)} déjà remboursés`}
      clientId={clientId}
      moduleTag="refund"
      badges={[
        { label: METHOD_META[method].label },
        ...(isPartial ? [{ label: "Partiel", variant: "outline" as const }] : []),
        ...(isFullRefund ? [{ label: "Complet", variant: "secondary" as const }] : []),
      ]}
      clientContext={clientContext}
      state={state}
      history={history}
      actions={actions}
      impact={impact}
      impactedTables={impactedTables}
      plannedEmails={plannedEmails}
      requireReason
      disabled={disabled}
      loading={loading}
      confirmLabel={`Rembourser ${fmtCAD(amt)}`}
      onConfirm={onConfirm}
    />
  );
}
