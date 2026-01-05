import { useState } from "react";
import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useClientAuth } from "@/hooks/useClientAuth";
import { useQuery } from "@tanstack/react-query";
import { portalSupabase } from "@/integrations/supabase/portalClient";
import { Package, Eye, Truck, Clock, CheckCircle, XCircle, AlertCircle, Copy, Phone, Shield, CreditCard, FileText } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import ClientEquipmentOrderDetails from "@/components/client/ClientEquipmentOrderDetails";
import OrderStatusTimeline from "@/components/client/OrderStatusTimeline";
import { ContractSummaryDialog } from "@/components/contract/ContractSummaryDialog";

const ClientOrders = () => {
  const { user } = useClientAuth();
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["client-orders-all", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      // SECURITY: Always filter by user_id to prevent data leakage
      const { data, error } = await portalSupabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-500",
    payment_pending: "bg-amber-500/20 text-amber-500",
    verification: "bg-blue-500/20 text-blue-500",
    hold: "bg-purple-500/20 text-purple-500",
    backorder: "bg-orange-500/20 text-orange-500",
    cancel: "bg-red-500/20 text-red-500",
    cancelled: "bg-red-500/20 text-red-500",
    shipped: "bg-cyan-500/20 text-cyan-500",
    completed: "bg-emerald-500/20 text-emerald-500",
    paid: "bg-blue-500/20 text-blue-500",
    ready_to_ship: "bg-cyan-500/20 text-cyan-500",
  };

  const statusLabels: Record<string, string> = {
    pending: "En attente",
    payment_pending: "Paiement en attente",
    verification: "Vérification",
    hold: "En attente",
    backorder: "Rupture de stock",
    cancel: "Annulé",
    cancelled: "Annulé",
    shipped: "Expédié",
    completed: "Terminé",
    paid: "Payé",
    ready_to_ship: "Prêt à expédier",
  };

  const statusIcons: Record<string, any> = {
    pending: Clock,
    payment_pending: CreditCard,
    verification: AlertCircle,
    hold: Clock,
    backorder: AlertCircle,
    cancel: XCircle,
    cancelled: XCircle,
    shipped: Truck,
    completed: CheckCircle,
    paid: CheckCircle,
    ready_to_ship: Package,
  };

  // Check if order is equipment type
  const isEquipmentOrder = (order: any) => {
    return order.order_type === "equipment" || order.order_type === "equipment_accessories";
  };

  // Check if equipment order needs payment
  const needsPayment = (order: any) => {
    if (!isEquipmentOrder(order)) return false;
    const balanceDue = (Number(order.total_amount) || 0) - (Number(order.amount_paid) || 0);
    return balanceDue > 0 && 
      (order.status === "payment_pending" || order.status === "pending") &&
      order.payment_status !== "captured" && 
      order.payment_status !== "paid";
  };

  const handleViewDetails = (order: any) => {
    setSelectedOrder(order);
    setDetailsOpen(true);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié`);
  };

  // Calculate stats
  const activeOrders = orders?.filter((o: any) => !["completed", "cancel"].includes(o.status)).length || 0;
  const completedOrders = orders?.filter((o: any) => o.status === "completed").length || 0;
  const totalSpent = orders?.filter((o: any) => o.status === "completed")
    .reduce((acc: number, o: any) => acc + (Number(o.total_amount) || 0), 0) || 0;

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Mes commandes</h1>
          <p className="text-muted-foreground mt-1">Suivez vos commandes et services</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeOrders}</p>
                <p className="text-xs text-muted-foreground">En cours</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{completedOrders}</p>
                <p className="text-xs text-muted-foreground">Terminées</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Package className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {totalSpent.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </p>
                <p className="text-xs text-muted-foreground">Total dépensé</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-cyan-400" />
              Historique des commandes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : orders && orders.length > 0 ? (
              <div className="space-y-4">
                {orders.map((order: any) => {
                  const StatusIcon = statusIcons[order.status] || Clock;
                  const isEquip = isEquipmentOrder(order);
                  const showPaymentBadge = needsPayment(order);
                  return (
                    <div
                      key={order.id}
                      className={`p-4 bg-accent/50 rounded-lg border transition-colors ${
                        showPaymentBadge ? "border-amber-500/50 hover:border-amber-500" : "border-border hover:border-cyan-500/30"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              order.status === "completed" ? "bg-emerald-500/20" :
                              order.status === "shipped" ? "bg-cyan-500/20" :
                              order.status === "cancel" || order.status === "cancelled" ? "bg-red-500/20" : 
                              order.status === "paid" ? "bg-blue-500/20" : "bg-amber-500/20"
                            }`}>
                              <StatusIcon className={`w-4 h-4 ${
                                order.status === "completed" ? "text-emerald-500" :
                                order.status === "shipped" ? "text-cyan-500" :
                                order.status === "cancel" || order.status === "cancelled" ? "text-red-500" : 
                                order.status === "paid" ? "text-blue-500" : "text-amber-500"
                              }`} />
                            </div>
                            <div>
                              <h3 className="font-medium text-foreground">{order.service_type}</h3>
                              <p className="text-sm text-muted-foreground font-mono">
                                {order.order_number || `#${order.id.slice(0, 8)}`}
                              </p>
                            </div>
                            {isEquip && (
                              <Badge variant="outline" className="border-purple-500/50 text-purple-500">
                                Équipement
                              </Badge>
                            )}
                            <Badge className={statusColors[order.status] || "bg-muted"}>
                              {statusLabels[order.status] || order.status}
                            </Badge>
                            {showPaymentBadge && (
                              <Badge className="bg-amber-500 text-white animate-pulse">
                                <CreditCard className="w-3 h-3 mr-1" />
                                Paiement requis
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm mt-3">
                            <div>
                              <p className="text-muted-foreground">Date</p>
                              <p className="text-foreground">
                                {format(new Date(order.created_at), "d MMM yyyy", { locale: fr })}
                              </p>
                            </div>
                            {order.total_amount && (
                              <div>
                                <p className="text-muted-foreground">Montant</p>
                                <p className="text-foreground font-medium">
                                  {Number(order.total_amount).toLocaleString("fr-CA", {
                                    style: "currency",
                                    currency: "CAD",
                                  })}
                                </p>
                              </div>
                            )}
                            {order.tracking_number && (
                              <div className="col-span-2">
                                <p className="text-muted-foreground">Suivi</p>
                                <p className="text-cyan-500 font-mono text-sm flex items-center gap-2">
                                  {order.tracking_number}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => copyToClipboard(order.tracking_number, "Numéro de suivi")}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </p>
                              </div>
                            )}
                          </div>
                          {/* Status Timeline */}
                          <div className="mt-4 pt-4 border-t border-border">
                            <OrderStatusTimeline currentStatus={order.status} />
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(order)}
                          className="shrink-0"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Détails
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Aucune commande pour le moment</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Order Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className={selectedOrder && isEquipmentOrder(selectedOrder) ? "max-w-2xl" : "max-w-lg"}>
          <DialogHeader>
            <DialogTitle>
              {selectedOrder && isEquipmentOrder(selectedOrder) 
                ? "Commande Équipement" 
                : "Détails de la commande"}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && isEquipmentOrder(selectedOrder) ? (
            <ClientEquipmentOrderDetails 
              order={selectedOrder} 
              onClose={() => setDetailsOpen(false)} 
            />
          ) : selectedOrder && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Commande</span>
                <span className="font-mono text-foreground">{selectedOrder.order_number || `#${selectedOrder.id.slice(0, 8)}`}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Service</span>
                <span className="text-foreground font-medium">{selectedOrder.service_type}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Statut</span>
                <Badge className={statusColors[selectedOrder.status] || "bg-muted"}>
                  {statusLabels[selectedOrder.status] || selectedOrder.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Date</span>
                <span className="text-foreground">
                  {format(new Date(selectedOrder.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                </span>
              </div>
              {selectedOrder.total_amount && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Montant</span>
                  <span className="text-foreground font-bold">
                    {Number(selectedOrder.total_amount).toLocaleString("fr-CA", {
                      style: "currency",
                      currency: "CAD",
                    })}
                  </span>
                </div>
              )}

              {/* Port-In Info (Read-Only for Client) */}
              {selectedOrder.port_request && (selectedOrder.port_request as any)?.port_in && (
                <div className="pt-4 border-t border-border">
                  <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-cyan-500" />
                    Transfert de numéro
                  </h4>
                  <div className="space-y-2 bg-cyan-500/10 p-3 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Numéro à transférer</span>
                      <span className="font-mono text-foreground">{(selectedOrder.port_request as any)?.phone_number || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Fournisseur actuel</span>
                      <span className="text-foreground">{(selectedOrder.port_request as any)?.carrier || "Non spécifié"}</span>
                    </div>
                    <Badge className="bg-emerald-500/20 text-emerald-500 mt-2">En traitement</Badge>
                  </div>
                </div>
              )}

              {/* Identity Info (Read-Only, Masked for Client) */}
              {selectedOrder.identity_snapshot && (
                <div className="pt-4 border-t border-border">
                  <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-500" />
                    Identité vérifiée
                  </h4>
                  <div className="space-y-2 bg-blue-500/10 p-3 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Type de pièce</span>
                      <span className="text-foreground">
                        {(selectedOrder.identity_snapshot as any)?.id_type === "drivers_license" ? "Permis de conduire" :
                         (selectedOrder.identity_snapshot as any)?.id_type === "passport" ? "Passeport" :
                         (selectedOrder.identity_snapshot as any)?.id_type === "health_card" ? "Carte assurance maladie" :
                         (selectedOrder.identity_snapshot as any)?.id_type || "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Numéro</span>
                      <span className="font-mono text-foreground">
                        {(selectedOrder.identity_snapshot as any)?.id_number 
                          ? `••••${(selectedOrder.identity_snapshot as any).id_number.slice(-4)}` 
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Device Info */}
              {(selectedOrder.sim_number || selectedOrder.imei_number || selectedOrder.serial_number) && (
                <div className="pt-4 border-t border-border">
                  <h4 className="font-medium text-foreground mb-3">Informations appareil</h4>
                  <div className="space-y-2">
                    {selectedOrder.sim_number && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Numéro SIM</span>
                        <span className="font-mono text-foreground">{selectedOrder.sim_number}</span>
                      </div>
                    )}
                    {selectedOrder.imei_number && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">IMEI</span>
                        <span className="font-mono text-foreground">{selectedOrder.imei_number}</span>
                      </div>
                    )}
                    {selectedOrder.serial_number && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Numéro de série</span>
                        <span className="font-mono text-foreground">{selectedOrder.serial_number}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tracking Info */}
              {selectedOrder.tracking_number && (
                <div className="pt-4 border-t border-border">
                  <h4 className="font-medium text-foreground mb-3">Suivi d'expédition</h4>
                  <div className="flex items-center justify-between bg-cyan-500/10 p-3 rounded-lg">
                    <div>
                      <p className="text-sm text-muted-foreground">Numéro de suivi</p>
                      <p className="font-mono text-cyan-500">{selectedOrder.tracking_number}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(selectedOrder.tracking_number, "Numéro de suivi")}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {selectedOrder.notes && (
                <div className="pt-4 border-t border-border">
                  <h4 className="font-medium text-foreground mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Contract Summary Button */}
              <div className="pt-4 border-t border-border">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setDetailsOpen(false);
                    setSummaryOpen(true);
                  }}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Voir Résumé du contrat
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Contract Summary Dialog */}
      {selectedOrder && (
        <ContractSummaryDialog
          open={summaryOpen}
          onOpenChange={setSummaryOpen}
          orderId={selectedOrder.id}
          usePortalClient
        />
      )}
    </ClientLayout>
  );
};

export default ClientOrders;