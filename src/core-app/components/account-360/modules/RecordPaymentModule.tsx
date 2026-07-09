/**
 * RecordPaymentModule — Client 360 "Enregistrer paiement" command center.
 *
 * Standard identique à PlanChangeModule / KycModule :
 *  - Contexte compte complet (solde, factures ouvertes, méthode de paiement, AutoPay)
 *  - Historique paiements récents
 *  - Audit admin_audit_log via ClientModuleShell (module_tag='record_payment')
 *  - Simulation d'impact avant confirmation (core_simulate_record_payment)
 *  - Écriture unique via Edge Function `core-record-payment` qui appelle
 *    les RPC canoniques `apply_payment_to_invoice` / `apply_credit_to_invoice`.
 *
 * Aucun système parallèle : ni Square, ni PayPal, ni ledger custom.
 * Reçus / loyalty / sync portail sont déclenchés par les triggers existants.
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
import { AlertTriangle, Info, Wallet, Banknote, HandCoins, Landmark, Gift } from "lucide-react";
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

type Method = "cash" | "cheque" | "interac" | "credit_account";

const METHOD_LABEL: Record<Method, { label: string; icon: any; hint: string }> = {
  cash:           { label: "Argent comptant",              icon: HandCoins, hint: "Paiement reçu en personne, en dollars canadiens." },
  cheque:         { label: "Chèque",                       icon: Banknote,  hint: "Chèque encaissé au dépôt bancaire." },
  interac:        { label: "Interac / Virement bancaire",  icon: Landmark,  hint: "Transfert Interac ou dépôt bancaire confirmé." },
  credit_account: { label: "Crédit au compte",             icon: Gift,      hint: "Applique un crédit existant du compte." },
};

const fmtCAD = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(Number(n));

const CLOSED = ["paid", "paid_by_promo", "void", "cancelled", "refunded"];

export function RecordPaymentModule({ open, onClose, accountId, clientId, clientName, clientEmail, canonicalData }: Props) {
  const qc = useQueryClient();

  const invoices: any[] = canonicalData?.invoices ?? [];
  const payments: any[] = canonicalData?.payments ?? [];
  const unpaid = useMemo(
    () => invoices
      .filter((i) => !CLOSED.includes(String(i.status)) && Number(i.balance_due ?? 0) > 0)
      .sort((a, b) => new Date(a.due_date || a.created_at).getTime() - new Date(b.due_date || b.created_at).getTime()),
    [invoices],
  );
  const totalDue = unpaid.reduce((s, i) => s + Number(i.balance_due ?? 0), 0);

  // ── Form state ──────────────────────────────────────────────────────────
  const [invoiceId, setInvoiceId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<Method>("interac");
  const [reference, setReference] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [creditId, setCreditId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      const first = unpaid[0];
      setInvoiceId(first?.id ?? "");
      setAmount(first ? String(Number(first.balance_due).toFixed(2)) : "");
      setReference("");
      setNote("");
      setCreditId("");
      setMethod("interac");
    }
  }, [open, unpaid.length]);

  const selectedInvoice = invoices.find((i) => i.id === invoiceId);

  // ── AutoPay + method + credits (context) ───────────────────────────────
  const ctxQ = useQuery({
    queryKey: ["core-record-payment-ctx", accountId, clientId],
    enabled: open && !!accountId,
    queryFn: async () => {
      const [autopay, pm, credits] = await Promise.all([
        supabase.from("client_autopay_settings")
          .select("enabled, retry_count, last_attempt_at")
          .eq("account_id", accountId).maybeSingle(),
        supabase.from("client_payment_methods")
          .select("id, brand, last4, exp_month, exp_year, is_default")
          .eq("account_id", accountId).eq("is_active", true).order("is_default", { ascending: false }),
        supabase.from("account_adjustments")
          .select("id, description, amount, applied_count, months_total, status, type, created_at")
          .eq("account_id", accountId).eq("type", "credit").eq("status", "active")
          .order("created_at", { ascending: false }),
      ]);
      return {
        autopay: autopay.data ?? null,
        methods: pm.data ?? [],
        credits: credits.data ?? [],
      };
    },
  });

  const credits = ctxQ.data?.credits ?? [];
  const selectedCredit = credits.find((c: any) => c.id === creditId);

  // ── Simulation ──────────────────────────────────────────────────────────
  const simQ = useQuery({
    queryKey: ["core-simulate-record-payment", invoiceId, amount, method],
    enabled: open && !!invoiceId && Number(amount) > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("core_simulate_record_payment", {
        p_invoice_id: invoiceId,
        p_amount: Number(amount),
        p_method: method,
      });
      if (error) throw error;
      return data as any;
    },
  });

  const impact: ImpactRow[] = simQ.data ? [
    {
      label: "Facture",
      before: simQ.data.invoice_number ?? "—",
      after: simQ.data.invoice_number ?? "—",
    },
    {
      label: "Solde",
      before: fmtCAD(simQ.data.before?.balance_due),
      after: fmtCAD(simQ.data.after?.balance_due),
      delta: `−${fmtCAD(Number(amount || 0))}`,
    },
    {
      label: "Payé",
      before: fmtCAD(simQ.data.before?.amount_paid),
      after: fmtCAD(simQ.data.after?.amount_paid),
    },
    {
      label: "Statut",
      before: String(simQ.data.before?.status ?? "—"),
      after: String(simQ.data.after?.status ?? "—"),
      delta: simQ.data.after?.will_be_paid ? "→ payée" : "",
    },
  ] : [];

  const impactedTables: ImpactedTable[] =
    method === "credit_account"
      ? [
          { table: "account_adjustments",          rows: 1, note: "applied_count++" },
          { table: "billing_invoice_lines",        rows: 1, note: "credit_applied" },
          { table: "billing_invoices",             rows: 1, note: "balance_due / status" },
          { table: "admin_audit_log",              rows: 1, note: "core_record_payment" },
        ]
      : [
          { table: "billing_payments",             rows: 1, note: `method=${method}` },
          { table: "billing_invoices",             rows: 1, note: "balance_due / status" },
          { table: "billing_provenance",           rows: 1, note: "trigger apply_payment_to_invoice" },
          { table: "loyalty_transactions",         rows: 1, note: "trigger trg_earn_loyalty_on_payment" },
          { table: "admin_audit_log",              rows: 1, note: "core_record_payment" },
        ];

  const plannedEmails: PlannedEmail[] = method === "credit_account"
    ? []
    : [{ template: "payment-receipt", recipient: clientEmail ?? "—", note: "via trg_payment_receipt_email" }];

  // ── Guards ──────────────────────────────────────────────────────────────
  const amt = Number(amount || 0);
  const overpay = selectedInvoice && amt > Number(selectedInvoice.balance_due ?? 0) + 0.001;
  const creditInsufficient = method === "credit_account" &&
    selectedCredit && Number(selectedCredit.amount ?? 0) < amt;
  const missingCredit = method === "credit_account" && !creditId;
  const invalidAmount = amt <= 0;
  const disabled = !invoiceId || invalidAmount || missingCredit || creditInsufficient || loading;

  // ── Confirm ────────────────────────────────────────────────────────────
  const onConfirm = async (reason: string) => {
    if (disabled) return;
    setLoading(true);
    try {
      const res = await callCoreAction("core-record-payment", {
        invoice_id: invoiceId,
        amount: amt,
        method,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
        credit_id: method === "credit_account" ? creditId : undefined,
        idempotency_key: `rp-${invoiceId}-${Date.now()}`,
      }, {
        reason,
        queryClient: qc,
        successMessage: `Paiement de ${fmtCAD(amt)} enregistré`,
      });
      if (res.ok) onClose();
    } finally {
      setLoading(false);
    }
  };

  // ── Context banner ─────────────────────────────────────────────────────
  const ap = ctxQ.data?.autopay;
  const pmDefault = ctxQ.data?.methods?.find((m: any) => m.is_default) ?? ctxQ.data?.methods?.[0];

  const clientContext = (
    <div className="grid md:grid-cols-4 gap-3">
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Client</div>
        <div className="font-medium">{clientName}</div>
        <div className="text-muted-foreground">{clientEmail ?? "—"}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Solde total dû</div>
        <div className="font-semibold text-lg">{fmtCAD(totalDue)}</div>
        <div className="text-muted-foreground">{unpaid.length} facture(s) ouverte(s)</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">AutoPay</div>
        <div className="font-medium">
          {ap?.enabled ? <Badge variant="secondary">Actif</Badge> : <Badge variant="outline">Inactif</Badge>}
        </div>
        {ap?.last_attempt_at && (
          <div className="text-muted-foreground">
            Dernière: {format(new Date(ap.last_attempt_at), "dd MMM HH:mm", { locale: fr })} · {ap.retry_count ?? 0}×
          </div>
        )}
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Méthode par défaut</div>
        <div className="font-medium">
          {pmDefault ? `${pmDefault.brand ?? "Carte"} •••• ${pmDefault.last4 ?? "—"}` : "Aucune"}
        </div>
        <div className="text-muted-foreground">Crédits actifs: {credits.length}</div>
      </div>
    </div>
  );

  // ── État ───────────────────────────────────────────────────────────────
  const state = (
    <>
      <div className="border rounded-md p-3">
        <div className="text-xs font-semibold mb-2 flex items-center gap-2">
          <Wallet className="h-3 w-3" /> Factures ouvertes
        </div>
        {unpaid.length === 0 && (
          <p className="text-xs text-muted-foreground">Aucune facture impayée — solde à jour.</p>
        )}
        <div className="space-y-1">
          {unpaid.map((i) => (
            <div key={i.id} className="flex items-center justify-between text-xs border-b last:border-0 py-1">
              <div>
                <div className="font-medium">{i.invoice_number ?? i.id.slice(0, 8)}</div>
                <div className="text-muted-foreground">
                  {i.due_date ? `Échéance ${format(new Date(i.due_date), "dd MMM yyyy", { locale: fr })}` : "—"} · {i.status}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{fmtCAD(i.balance_due)}</div>
                <div className="text-muted-foreground">total {fmtCAD(i.total)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {credits.length > 0 && (
        <div className="border rounded-md p-3">
          <div className="text-xs font-semibold mb-2 flex items-center gap-2">
            <Gift className="h-3 w-3" /> Crédits disponibles
          </div>
          {credits.map((c: any) => (
            <div key={c.id} className="flex justify-between text-xs border-b last:border-0 py-1">
              <div>
                <div className="font-medium">{c.description ?? "Crédit"}</div>
                <div className="text-muted-foreground">
                  Créé {format(new Date(c.created_at), "dd MMM yyyy", { locale: fr })}
                  {c.months_total ? ` · ${c.applied_count ?? 0}/${c.months_total} mois` : ""}
                </div>
              </div>
              <div className="font-semibold">{fmtCAD(c.amount)}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  // ── Historique ─────────────────────────────────────────────────────────
  const history = (
    <div className="space-y-1">
      {payments.slice(0, 15).map((p) => (
        <div key={p.id} className="flex justify-between text-xs border-b last:border-0 py-1">
          <div>
            <div className="font-medium">{fmtCAD(p.amount)} · {p.method ?? p.provider ?? "—"}</div>
            <div className="text-muted-foreground">
              {p.created_at ? format(new Date(p.created_at), "dd MMM yyyy HH:mm", { locale: fr }) : "—"}
              {p.external_reference ? ` · ref ${p.external_reference}` : ""}
            </div>
          </div>
          <Badge variant={p.status === "confirmed" || p.status === "completed" ? "secondary" : "outline"}>
            {p.status ?? "—"}
          </Badge>
        </div>
      ))}
      {payments.length === 0 && <p className="text-xs text-muted-foreground">Aucun paiement enregistré.</p>}
    </div>
  );

  // ── Actions ────────────────────────────────────────────────────────────
  const actions = (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Utilise uniquement les workflows canoniques Nivra (apply_payment_to_invoice / apply_credit_to_invoice).
          Reçu, points fidélité et sync portail sont déclenchés automatiquement.
          <br />Pour un paiement par <b>carte</b>, utilise la page de facture (Square) — cette fenêtre gère les
          paiements hors-carte et l'application de crédits.
        </AlertDescription>
      </Alert>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label>Facture à régler</Label>
          <Select value={invoiceId} onValueChange={(v) => {
            setInvoiceId(v);
            const inv = invoices.find((i) => i.id === v);
            if (inv) setAmount(String(Number(inv.balance_due).toFixed(2)));
          }}>
            <SelectTrigger><SelectValue placeholder="Choisir une facture" /></SelectTrigger>
            <SelectContent>
              {unpaid.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.invoice_number ?? i.id.slice(0, 8)} — {fmtCAD(i.balance_due)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Montant (CAD)</Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label className="mb-2 block">Méthode</Label>
        <RadioGroup value={method} onValueChange={(v) => setMethod(v as Method)} className="grid md:grid-cols-2 gap-2">
          {(Object.keys(METHOD_LABEL) as Method[]).map((m) => {
            const Icon = METHOD_LABEL[m].icon;
            const disabled = m === "credit_account" && credits.length === 0;
            return (
              <label
                key={m}
                className={`flex items-start gap-2 border rounded-md p-2 cursor-pointer ${method === m ? "border-primary bg-muted/40" : ""} ${disabled ? "opacity-50 pointer-events-none" : ""}`}
              >
                <RadioGroupItem value={m} id={`m-${m}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="h-3 w-3" /> {METHOD_LABEL[m].label}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{METHOD_LABEL[m].hint}</div>
                </div>
              </label>
            );
          })}
        </RadioGroup>
      </div>

      {method === "credit_account" && (
        <div>
          <Label>Crédit à appliquer</Label>
          <Select value={creditId} onValueChange={setCreditId}>
            <SelectTrigger><SelectValue placeholder="Choisir un crédit actif" /></SelectTrigger>
            <SelectContent>
              {credits.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.description ?? "Crédit"} — {fmtCAD(c.amount)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {creditInsufficient && (
            <p className="text-xs text-destructive mt-1">
              Montant supérieur au crédit disponible ({fmtCAD(selectedCredit?.amount)}).
            </p>
          )}
        </div>
      )}

      {method !== "credit_account" && (
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Référence externe (optionnel)</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={method === "cheque" ? "N° de chèque" : method === "interac" ? "ID transfert Interac" : "N° reçu"}
            />
          </div>
          <div>
            <Label>Note interne (optionnel)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
        </div>
      )}

      {overpay && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Le montant dépasse le solde de la facture ({fmtCAD(selectedInvoice?.balance_due)}). Le surplus sera
            enregistré comme trop-perçu sur le compte selon les triggers canoniques.
          </AlertDescription>
        </Alert>
      )}

      {simQ.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Simulation impossible: {(simQ.error as any)?.message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );

  return (
    <ClientModuleShell
      open={open}
      onClose={onClose}
      title="Enregistrer un paiement"
      subtitle={`${clientName} · ${unpaid.length} facture(s) à régler · ${fmtCAD(totalDue)} dus`}
      clientId={clientId}
      moduleTag="record_payment"
      badges={[
        { label: method === "credit_account" ? "Crédit compte" : METHOD_LABEL[method].label },
        ...(overpay ? [{ label: "Trop-perçu", variant: "destructive" as const }] : []),
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
      confirmLabel={`Confirmer ${fmtCAD(amt)}`}
      onConfirm={onConfirm}
    />
  );
}
