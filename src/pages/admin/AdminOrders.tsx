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
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useRoleAccess } from "@/hooks/useRoleAccess";

// Status configurations
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
};

const paymentStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-amber-500/20 text-amber-500", label: "En attente" },
  pre_authorized: { color: "bg-blue-400/20 text-blue-400", label: "Pré-autorisé" },
  authorized: { color: "bg-blue-500/20 text-blue-500", label: "Autorisé" },
  captured: { color: "bg-emerald-500/20 text-emerald-500", label: "Capturé" },
  refunded: { color: "bg-red-500/20 text-red-500", label: "Remboursé" },
  disputed: { color: "bg-purple-500/20 text-purple-500", label: "Contesté" },
  failed: { color: "bg-red-500/20 text-red-500", label: "Échoué" },
};

const idVerificationConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-amber-500/20 text-amber-500", label: "En attente" },
  verified: { color: "bg-emerald-500/20 text-emerald-500", label: "Vérifié" },
  rejected: { color: "bg-red-500/20 text-red-500", label: "Rejeté" },
};

const orderStatusOptions = [
  { value: "pending", label: "En attente" },
  { value: "hold", label: "Suspendu" },
  { value: "verification", label: "Vérification" },
  { value: "back_order", label: "Back Order" },
  { value: "cancelled", label: "Annulé" },
  { value: "shipped", label: "Expédié" },
  { value: "completed", label: "Terminé" },
  { value: "completed_installation", label: "Installation terminée" },
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
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [confirmAction, setConfirmAction] = useState<{ type: string; data?: any } | null>(null);
  const [newOrder, setNewOrder] = useState({
    user_id: "",
    service_type: "",
    total_amount: "",
    notes: "",
  });

  // Equipment state for order editing
  const [equipmentForm, setEquipmentForm] = useState({
    terminal_count: 0,
    router_included: false,
    serial_numbers: ["", "", "", ""],
    imei_numbers: ["", "", "", ""],
    inventory_refs: ["", "", "", ""],
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
          .select("user_id, email, full_name, phone, service_address, service_city, service_province, service_postal_code, id_type, id_number, id_expiration, id_province")
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
      const { data, error } = await supabase
        .from("orders")
        .insert({
          user_id: order.user_id,
          service_type: order.service_type,
          total_amount: order.total_amount ? parseFloat(order.total_amount) : null,
          notes: order.notes,
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
      setNewOrder({ user_id: "", service_type: "", total_amount: "", notes: "" });
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      logActivity("update", "order", selectedOrder?.id, { 
        status: selectedOrder?.status,
        order_number: selectedOrder?.order_number 
      }, {
        changedField: "status",
        newValue: selectedOrder?.status,
        reason: "Mise à jour de commande"
      });
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
    onSuccess: (data, { orderId, newStatus }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["order-billing"] });
      const order = orders?.find((o: any) => o.id === orderId);
      logActivity("update", "order", orderId, { 
        payment_status: newStatus,
        payment_reference: data?.paymentReference,
        order_number: order?.order_number
      }, {
        changedField: "payment_status",
        oldValue: order?.payment_status,
        newValue: newStatus,
        reason: `Statut paiement changé à ${paymentStatusConfig[newStatus]?.label || newStatus}`
      });
      toast({ 
        title: `Paiement ${paymentStatusConfig[newStatus]?.label || newStatus}`,
        description: data?.paymentReference ? `Réf: ${data.paymentReference}` : undefined
      });
      setConfirmAction(null);
    },
    onError: () => {
      toast({ title: "Erreur de mise à jour du paiement", variant: "destructive" });
    },
  });

  const verifyIdMutation = useMutation({
    mutationFn: async ({ orderId, status, notes }: { orderId: string; status: string; notes?: string }) => {
      const currentUser = (await supabase.auth.getUser()).data.user;
      const { error } = await supabase
        .from("orders")
        .update({
          id_verification_status: status,
          id_verification_notes: notes,
          id_verified_by: currentUser?.id,
          id_verified_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: (_, { orderId, status }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      logActivity("id_verification", "order", orderId, { 
        verification_status: status 
      }, {
        changedField: "id_verification_status",
        newValue: status,
        reason: status === "verified" ? "ID vérifié avec succès" : "ID rejeté"
      });
      toast({ title: status === "verified" ? "ID vérifié" : "ID rejeté" });
    },
    onError: () => {
      toast({ title: "Erreur", variant: "destructive" });
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

      const { error: orderError } = await supabase
        .from("orders")
        .update({
          technician_id: technicianId,
          audit_timeline: [...currentAudit, auditEntry],
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (orderError) throw orderError;

      // Create appointment for client if order has scheduled date
      if (order?.appointment_date) {
        await supabase.from("appointments").insert({
          client_id: order.user_id,
          client_email: order.client_email || order.profiles?.email,
          title: `Installation - ${order.service_type}`,
          description: `Installation par technicien Nivra pour commande ${order.order_number}`,
          scheduled_at: order.appointment_date,
          status: "scheduled",
        });
      }

      return { technicianName: technician?.full_name };
    },
    onSuccess: (data, { orderId, technicianId }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      const order = orders?.find((o: any) => o.id === orderId);
      logActivity("technician_assigned", "order", orderId, { 
        technician_id: technicianId,
        technician_name: data?.technicianName,
        order_number: order?.order_number
      }, {
        changedField: "technician",
        newValue: data?.technicianName,
        reason: "Technicien assigné à la commande"
      });
      toast({ 
        title: "Technicien assigné", 
        description: data?.technicianName ? `${data.technicianName} assigné à cette commande` : undefined 
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

  const handleViewDetails = (order: any) => {
    setSelectedOrder({ ...order });
    setEquipmentForm({
      terminal_count: order.terminal_count || 0,
      router_included: (order.router_fee || 0) > 0,
      serial_numbers: order.equipment_details?.serial_numbers || ["", "", "", ""],
      imei_numbers: order.equipment_details?.imei_numbers || ["", "", "", ""],
      inventory_refs: order.equipment_details?.inventory_refs || ["", "", "", ""],
    });
    setDetailsDialogOpen(true);
  };

  const handleSaveEquipment = () => {
    if (!selectedOrder) return;
    const equipmentDetails = {
      serial_numbers: equipmentForm.serial_numbers.filter(s => s),
      imei_numbers: equipmentForm.imei_numbers.filter(s => s),
      inventory_refs: equipmentForm.inventory_refs.filter(s => s),
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
      terminal_count: equipmentForm.terminal_count,
      terminal_fee: equipmentForm.terminal_count * TERMINAL_PRICE,
      router_fee: equipmentForm.router_included ? ROUTER_PRICE : 0,
    });
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
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="hero">
                  <Plus className="w-4 h-4 mr-2" />
                  Nouvelle commande
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Créer une commande</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Client</Label>
                    <Select value={newOrder.user_id} onValueChange={(v) => setNewOrder({ ...newOrder, user_id: v })}>
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
                    <Label>Type de service</Label>
                    <Input
                      value={newOrder.service_type}
                      onChange={(e) => setNewOrder({ ...newOrder, service_type: e.target.value })}
                      placeholder="Ex: Mobile, Internet..."
                    />
                  </div>
                  <div>
                    <Label>Montant</Label>
                    <Input
                      type="number"
                      value={newOrder.total_amount}
                      onChange={(e) => setNewOrder({ ...newOrder, total_amount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={newOrder.notes}
                      onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                      placeholder="Notes internes..."
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => createOrderMutation.mutate(newOrder)}
                    disabled={!newOrder.user_id || !newOrder.service_type}
                  >
                    Créer la commande
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
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
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Client</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Service</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Montant</th>
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
                          <p className="text-sm font-mono text-foreground">{order.order_number || `#${order.id.slice(0, 8)}`}</p>
                          {order.risk_flags && order.risk_flags.length > 0 && (
                            <AlertTriangle className="w-4 h-4 text-amber-500 inline ml-1" />
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm text-foreground">{order.profiles?.full_name || "N/A"}</p>
                          <p className="text-xs text-muted-foreground">{order.profiles?.email}</p>
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground">{order.service_type}</td>
                        <td className="py-3 px-4 text-sm text-foreground font-medium">
                          {order.total_amount ? `${Number(order.total_amount).toFixed(2)} $` : "—"}
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
                <Tabs defaultValue="details" className="w-full">
                  <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="details">Détails</TabsTrigger>
                    <TabsTrigger value="payment">Paiement</TabsTrigger>
                    <TabsTrigger value="identity">Identité</TabsTrigger>
                    <TabsTrigger value="equipment">Équipement</TabsTrigger>
                    <TabsTrigger value="tracking">Suivi</TabsTrigger>
                    <TabsTrigger value="audit">Audit</TabsTrigger>
                  </TabsList>

                  {/* Details Tab */}
                  <TabsContent value="details" className="space-y-4 mt-4">
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
                          onValueChange={(v) => setSelectedOrder({ ...selectedOrder, status: v })}
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
                          <p className="text-2xl font-bold">{Number(selectedOrder.total_amount || 0).toFixed(2)} $</p>
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

                        <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                          <div>
                            <Label className="text-xs text-muted-foreground">Type de pièce</Label>
                            <p className="font-medium">{selectedOrder.profiles?.id_type || "Non fourni"}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Numéro</Label>
                            <p className="font-medium font-mono">{selectedOrder.profiles?.id_number || "Non fourni"}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Date d'expiration</Label>
                            <p className="font-medium">
                              {selectedOrder.profiles?.id_expiration
                                ? format(new Date(selectedOrder.profiles.id_expiration), "d MMMM yyyy", { locale: fr })
                                : "Non fourni"}
                            </p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Province</Label>
                            <p className="font-medium">{selectedOrder.profiles?.id_province || "Non fourni"}</p>
                          </div>
                        </div>

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
                              Routeur Nivra Born ({ROUTER_PRICE}$)
                            </Label>
                          </div>
                        </div>

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

                  {/* Tracking Tab */}
                  <TabsContent value="tracking" className="space-y-4 mt-4">
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
                            <Label>Numéro de suivi</Label>
                            <Input
                              value={selectedOrder.tracking_number || ""}
                              onChange={(e) => setSelectedOrder({ ...selectedOrder, tracking_number: e.target.value })}
                              placeholder="Numéro de suivi..."
                            />
                          </div>
                          <div>
                            <Label>URL de suivi</Label>
                            <Input
                              value={selectedOrder.tracking_url || ""}
                              onChange={(e) => setSelectedOrder({ ...selectedOrder, tracking_url: e.target.value })}
                              placeholder="https://..."
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label>SIM</Label>
                            <Input
                              value={selectedOrder.sim_number || ""}
                              onChange={(e) => setSelectedOrder({ ...selectedOrder, sim_number: e.target.value })}
                              placeholder="Numéro SIM..."
                            />
                          </div>
                          <div>
                            <Label>IMEI</Label>
                            <Input
                              value={selectedOrder.imei_number || ""}
                              onChange={(e) => setSelectedOrder({ ...selectedOrder, imei_number: e.target.value })}
                              placeholder="IMEI..."
                            />
                          </div>
                          <div>
                            <Label>Numéro de série</Label>
                            <Input
                              value={selectedOrder.serial_number || ""}
                              onChange={(e) => setSelectedOrder({ ...selectedOrder, serial_number: e.target.value })}
                              placeholder="Série..."
                            />
                          </div>
                        </div>
                        <div>
                          <Label>ID équipement</Label>
                          <Input
                            value={selectedOrder.equipment_id || ""}
                            onChange={(e) => setSelectedOrder({ ...selectedOrder, equipment_id: e.target.value })}
                            placeholder="Référence équipement..."
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Audit Tab */}
                  <TabsContent value="audit" className="space-y-4 mt-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <History className="w-4 h-4" />
                          Historique des actions
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {selectedOrder.audit_timeline && selectedOrder.audit_timeline.length > 0 ? (
                          <div className="space-y-3">
                            {selectedOrder.audit_timeline.map((entry: any, i: number) => (
                              <div key={i} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{entry.action}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(entry.timestamp), "d MMM yyyy HH:mm", { locale: fr })}
                                  </p>
                                  {entry.details && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {JSON.stringify(entry.details)}
                                    </p>
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
                      </div>
                      <div className="p-3 bg-muted rounded-lg">
                        <p className="text-muted-foreground">Dernière mise à jour</p>
                        <p className="font-medium">
                          {format(new Date(selectedOrder.updated_at), "d MMMM yyyy HH:mm", { locale: fr })}
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Save Actions */}
                <div className="flex gap-2 pt-4 border-t mt-4">
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
                    Notifier le client
                  </Button>
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>

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
      </div>
    </AdminLayout>
  );
};

export default AdminOrders;
