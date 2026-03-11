/**
 * Invoice & Payment visible action bar for the Account 360 console.
 * All financial mutations go through canonical RPCs / DB operations.
 * NO DROPDOWNS — all actions are visible buttons.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  CreditCard, DollarSign, FileText, Mail, CheckCircle, RotateCcw, Plus, Minus, Banknote, Wallet,
} from "lucide-react";

/* ── styling tokens ── */
const inputCls = "w-full rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] px-2.5 py-1.5 text-[11px] text-white placeholder:text-[hsl(220,10%,30%)] outline-none focus:border-emerald-500/50";
const btnPrimary = "rounded-md bg-emerald-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors";
const btnSecondary = "rounded-md border border-[hsl(220,15%,16%)] px-4 py-1.5 text-[11px] font-medium text-[hsl(220,10%,50%)] hover:text-white transition-colors";

const actionBtn = "flex items-center gap-1.5 rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,13%)] px-2.5 py-1.5 text-[10px] font-medium transition-all whitespace-nowrap";
const actionDefault = `${actionBtn} text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/30`;
const actionAccent = `${actionBtn} text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/40`;
const actionWarning = `${actionBtn} text-amber-400 hover:text-amber-300 hover:border-amber-500/40`;
const actionDanger = `${actionBtn} text-red-400 hover:text-red-300 hover:border-red-500/40`;

/* ── types ── */
interface InvoiceActionsProps {
  invoices: any[];
  customerId: string | undefined;
  clientId: string | undefined;
  accountId: string | undefined;
  onRefresh: () => void;
}

type ModalType = null | "recordPayment" | "markPaid" | "sendInvoice" | "addCharge" | "addCredit" | "refundPayment";

export function InvoiceActionMenu({ invoices, customerId, clientId, accountId, onRefresh }: InvoiceActionsProps) {
  const [modal, setModal] = useState<ModalType>(null);

  return (
    <>
      {/* ── Visible Action Bar ── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => setModal("recordPayment")} className={actionAccent}>
          <Banknote className="h-3 w-3" /> Paiement manuel
        </button>
        <button onClick={() => setModal("markPaid")} className={actionDefault}>
          <CheckCircle className="h-3 w-3" /> Marquer payée
        </button>
        <button onClick={() => setModal("addCharge")} className={actionDefault}>
          <Plus className="h-3 w-3" /> Frais
        </button>
        <button onClick={() => setModal("addCredit")} className={actionDefault}>
          <Minus className="h-3 w-3" /> Crédit
        </button>
        <button onClick={() => setModal("sendInvoice")} className={actionDefault}>
          <Mail className="h-3 w-3" /> Envoyer
        </button>
        <button onClick={() => setModal("refundPayment")} className={actionWarning}>
          <RotateCcw className="h-3 w-3" /> Remboursement
        </button>
      </div>

      {modal === "recordPayment" && <RecordPaymentModal invoices={invoices} customerId={customerId} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "markPaid" && <MarkPaidModal invoices={invoices} customerId={customerId} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "sendInvoice" && <SendInvoiceModal invoices={invoices} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "addCharge" && <AdjustmentModal type="charge" invoices={invoices} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "addCredit" && <AdjustmentModal type="credit" invoices={invoices} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "refundPayment" && <RefundModal invoices={invoices} customerId={customerId} onClose={() => setModal(null)} onRefresh={onRefresh} />}
    </>
  );
}

/* ── Record Manual Payment Modal ── */
function RecordPaymentModal({ invoices, customerId, onClose, onRefresh }: { invoices: any[]; customerId?: string; onClose: () => void; onRefresh: () => void }) {
  const unpaid = invoices.filter((i: any) => (i.balance_due ?? 0) > 0);
  const [selectedInvoice, setSelectedInvoice] = useState(unpaid[0]?.id || "");
  const [method, setMethod] = useState<string>("interac");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);

  const inv = unpaid.find((i: any) => i.id === selectedInvoice);

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount) || inv?.balance_due;
    if (!inv || !customerId || !parsedAmount) return;
    setLoading(true);
    try {
      // Map method to billing_payment_method enum
      const methodMap: Record<string, string> = {
        paypal: "paypal", interac: "interac", cash: "manual",
        debit_credit: "manual", bank_transfer: "manual", manual: "manual",
      };
      const paymentNumber = `PAY-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.rpc("apply_payment_to_invoice" as any, {
        p_invoice_id: inv.id,
        p_customer_id: customerId,
        p_amount: parsedAmount,
        p_method: methodMap[method] || "manual",
        p_reference: reference || `${method}${reference ? ` - ${reference}` : ""}`,
        p_payment_number: paymentNumber,
        p_source: "admin_account_360",
      });
      if (error) throw error;
      toast.success(`Paiement de ${parsedAmount.toFixed(2)} $ enregistré (${method})`);
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
      <DialogContent className="bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2"><Banknote className="h-4 w-4 text-emerald-400" /> Enregistrer un paiement manuel</DialogTitle>
        </DialogHeader>
        {unpaid.length === 0 ? (
          <p className="text-[11px] text-[hsl(220,10%,45%)] py-4">Aucune facture impayée.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Facture</label>
              <select value={selectedInvoice} onChange={e => setSelectedInvoice(e.target.value)} className={inputCls}>
                {unpaid.map((i: any) => (
                  <option key={i.id} value={i.id}>{i.invoice_number} — Solde: {i.balance_due?.toFixed(2)} $</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Méthode de paiement</label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { value: "paypal", label: "PayPal", icon: Wallet },
                  { value: "interac", label: "Interac", icon: CreditCard },
                  { value: "cash", label: "Espèces", icon: Banknote },
                  { value: "debit_credit", label: "Débit/Crédit", icon: CreditCard },
                  { value: "bank_transfer", label: "Virement", icon: DollarSign },
                  { value: "manual", label: "Autre", icon: FileText },
                ].map(m => (
                  <button
                    key={m.value}
                    onClick={() => setMethod(m.value)}
                    className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[10px] font-medium transition-all ${
                      method === m.value
                        ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                        : "border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] text-[hsl(220,10%,45%)] hover:text-white"
                    }`}
                  >
                    <m.icon className="h-3 w-3 shrink-0" /> {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Montant ($)</label>
                <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder={inv?.balance_due?.toFixed(2) || "0.00"} className={inputCls} />
              </div>
              <div>
                <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Référence</label>
                <input value={reference} onChange={e => setReference(e.target.value)} placeholder="No. transaction" className={inputCls} />
              </div>
            </div>
            {inv && (
              <div className="rounded-md bg-[hsl(220,20%,9%)] border border-[hsl(220,15%,16%)] p-2.5 flex items-center justify-between">
                <p className="text-[10px] text-[hsl(220,10%,40%)]">Solde dû</p>
                <p className="text-lg font-bold text-red-400 tabular-nums">{inv.balance_due?.toFixed(2)} $</p>
              </div>
            )}
          </div>
        )}
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          {unpaid.length > 0 && <button onClick={handleSubmit} disabled={loading || !selectedInvoice} className={btnPrimary}>{loading ? "…" : "Enregistrer le paiement"}</button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Mark Paid Modal ── */
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
      const paymentNumber = `PAY-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.rpc("apply_payment_to_invoice" as any, {
        p_invoice_id: inv.id,
        p_customer_id: customerId,
        p_amount: inv.balance_due,
        p_method: method,
        p_reference: reference || null,
        p_payment_number: paymentNumber,
        p_source: "admin_account_360",
      });
      if (error) throw error;
      toast.success(`Facture ${inv.invoice_number} marquée comme payée`);
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
      <DialogContent className="bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-400" /> Marquer une facture payée</DialogTitle>
        </DialogHeader>
        {unpaid.length === 0 ? (
          <p className="text-[11px] text-[hsl(220,10%,45%)] py-4">Aucune facture impayée.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Facture</label>
              <select value={selectedInvoice} onChange={e => setSelectedInvoice(e.target.value)} className={inputCls}>
                {unpaid.map((i: any) => (
                  <option key={i.id} value={i.id}>{i.invoice_number} — Solde: {i.balance_due?.toFixed(2)} $</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Méthode</label>
              <select value={method} onChange={e => setMethod(e.target.value as any)} className={inputCls}>
                <option value="interac">Interac</option>
                <option value="paypal">PayPal</option>
                <option value="manual">Manuel</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Référence (optionnel)</label>
              <input value={reference} onChange={e => setReference(e.target.value)} placeholder="No. de transaction" className={inputCls} />
            </div>
            {inv && (
              <div className="rounded-md bg-[hsl(220,20%,9%)] border border-[hsl(220,15%,16%)] p-2.5">
                <p className="text-[10px] text-[hsl(220,10%,40%)]">Montant à appliquer</p>
                <p className="text-lg font-bold text-emerald-400 tabular-nums">{inv.balance_due?.toFixed(2)} $</p>
              </div>
            )}
          </div>
        )}
        <DialogFooter className="gap-2">
          <button onClick={onClose} className={btnSecondary}>Annuler</button>
          {unpaid.length > 0 && <button onClick={handleSubmit} disabled={loading || !selectedInvoice} className={btnPrimary}>{loading ? "…" : "Confirmer le paiement"}</button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Send Invoice Modal ── */
function SendInvoiceModal({ invoices, onClose, onRefresh }: { invoices: any[]; onClose: () => void; onRefresh: () => void }) {
  const [selectedInvoice, setSelectedInvoice] = useState(invoices[0]?.id || "");
  const [loading, setLoading] = useState(false);

  const inv = invoices.find((i: any) => i.id === selectedInvoice);

  const handleSend = async () => {
    if (!inv) return;
    const recipientEmail = inv.billing_snapshot_client?.email || inv.customer?.email || "";
    if (!recipientEmail) {
      toast.error("Aucune adresse courriel trouvée pour ce client");
      return;
    }
    setLoading(true);
    try {
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
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur d'envoi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2"><Mail className="h-4 w-4 text-emerald-400" /> Envoyer une facture</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Facture</label>
            <select value={selectedInvoice} onChange={e => setSelectedInvoice(e.target.value)} className={inputCls}>
              {invoices.map((i: any) => (
                <option key={i.id} value={i.id}>{i.invoice_number} — {i.total?.toFixed(2)} $ ({i.status})</option>
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

/* ── Adjustment Modal (Charge / Credit) ── */
function AdjustmentModal({ type, invoices, onClose, onRefresh }: { type: "charge" | "credit"; invoices: any[]; onClose: () => void; onRefresh: () => void }) {
  const [selectedInvoice, setSelectedInvoice] = useState(invoices[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const isCharge = type === "charge";

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount);
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
      <DialogContent className="bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            {isCharge ? <Plus className="h-4 w-4 text-amber-400" /> : <Minus className="h-4 w-4 text-emerald-400" />}
            {isCharge ? "Ajouter un frais" : "Appliquer un crédit"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Facture cible</label>
            <select value={selectedInvoice} onChange={e => setSelectedInvoice(e.target.value)} className={inputCls}>
              {invoices.map((i: any) => (
                <option key={i.id} value={i.id}>{i.invoice_number} — Solde: {i.balance_due?.toFixed(2)} $</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Montant ($)</label>
            <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder={isCharge ? "Ex: Frais administratif" : "Ex: Crédit promotionnel"} className={inputCls} />
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

/* ── Refund Modal ── */
function RefundModal({ invoices, customerId, onClose, onRefresh }: { invoices: any[]; customerId?: string; onClose: () => void; onRefresh: () => void }) {
  const paidInvoices = invoices.filter((i: any) => (i.amount_paid ?? 0) > 0);
  const [selectedInvoice, setSelectedInvoice] = useState(paidInvoices[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const inv = paidInvoices.find((i: any) => i.id === selectedInvoice);

  const handleRefund = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0 || !inv || !reason.trim()) {
      toast.error("Veuillez remplir tous les champs");
      return;
    }
    if (parsedAmount > (inv.amount_paid ?? 0)) {
      toast.error("Le montant dépasse le total payé");
      return;
    }
    setLoading(true);
    try {
      const paymentNumber = `REF-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("billing_payments").insert({
        invoice_id: inv.id,
        customer_id: customerId!,
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
      <DialogContent className="bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2"><RotateCcw className="h-4 w-4 text-amber-400" /> Rembourser un paiement</DialogTitle>
        </DialogHeader>
        {paidInvoices.length === 0 ? (
          <p className="text-[11px] text-[hsl(220,10%,45%)] py-4">Aucune facture avec paiement.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Facture</label>
              <select value={selectedInvoice} onChange={e => setSelectedInvoice(e.target.value)} className={inputCls}>
                {paidInvoices.map((i: any) => (
                  <option key={i.id} value={i.id}>{i.invoice_number} — Payé: {i.amount_paid?.toFixed(2)} $</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Montant à rembourser ($)</label>
              <input type="number" step="0.01" min="0" max={inv?.amount_paid ?? 0} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider block mb-1">Raison</label>
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
