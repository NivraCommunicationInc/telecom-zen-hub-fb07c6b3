/**
 * Invoice & Payment action modals for the Account 360 console.
 * All financial mutations go through canonical RPCs / DB operations.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown, CreditCard, DollarSign, FileText, Mail, CheckCircle, RotateCcw, Plus, Minus,
} from "lucide-react";

/* ── styling tokens ── */
const inputCls = "w-full rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,9%)] px-2.5 py-1.5 text-[11px] text-white placeholder:text-[hsl(220,10%,30%)] outline-none focus:border-emerald-500/50";
const btnPrimary = "rounded-md bg-emerald-600 px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors";
const btnSecondary = "rounded-md border border-[hsl(220,15%,16%)] px-4 py-1.5 text-[11px] font-medium text-[hsl(220,10%,50%)] hover:text-white transition-colors";

/* ── types ── */
interface InvoiceActionsProps {
  invoices: any[];
  customerId: string | undefined;
  clientId: string | undefined;
  accountId: string | undefined;
  onRefresh: () => void;
}

type ModalType = null | "markPaid" | "sendInvoice" | "addCharge" | "addCredit" | "refundPayment";

export function InvoiceActionMenu({ invoices, customerId, clientId, accountId, onRefresh }: InvoiceActionsProps) {
  const [modal, setModal] = useState<ModalType>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-1 rounded-md border border-[hsl(220,15%,16%)] bg-[hsl(220,20%,13%)] px-2 py-1 text-[10px] font-medium text-[hsl(220,10%,50%)] hover:text-white hover:border-emerald-500/30 transition-colors">
            Actions <ChevronDown className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-[hsl(220,20%,11%)] border-[hsl(220,15%,16%)] text-white">
          <DropdownMenuLabel className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider">Facturation</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setModal("markPaid")} className="text-[11px] gap-2 focus:bg-emerald-500/10 focus:text-emerald-400">
            <CheckCircle className="h-3.5 w-3.5" /> Marquer une facture payée
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setModal("sendInvoice")} className="text-[11px] gap-2 focus:bg-emerald-500/10 focus:text-emerald-400">
            <Mail className="h-3.5 w-3.5" /> Envoyer une facture au client
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[hsl(220,15%,16%)]" />
          <DropdownMenuLabel className="text-[10px] text-[hsl(220,10%,40%)] uppercase tracking-wider">Ajustements</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setModal("addCharge")} className="text-[11px] gap-2 focus:bg-emerald-500/10 focus:text-emerald-400">
            <Plus className="h-3.5 w-3.5" /> Ajouter un frais
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setModal("addCredit")} className="text-[11px] gap-2 focus:bg-emerald-500/10 focus:text-emerald-400">
            <Minus className="h-3.5 w-3.5" /> Appliquer un crédit
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[hsl(220,15%,16%)]" />
          <DropdownMenuItem onClick={() => setModal("refundPayment")} className="text-[11px] gap-2 text-amber-400 focus:bg-amber-500/10 focus:text-amber-300">
            <RotateCcw className="h-3.5 w-3.5" /> Rembourser un paiement
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {modal === "markPaid" && <MarkPaidModal invoices={invoices} customerId={customerId} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "sendInvoice" && <SendInvoiceModal invoices={invoices} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "addCharge" && <AdjustmentModal type="charge" invoices={invoices} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "addCredit" && <AdjustmentModal type="credit" invoices={invoices} onClose={() => setModal(null)} onRefresh={onRefresh} />}
      {modal === "refundPayment" && <RefundModal invoices={invoices} customerId={customerId} onClose={() => setModal(null)} onRefresh={onRefresh} />}
    </>
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
    setLoading(true);
    try {
      const { error } = await supabase.from("email_queue").insert({
        template_key: "invoice_sent",
        to_email: inv.billing_snapshot_client?.email || "",
        subject: `Facture ${inv.invoice_number}`,
        template_vars: {
          invoice_number: inv.invoice_number,
          total: inv.total,
          due_date: inv.due_date,
          manual_send: true,
        },
        status: "pending",
      });
      if (error) throw error;
      toast.success(`Facture ${inv.invoice_number} envoyée`);
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

      // Recalculate invoice totals
      await supabase.rpc("reconcile_invoice_from_payments" as any, { target_invoice_id: selectedInvoice });

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
      // Add a negative payment as refund
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

      await supabase.rpc("reconcile_invoice_from_payments" as any, { target_invoice_id: inv.id });

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
          {paidInvoices.length > 0 && <button onClick={handleRefund} disabled={loading} className={`${btnPrimary} !bg-amber-600 hover:!bg-amber-500`}>{loading ? "…" : "Rembourser"}</button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
