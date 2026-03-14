/**
 * Invoice & Payment visible action bar for the Account 360 console.
 * All financial mutations go through canonical RPCs / DB operations.
 */
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  CreditCard, DollarSign, FileText, Mail, CheckCircle, RotateCcw, Plus, Minus, Banknote, Wallet,
} from "lucide-react";

const inputCls = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50";
const btnPrimary = "rounded-md bg-primary px-4 py-1.5 text-[11px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity";
const btnSecondary = "rounded-md border border-border px-4 py-1.5 text-[11px] font-medium text-foreground hover:bg-muted/40 transition-colors";

const actionBtn = "flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[10px] font-semibold transition-all whitespace-nowrap";
const actionDefault = `${actionBtn} text-foreground/80 hover:text-foreground hover:border-primary/30`;
const actionAccent = `${actionBtn} text-primary hover:text-primary hover:border-primary/40`;
const actionWarning = `${actionBtn} text-amber-500 hover:text-amber-400 hover:border-amber-500/40`;

interface InvoiceActionsProps {
  invoices: any[];
  customerId: string | undefined;
  customerUserId?: string;
  fallbackRecipientEmail?: string;
  fallbackCustomerEmail?: string;
  onRefresh: () => void;
}

type ModalType = null | "recordPayment" | "markPaid" | "sendInvoice" | "addCharge" | "addCredit" | "refundPayment";

type ManualMethod = "paypal" | "interac" | "cash" | "debit_credit" | "bank_transfer" | "other";
type ApplyMode = "invoice" | "account";

const mapToBillingMethod = (method: ManualMethod): "paypal" | "interac" | "manual" => {
  if (method === "paypal") return "paypal";
  if (method === "interac") return "interac";
  return "manual";
};

const methodLabels: Record<ManualMethod, string> = {
  paypal: "PayPal",
  interac: "Interac e-Transfer",
  cash: "Espèces",
  debit_credit: "Débit / crédit",
  bank_transfer: "Virement bancaire",
  other: "Autre",
};

export function InvoiceActionMenu({
  invoices,
  customerId,
  customerUserId,
  fallbackRecipientEmail,
  fallbackCustomerEmail,
  onRefresh,
}: InvoiceActionsProps) {
  const [modal, setModal] = useState<ModalType>(null);

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => setModal("recordPayment")} className={actionAccent}>
          <Banknote className="h-3 w-3" /> Paiement manuel
        </button>
        <button onClick={() => setModal("markPaid")} className={actionDefault}>
          <CheckCircle className="h-3 w-3" /> Marquer payée
        </button>
        <button onClick={() => setModal("addCharge")} className={actionDefault}>
          <Plus className="h-3 w-3" /> Ajouter frais
        </button>
        <button onClick={() => setModal("addCredit")} className={actionDefault}>
          <Minus className="h-3 w-3" /> Ajouter crédit
        </button>
        <button onClick={() => setModal("sendInvoice")} className={actionDefault}>
          <Mail className="h-3 w-3" /> Envoyer facture
        </button>
        <button onClick={() => setModal("refundPayment")} className={actionWarning}>
          <RotateCcw className="h-3 w-3" /> Remboursement
        </button>
      </div>

      {modal === "recordPayment" && (
        <RecordPaymentModal invoices={invoices} customerId={customerId} onClose={() => setModal(null)} onRefresh={onRefresh} />
      )}
      {modal === "markPaid" && (
        <MarkPaidModal invoices={invoices} customerId={customerId} onClose={() => setModal(null)} onRefresh={onRefresh} />
      )}
      {modal === "sendInvoice" && (
        <SendInvoiceModal
          invoices={invoices}
          customerId={customerId}
          customerUserId={customerUserId}
          fallbackRecipientEmail={fallbackRecipientEmail}
          fallbackCustomerEmail={fallbackCustomerEmail}
          onClose={() => setModal(null)}
          onRefresh={onRefresh}
        />
      )}
      {modal === "addCharge" && <AdjustmentModal type="charge" invoices={invoices} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "addCredit" && <AdjustmentModal type="credit" invoices={invoices} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "refundPayment" && <RefundModal invoices={invoices} customerId={customerId} onClose={() => setModal(null)} onRefresh={onRefresh} />}
    </>
  );
}

function RecordPaymentModal({ invoices, customerId, onClose, onRefresh }: { invoices: any[]; customerId?: string; onClose: () => void; onRefresh: () => void }) {
  const unpaid = useMemo(
    () => invoices.filter((i: any) => (i.balance_due ?? 0) > 0).sort((a: any, b: any) => new Date(a.due_date ?? a.created_at).getTime() - new Date(b.due_date ?? b.created_at).getTime()),
    [invoices],
  );

  const [applyMode, setApplyMode] = useState<ApplyMode>("invoice");
  const [selectedInvoice, setSelectedInvoice] = useState(unpaid[0]?.id || "");
  const [amountMode, setAmountMode] = useState<"partial" | "full">("full");
  const [method, setMethod] = useState<ManualMethod>("interac");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [loading, setLoading] = useState(false);

  const targetInvoice = applyMode === "account"
    ? unpaid[0]
    : unpaid.find((i: any) => i.id === selectedInvoice);

  const amountToApply = amountMode === "full"
    ? Number(targetInvoice?.balance_due ?? 0)
    : Number.parseFloat(amount || "0");

  const handleSubmit = async () => {
    if (!customerId || !targetInvoice) {
      toast.error("Aucune facture admissible pour appliquer le paiement");
      return;
    }

    if (!Number.isFinite(amountToApply) || amountToApply <= 0) {
      toast.error("Montant de paiement invalide");
      return;
    }

    setLoading(true);
    try {
      const providerPaymentId = reference?.trim() || `manual_${method}_${Date.now()}`;
      const source = "admin";

      const { error } = await supabase.rpc("apply_payment_to_invoice" as any, {
        p_invoice_id: targetInvoice.id,
        p_customer_id: customerId,
        p_amount: amountToApply,
        p_method: mapToBillingMethod(method),
        p_provider: method,
        p_provider_payment_id: providerPaymentId,
        p_source: source,
        p_created_by_name: "Account 360",
        p_created_by_role: "admin",
      });
      if (error) throw error;

      if (internalNote.trim()) {
        const user = (await supabase.auth.getUser()).data.user;
        await supabase.from("activity_logs").insert({
          user_id: user?.id || "system",
          entity_type: "billing_payment",
          entity_id: targetInvoice.id,
          action: "manual_payment_note",
          reason: internalNote.trim(),
          details: {
            amount: amountToApply,
            method,
            reference: reference || null,
            apply_mode: applyMode,
            source: "account_360",
          },
        });
      }

      toast.success(`Paiement ${amountToApply.toFixed(2)} $ appliqué (${methodLabels[method]})`);
      onRefresh();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'application du paiement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2"><Banknote className="h-4 w-4 text-primary" /> Paiement manuel</DialogTitle>
        </DialogHeader>

        {unpaid.length === 0 ? (
          <p className="text-[11px] text-muted-foreground py-4">Aucune facture ouverte pour appliquer un paiement.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setApplyMode("invoice")} className={`${btnSecondary} ${applyMode === "invoice" ? "border-primary text-primary" : ""}`}>
                Appliquer à une facture
              </button>
              <button type="button" onClick={() => setApplyMode("account")} className={`${btnSecondary} ${applyMode === "account" ? "border-primary text-primary" : ""}`}>
                Appliquer au solde compte
              </button>
            </div>

            {applyMode === "invoice" ? (
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Facture cible</label>
                <select value={selectedInvoice} onChange={(e) => setSelectedInvoice(e.target.value)} className={inputCls}>
                  {unpaid.map((i: any) => (
                    <option key={i.id} value={i.id}>{i.invoice_number} — Solde: {Number(i.balance_due || 0).toFixed(2)} $</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="rounded-md border border-border bg-background p-2.5 text-[11px]">
                <p className="text-muted-foreground">Paiement appliqué automatiquement à la plus ancienne facture ouverte.</p>
                {targetInvoice && <p className="mt-1 font-medium">{targetInvoice.invoice_number} — Solde: {Number(targetInvoice.balance_due || 0).toFixed(2)} $</p>}
              </div>
            )}

            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Méthode de paiement</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { value: "paypal", label: "PayPal", icon: Wallet },
                  { value: "interac", label: "Interac", icon: CreditCard },
                  { value: "cash", label: "Espèces", icon: Banknote },
                  { value: "debit_credit", label: "Débit / crédit", icon: CreditCard },
                  { value: "bank_transfer", label: "Virement", icon: DollarSign },
                  { value: "other", label: "Autre", icon: FileText },
                ].map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMethod(m.value as ManualMethod)}
                    className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] font-semibold transition-all ${
                      method === m.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-foreground/80 hover:text-foreground"
                    }`}
                  >
                    <m.icon className="h-3 w-3 shrink-0" /> {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Montant</label>
                <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                  <button type="button" onClick={() => setAmountMode("full")} className={`${btnSecondary} !px-2 ${amountMode === "full" ? "border-primary text-primary" : ""}`}>
                    Complet
                  </button>
                  <button type="button" onClick={() => setAmountMode("partial")} className={`${btnSecondary} !px-2 ${amountMode === "partial" ? "border-primary text-primary" : ""}`}>
                    Partiel
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amountMode === "partial" ? amount : Number(targetInvoice?.balance_due || 0).toFixed(2)}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={amountMode === "full"}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Référence</label>
                <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="No. transaction" className={inputCls} />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Note interne</label>
              <Textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} rows={2} placeholder="Notes opérationnelles" className="text-[11px]" />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          {unpaid.length > 0 && (
            <button onClick={handleSubmit} disabled={loading} className={btnPrimary}>
              {loading ? "…" : "Appliquer le paiement"}
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MarkPaidModal({ invoices, customerId, onClose, onRefresh }: { invoices: any[]; customerId?: string; onClose: () => void; onRefresh: () => void }) {
  const unpaid = invoices.filter((i: any) => (i.balance_due ?? 0) > 0);
  const [selectedInvoice, setSelectedInvoice] = useState(unpaid[0]?.id || "");
  const [method, setMethod] = useState<"interac" | "manual" | "paypal">("manual");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);

  const inv = unpaid.find((i: any) => i.id === selectedInvoice);

  const handleSubmit = async () => {
    if (!inv || !customerId) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc("apply_payment_to_invoice" as any, {
        p_invoice_id: inv.id,
        p_customer_id: customerId,
        p_amount: Number(inv.balance_due || 0),
        p_method: method,
        p_provider: method,
        p_provider_payment_id: reference || `mark_paid_${Date.now()}`,
        p_source: "admin_mark_paid",
        p_created_by_name: "Account 360",
        p_created_by_role: "admin",
      });
      if (error) throw error;
      toast.success(`Facture ${inv.invoice_number} marquée payée`);
      onRefresh();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur lors du paiement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2"><CheckCircle className="h-4 w-4 text-primary" /> Marquer une facture payée</DialogTitle>
        </DialogHeader>
        {unpaid.length === 0 ? (
          <p className="text-[11px] text-muted-foreground py-4">Aucune facture impayée.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Facture</label>
              <select value={selectedInvoice} onChange={e => setSelectedInvoice(e.target.value)} className={inputCls}>
                {unpaid.map((i: any) => (
                  <option key={i.id} value={i.id}>{i.invoice_number} — Solde: {Number(i.balance_due || 0).toFixed(2)} $</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Méthode</label>
              <select value={method} onChange={e => setMethod(e.target.value as any)} className={inputCls}>
                <option value="interac">Interac</option>
                <option value="paypal">PayPal</option>
                <option value="manual">Manuel</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Référence (optionnel)</label>
              <input value={reference} onChange={e => setReference(e.target.value)} placeholder="No. de transaction" className={inputCls} />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          {unpaid.length > 0 && <button onClick={handleSubmit} disabled={loading || !selectedInvoice} className={btnPrimary}>{loading ? "…" : "Confirmer"}</button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function resolveRecipientEmail(inv: any, options: { fallbackRecipientEmail?: string; fallbackCustomerEmail?: string; customerId?: string; customerUserId?: string }) {
  const localCandidates = [
    inv?.billing_snapshot_client?.email,
    inv?.customer?.email,
    options.fallbackRecipientEmail,
    options.fallbackCustomerEmail,
  ]
    .filter(Boolean)
    .map((e: string) => e.trim().toLowerCase());

  if (localCandidates.length > 0) return localCandidates[0];

  if (options.customerId) {
    const { data: billingCustomer } = await supabase
      .from("billing_customers")
      .select("email")
      .eq("id", options.customerId)
      .maybeSingle();
    if (billingCustomer?.email) return billingCustomer.email.trim().toLowerCase();
  }

  if (options.customerUserId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("user_id", options.customerUserId)
      .maybeSingle();
    if (profile?.email) return profile.email.trim().toLowerCase();
  }

  return "";
}

function SendInvoiceModal({
  invoices,
  customerId,
  customerUserId,
  fallbackRecipientEmail,
  fallbackCustomerEmail,
  onClose,
  onRefresh,
}: {
  invoices: any[];
  customerId?: string;
  customerUserId?: string;
  fallbackRecipientEmail?: string;
  fallbackCustomerEmail?: string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [selectedInvoice, setSelectedInvoice] = useState(invoices[0]?.id || "");
  const [loading, setLoading] = useState(false);

  const inv = invoices.find((i: any) => i.id === selectedInvoice);

  const handleSend = async () => {
    if (!inv) return;

    setLoading(true);
    try {
      const recipientEmail = await resolveRecipientEmail(inv, {
        fallbackRecipientEmail,
        fallbackCustomerEmail,
        customerId,
        customerUserId,
      });

      if (!recipientEmail) {
        toast.error("Aucune adresse courriel trouvée pour ce client");
        return;
      }

      const eventKey = `manual_invoice_sent_${inv.id}_${Date.now()}`;
      const { error } = await supabase.from("email_queue").insert({
        event_key: eventKey,
        template_key: "invoice_sent",
        to_email: recipientEmail,
        subject: `Facture ${inv.invoice_number}`,
        template_vars: {
          invoice_number: inv.invoice_number,
          total: inv.total,
          due_date: inv.due_date,
          balance_due: inv.balance_due,
          manual_send: true,
        },
        entity_type: "invoice",
        entity_id: inv.id,
        message_type: "invoice_sent",
        status: "queued",
      });
      if (error) throw error;

      toast.success(`Facture ${inv.invoice_number} envoyée à ${recipientEmail}`);
      onRefresh();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur d'envoi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> Envoyer une facture</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Facture</label>
            <select value={selectedInvoice} onChange={e => setSelectedInvoice(e.target.value)} className={inputCls}>
              {invoices.map((i: any) => (
                <option key={i.id} value={i.id}>{i.invoice_number} — {Number(i.total || 0).toFixed(2)} $ ({i.status})</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          <button onClick={handleSend} disabled={loading || !selectedInvoice} className={btnPrimary}>{loading ? "…" : "Envoyer"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustmentModal({ type, invoices, onClose, onRefresh }: { type: "charge" | "credit"; invoices: any[]; onClose: () => void; onRefresh: () => void }) {
  const [selectedInvoice, setSelectedInvoice] = useState(invoices[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const isCharge = type === "charge";

  const handleSubmit = async () => {
    const parsedAmount = Number.parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0 || !selectedInvoice || !description.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    setLoading(true);
    try {
      const lineTotal = isCharge ? parsedAmount : -parsedAmount;
      const { error } = await supabase.from("billing_invoice_lines").insert({
        invoice_id: selectedInvoice,
        description: description.trim(),
        unit_price: Math.abs(parsedAmount),
        quantity: 1,
        line_total: lineTotal,
        line_type: isCharge ? "charge" : "credit",
      });
      if (error) throw error;

      await supabase.rpc("reconcile_invoice_from_payments" as any, { p_invoice_id: selectedInvoice });

      toast.success(`${isCharge ? "Frais" : "Crédit"} de ${parsedAmount.toFixed(2)} $ ajouté`);
      onRefresh();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            {isCharge ? <Plus className="h-4 w-4 text-amber-500" /> : <Minus className="h-4 w-4 text-primary" />}
            {isCharge ? "Ajouter un frais" : "Ajouter un crédit"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Facture cible</label>
            <select value={selectedInvoice} onChange={e => setSelectedInvoice(e.target.value)} className={inputCls}>
              {invoices.map((i: any) => (
                <option key={i.id} value={i.id}>{i.invoice_number} — Solde: {Number(i.balance_due || 0).toFixed(2)} $</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Montant ($)</label>
            <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder={isCharge ? "Ex: Frais administratif" : "Ex: Crédit commercial"} className={inputCls} />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          <button onClick={handleSubmit} disabled={loading} className={btnPrimary}>{loading ? "…" : "Appliquer"}</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RefundModal({ invoices, customerId, onClose, onRefresh }: { invoices: any[]; customerId?: string; onClose: () => void; onRefresh: () => void }) {
  const paidInvoices = invoices.filter((i: any) => (i.amount_paid ?? 0) > 0);
  const [selectedInvoice, setSelectedInvoice] = useState(paidInvoices[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const inv = paidInvoices.find((i: any) => i.id === selectedInvoice);

  const handleRefund = async () => {
    const parsedAmount = Number.parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0 || !inv || !reason.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    if (parsedAmount > Number(inv.amount_paid ?? 0)) {
      toast.error("Le montant dépasse le total payé");
      return;
    }
    if (!customerId) {
      toast.error("Client introuvable pour le remboursement");
      return;
    }

    setLoading(true);
    try {
      const paymentNumber = `REF-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("billing_payments").insert({
        invoice_id: inv.id,
        customer_id: customerId,
        amount: -parsedAmount,
        method: "manual" as const,
        status: "confirmed" as const,
        payment_number: paymentNumber,
        reference: `Remboursement: ${reason}`,
        source: "admin_refund",
        received_at: new Date().toISOString(),
      });
      if (error) throw error;

      await supabase.rpc("reconcile_invoice_from_payments" as any, { p_invoice_id: inv.id });

      toast.success(`Remboursement de ${parsedAmount.toFixed(2)} $ appliqué`);
      onRefresh();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md border-border bg-card text-foreground">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2"><RotateCcw className="h-4 w-4 text-amber-500" /> Rembourser un paiement</DialogTitle>
        </DialogHeader>
        {paidInvoices.length === 0 ? (
          <p className="text-[11px] text-muted-foreground py-4">Aucune facture avec paiement.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Facture</label>
              <select value={selectedInvoice} onChange={e => setSelectedInvoice(e.target.value)} className={inputCls}>
                {paidInvoices.map((i: any) => (
                  <option key={i.id} value={i.id}>{i.invoice_number} — Payé: {Number(i.amount_paid || 0).toFixed(2)} $</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Montant à rembourser ($)</label>
              <input type="number" step="0.01" min="0" max={inv?.amount_paid ?? 0} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Raison</label>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Raison du remboursement" className={inputCls} />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          {paidInvoices.length > 0 && <button onClick={handleRefund} disabled={loading} className={btnPrimary}>{loading ? "…" : "Rembourser"}</button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
