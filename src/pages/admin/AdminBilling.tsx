import { useState, useEffect } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { CreditCard, Plus, Eye, DollarSign, AlertTriangle, FileDown, CheckCircle, Send, Loader2, User, Wallet, PlusCircle, MinusCircle, Search, PercentCircle, Package, Wrench } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { format, isPast, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { AccountingExportDialog } from "@/components/admin/AccountingExportDialog";
import { safePDFDownload, safePDFOpen } from "@/lib/pdfUtils";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-500",
  paid: "bg-emerald-500/20 text-emerald-500",
  overdue: "bg-red-500/20 text-red-500",
  cancelled: "bg-muted text-muted-foreground",
  disputed: "bg-orange-500/20 text-orange-500",
  refunded: "bg-purple-500/20 text-purple-500",
  partial: "bg-blue-500/20 text-blue-500",
};

const statusLabels: Record<string, string> = {
  pending: "En attente",
  paid: "Payé",
  overdue: "En retard",
  cancelled: "Annulé",
  disputed: "Contesté",
  refunded: "Remboursé",
  partial: "Partiel",
};

const paymentStatusLabels: Record<string, string> = {
  pending: "En attente",
  authorized: "Autorisé",
  captured: "Capturé",
  refunded: "Remboursé",
  disputed: "Contesté",
};

const paymentStatusColors: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-500",
  authorized: "bg-blue-500/20 text-blue-500",
  captured: "bg-emerald-500/20 text-emerald-500",
  refunded: "bg-purple-500/20 text-purple-500",
  disputed: "bg-red-500/20 text-red-500",
};

// E-Transfer specific status configuration
// Status values: Pending | Verification | Processed | Declined | Fraud | Refunded
const etransferStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-amber-500/20 text-amber-500", label: "Pending" },
  verification: { color: "bg-blue-500/20 text-blue-500", label: "Verification" },
  processed: { color: "bg-emerald-500/20 text-emerald-500", label: "Processed" },
  declined: { color: "bg-red-500/20 text-red-500", label: "Declined" },
  fraud: { color: "bg-red-600/30 text-red-600", label: "Fraud" },
  refunded: { color: "bg-purple-500/20 text-purple-500", label: "Refunded" },
};

const etransferStatusOptions = [
  { value: "pending", label: "Pending" },
  { value: "verification", label: "Verification" },
  { value: "processed", label: "Processed" },
  { value: "declined", label: "Declined" },
  { value: "fraud", label: "Fraud" },
  { value: "refunded", label: "Refunded" },
];

// Generate payment reference in format NIVRA-PAY-QC-YYYY-#####
const generatePaymentReference = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(10000 + Math.random() * 90000);
  return `NIVRA-PAY-QC-${year}-${random}`;
};

// E-transfer payment info for clients
const ETRANSFER_INFO = {
  email: "Support@nivra-telecom.ca",
  question: "Nom du client ou nom de l'entreprise",
  answer: "Le nom complet du client ou le nom de l'entreprise",
};

const AdminBilling = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const { isAdmin, permissions, maskCardNumber, formatCardDisplay } = useRoleAccess();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [paymentConfirmation, setPaymentConfirmation] = useState<any>(null);
  const [paymentBill, setPaymentBill] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<"credit" | "etransfer" | "paypal" | "">("");
  const [paypalDetails, setPaypalDetails] = useState({
    transactionId: "",
    payerEmail: "",
    amount: "",
  });
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
  const [searchQuery, setSearchQuery] = useState("");
  const [autoApplyLateFee, setAutoApplyLateFee] = useState(true);
  const [clientProfileDialogOpen, setClientProfileDialogOpen] = useState(false);
  const [selectedClientProfile, setSelectedClientProfile] = useState<any>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [etransferPaymentsDialogOpen, setEtransferPaymentsDialogOpen] = useState(false);
  const [selectedPaymentForStatus, setSelectedPaymentForStatus] = useState<any>(null);
  const [etransferStatusUpdateReason, setEtransferStatusUpdateReason] = useState("");
  const [recordPaymentDialogOpen, setRecordPaymentDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [newPayment, setNewPayment] = useState({
    user_id: "",
    amount: "",
    payment_method: "cash",
    reference_number: "",
    notes: "",
    billing_id: "",
  });
  const [newInvoice, setNewInvoice] = useState({
    user_id: "",
    amount: "",
    due_date: "",
    notes: "",
    delivery_fee: "30",
    installation_fee: "0",
    equipment_fee: "0",
    custom_fee: "0",
    custom_fee_label: "",
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

  // Query for E-Transfer payments
  const { data: etransferPayments, isLoading: etransferLoading } = useQuery({
    queryKey: ["admin-etransfer-payments"],
    queryFn: async () => {
      const { data: paymentsData, error } = await supabase
        .from("payments")
        .select("*")
        .eq("payment_method", "etransfer")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (paymentsData && paymentsData.length > 0) {
        const userIds = [...new Set(paymentsData.map((p: any) => p.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, email, full_name, balance")
          .in("user_id", userIds);

        return paymentsData.map((payment: any) => ({
          ...payment,
          profiles: profilesData?.find((p: any) => p.user_id === payment.user_id) || null,
        }));
      }

      return paymentsData || [];
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

  // Auto-apply late fees only if enabled
  useEffect(() => {
    if (billing && autoApplyLateFee) {
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
  }, [billing, autoApplyLateFee]);

  // Filter billing by tab and search query
  const filteredBilling = billing?.filter((bill: any) => {
    // Tab filter
    let matchesTab = true;
    if (activeTab === "overdue") matchesTab = bill.status === "overdue";
    else if (activeTab === "pending") matchesTab = bill.status === "pending";
    else if (activeTab === "paid") matchesTab = bill.status === "paid";
    else if (activeTab === "disputed") matchesTab = bill.status === "disputed";
    else if (activeTab === "refunded") matchesTab = bill.status === "refunded";
    else if (activeTab === "partial") matchesTab = bill.status === "partial";
    
    // Search filter
    let matchesSearch = true;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const clientName = bill.profiles?.full_name?.toLowerCase() || "";
      const clientEmail = bill.profiles?.email?.toLowerCase() || bill.client_email?.toLowerCase() || "";
      const invoiceNum = bill.invoice_number?.toLowerCase() || "";
      matchesSearch = clientName.includes(query) || clientEmail.includes(query) || invoiceNum.includes(query);
    }
    
    return matchesTab && matchesSearch;
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
      const baseAmount = parseFloat(invoice.amount) || 0;
      const deliveryFee = parseFloat(invoice.delivery_fee) || 0;
      const installationFee = parseFloat(invoice.installation_fee) || 0;
      const equipmentFee = parseFloat(invoice.equipment_fee) || 0;
      const customFee = parseFloat(invoice.custom_fee) || 0;
      const totalFees = deliveryFee + installationFee + equipmentFee + customFee;
      
      const notesWithFees = [
        invoice.notes,
        deliveryFee > 0 ? `[Frais livraison: $${deliveryFee.toFixed(2)}]` : "",
        installationFee > 0 ? `[Frais installation: $${installationFee.toFixed(2)}]` : "",
        equipmentFee > 0 ? `[Frais équipement: $${equipmentFee.toFixed(2)}]` : "",
        customFee > 0 && invoice.custom_fee_label ? `[${invoice.custom_fee_label}: $${customFee.toFixed(2)}]` : "",
      ].filter(Boolean).join("\n");
      
      const { data, error } = await supabase
        .from("billing")
        .insert({
          user_id: invoice.user_id,
          amount: baseAmount,
          subtotal: baseAmount,
          delivery_fee: deliveryFee,
          installation_fee: installationFee,
          fees: equipmentFee + customFee,
          due_date: invoice.due_date || null,
          notes: notesWithFees,
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
      logActivity("create", "invoice", data.id, { 
        amount: data.amount,
        invoice_number: data.invoice_number,
        due_date: data.due_date
      }, {
        changedField: "invoice",
        reason: "Nouvelle facture créée"
      });
      toast({ 
        title: "Facture créée avec succès",
        description: `Facture ${data.invoice_number} créée pour ${Number(data.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}`
      });
      setCreateDialogOpen(false);
      setNewInvoice({ user_id: "", amount: "", due_date: "", notes: "", delivery_fee: "30", installation_fee: "0", equipment_fee: "0", custom_fee: "0", custom_fee_label: "" });
    },
    onError: (error: any) => {
      console.error("Invoice creation error:", error);
      toast({ title: "Erreur lors de la création", description: error?.message, variant: "destructive" });
    },
  });

  // Record manual payment mutation
  const recordPaymentMutation = useMutation({
    mutationFn: async (payment: typeof newPayment) => {
      const amount = parseFloat(payment.amount) || 0;
      const refNumber = payment.reference_number || `PAY-${Date.now().toString(36).toUpperCase()}`;
      
      // Get client info
      const selectedClient = clients?.find((c: any) => c.user_id === payment.user_id);
      
      // Get current admin user info for audit trail
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Non authentifié");
      let adminName = currentUser?.email || 'Admin';
      let adminRole = 'admin';
      
      // Try to get profile name
      if (currentUser?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', currentUser.id)
          .maybeSingle();
        if (profile?.full_name) {
          adminName = profile.full_name;
        }
      }
      
      // Insert payment record with full audit trail
      const { data, error } = await supabase
        .from("payments")
        .insert({
          user_id: payment.user_id,
          amount,
          payment_method: payment.payment_method,
          reference_number: refNumber,
          payment_reference: refNumber,
          notes: payment.notes,
          billing_id: payment.billing_id || null,
          status: "completed",
          source: "admin",
          created_by_id: currentUser.id,
          created_by_name: adminName,
          created_by_role: adminRole,
        })
        .select()
        .single();
      
      if (error) throw error;

      // Update client balance
      const { data: profile } = await supabase
        .from("profiles")
        .select("balance")
        .eq("user_id", payment.user_id)
        .maybeSingle();
      
      const currentBalance = profile?.balance || 0;
      const newBalance = Math.max(0, currentBalance - amount);
      
      await supabase
        .from("profiles")
        .update({ balance: newBalance })
        .eq("user_id", payment.user_id);

      // Note: billing update is now handled by recompute_invoice_balance trigger

      // Send notification
      if (selectedClient?.email) {
        try {
          await sendBillingNotification(
            selectedClient.email,
            selectedClient.full_name || "Client",
            "payment_received",
            { amount, paymentMethod: payment.payment_method }
          );
        } catch (e) {
          console.error("Failed to send payment notification:", e);
        }
      }

      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-billing"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      logActivity("create", "payment", data.id, { 
        amount: data.amount,
        reference: data.reference_number,
        method: data.payment_method
      }, {
        changedField: "payment",
        reason: "Paiement manuel enregistré"
      });
      toast({ 
        title: "Paiement enregistré",
        description: `Réf: ${data.reference_number}`
      });
      setRecordPaymentDialogOpen(false);
      setNewPayment({ user_id: "", amount: "", payment_method: "cash", reference_number: "", notes: "", billing_id: "" });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error?.message, variant: "destructive" });
    },
  });

  const updateBillingMutation = useMutation({
    mutationFn: async (bill: any) => {
      const { error } = await supabase
        .from("billing")
        .update({
          amount: bill.amount,
          subtotal: bill.subtotal,
          fees: bill.fees,
          credits: bill.credits,
          delivery_fee: bill.delivery_fee,
          installation_fee: bill.installation_fee,
          activation_fee: bill.activation_fee,
          status: bill.status,
          notes: bill.notes,
          paid_at: bill.status === "paid" ? new Date().toISOString() : bill.paid_at,
          payment_reference: bill.payment_reference,
        })
        .eq("id", bill.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-billing"] });
      logActivity("update", "invoice", selectedBill?.id, { 
        status: selectedBill?.status,
        invoice_number: selectedBill?.invoice_number
      }, {
        changedField: "status",
        newValue: selectedBill?.status,
        reason: "Mise à jour manuelle"
      });
      toast({ title: "Facture mise à jour" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  // E-Transfer status update mutation (Admin + Employee only)
  const updateEtransferStatusMutation = useMutation({
    mutationFn: async ({ 
      paymentId, 
      newStatus, 
      reason,
      payment 
    }: { 
      paymentId: string; 
      newStatus: string; 
      reason: string;
      payment: any;
    }) => {
      const currentUser = (await supabase.auth.getUser()).data.user;
      if (!currentUser?.id) {
        throw new Error("Unauthorized: not authenticated");
      }
      const oldStatus = payment.status;

      // Get user role for logging
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      const actorRole = userRole?.role || "admin";

      // Only admin and employee can update (check role)
      if (actorRole !== "admin" && actorRole !== "employee") {
        throw new Error("Unauthorized: Only Admin and Employee can update payment status");
      }

      // Build audit fields (required by backend for finalized statuses)
      const finalizedStatuses = new Set(["captured", "completed", "processed"]);
      const allowedAuditRoles = new Set(["admin", "manager", "support", "billing", "system", "client"]);

      const { data: actorProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      const actorNameCandidate =
        actorProfile?.full_name ||
        (currentUser.user_metadata as any)?.full_name ||
        currentUser.email ||
        "Admin";
      const actorName = String(actorNameCandidate).trim() || "Admin";

      const auditRole = (() => {
        const r = String(actorRole || "").toLowerCase().trim();
        if (r === "employee") return "support";
        if (allowedAuditRoles.has(r)) return r;
        return "admin";
      })();

      const updatePayload: any = {
        status: newStatus,
        notes: `${payment.notes || ""}\n[PaymentStatus: ${oldStatus} → ${newStatus}] ${reason ? `Reason: ${reason}` : ""} (${format(new Date(), "d MMM yyyy HH:mm", { locale: fr })})`.trim(),
      };

      if (finalizedStatuses.has(newStatus)) {
        updatePayload.created_by_id = payment.created_by_id || currentUser.id;
        updatePayload.created_by_name = payment.created_by_name || actorName;
        updatePayload.created_by_role = payment.created_by_role || auditRole;
        updatePayload.source = payment.source || "admin";
      }

      const { error: paymentError } = await supabase
        .from("payments")
        .update(updatePayload)
        .eq("id", paymentId);

      if (paymentError) throw paymentError;

      // Log activity with exact field="PaymentStatus" and action="Updated"
      await supabase.from("activity_logs").insert({
        user_id: currentUser?.id || "00000000-0000-0000-0000-000000000000",
        entity_type: "payment",
        entity_id: paymentId,
        action: "Updated",
        actor_email: currentUser?.email,
        actor_name: currentUser?.user_metadata?.full_name || currentUser?.email,
        actor_role: actorRole === "admin" ? "Admin" : "Employee",
        changed_field: "PaymentStatus",
        old_value: oldStatus,
        new_value: newStatus,
        reason: reason || null,
        details: {
          payment_reference: payment.reference_number,
          amount: payment.amount,
          sender_name: payment.etransfer_sender_name,
          client_email: payment.profiles?.email,
          client_name: payment.profiles?.full_name,
        },
      });

      return { oldStatus, newStatus };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-etransfer-payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-billing"] });
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      toast({ 
        title: "E-Transfer Status Updated", 
        description: `${etransferStatusConfig[data.oldStatus]?.label || data.oldStatus} → ${etransferStatusConfig[data.newStatus]?.label || data.newStatus}` 
      });
      setSelectedPaymentForStatus(null);
      setEtransferStatusUpdateReason("");
    },
    onError: (error: any) => {
      console.error("E-Transfer status update error:", error);
      toast({ title: "Error updating status", description: error.message || "Please try again", variant: "destructive" });
    },
  });

  // Manual late fee application
  const applyManualLateFee = async (bill: any) => {
    const lateFee = Number(bill.amount) * 0.05;
    const currentFees = Number(bill.fees) || 0;
    const { error } = await supabase
      .from("billing")
      .update({
        fees: currentFees + lateFee,
        late_fee_applied: true,
        late_fee_amount: lateFee,
        status: "overdue",
      })
      .eq("id", bill.id);
    
    if (error) {
      toast({ title: "Erreur", variant: "destructive" });
      return;
    }
    
    queryClient.invalidateQueries({ queryKey: ["admin-billing"] });
    logActivity("apply_late_fee", "invoice", bill.id, { amount: lateFee });
    toast({ title: "Frais de retard appliqué (5%)", description: `+${lateFee.toFixed(2)} $` });
  };

  const openPaymentDialog = (bill: any) => {
    setPaymentBill(bill);
    setPaymentMethod("");
    setCardDetails({ cardNumber: "", cardName: "", expiry: "", cvv: "" });
    setEtransferDetails({ senderName: "", amount: calculateTotal(bill).toString(), receivedBy: "" });
    setPaypalDetails({ transactionId: "", payerEmail: "", amount: calculateTotal(bill).toString() });
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

    if (paymentMethod === "paypal") {
      if (!paypalDetails.transactionId || !paypalDetails.amount) {
        toast({ title: "Veuillez remplir l'ID de transaction PayPal et le montant", variant: "destructive" });
        return;
      }
    }

    setIsProcessingPayment(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const referenceNumber = generatePaymentReference();
      const totalAmount = calculateTotal(paymentBill);
      const paymentAmount = paymentMethod === "etransfer" 
        ? parseFloat(etransferDetails.amount) 
        : paymentMethod === "paypal" 
          ? parseFloat(paypalDetails.amount) 
          : totalAmount;
      
      // Create payment record
      const paymentData: any = {
        billing_id: paymentBill.id,
        user_id: paymentBill.user_id,
        amount: paymentAmount,
        payment_method: paymentMethod === "credit" ? "credit_card" : paymentMethod === "paypal" ? "paypal" : "etransfer",
        reference_number: referenceNumber,
        status: "completed",
      };
      
      if (paymentMethod === "credit") {
        const cardNum = cardDetails.cardNumber.replace(/\s/g, "");
        paymentData.card_last_four = cardNum.slice(-4);
        paymentData.card_type = cardNum.startsWith("4") ? "Visa" : cardNum.startsWith("5") ? "Mastercard" : "Card";
      } else if (paymentMethod === "paypal") {
        paymentData.provider_payment_id = paypalDetails.transactionId;
        paymentData.notes = `PayPal Transaction: ${paypalDetails.transactionId}${paypalDetails.payerEmail ? ` - Payer: ${paypalDetails.payerEmail}` : ""}`;
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
        .maybeSingle();

      const currentBalance = Number(clientProfile?.balance || 0);
      const currentCredit = Number(clientProfile?.store_credit || 0);
      
      // Update billing status based on payment
      const paymentNote = paymentMethod === "credit" 
        ? `[Paiement reçu via Carte de crédit - ****${paymentData.card_last_four}]`
        : paymentMethod === "paypal"
          ? `[Paiement reçu via PayPal - ${paypalDetails.transactionId}]`
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
        reference: referenceNumber,
        invoice_number: paymentBill.invoice_number,
        client_name: paymentBill.profiles?.full_name
      }, {
        changedField: "payment_status",
        oldValue: paymentBill.status,
        newValue: "paid",
        reason: `Paiement ${paymentMethod === "credit" ? "par carte" : "par Interac"}`
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
            paymentMethod: paymentMethod === "credit" 
              ? `Carte de crédit (****${paymentData.card_last_four})` 
              : paymentMethod === "paypal" 
                ? `PayPal (${paypalDetails.transactionId})` 
                : "Virement Interac",
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
        ...(paymentMethod === "paypal" ? { paypalTransactionId: paypalDetails.transactionId, payerEmail: paypalDetails.payerEmail } : {}),
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

  /**
   * Calculate invoice total - CORRECTED LOGIC
   * The 'amount' field already contains the FULL total (subtotal + installation + activation + taxes)
   * We only add late fees (fees) and subtract credits - DO NOT re-add installation/activation fees
   * 
   * The individual fee fields (installation_fee, activation_fee, delivery_fee) are for 
   * DISPLAY/BREAKDOWN purposes only, not for recalculation.
   */
  const calculateTotal = (bill: any) => {
    const base = Number(bill.amount) || 0;
    // 'fees' typically contains late fees or additional charges NOT included in base
    const lateFees = Number(bill.late_fee_amount) || 0;
    const credits = Number(bill.credits) || 0;
    // Preauth discount if applied
    const preauthDiscount = bill.preauth_discount_applied ? (Number(bill.preauth_discount) || 0) : 0;
    
    // Base amount already includes: subtotal + installation + activation + delivery + taxes
    // Only add late fees and subtract credits/discounts
    return base + lateFees - credits - preauthDiscount;
  };

  // Helper to fetch related order data for a billing entry
  const fetchRelatedOrderData = async (bill: any) => {
    // Try to find related order by order_id or related_order_number
    let orderData = null;
    if (bill.order_id) {
      const { data } = await supabase
        .from("orders")
        .select("*, equipment_details, promo_code, promo_discount_amount, promo_details, service_type, account_id")
        .eq("id", bill.order_id)
        .maybeSingle();
      orderData = data;
    } else if (bill.related_order_number) {
      const { data } = await supabase
        .from("orders")
        .select("*, equipment_details, promo_code, promo_discount_amount, promo_details, service_type, account_id")
        .eq("order_number", bill.related_order_number)
        .maybeSingle();
      orderData = data;
    }
    return orderData;
  };
  
  // Helper to fetch client account number
  const fetchClientAccountNumber = async (userId: string): Promise<string> => {
    // 1. Try profiles.client_number
    const { data: profile } = await supabase
      .from("profiles")
      .select("client_number")
      .eq("user_id", userId)
      .maybeSingle();
    
    if (profile?.client_number) {
      return profile.client_number;
    }
    
    // 2. Try accounts.account_number
    const { data: account } = await supabase
      .from("accounts")
      .select("account_number")
      .eq("client_id", userId)
      .maybeSingle();
    
    if (account?.account_number) {
      return account.account_number;
    }
    
    console.error("[AdminBilling] Could not find account number for user:", userId);
    return "";
  };

  // PDF Invoice using jsPDF - no blank tabs
  const exportInvoicePDF = async (bill: any) => {
    try {
      const { generateInvoicePDF } = await import("@/lib/invoicePdfGenerator");
      
      // Fetch related order to get line_items
      const orderData = await fetchRelatedOrderData(bill);
      const equipmentDetails = orderData?.equipment_details;
      const lineItems = equipmentDetails?.line_items || [];
      
      // CRITICAL: Fetch account number with robust fallback
      const clientAccountNumber = bill.user_id 
        ? await fetchClientAccountNumber(bill.user_id)
        : "";
      
      const subtotal = Number(bill.amount) || 0;
      const fees = Number(bill.fees) || 0;
      const credits = Number(bill.credits) || 0;
      const deliveryFee = Number(bill.delivery_fee) || 0;
      const activationFee = Number(bill.activation_fee) || 0;
      const installationFee = Number(bill.installation_fee) || 0;
      
      const invoiceNum = bill.invoice_number || `INV-${bill.id.slice(0, 8).toUpperCase()}`;
      const clientName = bill.profiles?.full_name || "Client";
      const clientEmail = bill.profiles?.email || bill.client_email || "";
      const clientPhone = bill.profiles?.phone || "";
      
      // Extract promo code from order or notes
      const promoCode = orderData?.promo_code || bill.notes?.match(/Promo:\s*(\w+)/i)?.[1];
      const promoDiscount = Number(orderData?.promo_discount_amount) || Number(bill.discount_amount) || 0;
      
      // Parse payment info from notes
      const paymentMethodMatch = bill.notes?.match(/\[Paiement reçu via (.*?)\]/);
      const paymentMethod = paymentMethodMatch ? paymentMethodMatch[1] : null;
      const cardMatch = paymentMethod?.match(/\*\*\*\*(\d{4})/);
      const cardLast4 = cardMatch ? cardMatch[1] : undefined;
      
      // Get service plan from line_items or order or notes
      let servicePlan = "Services télécom";
      const serviceItems = lineItems.filter((li: any) => li.category === "service");
      if (serviceItems.length > 0) {
        servicePlan = serviceItems.map((li: any) => li.name).join(", ");
      } else if (orderData?.service_type) {
        servicePlan = orderData.service_type;
      } else if (bill.notes) {
        servicePlan = bill.notes.split('\n')[0]?.replace(/\[.*?\]/g, '').trim() || servicePlan;
      }
      
      const invoiceData = {
        invoiceNumber: invoiceNum,
        orderNumber: bill.related_order_number || orderData?.order_number,
        paymentReference: bill.payment_reference,
        clientNumber: clientAccountNumber, // Use fetched account number
        clientName,
        clientEmail,
        clientPhone,
        subtotal,
        fees,
        credits,
        deliveryFee,
        activationFee,
        installationFee,
        discountAmount: promoDiscount,
        preauthDiscount: Number(bill.preauth_discount) || 0,
        tpsAmount: Number(bill.tps_amount),
        tvqAmount: Number(bill.tvq_amount),
        lateFeeAmount: Number(bill.late_fee_amount) || 0,
        dueDate: bill.due_date,
        createdAt: bill.created_at,
        status: bill.status,
        paidAt: bill.paid_at,
        notes: bill.notes,
        servicePlan,
        promoCode,
        promoDescription: promoCode ? `Rabais promotionnel (${promoCode})` : undefined,
        paymentMethod: paymentMethod?.includes("Interac") ? "etransfer" as const : 
                       paymentMethod?.includes("Carte") ? "credit_card" as const : undefined,
        cardLast4,
        // CRITICAL: Pass order line items for multi-service support
        orderLineItems: lineItems.length > 0 ? lineItems : undefined,
      };
      
      const doc = generateInvoicePDF(invoiceData);
      const blob = doc.output("blob");
      
      safePDFDownload(blob, `Facture_${invoiceNum}.pdf`);
      toast({ title: "Facture téléchargée" });
    } catch (error) {
      console.error("Error generating invoice PDF:", error);
      toast({ title: "Erreur lors de la génération", variant: "destructive" });
    }
  };
  
  // View invoice PDF in new tab
  const viewInvoicePDF = async (bill: any) => {
    try {
      const { generateInvoicePDF } = await import("@/lib/invoicePdfGenerator");
      
      // Fetch related order to get line_items
      const orderData = await fetchRelatedOrderData(bill);
      const equipmentDetails = orderData?.equipment_details;
      const lineItems = equipmentDetails?.line_items || [];
      
      // CRITICAL: Fetch account number with robust fallback
      const clientAccountNumber = bill.user_id 
        ? await fetchClientAccountNumber(bill.user_id)
        : "";
      
      const subtotal = Number(bill.amount) || 0;
      const fees = Number(bill.fees) || 0;
      const credits = Number(bill.credits) || 0;
      const deliveryFee = Number(bill.delivery_fee) || 0;
      const activationFee = Number(bill.activation_fee) || 0;
      const installationFee = Number(bill.installation_fee) || 0;
      
      const invoiceNum = bill.invoice_number || `INV-${bill.id.slice(0, 8).toUpperCase()}`;
      const clientName = bill.profiles?.full_name || "Client";
      const clientEmail = bill.profiles?.email || bill.client_email || "";
      const clientPhone = bill.profiles?.phone || "";
      
      // Extract promo code from order or notes
      const promoCode = orderData?.promo_code || bill.notes?.match(/Promo:\s*(\w+)/i)?.[1];
      const promoDiscount = Number(orderData?.promo_discount_amount) || Number(bill.discount_amount) || 0;
      
      // Get service plan from line_items or order or notes
      let servicePlan = "Services télécom";
      const serviceItems = lineItems.filter((li: any) => li.category === "service");
      if (serviceItems.length > 0) {
        servicePlan = serviceItems.map((li: any) => li.name).join(", ");
      } else if (orderData?.service_type) {
        servicePlan = orderData.service_type;
      } else if (bill.notes) {
        servicePlan = bill.notes.split('\n')[0]?.replace(/\[.*?\]/g, '').trim() || servicePlan;
      }
      
      const invoiceData = {
        invoiceNumber: invoiceNum,
        orderNumber: bill.related_order_number || orderData?.order_number,
        paymentReference: bill.payment_reference,
        clientNumber: clientAccountNumber, // Use fetched account number
        clientName,
        clientEmail,
        clientPhone,
        subtotal,
        fees,
        credits,
        deliveryFee,
        activationFee,
        installationFee,
        discountAmount: promoDiscount,
        preauthDiscount: Number(bill.preauth_discount) || 0,
        dueDate: bill.due_date,
        createdAt: bill.created_at,
        status: bill.status,
        paidAt: bill.paid_at,
        notes: bill.notes,
        servicePlan,
        promoCode,
        promoDescription: promoCode ? `Rabais promotionnel (${promoCode})` : undefined,
        // CRITICAL: Pass order line items for multi-service support
        orderLineItems: lineItems.length > 0 ? lineItems : undefined,
      };
      
      const doc = generateInvoicePDF(invoiceData);
      const blob = doc.output("blob");
      
      safePDFOpen(blob, `Facture_${invoiceNum}.pdf`);
    } catch (error) {
      console.error("Error viewing invoice PDF:", error);
      toast({ title: "Erreur lors de l'ouverture", variant: "destructive" });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Facturation</h1>
            <p className="text-muted-foreground mt-1">Gérer les factures et paiements</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              onClick={() => setExportDialogOpen(true)}
            >
              <FileDown className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setEtransferPaymentsDialogOpen(true)}
              className="relative"
            >
              <Wallet className="w-4 h-4 mr-2" />
              E-Transfers
              {etransferPayments && etransferPayments.filter((p: any) => p.status === "pending" || p.status === "in_verification").length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-xs rounded-full flex items-center justify-center">
                  {etransferPayments.filter((p: any) => p.status === "pending" || p.status === "in_verification").length}
                </span>
              )}
            </Button>
            <Button variant="outline" onClick={() => setRecordPaymentDialogOpen(true)}>
              <DollarSign className="w-4 h-4 mr-2" />
              Enregistrer paiement
            </Button>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="hero">
                  <Plus className="w-4 h-4 mr-2" />
                  Nouvelle facture
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                  <Label>Montant de base</Label>
                  <Input type="number" value={newInvoice.amount} onChange={(e) => setNewInvoice({ ...newInvoice, amount: e.target.value })} placeholder="0.00" />
                </div>
                <div>
                  <Label>Date d'échéance</Label>
                  <Input type="date" value={newInvoice.due_date} onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })} />
                </div>
                
                {/* Fee controls */}
                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <Label className="flex items-center gap-2"><Package className="w-4 h-4" />Frais additionnels</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Frais livraison ($)</Label>
                      <Input type="number" value={newInvoice.delivery_fee} onChange={(e) => setNewInvoice({ ...newInvoice, delivery_fee: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Frais installation ($)</Label>
                      <Input type="number" value={newInvoice.installation_fee} onChange={(e) => setNewInvoice({ ...newInvoice, installation_fee: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Frais équipement ($)</Label>
                      <Input type="number" value={newInvoice.equipment_fee} onChange={(e) => setNewInvoice({ ...newInvoice, equipment_fee: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Frais personnalisé ($)</Label>
                      <Input type="number" value={newInvoice.custom_fee} onChange={(e) => setNewInvoice({ ...newInvoice, custom_fee: e.target.value })} />
                    </div>
                  </div>
                  {parseFloat(newInvoice.custom_fee) > 0 && (
                    <div>
                      <Label className="text-xs">Libellé frais personnalisé</Label>
                      <Input value={newInvoice.custom_fee_label} onChange={(e) => setNewInvoice({ ...newInvoice, custom_fee_label: e.target.value })} placeholder="Ex: Frais admin" />
                    </div>
                  )}
                </div>
                
                <div>
                  <Label>Notes</Label>
                  <Textarea value={newInvoice.notes} onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })} placeholder="Description..." />
                </div>
                
                {/* Invoice preview */}
                <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                  <div className="flex justify-between"><span>Base:</span><span>{parseFloat(newInvoice.amount || "0").toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Livraison:</span><span>+{parseFloat(newInvoice.delivery_fee || "0").toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Installation:</span><span>+{parseFloat(newInvoice.installation_fee || "0").toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Équipement:</span><span>+{parseFloat(newInvoice.equipment_fee || "0").toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>
                  {parseFloat(newInvoice.custom_fee) > 0 && (
                    <div className="flex justify-between text-muted-foreground"><span>{newInvoice.custom_fee_label || "Autre"}:</span><span>+{parseFloat(newInvoice.custom_fee).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>
                  )}
                  <div className="flex justify-between font-bold border-t pt-1 mt-1">
                    <span>Total:</span>
                    <span>{(
                      parseFloat(newInvoice.amount || "0") +
                      parseFloat(newInvoice.delivery_fee || "0") +
                      parseFloat(newInvoice.installation_fee || "0") +
                      parseFloat(newInvoice.equipment_fee || "0") +
                      parseFloat(newInvoice.custom_fee || "0")
                    ).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                  </div>
                </div>
                
                <Button className="w-full" onClick={() => createInvoiceMutation.mutate(newInvoice)} disabled={!newInvoice.user_id || !newInvoice.amount}>
                  Créer la facture
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
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
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-cyan-400" />
                  Factures
                </CardTitle>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Switch 
                      checked={autoApplyLateFee} 
                      onCheckedChange={setAutoApplyLateFee}
                      id="auto-late-fee"
                    />
                    <Label htmlFor="auto-late-fee" className="text-xs cursor-pointer flex items-center gap-1">
                      <PercentCircle className="w-3 h-3" />
                      Auto-frais 5%
                    </Label>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Rechercher par client, email, ou nº facture..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="flex-wrap h-auto">
                    <TabsTrigger value="all" className="text-xs">Toutes</TabsTrigger>
                    <TabsTrigger value="pending" className="text-xs">En attente</TabsTrigger>
                    <TabsTrigger value="overdue" className="text-xs">En retard</TabsTrigger>
                    <TabsTrigger value="paid" className="text-xs">Payées</TabsTrigger>
                    <TabsTrigger value="partial" className="text-xs">Partiel</TabsTrigger>
                    <TabsTrigger value="disputed" className="text-xs">Contesté</TabsTrigger>
                    <TabsTrigger value="refunded" className="text-xs">Remboursé</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
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
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Crédits</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Échéance</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBilling.map((bill: any) => {
                      const remainingBalance = calculateTotal(bill);
                      const hasCredits = Number(bill.credits || 0) > 0;
                      return (
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
                          <td className="py-3 px-4 text-sm text-foreground font-medium">{remainingBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</td>
                          <td className="py-3 px-4 text-sm">
                            {hasCredits ? (
                              <span className="text-emerald-500 font-medium">-{Number(bill.credits).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">{bill.due_date ? format(new Date(bill.due_date), "d MMM yyyy", { locale: fr }) : "—"}</td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              <Badge className={statusColors[bill.status] || "bg-muted"}>{statusLabels[bill.status] || bill.status}</Badge>
                              {bill.preauth_discount_applied && (
                                <Badge className="bg-emerald-500/20 text-emerald-500 text-xs">
                                  -5$/mois
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleViewDetails(bill)}><Eye className="w-4 h-4" /></Button>
                              <Button size="sm" variant="outline" onClick={() => exportInvoicePDF(bill)}><FileDown className="w-4 h-4" /></Button>
                              {bill.status === "pending" && !bill.late_fee_applied && (
                                <Button size="sm" variant="outline" onClick={() => applyManualLateFee(bill)} title="Appliquer frais 5%">
                                  <PercentCircle className="w-4 h-4" />
                                </Button>
                              )}
                              {bill.status !== "paid" && bill.status !== "refunded" && <Button size="sm" variant="hero" onClick={() => openPaymentDialog(bill)}><DollarSign className="w-4 h-4" /></Button>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">{searchQuery ? "Aucun résultat" : "Aucune facture"}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Détails de la facture</DialogTitle></DialogHeader>
            {selectedBill && (
              <div className="space-y-4 mt-4">
                {/* Invoice Info */}
                <div className="p-3 bg-muted/50 rounded-lg flex flex-wrap gap-4 text-sm">
                  <div><span className="text-muted-foreground">Nº:</span> <span className="font-mono font-medium">{selectedBill.invoice_number}</span></div>
                  <div><span className="text-muted-foreground">Client:</span> <span className="font-medium">{selectedBill.profiles?.full_name}</span></div>
                  {selectedBill.payment_reference && (
                    <div><span className="text-muted-foreground">Réf. paiement:</span> <span className="font-mono text-cyan-400">{selectedBill.payment_reference}</span></div>
                  )}
                </div>
                
                {/* Linked E-Transfer Status */}
                {(() => {
                  const linkedEtransfer = etransferPayments?.find((p: any) => p.billing_id === selectedBill.id);
                  if (linkedEtransfer) {
                    const statusConfig = etransferStatusConfig[linkedEtransfer.status] || etransferStatusConfig.pending;
                    return (
                      <div className="p-3 bg-muted/30 rounded-lg border border-muted">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Wallet className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Paiement E-Transfer lié</p>
                              <p className="text-xs text-muted-foreground font-mono">{linkedEtransfer.reference_number}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setSelectedPaymentForStatus(linkedEtransfer);
                                setEtransferStatusUpdateReason("");
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        {linkedEtransfer.etransfer_sender_name && (
                          <p className="text-xs text-muted-foreground mt-2">Expéditeur: {linkedEtransfer.etransfer_sender_name}</p>
                        )}
                        <p className="text-xs text-muted-foreground">Montant: {Number(linkedEtransfer.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</p>
                      </div>
                    );
                  }
                  return null;
                })()}
                
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
                        <SelectItem value="partial">Partiel</SelectItem>
                        <SelectItem value="disputed">Contesté</SelectItem>
                        <SelectItem value="refunded">Remboursé</SelectItem>
                        <SelectItem value="cancelled">Annulé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                {/* Fee Controls */}
                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <Label className="flex items-center gap-2"><Wrench className="w-4 h-4" />Frais détaillés</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Frais livraison ($)</Label>
                      <Input type="number" value={selectedBill.delivery_fee || 0} onChange={(e) => setSelectedBill({ ...selectedBill, delivery_fee: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Frais installation ($)</Label>
                      <Input type="number" value={selectedBill.installation_fee || 0} onChange={(e) => setSelectedBill({ ...selectedBill, installation_fee: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Frais activation ($)</Label>
                      <Input type="number" value={selectedBill.activation_fee || 0} onChange={(e) => setSelectedBill({ ...selectedBill, activation_fee: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Autres frais ($)</Label>
                      <Input type="number" value={selectedBill.fees || 0} onChange={(e) => setSelectedBill({ ...selectedBill, fees: e.target.value })} />
                    </div>
                  </div>
                </div>
                
                {/* Credit Controls */}
                <div className="p-4 bg-emerald-500/10 rounded-lg">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <Label className="text-xs">Crédits à appliquer ($)</Label>
                      <Input type="number" value={selectedBill.credits || 0} onChange={(e) => setSelectedBill({ ...selectedBill, credits: e.target.value })} />
                    </div>
                    {isAdmin && (
                      <div className="text-xs text-muted-foreground mt-4">
                        Admin peut outrepasser
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Preauth Discount Badge */}
                {selectedBill.preauth_discount_applied && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-500/20 text-emerald-500">Pré-autorisé</Badge>
                      <span className="text-sm text-emerald-600">Rabais mensuel de 5$ appliqué</span>
                    </div>
                    <span className="font-medium text-emerald-500">-5,00 $</span>
                  </div>
                )}
                
                {/* Totals Summary - CORRECTED: fees are INCLUDED in base, not added */}
                <div className="p-4 bg-muted rounded-lg space-y-1">
                  <div className="flex justify-between text-sm font-medium">
                    <span>Montant total (TTC):</span>
                    <span>{Number(selectedBill.amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                  </div>
                  
                  {/* Show breakdown as informational only - these are INCLUDED in total, not added */}
                  {(Number(selectedBill.installation_fee) > 0 || Number(selectedBill.activation_fee) > 0 || Number(selectedBill.delivery_fee) > 0) && (
                    <div className="text-xs text-muted-foreground pl-2 border-l-2 border-muted-foreground/30 mt-2 space-y-0.5">
                      <p className="italic mb-1">Détail inclus dans le montant:</p>
                      {Number(selectedBill.installation_fee) > 0 && (
                        <div className="flex justify-between"><span>• Installation:</span><span>{Number(selectedBill.installation_fee).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>
                      )}
                      {Number(selectedBill.activation_fee) > 0 && (
                        <div className="flex justify-between"><span>• Activation:</span><span>{Number(selectedBill.activation_fee).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>
                      )}
                      {Number(selectedBill.delivery_fee) > 0 && (
                        <div className="flex justify-between"><span>• Livraison:</span><span>{Number(selectedBill.delivery_fee).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span></div>
                      )}
                    </div>
                  )}
                  
                  {/* Late fees - these ARE added on top */}
                  {Number(selectedBill.late_fee_amount) > 0 && (
                    <div className="flex justify-between text-sm text-amber-500">
                      <span>Frais de retard:</span>
                      <span>+{Number(selectedBill.late_fee_amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                  )}
                  
                  {/* Credits - subtracted */}
                  {Number(selectedBill.credits) > 0 && (
                    <div className="flex justify-between text-sm text-emerald-500">
                      <span>Crédits appliqués:</span>
                      <span>-{Number(selectedBill.credits).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                  )}
                  
                  {/* Preauth discount */}
                  {selectedBill.preauth_discount_applied && (
                    <div className="flex justify-between text-sm text-emerald-500">
                      <span>Rabais pré-autorisé:</span>
                      <span>-{Number(selectedBill.preauth_discount || 5).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
                    </div>
                  )}
                  
                  {/* Final total */}
                  <div className="flex justify-between font-bold mt-2 pt-2 border-t">
                    <span>Solde dû:</span>
                    <span className={calculateTotal(selectedBill) > 0 ? 'text-amber-500' : 'text-emerald-500'}>
                      {calculateTotal(selectedBill).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                    </span>
                  </div>
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
                  {selectedBill.status !== "paid" && selectedBill.status !== "refunded" && (
                    <Button variant="hero" onClick={() => openPaymentDialog(selectedBill)}><DollarSign className="w-4 h-4 mr-2" />Paiement</Button>
                  )}
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
                  <Select value={paymentMethod} onValueChange={(v: "credit" | "etransfer" | "paypal") => setPaymentMethod(v)}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="etransfer">Virement Interac</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="credit">Carte de crédit</SelectItem>
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

                {paymentMethod === "paypal" && (
                  <div className="space-y-3 p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19.554 9.488c.121.563.106 1.246-.04 2.017-.582 2.464-2.477 3.88-5.336 3.88h-.71c-.323 0-.6.216-.665.524l-.513 3.292-.146.935c-.033.211.127.403.34.403h2.398c.283 0 .526-.19.581-.468l.024-.123.46-2.922.03-.163c.055-.278.298-.468.58-.468h.367c2.369 0 4.221-1.042 4.762-4.057.226-1.261.11-2.314-.488-3.054a2.57 2.57 0 0 0-.644-.563c.138.244.252.505.34.78z" fill="#179BD7"/>
                        <path d="M18.474 9.081a5.97 5.97 0 0 0-.74-.195 9.456 9.456 0 0 0-1.505-.11h-4.562c-.283 0-.526.19-.581.467l-.973 6.17-.028.18c.065-.308.342-.524.665-.524h1.386c2.84 0 5.062-1.155 5.713-4.495.019-.099.036-.195.05-.289a3.09 3.09 0 0 0-.425-.204z" fill="#222D65"/>
                        <path d="M10.663 9.243a.595.595 0 0 1 .58-.467h4.563c.541 0 1.047.037 1.505.11.129.02.254.045.375.073.128.03.25.063.365.1.058.018.113.038.168.058a3.1 3.1 0 0 1 .257.103c.086-.55.085-1.106-.027-1.648-.376-1.822-1.667-2.573-3.612-2.573h-5.8c-.323 0-.6.216-.665.524L6.67 17.403c-.04.253.152.48.408.48h2.972l.746-4.733.867-3.907z" fill="#253B80"/>
                      </svg>
                      <span className="font-medium text-blue-600">PayPal</span>
                    </div>
                    <div><Label>ID Transaction PayPal *</Label><Input placeholder="Ex: 5TY12345AB678901C" value={paypalDetails.transactionId} onChange={(e) => setPaypalDetails({ ...paypalDetails, transactionId: e.target.value.toUpperCase() })} /></div>
                    <div><Label>Montant reçu ($) *</Label><Input type="number" value={paypalDetails.amount} onChange={(e) => setPaypalDetails({ ...paypalDetails, amount: e.target.value })} /></div>
                    <div><Label>Courriel du payeur (optionnel)</Label><Input type="email" placeholder="client@example.com" value={paypalDetails.payerEmail} onChange={(e) => setPaypalDetails({ ...paypalDetails, payerEmail: e.target.value })} /></div>
                    <p className="text-xs text-muted-foreground">L'ID de transaction se trouve dans les détails de la transaction sur PayPal.</p>
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
                  <div className="flex justify-between"><span className="text-muted-foreground">Méthode:</span><span>{paymentConfirmation.method === "credit" ? "Carte de crédit" : paymentConfirmation.method === "paypal" ? "PayPal" : "Virement Interac"}</span></div>
                  {paymentConfirmation.cardLast4 && <div className="flex justify-between"><span className="text-muted-foreground">Carte:</span><span>{paymentConfirmation.cardType} •••• {paymentConfirmation.cardLast4}</span></div>}
                  {paymentConfirmation.paypalTransactionId && <div className="flex justify-between"><span className="text-muted-foreground">Transaction PayPal:</span><span className="font-mono text-xs">{paymentConfirmation.paypalTransactionId}</span></div>}
                  {paymentConfirmation.payerEmail && <div className="flex justify-between"><span className="text-muted-foreground">Payeur:</span><span>{paymentConfirmation.payerEmail}</span></div>}
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

        {/* E-Transfer Payments Dialog */}
        <Dialog open={etransferPaymentsDialogOpen} onOpenChange={setEtransferPaymentsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-cyan-400" />
                Paiements E-Transfer
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {etransferLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}
                </div>
              ) : etransferPayments && etransferPayments.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Réf.</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Client</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Expéditeur</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Montant</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Date</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Statut</th>
                        <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {etransferPayments.map((payment: any) => (
                        <tr key={payment.id} className="border-b border-border/50 hover:bg-accent/30">
                          <td className="py-2 px-3 text-xs font-mono">{payment.reference_number}</td>
                          <td className="py-2 px-3">
                            <div className="text-xs font-medium">{payment.profiles?.full_name || "N/A"}</div>
                            <div className="text-xs text-muted-foreground">{payment.profiles?.email}</div>
                          </td>
                          <td className="py-2 px-3 text-xs">{payment.etransfer_sender_name || "—"}</td>
                          <td className="py-2 px-3 text-xs font-medium">
                            {Number(payment.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                          </td>
                          <td className="py-2 px-3 text-xs text-muted-foreground">
                            {format(new Date(payment.created_at), "d MMM yyyy", { locale: fr })}
                          </td>
                          <td className="py-2 px-3">
                            <Badge className={etransferStatusConfig[payment.status]?.color || "bg-muted"}>
                              {etransferStatusConfig[payment.status]?.label || payment.status}
                            </Badge>
                          </td>
                          <td className="py-2 px-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedPaymentForStatus(payment);
                                setEtransferStatusUpdateReason("");
                              }}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              Modifier
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Aucun paiement E-Transfer</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* E-Transfer Status Update Dialog */}
        <Dialog open={!!selectedPaymentForStatus} onOpenChange={(open) => !open && setSelectedPaymentForStatus(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-cyan-400" />
                Modifier le statut E-Transfer
              </DialogTitle>
            </DialogHeader>
            {selectedPaymentForStatus && (
              <div className="space-y-4 mt-4">
                {/* Payment Info */}
                <div className="p-4 bg-muted/50 rounded-lg space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Référence:</span>
                    <span className="font-mono font-medium">{selectedPaymentForStatus.reference_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Client:</span>
                    <span>{selectedPaymentForStatus.profiles?.full_name || "N/A"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expéditeur:</span>
                    <span>{selectedPaymentForStatus.etransfer_sender_name || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Montant:</span>
                    <span className="font-bold text-foreground">
                      {Number(selectedPaymentForStatus.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date:</span>
                    <span>{format(new Date(selectedPaymentForStatus.created_at), "d MMM yyyy HH:mm", { locale: fr })}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Statut actuel:</span>
                    <Badge className={etransferStatusConfig[selectedPaymentForStatus.status]?.color || "bg-muted"}>
                      {etransferStatusConfig[selectedPaymentForStatus.status]?.label || selectedPaymentForStatus.status}
                    </Badge>
                  </div>
                </div>

                {/* Status Selector */}
                <div className="space-y-2">
                  <Label>Nouveau statut</Label>
                  <Select 
                    value={selectedPaymentForStatus.newStatus || ""}
                    onValueChange={(v) => setSelectedPaymentForStatus({ ...selectedPaymentForStatus, newStatus: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un statut" />
                    </SelectTrigger>
                    <SelectContent>
                      {etransferStatusOptions
                        .filter((opt) => opt.value !== selectedPaymentForStatus.status)
                        .map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${etransferStatusConfig[opt.value]?.color.replace("text-", "bg-").split(" ")[0]}`} />
                              {opt.label}
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Reason Field */}
                <div className="space-y-2">
                  <Label>Raison du changement (optionnel)</Label>
                  <Textarea
                    placeholder="Ex: Virement vérifié, correspondance confirmée..."
                    value={etransferStatusUpdateReason}
                    onChange={(e) => setEtransferStatusUpdateReason(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Warning for Fraud/Declined/Refunded */}
                {(selectedPaymentForStatus.newStatus === "fraud" || selectedPaymentForStatus.newStatus === "declined" || selectedPaymentForStatus.newStatus === "refunded") && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-red-600">
                      <p className="font-medium">Warning</p>
                      <p>This status will NOT update the client balance. Order will remain pending for Admin review.</p>
                    </div>
                  </div>
                )}

                {/* Processed notification */}
                {selectedPaymentForStatus.newStatus === "processed" && selectedPaymentForStatus.status !== "processed" && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-emerald-600">
                      <p className="font-medium">Balance Update</p>
                      <p>Client balance will be reduced by {Number(selectedPaymentForStatus.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}.</p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1"
                    variant="hero"
                    onClick={() => {
                      if (!selectedPaymentForStatus.newStatus || selectedPaymentForStatus.newStatus === selectedPaymentForStatus.status) {
                        toast({ title: "Select a new status", variant: "destructive" });
                        return;
                      }
                      updateEtransferStatusMutation.mutate({
                        paymentId: selectedPaymentForStatus.id,
                        newStatus: selectedPaymentForStatus.newStatus,
                        reason: etransferStatusUpdateReason,
                        payment: selectedPaymentForStatus,
                      });
                    }}
                    disabled={updateEtransferStatusMutation.isPending || !selectedPaymentForStatus.newStatus || selectedPaymentForStatus.newStatus === selectedPaymentForStatus.status}
                  >
                    {updateEtransferStatusMutation.isPending ? "Updating..." : "Save"}
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedPaymentForStatus(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Record Payment Dialog */}
        <Dialog open={recordPaymentDialogOpen} onOpenChange={setRecordPaymentDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-500" />
                Enregistrer un paiement
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Client *</Label>
                <Select value={newPayment.user_id} onValueChange={(v) => setNewPayment({ ...newPayment, user_id: v })}>
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
              
              {newPayment.user_id && (
                <div>
                  <Label>Lier à une facture (optionnel)</Label>
                  <Select value={newPayment.billing_id} onValueChange={(v) => setNewPayment({ ...newPayment, billing_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Aucune facture liée" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Aucune</SelectItem>
                      {billing?.filter((b: any) => b.user_id === newPayment.user_id && b.status !== "paid").map((b: any) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.invoice_number} - {Number(b.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Montant *</Label>
                <Input 
                  type="number" 
                  value={newPayment.amount} 
                  onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })} 
                  placeholder="0.00" 
                />
              </div>

              <div>
                <Label>Méthode de paiement *</Label>
                <Select value={newPayment.payment_method} onValueChange={(v) => setNewPayment({ ...newPayment, payment_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Comptant</SelectItem>
                    <SelectItem value="cheque">Chèque</SelectItem>
                    <SelectItem value="etransfer">Virement Interac</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                    <SelectItem value="card">Carte de crédit</SelectItem>
                    <SelectItem value="debit">Carte de débit</SelectItem>
                    <SelectItem value="wire">Virement bancaire</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Numéro de référence (optionnel)</Label>
                <Input 
                  value={newPayment.reference_number} 
                  onChange={(e) => setNewPayment({ ...newPayment, reference_number: e.target.value })} 
                  placeholder="Auto-généré si vide" 
                />
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea 
                  value={newPayment.notes} 
                  onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })} 
                  placeholder="Notes sur ce paiement..." 
                  rows={2}
                />
              </div>

              <Button 
                className="w-full" 
                onClick={() => recordPaymentMutation.mutate(newPayment)}
                disabled={!newPayment.user_id || !newPayment.amount || recordPaymentMutation.isPending}
              >
                {recordPaymentMutation.isPending ? "Enregistrement..." : "Enregistrer le paiement"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Accounting Export Dialog */}
        <AccountingExportDialog 
          open={exportDialogOpen} 
          onOpenChange={setExportDialogOpen}
          billingData={billing || []}
        />
      </div>
    </AdminLayout>
  );
};

export default AdminBilling;
