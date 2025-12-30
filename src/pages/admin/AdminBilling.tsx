import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Plus, Eye, DollarSign, AlertTriangle, FileDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isPast, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useActivityLog } from "@/hooks/useActivityLog";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-500",
  paid: "bg-emerald-500/20 text-emerald-500",
  overdue: "bg-red-500/20 text-red-500",
  cancelled: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  pending: "En attente",
  paid: "Payé",
  overdue: "En retard",
  cancelled: "Annulé",
};

const AdminBilling = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentBill, setPaymentBill] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<"credit" | "etransfer" | "">("");
  const [cardDetails, setCardDetails] = useState({
    cardNumber: "",
    cardName: "",
    expiry: "",
    cvv: "",
  });
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [newInvoice, setNewInvoice] = useState({
    user_id: "",
    amount: "",
    due_date: "",
    notes: "",
  });

  const { data: billing, isLoading, error: billingError } = useQuery({
    queryKey: ["admin-billing"],
    queryFn: async () => {
      // First get billing records
      const { data: billingData, error: billingErr } = await supabase
        .from("billing")
        .select("*")
        .order("created_at", { ascending: false });

      if (billingErr) throw billingErr;

      // Then get profiles for each billing record
      if (billingData && billingData.length > 0) {
        const userIds = [...new Set(billingData.map((b: any) => b.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, email, full_name")
          .in("user_id", userIds);

        // Merge profiles into billing data
        return billingData.map((bill: any) => ({
          ...bill,
          profiles: profilesData?.find((p: any) => p.user_id === bill.user_id) || null,
        }));
      }

      return billingData || [];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["admin-clients-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, email, full_name")
        .order("full_name");

      if (error) throw error;
      return data;
    },
  });

  // Auto-apply late fees to overdue invoices
  const applyLateFeeMutation = useMutation({
    mutationFn: async (bill: any) => {
      const lateFee = Number(bill.amount) * 0.05;
      const { error } = await supabase
        .from("billing")
        .update({
          fees: (Number(bill.fees) || 0) + lateFee,
          late_fee_applied: true,
          status: "overdue",
        })
        .eq("id", bill.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-billing"] });
    },
  });

  // Check for overdue invoices on load
  useEffect(() => {
    if (billing) {
      billing.forEach((bill: any) => {
        if (
          bill.status === "pending" &&
          bill.due_date &&
          isPast(parseISO(bill.due_date)) &&
          !bill.late_fee_applied
        ) {
          applyLateFeeMutation.mutate(bill);
        }
      });
    }
  }, [billing]);

  const filteredBilling = billing?.filter((bill: any) => {
    if (activeTab === "all") return true;
    if (activeTab === "overdue") return bill.status === "overdue";
    if (activeTab === "pending") return bill.status === "pending";
    if (activeTab === "paid") return bill.status === "paid";
    return true;
  });

  const createInvoiceMutation = useMutation({
    mutationFn: async (invoice: typeof newInvoice) => {
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
      const { data, error } = await supabase
        .from("billing")
        .insert({
          user_id: invoice.user_id,
          amount: parseFloat(invoice.amount),
          due_date: invoice.due_date || null,
          notes: invoice.notes,
          invoice_number: invoiceNumber,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-billing"] });
      logActivity("create", "invoice", data.id, { amount: data.amount });
      toast({ title: "Facture créée avec succès" });
      setCreateDialogOpen(false);
      setNewInvoice({ user_id: "", amount: "", due_date: "", notes: "" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    },
  });

  const updateBillingMutation = useMutation({
    mutationFn: async (bill: any) => {
      const { error } = await supabase
        .from("billing")
        .update({
          amount: bill.amount,
          fees: bill.fees,
          credits: bill.credits,
          status: bill.status,
          notes: bill.notes,
          paid_at: bill.status === "paid" ? new Date().toISOString() : bill.paid_at,
        })
        .eq("id", bill.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-billing"] });
      logActivity("update", "invoice", selectedBill?.id, { status: selectedBill?.status });
      toast({ title: "Facture mise à jour" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  const openPaymentDialog = (bill: any) => {
    setPaymentBill(bill);
    setPaymentMethod("");
    setCardDetails({ cardNumber: "", cardName: "", expiry: "", cvv: "" });
    setPaymentDialogOpen(true);
  };

  const processPayment = async () => {
    if (!paymentBill || !paymentMethod) return;
    
    if (paymentMethod === "credit") {
      if (!cardDetails.cardNumber || !cardDetails.cardName || !cardDetails.expiry || !cardDetails.cvv) {
        toast({ title: "Veuillez remplir tous les champs de carte", variant: "destructive" });
        return;
      }
    }

    setIsProcessingPayment(true);
    
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const { error } = await supabase
        .from("billing")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          notes: `${paymentBill.notes || ""}\n[Paiement reçu via ${paymentMethod === "credit" ? "Carte de crédit" : "Virement Interac"}]`.trim(),
        })
        .eq("id", paymentBill.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["admin-billing"] });
      logActivity("payment", "invoice", paymentBill.id, { 
        method: paymentMethod,
        amount: calculateTotal(paymentBill)
      });
      
      toast({ title: "Paiement enregistré avec succès" });
      setPaymentDialogOpen(false);
      setDetailsDialogOpen(false);
    } catch (error) {
      toast({ title: "Erreur lors du traitement du paiement", variant: "destructive" });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleViewDetails = (bill: any) => {
    setSelectedBill({ ...bill });
    setDetailsDialogOpen(true);
  };

  const calculateTotal = (bill: any) => {
    const base = Number(bill.amount) || 0;
    const fees = Number(bill.fees) || 0;
    const credits = Number(bill.credits) || 0;
    return base + fees - credits;
  };

  const exportInvoicePDF = (bill: any) => {
    const subtotal = Number(bill.amount) || 0;
    const fees = Number(bill.fees) || 0;
    const credits = Number(bill.credits) || 0;
    const taxRate = 0.14975; // QST + GST combined
    const taxAmount = subtotal * taxRate;
    const totalBeforeCredits = subtotal + fees + taxAmount;
    const total = totalBeforeCredits - credits;
    const remainingBalance = bill.status === "paid" ? 0 : total;
    
    const clientName = bill.profiles?.full_name || "Client";
    const clientEmail = bill.profiles?.email || bill.client_email || "";
    const invoiceNum = bill.invoice_number || `INV-${bill.id.slice(0, 8).toUpperCase()}`;
    const dueDate = bill.due_date ? format(new Date(bill.due_date), "d MMMM yyyy", { locale: fr }) : "Sur réception";
    const createdDate = format(new Date(bill.created_at), "d MMMM yyyy", { locale: fr });
    const paidDate = bill.paid_at ? format(new Date(bill.paid_at), "d MMMM yyyy", { locale: fr }) : null;
    
    // Extract payment method from notes if available
    const paymentMethodMatch = bill.notes?.match(/\[Paiement reçu via (.*?)\]/);
    const paymentMethod = paymentMethodMatch ? paymentMethodMatch[1] : null;
    
    // Mock last 4 digits (in real app, would come from payment records)
    const cardLast4 = paymentMethod?.includes("Carte") ? "•••• 4242" : null;

    const formatCurrency = (amount: number) => 
      amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Facture ${invoiceNum}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          
          * { margin: 0; padding: 0; box-sizing: border-box; }
          
          body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
            padding: 0;
            color: #1e293b;
            background: #fff;
            font-size: 13px;
            line-height: 1.5;
          }
          
          .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px;
          }
          
          /* Header */
          .header {
            text-align: center;
            padding-bottom: 30px;
            border-bottom: 3px solid #0891b2;
            margin-bottom: 30px;
          }
          
          .logo {
            font-size: 36px;
            font-weight: 700;
            color: #0891b2;
            letter-spacing: 4px;
            margin-bottom: 8px;
          }
          
          .tagline {
            color: #64748b;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 2px;
          }
          
          .company-info {
            margin-top: 15px;
            color: #475569;
            font-size: 11px;
          }
          
          .company-info p { margin: 2px 0; }
          
          /* Invoice Title */
          .invoice-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
          }
          
          .invoice-title-section h1 {
            font-size: 28px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 5px;
          }
          
          .invoice-number {
            font-size: 14px;
            color: #0891b2;
            font-weight: 600;
          }
          
          .status-badge {
            display: inline-block;
            padding: 8px 20px;
            border-radius: 25px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          
          .status-paid { background: #d1fae5; color: #059669; }
          .status-pending { background: #fef3c7; color: #d97706; }
          .status-overdue { background: #fee2e2; color: #dc2626; }
          
          /* Two Column Layout */
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-bottom: 35px;
          }
          
          .info-section h3 {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: #94a3b8;
            margin-bottom: 10px;
            font-weight: 600;
          }
          
          .info-section .client-name {
            font-size: 16px;
            font-weight: 600;
            color: #0f172a;
            margin-bottom: 5px;
          }
          
          .info-section p {
            color: #475569;
            margin: 3px 0;
          }
          
          .dates-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
          }
          
          .date-item label {
            display: block;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #94a3b8;
            margin-bottom: 4px;
          }
          
          .date-item span {
            font-weight: 500;
            color: #0f172a;
          }
          
          /* Invoice Table */
          .invoice-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
          }
          
          .invoice-table thead {
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          }
          
          .invoice-table th {
            color: #fff;
            padding: 14px 16px;
            text-align: left;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
          }
          
          .invoice-table th:last-child {
            text-align: right;
          }
          
          .invoice-table td {
            padding: 16px;
            border-bottom: 1px solid #e2e8f0;
            color: #334155;
          }
          
          .invoice-table td:last-child {
            text-align: right;
            font-weight: 500;
          }
          
          .invoice-table tr:hover {
            background: #f8fafc;
          }
          
          .item-description {
            font-weight: 500;
            color: #0f172a;
          }
          
          .item-detail {
            font-size: 11px;
            color: #64748b;
            margin-top: 3px;
          }
          
          /* Totals Section */
          .totals-section {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 30px;
          }
          
          .totals-table {
            width: 320px;
          }
          
          .totals-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #e2e8f0;
          }
          
          .totals-row.subtotal {
            color: #64748b;
          }
          
          .totals-row.fees {
            color: #dc2626;
          }
          
          .totals-row.credits {
            color: #059669;
          }
          
          .totals-row.tax {
            color: #64748b;
          }
          
          .totals-row.total {
            border-bottom: none;
            border-top: 2px solid #0f172a;
            padding-top: 15px;
            margin-top: 5px;
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
          }
          
          .totals-row.balance {
            background: ${remainingBalance > 0 ? '#fef2f2' : '#f0fdf4'};
            margin: 10px -15px -10px;
            padding: 15px;
            border-radius: 8px;
            font-weight: 600;
            color: ${remainingBalance > 0 ? '#dc2626' : '#059669'};
          }
          
          /* Payment Info */
          .payment-info {
            background: #f8fafc;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 25px;
          }
          
          .payment-info h3 {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #64748b;
            margin-bottom: 12px;
          }
          
          .payment-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
          }
          
          .payment-item label {
            display: block;
            font-size: 10px;
            text-transform: uppercase;
            color: #94a3b8;
            margin-bottom: 4px;
          }
          
          .payment-item span {
            font-weight: 600;
            color: #0f172a;
          }
          
          /* Notes Section */
          .notes-section {
            background: #fffbeb;
            border-left: 4px solid #f59e0b;
            padding: 15px 20px;
            margin-bottom: 25px;
            border-radius: 0 8px 8px 0;
          }
          
          .notes-section h3 {
            font-size: 12px;
            font-weight: 600;
            color: #92400e;
            margin-bottom: 8px;
          }
          
          .notes-section p {
            color: #78350f;
            font-size: 12px;
          }
          
          /* Policies */
          .policies {
            background: #f1f5f9;
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 25px;
          }
          
          .policies h3 {
            font-size: 12px;
            font-weight: 600;
            color: #334155;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          
          .policies ul {
            list-style: none;
            padding: 0;
          }
          
          .policies li {
            position: relative;
            padding-left: 20px;
            margin-bottom: 8px;
            color: #475569;
            font-size: 11px;
          }
          
          .policies li::before {
            content: "•";
            position: absolute;
            left: 0;
            color: #0891b2;
            font-weight: bold;
          }
          
          .late-fee-warning {
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 8px;
            padding: 12px 15px;
            margin-top: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          
          .late-fee-warning .icon {
            color: #dc2626;
            font-size: 18px;
          }
          
          .late-fee-warning p {
            color: #991b1b;
            font-size: 11px;
            font-weight: 500;
          }
          
          /* Footer */
          .footer {
            text-align: center;
            padding-top: 25px;
            border-top: 1px solid #e2e8f0;
          }
          
          .footer p {
            color: #94a3b8;
            font-size: 11px;
            margin: 3px 0;
          }
          
          .footer .thank-you {
            font-size: 14px;
            font-weight: 600;
            color: #0891b2;
            margin-bottom: 10px;
          }
          
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .invoice-container { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <!-- Header with Company Info -->
          <div class="header">
            <div class="logo">NIVRA</div>
            <div class="tagline">Courtier Télécom Indépendant</div>
            <div class="company-info">
              <p>5000, rue d'Iberville, bureau 100</p>
              <p>Montréal, Québec H2H 2S6</p>
              <p>Tél: 438-544-2233 | info@nivra.ca</p>
              <p>TPS: 123456789 RT0001 | TVQ: 1234567890 TQ0001</p>
            </div>
          </div>
          
          <!-- Invoice Header with Status -->
          <div class="invoice-header">
            <div class="invoice-title-section">
              <h1>FACTURE</h1>
              <div class="invoice-number">${invoiceNum}</div>
            </div>
            <span class="status-badge status-${bill.status}">
              ${statusLabels[bill.status] || bill.status}
            </span>
          </div>
          
          <!-- Client & Dates Info -->
          <div class="info-grid">
            <div class="info-section">
              <h3>Facturer à</h3>
              <div class="client-name">${clientName}</div>
              <p>${clientEmail}</p>
              ${bill.profiles?.phone ? `<p>Tél: ${bill.profiles.phone}</p>` : ''}
            </div>
            <div class="info-section">
              <div class="dates-grid">
                <div class="date-item">
                  <label>Date d'émission</label>
                  <span>${createdDate}</span>
                </div>
                <div class="date-item">
                  <label>Date d'échéance</label>
                  <span>${dueDate}</span>
                </div>
                ${paidDate ? `
                <div class="date-item">
                  <label>Date de paiement</label>
                  <span>${paidDate}</span>
                </div>
                ` : ''}
                <div class="date-item">
                  <label>Période</label>
                  <span>${format(new Date(bill.created_at), "MMMM yyyy", { locale: fr })}</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Invoice Items Table -->
          <table class="invoice-table">
            <thead>
              <tr>
                <th style="width: 60%;">Description</th>
                <th style="width: 15%;">Qté</th>
                <th style="width: 25%;">Montant</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div class="item-description">Services télécom</div>
                  <div class="item-detail">${bill.notes?.split('\n')[0] || 'Services et frais mensuels'}</div>
                </td>
                <td>1</td>
                <td>${formatCurrency(subtotal)}</td>
              </tr>
              ${fees > 0 ? `
              <tr>
                <td>
                  <div class="item-description">Frais supplémentaires</div>
                  <div class="item-detail">${bill.late_fee_applied ? 'Incluant frais de retard (5%)' : 'Frais administratifs'}</div>
                </td>
                <td>—</td>
                <td style="color: #dc2626;">+${formatCurrency(fees)}</td>
              </tr>
              ` : ''}
            </tbody>
          </table>
          
          <!-- Totals -->
          <div class="totals-section">
            <div class="totals-table">
              <div class="totals-row subtotal">
                <span>Sous-total</span>
                <span>${formatCurrency(subtotal)}</span>
              </div>
              ${fees > 0 ? `
              <div class="totals-row fees">
                <span>Frais</span>
                <span>+${formatCurrency(fees)}</span>
              </div>
              ` : ''}
              <div class="totals-row tax">
                <span>TPS (5%) + TVQ (9.975%)</span>
                <span>${formatCurrency(taxAmount)}</span>
              </div>
              ${credits > 0 ? `
              <div class="totals-row credits">
                <span>Crédits / Rabais</span>
                <span>-${formatCurrency(credits)}</span>
              </div>
              ` : ''}
              <div class="totals-row total">
                <span>Total</span>
                <span>${formatCurrency(total)}</span>
              </div>
              <div class="totals-row balance">
                <span>Solde ${remainingBalance > 0 ? 'dû' : ''}</span>
                <span>${formatCurrency(remainingBalance)}</span>
              </div>
            </div>
          </div>
          
          <!-- Payment Information -->
          ${bill.status === "paid" ? `
          <div class="payment-info">
            <h3>Informations de paiement</h3>
            <div class="payment-grid">
              <div class="payment-item">
                <label>Méthode</label>
                <span>${paymentMethod || 'Paiement reçu'}</span>
              </div>
              ${cardLast4 ? `
              <div class="payment-item">
                <label>Carte</label>
                <span>${cardLast4}</span>
              </div>
              ` : ''}
              <div class="payment-item">
                <label>Montant payé</label>
                <span>${formatCurrency(total)}</span>
              </div>
            </div>
          </div>
          ` : ''}
          
          <!-- Notes -->
          ${bill.notes ? `
          <div class="notes-section">
            <h3>Notes</h3>
            <p>${bill.notes.replace(/\[Paiement.*?\]/g, '').trim() || 'Aucune note'}</p>
          </div>
          ` : ''}
          
          <!-- Payment Policies -->
          <div class="policies">
            <h3>Conditions de paiement</h3>
            <ul>
              <li>Le paiement est dû à la date d'échéance indiquée sur cette facture.</li>
              <li>Modes de paiement acceptés: Carte de crédit (Visa, Mastercard), Virement Interac.</li>
              <li>Un frais de retard de <strong>5% par mois</strong> sera appliqué sur tout solde impayé après la date d'échéance.</li>
              <li>Les intérêts sur les comptes en souffrance sont composés mensuellement.</li>
              <li>Pour toute question concernant cette facture, contactez-nous à facturation@nivra.ca</li>
            </ul>
            
            ${bill.status !== "paid" ? `
            <div class="late-fee-warning">
              <span class="icon">⚠️</span>
              <p>Important: Des frais de retard de 5% seront automatiquement ajoutés à tout solde impayé après la date d'échéance. Veuillez effectuer votre paiement dans les délais pour éviter ces frais supplémentaires.</p>
            </div>
            ` : ''}
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <p class="thank-you">Merci de votre confiance!</p>
            <p>Nivra Inc. — Courtier télécom indépendant payé uniquement par ses clients</p>
            <p>Nous ne recevons aucune rémunération des opérateurs télécom.</p>
            <p style="margin-top: 10px;">Cette facture a été générée électroniquement et est valide sans signature.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }

    toast({ title: "Facture PDF prête à imprimer" });
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Facturation</h1>
            <p className="text-muted-foreground mt-1">Gérer les factures et paiements</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle facture
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Créer une facture</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Client</Label>
                  <Select
                    value={newInvoice.user_id}
                    onValueChange={(v) => setNewInvoice({ ...newInvoice, user_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map((client: any) => (
                        <SelectItem key={client.user_id} value={client.user_id}>
                          {client.full_name || client.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Montant</Label>
                  <Input
                    type="number"
                    value={newInvoice.amount}
                    onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Date d'échéance</Label>
                  <Input
                    type="date"
                    value={newInvoice.due_date}
                    onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={newInvoice.notes}
                    onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })}
                    placeholder="Description de la facture..."
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => createInvoiceMutation.mutate(newInvoice)}
                  disabled={!newInvoice.user_id || !newInvoice.amount}
                >
                  Créer la facture
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En attente</p>
                <p className="text-2xl font-bold text-foreground">
                  {billing?.filter((b: any) => b.status === "pending").length || 0}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En retard</p>
                <p className="text-2xl font-bold text-foreground">
                  {billing?.filter((b: any) => b.status === "overdue").length || 0}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payé ce mois</p>
                <p className="text-2xl font-bold text-foreground">
                  {billing
                    ?.filter((b: any) => b.status === "paid")
                    .reduce((sum: number, b: any) => sum + Number(b.amount), 0)
                    .toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-cyan-400" />
                Factures
              </CardTitle>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="all">Toutes</TabsTrigger>
                  <TabsTrigger value="pending">En attente</TabsTrigger>
                  <TabsTrigger value="overdue">En retard</TabsTrigger>
                  <TabsTrigger value="paid">Payées</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredBilling && filteredBilling.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Nº</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Client</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Montant</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Frais</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Échéance</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBilling.map((bill: any) => (
                      <tr key={bill.id} className="border-b border-border/50 hover:bg-accent/50">
                        <td className="py-3 px-4 text-sm text-foreground font-mono">
                          {bill.invoice_number || bill.id.slice(0, 8)}
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm text-foreground">{bill.profiles?.full_name || "N/A"}</p>
                          <p className="text-xs text-muted-foreground">{bill.profiles?.email}</p>
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground">
                          {Number(bill.amount).toLocaleString("fr-CA", {
                            style: "currency",
                            currency: "CAD",
                          })}
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground">
                          {Number(bill.fees || 0).toLocaleString("fr-CA", {
                            style: "currency",
                            currency: "CAD",
                          })}
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground font-medium">
                          {calculateTotal(bill).toLocaleString("fr-CA", {
                            style: "currency",
                            currency: "CAD",
                          })}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {bill.due_date
                            ? format(new Date(bill.due_date), "d MMM yyyy", { locale: fr })
                            : "—"}
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={statusColors[bill.status] || "bg-muted"}>
                            {statusLabels[bill.status] || bill.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleViewDetails(bill)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => exportInvoicePDF(bill)}>
                              <FileDown className="w-4 h-4" />
                            </Button>
                            {bill.status !== "paid" && (
                              <Button
                                size="sm"
                                variant="hero"
                                onClick={() => openPaymentDialog(bill)}
                              >
                                <DollarSign className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune facture pour le moment</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Détails de la facture</DialogTitle>
            </DialogHeader>
            {selectedBill && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Montant de base</Label>
                    <Input
                      type="number"
                      value={selectedBill.amount}
                      onChange={(e) =>
                        setSelectedBill({ ...selectedBill, amount: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Statut</Label>
                    <Select
                      value={selectedBill.status}
                      onValueChange={(v) => setSelectedBill({ ...selectedBill, status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">En attente</SelectItem>
                        <SelectItem value="paid">Payé</SelectItem>
                        <SelectItem value="overdue">En retard</SelectItem>
                        <SelectItem value="cancelled">Annulé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Frais supplémentaires</Label>
                    <Input
                      type="number"
                      value={selectedBill.fees || 0}
                      onChange={(e) =>
                        setSelectedBill({ ...selectedBill, fees: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Crédits</Label>
                    <Input
                      type="number"
                      value={selectedBill.credits || 0}
                      onChange={(e) =>
                        setSelectedBill({ ...selectedBill, credits: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>Montant de base:</span>
                    <span>
                      {Number(selectedBill.amount).toLocaleString("fr-CA", {
                        style: "currency",
                        currency: "CAD",
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Frais:</span>
                    <span>
                      +{Number(selectedBill.fees || 0).toLocaleString("fr-CA", {
                        style: "currency",
                        currency: "CAD",
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Crédits:</span>
                    <span>
                      -{Number(selectedBill.credits || 0).toLocaleString("fr-CA", {
                        style: "currency",
                        currency: "CAD",
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold mt-2 pt-2 border-t border-border">
                    <span>Total:</span>
                    <span>
                      {calculateTotal(selectedBill).toLocaleString("fr-CA", {
                        style: "currency",
                        currency: "CAD",
                      })}
                    </span>
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={selectedBill.notes || ""}
                    onChange={(e) =>
                      setSelectedBill({ ...selectedBill, notes: e.target.value })
                    }
                    placeholder="Notes internes..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      updateBillingMutation.mutate(selectedBill);
                      setDetailsDialogOpen(false);
                    }}
                  >
                    Enregistrer
                  </Button>
                  <Button variant="outline" onClick={() => exportInvoicePDF(selectedBill)}>
                    <FileDown className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                  {selectedBill.status !== "paid" && (
                    <Button variant="hero" onClick={() => openPaymentDialog(selectedBill)}>
                      <DollarSign className="w-4 h-4 mr-2" />
                      Enregistrer paiement
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Payment Dialog */}
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Enregistrer un paiement</DialogTitle>
            </DialogHeader>
            {paymentBill && (
              <div className="space-y-4 mt-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>Facture:</span>
                    <span className="font-mono">{paymentBill.invoice_number || paymentBill.id.slice(0, 8)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Client:</span>
                    <span>{paymentBill.profiles?.full_name || "N/A"}</span>
                  </div>
                  <div className="flex justify-between font-bold mt-2 pt-2 border-t border-border">
                    <span>Total à payer:</span>
                    <span>
                      {calculateTotal(paymentBill).toLocaleString("fr-CA", {
                        style: "currency",
                        currency: "CAD",
                      })}
                    </span>
                  </div>
                </div>

                <div>
                  <Label>Méthode de paiement</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={(v: "credit" | "etransfer") => setPaymentMethod(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une méthode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit">Carte de crédit</SelectItem>
                      <SelectItem value="etransfer">Virement Interac (e-Transfer)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {paymentMethod === "credit" && (
                  <div className="space-y-4 p-4 border border-border rounded-lg">
                    <div>
                      <Label>Numéro de carte</Label>
                      <Input
                        placeholder="1234 5678 9012 3456"
                        value={cardDetails.cardNumber}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, "").slice(0, 16);
                          const formatted = value.replace(/(\d{4})(?=\d)/g, "$1 ");
                          setCardDetails({ ...cardDetails, cardNumber: formatted });
                        }}
                        maxLength={19}
                      />
                    </div>
                    <div>
                      <Label>Nom sur la carte</Label>
                      <Input
                        placeholder="NOM COMPLET"
                        value={cardDetails.cardName}
                        onChange={(e) => setCardDetails({ ...cardDetails, cardName: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Expiration</Label>
                        <Input
                          placeholder="MM/AA"
                          value={cardDetails.expiry}
                          onChange={(e) => {
                            let value = e.target.value.replace(/\D/g, "").slice(0, 4);
                            if (value.length >= 2) {
                              value = value.slice(0, 2) + "/" + value.slice(2);
                            }
                            setCardDetails({ ...cardDetails, expiry: value });
                          }}
                          maxLength={5}
                        />
                      </div>
                      <div>
                        <Label>CVV</Label>
                        <Input
                          type="password"
                          placeholder="***"
                          value={cardDetails.cvv}
                          onChange={(e) => setCardDetails({ ...cardDetails, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                          maxLength={4}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {paymentMethod === "etransfer" && (
                  <div className="p-4 border border-border rounded-lg bg-cyan-500/10">
                    <p className="text-sm text-foreground">
                      Confirmez que le virement Interac a été reçu. Le paiement sera marqué comme complété.
                    </p>
                  </div>
                )}

                <Button
                  className="w-full"
                  variant="hero"
                  onClick={processPayment}
                  disabled={!paymentMethod || isProcessingPayment}
                >
                  {isProcessingPayment ? (
                    "Traitement en cours..."
                  ) : (
                    <>
                      <DollarSign className="w-4 h-4 mr-2" />
                      Confirmer le paiement
                    </>
                  )}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminBilling;
