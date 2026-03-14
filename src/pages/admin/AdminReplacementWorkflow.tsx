import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { useAuth } from "@/hooks/useAuth";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Package, 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Truck, 
  FileText,
  MessageSquare,
  RefreshCw,
  DollarSign,
  User,
  MapPin,
  Calendar,
  Edit,
  Trash2,
  Send,
  CreditCard,
  Wrench,
  Eye,
  Filter
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Types
interface ReplacementTicket {
  id: string;
  ticket_number: string;
  user_id: string;
  account_id: string;
  client_email: string;
  client_name: string;
  category: string;
  reason: string;
  reason_details: string;
  client_message: string;
  preferred_fulfillment: string;
  status: string;
  priority: string;
  internal_notes: string;
  assigned_to_id: string;
  assigned_to_name: string;
  created_at: string;
  updated_at: string;
}

interface InternalOrder {
  id: string;
  order_number: string;
  ticket_id: string;
  user_id: string;
  account_id: string;
  fulfillment_type: string;
  delivery_method: string;
  delivery_fee: number;
  installation_selected: boolean;
  installation_fee: number;
  technician_required: boolean;
  service_address: string;
  service_city: string;
  service_postal_code: string;
  items_subtotal: number;
  subtotal: number;
  tps_amount: number;
  tvq_amount: number;
  total_amount: number;
  is_quote: boolean;
  quote_approved_at: string;
  return_required: boolean;
  return_deadline: string;
  return_fee: number;
  status: string;
  invoice_id: string;
  invoice_number: string;
  payment_confirmed: boolean;
  payment_confirmed_at: string;
  payment_reference: string;
  notes_internal: string;
  created_by_role: string;
  created_by_name: string;
  created_at: string;
}

interface OrderItem {
  id: string;
  order_id: string;
  item_type: string;
  item_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  taxable: boolean;
  line_total: number;
  in_stock: boolean;
  backorder_eta: string;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  service_address: string;
  service_city: string;
  service_postal_code: string;
}

interface Technician {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
}

// Item presets
const ITEM_PRESETS = [
  { type: "sim", name: "Carte SIM Standard", price: 10 },
  { type: "sim", name: "Carte eSIM", price: 5 },
  { type: "router", name: "Nivra Born Wifi Router", price: 60 },
  { type: "terminal", name: "Nivra 4K Smart Terminal", price: 50 },
  { type: "phone", name: "Téléphone - Remplacement", price: 0 },
  { type: "accessory", name: "Câble HDMI 2m", price: 15 },
  { type: "accessory", name: "Télécommande universelle", price: 25 },
  { type: "accessory", name: "Câble Ethernet 3m", price: 12 },
];

const AdminReplacementWorkflow = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [activeTab, setActiveTab] = useState("queue");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<ReplacementTicket | null>(null);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [showShipmentDialog, setShowShipmentDialog] = useState(false);
  const [showTechnicianDialog, setShowTechnicianDialog] = useState(false);
  
  // Order form state
  const [orderItems, setOrderItems] = useState<Array<{
    item_type: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    taxable: boolean;
  }>>([]);
  const [deliveryMethod, setDeliveryMethod] = useState("standard");
  const [deliveryFee, setDeliveryFee] = useState(10);
  const [installationSelected, setInstallationSelected] = useState(false);
  const [installationFee, setInstallationFee] = useState(50);
  const [returnRequired, setReturnRequired] = useState(false);
  const [returnDeadline, setReturnDeadline] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [isQuote, setIsQuote] = useState(false);

  // Shipment form state
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");

  // Technician form state
  const [technicianId, setTechnicianId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  // Fetch admin profile
  const { data: adminProfile } = useQuery({
    queryKey: ["admin-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch replacement tickets
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ["admin-replacement-tickets", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("replacement_request_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as ReplacementTicket[];
    },
  });

  // Fetch internal orders for selected ticket
  const { data: internalOrder } = useQuery({
    queryKey: ["replacement-internal-order", selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket?.id) return null;
      const { data, error } = await supabase
        .from("replacement_internal_orders")
        .select("*")
        .eq("ticket_id", selectedTicket.id)
        .maybeSingle();
      if (error) throw error;
      return data as InternalOrder | null;
    },
    enabled: !!selectedTicket?.id,
  });

  // Fetch order items
  const { data: orderItemsData = [] } = useQuery({
    queryKey: ["replacement-order-items", internalOrder?.id],
    queryFn: async () => {
      if (!internalOrder?.id) return [];
      const { data, error } = await supabase
        .from("replacement_order_items")
        .select("*")
        .eq("order_id", internalOrder.id);
      if (error) throw error;
      return data as OrderItem[];
    },
    enabled: !!internalOrder?.id,
  });

  // Fetch technicians
  const { data: technicians = [] } = useQuery<Technician[]>({
    queryKey: ["technicians-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technicians")
        .select("id, full_name, email, phone, status")
        .eq("status", "active");
      if (error) throw error;
      return (data || []) as Technician[];
    },
  });

  // Fetch client profile for selected ticket
  const { data: clientProfile } = useQuery({
    queryKey: ["client-profile", selectedTicket?.user_id],
    queryFn: async () => {
      if (!selectedTicket?.user_id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", selectedTicket.user_id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
    enabled: !!selectedTicket?.user_id,
  });

  // Create internal order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTicket || !user?.id) throw new Error("No ticket selected");
      
      const itemsSubtotal = orderItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const subtotal = itemsSubtotal + deliveryFee + (installationSelected ? installationFee : 0);
      const tpsAmount = Math.round(subtotal * 0.05 * 100) / 100;
      const tvqAmount = Math.round(subtotal * 0.09975 * 100) / 100;
      const totalAmount = subtotal + tpsAmount + tvqAmount;

      const fulfillmentType = installationSelected ? "technician" : "ship";

      // Create the internal order
      const { data: orderData, error: orderError } = await supabase
        .from("replacement_internal_orders")
        .insert({
          ticket_id: selectedTicket.id,
          user_id: selectedTicket.user_id,
          account_id: selectedTicket.account_id,
          fulfillment_type: fulfillmentType,
          delivery_method: deliveryMethod,
          delivery_fee: deliveryFee,
          installation_selected: installationSelected,
          installation_fee: installationSelected ? installationFee : 0,
          technician_required: installationSelected,
          service_address: clientProfile?.service_address || "",
          service_city: clientProfile?.service_city || "",
          service_postal_code: clientProfile?.service_postal_code || "",
          items_subtotal: itemsSubtotal,
          subtotal: subtotal,
          tps_amount: tpsAmount,
          tvq_amount: tvqAmount,
          total_amount: totalAmount,
          is_quote: isQuote,
          return_required: returnRequired,
          return_deadline: returnDeadline || null,
          status: isQuote ? "quoted" : "draft",
          notes_internal: internalNotes,
          created_by_role: "admin",
          created_by_id: user.id,
          created_by_name: adminProfile?.full_name || "Admin",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      if (orderItems.length > 0) {
        const items = orderItems.map(item => ({
          order_id: orderData.id,
          item_type: item.item_type,
          item_name: item.item_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          taxable: item.taxable,
          line_total: item.quantity * item.unit_price,
        }));

        const { error: itemsError } = await supabase
          .from("replacement_order_items")
          .insert(items);
        
        if (itemsError) throw itemsError;
      }

      // Update ticket status
      await supabase
        .from("replacement_request_tickets")
        .update({ status: isQuote ? "quote_sent" : "needs_quote" })
        .eq("id", selectedTicket.id);

      // Add timeline event
      await supabase.from("replacement_timeline").insert({
        ticket_id: selectedTicket.id,
        order_id: orderData.id,
        event_type: "order_created",
        event_title: isQuote ? "Devis créé" : "Commande interne créée",
        event_description: `Commande ${orderData.order_number} - Total: $${totalAmount.toFixed(2)}`,
        visible_to_client: isQuote,
        actor_id: user.id,
        actor_name: adminProfile?.full_name || "Admin",
        actor_role: "admin",
      });

      return orderData;
    },
    onSuccess: () => {
      toast.success("Commande interne créée avec succès!");
      setShowOrderDialog(false);
      resetOrderForm();
      queryClient.invalidateQueries({ queryKey: ["admin-replacement-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["replacement-internal-order"] });
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  // Generate invoice mutation — CANONICAL Core path (billing_invoices + billing_invoice_lines)
  const generateInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!internalOrder || !selectedTicket) throw new Error("No order found");

      // Resolve billing_customer by user_id
      const { data: billingCustomer, error: custErr } = await supabase
        .from("billing_customers")
        .select("id")
        .eq("user_id", selectedTicket.user_id)
        .maybeSingle();
      if (custErr) throw custErr;
      if (!billingCustomer) throw new Error("Aucun client de facturation trouvé pour cet utilisateur. Créez-le d'abord via une commande Core.");

      // Generate invoice number
      const invoiceNumber = `REPL-${Date.now().toString(36).toUpperCase()}`;

      const now = new Date().toISOString();
      const cycleEnd = new Date(Date.now() + 30 * 86400000).toISOString();

      // Create canonical billing_invoices record
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("billing_invoices")
        .insert({
          customer_id: billingCustomer.id,
          invoice_number: invoiceNumber,
          type: "adjustment" as const,
          subtotal: internalOrder.subtotal,
          tps_amount: internalOrder.tps_amount,
          tvq_amount: internalOrder.tvq_amount,
          total: internalOrder.total_amount,
          currency: "CAD",
          payment_method: "interac" as const,
          status: "pending" as const,
          cycle_start_date: now.split("T")[0],
          cycle_end_date: cycleEnd.split("T")[0],
          due_date: cycleEnd.split("T")[0],
          notes: `Remplacement - ${selectedTicket.ticket_number}`,
          environment: "production",
          fees: (internalOrder.delivery_fee || 0) + (internalOrder.installation_fee || 0),
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice line items from internal order items
      const { data: orderItems } = await supabase
        .from("replacement_order_items")
        .select("*")
        .eq("order_id", internalOrder.id);

      if (orderItems && orderItems.length > 0) {
        const lines = orderItems.map((item: any) => ({
          invoice_id: invoiceData.id,
          description: item.item_name,
          unit_price: item.unit_price,
          quantity: item.quantity,
          line_total: item.line_total,
          line_type: "equipment",
        }));
        await supabase.from("billing_invoice_lines").insert(lines);
      }

      // Update internal order with invoice info
      await supabase
        .from("replacement_internal_orders")
        .update({
          invoice_id: invoiceData.id,
          invoice_number: invoiceData.invoice_number,
          invoice_status: "pending",
          status: "invoiced",
        })
        .eq("id", internalOrder.id);

      // Update ticket status
      await supabase
        .from("replacement_request_tickets")
        .update({ status: "invoiced" })
        .eq("id", selectedTicket.id);

      // Add timeline event
      await supabase.from("replacement_timeline").insert({
        ticket_id: selectedTicket.id,
        order_id: internalOrder.id,
        event_type: "invoice_issued",
        event_title: "Facture émise",
        event_description: `Facture ${invoiceData.invoice_number} - $${internalOrder.total_amount.toFixed(2)}`,
        visible_to_client: true,
        actor_id: user?.id,
        actor_name: adminProfile?.full_name || "Admin",
        actor_role: "admin",
      });

      return invoiceData;
    },
    onSuccess: () => {
      toast.success("Facture générée et envoyée au client!");
      queryClient.invalidateQueries({ queryKey: ["replacement-internal-order"] });
      queryClient.invalidateQueries({ queryKey: ["admin-replacement-tickets"] });
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  // Mark paid mutation — CANONICAL Core path (billing_payments + billing_invoices)
  const markPaidMutation = useMutation({
    mutationFn: async (paymentRef: string) => {
      if (!internalOrder || !selectedTicket) throw new Error("No order found");

      // Update canonical billing_invoices to paid
      if (internalOrder.invoice_id) {
        // Resolve billing_customer
        const { data: billingCustomer } = await supabase
          .from("billing_customers")
          .select("id")
          .eq("user_id", selectedTicket.user_id)
          .maybeSingle();

        const customerId = billingCustomer?.id;
        if (!customerId) throw new Error("Client de facturation introuvable");

        const now = new Date().toISOString();

        // Create canonical payment record
        const paymentNumber = `RPAY-${Date.now().toString(36).toUpperCase()}`;
        await supabase
          .from("billing_payments")
          .insert({
            invoice_id: internalOrder.invoice_id,
            customer_id: customerId,
            payment_number: paymentNumber,
            amount: internalOrder.total_amount,
            method: "interac" as const,
            status: "confirmed" as const,
            reference: paymentRef,
            provider: "manual",
            provider_payment_id: paymentRef,
            source: "admin",
            received_at: now,
            confirmed_by: user?.id || null,
            created_by_id: user?.id || null,
            created_by_name: adminProfile?.full_name || "Admin",
            created_by_role: "admin",
            environment: "production",
          });

        // Mark invoice as paid
        await supabase
          .from("billing_invoices")
          .update({
            status: "paid" as const,
            paid_at: now,
            amount_paid: internalOrder.total_amount,
            balance_due: 0,
          })
          .eq("id", internalOrder.invoice_id);
      }

      // Update internal order
      await supabase
        .from("replacement_internal_orders")
        .update({
          payment_confirmed: true,
          payment_confirmed_at: new Date().toISOString(),
          payment_confirmed_by: user?.id || null,
          payment_reference: paymentRef,
          invoice_status: "paid",
          status: "ready_to_fulfill",
        })
        .eq("id", internalOrder.id);

      // Update ticket
      await supabase
        .from("replacement_request_tickets")
        .update({ status: "paid" })
        .eq("id", selectedTicket.id);

      // Add timeline event
      await supabase.from("replacement_timeline").insert({
        ticket_id: selectedTicket.id,
        order_id: internalOrder.id,
        event_type: "payment_received",
        event_title: "Paiement reçu",
        event_description: `Référence: ${paymentRef}`,
        visible_to_client: true,
        actor_id: user?.id,
        actor_name: adminProfile?.full_name || "Admin",
        actor_role: "admin",
      });
    },
    onSuccess: () => {
      toast.success("Paiement confirmé! Prêt pour expédition.");
      queryClient.invalidateQueries({ queryKey: ["replacement-internal-order"] });
      queryClient.invalidateQueries({ queryKey: ["admin-replacement-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["admin-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["admin-payments-v2"] });
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  // Create shipment mutation
  const createShipmentMutation = useMutation({
    mutationFn: async () => {
      if (!internalOrder || !selectedTicket) throw new Error("No order found");

      const { data: shipmentData, error: shipmentError } = await supabase
        .from("replacement_shipments")
        .insert({
          order_id: internalOrder.id,
          ticket_id: selectedTicket.id,
          carrier,
          tracking_number: trackingNumber,
          tracking_url: trackingUrl,
          shipped_at: new Date().toISOString(),
          status: "shipped",
          shipped_by_id: user?.id,
          shipped_by_name: adminProfile?.full_name || "Admin",
        })
        .select()
        .single();

      if (shipmentError) throw shipmentError;

      // Update order status
      await supabase
        .from("replacement_internal_orders")
        .update({ status: "shipped" })
        .eq("id", internalOrder.id);

      // Update ticket
      await supabase
        .from("replacement_request_tickets")
        .update({ status: "fulfillment_in_progress" })
        .eq("id", selectedTicket.id);

      // Add timeline event
      await supabase.from("replacement_timeline").insert({
        ticket_id: selectedTicket.id,
        order_id: internalOrder.id,
        event_type: "shipped",
        event_title: "Colis expédié",
        event_description: `${carrier} - ${trackingNumber}`,
        visible_to_client: true,
        actor_id: user?.id,
        actor_name: adminProfile?.full_name || "Admin",
        actor_role: "admin",
      });

      return shipmentData;
    },
    onSuccess: () => {
      toast.success("Expédition créée!");
      setShowShipmentDialog(false);
      setCarrier("");
      setTrackingNumber("");
      setTrackingUrl("");
      queryClient.invalidateQueries({ queryKey: ["replacement-internal-order"] });
      queryClient.invalidateQueries({ queryKey: ["admin-replacement-tickets"] });
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  // Dispatch technician mutation
  const dispatchTechnicianMutation = useMutation({
    mutationFn: async () => {
      if (!internalOrder || !selectedTicket || !technicianId) throw new Error("Missing data");

      const selectedTech = technicians.find(t => t.id === technicianId);
      
      // Create work order
      const { data: workOrderData, error: workOrderError } = await supabase
        .from("work_orders")
        .insert({
          linked_order_id: null,
          replacement_order_id: internalOrder.id,
          replacement_ticket_id: selectedTicket.id,
          assigned_technician_id: technicianId,
          client_email: selectedTicket.client_email,
          client_name: selectedTicket.client_name,
          service_address: internalOrder.service_address,
          service_city: internalOrder.service_city,
          service_postal_code: internalOrder.service_postal_code,
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime,
          service_type: "Remplacement/Installation",
          status: "assigned",
          notes: `Remplacement - ${selectedTicket.ticket_number}`,
          created_by_role: "admin",
          created_by_id: user?.id,
        })
        .select()
        .single();

      if (workOrderError) throw workOrderError;

      // Update order status
      await supabase
        .from("replacement_internal_orders")
        .update({ status: "tech_dispatched" })
        .eq("id", internalOrder.id);

      // Update ticket
      await supabase
        .from("replacement_request_tickets")
        .update({ status: "fulfillment_in_progress" })
        .eq("id", selectedTicket.id);

      // Add timeline event
      await supabase.from("replacement_timeline").insert({
        ticket_id: selectedTicket.id,
        order_id: internalOrder.id,
        event_type: "technician_dispatched",
        event_title: "Technicien assigné",
        event_description: `${selectedTech?.full_name || "Technicien"} - ${scheduledDate} ${scheduledTime}`,
        visible_to_client: true,
        actor_id: user?.id,
        actor_name: adminProfile?.full_name || "Admin",
        actor_role: "admin",
      });

      return workOrderData;
    },
    onSuccess: () => {
      toast.success("Technicien assigné!");
      setShowTechnicianDialog(false);
      setTechnicianId("");
      setScheduledDate("");
      setScheduledTime("");
      queryClient.invalidateQueries({ queryKey: ["replacement-internal-order"] });
      queryClient.invalidateQueries({ queryKey: ["admin-replacement-tickets"] });
    },
    onError: (error: any) => {
      toast.error("Erreur: " + error.message);
    },
  });

  const resetOrderForm = () => {
    setOrderItems([]);
    setDeliveryMethod("standard");
    setDeliveryFee(10);
    setInstallationSelected(false);
    setInstallationFee(50);
    setReturnRequired(false);
    setReturnDeadline("");
    setInternalNotes("");
    setIsQuote(false);
  };

  const addItemFromPreset = (preset: typeof ITEM_PRESETS[0]) => {
    setOrderItems([...orderItems, {
      item_type: preset.type,
      item_name: preset.name,
      quantity: 1,
      unit_price: preset.price,
      taxable: true,
    }]);
  };

  const removeItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const updateItemQuantity = (index: number, qty: number) => {
    const updated = [...orderItems];
    updated[index].quantity = qty;
    setOrderItems(updated);
  };

  const updateItemPrice = (index: number, price: number) => {
    const updated = [...orderItems];
    updated[index].unit_price = price;
    setOrderItems(updated);
  };

  const calculateTotals = () => {
    const itemsSubtotal = orderItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const subtotal = itemsSubtotal + deliveryFee + (installationSelected ? installationFee : 0);
    const tps = Math.round(subtotal * 0.05 * 100) / 100;
    const tvq = Math.round(subtotal * 0.09975 * 100) / 100;
    const total = subtotal + tps + tvq;
    return { itemsSubtotal, subtotal, tps, tvq, total };
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; label: string }> = {
      open: { color: "bg-blue-500", label: "Ouvert" },
      needs_quote: { color: "bg-yellow-500", label: "Devis requis" },
      quote_sent: { color: "bg-purple-500", label: "Devis envoyé" },
      invoiced: { color: "bg-orange-500", label: "Facturé" },
      awaiting_payment: { color: "bg-amber-500", label: "Attente paiement" },
      paid: { color: "bg-green-500", label: "Payé" },
      fulfillment_in_progress: { color: "bg-cyan-500", label: "En cours" },
      completed: { color: "bg-emerald-500", label: "Terminé" },
      cancelled: { color: "bg-red-500", label: "Annulé" },
    };
    const c = config[status] || { color: "bg-gray-500", label: status };
    return <Badge className={c.color}>{c.label}</Badge>;
  };

  const totals = calculateTotals();

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <RefreshCw className="h-8 w-8 text-primary" />
              Workflow Remplacement
            </h1>
            <p className="text-muted-foreground mt-1">
              Gérez les demandes de remplacement et accessoires
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="open">Ouverts</SelectItem>
                <SelectItem value="needs_quote">Devis requis</SelectItem>
                <SelectItem value="invoiced">Facturés</SelectItem>
                <SelectItem value="paid">Payés</SelectItem>
                <SelectItem value="fulfillment_in_progress">En cours</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Ticket Queue */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">File d'attente</CardTitle>
                <CardDescription>{tickets.length} demande(s)</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <div className="space-y-2 p-4">
                    {ticketsLoading ? (
                      <p className="text-center text-muted-foreground py-8">Chargement...</p>
                    ) : tickets.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">Aucune demande</p>
                    ) : (
                      tickets.map(ticket => (
                        <div
                          key={ticket.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            selectedTicket?.id === ticket.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                          onClick={() => setSelectedTicket(ticket)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <span className="font-medium text-sm">{ticket.ticket_number}</span>
                            {getStatusBadge(ticket.status)}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{ticket.client_name || ticket.client_email}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {ticket.category} • {ticket.reason}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(ticket.created_at), "d MMM yyyy HH:mm")}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Ticket Details & Actions */}
          <div className="lg:col-span-2">
            {selectedTicket ? (
              <div className="space-y-4">
                {/* Ticket Info Card */}
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {selectedTicket.ticket_number}
                          {getStatusBadge(selectedTicket.status)}
                          {selectedTicket.priority === "urgent" && (
                            <Badge variant="destructive">URGENT</Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          Créé le {format(new Date(selectedTicket.created_at), "d MMMM yyyy à HH:mm", { locale: fr })}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Client Info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" /> Client
                        </p>
                        <p className="font-medium">{selectedTicket.client_name || "N/A"}</p>
                        <p className="text-sm">{selectedTicket.client_email}</p>
                      </div>
                      {clientProfile && (
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> Adresse
                          </p>
                          <p className="text-sm">
                            {clientProfile.service_address}<br />
                            {clientProfile.service_city}, {clientProfile.service_postal_code}
                          </p>
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Request Details */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Catégorie</p>
                        <p className="font-medium capitalize">{selectedTicket.category}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Raison</p>
                        <p className="font-medium capitalize">{selectedTicket.reason}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Livraison préférée</p>
                        <p className="font-medium capitalize">{selectedTicket.preferred_fulfillment}</p>
                      </div>
                    </div>

                    {selectedTicket.reason_details && (
                      <div>
                        <p className="text-sm text-muted-foreground">Détails</p>
                        <p className="text-sm bg-muted rounded p-2 mt-1">{selectedTicket.reason_details}</p>
                      </div>
                    )}

                    {selectedTicket.client_message && (
                      <div>
                        <p className="text-sm text-muted-foreground">Message du client</p>
                        <p className="text-sm bg-muted rounded p-2 mt-1">{selectedTicket.client_message}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Internal Order Card */}
                {internalOrder ? (
                  <Card className="border-amber-500/50">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Package className="h-5 w-5" />
                        Commande interne: {internalOrder.order_number}
                        {getStatusBadge(internalOrder.status)}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Items */}
                      <div>
                        <p className="text-sm font-medium mb-2">Articles</p>
                        <div className="space-y-1">
                          {orderItemsData.map(item => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span>{item.quantity}x {item.item_name}</span>
                              <span>${item.line_total.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <Separator />

                      {/* Totals */}
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Sous-total articles</span>
                          <span>${internalOrder.items_subtotal.toFixed(2)}</span>
                        </div>
                        {internalOrder.delivery_fee > 0 && (
                          <div className="flex justify-between">
                            <span>Livraison</span>
                            <span>${internalOrder.delivery_fee.toFixed(2)}</span>
                          </div>
                        )}
                        {internalOrder.installation_fee > 0 && (
                          <div className="flex justify-between">
                            <span>Installation</span>
                            <span>${internalOrder.installation_fee.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-muted-foreground">
                          <span>TPS (5%)</span>
                          <span>${internalOrder.tps_amount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>TVQ (9.975%)</span>
                          <span>${internalOrder.tvq_amount.toFixed(2)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-bold text-lg">
                          <span>Total</span>
                          <span>${internalOrder.total_amount.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Invoice & Payment Status */}
                      {internalOrder.invoice_number && (
                        <div className="bg-muted rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">Facture: {internalOrder.invoice_number}</p>
                              <p className="text-sm text-muted-foreground">
                                Statut: {internalOrder.payment_confirmed ? "Payé" : "En attente"}
                              </p>
                            </div>
                            {internalOrder.payment_confirmed && (
                              <Badge className="bg-green-500">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Payé
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Internal Notes */}
                      {internalOrder.notes_internal && (
                        <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/30">
                          <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">
                            Notes internes (non visibles au client)
                          </p>
                          <p className="text-sm">{internalOrder.notes_internal}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center">
                      <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                      <p className="text-muted-foreground mb-4">Aucune commande interne créée</p>
                      <Button onClick={() => setShowOrderDialog(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Créer commande interne
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Action Buttons */}
                <Card>
                  <CardContent className="py-4">
                    <div className="flex flex-wrap gap-2">
                      {!internalOrder && (
                        <Button onClick={() => setShowOrderDialog(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Créer commande
                        </Button>
                      )}

                      {internalOrder && !internalOrder.invoice_id && (
                        <Button 
                          onClick={() => generateInvoiceMutation.mutate()}
                          disabled={generateInvoiceMutation.isPending}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Générer facture
                        </Button>
                      )}

                      {internalOrder?.invoice_id && !internalOrder.payment_confirmed && (
                        <Button 
                          onClick={() => {
                            const ref = prompt("Référence de paiement:");
                            if (ref) markPaidMutation.mutate(ref);
                          }}
                          disabled={markPaidMutation.isPending}
                        >
                          <DollarSign className="h-4 w-4 mr-2" />
                          Marquer payé
                        </Button>
                      )}

                      {internalOrder?.payment_confirmed && internalOrder.fulfillment_type === "ship" && internalOrder.status === "ready_to_fulfill" && (
                        <Button 
                          onClick={() => setShowShipmentDialog(true)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Truck className="h-4 w-4 mr-2" />
                          Créer expédition
                        </Button>
                      )}

                      {internalOrder?.payment_confirmed && internalOrder.fulfillment_type === "technician" && internalOrder.status === "ready_to_fulfill" && (
                        <Button 
                          onClick={() => setShowTechnicianDialog(true)}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          <Wrench className="h-4 w-4 mr-2" />
                          Assigner technicien
                        </Button>
                      )}

                      <Button variant="outline">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Message client
                      </Button>
                    </div>

                    {/* Payment gating warning */}
                    {internalOrder && !internalOrder.payment_confirmed && (
                      <div className="mt-4 p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                        <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          Expédition/Technicien désactivé jusqu'à confirmation du paiement
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="py-16 text-center">
                  <Eye className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                  <h3 className="text-lg font-medium mb-2">Sélectionnez une demande</h3>
                  <p className="text-muted-foreground">
                    Cliquez sur une demande dans la file d'attente pour voir les détails
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Create Order Dialog */}
      <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer commande interne</DialogTitle>
            <DialogDescription>
              Ticket: {selectedTicket?.ticket_number}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Item Selection */}
            <div>
              <Label className="mb-2 block">Ajouter articles</Label>
              <div className="flex flex-wrap gap-2">
                {ITEM_PRESETS.map((preset, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => addItemFromPreset(preset)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {preset.name} (${preset.price})
                  </Button>
                ))}
              </div>
            </div>

            {/* Selected Items */}
            {orderItems.length > 0 && (
              <div className="space-y-2">
                <Label>Articles sélectionnés</Label>
                {orderItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                    <span className="flex-1">{item.item_name}</span>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                      className="w-16"
                      min={1}
                    />
                    <span>×</span>
                    <Input
                      type="number"
                      value={item.unit_price}
                      onChange={(e) => updateItemPrice(index, parseFloat(e.target.value) || 0)}
                      className="w-20"
                      step={0.01}
                    />
                    <span className="w-20 text-right">${(item.quantity * item.unit_price).toFixed(2)}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeItem(index)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Delivery Options */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Méthode de livraison</Label>
                <Select value={deliveryMethod} onValueChange={setDeliveryMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard ($10)</SelectItem>
                    <SelectItem value="express">Express ($25)</SelectItem>
                    <SelectItem value="pickup">Ramassage ($0)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Frais de livraison ($)</Label>
                <Input
                  type="number"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Installation */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="installation"
                  checked={installationSelected}
                  onCheckedChange={(checked) => setInstallationSelected(checked as boolean)}
                />
                <Label htmlFor="installation">Installation par technicien</Label>
              </div>
              {installationSelected && (
                <div className="flex items-center gap-2">
                  <Label>Frais:</Label>
                  <Input
                    type="number"
                    value={installationFee}
                    onChange={(e) => setInstallationFee(parseFloat(e.target.value) || 0)}
                    className="w-24"
                  />
                </div>
              )}
            </div>

            {/* Return Required */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="return"
                  checked={returnRequired}
                  onCheckedChange={(checked) => setReturnRequired(checked as boolean)}
                />
                <Label htmlFor="return">Retour équipement requis</Label>
              </div>
              {returnRequired && (
                <div className="flex items-center gap-2">
                  <Label>Deadline:</Label>
                  <Input
                    type="date"
                    value={returnDeadline}
                    onChange={(e) => setReturnDeadline(e.target.value)}
                    className="w-40"
                  />
                </div>
              )}
            </div>

            {/* Quote Mode */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="quote"
                checked={isQuote}
                onCheckedChange={(checked) => setIsQuote(checked as boolean)}
              />
              <Label htmlFor="quote">Envoyer comme devis (client doit approuver)</Label>
            </div>

            {/* Internal Notes */}
            <div>
              <Label>Notes internes (non visibles au client)</Label>
              <Textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Notes pour l'équipe interne..."
                rows={3}
              />
            </div>

            {/* Totals Summary */}
            <div className="bg-muted rounded-lg p-4 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Sous-total articles</span>
                <span>${totals.itemsSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Livraison</span>
                <span>${deliveryFee.toFixed(2)}</span>
              </div>
              {installationSelected && (
                <div className="flex justify-between">
                  <span>Installation</span>
                  <span>${installationFee.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>TPS (5%)</span>
                <span>${totals.tps.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>TVQ (9.975%)</span>
                <span>${totals.tvq.toFixed(2)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>${totals.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrderDialog(false)}>
              Annuler
            </Button>
            <Button 
              onClick={() => createOrderMutation.mutate()}
              disabled={orderItems.length === 0 || createOrderMutation.isPending}
            >
              {createOrderMutation.isPending ? "Création..." : "Créer commande"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shipment Dialog */}
      <Dialog open={showShipmentDialog} onOpenChange={setShowShipmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer expédition</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Transporteur</Label>
              <Select value={carrier} onValueChange={setCarrier}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Postes Canada">Postes Canada</SelectItem>
                  <SelectItem value="Purolator">Purolator</SelectItem>
                  <SelectItem value="FedEx">FedEx</SelectItem>
                  <SelectItem value="UPS">UPS</SelectItem>
                  <SelectItem value="Autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Numéro de suivi</Label>
              <Input
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Ex: 1234567890"
              />
            </div>
            <div>
              <Label>URL de suivi (optionnel)</Label>
              <Input
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShipmentDialog(false)}>
              Annuler
            </Button>
            <Button 
              onClick={() => createShipmentMutation.mutate()}
              disabled={!carrier || !trackingNumber || createShipmentMutation.isPending}
            >
              {createShipmentMutation.isPending ? "Création..." : "Créer expédition"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Technician Dispatch Dialog */}
      <Dialog open={showTechnicianDialog} onOpenChange={setShowTechnicianDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assigner technicien</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Technicien</Label>
              <Select value={technicianId} onValueChange={setTechnicianId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un technicien" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map(tech => (
                    <SelectItem key={tech.id} value={tech.id}>
                      {tech.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Heure</Label>
              <Select value={scheduledTime} onValueChange={setScheduledTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="8h - 12h">8h - 12h (Matin)</SelectItem>
                  <SelectItem value="12h - 17h">12h - 17h (Après-midi)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTechnicianDialog(false)}>
              Annuler
            </Button>
            <Button 
              onClick={() => dispatchTechnicianMutation.mutate()}
              disabled={!technicianId || !scheduledDate || !scheduledTime || dispatchTechnicianMutation.isPending}
            >
              {dispatchTechnicianMutation.isPending ? "Assignation..." : "Assigner technicien"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminReplacementWorkflow;
