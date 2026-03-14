/**
 * AccountBillingTab — Financial overview with operational actions: record payment, view/download invoice, adjustments
 */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CreditCard, FileText, Receipt, Calendar, DollarSign, Download, Eye, PlusCircle, Send, ExternalLink } from "lucide-react";
import { format, addMonths, setDate } from "date-fns";
import { fr } from "date-fns/locale";
import { Link } from "react-router-dom";
import { adminClient as supabase } from "@/integrations/backend";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import PDFViewerDialog from "@/components/PDFViewerDialog";
import { generateInvoicePDF, type InvoiceDataV2 } from "@/lib/pdf";
import { safePDFDownload } from "@/lib/pdfUtils";

interface AccountBillingTabProps {
  account: any;
  invoices: any[];
  payments: any[];
  subscriptions: any[];
  legacyBilling: any[];
}

const invoiceStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  paid: { label: "Payée", variant: "default" },
  unpaid: { label: "Impayée", variant: "destructive" },
  pending: { label: "En attente", variant: "outline" },
  overdue: { label: "En retard", variant: "destructive" },
  voided: { label: "Annulée", variant: "secondary" },
  partially_paid: { label: "Part. payée", variant: "secondary" },
  draft: { label: "Brouillon", variant: "outline" },
};

export function AccountBillingTab({ account, invoices, payments, subscriptions, legacyBilling }: AccountBillingTabProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState<any>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"interac" | "manual" | "paypal">("interac");
  const [payRef, setPayRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustInvoice, setAdjustInvoice] = useState<any>(null);
  const [adjustType, setAdjustType] = useState<"credit" | "charge">("credit");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustDesc, setAdjustDesc] = useState("");
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfFilename, setPdfFilename] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  const totalBalance = invoices.reduce((sum: number, inv: any) => sum + (inv.balance_due || 0), 0);
  const monthlyRecurring = subscriptions
    .filter((s: any) => s.status === "active")
    .reduce((sum: number, s: any) => sum + (s.plan_price || 0), 0);

  const cycleDay = account?.billing_cycle_day || 1;
  const today = new Date();
  let cycleStart = setDate(today, cycleDay);
  if (cycleStart > today) cycleStart = addMonths(cycleStart, -1);
  const cycleEnd = new Date(addMonths(cycleStart, 1));
  cycleEnd.setDate(cycleEnd.getDate() - 1);
  const nextInvoice = addMonths(cycleStart, 1);

  const openPayDialog = (inv: any) => {
    setPayInvoice(inv);
    setPayAmount(inv.balance_due?.toFixed(2) || "0");
    setPayRef("");
    setPayMethod("interac");
    setPayOpen(true);
  };

  const handleRecordPayment = async () => {
    if (!payInvoice || !payAmount) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Montant invalide"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.rpc("apply_payment_to_invoice" as any, {
        p_invoice_id: payInvoice.id,
        p_amount: amount,
        p_method: payMethod,
        p_reference: payRef || null,
        p_source: "admin_manual_confirmation",
        p_admin_id: user?.id || null,
        p_admin_name: user?.email || "Admin",
      });
      if (error) throw error;
      toast.success(`Paiement de ${amount.toFixed(2)} $ enregistré`);
      setPayOpen(false);
      queryClient.invalidateQueries({ queryKey: ["account-profile-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["account-profile-payments"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const handleViewInvoice = async (inv: any) => {
    setPdfLoading(true);
    setPdfOpen(true);
    setPdfTitle(`Facture ${inv.invoice_number}`);
    setPdfFilename(`Facture_${inv.invoice_number}.pdf`);
    try {
      const pdfData: InvoiceDataV2 = {
        invoice_type: inv.type === "recurring" ? "MONTHLY" : "ONETIME",
        invoice_number: inv.invoice_number,
        invoice_date: inv.created_at,
        due_date: inv.due_date,
        account_number: account?.account_number || "",
        currency: "CAD",
        status: inv.status === "paid" ? "Paid" : "Issued",
        billing_period_start: inv.cycle_start_date,
        billing_period_end: inv.cycle_end_date,
        customer: {
          full_name: account?.account_name || "Client",
          email: "",
          phone: "",
          address_line1: account?.billing_address || account?.primary_service_address || "",
          city: account?.billing_city || account?.primary_service_city || "",
          province: account?.billing_province || "QC",
          postal_code: account?.billing_postal_code || account?.primary_service_postal_code || "",
        },
        items: [],
        subtotal: inv.subtotal || 0,
        taxes: {
          gst_rate: 0.05,
          gst_amount: inv.tps_amount || 0,
          qst_rate: 0.09975,
          qst_amount: inv.tvq_amount || 0,
        },
        total: inv.total || 0,
        balance_due: inv.balance_due || 0,
        payments_total: inv.amount_paid || 0,
      };
      const result = await generateInvoicePDF(pdfData);
      if (result.success && result.blob) {
        setPdfBlob(result.blob);
      } else {
        toast.error(result.error || "Erreur PDF");
        setPdfOpen(false);
      }
    } catch (e: any) {
      toast.error("Erreur de génération PDF");
      setPdfOpen(false);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadInvoice = async (inv: any) => {
    try {
      const pdfData: InvoiceDataV2 = {
        invoice_type: inv.type === "recurring" ? "MONTHLY" : "ONETIME",
        invoice_number: inv.invoice_number,
        invoice_date: inv.created_at,
        due_date: inv.due_date,
        account_number: account?.account_number || "",
        currency: "CAD",
        status: inv.status === "paid" ? "Paid" : "Issued",
        billing_period_start: inv.cycle_start_date,
        billing_period_end: inv.cycle_end_date,
        customer: {
          full_name: account?.account_name || "Client",
          email: "",
          phone: "",
          address_line1: account?.billing_address || account?.primary_service_address || "",
          city: account?.billing_city || "",
          province: "QC",
          postal_code: account?.billing_postal_code || "",
        },
        items: [],
        subtotal: inv.subtotal || 0,
        taxes: {
          gst_rate: 0.05,
          gst_amount: inv.tps_amount || 0,
          qst_rate: 0.09975,
          qst_amount: inv.tvq_amount || 0,
        },
        total: inv.total || 0,
        balance_due: inv.balance_due || 0,
        payments_total: inv.amount_paid || 0,
      };
      const result = await generateInvoicePDF(pdfData);
      if (result.success && result.blob && result.filename) {
        safePDFDownload(result.blob, result.filename);
      } else {
        toast.error(result.error || "Erreur");
      }
    } catch {
      toast.error("Erreur téléchargement");
    }
  };

  const openAdjustDialog = (inv: any) => {
    setAdjustInvoice(inv);
    setAdjustAmount("");
    setAdjustDesc("");
    setAdjustType("credit");
    setAdjustOpen(true);
  };

  const handleAdjustment = async () => {
    if (!adjustInvoice || !adjustAmount || !adjustDesc) return;
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Montant invalide"); return; }
    setSaving(true);
    try {
      const lineTotal = adjustType === "credit" ? -amount : amount;
      // Add invoice line
      await supabase.from("billing_invoice_lines").insert({
        invoice_id: adjustInvoice.id,
        description: adjustDesc,
        unit_price: lineTotal,
        quantity: 1,
        line_total: lineTotal,
        line_type: adjustType === "credit" ? "credit" : "charge",
      });

      // Recalculate invoice totals
      const newSubtotal = (adjustInvoice.subtotal || 0) + lineTotal;
      const tps = Math.round(newSubtotal * 0.05 * 100) / 100;
      const tvq = Math.round(newSubtotal * 0.09975 * 100) / 100;
      const newTotal = Math.round((newSubtotal + tps + tvq) * 100) / 100;
      const newBalance = Math.round((newTotal - (adjustInvoice.amount_paid || 0)) * 100) / 100;

      await supabase.from("billing_invoices").update({
        subtotal: newSubtotal,
        tps_amount: tps,
        tvq_amount: tvq,
        total: newTotal,
        balance_due: Math.max(0, newBalance),
        status: newBalance <= 0 ? "paid" : adjustInvoice.status,
      }).eq("id", adjustInvoice.id);

      toast.success(`${adjustType === "credit" ? "Crédit" : "Charge"} de ${amount.toFixed(2)} $ appliqué(e)`);
      setAdjustOpen(false);
      queryClient.invalidateQueries({ queryKey: ["account-profile-invoices"] });
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Billing Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <SummaryCard icon={DollarSign} label="Solde actuel" value={`${totalBalance.toFixed(2)} $`} highlight={totalBalance > 0} />
        <SummaryCard icon={Receipt} label="Récurrent mensuel" value={`${monthlyRecurring.toFixed(2)} $`} />
        <SummaryCard icon={Calendar} label="Cycle actuel" value={`${format(cycleStart, "d MMM", { locale: fr })} - ${format(cycleEnd, "d MMM", { locale: fr })}`} />
        <SummaryCard icon={Calendar} label="Prochaine facture" value={format(nextInvoice, "d MMM yyyy", { locale: fr })} />
      </div>

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">Factures ({invoices.length})</TabsTrigger>
          <TabsTrigger value="payments">Paiements ({payments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-3 space-y-2">
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucune facture</p>
          ) : (
            invoices.map((inv: any) => {
              const st = invoiceStatusConfig[inv.status] || invoiceStatusConfig.pending;
              return (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-md border hover:bg-accent/30">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <Link to={`/admin/invoices/${inv.id}`} className="text-sm font-mono font-medium text-primary hover:underline">
                        {inv.invoice_number}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {inv.type === "recurring" ? "Récurrente" : "Ponctuelle"}
                        {" • "}
                        {inv.created_at && format(new Date(inv.created_at), "d MMM yyyy", { locale: fr })}
                        {inv.due_date && ` • Éch. ${format(new Date(inv.due_date), "d MMM", { locale: fr })}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right mr-2">
                      <p className="text-sm font-medium">{inv.total?.toFixed(2)} $</p>
                      {inv.balance_due > 0 && (
                        <p className="text-xs text-destructive">Dû: {inv.balance_due.toFixed(2)} $</p>
                      )}
                    </div>
                    <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewInvoice(inv)} title="Voir">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownloadInvoice(inv)} title="Télécharger">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    {inv.balance_due > 0 && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openPayDialog(inv)} title="Enregistrer paiement">
                        <CreditCard className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openAdjustDialog(inv)} title="Ajustement">
                      <PlusCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="payments" className="mt-3 space-y-2">
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucun paiement</p>
          ) : (
            payments.map((pay: any) => (
              <div key={pay.id} className="flex items-center justify-between p-3 rounded-md border hover:bg-accent/30">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-mono font-semibold text-foreground">
                      {pay.payment_number || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {pay.amount?.toFixed(2)} $ • {pay.method}
                      {pay.reference && <span className="ml-1 opacity-70">Réf: {pay.reference}</span>}
                      {" • "}
                      {pay.created_at && format(new Date(pay.created_at), "d MMM yyyy", { locale: fr })}
                    </p>
                  </div>
                </div>
                <Badge variant={pay.status === "confirmed" ? "default" : "outline"} className="text-[10px]">
                  {pay.status === "confirmed" ? "Confirmé" : pay.status || "En attente"}
                </Badge>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Record Payment Dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enregistrer un paiement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Facture: {payInvoice?.invoice_number} — Solde: {payInvoice?.balance_due?.toFixed(2)} $</p>
            <div>
              <Label>Montant ($)</Label>
              <Input type="number" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
            </div>
            <div>
              <Label>Méthode</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="etransfer">Virement Interac</SelectItem>
                  <SelectItem value="credit_card">Carte de crédit</SelectItem>
                  <SelectItem value="cash">Comptant</SelectItem>
                  <SelectItem value="cheque">Chèque</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Référence (optionnel)</Label>
              <Input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Numéro de référence..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Annuler</Button>
            <Button onClick={handleRecordPayment} disabled={saving}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjustment Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustement — {adjustInvoice?.invoice_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Type</Label>
              <Select value={adjustType} onValueChange={(v) => setAdjustType(v as "credit" | "charge")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Crédit (réduction)</SelectItem>
                  <SelectItem value="charge">Charge (supplément)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Montant ($)</Label>
              <Input type="number" step="0.01" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={adjustDesc} onChange={e => setAdjustDesc(e.target.value)} rows={2} placeholder="Raison de l'ajustement..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>Annuler</Button>
            <Button onClick={handleAdjustment} disabled={saving || !adjustAmount || !adjustDesc}>
              {saving ? "Application..." : "Appliquer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF Viewer */}
      <PDFViewerDialog
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        pdfBlob={pdfBlob}
        title={pdfTitle}
        filename={pdfFilename}
        isLoading={pdfLoading}
      />
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className={`text-sm font-semibold ${highlight ? "text-destructive" : ""}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
