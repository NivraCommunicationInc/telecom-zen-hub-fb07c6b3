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
import { CreditCard, Plus, Eye, DollarSign, AlertTriangle, FileDown, CheckCircle, Send, Loader2, User, Wallet, PlusCircle, MinusCircle } from "lucide-react";
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

// E-transfer payment info for clients
const ETRANSFER_INFO = {
  email: "NivraTelecom@gmail.com",
  question: "Nom du client ou nom de l'entreprise",
  answer: "Le nom complet du client ou le nom de l'entreprise",
};

const AdminBilling = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [paymentConfirmation, setPaymentConfirmation] = useState<any>(null);
  const [paymentBill, setPaymentBill] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<"credit" | "etransfer" | "">("");
  const [cardDetails, setCardDetails] = useState({
    cardNumber: "",
    cardName: "",
    expiry: "",
    cvv: "",
  });
  const [etransferDetails, setEtransferDetails] = useState({
    senderName: "",
    amount: "",
    receivedBy: "",
  });
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isResendingNotification, setIsResendingNotification] = useState(false);
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [clientProfileDialogOpen, setClientProfileDialogOpen] = useState(false);
  const [selectedClientProfile, setSelectedClientProfile] = useState<any>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [newInvoice, setNewInvoice] = useState({
    user_id: "",
    amount: "",
    due_date: "",
    notes: "",
  });

  const { data: billing, isLoading } = useQuery({
    queryKey: ["admin-billing"],
    queryFn: async () => {
      const { data: billingData, error: billingErr } = await supabase
        .from("billing")
        .select("*")
        .order("created_at", { ascending: false });

      if (billingErr) throw billingErr;

      if (billingData && billingData.length > 0) {
        const userIds = [...new Set(billingData.map((b: any) => b.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, email, full_name, phone")
          .in("user_id", userIds);

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

  const sendBillingNotification = async (
    email: string,
    name: string,
    type: "invoice_created" | "payment_received" | "payment_failed" | "invoice_overdue",
    data: { invoiceNumber?: string; amount: number; dueDate?: string; paidAt?: string; paymentMethod?: string; notes?: string }
  ) => {
    try {
      await supabase.functions.invoke("send-billing-notification", {
        body: { email, name, type, ...data },
      });
      console.log("Billing notification sent:", type);
    } catch (error) {
      console.error("Failed to send billing notification:", error);
      throw error;
    }
  };

  const resendNotification = async (bill: any) => {
    const clientEmail = bill.profiles?.email || bill.client_email;
    if (!clientEmail) {
      toast({ title: "Aucun courriel client disponible", variant: "destructive" });
      return;
    }

    setIsResendingNotification(true);
    try {
      const notificationType = bill.status === "paid" 
        ? "payment_received" 
        : bill.status === "overdue" 
          ? "invoice_overdue" 
          : "invoice_created";

      await sendBillingNotification(
        clientEmail,
        bill.profiles?.full_name || "Client",
        notificationType,
        {
          invoiceNumber: bill.invoice_number,
          amount: calculateTotal(bill),
          dueDate: bill.due_date,
          paidAt: bill.paid_at,
          notes: bill.notes,
        }
      );
      
      toast({ 
        title: "Notification envoyée", 
        description: `Courriel envoyé à ${clientEmail}` 
      });
      logActivity("notification_resent", "invoice", bill.id, { email: clientEmail, type: notificationType });
    } catch (error) {
      toast({ title: "Erreur lors de l'envoi", variant: "destructive" });
    } finally {
      setIsResendingNotification(false);
    }
  };

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
      
      // Get client info for notification
      const selectedClient = clients?.find(c => c.user_id === invoice.user_id);
      if (selectedClient?.email) {
        sendBillingNotification(
          selectedClient.email,
          selectedClient.full_name || "Client",
          "invoice_created",
          {
            invoiceNumber,
            amount: parseFloat(invoice.amount),
            dueDate: invoice.due_date,
            notes: invoice.notes,
          }
        );
      }
      
      return data;
    },
    onSuccess: async (data) => {
      // Force immediate refetch to ensure the new invoice appears
      await queryClient.invalidateQueries({ queryKey: ["admin-billing"] });
      await queryClient.refetchQueries({ queryKey: ["admin-billing"] });
      logActivity("create", "invoice", data.id, { amount: data.amount });
      toast({ 
        title: "Facture créée avec succès",
        description: `Facture ${data.invoice_number} créée pour ${Number(data.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}`
      });
      setCreateDialogOpen(false);
      setNewInvoice({ user_id: "", amount: "", due_date: "", notes: "" });
    },
    onError: (error: any) => {
      console.error("Invoice creation error:", error);
      toast({ title: "Erreur lors de la création", description: error?.message, variant: "destructive" });
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
    setEtransferDetails({ senderName: "", amount: calculateTotal(bill).toString(), receivedBy: "" });
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
    
    if (paymentMethod === "etransfer") {
      if (!etransferDetails.senderName || !etransferDetails.amount || !etransferDetails.receivedBy) {
        toast({ title: "Veuillez remplir tous les détails du virement", variant: "destructive" });
        return;
      }
    }

    setIsProcessingPayment(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const referenceNumber = `PAY-${Date.now().toString(36).toUpperCase()}`;
      const totalAmount = calculateTotal(paymentBill);
      const paymentAmount = paymentMethod === "etransfer" ? parseFloat(etransferDetails.amount) : totalAmount;
      
      // Create payment record
      const paymentData: any = {
        billing_id: paymentBill.id,
        user_id: paymentBill.user_id,
        amount: paymentAmount,
        payment_method: paymentMethod === "credit" ? "credit_card" : "etransfer",
        reference_number: referenceNumber,
        status: "completed",
      };
      
      if (paymentMethod === "credit") {
        const cardNum = cardDetails.cardNumber.replace(/\s/g, "");
        paymentData.card_last_four = cardNum.slice(-4);
        paymentData.card_type = cardNum.startsWith("4") ? "Visa" : cardNum.startsWith("5") ? "Mastercard" : "Card";
      } else {
        paymentData.etransfer_sender_name = etransferDetails.senderName;
        paymentData.etransfer_amount = parseFloat(etransferDetails.amount);
        paymentData.received_by = etransferDetails.receivedBy;
      }
      
      const { error: paymentError } = await supabase
        .from("payments")
        .insert(paymentData);
      
      if (paymentError) throw paymentError;

      // Get current client profile
      const { data: clientProfile } = await supabase
        .from("profiles")
        .select("balance, store_credit")
        .eq("user_id", paymentBill.user_id)
        .single();

      const currentBalance = Number(clientProfile?.balance || 0);
      const currentCredit = Number(clientProfile?.store_credit || 0);
      
      // Update billing status based on payment
      const paymentNote = paymentMethod === "credit" 
        ? `[Paiement reçu via Carte de crédit - ****${paymentData.card_last_four}]`
        : `[Paiement reçu via Virement Interac - ${etransferDetails.senderName}]`;

      if (paymentAmount >= totalAmount) {
        // Full payment or overpayment - mark as paid
        const { error } = await supabase
          .from("billing")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            notes: `${paymentBill.notes || ""}\n${paymentNote}\nRéférence: ${referenceNumber}`.trim(),
          })
          .eq("id", paymentBill.id);

        if (error) throw error;

        // Update client balance - reduce by invoice amount
        let newBalance = Math.max(0, currentBalance - totalAmount);
        let newCredit = currentCredit;

        // If overpayment, add surplus to store credit
        if (paymentAmount > totalAmount) {
          const surplus = paymentAmount - totalAmount;
          newCredit = currentCredit + surplus;
        }

        await supabase
          .from("profiles")
          .update({ balance: newBalance, store_credit: newCredit })
          .eq("user_id", paymentBill.user_id);
      } else {
        // Partial payment - add to credits on invoice
        const currentCredits = Number(paymentBill.credits) || 0;
        const { error } = await supabase
          .from("billing")
          .update({
            credits: currentCredits + paymentAmount,
            notes: `${paymentBill.notes || ""}\n[Paiement partiel: $${paymentAmount.toFixed(2)}] ${paymentNote}\nRéférence: ${referenceNumber}`.trim(),
          })
          .eq("id", paymentBill.id);

        if (error) throw error;

        // Update client balance - reduce by payment amount
        await supabase
          .from("profiles")
          .update({ balance: Math.max(0, currentBalance - paymentAmount) })
          .eq("user_id", paymentBill.user_id);
      }

      queryClient.invalidateQueries({ queryKey: ["admin-billing"] });
      queryClient.invalidateQueries({ queryKey: ["admin-payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      logActivity("payment", "invoice", paymentBill.id, { 
        method: paymentMethod,
        amount: paymentAmount,
        reference: referenceNumber
      });

      // Send payment received notification
      const clientEmail = paymentBill.profiles?.email || paymentBill.client_email;
      if (clientEmail) {
        sendBillingNotification(
          clientEmail,
          paymentBill.profiles?.full_name || "Client",
          "payment_received",
          {
            invoiceNumber: paymentBill.invoice_number,
            amount: paymentAmount,
            paidAt: new Date().toISOString(),
            paymentMethod: paymentMethod === "credit" ? `Carte de crédit (****${paymentData.card_last_four})` : "Virement Interac",
          }
        );
      }
      
      // Show confirmation
      setPaymentConfirmation({
        referenceNumber,
        amount: paymentAmount,
        method: paymentMethod,
        clientName: paymentBill.profiles?.full_name || "Client",
        invoiceNumber: paymentBill.invoice_number || paymentBill.id.slice(0, 8),
        date: new Date().toISOString(),
        ...(paymentMethod === "credit" ? { cardLast4: paymentData.card_last_four, cardType: paymentData.card_type } : {}),
        ...(paymentMethod === "etransfer" ? { senderName: etransferDetails.senderName, receivedBy: etransferDetails.receivedBy } : {}),
      });
      
      setPaymentDialogOpen(false);
      setDetailsDialogOpen(false);
      setConfirmationDialogOpen(true);
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

  // Compact single-page PDF invoice
  const exportInvoicePDF = (bill: any) => {
    const subtotal = Number(bill.amount) || 0;
    const fees = Number(bill.fees) || 0;
    const credits = Number(bill.credits) || 0;
    const taxRate = 0.14975;
    const taxAmount = subtotal * taxRate;
    const totalBeforeCredits = subtotal + fees + taxAmount;
    const total = totalBeforeCredits - credits;
    const remainingBalance = bill.status === "paid" ? 0 : total;
    
    const clientName = bill.profiles?.full_name || "Client";
    const clientEmail = bill.profiles?.email || bill.client_email || "";
    const clientPhone = bill.profiles?.phone || "";
    const invoiceNum = bill.invoice_number || `INV-${bill.id.slice(0, 8).toUpperCase()}`;
    const dueDate = bill.due_date ? format(new Date(bill.due_date), "d MMM yyyy", { locale: fr }) : "Sur réception";
    const createdDate = format(new Date(bill.created_at), "d MMM yyyy", { locale: fr });
    const paidDate = bill.paid_at ? format(new Date(bill.paid_at), "d MMM yyyy", { locale: fr }) : null;
    const period = format(new Date(bill.created_at), "MMMM yyyy", { locale: fr });
    
    const paymentMethodMatch = bill.notes?.match(/\[Paiement reçu via (.*?)\]/);
    const paymentMethod = paymentMethodMatch ? paymentMethodMatch[1] : null;
    const refMatch = bill.notes?.match(/Référence: (PAY-[A-Z0-9]+)/);
    const refNumber = refMatch ? refMatch[1] : null;
    const cardMatch = paymentMethod?.match(/\*\*\*\*(\d{4})/);
    const cardLast4 = cardMatch ? `•••• ${cardMatch[1]}` : null;

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
          @page { size: A4; margin: 0; }
          body { 
            font-family: 'Inter', sans-serif; 
            font-size: 11px;
            color: #1e293b;
            background: #fff;
            line-height: 1.4;
          }
          .page {
            width: 210mm;
            min-height: 297mm;
            padding: 15mm;
            margin: 0 auto;
          }
          .header {
            text-align: center;
            padding-bottom: 12px;
            border-bottom: 2px solid #0891b2;
            margin-bottom: 15px;
          }
          .logo { font-size: 28px; font-weight: 700; color: #0891b2; letter-spacing: 3px; }
          .tagline { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }
          .company-info { margin-top: 8px; font-size: 9px; color: #475569; }
          .company-info p { margin: 1px 0; }
          
          .invoice-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 15px;
          }
          .invoice-title h1 { font-size: 22px; font-weight: 700; color: #0f172a; }
          .invoice-number { font-size: 12px; color: #0891b2; font-weight: 600; }
          .status-badge {
            padding: 5px 12px;
            border-radius: 15px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
          }
          .status-paid { background: #d1fae5; color: #059669; }
          .status-pending { background: #fef3c7; color: #d97706; }
          .status-overdue { background: #fee2e2; color: #dc2626; }
          
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 15px;
          }
          .info-section h3 {
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #94a3b8;
            margin-bottom: 6px;
            font-weight: 600;
          }
          .client-name { font-size: 13px; font-weight: 600; color: #0f172a; }
          .info-section p { color: #475569; margin: 2px 0; font-size: 10px; }
          
          .dates-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
          .date-item label { display: block; font-size: 8px; text-transform: uppercase; color: #94a3b8; }
          .date-item span { font-weight: 500; font-size: 10px; }
          
          .invoice-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          .invoice-table thead { background: linear-gradient(135deg, #0f172a, #1e293b); }
          .invoice-table th {
            color: #fff;
            padding: 8px 10px;
            text-align: left;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .invoice-table th:last-child { text-align: right; }
          .invoice-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; }
          .invoice-table td:last-child { text-align: right; font-weight: 500; }
          .item-desc { font-weight: 500; color: #0f172a; }
          .item-detail { font-size: 9px; color: #64748b; }
          
          .bottom-section { display: grid; grid-template-columns: 1fr 200px; gap: 20px; }
          
          .totals-table { width: 100%; }
          .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 10px; border-bottom: 1px solid #e2e8f0; }
          .totals-row.total { border-top: 2px solid #0f172a; border-bottom: none; font-size: 14px; font-weight: 700; padding-top: 10px; margin-top: 5px; }
          .totals-row.balance { background: ${remainingBalance > 0 ? '#fef2f2' : '#f0fdf4'}; margin: 8px -8px 0; padding: 8px; border-radius: 4px; font-weight: 600; color: ${remainingBalance > 0 ? '#dc2626' : '#059669'}; }
          
          .payment-info { background: #f8fafc; border-radius: 6px; padding: 10px; margin-bottom: 10px; }
          .payment-info h3 { font-size: 9px; text-transform: uppercase; color: #64748b; margin-bottom: 6px; }
          .payment-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
          .payment-item label { display: block; font-size: 8px; color: #94a3b8; }
          .payment-item span { font-size: 10px; font-weight: 600; }
          
          .notes-section { background: #fffbeb; border-left: 3px solid #f59e0b; padding: 8px 12px; margin-bottom: 10px; border-radius: 0 4px 4px 0; }
          .notes-section h3 { font-size: 9px; font-weight: 600; color: #92400e; margin-bottom: 4px; }
          .notes-section p { color: #78350f; font-size: 9px; }
          
          .policies { background: #f1f5f9; border-radius: 6px; padding: 10px; margin-bottom: 10px; }
          .policies h3 { font-size: 9px; font-weight: 600; color: #334155; margin-bottom: 6px; text-transform: uppercase; }
          .policies ul { list-style: none; padding: 0; columns: 2; column-gap: 15px; }
          .policies li { font-size: 8px; color: #475569; padding-left: 10px; position: relative; margin-bottom: 3px; break-inside: avoid; }
          .policies li::before { content: "•"; position: absolute; left: 0; color: #0891b2; }
          
          .late-warning { background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 8px; display: flex; align-items: center; gap: 8px; margin-top: 8px; }
          .late-warning p { color: #991b1b; font-size: 8px; font-weight: 500; }
          
          .footer { text-align: center; padding-top: 10px; border-top: 1px solid #e2e8f0; margin-top: 10px; }
          .footer .thank-you { font-size: 12px; font-weight: 600; color: #0891b2; margin-bottom: 4px; }
          .footer p { color: #94a3b8; font-size: 8px; margin: 2px 0; }
          
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .page { padding: 10mm; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="header">
            <div class="logo">NIVRA</div>
            <div class="tagline">Courtier Télécom Indépendant</div>
            <div class="company-info">
              <p>Montréal, QC, Canada | Tél: 438-544-2233 | Nivratelecom@gmail.com</p>
              <p>TPS: 123456789 RT0001 | TVQ: 1234567890 TQ0001</p>
            </div>
          </div>
          
          <div class="invoice-header">
            <div class="invoice-title">
              <h1>FACTURE</h1>
              <div class="invoice-number">${invoiceNum}</div>
            </div>
            <span class="status-badge status-${bill.status}">${statusLabels[bill.status] || bill.status}</span>
          </div>
          
          <div class="info-grid">
            <div class="info-section">
              <h3>Facturer à</h3>
              <div class="client-name">${clientName}</div>
              <p>${clientEmail}</p>
              ${clientPhone ? `<p>Tél: ${clientPhone}</p>` : ''}
            </div>
            <div class="info-section">
              <div class="dates-grid">
                <div class="date-item"><label>Émission</label><span>${createdDate}</span></div>
                <div class="date-item"><label>Échéance</label><span>${dueDate}</span></div>
                ${paidDate ? `<div class="date-item"><label>Payé le</label><span>${paidDate}</span></div>` : ''}
                <div class="date-item"><label>Période</label><span>${period}</span></div>
              </div>
            </div>
          </div>
          
          <table class="invoice-table">
            <thead>
              <tr>
                <th style="width:55%">Description</th>
                <th style="width:15%">Qté</th>
                <th style="width:15%">Prix unit.</th>
                <th style="width:15%">Montant</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><div class="item-desc">Services télécom</div><div class="item-detail">${bill.notes?.split('\n')[0]?.replace(/\[.*?\]/g, '').trim() || 'Services mensuels'} - ${period}</div></td>
                <td>1</td>
                <td>${formatCurrency(subtotal)}</td>
                <td>${formatCurrency(subtotal)}</td>
              </tr>
              ${fees > 0 ? `<tr><td><div class="item-desc">Frais ${bill.late_fee_applied ? '(retard 5%)' : 'admin.'}</div></td><td>—</td><td>—</td><td style="color:#dc2626">+${formatCurrency(fees)}</td></tr>` : ''}
            </tbody>
          </table>
          
          <div class="bottom-section">
            <div>
              ${bill.status === "paid" && paymentMethod ? `
              <div class="payment-info">
                <h3>Paiement reçu</h3>
                <div class="payment-grid">
                  <div class="payment-item"><label>Méthode</label><span>${paymentMethod.split(' - ')[0]}</span></div>
                  ${cardLast4 ? `<div class="payment-item"><label>Carte</label><span>${cardLast4}</span></div>` : ''}
                  ${refNumber ? `<div class="payment-item"><label>Référence</label><span>${refNumber}</span></div>` : ''}
                  <div class="payment-item"><label>Montant</label><span>${formatCurrency(total)}</span></div>
                </div>
              </div>
              ` : ''}
              
              ${bill.notes && !bill.notes.includes('[Paiement') ? `
              <div class="notes-section">
                <h3>Notes</h3>
                <p>${bill.notes.replace(/\[.*?\]/g, '').replace(/Référence:.*$/gm, '').trim()}</p>
              </div>
              ` : ''}
              
              <div class="policies">
                <h3>Conditions</h3>
                <ul>
                  <li>Paiement dû à l'échéance indiquée</li>
                  <li>Modes acceptés: Carte, Virement Interac</li>
                  <li><strong>5% par mois</strong> sur solde en retard</li>
                  <li>Intérêts composés mensuellement</li>
                </ul>
                ${bill.status !== "paid" ? `<div class="late-warning"><span>⚠️</span><p>Frais de 5% appliqués après l'échéance</p></div>` : ''}
              </div>
            </div>
            
            <div class="totals-table">
              <div class="totals-row"><span>Sous-total</span><span>${formatCurrency(subtotal)}</span></div>
              ${fees > 0 ? `<div class="totals-row" style="color:#dc2626"><span>Frais</span><span>+${formatCurrency(fees)}</span></div>` : ''}
              <div class="totals-row"><span>TPS+TVQ (14.975%)</span><span>${formatCurrency(taxAmount)}</span></div>
              ${credits > 0 ? `<div class="totals-row" style="color:#059669"><span>Crédits</span><span>-${formatCurrency(credits)}</span></div>` : ''}
              <div class="totals-row total"><span>Total</span><span>${formatCurrency(total)}</span></div>
              <div class="totals-row balance"><span>Solde ${remainingBalance > 0 ? 'dû' : ''}</span><span>${formatCurrency(remainingBalance)}</span></div>
            </div>
          </div>
          
          <div class="footer">
            <p class="thank-you">Merci de votre confiance!</p>
            <p>Nivra Inc. — Courtier télécom indépendant payé uniquement par ses clients</p>
            <p>Facture générée électroniquement • Valide sans signature</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.onload = () => printWindow.print();
    }
    toast({ title: "Facture PDF prête" });
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
                  <Select value={newInvoice.user_id} onValueChange={(v) => setNewInvoice({ ...newInvoice, user_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
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
                  <Input type="number" value={newInvoice.amount} onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })} placeholder="0.00" />
                </div>
                <div>
                  <Label>Date d'échéance</Label>
                  <Input type="date" value={newInvoice.due_date} onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })} />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={newInvoice.notes} onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })} placeholder="Description..." />
                </div>
                <Button className="w-full" onClick={() => createInvoiceMutation.mutate(newInvoice)} disabled={!newInvoice.user_id || !newInvoice.amount}>
                  Créer la facture
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">En attente</p>
                <p className="text-2xl font-bold text-foreground">{billing?.filter((b: any) => b.status === "pending").length || 0}</p>
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
                <p className="text-2xl font-bold text-foreground">{billing?.filter((b: any) => b.status === "overdue").length || 0}</p>
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
                  {billing?.filter((b: any) => b.status === "paid").reduce((sum: number, b: any) => sum + Number(b.amount), 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
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
              <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
            ) : filteredBilling && filteredBilling.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Nº</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Client</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Échéance</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBilling.map((bill: any) => (
                      <tr key={bill.id} className="border-b border-border/50 hover:bg-accent/50">
                        <td className="py-3 px-4 text-sm text-foreground font-mono">{bill.invoice_number || bill.id.slice(0, 8)}</td>
                        <td className="py-3 px-4">
                          <button 
                            className="text-left hover:text-cyan-400 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (bill.profiles) {
                                setSelectedClientProfile({ ...bill.profiles, user_id: bill.user_id });
                                setAdjustAmount("");
                                setClientProfileDialogOpen(true);
                              }
                            }}
                          >
                            <p className="text-sm text-foreground flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {bill.profiles?.full_name || "N/A"}
                            </p>
                            <p className="text-xs text-muted-foreground">{bill.profiles?.email}</p>
                          </button>
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground font-medium">{calculateTotal(bill).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">{bill.due_date ? format(new Date(bill.due_date), "d MMM yyyy", { locale: fr }) : "—"}</td>
                        <td className="py-3 px-4"><Badge className={statusColors[bill.status] || "bg-muted"}>{statusLabels[bill.status] || bill.status}</Badge></td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleViewDetails(bill)}><Eye className="w-4 h-4" /></Button>
                            <Button size="sm" variant="outline" onClick={() => exportInvoicePDF(bill)}><FileDown className="w-4 h-4" /></Button>
                            {bill.status !== "paid" && <Button size="sm" variant="hero" onClick={() => openPaymentDialog(bill)}><DollarSign className="w-4 h-4" /></Button>}
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
                <p className="text-muted-foreground">Aucune facture</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Détails de la facture</DialogTitle></DialogHeader>
            {selectedBill && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Montant de base</Label>
                    <Input type="number" value={selectedBill.amount} onChange={(e) => setSelectedBill({ ...selectedBill, amount: e.target.value })} />
                  </div>
                  <div>
                    <Label>Statut</Label>
                    <Select value={selectedBill.status} onValueChange={(v) => setSelectedBill({ ...selectedBill, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <div><Label>Frais</Label><Input type="number" value={selectedBill.fees || 0} onChange={(e) => setSelectedBill({ ...selectedBill, fees: e.target.value })} /></div>
                  <div><Label>Crédits</Label><Input type="number" value={selectedBill.credits || 0} onChange={(e) => setSelectedBill({ ...selectedBill, credits: e.target.value })} /></div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between text-sm"><span>Base:</span><span>{Number(selectedBill.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>
                  <div className="flex justify-between text-sm"><span>Frais:</span><span>+{Number(selectedBill.fees || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>
                  <div className="flex justify-between text-sm"><span>Crédits:</span><span>-{Number(selectedBill.credits || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>
                  <div className="flex justify-between font-bold mt-2 pt-2 border-t"><span>Total:</span><span>{calculateTotal(selectedBill).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>
                </div>
                <div><Label>Notes</Label><Textarea value={selectedBill.notes || ""} onChange={(e) => setSelectedBill({ ...selectedBill, notes: e.target.value })} /></div>
                <div className="flex flex-wrap gap-2">
                  <Button className="flex-1" onClick={() => { updateBillingMutation.mutate(selectedBill); setDetailsDialogOpen(false); }}>Enregistrer</Button>
                  <Button variant="outline" onClick={() => exportInvoicePDF(selectedBill)}><FileDown className="w-4 h-4 mr-2" />PDF</Button>
                  <Button 
                    variant="outline" 
                    onClick={() => resendNotification(selectedBill)}
                    disabled={isResendingNotification}
                  >
                    {isResendingNotification ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Renvoyer
                  </Button>
                  {selectedBill.status !== "paid" && <Button variant="hero" onClick={() => openPaymentDialog(selectedBill)}><DollarSign className="w-4 h-4 mr-2" />Paiement</Button>}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Payment Dialog */}
        <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Enregistrer un paiement</DialogTitle></DialogHeader>
            {paymentBill && (
              <div className="space-y-4 mt-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between text-sm"><span>Facture:</span><span className="font-mono">{paymentBill.invoice_number || paymentBill.id.slice(0, 8)}</span></div>
                  <div className="flex justify-between text-sm"><span>Client:</span><span>{paymentBill.profiles?.full_name || "N/A"}</span></div>
                  <div className="flex justify-between font-bold mt-2 pt-2 border-t"><span>Total:</span><span>{calculateTotal(paymentBill).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>
                </div>

                <div>
                  <Label>Méthode de paiement</Label>
                  <Select value={paymentMethod} onValueChange={(v: "credit" | "etransfer") => setPaymentMethod(v)}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="credit">Carte de crédit</SelectItem>
                      <SelectItem value="etransfer">Virement Interac</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {paymentMethod === "credit" && (
                  <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                    <div><Label>Numéro de carte</Label><Input placeholder="•••• •••• •••• ••••" value={cardDetails.cardNumber} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 16); setCardDetails({ ...cardDetails, cardNumber: v.replace(/(.{4})/g, "$1 ").trim() }); }} maxLength={19} /></div>
                    <div><Label>Nom</Label><Input value={cardDetails.cardName} onChange={(e) => setCardDetails({ ...cardDetails, cardName: e.target.value.toUpperCase() })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Expiration</Label><Input placeholder="MM/AA" value={cardDetails.expiry} onChange={(e) => { let v = e.target.value.replace(/\D/g, "").slice(0, 4); if (v.length >= 2) v = v.slice(0, 2) + "/" + v.slice(2); setCardDetails({ ...cardDetails, expiry: v }); }} maxLength={5} /></div>
                      <div><Label>CVV</Label><Input type="password" placeholder="***" value={cardDetails.cvv} onChange={(e) => setCardDetails({ ...cardDetails, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })} maxLength={4} /></div>
                    </div>
                  </div>
                )}

                {paymentMethod === "etransfer" && (
                  <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                    <div><Label>Nom de l'expéditeur</Label><Input placeholder="Nom du client ou entreprise" value={etransferDetails.senderName} onChange={(e) => setEtransferDetails({ ...etransferDetails, senderName: e.target.value })} /></div>
                    <div><Label>Montant reçu ($)</Label><Input type="number" value={etransferDetails.amount} onChange={(e) => setEtransferDetails({ ...etransferDetails, amount: e.target.value })} /></div>
                    <div><Label>Reçu par (employé)</Label><Input placeholder="Nom de l'employé" value={etransferDetails.receivedBy} onChange={(e) => setEtransferDetails({ ...etransferDetails, receivedBy: e.target.value })} /></div>
                  </div>
                )}

                <Button className="w-full" variant="hero" onClick={processPayment} disabled={!paymentMethod || isProcessingPayment}>
                  {isProcessingPayment ? "Traitement..." : "Confirmer le paiement"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Payment Confirmation Dialog */}
        <Dialog open={confirmationDialogOpen} onOpenChange={setConfirmationDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2 text-emerald-500"><CheckCircle className="w-6 h-6" />Paiement confirmé</DialogTitle></DialogHeader>
            {paymentConfirmation && (
              <div className="space-y-4 mt-4">
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-emerald-500" />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{paymentConfirmation.amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</p>
                  <p className="text-muted-foreground">Paiement enregistré avec succès</p>
                </div>
                <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Référence:</span><span className="font-mono font-medium">{paymentConfirmation.referenceNumber}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Facture:</span><span>{paymentConfirmation.invoiceNumber}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Client:</span><span>{paymentConfirmation.clientName}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Méthode:</span><span>{paymentConfirmation.method === "credit" ? "Carte de crédit" : "Virement Interac"}</span></div>
                  {paymentConfirmation.cardLast4 && <div className="flex justify-between"><span className="text-muted-foreground">Carte:</span><span>{paymentConfirmation.cardType} •••• {paymentConfirmation.cardLast4}</span></div>}
                  {paymentConfirmation.senderName && <div className="flex justify-between"><span className="text-muted-foreground">Expéditeur:</span><span>{paymentConfirmation.senderName}</span></div>}
                  {paymentConfirmation.receivedBy && <div className="flex justify-between"><span className="text-muted-foreground">Reçu par:</span><span>{paymentConfirmation.receivedBy}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Date:</span><span>{format(new Date(paymentConfirmation.date), "d MMM yyyy HH:mm", { locale: fr })}</span></div>
                </div>
                <Button className="w-full" onClick={() => setConfirmationDialogOpen(false)}>Fermer</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Client Profile Dialog */}
        <Dialog open={clientProfileDialogOpen} onOpenChange={setClientProfileDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-cyan-400" />
                Profil client
              </DialogTitle>
            </DialogHeader>
            {selectedClientProfile && (
              <div className="space-y-4 mt-4">
                <div className="text-center pb-4 border-b">
                  <p className="text-lg font-bold text-foreground">{selectedClientProfile.full_name || "Client"}</p>
                  <p className="text-sm text-muted-foreground">{selectedClientProfile.email}</p>
                  {selectedClientProfile.phone && <p className="text-sm text-muted-foreground">{selectedClientProfile.phone}</p>}
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-red-500/10 rounded-lg text-center">
                    <Wallet className="w-6 h-6 text-red-500 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Solde dû</p>
                    <p className="text-xl font-bold text-red-500">
                      {Number(selectedClientProfile.balance || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                    </p>
                  </div>
                  <div className="p-4 bg-emerald-500/10 rounded-lg text-center">
                    <DollarSign className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Crédit magasin</p>
                    <p className="text-xl font-bold text-emerald-500">
                      {Number(selectedClientProfile.store_credit || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Ajuster le solde</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="number" 
                      placeholder="Montant" 
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                    />
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={async () => {
                        if (!adjustAmount) return;
                        const newBalance = Math.max(0, Number(selectedClientProfile.balance || 0) + Number(adjustAmount));
                        await supabase.from("profiles").update({ balance: newBalance }).eq("user_id", selectedClientProfile.user_id);
                        logActivity("adjust_balance", "client", selectedClientProfile.user_id, { amount: adjustAmount, type: "add" });
                        setSelectedClientProfile({ ...selectedClientProfile, balance: newBalance });
                        queryClient.invalidateQueries({ queryKey: ["admin-billing"] });
                        toast({ title: "Solde ajusté" });
                        setAdjustAmount("");
                      }}
                    >
                      <PlusCircle className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={async () => {
                        if (!adjustAmount) return;
                        const newBalance = Math.max(0, Number(selectedClientProfile.balance || 0) - Number(adjustAmount));
                        await supabase.from("profiles").update({ balance: newBalance }).eq("user_id", selectedClientProfile.user_id);
                        logActivity("adjust_balance", "client", selectedClientProfile.user_id, { amount: adjustAmount, type: "remove" });
                        setSelectedClientProfile({ ...selectedClientProfile, balance: newBalance });
                        queryClient.invalidateQueries({ queryKey: ["admin-billing"] });
                        toast({ title: "Solde réduit" });
                        setAdjustAmount("");
                      }}
                    >
                      <MinusCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <Button className="w-full" variant="outline" onClick={() => setClientProfileDialogOpen(false)}>
                  Fermer
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
