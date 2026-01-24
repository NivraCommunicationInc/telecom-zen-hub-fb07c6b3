import { useState, useMemo } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { useAuth } from "@/hooks/useAuth";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useRoleAccess } from "@/hooks/useRoleAccess";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  RefreshCw,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  AlertTriangle,
  ArrowLeft,
  Search,
  FileText,
  DollarSign,
  Shield,
  Send,
  Plus,
  Minus,
} from "lucide-react";

const reasonLabels: Record<string, string> = {
  defective: "Défectueux",
  damaged: "Endommagé",
  lost: "Perdu",
  theft: "Volé",
  malfunction: "Dysfonctionnement",
  upgrade: "Mise à niveau",
  other: "Autre",
};

const ticketStatusConfig: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: "Ouvert", color: "bg-cyan-500/20 text-cyan-400", icon: Clock },
  awaiting_decision: { label: "En attente", color: "bg-amber-500/20 text-amber-500", icon: Clock },
  approved_warranty: { label: "Garantie approuvée", color: "bg-emerald-500/20 text-emerald-400", icon: Shield },
  approved_paid: { label: "Facturable", color: "bg-orange-500/20 text-orange-400", icon: DollarSign },
  processing: { label: "En traitement", color: "bg-blue-500/20 text-blue-400", icon: RefreshCw },
  shipped: { label: "Expédié", color: "bg-purple-500/20 text-purple-400", icon: Truck },
  closed: { label: "Fermé", color: "bg-muted text-muted-foreground", icon: CheckCircle2 },
  cancelled: { label: "Annulé", color: "bg-red-500/20 text-red-400", icon: XCircle },
};

const orderStatusConfig: Record<string, { label: string; color: string }> = {
  awaiting_decision: { label: "En attente de décision", color: "bg-slate-500/20 text-slate-400" },
  awaiting_payment: { label: "En attente de paiement", color: "bg-orange-500/20 text-orange-400" },
  ready_to_ship: { label: "Prêt à expédier", color: "bg-blue-500/20 text-blue-400" },
  shipped: { label: "Expédié", color: "bg-purple-500/20 text-purple-400" },
  delivered: { label: "Livré", color: "bg-emerald-500/20 text-emerald-400" },
  cancelled: { label: "Annulé", color: "bg-red-500/20 text-red-400" },
  closed: { label: "Fermé", color: "bg-muted text-muted-foreground" },
};

const AdminReplacements = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const { isAdmin, isEmployee } = useRoleAccess();

  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("details");
  
  // Create order dialog state
  const [createOrderDialogOpen, setCreateOrderDialogOpen] = useState(false);
  const [orderType, setOrderType] = useState<"warranty_replacement" | "paid_replacement">("paid_replacement");
  const [equipmentItems, setEquipmentItems] = useState<Array<{ name: string; sku: string; quantity: number; price: number }>>([
    { name: "", sku: "", quantity: 1, price: 0 }
  ]);
  const [deliveryFee, setDeliveryFee] = useState(30);
  const [adminFee, setAdminFee] = useState(0);
  const [returnRequired, setReturnRequired] = useState(false);
  const [returnDeadline, setReturnDeadline] = useState("");
  const [shippingMethod, setShippingMethod] = useState("standard");
  const [internalNotes, setInternalNotes] = useState("");

  // Shipping dialog state
  const [shippingDialogOpen, setShippingDialogOpen] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");

  // Fetch all replacement tickets with profiles
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["admin-replacement-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("replacement_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch profiles
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((t: any) => t.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, email, full_name, phone, client_number")
          .in("user_id", userIds);

        return data.map((ticket: any) => ({
          ...ticket,
          profile: profiles?.find((p: any) => p.user_id === ticket.user_id) || null,
        }));
      }
      return data || [];
    },
  });

  // Fetch replacement order for selected ticket
  const { data: replacementOrder, refetch: refetchOrder } = useQuery({
    queryKey: ["admin-replacement-order", selectedTicket?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("replacement_orders")
        .select("*")
        .eq("replacement_ticket_id", selectedTicket?.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTicket?.id,
  });

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    if (!tickets) return [];
    return tickets.filter((ticket: any) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          ticket.ticket_number?.toLowerCase().includes(query) ||
          ticket.equipment_name?.toLowerCase().includes(query) ||
          ticket.linked_order_number?.toLowerCase().includes(query) ||
          ticket.profile?.full_name?.toLowerCase().includes(query) ||
          ticket.profile?.email?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      if (statusFilter !== "all" && ticket.status !== statusFilter) return false;
      return true;
    });
  }, [tickets, searchQuery, statusFilter]);

  // Update ticket status
  const updateTicketMutation = useMutation({
    mutationFn: async ({ ticketId, status, notes }: { ticketId: string; status: string; notes?: string }) => {
      const updateData: any = { status, updated_at: new Date().toISOString() };
      if (notes) updateData.internal_notes = notes;
      
      const { error } = await supabase
        .from("replacement_tickets")
        .update(updateData)
        .eq("id", ticketId);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-replacement-tickets"] });
      logActivity("update", "replacement_ticket", variables.ticketId, { status: variables.status });
      toast({ title: "Ticket mis à jour" });
    },
  });

  // Create replacement order
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const equipmentTotal = equipmentItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      const { data, error } = await supabase
        .from("replacement_orders")
        .insert({
          replacement_ticket_id: selectedTicket.id,
          original_order_id: selectedTicket.linked_order_id,
          original_order_number: selectedTicket.linked_order_number,
          user_id: selectedTicket.user_id,
          client_email: selectedTicket.client_email,
          order_type: orderType,
          equipment_items: equipmentItems,
          equipment_total: equipmentTotal,
          delivery_fee: orderType === "warranty_replacement" ? 0 : deliveryFee,
          admin_fee: orderType === "warranty_replacement" ? 0 : adminFee,
          return_required: returnRequired,
          return_deadline: returnDeadline || null,
          shipping_method: shippingMethod,
          shipping_address: selectedTicket.preferred_address,
          shipping_city: selectedTicket.preferred_city,
          shipping_postal_code: selectedTicket.preferred_postal_code,
          status: orderType === "warranty_replacement" ? "ready_to_ship" : "awaiting_payment",
          internal_notes: internalNotes,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;

      // Update ticket status
      await supabase
        .from("replacement_tickets")
        .update({ 
          status: orderType === "warranty_replacement" ? "approved_warranty" : "approved_paid",
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedTicket.id);

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-replacement-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["admin-replacement-order"] });
      logActivity("create", "replacement_order", data.id, { 
        order_type: orderType, 
        ticket_id: selectedTicket.id 
      });
      toast({ title: "Commande de remplacement créée" });
      setCreateOrderDialogOpen(false);
      resetOrderForm();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de créer la commande", variant: "destructive" });
    },
  });

  // Confirm payment
  const confirmPaymentMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("replacement_orders")
        .update({
          payment_confirmed: true,
          payment_confirmed_at: new Date().toISOString(),
          payment_confirmed_by: user?.id,
          invoice_status: "paid",
          status: "ready_to_ship",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchOrder();
      queryClient.invalidateQueries({ queryKey: ["admin-replacement-tickets"] });
      logActivity("update", "replacement_order", replacementOrder?.id, { action: "payment_confirmed" });
      toast({ title: "Paiement confirmé", description: "La commande est prête à être expédiée" });
    },
  });

  // Create shipment
  const createShipmentMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("replacement_orders")
        .update({
          status: "shipped",
          tracking_number: trackingNumber,
          tracking_url: trackingUrl || null,
          shipped_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", replacementOrder?.id);
      if (error) throw error;

      // Update ticket status
      await supabase
        .from("replacement_tickets")
        .update({ status: "shipped", updated_at: new Date().toISOString() })
        .eq("id", selectedTicket.id);
    },
    onSuccess: () => {
      refetchOrder();
      queryClient.invalidateQueries({ queryKey: ["admin-replacement-tickets"] });
      logActivity("update", "replacement_order", replacementOrder?.id, { 
        action: "shipped", 
        tracking_number: trackingNumber 
      });
      toast({ title: "Expédition créée", description: "Le client sera notifié" });
      setShippingDialogOpen(false);
      setTrackingNumber("");
      setTrackingUrl("");
    },
  });

  // Generate invoice - LEGACY BLOCKED
  // ============================================================
  // LEGACY BILLING BLOCKED - Source unique V2
  // Date: 2026-01-24 - Throw error to force V2 implementation
  // ============================================================
  const generateInvoiceMutation = useMutation({
    mutationFn: async (): Promise<{ id: string; invoice_number: string }> => {
      if (!replacementOrder) throw new Error("No order");
      
      // BLOCKED: Legacy billing désactivé
      throw new Error("LEGACY_BILLING_BLOCKED: Écriture legacy désactivée pour les remplacements. Implémenter billing_invoices V2.");
    },
    onSuccess: (data) => {
      refetchOrder();
      logActivity("create", "invoice", data.id, { 
        replacement_order: replacementOrder?.order_number 
      });
      toast({ title: "Facture générée", description: `Facture ${data.invoice_number}` });
    },
  });

  const resetOrderForm = () => {
    setOrderType("paid_replacement");
    setEquipmentItems([{ name: "", sku: "", quantity: 1, price: 0 }]);
    setDeliveryFee(30);
    setAdminFee(0);
    setReturnRequired(false);
    setReturnDeadline("");
    setShippingMethod("standard");
    setInternalNotes("");
  };

  const addEquipmentItem = () => {
    setEquipmentItems([...equipmentItems, { name: "", sku: "", quantity: 1, price: 0 }]);
  };

  const removeEquipmentItem = (index: number) => {
    setEquipmentItems(equipmentItems.filter((_, i) => i !== index));
  };

  const updateEquipmentItem = (index: number, field: string, value: any) => {
    const updated = [...equipmentItems];
    updated[index] = { ...updated[index], [field]: value };
    setEquipmentItems(updated);
  };

  const equipmentTotal = equipmentItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const subtotal = orderType === "warranty_replacement" ? 0 : equipmentTotal + deliveryFee + adminFee;
  const tps = subtotal * 0.05;
  const tvq = subtotal * 0.09975;
  const total = subtotal + tps + tvq;

  // Detail view
  if (selectedTicket) {
    const statusInfo = ticketStatusConfig[selectedTicket.status] || ticketStatusConfig.open;
    const StatusIcon = statusInfo.icon;

    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setSelectedTicket(null)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <Badge className={statusInfo.color}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusInfo.label}
            </Badge>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-cyan-400" />
                    {selectedTicket.ticket_number}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="w-full grid grid-cols-3">
                      <TabsTrigger value="details">Détails</TabsTrigger>
                      <TabsTrigger value="order">Commande</TabsTrigger>
                      <TabsTrigger value="notes">Notes</TabsTrigger>
                    </TabsList>

                    <TabsContent value="details" className="mt-4 space-y-4">
                      {/* Equipment Info */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-accent/50 rounded-lg">
                          <p className="text-xs text-muted-foreground">Équipement</p>
                          <p className="font-medium">{selectedTicket.equipment_name || "—"}</p>
                          {selectedTicket.equipment_serial && (
                            <p className="text-xs font-mono mt-1">S/N: {selectedTicket.equipment_serial}</p>
                          )}
                        </div>
                        <div className="p-4 bg-accent/50 rounded-lg">
                          <p className="text-xs text-muted-foreground">Commande originale</p>
                          <p className="font-mono">{selectedTicket.linked_order_number || "—"}</p>
                        </div>
                      </div>

                      {/* Reason */}
                      <div className="p-4 bg-accent/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Raison</p>
                        <p className="font-medium">{reasonLabels[selectedTicket.reason] || selectedTicket.reason}</p>
                        {selectedTicket.reason_details && (
                          <p className="text-sm mt-2 text-muted-foreground">{selectedTicket.reason_details}</p>
                        )}
                      </div>

                      {/* Delivery Address */}
                      <div className="p-4 bg-accent/50 rounded-lg">
                        <p className="text-xs text-muted-foreground">Adresse de livraison</p>
                        <p className="font-medium">
                          {[selectedTicket.preferred_address, selectedTicket.preferred_city, selectedTicket.preferred_postal_code]
                            .filter(Boolean)
                            .join(", ") || "Adresse par défaut"}
                        </p>
                      </div>

                      {/* Actions */}
                      {!replacementOrder && selectedTicket.status === "open" && (isAdmin || isEmployee) && (
                        <div className="flex gap-3 pt-4">
                          <Button 
                            variant="hero" 
                            onClick={() => setCreateOrderDialogOpen(true)}
                          >
                            <Package className="w-4 h-4 mr-2" />
                            Créer commande de remplacement
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => updateTicketMutation.mutate({ 
                              ticketId: selectedTicket.id, 
                              status: "cancelled" 
                            })}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Annuler
                          </Button>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="order" className="mt-4 space-y-4">
                      {replacementOrder ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-mono text-lg">{replacementOrder.order_number}</p>
                              <p className="text-sm text-muted-foreground">
                                {replacementOrder.order_type === "warranty_replacement" 
                                  ? "Remplacement sous garantie" 
                                  : "Remplacement payant"}
                              </p>
                            </div>
                            <Badge className={orderStatusConfig[replacementOrder.status]?.color || "bg-muted"}>
                              {orderStatusConfig[replacementOrder.status]?.label || replacementOrder.status}
                            </Badge>
                          </div>

                          {/* Equipment Items */}
                          <div className="border border-border rounded-lg p-4">
                            <h4 className="font-medium mb-3">Articles</h4>
                            {(replacementOrder.equipment_items as any[])?.map((item: any, i: number) => (
                              <div key={i} className="flex justify-between py-2 border-b border-border last:border-0">
                                <span>{item.name} x{item.quantity}</span>
                                <span>{(item.price * item.quantity).toFixed(2)} $</span>
                              </div>
                            ))}
                          </div>

                          {/* Totals */}
                          {replacementOrder.order_type === "paid_replacement" && (
                            <div className="border border-border rounded-lg p-4 space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Équipement</span>
                                <span>{replacementOrder.equipment_total?.toFixed(2)} $</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>Livraison</span>
                                <span>{replacementOrder.delivery_fee?.toFixed(2)} $</span>
                              </div>
                              {replacementOrder.admin_fee > 0 && (
                                <div className="flex justify-between text-sm">
                                  <span>Frais admin</span>
                                  <span>{replacementOrder.admin_fee?.toFixed(2)} $</span>
                                </div>
                              )}
                              <Separator />
                              <div className="flex justify-between text-sm">
                                <span>TPS (5%)</span>
                                <span>{replacementOrder.tps_amount?.toFixed(2)} $</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span>TVQ (9.975%)</span>
                                <span>{replacementOrder.tvq_amount?.toFixed(2)} $</span>
                              </div>
                              <Separator />
                              <div className="flex justify-between font-bold">
                                <span>Total</span>
                                <span>{replacementOrder.total_amount?.toFixed(2)} $</span>
                              </div>
                            </div>
                          )}

                          {/* Invoice Info */}
                          {replacementOrder.invoice_number && (
                            <div className="p-3 bg-accent/50 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium">Facture: {replacementOrder.invoice_number}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Statut: {replacementOrder.invoice_status === "paid" ? "Payée" : "Impayée"}
                                  </p>
                                </div>
                                {replacementOrder.invoice_status !== "paid" && (isAdmin || isEmployee) && (
                                  <Button 
                                    size="sm" 
                                    onClick={() => confirmPaymentMutation.mutate(replacementOrder.id)}
                                    disabled={confirmPaymentMutation.isPending}
                                  >
                                    <CheckCircle2 className="w-4 h-4 mr-1" />
                                    Confirmer paiement
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Shipping Info */}
                          {replacementOrder.tracking_number && (
                            <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                              <p className="text-sm font-medium flex items-center gap-2">
                                <Truck className="w-4 h-4" />
                                Suivi: {replacementOrder.tracking_number}
                              </p>
                              {replacementOrder.shipped_at && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Expédié le {format(new Date(replacementOrder.shipped_at), "d MMM yyyy", { locale: fr })}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex gap-3 pt-4">
                            {!replacementOrder.invoice_number && 
                              replacementOrder.order_type === "paid_replacement" && 
                              (isAdmin || isEmployee) && (
                              <Button onClick={() => generateInvoiceMutation.mutate()}>
                                <FileText className="w-4 h-4 mr-2" />
                                Générer facture
                              </Button>
                            )}
                            
                            {replacementOrder.status === "ready_to_ship" && (isAdmin || isEmployee) && (
                              <Button variant="hero" onClick={() => setShippingDialogOpen(true)}>
                                <Truck className="w-4 h-4 mr-2" />
                                Créer expédition
                              </Button>
                            )}

                            {replacementOrder.status === "awaiting_payment" && (
                              <p className="text-sm text-amber-500 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                En attente de paiement - Expédition bloquée
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                          <p className="text-muted-foreground">Aucune commande de remplacement créée</p>
                          {selectedTicket.status === "open" && (isAdmin || isEmployee) && (
                            <Button 
                              className="mt-4" 
                              variant="hero"
                              onClick={() => setCreateOrderDialogOpen(true)}
                            >
                              Créer commande
                            </Button>
                          )}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="notes" className="mt-4">
                      <Textarea
                        value={selectedTicket.internal_notes || ""}
                        onChange={(e) => {
                          updateTicketMutation.mutate({
                            ticketId: selectedTicket.id,
                            status: selectedTicket.status,
                            notes: e.target.value,
                          });
                        }}
                        placeholder="Notes internes (visibles uniquement par l'équipe)"
                        rows={6}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Client</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Nom</p>
                    <p className="font-medium">{selectedTicket.profile?.full_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-mono text-xs">{selectedTicket.profile?.email || selectedTicket.client_email}</p>
                  </div>
                  {selectedTicket.profile?.phone && (
                    <div>
                      <p className="text-muted-foreground">Téléphone</p>
                      <p>{selectedTicket.profile.phone}</p>
                    </div>
                  )}
                  {selectedTicket.profile?.client_number && (
                    <div>
                      <p className="text-muted-foreground">Numéro client</p>
                      <p className="font-mono">{selectedTicket.profile.client_number}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Chronologie</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Créé</span>
                    <span>{format(new Date(selectedTicket.created_at), "d MMM yyyy HH:mm", { locale: fr })}</span>
                  </div>
                  {selectedTicket.updated_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mis à jour</span>
                      <span>{format(new Date(selectedTicket.updated_at), "d MMM yyyy HH:mm", { locale: fr })}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Create Order Dialog */}
        <Dialog open={createOrderDialogOpen} onOpenChange={setCreateOrderDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Créer commande de remplacement</DialogTitle>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              {/* Order Type */}
              <div>
                <Label>Type de remplacement</Label>
                <Select value={orderType} onValueChange={(v: any) => setOrderType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warranty_replacement">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-emerald-400" />
                        Garantie (0$)
                      </div>
                    </SelectItem>
                    <SelectItem value="paid_replacement">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-orange-400" />
                        Payant (facturable)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Equipment Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Articles de remplacement</Label>
                  <Button size="sm" variant="ghost" onClick={addEquipmentItem}>
                    <Plus className="w-4 h-4 mr-1" />
                    Ajouter
                  </Button>
                </div>
                <div className="space-y-3">
                  {equipmentItems.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                      <Input
                        className="col-span-4"
                        placeholder="Nom article"
                        value={item.name}
                        onChange={(e) => updateEquipmentItem(index, "name", e.target.value)}
                      />
                      <Input
                        className="col-span-3"
                        placeholder="SKU"
                        value={item.sku}
                        onChange={(e) => updateEquipmentItem(index, "sku", e.target.value)}
                      />
                      <Input
                        className="col-span-2"
                        type="number"
                        placeholder="Qté"
                        value={item.quantity}
                        onChange={(e) => updateEquipmentItem(index, "quantity", parseInt(e.target.value) || 1)}
                      />
                      <Input
                        className="col-span-2"
                        type="number"
                        placeholder="Prix"
                        value={item.price}
                        onChange={(e) => updateEquipmentItem(index, "price", parseFloat(e.target.value) || 0)}
                        disabled={orderType === "warranty_replacement"}
                      />
                      {equipmentItems.length > 1 && (
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="col-span-1"
                          onClick={() => removeEquipmentItem(index)}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Fees (only for paid) */}
              {orderType === "paid_replacement" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Frais de livraison</Label>
                    <Input
                      type="number"
                      value={deliveryFee}
                      onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label>Frais admin (optionnel)</Label>
                    <Input
                      type="number"
                      value={adminFee}
                      onChange={(e) => setAdminFee(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              )}

              {/* Return Requirement */}
              <div className="flex items-center gap-3">
                <Checkbox
                  id="returnRequired"
                  checked={returnRequired}
                  onCheckedChange={(c) => setReturnRequired(c as boolean)}
                />
                <Label htmlFor="returnRequired">Retour de l'ancien équipement requis</Label>
              </div>
              {returnRequired && (
                <div>
                  <Label>Date limite de retour</Label>
                  <Input
                    type="date"
                    value={returnDeadline}
                    onChange={(e) => setReturnDeadline(e.target.value)}
                  />
                </div>
              )}

              {/* Shipping Method */}
              <div>
                <Label>Méthode d'expédition</Label>
                <Select value={shippingMethod} onValueChange={setShippingMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard (3-5 jours)</SelectItem>
                    <SelectItem value="express">Express (1-2 jours)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Totals Preview */}
              {orderType === "paid_replacement" && (
                <div className="p-4 bg-accent/50 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Équipement</span>
                    <span>{equipmentTotal.toFixed(2)} $</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Livraison</span>
                    <span>{deliveryFee.toFixed(2)} $</span>
                  </div>
                  {adminFee > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Frais admin</span>
                      <span>{adminFee.toFixed(2)} $</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-sm">
                    <span>TPS (5%)</span>
                    <span>{tps.toFixed(2)} $</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>TVQ (9.975%)</span>
                    <span>{tvq.toFixed(2)} $</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>{total.toFixed(2)} $</span>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <Label>Notes internes</Label>
                <Textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Notes visibles uniquement par l'équipe..."
                  rows={3}
                />
              </div>

              <Button 
                className="w-full" 
                variant="hero"
                onClick={() => createOrderMutation.mutate()}
                disabled={equipmentItems[0].name === "" || createOrderMutation.isPending}
              >
                {createOrderMutation.isPending ? "Création..." : "Créer la commande"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Shipping Dialog */}
        <Dialog open={shippingDialogOpen} onOpenChange={setShippingDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer l'expédition</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="p-4 bg-accent/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Adresse de livraison</p>
                <p className="font-medium">
                  {[replacementOrder?.shipping_address, replacementOrder?.shipping_city, replacementOrder?.shipping_postal_code]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
              
              <div>
                <Label>Numéro de suivi *</Label>
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
              
              <Button 
                className="w-full" 
                variant="hero"
                onClick={() => createShipmentMutation.mutate()}
                disabled={!trackingNumber || createShipmentMutation.isPending}
              >
                <Truck className="w-4 h-4 mr-2" />
                Confirmer l'expédition
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    );
  }

  // List view
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Remplacements</h1>
            <p className="text-muted-foreground mt-1">Gérez les demandes de remplacement d'équipement</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par ticket, client, équipement..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(ticketStatusConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>{config.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tickets List */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-cyan-400" />
              Demandes de remplacement
              {tickets?.length ? (
                <Badge variant="outline" className="ml-2">{tickets.length}</Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : filteredTickets.length > 0 ? (
              <div className="space-y-4">
                {filteredTickets.map((ticket: any) => {
                  const statusInfo = ticketStatusConfig[ticket.status] || ticketStatusConfig.open;
                  const StatusIcon = statusInfo.icon;

                  return (
                    <div
                      key={ticket.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-accent/50 rounded-lg cursor-pointer hover:bg-accent/70 transition-colors"
                      onClick={() => setSelectedTicket(ticket)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-mono text-sm text-cyan-400">{ticket.ticket_number}</span>
                          <Badge className={statusInfo.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </div>
                        <p className="font-medium">{ticket.equipment_name || "Équipement"}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span>{ticket.profile?.full_name || ticket.client_email}</span>
                          <span>{reasonLabels[ticket.reason] || ticket.reason}</span>
                        </div>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        {format(new Date(ticket.created_at), "d MMM yyyy", { locale: fr })}
                        {ticket.linked_order_number && (
                          <p className="font-mono text-xs mt-1">{ticket.linked_order_number}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune demande de remplacement</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminReplacements;
