import { useState, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Package,
  Plus,
  Eye,
  Send,
  Search,
  Filter,
  CreditCard,
  Shield,
  Truck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  History,
  DollarSign,
  Monitor,
  Wifi,
  RefreshCw,
  User,
  FileText,
  Wrench,
  Phone,
  ChevronDown,
  ShoppingCart,
  Smartphone,
  MonitorPlay,
} from "lucide-react";
import EquipmentOrderDialog from "@/components/admin/EquipmentOrderDialog";
import EquipmentOrderDetails from "@/components/admin/EquipmentOrderDetails";
import ManualOrderWizard from "@/components/admin/ManualOrderWizard";
import { OrderClientInfoBlock } from "@/components/admin/OrderClientInfoBlock";
import { MobileFulfillmentSection } from "@/components/admin/MobileFulfillmentSection";
import { StreamingActivationSection } from "@/components/admin/StreamingActivationSection";
import { InstallationFulfillmentSection } from "@/components/admin/InstallationFulfillmentSection";
import { detectOrderServices, requiresTechnicianInstallation, getServiceLabels } from "@/lib/orderServiceDetection";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { ensureOrderContractUpToDate } from "@/lib/contractEngine";
import { AuditNotes } from "@/lib/clientAuditNotes";
import { ContractSummaryDialog } from "@/components/contract/ContractSummaryDialog";
import { shouldAutoCompleteOrder, shouldAutoSetInstallationScheduled, isInstallationStatus } from "@/lib/installationStatusUtils";
import { logClientActivityDirect } from "@/hooks/useClientActivityLog";
import { processOrderCompletionContest } from "@/lib/contestUtils";

// Status configurations - includes installation statuses
const orderStatusConfig: Record<string, { color: string; label: string; icon: any }> = {
  pending: { color: "bg-amber-500/20 text-amber-500", label: "En attente", icon: Clock },
  hold: { color: "bg-purple-500/20 text-purple-500", label: "Suspendu", icon: AlertTriangle },
  verification: { color: "bg-blue-500/20 text-blue-500", label: "Vérification", icon: Shield },
  back_order: { color: "bg-orange-500/20 text-orange-500", label: "Back Order", icon: Package },
  backorder: { color: "bg-orange-500/20 text-orange-500", label: "Rupture de stock", icon: Package },
  cancelled: { color: "bg-red-500/20 text-red-500", label: "Annulé", icon: XCircle },
  shipped: { color: "bg-cyan-500/20 text-cyan-400", label: "Expédié", icon: Truck },
  completed: { color: "bg-emerald-500/20 text-emerald-500", label: "Terminé", icon: CheckCircle },
  completed_installation: { color: "bg-green-500/20 text-green-400", label: "Installation terminée", icon: CheckCircle },
  // New installation statuses
  installation_scheduled: { color: "bg-blue-500/20 text-blue-500", label: "Installation planifiée", icon: Clock },
  technician_en_route: { color: "bg-cyan-500/20 text-cyan-500", label: "Technicien en route", icon: Truck },
  installation_in_progress: { color: "bg-amber-500/20 text-amber-500", label: "Installation en cours", icon: Wrench },
  installation_completed: { color: "bg-emerald-500/20 text-emerald-500", label: "Installation terminée", icon: CheckCircle },
};

const paymentStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-amber-500/20 text-amber-500", label: "En attente" },
  pre_authorized: { color: "bg-blue-400/20 text-blue-400", label: "Pré-autorisé" },
  authorized: { color: "bg-blue-500/20 text-blue-500", label: "Autorisé" },
  captured: { color: "bg-emerald-500/20 text-emerald-500", label: "Capturé" },
  confirmed: { color: "bg-emerald-500/20 text-emerald-500", label: "Confirmé" },
  refunded: { color: "bg-red-500/20 text-red-500", label: "Remboursé" },
  disputed: { color: "bg-purple-500/20 text-purple-500", label: "Contesté (litige)" },
  chargeback: { color: "bg-red-600/20 text-red-600", label: "Rétrofacturation" },
  fraud: { color: "bg-red-600/30 text-red-600", label: "Fraude" },
  failed: { color: "bg-red-500/20 text-red-500", label: "Échoué" },
  not_renewed: { color: "bg-muted text-muted-foreground", label: "Non renouvelé" },
};

const idVerificationConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-amber-500/20 text-amber-500", label: "En attente" },
  verified: { color: "bg-emerald-500/20 text-emerald-500", label: "Vérifié" },
  rejected: { color: "bg-red-500/20 text-red-500", label: "Rejeté" },
};

// E-Transfer status configuration - exact match required
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

const orderStatusOptions = [
  { value: "pending", label: "En attente" },
  { value: "hold", label: "Suspendu" },
  { value: "verification", label: "Vérification" },
  { value: "back_order", label: "Back Order" },
  { value: "cancelled", label: "Annulé" },
  { value: "shipped", label: "Expédié" },
  { value: "installation_scheduled", label: "Installation planifiée" },
  { value: "technician_en_route", label: "Technicien en route" },
  { value: "installation_in_progress", label: "Installation en cours" },
  { value: "installation_completed", label: "Installation terminée" },
  { value: "completed", label: "Commande complétée" },
];

const paymentStatusOptions = [
  { value: "pending", label: "En attente" },
  { value: "pre_authorized", label: "Pré-autorisé" },
  { value: "authorized", label: "Autorisé" },
  { value: "captured", label: "Capturé" },
  { value: "refunded", label: "Remboursé" },
  { value: "disputed", label: "Contesté" },
];

const TERMINAL_PRICE = 50;
const ROUTER_PRICE = 60;
const MAX_TERMINALS = 4;

const AdminOrders = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const { isAdmin, permissions, formatCardDisplay } = useRoleAccess();

  // State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [confirmAction, setConfirmAction] = useState<{ type: string; data?: any } | null>(null);
  const [etransferStatusReason, setEtransferStatusReason] = useState("");
  const [selectedEtransferPayment, setSelectedEtransferPayment] = useState<any>(null);
  const [newOrder, setNewOrder] = useState({
    user_id: "",
    service_type: "",
    category: "",
    total_amount: "",
    subtotal: "",
    delivery_fee: "30",
    activation_fee: "25",
    installation_fee: "0",
    discount_amount: "0",
    notes: "",
    delivery_method: "Standard Québec Delivery",
    installation_type: "auto",
  });

  // Equipment state for order editing
  const [equipmentForm, setEquipmentForm] = useState({
    terminal_count: 0,
    router_included: false,
    router_serial_number: "", // WiFi router serial number
    serial_numbers: ["", "", "", ""],
    imei_numbers: ["", "", "", ""],
    inventory_refs: ["", "", "", ""],
    sim_type: "" as "" | "esim" | "physical_sim",
    sim_serial_number: "",
  });

  // Identity edit state
  const [identityForm, setIdentityForm] = useState({
    id_type: "",
    id_number: "",
    id_province: "",
    id_expiration: "",
    id_issue_date: "",
    id_upload: "",
  });

  // Queries
  const { data: orders, isLoading, refetch } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data: ordersData, error: ordersErr } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (ordersErr) throw ordersErr;

      if (ordersData && ordersData.length > 0) {
        const userIds = [...new Set(ordersData.map((o: any) => o.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, email, full_name, phone, service_address, service_city, service_province, service_postal_code, id_type, id_number, id_expiration, id_province, date_of_birth, first_name, last_name, account_number")
          .in("user_id", userIds);

        return ordersData.map((order: any) => ({
          ...order,
          profiles: profilesData?.find((p: any) => p.user_id === order.user_id) || null,
        }));
      }

      return ordersData || [];
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

  const { data: linkedBilling } = useQuery({
    queryKey: ["order-billing", selectedOrder?.id],
    enabled: !!selectedOrder?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing")
        .select("*")
        .eq("order_id", selectedOrder.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch linked e-transfer payments for selected order
  const { data: linkedEtransferPayments, refetch: refetchEtransferPayments } = useQuery({
    queryKey: ["order-etransfer-payments", selectedOrder?.user_id],
    enabled: !!selectedOrder?.user_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, profiles:user_id(full_name, email)")
        .eq("user_id", selectedOrder.user_id)
        .eq("payment_method", "e-transfer")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch activity logs for selected order
  const { data: orderActivityLogs } = useQuery({
    queryKey: ["order-activity-logs", selectedOrder?.id],
    enabled: !!selectedOrder?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .or(`entity_id.eq.${selectedOrder.id},details->order_id.eq.${selectedOrder.id}`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: technicians } = useQuery({
    queryKey: ["admin-technicians"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technicians")
        .select("*")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Filtered orders
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    return orders.filter((order: any) => {
      const matchesSearch =
        searchTerm === "" ||
        order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.service_type?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      const matchesPayment = paymentFilter === "all" || order.payment_status === paymentFilter;

      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [orders, searchTerm, statusFilter, paymentFilter]);

  // Mutations
  const createOrderMutation = useMutation({
    mutationFn: async (order: typeof newOrder) => {
      const subtotal = parseFloat(order.subtotal) || 0;
      const deliveryFee = parseFloat(order.delivery_fee) || 0;
      const activationFee = parseFloat(order.activation_fee) || 0;
      const installationFee = parseFloat(order.installation_fee) || 0;
      const discountAmount = parseFloat(order.discount_amount) || 0;
      const baseAmount = subtotal + deliveryFee + activationFee + installationFee - discountAmount;
      const tpsAmount = baseAmount * 0.05;
      const tvqAmount = baseAmount * 0.09975;
      const totalAmount = baseAmount + tpsAmount + tvqAmount;

      // Get client email
      const selectedClient = clients?.find((c: any) => c.user_id === order.user_id);

      const { data, error } = await supabase
        .from("orders")
        .insert({
          user_id: order.user_id,
          client_email: selectedClient?.email,
          service_type: order.service_type,
          category: order.category || order.service_type,
          subtotal,
          delivery_fee: deliveryFee,
          activation_fee: activationFee,
          installation_fee: installationFee,
          discount_amount: discountAmount,
          tps_amount: tpsAmount,
          tvq_amount: tvqAmount,
          total_amount: totalAmount,
          notes: order.notes,
          delivery_method: order.delivery_method,
          installation_type: order.installation_type,
          status: "pending",
          payment_status: "pending",
          created_by: "admin",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      logActivity("create", "order", data.id, { 
        service_type: data.service_type,
        order_number: data.order_number 
      }, {
        changedField: "order",
        reason: "Nouvelle commande créée par admin"
      });
      toast({ title: "Commande créée", description: `#${data.order_number || data.id.slice(0, 8)}` });
      setCreateDialogOpen(false);
      setNewOrder({ user_id: "", service_type: "", category: "", total_amount: "", subtotal: "", delivery_fee: "30", activation_fee: "25", installation_fee: "0", discount_amount: "0", notes: "", delivery_method: "Standard Québec Delivery", installation_type: "auto" });
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error?.message, variant: "destructive" });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async (order: any) => {
      // Add audit entry
      const currentUser = (await supabase.auth.getUser()).data.user;
      const auditEntry = {
        action: "order_updated",
        timestamp: new Date().toISOString(),
        user_id: currentUser?.id,
        details: { status: order.status, payment_status: order.payment_status },
      };
      const currentAudit = Array.isArray(order.audit_timeline) ? order.audit_timeline : [];

      const { error } = await supabase
        .from("orders")
        .update({
          status: order.status,
          payment_status: order.payment_status,
          tracking_number: order.tracking_number,
          tracking_url: order.tracking_url,
          sim_number: order.sim_number,
          imei_number: order.imei_number,
          serial_number: order.serial_number,
          equipment_id: order.equipment_id,
          notes: order.notes,
          internal_notes: order.internal_notes,
          id_verification_status: order.id_verification_status,
          id_verification_notes: order.id_verification_notes,
          risk_flags: order.risk_flags,
          equipment_details: order.equipment_details,
          terminal_count: order.terminal_count,
          terminal_fee: order.terminal_fee,
          router_fee: order.router_fee,
          installation_type: order.installation_type,
          audit_timeline: [...currentAudit, auditEntry],
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (error) throw error;
    },
    onSuccess: async (_data, order) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      logActivity("update", "order", selectedOrder?.id, {
        status: selectedOrder?.status,
        order_number: selectedOrder?.order_number,
      }, {
        changedField: "status",
        newValue: selectedOrder?.status,
        reason: "Mise à jour de commande",
      });

      // Force contract regeneration audit when reaching Processed/Completed flow
      const shouldGenerate =
        ["shipped", "completed", "completed_installation"].includes(order?.status) ||
        order?.payment_status === "captured";

      if (shouldGenerate) {
        try {
          await ensureOrderContractUpToDate({
            orderId: order.id,
            trigger: `admin_order_update:${order.status}`,
          });
        } catch (e) {
          console.error("Failed to generate contract audit for order", order?.id, e);
        }
      }

      toast({ title: "Commande mise à jour" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  const updatePaymentStatusMutation = useMutation({
    mutationFn: async ({ orderId, newStatus }: { orderId: string; newStatus: string }) => {
      const currentUser = (await supabase.auth.getUser()).data.user;
      const order = orders?.find((o: any) => o.id === orderId);
      const auditEntry = {
        action: `payment_${newStatus}`,
        timestamp: new Date().toISOString(),
        user_id: currentUser?.id,
        user_email: currentUser?.email,
        details: { from: order?.payment_status, to: newStatus },
      };
      const currentAudit = Array.isArray(order?.audit_timeline) ? order.audit_timeline : [];

      // Generate NIVRA payment reference when capturing
      let paymentReference = order?.payment_reference;
      if (newStatus === "captured" && !paymentReference) {
        const year = new Date().getFullYear();
        const random = Math.floor(10000 + Math.random() * 90000);
        paymentReference = `NIVRA-PAY-QC-${year}-${random}`;
      }

      const { error: orderError } = await supabase
        .from("orders")
        .update({
          payment_status: newStatus,
          payment_reference: paymentReference,
          processed_by: newStatus === "captured" ? currentUser?.id : null,
          processed_at: newStatus === "captured" ? new Date().toISOString() : null,
          audit_timeline: [...currentAudit, auditEntry],
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (orderError) throw orderError;

      // Update linked billing with payment reference - or create invoice if none exists
      if (newStatus === "captured") {
        const { data: existingBilling } = await supabase
          .from("billing")
          .select("id")
          .eq("order_id", order.id)
          .maybeSingle();

        if (existingBilling) {
          await supabase
            .from("billing")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
              payment_reference: paymentReference,
            })
            .eq("id", existingBilling.id);
        } else {
          // Create new invoice/billing record if none exists
          await supabase.from("billing").insert({
            user_id: order.user_id,
            order_id: order.id,
            client_email: order.client_email || order.profiles?.email,
            amount: order.total_amount || 0,
            subtotal: order.subtotal || 0,
            delivery_fee: order.delivery_fee || 0,
            activation_fee: order.activation_fee || 0,
            installation_fee: order.installation_fee || 0,
            tps_amount: order.tps_amount || 0,
            tvq_amount: order.tvq_amount || 0,
            status: "paid",
            paid_at: new Date().toISOString(),
            payment_reference: paymentReference,
            related_order_number: order.order_number,
            notes: `Facture pour commande ${order.order_number}`,
            preauth_discount: order.preauth_discount || 0,
            preauth_discount_applied: (order.preauth_discount || 0) > 0,
          });
        }
      } else if (order?.id) {
        await supabase
          .from("billing")
          .update({
            status: newStatus === "refunded" ? "refunded" : "pending",
            paid_at: null,
            payment_reference: paymentReference,
          })
          .eq("order_id", order.id);
      }

      // Update client balance when payment is captured
      if (newStatus === "captured" && order?.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("balance")
          .eq("user_id", order.user_id)
          .maybeSingle();
        
        const currentBalance = profile?.balance || 0;
        const amountPaid = order.total_amount || 0;
        
        // Set amount_paid on order
        await supabase
          .from("orders")
          .update({ amount_paid: amountPaid })
          .eq("id", orderId);
        
        // Update profile balance (subtract what was owed)
        const newBalance = currentBalance - amountPaid;
        await supabase
          .from("profiles")
          .update({ balance: newBalance })
          .eq("user_id", order.user_id);

        // Record payment in payments table
        await supabase.from("payments").insert({
          user_id: order.user_id,
          amount: amountPaid,
          payment_method: "card",
          reference_number: paymentReference,
          payment_reference: paymentReference,
          status: "completed",
          notes: `Paiement capturé pour commande ${order.order_number}`,
        });
      }

      // Handle refund - reverse balance
      if (newStatus === "refunded" && order?.user_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("balance")
          .eq("user_id", order.user_id)
          .maybeSingle();
        
        const currentBalance = profile?.balance || 0;
        const refundAmount = order.amount_paid || order.total_amount || 0;
        
        // Credit back to profile
        await supabase
          .from("profiles")
          .update({ 
            balance: currentBalance + refundAmount,
            store_credit: (profile as any)?.store_credit || 0 + refundAmount 
          })
          .eq("user_id", order.user_id);

        // Record refund payment
        await supabase.from("payments").insert({
          user_id: order.user_id,
          amount: -refundAmount,
          payment_method: "refund",
          reference_number: `REF-${paymentReference}`,
          payment_reference: `REF-${paymentReference}`,
          status: "completed",
          notes: `Remboursement pour commande ${order.order_number}`,
        });
      }

      return { paymentReference };
    },
    onSuccess: async (data, { orderId, newStatus }) => {
      // Immediately update selectedOrder for instant UI feedback
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev: any) => prev ? {
          ...prev,
          payment_status: newStatus,
          payment_reference: data?.paymentReference || prev.payment_reference,
          processed_at: newStatus === "captured" ? new Date().toISOString() : prev.processed_at,
          amount_paid: newStatus === "captured" ? prev.total_amount : prev.amount_paid,
        } : prev);
      }

      // Invalidate queries to sync with server
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-billing"] });
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });

      // Contract regeneration audit when payment becomes captured
      if (newStatus === "captured") {
        try {
          await ensureOrderContractUpToDate({
            orderId,
            trigger: "admin_payment_captured",
          });
        } catch (e) {
          console.error("Failed to generate contract audit on payment capture", orderId, e);
        }
      }
      
      // Create automatic audit note for payment status change
      const order = orders?.find((o: any) => o.id === orderId);
      if (order?.user_id && newStatus === "captured") {
        const currentUser = (await supabase.auth.getUser()).data.user;
        AuditNotes.paymentRecorded(
          order.user_id,
          order.total_amount || 0,
          "card",
          data?.paymentReference || "",
          currentUser?.id || "",
          "admin"
        );
      }

      logActivity("update", "order", orderId, {
        payment_status: newStatus,
        payment_reference: data?.paymentReference,
        order_number: order?.order_number,
      }, {
        changedField: "payment_status",
        oldValue: order?.payment_status,
        newValue: newStatus,
        reason: `Statut paiement changé à ${paymentStatusConfig[newStatus]?.label || newStatus}`,
      });
      toast({
        title: `Paiement ${paymentStatusConfig[newStatus]?.label || newStatus}`,
        description: data?.paymentReference ? `Réf: ${data.paymentReference}` : undefined,
      });
      setConfirmAction(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur de mise à jour du paiement", 
        description: error?.message || "Impossible de traiter le paiement",
        variant: "destructive" 
      });
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
      const oldStatus = payment.status;
      
      // Get user role for logging
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUser?.id)
        .maybeSingle();
      
      const actorRole = userRole?.role || "admin";
      
      // Only admin and employee can update (check role)
      if (actorRole !== "admin" && actorRole !== "employee") {
        throw new Error("Unauthorized: Only Admin and Employee can update payment status");
      }
      
      // Update payment status in database
      const { error: paymentError } = await supabase
        .from("payments")
        .update({
          status: newStatus,
          notes: `${payment.notes || ""}\n[PaymentStatus: ${oldStatus} → ${newStatus}] ${reason ? `Reason: ${reason}` : ""} (${format(new Date(), "d MMM yyyy HH:mm", { locale: fr })})`.trim(),
        })
        .eq("id", paymentId);

      if (paymentError) throw paymentError;

      // Handle balance update only if status is "processed"
      if (newStatus === "processed" && oldStatus !== "processed") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("balance")
          .eq("user_id", payment.user_id)
          .maybeSingle();

        const currentBalance = Number(profile?.balance || 0);
        const paymentAmount = Number(payment.amount || 0);
        
        // Reduce balance when payment is processed
        const newBalance = Math.max(0, currentBalance - paymentAmount);
        
        await supabase
          .from("profiles")
          .update({ balance: newBalance })
          .eq("user_id", payment.user_id);

        // Update linked billing if exists
        if (payment.billing_id) {
          await supabase
            .from("billing")
            .update({
              status: "paid",
              paid_at: new Date().toISOString(),
            })
            .eq("id", payment.billing_id);
        }
      }

      // If status changed FROM processed to something else, reverse the balance
      if (oldStatus === "processed" && newStatus !== "processed") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("balance")
          .eq("user_id", payment.user_id)
          .maybeSingle();

        const currentBalance = Number(profile?.balance || 0);
        const paymentAmount = Number(payment.amount || 0);
        
        await supabase
          .from("profiles")
          .update({ balance: currentBalance + paymentAmount })
          .eq("user_id", payment.user_id);

        if (payment.billing_id) {
          await supabase
            .from("billing")
            .update({
              status: "pending",
              paid_at: null,
            })
            .eq("id", payment.billing_id);
        }
      }

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

      return { oldStatus, newStatus, payment };
    },
    onSuccess: (data) => {
      // Immediate cache update
      refetchEtransferPayments();
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
      
      toast({ 
        title: "E-Transfer Status Updated", 
        description: `${etransferStatusConfig[data.oldStatus]?.label || data.oldStatus} → ${etransferStatusConfig[data.newStatus]?.label || data.newStatus}` 
      });
      setSelectedEtransferPayment(null);
      setEtransferStatusReason("");
    },
    onError: (error: any) => {
      console.error("E-Transfer status update error:", error);
      toast({ title: "Error updating status", description: error.message || "Please try again", variant: "destructive" });
    },
  });

  const verifyIdMutation = useMutation({
    mutationFn: async ({ orderId, status, notes }: { orderId: string; status: string; notes?: string }) => {
      const currentUser = (await supabase.auth.getUser()).data.user;
      if (!currentUser?.id) throw new Error("Utilisateur non authentifié");
      
      const { error } = await supabase
        .from("orders")
        .update({
          id_verification_status: status,
          id_verification_notes: notes || null,
          id_verified_by: currentUser.id,
          id_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      if (error) throw error;
      
      return { status, notes };
    },
    onSuccess: (data, { orderId, status }) => {
      // Update local selectedOrder state immediately for instant UI feedback
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev: any) => prev ? {
          ...prev,
          id_verification_status: status,
          id_verification_notes: data?.notes || prev.id_verification_notes,
          id_verified_at: new Date().toISOString(),
        } : prev);
      }
      
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      logActivity("id_verification", "order", orderId, { 
        verification_status: status 
      }, {
        changedField: "id_verification_status",
        newValue: status,
        reason: status === "verified" ? "ID vérifié avec succès" : "ID rejeté"
      });
      toast({ 
        title: status === "verified" ? "ID approuvé ✓" : "ID rejeté",
        description: status === "verified" ? "Le statut a été mis à jour avec succès" : "L'identité a été rejetée"
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erreur de vérification", 
        description: error?.message || "Impossible de mettre à jour le statut",
        variant: "destructive" 
      });
    },
  });

  const addEquipmentFeesMutation = useMutation({
    mutationFn: async ({ orderId, terminalCount, includeRouter }: { orderId: string; terminalCount: number; includeRouter: boolean }) => {
      const terminalFee = terminalCount * TERMINAL_PRICE;
      const routerFee = includeRouter ? ROUTER_PRICE : 0;
      const order = orders?.find((o: any) => o.id === orderId);
      
      const newTotal = (order?.subtotal || 0) + 
        (order?.delivery_fee || 0) + 
        (order?.activation_fee || 0) + 
        (order?.installation_fee || 0) +
        terminalFee + 
        routerFee +
        (order?.tps_amount || 0) + 
        (order?.tvq_amount || 0);

      const { error } = await supabase
        .from("orders")
        .update({
          terminal_count: terminalCount,
          terminal_fee: terminalFee,
          router_fee: routerFee,
          total_amount: newTotal,
        })
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({ title: "Équipements ajoutés" });
    },
  });

  const assignTechnicianMutation = useMutation({
    mutationFn: async ({ orderId, technicianId }: { orderId: string; technicianId: string }) => {
      const currentUser = (await supabase.auth.getUser()).data.user;
      const order = orders?.find((o: any) => o.id === orderId);
      const technician = technicians?.find((t: any) => t.id === technicianId);
      
      const auditEntry = {
        action: "technician_assigned",
        timestamp: new Date().toISOString(),
        user_id: currentUser?.id,
        details: { technician_id: technicianId, technician_name: technician?.full_name },
      };
      const currentAudit = Array.isArray(order?.audit_timeline) ? order.audit_timeline : [];
      
      // Check if status should auto-transition to installation_scheduled
      const currentStatus = order?.status || "pending";
      const shouldAutoSchedule = shouldAutoSetInstallationScheduled(currentStatus);
      const newStatus = shouldAutoSchedule ? "installation_scheduled" : currentStatus;

      const { error: orderError } = await supabase
        .from("orders")
        .update({
          technician_id: technicianId,
          status: newStatus, // Auto-set to installation_scheduled if applicable
          audit_timeline: [...currentAudit, auditEntry],
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (orderError) throw orderError;
      
      // Log client activity for technician assignment
      if (order?.user_id) {
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("user_id", currentUser?.id)
            .maybeSingle();
            
          await logClientActivityDirect({
            clientId: order.user_id,
            actorUserId: currentUser?.id || "",
            actorName: profile?.full_name || currentUser?.email || "Admin",
            actorRole: "admin",
            actionType: "technician_assigned",
            entityType: "order",
            entityId: orderId,
            summary: `Technicien ${technician?.full_name} assigné à la commande #${order.order_number}`,
            afterData: { technician_id: technicianId, technician_name: technician?.full_name },
          });
          
          // Also log status change if auto-transitioned
          if (shouldAutoSchedule) {
            await logClientActivityDirect({
              clientId: order.user_id,
              actorUserId: "system",
              actorName: "Système",
              actorRole: "system",
              actionType: "order_status_change",
              entityType: "order",
              entityId: orderId,
              summary: `Statut de commande #${order.order_number} automatiquement changé vers Installation planifiée`,
              beforeData: { status: currentStatus },
              afterData: { status: "installation_scheduled" },
            });
          }
        } catch (err) {
          console.error("Failed to log technician assignment:", err);
        }
      }
      
      // Send installation scheduled email if status changed
      if (shouldAutoSchedule && order?.user_id) {
        try {
          await supabase.functions.invoke("send-installation-status-email", {
            body: {
              order_id: orderId,
              client_email: order.client_email || order.profiles?.email,
              client_first_name: order.profiles?.first_name || order.profiles?.full_name?.split(" ")[0],
              order_number: order.order_number,
              new_status: "installation_scheduled",
              old_status: currentStatus,
              service_address: order.profiles?.service_address,
              scheduled_date_time: order.appointment_date 
                ? format(new Date(order.appointment_date), "d MMMM yyyy à HH:mm", { locale: fr })
                : undefined,
              technician_name: technician?.full_name,
            },
          });
        } catch (emailErr) {
          console.error("Failed to send installation scheduled email:", emailErr);
        }
      }

      // Create appointment for client if order has scheduled date
      let appointmentId: string | undefined;
      if (order?.appointment_date) {
        const { data: aptData } = await supabase.from("appointments").insert({
          client_id: order.user_id,
          client_email: order.client_email || order.profiles?.email,
          client_phone: order.profiles?.phone,
          service_address: order.profiles?.service_address,
          service_city: order.profiles?.service_city,
          service_postal_code: order.profiles?.service_postal_code,
          title: `Installation - ${order.service_type}`,
          description: `Installation par technicien Nivra pour commande ${order.order_number}`,
          scheduled_at: order.appointment_date,
          status: "technician_assigned",
          technician_id: technicianId,
          order_id: orderId,
        }).select("id").single();
        appointmentId = aptData?.id;
      }

      // Create work order for technician portal (single source of truth)
      const { createWorkOrder } = await import("@/hooks/useWorkOrderCreation");
      const workOrderResult = await createWorkOrder({
        type: "installation",
        linkedOrderId: orderId,
        linkedAppointmentId: appointmentId,
        clientId: order?.user_id,
        clientName: order?.profiles?.full_name,
        clientEmail: order?.client_email || order?.profiles?.email,
        clientPhone: order?.profiles?.phone,
        serviceAddress: order?.profiles?.service_address,
        serviceCity: order?.profiles?.service_city,
        servicePostalCode: order?.profiles?.service_postal_code,
        scheduledStart: order?.appointment_date,
        assignedTechnicianId: technicianId,
        assignedBy: currentUser?.id,
        serviceType: order?.service_type,
        notes: order?.notes,
        equipmentDetails: Array.isArray(order?.equipment_details) ? order.equipment_details : [],
      });

      if (!workOrderResult.success) {
        console.error("Failed to create work order:", workOrderResult.error);
      }

      return { 
        technicianName: technician?.full_name, 
        workOrderNumber: workOrderResult.workOrderNumber,
        statusChanged: shouldAutoSchedule,
        newStatus,
      };
    },
    onSuccess: async (data, { orderId, technicianId }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["technician-work-orders"] });
      const order = orders?.find((o: any) => o.id === orderId);
      
      // Create automatic audit note for technician assignment
      if (order?.user_id) {
        const currentUser = (await supabase.auth.getUser()).data.user;
        AuditNotes.technicianAssigned(
          order.user_id,
          orderId,
          data?.technicianName || "Technicien",
          currentUser?.id || "",
          "admin"
        );
      }
      
      // Update local selectedOrder state if this order is selected
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev: any) => prev ? { 
          ...prev, 
          technician_id: technicianId,
          status: data?.newStatus || prev.status,
        } : prev);
      }
      
      logActivity("technician_assigned", "order", orderId, { 
        technician_id: technicianId,
        technician_name: data?.technicianName,
        order_number: order?.order_number,
        work_order_number: data?.workOrderNumber,
        status_auto_changed: data?.statusChanged,
      }, {
        changedField: "technician",
        newValue: data?.technicianName,
        reason: "Technicien assigné à la commande"
      });
      
      const description = data?.statusChanged 
        ? `${data.technicianName} - Statut → Installation planifiée`
        : data?.workOrderNumber 
          ? `${data.technicianName} - ${data.workOrderNumber}` 
          : data?.technicianName;
          
      toast({ 
        title: "Technicien assigné", 
        description,
      });
    },
    onError: () => {
      toast({ title: "Erreur lors de l'assignation", variant: "destructive" });
    },
  });

  const sendUpdateMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const order = orders?.find((o: any) => o.id === orderId);
      if (!order) throw new Error("Order not found");

      const { error } = await supabase.from("messages").insert({
        sender_id: (await supabase.auth.getUser()).data.user?.id,
        recipient_id: order.user_id,
        subject: `Mise à jour de votre commande #${order.order_number || orderId.slice(0, 8)}`,
        content: `Votre commande a été mise à jour.\n\nStatut: ${orderStatusConfig[order.status]?.label || order.status}${order.tracking_number ? `\nNuméro de suivi: ${order.tracking_number}` : ""}`,
        related_order_id: orderId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Notification envoyée" });
    },
    onError: () => {
      toast({ title: "Erreur d'envoi", variant: "destructive" });
    },
  });

  // Handle order status change with auto-transition and email notification
  const handleOrderStatusChange = async (newStatus: string) => {
    if (!selectedOrder) return;
    
    const oldStatus = selectedOrder.status;
    const currentUser = (await supabase.auth.getUser()).data.user;
    
    // First update to the new status
    let finalStatus = newStatus;
    
    // Check if installation_completed should auto-transition to completed
    if (shouldAutoCompleteOrder(newStatus)) {
      finalStatus = "completed";
    }
    
    // Update local state immediately for UI feedback
    setSelectedOrder({ ...selectedOrder, status: newStatus });
    
    // Log client activity for status change + create audit note
    if (selectedOrder.user_id) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("user_id", currentUser?.id)
          .maybeSingle();
        
        // Create automatic audit note for status change
        AuditNotes.statusChanged(
          selectedOrder.user_id,
          selectedOrder.id,
          orderStatusConfig[oldStatus]?.label || oldStatus,
          orderStatusConfig[newStatus]?.label || newStatus,
          currentUser?.id || "",
          "admin"
        );
          
        await logClientActivityDirect({
          clientId: selectedOrder.user_id,
          actorUserId: currentUser?.id || "",
          actorName: profile?.full_name || currentUser?.email || "Admin",
          actorRole: "admin",
          actionType: "order_status_change",
          entityType: "order",
          entityId: selectedOrder.id,
          summary: `Statut de commande #${selectedOrder.order_number} changé: ${orderStatusConfig[oldStatus]?.label || oldStatus} → ${orderStatusConfig[newStatus]?.label || newStatus}`,
          beforeData: { status: oldStatus },
          afterData: { status: newStatus },
        });
      } catch (err) {
        console.error("Failed to log status change:", err);
      }
    }
    
    // Send installation status email for relevant statuses
    if (isInstallationStatus(newStatus) || newStatus === "completed") {
      try {
        const technician = technicians?.find((t: any) => t.id === selectedOrder.technician_id);
        
        await supabase.functions.invoke("send-installation-status-email", {
          body: {
            order_id: selectedOrder.id,
            client_email: selectedOrder.client_email || selectedOrder.profiles?.email,
            client_first_name: selectedOrder.profiles?.first_name || selectedOrder.profiles?.full_name?.split(" ")[0],
            order_number: selectedOrder.order_number,
            new_status: newStatus,
            old_status: oldStatus,
            service_address: selectedOrder.profiles?.service_address,
            scheduled_date_time: selectedOrder.appointment_date 
              ? format(new Date(selectedOrder.appointment_date), "d MMMM yyyy à HH:mm", { locale: fr })
              : undefined,
            technician_name: technician?.full_name,
          },
        });
      } catch (emailErr) {
        console.error("Failed to send status email:", emailErr);
        // Don't block status change if email fails
      }
      
      // Process contest entry for direct completion (not auto-transition)
      if (newStatus === "completed" && !shouldAutoCompleteOrder(oldStatus)) {
        try {
          const contestResult = await processOrderCompletionContest({
            id: selectedOrder.id,
            user_id: selectedOrder.user_id,
            order_number: selectedOrder.order_number,
          });
          if (contestResult.success && contestResult.entryId) {
            console.log("Contest entry created:", contestResult.message);
          }
        } catch (contestErr) {
          console.error("Failed to process contest entry:", contestErr);
        }
      }
    }
    
    // If installation_completed, auto-transition to completed
    if (shouldAutoCompleteOrder(newStatus)) {
      setTimeout(async () => {
        setSelectedOrder((prev: any) => prev ? { ...prev, status: "completed" } : prev);
        
        // Log the auto-transition
        if (selectedOrder.user_id) {
          try {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name, email")
              .eq("user_id", currentUser?.id)
              .maybeSingle();
              
            await logClientActivityDirect({
              clientId: selectedOrder.user_id,
              actorUserId: "system",
              actorName: "Système",
              actorRole: "system",
              actionType: "order_status_change",
              entityType: "order",
              entityId: selectedOrder.id,
              summary: `Statut de commande #${selectedOrder.order_number} automatiquement changé: Installation terminée → Commande complétée`,
              beforeData: { status: "installation_completed" },
              afterData: { status: "completed" },
            });
          } catch (err) {
            console.error("Failed to log auto-transition:", err);
          }
        }
        
        // Send completed email
        try {
          await supabase.functions.invoke("send-installation-status-email", {
            body: {
              order_id: selectedOrder.id,
              client_email: selectedOrder.client_email || selectedOrder.profiles?.email,
              client_first_name: selectedOrder.profiles?.first_name || selectedOrder.profiles?.full_name?.split(" ")[0],
              order_number: selectedOrder.order_number,
              new_status: "completed",
              old_status: "installation_completed",
            },
          });
        } catch (emailErr) {
          console.error("Failed to send completion email:", emailErr);
        }
        
        // Process contest entry for new customers
        try {
          const contestResult = await processOrderCompletionContest({
            id: selectedOrder.id,
            user_id: selectedOrder.user_id,
            order_number: selectedOrder.order_number,
          });
          if (contestResult.success && contestResult.entryId) {
            console.log("Contest entry created:", contestResult.message);
          }
        } catch (contestErr) {
          console.error("Failed to process contest entry:", contestErr);
        }
        
        toast({ title: "Commande complétée", description: "La commande a été automatiquement marquée comme complétée." });
      }, 500);
    }
  };

  const handleViewDetails = (order: any) => {
    setSelectedOrder({ ...order });
    setEquipmentForm({
      terminal_count: order.terminal_count || 0,
      router_included: (order.router_fee || 0) > 0,
      router_serial_number: order.equipment_details?.router_serial_number || "",
      serial_numbers: order.equipment_details?.serial_numbers || ["", "", "", ""],
      imei_numbers: order.equipment_details?.imei_numbers || ["", "", "", ""],
      inventory_refs: order.equipment_details?.inventory_refs || ["", "", "", ""],
      sim_type: order.equipment_details?.sim_type || "",
      sim_serial_number: order.sim_number || "",
    });
    // Populate identity form - prefer identity_snapshot from order, fallback to profile
    const idSnapshot = order.identity_snapshot as any;
    setIdentityForm({
      id_type: idSnapshot?.id_type || order.profiles?.id_type || "",
      id_number: idSnapshot?.id_number || order.profiles?.id_number || "",
      id_province: idSnapshot?.id_province || order.profiles?.id_province || "",
      id_expiration: idSnapshot?.id_expiration || order.profiles?.id_expiration || "",
      id_issue_date: order.profiles?.id_issue_date || "",
      id_upload: order.profiles?.id_upload || "",
    });
    setDetailsDialogOpen(true);
  };

  const handleSaveEquipment = async () => {
    if (!selectedOrder) return;
    
    // Validate router serial if router is included
    if (equipmentForm.router_included && !equipmentForm.router_serial_number.trim()) {
      toast({ 
        title: "Numéro de série requis", 
        description: "Veuillez entrer le numéro de série de la borne WiFi",
        variant: "destructive" 
      });
      return;
    }
    
    const equipmentDetails = {
      serial_numbers: equipmentForm.serial_numbers.filter(s => s),
      imei_numbers: equipmentForm.imei_numbers.filter(s => s),
      inventory_refs: equipmentForm.inventory_refs.filter(s => s),
      router_serial_number: equipmentForm.router_serial_number.trim() || null,
      sim_type: equipmentForm.sim_type,
      warranty: "1 year manufacturer coverage",
    };
    
    addEquipmentFeesMutation.mutate({
      orderId: selectedOrder.id,
      terminalCount: equipmentForm.terminal_count,
      includeRouter: equipmentForm.router_included,
    });

    updateOrderMutation.mutate({
      ...selectedOrder,
      equipment_details: equipmentDetails,
      sim_number: equipmentForm.sim_serial_number,
      terminal_count: equipmentForm.terminal_count,
      terminal_fee: equipmentForm.terminal_count * TERMINAL_PRICE,
      router_fee: equipmentForm.router_included ? ROUTER_PRICE : 0,
    });
    
    // Log equipment assignment to client activity + create audit note
    if (selectedOrder.user_id) {
      try {
        const currentUser = (await supabase.auth.getUser()).data.user;
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("user_id", currentUser?.id)
          .maybeSingle();
        
        // Build equipment summary
        const equipmentParts: string[] = [];
        const terminalSerial = equipmentForm.serial_numbers.filter(s => s).join(", ");
        const routerSerial = equipmentForm.router_serial_number.trim();
        
        if (equipmentForm.terminal_count > 0) {
          equipmentParts.push(`${equipmentForm.terminal_count} Terminal(s)${terminalSerial ? ` (S/N: ${terminalSerial})` : ""}`);
        }
        if (equipmentForm.router_included) {
          equipmentParts.push(`Borne WiFi (S/N: ${routerSerial})`);
        }
        if (equipmentForm.sim_type) {
          equipmentParts.push(`${equipmentForm.sim_type === "esim" ? "eSIM" : "Carte SIM"}${equipmentForm.sim_serial_number ? ` (S/N: ${equipmentForm.sim_serial_number})` : ""}`);
        }
        
        if (equipmentParts.length > 0) {
          // Create automatic audit note
          AuditNotes.equipmentAssigned(
            selectedOrder.user_id,
            selectedOrder.id,
            { terminalSerial: terminalSerial || undefined, routerSerial: routerSerial || undefined },
            currentUser?.id || "",
            "admin"
          );
          
          await logClientActivityDirect({
            clientId: selectedOrder.user_id,
            actorUserId: currentUser?.id || "",
            actorName: profile?.full_name || profile?.email || "Admin",
            actorRole: "admin",
            actionType: "equipment_assigned",
            entityType: "equipment",
            entityId: selectedOrder.id,
            summary: `Équipement attribué à la commande #${selectedOrder.order_number}: ${equipmentParts.join(", ")}`,
            afterData: { equipment: equipmentParts },
          });
        }
      } catch (err) {
        console.error("Failed to log equipment assignment:", err);
      }
    }
  };

  // Save identity information
  const handleSaveIdentity = async () => {
    if (!selectedOrder?.profiles?.user_id) {
      toast({ title: "Erreur", description: "Profil client non trouvé", variant: "destructive" });
      return;
    }
    
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          id_type: identityForm.id_type || null,
          id_number: identityForm.id_number || null,
          id_province: identityForm.id_province || null,
          id_expiration: identityForm.id_expiration || null,
        })
        .eq("user_id", selectedOrder.profiles.user_id);

      if (error) throw error;

      await logActivity("update", "profile", selectedOrder.profiles.user_id, {
        order_id: selectedOrder.id,
        order_number: selectedOrder.order_number
      }, {
        changedField: "identity_info",
        reason: "Modification des informations d'identité par admin"
      });

      // Update local state
      setSelectedOrder({
        ...selectedOrder,
        profiles: {
          ...selectedOrder.profiles,
          id_type: identityForm.id_type,
          id_number: identityForm.id_number,
          id_province: identityForm.id_province,
          id_expiration: identityForm.id_expiration,
        }
      });

      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({ title: "Identité mise à jour", description: "Les informations d'identité ont été sauvegardées" });
    } catch (error: any) {
      toast({ title: "Erreur", description: error?.message || "Erreur lors de la sauvegarde", variant: "destructive" });
    }
  };

  const isQuebecAddress = (province?: string) => {
    return province?.toLowerCase() === "qc" || province?.toLowerCase() === "quebec" || province?.toLowerCase() === "québec";
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Commandes</h1>
            <p className="text-muted-foreground mt-1">Gestion professionnelle des commandes</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualiser
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="hero">
                  <Plus className="w-4 h-4 mr-2" />
                  Nouvelle commande
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setCreateDialogOpen(true)}>
                  <Wifi className="w-4 h-4 mr-2" />
                  Commande service
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEquipmentDialogOpen(true)}>
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Commande équipement
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ManualOrderWizard
              open={createDialogOpen}
              onOpenChange={setCreateDialogOpen}
              onSuccess={() => refetch()}
            />
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par #, client, service..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Statut commande" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {orderStatusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-[180px]">
                  <CreditCard className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Statut paiement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les paiements</SelectItem>
                  {paymentStatusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Orders Table */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-cyan-400" />
              Liste des commandes ({filteredOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredOrders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Commande</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Compte</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Client</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Service</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Facture</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Payé</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Paiement</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order: any) => (
                      <tr key={order.id} className="border-b border-border/50 hover:bg-accent/50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-mono text-foreground">{order.order_number || `#${order.id.slice(0, 8)}`}</p>
                            {order.order_type === "equipment" && (
                              <Badge variant="secondary" className="text-xs">
                                <ShoppingCart className="w-3 h-3 mr-1" />
                                Équip.
                              </Badge>
                            )}
                          </div>
                        {order.risk_flags && order.risk_flags.length > 0 && (
                            <AlertTriangle className="w-4 h-4 text-amber-500 inline ml-1" />
                          )}
                        </td>
                        {/* ACCOUNT NUMBER (6 digits) - V2.4 Rule */}
                        <td className="py-3 px-4">
                          <p className="text-sm font-mono text-muted-foreground">
                            {order.profiles?.account_number || "—"}
                          </p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm text-foreground">
                            {order.profiles?.full_name?.trim() || 
                             [order.client_first_name, order.client_last_name].filter(Boolean).join(" ").trim() || 
                             "Client inconnu"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {order.profiles?.email || order.client_email || "—"}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground">{order.service_type}</td>
                        {/* FACTURE - from snapshot billing_totals.total */}
                        <td className="py-3 px-4 text-sm text-foreground">
                          {(order.equipment_details?.billing_totals?.total ? Number(order.equipment_details.billing_totals.total).toFixed(2) : order.total_amount ? Number(order.total_amount).toFixed(2) : "0.00")} $
                        </td>
                        {/* PAYÉ - from amount_paid field (provider confirmed) */}
                        <td className="py-3 px-4 text-sm font-medium">
                          <span className={order.amount_paid > 0 ? "text-emerald-500" : "text-muted-foreground"}>
                            {Number(order.amount_paid || 0).toFixed(2)} $
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={orderStatusConfig[order.status]?.color || "bg-muted"}>
                            {orderStatusConfig[order.status]?.label || order.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={paymentStatusConfig[order.payment_status]?.color || "bg-muted"}>
                            {paymentStatusConfig[order.payment_status]?.label || order.payment_status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {format(new Date(order.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => handleViewDetails(order)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => sendUpdateMutation.mutate(order.id)}>
                              <Send className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune commande trouvée</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Commande {selectedOrder?.order_number || `#${selectedOrder?.id?.slice(0, 8)}`}
                {selectedOrder?.risk_flags?.length > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Risque
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>

            {selectedOrder && (
              <ScrollArea className="max-h-[70vh]">
                {/* Equipment Order - Use dedicated component */}
                {selectedOrder.order_type === "equipment" ? (
                  <EquipmentOrderDetails 
                    order={selectedOrder} 
                    onUpdate={() => {
                      refetch();
                      setDetailsDialogOpen(false);
                    }} 
                  />
                ) : (
                <Tabs defaultValue="details" className="w-full">
                  <TabsList className="grid w-full grid-cols-7">
                    <TabsTrigger value="details">Détails</TabsTrigger>
                    <TabsTrigger value="fulfillment" className="flex items-center gap-1">
                      <Wrench className="w-3 h-3" />
                      Traitement
                    </TabsTrigger>
                    <TabsTrigger value="payment">Paiement</TabsTrigger>
                    <TabsTrigger value="identity">Identité</TabsTrigger>
                    <TabsTrigger value="equipment">Équipement</TabsTrigger>
                    <TabsTrigger value="tracking">Suivi</TabsTrigger>
                    <TabsTrigger value="audit">Audit</TabsTrigger>
                  </TabsList>

                  {/* Details Tab */}
                  <TabsContent value="details" className="space-y-4 mt-4">
                    {/* Client Info Block - TOP PRIORITY */}
                    <OrderClientInfoBlock
                      orderId={selectedOrder.id}
                      userId={selectedOrder.user_id}
                      orderProfile={selectedOrder.profiles}
                      onInfoUpdated={() => refetch()}
                    />

                    {/* Service Details Section */}
                    <Card className="border-primary/20 bg-primary/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Détails du service commandé
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <Label className="text-xs text-muted-foreground">Type de service</Label>
                            <p className="font-medium">{selectedOrder.service_type || "N/A"}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Catégorie</Label>
                            <p className="font-medium">{selectedOrder.category || selectedOrder.service_type?.split(" ")[0] || "N/A"}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Montant total</Label>
                            <p className="font-bold text-primary">{Number(selectedOrder.total_amount || 0).toFixed(2)} $</p>
                          </div>
                        </div>
                        {selectedOrder.notes && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Description</Label>
                            <p className="text-sm">{selectedOrder.notes}</p>
                          </div>
                        )}
                        {/* Equipment included */}
                        <div className="flex flex-wrap gap-2 pt-2">
                          {(selectedOrder.terminal_count || 0) > 0 && (
                            <Badge variant="outline" className="bg-background">
                              <Monitor className="w-3 h-3 mr-1" />
                              {selectedOrder.terminal_count}x Terminal 4K
                            </Badge>
                          )}
                          {(selectedOrder.router_fee || 0) > 0 && (
                            <Badge variant="outline" className="bg-background">
                              <Wifi className="w-3 h-3 mr-1" />
                              Routeur Nivra Born
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Statut commande</Label>
                        <Select
                          value={selectedOrder.status}
                          onValueChange={handleOrderStatusChange}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {orderStatusOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Type d'installation</Label>
                        <Select
                          value={selectedOrder.installation_type || "auto"}
                          onValueChange={(v) => setSelectedOrder({ ...selectedOrder, installation_type: v })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto-installation (frais livraison)</SelectItem>
                            <SelectItem value="technician">Technicien Nivra (frais installation)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Technician Assignment Section - Always visible for admin */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Wrench className="w-4 h-4" />
                          Assignation technicien
                          {selectedOrder.installation_type !== "technician" && (
                            <Badge variant="outline" className="ml-2 text-xs">Optionnel</Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Technicien</Label>
                              <Select
                                value={selectedOrder.technician_id || ""}
                                onValueChange={(v) => {
                                  assignTechnicianMutation.mutate({
                                    orderId: selectedOrder.id,
                                    technicianId: v,
                                  });
                                  setSelectedOrder({ ...selectedOrder, technician_id: v });
                                }}
                              >
                                <SelectTrigger><SelectValue placeholder="Sélectionner un technicien" /></SelectTrigger>
                                <SelectContent>
                                  {technicians?.map((tech: any) => (
                                    <SelectItem key={tech.id} value={tech.id}>
                                      {tech.full_name} {tech.specializations?.length > 0 && `(${tech.specializations.join(", ")})`}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Date d'installation</Label>
                              <Input
                                type="datetime-local"
                                value={selectedOrder.appointment_date ? new Date(selectedOrder.appointment_date).toISOString().slice(0, 16) : ""}
                                onChange={(e) => setSelectedOrder({ ...selectedOrder, appointment_date: e.target.value })}
                              />
                            </div>
                          </div>
                          {selectedOrder.technician_id && (
                            <div className="flex items-center gap-2 p-2 bg-emerald-500/10 rounded-lg">
                              <CheckCircle className="w-4 h-4 text-emerald-500" />
                              <span className="text-sm text-emerald-500">Technicien assigné</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Client</Label>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="font-medium">{selectedOrder.profiles?.full_name || "N/A"}</p>
                          <p className="text-sm text-muted-foreground">{selectedOrder.profiles?.email}</p>
                          <p className="text-sm text-muted-foreground">{selectedOrder.profiles?.phone}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Adresse de service</Label>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm">{selectedOrder.profiles?.service_address || "N/A"}</p>
                          <p className="text-sm">{selectedOrder.profiles?.service_city}, {selectedOrder.profiles?.service_province} {selectedOrder.profiles?.service_postal_code}</p>
                          {!isQuebecAddress(selectedOrder.profiles?.service_province) && (
                            <Badge variant="destructive" className="mt-2">
                              <XCircle className="w-3 h-3 mr-1" />
                              Hors Québec
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <Label>Notes client</Label>
                      <Textarea
                        value={selectedOrder.notes || ""}
                        onChange={(e) => setSelectedOrder({ ...selectedOrder, notes: e.target.value })}
                        placeholder="Notes visibles par le client..."
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label>Notes internes (admin seulement)</Label>
                      <Textarea
                        value={selectedOrder.internal_notes || ""}
                        onChange={(e) => setSelectedOrder({ ...selectedOrder, internal_notes: e.target.value })}
                        placeholder="Notes internes..."
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label>Drapeaux de risque</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {["fraud_suspected", "payment_issue", "id_mismatch", "address_issue"].map((flag) => (
                          <Badge
                            key={flag}
                            variant={selectedOrder.risk_flags?.includes(flag) ? "destructive" : "outline"}
                            className="cursor-pointer"
                            onClick={() => {
                              const current = selectedOrder.risk_flags || [];
                              const updated = current.includes(flag)
                                ? current.filter((f: string) => f !== flag)
                                : [...current, flag];
                              setSelectedOrder({ ...selectedOrder, risk_flags: updated });
                            }}
                          >
                            {flag === "fraud_suspected" && "Fraude suspectée"}
                            {flag === "payment_issue" && "Problème paiement"}
                            {flag === "id_mismatch" && "ID ne correspond pas"}
                            {flag === "address_issue" && "Problème adresse"}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  {/* Fulfillment Tab - Order Processing Multi-services */}
                  <TabsContent value="fulfillment" className="space-y-4 mt-4">
                    {(() => {
                      const detectedServices = detectOrderServices({
                        service_type: selectedOrder.service_type,
                        services: selectedOrder.services,
                        category: selectedOrder.category,
                      });
                      const serviceLabels = getServiceLabels(detectedServices);
                      const hasServices = detectedServices.size > 0;

                      return (
                        <>
                          {/* Services detection header */}
                          <Card className="border-primary/30 bg-primary/5">
                            <CardContent className="py-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Package className="w-5 h-5 text-primary" />
                                  <span className="font-medium">Services détectés</span>
                                </div>
                                <div className="flex gap-2">
                                  {serviceLabels.length > 0 ? (
                                    serviceLabels.map((label) => (
                                      <Badge key={label} variant="outline" className="bg-primary/10">
                                        {label === 'Mobile' && <Smartphone className="w-3 h-3 mr-1" />}
                                        {label === 'Internet' && <Wifi className="w-3 h-3 mr-1" />}
                                        {label === 'TV' && <Monitor className="w-3 h-3 mr-1" />}
                                        {label === 'Streaming+' && <MonitorPlay className="w-3 h-3 mr-1" />}
                                        {label}
                                      </Badge>
                                    ))
                                  ) : (
                                    <Badge variant="outline" className="text-muted-foreground">
                                      Aucun service reconnu
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground mt-2">
                                Type de service: {selectedOrder.service_type || 'Non spécifié'}
                              </p>
                            </CardContent>
                          </Card>

                          {/* Mobile Fulfillment Section */}
                          {detectedServices.has('mobile') && (
                            <MobileFulfillmentSection
                              orderId={selectedOrder.id}
                              orderNumber={selectedOrder.order_number || selectedOrder.id.slice(0, 8).toUpperCase()}
                              userId={selectedOrder.user_id}
                              clientEmail={selectedOrder.profiles?.email || selectedOrder.client_email}
                              clientName={selectedOrder.profiles?.full_name}
                              clientFirstName={selectedOrder.profiles?.first_name}
                              locale="fr"
                              portalBaseUrl="/portal"
                              portRequest={selectedOrder.port_request}
                              onUpdate={() => {
                                refetch();
                              }}
                            />
                          )}

                          {/* Streaming Activation Section */}
                          {detectedServices.has('streaming') && (
                            <StreamingActivationSection
                              orderId={selectedOrder.id}
                              orderNumber={selectedOrder.order_number || selectedOrder.id.slice(0, 8).toUpperCase()}
                              userId={selectedOrder.user_id}
                              clientEmail={selectedOrder.profiles?.email || selectedOrder.client_email}
                              clientName={selectedOrder.profiles?.full_name}
                              clientFirstName={selectedOrder.profiles?.first_name}
                              locale="fr"
                              portalBaseUrl="/portal"
                              streamingServices={selectedOrder.streaming_services || []}
                              onUpdate={() => {
                                refetch();
                              }}
                            />
                          )}

                          {/* Installation Fulfillment Section (Internet/TV) */}
                          {(detectedServices.has('internet') || detectedServices.has('tv')) && (
                            <InstallationFulfillmentSection
                              orderId={selectedOrder.id}
                              orderNumber={selectedOrder.order_number || selectedOrder.id.slice(0, 8).toUpperCase()}
                              userId={selectedOrder.user_id}
                              clientEmail={selectedOrder.profiles?.email || selectedOrder.client_email}
                              clientName={selectedOrder.profiles?.full_name}
                              clientFirstName={selectedOrder.profiles?.first_name}
                              locale="fr"
                              portalBaseUrl="/portal"
                              serviceAddress={`${selectedOrder.profiles?.service_address || ''}, ${selectedOrder.profiles?.service_city || ''} ${selectedOrder.profiles?.service_province || ''} ${selectedOrder.profiles?.service_postal_code || ''}`.trim()}
                              currentStatus={selectedOrder.status}
                              appointmentDate={selectedOrder.appointment_date}
                              currentTechnicianId={selectedOrder.technician_id}
                              equipmentDetails={selectedOrder.equipment_details}
                              onUpdate={() => {
                                refetch();
                              }}
                            />
                          )}

                          {/* No services detected message */}
                          {!hasServices && (
                            <div className="text-center py-12">
                              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                              <p className="text-muted-foreground">Aucun service détecté pour cette commande</p>
                              <p className="text-xs text-muted-foreground mt-2">
                                Vérifiez le type de service: "{selectedOrder.service_type}"
                              </p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </TabsContent>

                  {/* Payment Tab */}
                  <TabsContent value="payment" className="space-y-4 mt-4">
                    {/* Payment Reference Display */}
                    {selectedOrder.payment_reference && (
                      <Card className="border-emerald-500/30 bg-emerald-500/10">
                        <CardContent className="py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-5 h-5 text-emerald-500" />
                              <span className="text-sm font-medium">Référence de paiement</span>
                            </div>
                            <span className="font-mono font-bold text-lg">{selectedOrder.payment_reference}</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <CreditCard className="w-4 h-4" />
                            Statut du paiement
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <Badge className={`${paymentStatusConfig[selectedOrder.payment_status]?.color} text-lg px-4 py-2`}>
                            {paymentStatusConfig[selectedOrder.payment_status]?.label || selectedOrder.payment_status}
                          </Badge>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            Montant total
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-2xl font-bold">
                            {selectedOrder.equipment_details?.billing_totals?.total 
                              ? Number(selectedOrder.equipment_details.billing_totals.total).toFixed(2) 
                              : Number(selectedOrder.total_amount || 0).toFixed(2)} $
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Payment breakdown */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Détail des frais</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Sous-total:</span>
                          <span>{Number(selectedOrder.subtotal || 0).toFixed(2)} $</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Frais de livraison:</span>
                          <span>{Number(selectedOrder.delivery_fee || 0).toFixed(2)} $</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Frais d'activation:</span>
                          <span>{Number(selectedOrder.activation_fee || 0).toFixed(2)} $</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Frais d'installation:</span>
                          <span>{Number(selectedOrder.installation_fee || 0).toFixed(2)} $</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Terminaux ({selectedOrder.terminal_count || 0}x):</span>
                          <span>{Number(selectedOrder.terminal_fee || 0).toFixed(2)} $</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Routeur:</span>
                          <span>{Number(selectedOrder.router_fee || 0).toFixed(2)} $</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                          <span>TPS (5%):</span>
                          <span>{Number(selectedOrder.tps_amount || 0).toFixed(2)} $</span>
                        </div>
                        <div className="flex justify-between">
                          <span>TVQ (9.975%):</span>
                          <span>{Number(selectedOrder.tvq_amount || 0).toFixed(2)} $</span>
                        </div>
                        {selectedOrder.discount_amount > 0 && (
                          <div className="flex justify-between text-emerald-500">
                            <span>Rabais:</span>
                            <span>-{Number(selectedOrder.discount_amount).toFixed(2)} $</span>
                          </div>
                        )}
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                          <span>Total:</span>
                          <span>{Number(selectedOrder.total_amount || 0).toFixed(2)} $</span>
                        </div>
                      </CardContent>
                    </Card>

                    {/* E-Transfer Payments Section */}
                    {linkedEtransferPayments && linkedEtransferPayments.length > 0 && (
                      <Card className="border-cyan-500/30 bg-cyan-500/5">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-cyan-500" />
                            E-Transfer Payments
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {linkedEtransferPayments.map((payment: any) => (
                            <div key={payment.id} className="p-3 bg-muted/30 rounded-lg border">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <p className="font-mono text-sm font-medium">{payment.reference_number}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {payment.etransfer_sender_name && `From: ${payment.etransfer_sender_name} • `}
                                    {Number(payment.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(payment.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className={etransferStatusConfig[payment.status]?.color || "bg-muted"}>
                                    {etransferStatusConfig[payment.status]?.label || payment.status}
                                  </Badge>
                                  {permissions.canUpdatePaymentStatus && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setSelectedEtransferPayment({ ...payment, newStatus: payment.status })}
                                    >
                                      Update
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* E-Transfer Status Update Dialog */}
                    {selectedEtransferPayment && (
                      <Dialog open={!!selectedEtransferPayment} onOpenChange={(open) => !open && setSelectedEtransferPayment(null)}>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Update E-Transfer Status</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Reference</Label>
                              <p className="font-mono bg-muted p-2 rounded">{selectedEtransferPayment.reference_number}</p>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">Current Status:</span>
                              <Badge className={etransferStatusConfig[selectedEtransferPayment.status]?.color || "bg-muted"}>
                                {etransferStatusConfig[selectedEtransferPayment.status]?.label || selectedEtransferPayment.status}
                              </Badge>
                            </div>
                            <div className="space-y-2">
                              <Label>New Status</Label>
                              <Select
                                value={selectedEtransferPayment.newStatus}
                                onValueChange={(v) => setSelectedEtransferPayment({ ...selectedEtransferPayment, newStatus: v })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {etransferStatusOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Reason (optional)</Label>
                              <Textarea
                                placeholder="Reason for status change..."
                                value={etransferStatusReason}
                                onChange={(e) => setEtransferStatusReason(e.target.value)}
                                rows={2}
                              />
                            </div>
                            {selectedEtransferPayment.newStatus === "processed" && selectedEtransferPayment.status !== "processed" && (
                              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-600">
                                <p className="font-medium">Balance Update</p>
                                <p>Client balance will be reduced by {Number(selectedEtransferPayment.amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}.</p>
                              </div>
                            )}
                            {(selectedEtransferPayment.newStatus === "fraud" || selectedEtransferPayment.newStatus === "declined") && (
                              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-600">
                                <p className="font-medium">Warning</p>
                                <p>This status will NOT update the client balance.</p>
                              </div>
                            )}
                            <div className="flex gap-2 pt-2">
                              <Button
                                className="flex-1"
                                variant="hero"
                                onClick={() => {
                                  if (!selectedEtransferPayment.newStatus || selectedEtransferPayment.newStatus === selectedEtransferPayment.status) {
                                    toast({ title: "Select a new status", variant: "destructive" });
                                    return;
                                  }
                                  updateEtransferStatusMutation.mutate({
                                    paymentId: selectedEtransferPayment.id,
                                    newStatus: selectedEtransferPayment.newStatus,
                                    reason: etransferStatusReason,
                                    payment: selectedEtransferPayment,
                                  });
                                }}
                                disabled={updateEtransferStatusMutation.isPending || !selectedEtransferPayment.newStatus || selectedEtransferPayment.newStatus === selectedEtransferPayment.status}
                              >
                                {updateEtransferStatusMutation.isPending ? "Updating..." : "Save"}
                              </Button>
                              <Button variant="outline" onClick={() => setSelectedEtransferPayment(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}

                    {/* Payment Actions */}
                    <div className="flex flex-wrap gap-2">
                      {(selectedOrder.payment_status === "pending" || selectedOrder.payment_status === "pre_authorized") && (
                        <>
                          <Button
                            onClick={() => setConfirmAction({ type: "authorize", data: { orderId: selectedOrder.id } })}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Autoriser
                          </Button>
                          <Button
                            variant="hero"
                            onClick={() => setConfirmAction({ type: "capture", data: { orderId: selectedOrder.id } })}
                          >
                            <DollarSign className="w-4 h-4 mr-2" />
                            Capturer directement
                          </Button>
                        </>
                      )}
                      {selectedOrder.payment_status === "authorized" && (
                        <Button
                          variant="hero"
                          onClick={() => setConfirmAction({ type: "capture", data: { orderId: selectedOrder.id } })}
                        >
                          <DollarSign className="w-4 h-4 mr-2" />
                          Capturer
                        </Button>
                      )}
                      {(selectedOrder.payment_status === "authorized" || selectedOrder.payment_status === "captured") && (
                        <Button
                          variant="destructive"
                          onClick={() => setConfirmAction({ type: "refund", data: { orderId: selectedOrder.id } })}
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Rembourser
                        </Button>
                      )}
                      {selectedOrder.payment_status !== "disputed" && selectedOrder.payment_status !== "pending" && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            updatePaymentStatusMutation.mutate({ orderId: selectedOrder.id, newStatus: "disputed" });
                          }}
                        >
                          <AlertTriangle className="w-4 h-4 mr-2" />
                          Contester
                        </Button>
                      )}
                    </div>

                    {/* Pre-authorized Card Info */}
                    {(selectedOrder.preauth_card_id || selectedOrder.preauth_discount > 0) && (
                      <Card className="border-blue-500/30 bg-blue-500/10">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-blue-500" />
                            Paiement pré-autorisé
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Rabais mensuel:</span>
                            <Badge className="bg-emerald-500/20 text-emerald-500">
                              {selectedOrder.preauth_discount || 5}$/mois
                            </Badge>
                          </div>
                          {selectedOrder.preauth_card_id && (
                            <p className="text-xs text-muted-foreground">
                              Carte enregistrée pour paiements automatiques
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Add fees section */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Ajouter des frais</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Frais additionnels</Label>
                            <Input
                              type="number"
                              placeholder="0.00"
                              onChange={(e) => {
                                const fee = parseFloat(e.target.value) || 0;
                                const newTotal = (selectedOrder.total_amount || 0) + fee;
                                setSelectedOrder({ ...selectedOrder, total_amount: newTotal });
                              }}
                            />
                          </div>
                          <div>
                            <Label>Crédit à appliquer</Label>
                            <Input
                              type="number"
                              placeholder="0.00"
                              value={selectedOrder.credits_applied || ""}
                              onChange={(e) => {
                                const credit = parseFloat(e.target.value) || 0;
                                setSelectedOrder({ ...selectedOrder, credits_applied: credit });
                              }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Identity Tab */}
                  <TabsContent value="identity" className="space-y-4 mt-4">
                    {/* Port-In / Transfer Section - Show only if port_request exists */}
                    {selectedOrder.port_request && (selectedOrder.port_request as any)?.port_in && (
                      <Card className="border-cyan-500/30 bg-cyan-500/5">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Phone className="w-4 h-4 text-cyan-500" />
                            Transfert de numéro (portabilité)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <Label className="text-xs text-muted-foreground">Numéro à transférer</Label>
                              <p className="font-mono font-medium">{(selectedOrder.port_request as any)?.phone_number || "—"}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Fournisseur actuel</Label>
                              <p className="font-medium">{(selectedOrder.port_request as any)?.carrier || "Non spécifié"}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">No. compte fournisseur</Label>
                              <p className="font-mono">{(selectedOrder.port_request as any)?.account_number || "—"}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">No. service</Label>
                              <p className="font-mono">{(selectedOrder.port_request as any)?.service_account || "—"}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">IMEI</Label>
                              <p className="font-mono">{(selectedOrder.port_request as any)?.imei || "—"}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Consentement</Label>
                              <Badge className="bg-emerald-500/20 text-emerald-500">
                                {(selectedOrder.port_request as any)?.consent ? "Confirmé" : "Non"}
                              </Badge>
                            </div>
                          </div>
                          {(selectedOrder.port_request as any)?.consent_at && (
                            <p className="text-xs text-muted-foreground">
                              Accepté le {format(new Date((selectedOrder.port_request as any).consent_at), "d MMM yyyy HH:mm", { locale: fr })}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Identity Snapshot from Order - Read-only display */}
                    {selectedOrder.identity_snapshot && (
                      <Card className="bg-blue-500/5 border-blue-500/30">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs text-blue-500 flex items-center gap-2">
                            <FileText className="w-3 h-3" />
                            Identité soumise avec la commande
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <Label className="text-xs text-muted-foreground">Type de pièce</Label>
                            <p className="font-medium">
                              {(selectedOrder.identity_snapshot as any)?.id_type === "drivers_license" ? "Permis de conduire" :
                               (selectedOrder.identity_snapshot as any)?.id_type === "passport" ? "Passeport" :
                               (selectedOrder.identity_snapshot as any)?.id_type === "health_card" ? "Carte assurance maladie" :
                               (selectedOrder.identity_snapshot as any)?.id_type === "residency_card" ? "Carte résident permanent" :
                               (selectedOrder.identity_snapshot as any)?.id_type || "Non fourni"}
                            </p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Numéro</Label>
                            <p className="font-mono font-medium">{(selectedOrder.identity_snapshot as any)?.id_number || "—"}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Province</Label>
                            <p className="font-medium">{(selectedOrder.identity_snapshot as any)?.id_province || "—"}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Expiration</Label>
                            <p className="font-medium">
                              {(selectedOrder.identity_snapshot as any)?.id_expiration
                                ? format(new Date((selectedOrder.identity_snapshot as any).id_expiration), "d MMM yyyy", { locale: fr })
                                : "—"}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Shield className="w-4 h-4" />
                          Vérification d'identité
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center gap-4">
                          <span>Statut:</span>
                          <Badge className={idVerificationConfig[selectedOrder.id_verification_status]?.color || "bg-muted"}>
                            {idVerificationConfig[selectedOrder.id_verification_status]?.label || "En attente"}
                          </Badge>
                        </div>

                        {/* Client Info Summary */}
                        <Card className="bg-accent/20 border-accent/30">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
                              <User className="w-3 h-3" />
                              Information du client (profil)
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <Label className="text-xs text-muted-foreground">Nom complet</Label>
                              <p className="font-medium">
                                {selectedOrder.profiles?.first_name && selectedOrder.profiles?.last_name
                                  ? `${selectedOrder.profiles.first_name} ${selectedOrder.profiles.last_name}`
                                  : selectedOrder.profiles?.full_name || "Non fourni"}
                              </p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Date de naissance</Label>
                              <p className="font-medium">
                                {selectedOrder.profiles?.date_of_birth
                                  ? format(new Date(selectedOrder.profiles.date_of_birth), "d MMMM yyyy", { locale: fr })
                                  : "Non fourni"}
                              </p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Type ID (profil)</Label>
                              <p className="font-medium">{selectedOrder.profiles?.id_type || "—"}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Numéro ID (profil)</Label>
                              <p className="font-mono">{selectedOrder.profiles?.id_number || "—"}</p>
                            </div>
                          </CardContent>
                        </Card>

                        {/* Editable ID Fields */}
                        <Card className="border-primary/30">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs text-primary flex items-center gap-2">
                              <FileText className="w-3 h-3" />
                              Modifier les informations d'identité
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                              <div>
                                <Label className="text-xs">Type de pièce d'identité</Label>
                                <Select
                                  value={identityForm.id_type}
                                  onValueChange={(v) => setIdentityForm({ ...identityForm, id_type: v })}
                                >
                                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="drivers_license">Permis de conduire</SelectItem>
                                    <SelectItem value="passport">Passeport</SelectItem>
                                    <SelectItem value="health_card">Carte d'assurance maladie</SelectItem>
                                    <SelectItem value="residency_card">Carte de résident permanent</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">Numéro de pièce</Label>
                                <Input
                                  placeholder="Numéro de pièce"
                                  value={identityForm.id_number}
                                  onChange={(e) => setIdentityForm({ ...identityForm, id_number: e.target.value })}
                                  className="font-mono"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Province d'émission</Label>
                                <Select
                                  value={identityForm.id_province}
                                  onValueChange={(v) => setIdentityForm({ ...identityForm, id_province: v })}
                                >
                                  <SelectTrigger><SelectValue placeholder="Province..." /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="QC">Québec</SelectItem>
                                    <SelectItem value="ON">Ontario</SelectItem>
                                    <SelectItem value="BC">Colombie-Britannique</SelectItem>
                                    <SelectItem value="AB">Alberta</SelectItem>
                                    <SelectItem value="MB">Manitoba</SelectItem>
                                    <SelectItem value="SK">Saskatchewan</SelectItem>
                                    <SelectItem value="NS">Nouvelle-Écosse</SelectItem>
                                    <SelectItem value="NB">Nouveau-Brunswick</SelectItem>
                                    <SelectItem value="NL">Terre-Neuve-et-Labrador</SelectItem>
                                    <SelectItem value="PE">Île-du-Prince-Édouard</SelectItem>
                                    <SelectItem value="NT">Territoires du Nord-Ouest</SelectItem>
                                    <SelectItem value="YT">Yukon</SelectItem>
                                    <SelectItem value="NU">Nunavut</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs">Date d'expiration</Label>
                                <Input
                                  type="date"
                                  value={identityForm.id_expiration}
                                  onChange={(e) => setIdentityForm({ ...identityForm, id_expiration: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Date d'émission</Label>
                                <Input
                                  type="date"
                                  value={identityForm.id_issue_date}
                                  onChange={(e) => setIdentityForm({ ...identityForm, id_issue_date: e.target.value })}
                                  placeholder="Non disponible"
                                />
                                <p className="text-xs text-muted-foreground mt-1">Champ optionnel</p>
                              </div>
                              <div>
                                <Label className="text-xs">Référence document téléversé</Label>
                                <Input
                                  placeholder="Nom de fichier ou référence"
                                  value={identityForm.id_upload}
                                  onChange={(e) => setIdentityForm({ ...identityForm, id_upload: e.target.value })}
                                />
                                <p className="text-xs text-muted-foreground mt-1">Admin privé</p>
                              </div>
                            </div>
                            <Button onClick={handleSaveIdentity} className="w-full">
                              Sauvegarder les informations d'identité
                            </Button>
                          </CardContent>
                        </Card>

                        {/* Verification Warning for Missing Data */}
                        {(!identityForm.id_type || !identityForm.id_number) && (
                          <Card className="bg-amber-500/10 border-amber-500/30">
                            <CardContent className="py-3 flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-amber-500" />
                              <p className="text-sm text-amber-600">
                                Données d'identité incomplètes - Veuillez compléter le type et numéro de pièce d'identité.
                              </p>
                            </CardContent>
                          </Card>
                        )}

                        <div>
                          <Label>Notes de vérification</Label>
                          <Textarea
                            value={selectedOrder.id_verification_notes || ""}
                            onChange={(e) => setSelectedOrder({ ...selectedOrder, id_verification_notes: e.target.value })}
                            placeholder="Notes sur la vérification..."
                            className="mt-1"
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="hero"
                            onClick={() => verifyIdMutation.mutate({
                              orderId: selectedOrder.id,
                              status: "verified",
                              notes: selectedOrder.id_verification_notes,
                            })}
                            disabled={selectedOrder.id_verification_status === "verified"}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Approuver ID
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => verifyIdMutation.mutate({
                              orderId: selectedOrder.id,
                              status: "rejected",
                              notes: selectedOrder.id_verification_notes,
                            })}
                            disabled={selectedOrder.id_verification_status === "rejected"}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Rejeter ID
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Equipment Tab */}
                  <TabsContent value="equipment" className="space-y-4 mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Monitor className="w-4 h-4" />
                          Équipement
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Terminaux Nivra 4K Smart ({TERMINAL_PRICE}$ chaque)</Label>
                            <Select
                              value={String(equipmentForm.terminal_count)}
                              onValueChange={(v) => setEquipmentForm({ ...equipmentForm, terminal_count: parseInt(v) })}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[0, 1, 2, 3, 4].map((n) => (
                                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="router"
                                checked={equipmentForm.router_included}
                                onChange={(e) => setEquipmentForm({ ...equipmentForm, router_included: e.target.checked })}
                                className="h-4 w-4"
                              />
                              <Label htmlFor="router" className="flex items-center gap-2">
                                <Wifi className="w-4 h-4" />
                                Borne WiFi Nivra ({ROUTER_PRICE}$)
                              </Label>
                            </div>
                            {/* WiFi Router Serial Number - Required when router is included */}
                            {equipmentForm.router_included && (
                              <div className="ml-6 p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
                                <Label className="text-xs text-cyan-500">Numéro de série Borne WiFi *</Label>
                                <Input
                                  placeholder="Entrez le numéro de série..."
                                  value={equipmentForm.router_serial_number}
                                  onChange={(e) => setEquipmentForm({ ...equipmentForm, router_serial_number: e.target.value })}
                                  className="font-mono mt-1"
                                />
                                {!equipmentForm.router_serial_number.trim() && (
                                  <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    Numéro de série obligatoire
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* SIM Card Section */}
                        {(selectedOrder.service_type?.toLowerCase().includes("mobile") || 
                          selectedOrder.service_type?.toLowerCase().includes("cellulaire")) && (
                          <Card className="bg-primary/5 border-primary/20">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-xs text-primary flex items-center gap-2">
                                <CreditCard className="w-3 h-3" />
                                Carte SIM
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Type de carte SIM</Label>
                                  <Select
                                    value={equipmentForm.sim_type}
                                    onValueChange={(v: "" | "esim" | "physical_sim") => setEquipmentForm({ ...equipmentForm, sim_type: v })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Sélectionner le type..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="esim">eSIM (25$)</SelectItem>
                                      <SelectItem value="physical_sim">Carte SIM physique (25$)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label>Numéro de série SIM</Label>
                                  <Input
                                    placeholder="Entrez le numéro de série..."
                                    value={equipmentForm.sim_serial_number}
                                    onChange={(e) => setEquipmentForm({ ...equipmentForm, sim_serial_number: e.target.value })}
                                    className="font-mono"
                                  />
                                  {equipmentForm.sim_type && !equipmentForm.sim_serial_number && (
                                    <p className="text-xs text-amber-500 mt-1">Numéro de série requis</p>
                                  )}
                                </div>
                              </div>
                              {equipmentForm.sim_type && (
                                <div className="p-3 bg-accent/30 rounded-lg">
                                  <p className="text-sm">
                                    <span className="font-medium">Type sélectionné:</span>{" "}
                                    {equipmentForm.sim_type === "esim" ? "eSIM (25$)" : "Carte SIM physique (25$)"}
                                  </p>
                                  {equipmentForm.sim_serial_number && (
                                    <p className="text-sm mt-1">
                                      <span className="font-medium">Série:</span>{" "}
                                      <span className="font-mono">{equipmentForm.sim_serial_number}</span>
                                    </p>
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}

                        {equipmentForm.terminal_count > 0 && (
                          <div className="space-y-4 p-4 bg-muted rounded-lg">
                            <p className="text-sm font-medium">Détails des terminaux</p>
                            {Array.from({ length: equipmentForm.terminal_count }).map((_, i) => (
                              <div key={i} className="grid grid-cols-3 gap-2">
                                <div>
                                  <Label className="text-xs">Série #{i + 1}</Label>
                                  <Input
                                    placeholder="Numéro de série"
                                    value={equipmentForm.serial_numbers[i] || ""}
                                    onChange={(e) => {
                                      const updated = [...equipmentForm.serial_numbers];
                                      updated[i] = e.target.value;
                                      setEquipmentForm({ ...equipmentForm, serial_numbers: updated });
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">IMEI #{i + 1}</Label>
                                  <Input
                                    placeholder="IMEI"
                                    value={equipmentForm.imei_numbers[i] || ""}
                                    onChange={(e) => {
                                      const updated = [...equipmentForm.imei_numbers];
                                      updated[i] = e.target.value;
                                      setEquipmentForm({ ...equipmentForm, imei_numbers: updated });
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs">Réf. inventaire #{i + 1}</Label>
                                  <Input
                                    placeholder="Référence"
                                    value={equipmentForm.inventory_refs[i] || ""}
                                    onChange={(e) => {
                                      const updated = [...equipmentForm.inventory_refs];
                                      updated[i] = e.target.value;
                                      setEquipmentForm({ ...equipmentForm, inventory_refs: updated });
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                            <div className="p-3 bg-emerald-500/10 rounded-lg mt-3">
                              <div className="flex items-center gap-2 text-emerald-500">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-sm font-medium">Garantie: 1 an couverture fabricant</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">Équipement inclut garantie matériel standard Nivra</p>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-4 border-t">
                          <div>
                            <p className="text-sm text-muted-foreground">Total équipement:</p>
                            <p className="text-lg font-bold">
                              {(equipmentForm.terminal_count * TERMINAL_PRICE + (equipmentForm.router_included ? ROUTER_PRICE : 0)).toFixed(2)} $
                            </p>
                          </div>
                          <Button onClick={handleSaveEquipment}>
                            Sauvegarder équipement
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Tracking Tab - Simplified: Only shipping OR technician info */}
                  <TabsContent value="tracking" className="space-y-4 mt-4">
                    {/* Shipping Tracking - for shipped orders */}
                    {(selectedOrder.installation_type !== "technician" || selectedOrder.status === "shipped") && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Truck className="w-4 h-4" />
                            Suivi de livraison
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Transporteur</Label>
                              <Select
                                value={selectedOrder.carrier || ""}
                                onValueChange={(v) => setSelectedOrder({ ...selectedOrder, carrier: v })}
                              >
                                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="nivra_telecom">Nivra Telecom</SelectItem>
                                  <SelectItem value="nivra_direct">Livraison Nivra</SelectItem>
                                  <SelectItem value="uber">Uber</SelectItem>
                                  <SelectItem value="fedex">FedEx</SelectItem>
                                  <SelectItem value="ups">UPS</SelectItem>
                                  <SelectItem value="postes_canada">Postes Canada</SelectItem>
                                  <SelectItem value="purolator">Purolator</SelectItem>
                                  <SelectItem value="obibox">OBIBOX</SelectItem>
                                  <SelectItem value="canpar">Canpar</SelectItem>
                                  <SelectItem value="intelcom">Intelcom</SelectItem>
                                  <SelectItem value="autre">Autre</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Numéro de suivi</Label>
                              <Input
                                value={selectedOrder.tracking_number || ""}
                                onChange={(e) => setSelectedOrder({ ...selectedOrder, tracking_number: e.target.value })}
                                placeholder="Numéro de suivi..."
                              />
                            </div>
                          </div>
                          <div>
                            <Label>URL de suivi</Label>
                            <Input
                              value={selectedOrder.tracking_url || ""}
                              onChange={(e) => setSelectedOrder({ ...selectedOrder, tracking_url: e.target.value })}
                              placeholder="https://tracking.example.com/..."
                            />
                          </div>
                          {selectedOrder.tracking_url && (
                            <Button variant="outline" size="sm" onClick={() => window.open(selectedOrder.tracking_url, "_blank")}>
                              <Truck className="w-4 h-4 mr-2" />
                              Ouvrir le suivi
                            </Button>
                          )}
                          {selectedOrder.shipped_at && (
                            <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
                              <p className="text-sm text-cyan-500">
                                Expédié le {format(new Date(selectedOrder.shipped_at), "d MMMM yyyy à HH:mm", { locale: fr })}
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Technician Installation Tracking */}
                    {(selectedOrder.installation_type === "technician" || selectedOrder.technician_id) && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Wrench className="w-4 h-4" />
                            Suivi d'installation technicien
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Technicien assigné</Label>
                              <p className="font-medium mt-1">
                                {technicians?.find((t: any) => t.id === selectedOrder.technician_id)?.full_name || "Non assigné"}
                              </p>
                            </div>
                            <div>
                              <Label>Date d'installation</Label>
                              <p className="font-medium mt-1">
                                {selectedOrder.appointment_date
                                  ? format(new Date(selectedOrder.appointment_date), "d MMMM yyyy à HH:mm", { locale: fr })
                                  : "Non planifiée"}
                              </p>
                            </div>
                          </div>
                          <div>
                            <Label>Statut d'installation</Label>
                            <div className="flex gap-2 mt-2 flex-wrap">
                              {["scheduled", "en_route", "in_progress", "completed", "failed"].map((s) => (
                                <Badge
                                  key={s}
                                  variant={selectedOrder.status === s || selectedOrder.status === `completed_installation` && s === "completed" ? "default" : "outline"}
                                  className={`cursor-pointer ${
                                    s === "completed" ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/30" :
                                    s === "failed" ? "bg-red-500/20 text-red-500 border-red-500/30" :
                                    s === "in_progress" ? "bg-amber-500/20 text-amber-500 border-amber-500/30" :
                                    s === "en_route" ? "bg-cyan-500/20 text-cyan-500 border-cyan-500/30" :
                                    "bg-muted"
                                  }`}
                                >
                                  {s === "scheduled" && "Planifié"}
                                  {s === "en_route" && "En route"}
                                  {s === "in_progress" && "En cours"}
                                  {s === "completed" && "Terminé"}
                                  {s === "failed" && "Échoué"}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <Label>Notes d'installation</Label>
                            <Textarea
                              value={selectedOrder.appointment_notes || ""}
                              onChange={(e) => setSelectedOrder({ ...selectedOrder, appointment_notes: e.target.value })}
                              placeholder="Notes sur l'installation..."
                              className="mt-1"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* No tracking info message */}
                    {!selectedOrder.technician_id && !selectedOrder.tracking_number && selectedOrder.status !== "shipped" && (
                      <div className="text-center py-8">
                        <Truck className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground">Aucune information de suivi disponible</p>
                        <p className="text-xs text-muted-foreground mt-1">Le suivi sera disponible une fois la commande expédiée ou un technicien assigné</p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Audit Tab - Enhanced with activity_logs */}
                  <TabsContent value="audit" className="space-y-4 mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <History className="w-4 h-4" />
                          Historique des actions
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Activity logs from database */}
                        {orderActivityLogs && orderActivityLogs.length > 0 ? (
                          <div className="space-y-3">
                            {orderActivityLogs.map((log: any) => (
                              <div key={log.id} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                                <div className={`w-2 h-2 rounded-full mt-2 ${
                                  log.action?.includes("create") ? "bg-emerald-500" :
                                  log.action?.includes("update") ? "bg-blue-500" :
                                  log.action?.includes("delete") || log.action?.includes("cancel") ? "bg-red-500" :
                                  log.action?.includes("payment") ? "bg-amber-500" :
                                  "bg-primary"
                                }`} />
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium">
                                      {log.action === "create" && "Création"}
                                      {log.action === "update" && "Mise à jour"}
                                      {log.action === "id_verification" && "Vérification ID"}
                                      {log.action === "payment_captured" && "Paiement capturé"}
                                      {log.action === "technician_assigned" && "Technicien assigné"}
                                      {log.action === "status_change" && "Changement de statut"}
                                      {!["create", "update", "id_verification", "payment_captured", "technician_assigned", "status_change"].includes(log.action) && log.action}
                                    </p>
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(log.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Par: {log.actor_name || log.actor_email || "Système"}
                                    {log.actor_role && ` (${log.actor_role})`}
                                  </p>
                                  {log.changed_field && (
                                    <p className="text-xs text-cyan-500 mt-1">
                                      Champ: {log.changed_field}
                                      {log.old_value && ` • Ancien: ${log.old_value}`}
                                      {log.new_value && ` • Nouveau: ${log.new_value}`}
                                    </p>
                                  )}
                                  {log.reason && (
                                    <p className="text-xs text-muted-foreground mt-1 italic">
                                      {log.reason}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : selectedOrder.audit_timeline && selectedOrder.audit_timeline.length > 0 ? (
                          // Fallback to order's embedded audit_timeline
                          <div className="space-y-3">
                            {selectedOrder.audit_timeline.map((entry: any, i: number) => (
                              <div key={i} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{entry.action}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(entry.timestamp), "d MMM yyyy HH:mm", { locale: fr })}
                                  </p>
                                  {entry.user_email && (
                                    <p className="text-xs text-muted-foreground">Par: {entry.user_email}</p>
                                  )}
                                  {entry.details && typeof entry.details === "object" && (
                                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                      {Object.entries(entry.details).map(([key, val]) => (
                                        <p key={key}>{key}: {String(val)}</p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Aucun historique disponible
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-muted-foreground">Créée le</p>
                        <p className="font-medium">
                          {format(new Date(selectedOrder.created_at), "d MMMM yyyy HH:mm", { locale: fr })}
                        </p>
                        {selectedOrder.created_by && (
                          <p className="text-xs text-muted-foreground">Par: {selectedOrder.created_by}</p>
                        )}
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-muted-foreground">Dernière mise à jour</p>
                        <p className="font-medium">
                          {format(new Date(selectedOrder.updated_at), "d MMMM yyyy HH:mm", { locale: fr })}
                        </p>
                        {selectedOrder.processed_by && (
                          <p className="text-xs text-muted-foreground">Traité par: Admin</p>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
                )}

                {/* Save Actions - only show for non-equipment orders */}
                {selectedOrder.order_type !== "equipment" && (
                <div className="flex flex-wrap gap-2 pt-4 border-t mt-4">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      updateOrderMutation.mutate(selectedOrder);
                      setDetailsDialogOpen(false);
                    }}
                  >
                    Enregistrer
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => sendUpdateMutation.mutate(selectedOrder.id)}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Notifier
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDetailsDialogOpen(false);
                      setSummaryDialogOpen(true);
                    }}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Résumé contrat
                  </Button>
                </div>
                )}
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>

        {/* Contract Summary Dialog */}
        {selectedOrder && (
          <ContractSummaryDialog
            open={summaryDialogOpen}
            onOpenChange={setSummaryDialogOpen}
            orderId={selectedOrder.id}
          />
        )}

        {/* Confirmation Dialog */}
        <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction?.type === "authorize" && "Autoriser le paiement?"}
                {confirmAction?.type === "capture" && "Capturer le paiement?"}
                {confirmAction?.type === "refund" && "Rembourser le paiement?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction?.type === "authorize" && "Le paiement sera marqué comme autorisé et prêt pour capture."}
                {confirmAction?.type === "capture" && "Le paiement sera traité et les fonds seront capturés."}
                {confirmAction?.type === "refund" && "Le paiement sera remboursé au client."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (confirmAction?.type === "authorize") {
                    updatePaymentStatusMutation.mutate({ orderId: confirmAction.data.orderId, newStatus: "authorized" });
                  } else if (confirmAction?.type === "capture") {
                    updatePaymentStatusMutation.mutate({ orderId: confirmAction.data.orderId, newStatus: "captured" });
                  } else if (confirmAction?.type === "refund") {
                    updatePaymentStatusMutation.mutate({ orderId: confirmAction.data.orderId, newStatus: "refunded" });
                  }
                }}
              >
                Confirmer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Equipment Order Dialog */}
        <EquipmentOrderDialog
          open={equipmentDialogOpen}
          onOpenChange={setEquipmentDialogOpen}
          clients={clients || []}
          onSuccess={() => refetch()}
        />
      </div>
    </AdminLayout>
  );
};

export default AdminOrders;
