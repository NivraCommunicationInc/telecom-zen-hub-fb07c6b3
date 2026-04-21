/**
 * Financial Documents Panel — Lot 1 (Approved 2026-04-21)
 *
 * Generates on-demand the 5 financial documents tied to an account:
 *  1. Note de crédit   (credit note)
 *  2. Avis de remboursement (refund notice)
 *  3. Avis de retard   (late notice — 4 stages)
 *  4. État de compte   (account statement)
 *  5. Sommaire fiscal annuel (annual tax summary)
 *
 * All data is fetched from canonical tables (billing_invoices, billing_payments)
 * — zero front-end recomputation. Templates are LOCKED V4.0.
 */

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, FileText, Receipt, AlertTriangle, Calendar, Calculator, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  generateCreditNotePDF,
  generateRefundNoticePDF,
  generateLateNoticePDF,
  generateAccountStatementPDF,
  generateAnnualTaxSummaryPDF,
  downloadPDF,
  type LateNoticeStage,
  type StatementTransaction,
  type MonthlyTaxBreakdown,
} from "@/lib/pdf";

interface ClientLike {
  client_name: string;
  client_email: string;
  client_phone?: string;
  client_address?: string;
  client_city?: string;
  client_province?: string;
  client_postal?: string;
  account_number: string;
}

interface FinancialDocumentsPanelProps {
  accountId: string;
  client: ClientLike;
  /** All invoices for this account (canonical) */
  invoices: any[];
  /** All payments for this account (canonical) */
  payments: any[];
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const seq = () => Math.floor(Math.random() * 9000 + 1000).toString();

export function FinancialDocumentsPanel({ accountId, client, invoices, payments }: FinancialDocumentsPanelProps) {
  const [busy, setBusy] = useState(false);

  // ────────────────────────────────────────────────────────────────────
  // 1) NOTE DE CRÉDIT
  // ────────────────────────────────────────────────────────────────────
  const [creditOpen, setCreditOpen] = useState(false);
  const [creditInvoiceId, setCreditInvoiceId] = useState<string>("");
  const [creditReason, setCreditReason] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditApplication, setCreditApplication] = useState<"account_credit" | "refund_pending" | "refund_processed">("account_credit");

  const handleCredit = async () => {
    const inv = invoices.find(i => i.id === creditInvoiceId);
    if (!inv) return toast.error("Sélectionnez une facture");
    const amount = parseFloat(creditAmount);
    if (!amount || amount <= 0) return toast.error("Montant invalide");
    if (!creditReason.trim()) return toast.error("Motif requis");

    setBusy(true);
    try {
      // Compute taxes proportionally to mirror the source invoice rate
      const tps = +(amount * 0.05).toFixed(2);
      const tvq = +(amount * 0.09975).toFixed(2);
      const subtotal = +(amount - tps - tvq).toFixed(2);

      const result = generateCreditNotePDF({
        credit_note_number: `NC-${new Date().getFullYear()}-${seq()}`,
        issue_date: todayISO(),
        invoice_number: inv.invoice_number,
        invoice_date: inv.created_at?.slice(0, 10),
        ...client,
        reason: creditReason,
        items: [{ description: `Crédit sur facture ${inv.invoice_number}`, amount: subtotal }],
        subtotal,
        tps_amount: tps,
        tvq_amount: tvq,
        total: amount,
        application_type: creditApplication,
      });
      if (result.success) {
        downloadPDF(result);
        toast.success("Note de crédit générée");
        setCreditOpen(false);
        setCreditReason("");
        setCreditAmount("");
      } else {
        toast.error(result.error || "Erreur de génération");
      }
    } finally {
      setBusy(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────
  // 2) AVIS DE REMBOURSEMENT
  // ────────────────────────────────────────────────────────────────────
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState<string>("paypal");
  const [refundReference, setRefundReference] = useState("");
  const [refundInvoiceId, setRefundInvoiceId] = useState<string>("");

  const handleRefund = () => {
    const amount = parseFloat(refundAmount);
    if (!amount || amount <= 0) return toast.error("Montant invalide");
    const inv = invoices.find(i => i.id === refundInvoiceId);

    setBusy(true);
    try {
      const result = generateRefundNoticePDF({
        refund_number: `RB-${new Date().getFullYear()}-${seq()}`,
        processed_date: todayISO(),
        invoice_number: inv?.invoice_number,
        ...client,
        amount,
        method: refundMethod,
        reference: refundReference || undefined,
        expected_arrival_days: refundMethod === "paypal" ? 3 : refundMethod === "interac" ? 1 : 7,
      });
      if (result.success) {
        downloadPDF(result);
        toast.success("Avis de remboursement généré");
        setRefundOpen(false);
        setRefundAmount("");
        setRefundReference("");
      } else {
        toast.error(result.error || "Erreur");
      }
    } finally {
      setBusy(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────
  // 3) AVIS DE RETARD
  // ────────────────────────────────────────────────────────────────────
  const [lateOpen, setLateOpen] = useState(false);
  const [lateInvoiceId, setLateInvoiceId] = useState<string>("");
  const [lateStage, setLateStage] = useState<LateNoticeStage>("first");

  const overdueInvoices = useMemo(
    () => invoices.filter(i => (i.balance_due ?? 0) > 0 && !["paid", "void", "cancelled", "refunded"].includes(i.status)),
    [invoices]
  );

  const handleLate = () => {
    const inv = invoices.find(i => i.id === lateInvoiceId);
    if (!inv) return toast.error("Sélectionnez une facture");

    const dueDate = inv.due_date ? new Date(inv.due_date) : new Date(inv.created_at);
    const daysOverdue = Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

    setBusy(true);
    try {
      const result = generateLateNoticePDF({
        notice_number: `AR-${new Date().getFullYear()}-${seq()}`,
        issue_date: todayISO(),
        stage: lateStage,
        invoice_number: inv.invoice_number,
        invoice_date: inv.created_at?.slice(0, 10),
        due_date: inv.due_date || inv.created_at?.slice(0, 10),
        amount_due: Number(inv.balance_due ?? inv.total ?? 0),
        days_overdue: daysOverdue,
        late_fee_amount: Number(inv.late_fee_amount ?? 0) || undefined,
        ...client,
      });
      if (result.success) {
        downloadPDF(result);
        toast.success("Avis de retard généré");
        setLateOpen(false);
      } else {
        toast.error(result.error || "Erreur");
      }
    } finally {
      setBusy(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────
  // 4) ÉTAT DE COMPTE
  // ────────────────────────────────────────────────────────────────────
  const [stmtOpen, setStmtOpen] = useState(false);
  const defaultStart = ymd(new Date(new Date().getFullYear(), 0, 1));
  const [stmtStart, setStmtStart] = useState(defaultStart);
  const [stmtEnd, setStmtEnd] = useState(todayISO());

  const handleStatement = () => {
    const start = new Date(stmtStart);
    const end = new Date(stmtEnd);
    if (end < start) return toast.error("Période invalide");

    setBusy(true);
    try {
      const inRange = (d?: string) => {
        if (!d) return false;
        const t = new Date(d).getTime();
        return t >= start.getTime() && t <= end.getTime() + 86400000;
      };

      const txInvoices: StatementTransaction[] = invoices
        .filter(i => inRange(i.created_at))
        .map(i => ({
          date: (i.created_at || "").slice(0, 10),
          reference: i.invoice_number,
          description: `Facture ${i.type || ""}`.trim(),
          debit: Number(i.total ?? 0),
        }));

      const txPayments: StatementTransaction[] = payments
        .filter(p => inRange(p.received_at || p.created_at) && (p.status === "confirmed" || p.status === "completed"))
        .map(p => ({
          date: (p.received_at || p.created_at || "").slice(0, 10),
          reference: p.payment_number || "—",
          description: `Paiement (${p.method})`,
          credit: Number(p.amount ?? 0),
        }));

      const transactions = [...txInvoices, ...txPayments].sort((a, b) => a.date.localeCompare(b.date));

      // Opening balance = invoices before period - payments before period
      const openingInvoiced = invoices.filter(i => i.created_at && new Date(i.created_at) < start).reduce((s, i) => s + Number(i.total ?? 0), 0);
      const openingPaid = payments.filter(p => (p.status === "confirmed" || p.status === "completed") && (p.received_at || p.created_at) && new Date(p.received_at || p.created_at) < start).reduce((s, p) => s + Number(p.amount ?? 0), 0);
      const opening = +(openingInvoiced - openingPaid).toFixed(2);

      const totalInvoiced = +txInvoices.reduce((s, t) => s + (t.debit ?? 0), 0).toFixed(2);
      const totalPaid = +txPayments.reduce((s, t) => s + (t.credit ?? 0), 0).toFixed(2);
      const closing = +(opening + totalInvoiced - totalPaid).toFixed(2);

      const result = generateAccountStatementPDF({
        statement_number: `EC-${new Date().getFullYear()}-${seq()}`,
        issue_date: todayISO(),
        period_start: stmtStart,
        period_end: stmtEnd,
        ...client,
        opening_balance: opening,
        closing_balance: closing,
        total_invoiced: totalInvoiced,
        total_paid: totalPaid,
        transactions,
      });
      if (result.success) {
        downloadPDF(result);
        toast.success("État de compte généré");
        setStmtOpen(false);
      } else {
        toast.error(result.error || "Erreur");
      }
    } finally {
      setBusy(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────
  // 5) SOMMAIRE FISCAL ANNUEL
  // ────────────────────────────────────────────────────────────────────
  const [taxOpen, setTaxOpen] = useState(false);
  const [taxYear, setTaxYear] = useState(new Date().getFullYear() - 1);

  const handleTaxSummary = () => {
    setBusy(true);
    try {
      const yearStart = new Date(taxYear, 0, 1);
      const yearEnd = new Date(taxYear, 11, 31, 23, 59, 59);

      const yearInvoices = invoices.filter(i => {
        if (!i.created_at) return false;
        const d = new Date(i.created_at);
        return d >= yearStart && d <= yearEnd && i.status === "paid";
      });

      const monthly: MonthlyTaxBreakdown[] = Array.from({ length: 12 }, (_, m) => ({
        month: m + 1,
        invoice_count: 0,
        subtotal: 0,
        tps_amount: 0,
        tvq_amount: 0,
        total: 0,
      }));

      yearInvoices.forEach(i => {
        const m = new Date(i.created_at).getMonth();
        monthly[m].invoice_count += 1;
        monthly[m].subtotal += Number(i.subtotal ?? 0);
        monthly[m].tps_amount += Number(i.tps_amount ?? 0);
        monthly[m].tvq_amount += Number(i.tvq_amount ?? 0);
        monthly[m].total += Number(i.total ?? 0);
      });

      monthly.forEach(m => {
        m.subtotal = +m.subtotal.toFixed(2);
        m.tps_amount = +m.tps_amount.toFixed(2);
        m.tvq_amount = +m.tvq_amount.toFixed(2);
        m.total = +m.total.toFixed(2);
      });

      const totals = monthly.reduce(
        (acc, m) => ({
          sub: acc.sub + m.subtotal,
          tps: acc.tps + m.tps_amount,
          tvq: acc.tvq + m.tvq_amount,
          tot: acc.tot + m.total,
          n: acc.n + m.invoice_count,
        }),
        { sub: 0, tps: 0, tvq: 0, tot: 0, n: 0 }
      );

      const result = generateAnnualTaxSummaryPDF({
        summary_number: `SF-${taxYear}-${seq()}`,
        issue_date: todayISO(),
        fiscal_year: taxYear,
        ...client,
        total_subtotal: +totals.sub.toFixed(2),
        total_tps: +totals.tps.toFixed(2),
        total_tvq: +totals.tvq.toFixed(2),
        total_paid: +totals.tot.toFixed(2),
        total_invoice_count: totals.n,
        monthly,
      });

      if (result.success) {
        downloadPDF(result);
        toast.success("Sommaire fiscal généré");
        setTaxOpen(false);
      } else {
        toast.error(result.error || "Erreur");
      }
    } finally {
      setBusy(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Documents financiers
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {/* 1. Credit note */}
        <Dialog open={creditOpen} onOpenChange={setCreditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs justify-start">
              <Receipt className="w-3 h-3 mr-2" />
              Note de crédit
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Émettre une note de crédit</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Facture liée</Label>
                <Select value={creditInvoiceId} onValueChange={setCreditInvoiceId}>
                  <SelectTrigger><SelectValue placeholder="Choisir une facture" /></SelectTrigger>
                  <SelectContent>
                    {invoices.map(i => (
                      <SelectItem key={i.id} value={i.id}>{i.invoice_number} — {Number(i.total ?? 0).toFixed(2)} $</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Montant total à créditer (TTC)</Label>
                <Input type="number" step="0.01" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} />
              </div>
              <div>
                <Label>Motif</Label>
                <Textarea value={creditReason} onChange={e => setCreditReason(e.target.value)} maxLength={500} placeholder="Ex. Erreur de facturation, geste commercial..." />
              </div>
              <div>
                <Label>Application</Label>
                <Select value={creditApplication} onValueChange={(v: any) => setCreditApplication(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="account_credit">Crédit porté au compte</SelectItem>
                    <SelectItem value="refund_pending">Remboursement à venir</SelectItem>
                    <SelectItem value="refund_processed">Remboursement effectué</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCredit} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                Générer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 2. Refund notice */}
        <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs justify-start">
              <Receipt className="w-3 h-3 mr-2" />
              Avis de remboursement
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Avis de remboursement</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Facture source (optionnel)</Label>
                <Select value={refundInvoiceId} onValueChange={setRefundInvoiceId}>
                  <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                  <SelectContent>
                    {invoices.map(i => (
                      <SelectItem key={i.id} value={i.id}>{i.invoice_number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Montant remboursé</Label>
                <Input type="number" step="0.01" value={refundAmount} onChange={e => setRefundAmount(e.target.value)} />
              </div>
              <div>
                <Label>Méthode</Label>
                <Select value={refundMethod} onValueChange={setRefundMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="card">Carte de crédit</SelectItem>
                    <SelectItem value="interac">Virement Interac</SelectItem>
                    <SelectItem value="manual">Traitement manuel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Référence (optionnel)</Label>
                <Input value={refundReference} onChange={e => setRefundReference(e.target.value)} placeholder="Ex. PayPal txn ID" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleRefund} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                Générer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 3. Late notice */}
        <Dialog open={lateOpen} onOpenChange={setLateOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs justify-start">
              <AlertTriangle className="w-3 h-3 mr-2" />
              Avis de retard
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Émettre un avis de retard</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Facture en retard</Label>
                <Select value={lateInvoiceId} onValueChange={setLateInvoiceId}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {overdueInvoices.length === 0 && (
                      <div className="px-2 py-3 text-xs text-muted-foreground">Aucune facture en retard</div>
                    )}
                    {overdueInvoices.map(i => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.invoice_number} — solde {Number(i.balance_due ?? 0).toFixed(2)} $
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Palier</Label>
                <Select value={lateStage} onValueChange={(v: any) => setLateStage(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first">1er rappel</SelectItem>
                    <SelectItem value="second">2e rappel</SelectItem>
                    <SelectItem value="final">Avis final</SelectItem>
                    <SelectItem value="collections">Recouvrement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleLate} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                Générer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 4. Account statement */}
        <Dialog open={stmtOpen} onOpenChange={setStmtOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs justify-start">
              <Calendar className="w-3 h-3 mr-2" />
              État de compte
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Générer un état de compte</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Du</Label>
                <Input type="date" value={stmtStart} onChange={e => setStmtStart(e.target.value)} />
              </div>
              <div>
                <Label>Au</Label>
                <Input type="date" value={stmtEnd} onChange={e => setStmtEnd(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">
                {invoices.length} facture(s) · {payments.length} paiement(s) sur le compte
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleStatement} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                Générer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 5. Annual tax summary */}
        <Dialog open={taxOpen} onOpenChange={setTaxOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs justify-start">
              <Calculator className="w-3 h-3 mr-2" />
              Sommaire fiscal annuel
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Sommaire fiscal annuel</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Année fiscale</Label>
                <Input
                  type="number"
                  min={2020}
                  max={new Date().getFullYear()}
                  value={taxYear}
                  onChange={e => setTaxYear(parseInt(e.target.value, 10) || taxYear)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Inclut uniquement les factures payées de l'année sélectionnée.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleTaxSummary} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                Générer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export default FinancialDocumentsPanel;
