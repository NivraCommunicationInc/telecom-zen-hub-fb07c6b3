import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Package,
  LogOut,
  RefreshCw,
  Search,
  ArrowLeft,
  Eye,
  User,
  Calendar,
  Clock,
  DollarSign,
  CreditCard,
  Truck,
  CheckCircle,
  Shield,
  Plus,
  MapPin,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "bg-yellow-500/20 text-yellow-600" },
  verification: { label: "Vérification", color: "bg-blue-500/20 text-blue-600" },
  processing: { label: "En traitement", color: "bg-cyan-500/20 text-cyan-600" },
  shipped: { label: "Expédié", color: "bg-purple-500/20 text-purple-600" },
  completed: { label: "Terminé", color: "bg-emerald-500/20 text-emerald-600" },
  cancelled: { label: "Annulé", color: "bg-red-500/20 text-red-600" },
};

const paymentStatusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "bg-yellow-500/20 text-yellow-600" },
  paid: { label: "Payé", color: "bg-emerald-500/20 text-emerald-600" },
  partial: { label: "Partiel", color: "bg-orange-500/20 text-orange-600" },
  refunded: { label: "Remboursé", color: "bg-gray-500/20 text-gray-600" },
};

const idVerificationLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "bg-yellow-500/20 text-yellow-600" },
  verified: { label: "Vérifié", color: "bg-emerald-500/20 text-emerald-600" },
  failed: { label: "Échoué", color: "bg-red-500/20 text-red-600" },
};

const EmployeeOrders = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Create order dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newOrder, setNewOrder] = useState({
    client_email: "",
    service_type: "internet",
    category: "",
    subtotal: 0,
    notes: "",
  });
  
  // Payment dialog
  const [paymentData, setPaymentData] = useState({
    payment_status: "paid",
    payment_reference: "",
    amount_paid: 0,
    payment_method: "card",
  });
  
  // ID Verification
  const [idVerification, setIdVerification] = useState({
    status: "verified",
    notes: "",
  });
  
  // Tracking
  const [trackingData, setTrackingData] = useState({
    tracking_number: "",
    tracking_url: "",
  });

  useEffect(() => {
    const stored = localStorage.getItem("nivra_employee_session");
    if (!stored) {
      navigate("/employee/login");
      return;
    }
    try {
      const s = JSON.parse(stored);
      if (!s.permissions?.can_view_orders) {
        toast({ title: "Accès refusé", variant: "destructive" });
        navigate("/employee");
        return;
      }
      setSession(s);
    } catch {
      navigate("/employee/login");
    }
  }, [navigate, toast]);

  const fetchOrders = async () => {
    if (!session?.token) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { action: "get_orders", params: { limit: 200 } },
      });
      if (error) throw error;
      setOrders(data?.orders || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast({ title: "Erreur", description: "Impossible de charger les commandes", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClients = async () => {
    if (!session?.token) return;
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { action: "get_clients", params: { limit: 500 } },
      });
      if (error) throw error;
      setClients(data?.clients || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  useEffect(() => {
    if (session?.token) {
      fetchOrders();
      fetchClients();
    }
  }, [session?.token]);

  const handleLogout = () => {
    localStorage.removeItem("nivra_employee_session");
    navigate("/employee/login");
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = !search || 
      order.order_number?.toLowerCase().includes(search.toLowerCase()) ||
      order.client_email?.toLowerCase().includes(search.toLowerCase()) ||
      order.confirmation_number?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    if (!session?.permissions?.can_edit_orders_status) {
      toast({ title: "Permission refusée", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { action: "update_order_status", params: { orderId, status: newStatus } },
      });
      if (error || data?.error) throw new Error(data?.error || error);
      toast({ title: "Statut mis à jour" });
      fetchOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePayment = async () => {
    if (!session?.permissions?.can_confirm_payments || !selectedOrder) {
      toast({ title: "Permission refusée", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { 
          action: "update_order_payment", 
          params: { 
            orderId: selectedOrder.id,
            ...paymentData
          } 
        },
      });
      if (error || data?.error) throw new Error(data?.error || error);
      toast({ title: "Paiement enregistré" });
      fetchOrders();
      setSelectedOrder({ ...selectedOrder, ...paymentData });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyIdentity = async () => {
    if (!selectedOrder) return;
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { 
          action: "verify_order_identity", 
          params: { 
            orderId: selectedOrder.id,
            status: idVerification.status,
            notes: idVerification.notes
          } 
        },
      });
      if (error || data?.error) throw new Error(data?.error || error);
      toast({ title: "Identité vérifiée" });
      fetchOrders();
      setSelectedOrder({ 
        ...selectedOrder, 
        id_verification_status: idVerification.status,
        id_verification_notes: idVerification.notes
      });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTracking = async () => {
    if (!session?.permissions?.can_ship_orders || !selectedOrder) {
      toast({ title: "Permission refusée", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { 
          action: "update_order", 
          params: { 
            orderId: selectedOrder.id,
            updates: {
              ...trackingData,
              status: "shipped"
            }
          } 
        },
      });
      if (error || data?.error) throw new Error(data?.error || error);
      toast({ title: "Expédition enregistrée" });
      fetchOrders();
      setSelectedOrder({ ...selectedOrder, ...trackingData, status: "shipped" });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateOrder = async () => {
    const client = clients.find(c => c.email === newOrder.client_email);
    if (!client) {
      toast({ title: "Client non trouvé", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("employee-data", {
        headers: { "x-employee-token": session.token },
        body: { 
          action: "create_order", 
          params: {
            user_id: client.user_id,
            client_email: newOrder.client_email,
            service_type: newOrder.service_type,
            category: newOrder.category,
            subtotal: newOrder.subtotal,
            notes: newOrder.notes,
          }
        },
      });
      if (error || data?.error) throw new Error(data?.error || error);
      toast({ title: "Commande créée", description: `Numéro: ${data.order?.order_number}` });
      setShowCreateDialog(false);
      setNewOrder({ client_email: "", service_type: "internet", category: "", subtotal: 0, notes: "" });
      fetchOrders();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!session) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link to="/employee">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Retour
                </Button>
              </Link>
              <Package className="w-6 h-6 text-blue-500" />
              <h1 className="font-display font-bold text-lg">Commandes</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle commande
              </Button>
              <span className="text-xs text-muted-foreground">
                <Clock className="w-3 h-3 inline mr-1" />
                {format(lastRefresh, "HH:mm")}
              </span>
              <Button variant="outline" size="sm" onClick={fetchOrders} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par numéro ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {Object.entries(statusLabels).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Aucune commande trouvée
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Commande</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Paiement</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.order_number || "N/A"}</TableCell>
                      <TableCell>{order.client_email || "N/A"}</TableCell>
                      <TableCell>{order.service_type || "N/A"}</TableCell>
                      <TableCell>
                        <Badge className={statusLabels[order.status]?.color || "bg-gray-500/20"}>
                          {statusLabels[order.status]?.label || order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={paymentStatusLabels[order.payment_status]?.color || "bg-yellow-500/20"}>
                          {paymentStatusLabels[order.payment_status]?.label || "En attente"}
                        </Badge>
                      </TableCell>
                      <TableCell>${order.total_amount?.toFixed(2) || "0.00"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(order.created_at), "d MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => {
                          setSelectedOrder(order);
                          setPaymentData({
                            payment_status: order.payment_status || "pending",
                            payment_reference: order.payment_reference || "",
                            amount_paid: order.amount_paid || order.total_amount || 0,
                            payment_method: "card"
                          });
                          setIdVerification({
                            status: order.id_verification_status || "pending",
                            notes: order.id_verification_notes || ""
                          });
                          setTrackingData({
                            tracking_number: order.tracking_number || "",
                            tracking_url: order.tracking_url || ""
                          });
                        }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              {selectedOrder?.order_number || "Commande"}
            </DialogTitle>
            <DialogDescription>
              {selectedOrder?.confirmation_number && `Confirmation: ${selectedOrder.confirmation_number}`}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="details">Détails</TabsTrigger>
                <TabsTrigger value="payment">Paiement</TabsTrigger>
                <TabsTrigger value="verification">Identité</TabsTrigger>
                <TabsTrigger value="shipping">Expédition</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Statut</span>
                  <Badge className={statusLabels[selectedOrder.status]?.color}>
                    {statusLabels[selectedOrder.status]?.label || selectedOrder.status}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <a href={`mailto:${selectedOrder.client_email}`} className="hover:underline">
                      {selectedOrder.client_email || "N/A"}
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>{format(new Date(selectedOrder.created_at), "d MMMM yyyy HH:mm", { locale: fr })}</span>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Service</span>
                    <span className="font-medium">{selectedOrder.service_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sous-total</span>
                    <span>${selectedOrder.subtotal?.toFixed(2) || "0.00"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">TPS</span>
                    <span>${selectedOrder.tps_amount?.toFixed(2) || "0.00"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">TVQ</span>
                    <span>${selectedOrder.tvq_amount?.toFixed(2) || "0.00"}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total</span>
                    <span>${selectedOrder.total_amount?.toFixed(2) || "0.00"}</span>
                  </div>
                </div>

                {session?.permissions?.can_edit_orders_status && (
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">Changer le statut</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(statusLabels).map(([key, { label }]) => (
                        <Button
                          key={key}
                          variant={selectedOrder.status === key ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleUpdateStatus(selectedOrder.id, key)}
                          disabled={selectedOrder.status === key || isSubmitting}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="payment" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Statut actuel</span>
                  <Badge className={paymentStatusLabels[selectedOrder.payment_status]?.color || "bg-yellow-500/20"}>
                    {paymentStatusLabels[selectedOrder.payment_status]?.label || "En attente"}
                  </Badge>
                </div>

                {selectedOrder.payment_reference && (
                  <div className="bg-muted/50 p-3 rounded">
                    <p className="text-sm text-muted-foreground">Référence: {selectedOrder.payment_reference}</p>
                    <p className="text-sm text-muted-foreground">Montant payé: ${selectedOrder.amount_paid?.toFixed(2) || "0.00"}</p>
                  </div>
                )}

                {session?.permissions?.can_confirm_payments && (
                  <div className="border-t pt-4 space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Enregistrer un paiement
                    </h4>
                    
                    <div className="grid gap-4">
                      <div>
                        <Label>Méthode de paiement</Label>
                        <Select value={paymentData.payment_method} onValueChange={(v) => setPaymentData({...paymentData, payment_method: v})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="card">Carte</SelectItem>
                            <SelectItem value="etransfer">Virement Interac</SelectItem>
                            <SelectItem value="cash">Comptant</SelectItem>
                            <SelectItem value="check">Chèque</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label>Montant</Label>
                        <Input 
                          type="number" 
                          value={paymentData.amount_paid}
                          onChange={(e) => setPaymentData({...paymentData, amount_paid: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                      
                      <div>
                        <Label>Référence</Label>
                        <Input 
                          placeholder="Numéro de confirmation..."
                          value={paymentData.payment_reference}
                          onChange={(e) => setPaymentData({...paymentData, payment_reference: e.target.value})}
                        />
                      </div>
                      
                      <div>
                        <Label>Statut</Label>
                        <Select value={paymentData.payment_status} onValueChange={(v) => setPaymentData({...paymentData, payment_status: v})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(paymentStatusLabels).map(([key, { label }]) => (
                              <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <Button onClick={handleUpdatePayment} disabled={isSubmitting}>
                        <DollarSign className="w-4 h-4 mr-2" />
                        Confirmer le paiement
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="verification" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Statut de vérification</span>
                  <Badge className={idVerificationLabels[selectedOrder.id_verification_status]?.color || "bg-yellow-500/20"}>
                    {idVerificationLabels[selectedOrder.id_verification_status]?.label || "En attente"}
                  </Badge>
                </div>

                {selectedOrder.id_verification_notes && (
                  <div className="bg-muted/50 p-3 rounded">
                    <p className="text-sm text-muted-foreground">{selectedOrder.id_verification_notes}</p>
                  </div>
                )}

                {session?.permissions?.can_edit_orders_status && (
                  <div className="border-t pt-4 space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Vérifier l'identité
                    </h4>
                    
                    <div className="grid gap-4">
                      <div>
                        <Label>Statut</Label>
                        <Select value={idVerification.status} onValueChange={(v) => setIdVerification({...idVerification, status: v})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(idVerificationLabels).map(([key, { label }]) => (
                              <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label>Notes</Label>
                        <Textarea 
                          placeholder="Notes de vérification..."
                          value={idVerification.notes}
                          onChange={(e) => setIdVerification({...idVerification, notes: e.target.value})}
                        />
                      </div>
                      
                      <Button onClick={handleVerifyIdentity} disabled={isSubmitting}>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Enregistrer la vérification
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="shipping" className="space-y-4 mt-4">
                {selectedOrder.tracking_number && (
                  <div className="bg-muted/50 p-3 rounded space-y-2">
                    <p className="text-sm"><strong>Numéro de suivi:</strong> {selectedOrder.tracking_number}</p>
                    {selectedOrder.tracking_url && (
                      <a href={selectedOrder.tracking_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                        Suivre le colis →
                      </a>
                    )}
                  </div>
                )}

                {session?.permissions?.can_ship_orders && (
                  <div className="border-t pt-4 space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Truck className="w-4 h-4" />
                      Enregistrer l'expédition
                    </h4>
                    
                    <div className="grid gap-4">
                      <div>
                        <Label>Numéro de suivi</Label>
                        <Input 
                          placeholder="Ex: 1Z999AA10123456784"
                          value={trackingData.tracking_number}
                          onChange={(e) => setTrackingData({...trackingData, tracking_number: e.target.value})}
                        />
                      </div>
                      
                      <div>
                        <Label>URL de suivi (optionnel)</Label>
                        <Input 
                          placeholder="https://..."
                          value={trackingData.tracking_url}
                          onChange={(e) => setTrackingData({...trackingData, tracking_url: e.target.value})}
                        />
                      </div>
                      
                      <Button onClick={handleUpdateTracking} disabled={isSubmitting || !trackingData.tracking_number}>
                        <Truck className="w-4 h-4 mr-2" />
                        Marquer comme expédié
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Order Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Nouvelle commande manuelle
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Client (email)</Label>
              <Select value={newOrder.client_email} onValueChange={(v) => setNewOrder({...newOrder, client_email: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.email || ""}>
                      {client.full_name || client.email} ({client.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Type de service</Label>
              <Select value={newOrder.service_type} onValueChange={(v) => setNewOrder({...newOrder, service_type: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internet">Internet</SelectItem>
                  <SelectItem value="tv">Télévision</SelectItem>
                  <SelectItem value="mobile">Mobile</SelectItem>
                  <SelectItem value="bundle">Forfait combiné</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Catégorie</Label>
              <Input 
                placeholder="Ex: Installation, Remplacement..."
                value={newOrder.category}
                onChange={(e) => setNewOrder({...newOrder, category: e.target.value})}
              />
            </div>
            
            <div>
              <Label>Montant (avant taxes)</Label>
              <Input 
                type="number"
                value={newOrder.subtotal}
                onChange={(e) => setNewOrder({...newOrder, subtotal: parseFloat(e.target.value) || 0})}
              />
            </div>
            
            <div>
              <Label>Notes</Label>
              <Textarea 
                placeholder="Notes pour la commande..."
                value={newOrder.notes}
                onChange={(e) => setNewOrder({...newOrder, notes: e.target.value})}
              />
            </div>
            
            <Button onClick={handleCreateOrder} disabled={!newOrder.client_email || isSubmitting} className="w-full">
              Créer la commande
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeOrders;
