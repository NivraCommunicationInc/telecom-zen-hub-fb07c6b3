import { useState, useEffect } from "react";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend/portalClient";
import { Package, Eye, Truck, Clock, CheckCircle, XCircle, AlertCircle, Copy, Phone, Shield, CreditCard, FileText, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import ClientEquipmentOrderDetails from "@/components/client/ClientEquipmentOrderDetails";
import OrderStatusTimeline from "@/components/client/OrderStatusTimeline";
import { ContractSummaryDialog } from "@/components/contract/ContractSummaryDialog";
import { OrderShippingActivationPanel } from "@/components/orders/OrderShippingActivationPanel";
import { OrderLifecycleTimeline } from "@/components/orders/OrderLifecycleTimeline";

// Phase 3 — règle: pro = jamais de bloc livraison côté client
const isProInstall = (order: any) => order?.installation_type === "technician";

const ClientOrders = () => {
  const { user } = useClientAuth();
  const queryClient = useQueryClient();
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

  // REALTIME: Subscribe to order changes for automatic status updates
  useEffect(() => {
    if (!user?.id) return;
    
    const channel = portalSupabase
      .channel("client-orders-realtime")
      .on("postgres_changes", { 
        event: "*", 
        schema: "public", 
        table: "orders",
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        console.log("[ClientOrders] Realtime update received:", payload);
        // Invalidate to refetch - RLS will filter appropriately
        queryClient.invalidateQueries({ queryKey: ["client-orders-all"] });
      })
      .subscribe();

    return () => {
      portalSupabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    payment_pending: "bg-amber-100 text-amber-700",
    verification: "bg-blue-100 text-blue-700",
    hold: "bg-purple-100 text-purple-700",
    backorder: "bg-orange-100 text-orange-700",
    cancel: "bg-red-100 text-red-700",
    cancelled: "bg-red-100 text-red-700",
    shipped: "bg-teal-100 text-teal-700",
    completed: "bg-emerald-100 text-emerald-700",
    paid: "bg-blue-100 text-blue-700",
    ready_to_ship: "bg-teal-100 text-teal-700",
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
    const canonicalTotal = Number(order.pricing_snapshot?.grand_total ?? order.total_amount) || 0;
    const balanceDue = canonicalTotal - (Number(order.amount_paid) || 0);
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
    .reduce((acc: number, o: any) => acc + (Number(o.pricing_snapshot?.grand_total ?? o.total_amount) || 0), 0) || 0;

  return (
    <ClientLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-900">Mes commandes</h1>
        <p className="text-slate-500">Suivez les commandes expédiées à domicile. Le traitement des nouvelles commandes peut prendre quelques jours.</p>

        {/* Rogers-style order list */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-8">
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-lg" />
                ))}
              </div>
            </div>
          ) : orders && orders.length > 0 ? (
            <>
              {orders.map((order: any) => {
                const StatusIcon = statusIcons[order.status] || Clock;
                const isEquip = isEquipmentOrder(order);
                const showPaymentBadge = needsPayment(order);
                return (
                  <div
                    key={order.id}
                    className={`border-b border-slate-100 last:border-b-0 ${
                      showPaymentBadge ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-teal-600"
                    }`}
                  >
                    <div className="px-6 py-5">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h3 className="font-semibold text-slate-900">{order.service_type}</h3>
                            {isEquip && (
                              <Badge variant="outline" className="border-purple-300 text-purple-700 bg-purple-50">
                                Équipement
                              </Badge>
                            )}
                            <Badge className={statusColors[order.status] || "bg-slate-100 text-slate-700"}>
                              {statusLabels[order.status] || order.status}
                            </Badge>
                            {showPaymentBadge && (
                              <Badge className="bg-amber-500 text-white animate-pulse">
                                <CreditCard className="w-3 h-3 mr-1" />
                                Paiement requis
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-500 font-mono mb-3">
                            {order.order_number || `#${order.id.slice(0, 8)}`}
                          </p>
                          <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
                            <div>
                              <span className="text-slate-500">Date: </span>
                              <span className="text-slate-900">
                                {format(new Date(order.created_at), "d MMM yyyy", { locale: fr })}
                              </span>
                            </div>
                            {(order.pricing_snapshot?.grand_total || order.total_amount) && (
                              <div>
                                <span className="text-slate-500">Montant: </span>
                                <span className="text-slate-900 font-medium">
                                  {Number(order.pricing_snapshot?.grand_total ?? order.total_amount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                                </span>
                              </div>
                            )}
                            {order.tracking_number && (
                              <div>
                                <span className="text-slate-500">Suivi: </span>
                                <span className="text-teal-700 font-mono text-sm">
                                  {order.tracking_number}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 w-5 p-0 ml-1"
                                    onClick={() => copyToClipboard(order.tracking_number, "Numéro de suivi")}
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                </span>
                              </div>
                            )}
                          </div>
                          {/* Status Timeline */}
                          <div className="mt-4 pt-4 border-t border-slate-100">
                            <OrderStatusTimeline currentStatus={order.status} />
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(order)}
                          className="shrink-0 border-teal-600 text-teal-700 hover:bg-teal-50"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Détails
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="border-l-4 border-l-blue-500 px-6 py-5">
              <div className="flex items-start gap-3">
                <Package className="w-5 h-5 text-blue-500 mt-0.5" />
                <div>
                  <p className="font-semibold text-slate-900">Aucune commande active</p>
                  <p className="text-sm text-slate-500 mt-1">Suivez les commandes expédiées à domicile. Le traitement des nouvelles commandes peut prendre quelques jours.</p>
                </div>
              </div>
              <Link to="/portal" className="text-sm text-teal-700 hover:text-teal-800 font-medium inline-flex items-center gap-1 mt-3 ml-8">
                Retour à l'aperçu du compte <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
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
              {(selectedOrder.pricing_snapshot?.grand_total || selectedOrder.total_amount) && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Montant</span>
                  <span className="text-foreground font-bold">
                    {Number(selectedOrder.pricing_snapshot?.grand_total ?? selectedOrder.total_amount).toLocaleString("fr-CA", {
                      style: "currency",
                      currency: "CAD",
                    })}
                  </span>
                </div>
              )}

              {/* Payment Status */}
              {selectedOrder.payment_status && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Paiement</span>
                  <Badge className={
                    selectedOrder.payment_status === "paid" || selectedOrder.payment_status === "captured"
                      ? "bg-emerald-100 text-emerald-700"
                      : selectedOrder.payment_status === "pending"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-muted text-muted-foreground"
                  }>
                    {selectedOrder.payment_status === "paid" || selectedOrder.payment_status === "captured" 
                      ? "Payé" 
                      : selectedOrder.payment_status === "pending" 
                      ? "En attente" 
                      : selectedOrder.payment_status}
                  </Badge>
                </div>
              )}

              {/* Quick Links to Invoice & Payments */}
              <div className="pt-4 border-t border-border space-y-2">
                <Link to="/portal/invoices" onClick={() => setDetailsOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <FileText className="w-4 h-4 mr-2 text-blue-500" />
                    Voir mes factures
                  </Button>
                </Link>
                <Link to="/portal/contracts" onClick={() => setDetailsOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full justify-start">
                    <Shield className="w-4 h-4 mr-2 text-purple-500" />
                    Voir mes contrats
                  </Button>
                </Link>
              </div>

              {/* Port-In Info (Read-Only for Client) */}
              {selectedOrder.port_request && (selectedOrder.port_request as any)?.port_in && (
                <div className="pt-4 border-t border-border">
                  <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-primary" />
                    Transfert de numéro
                  </h4>
                  <div className="space-y-2 bg-primary/10 p-3 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Numéro à transférer</span>
                      <span className="font-mono text-foreground">{(selectedOrder.port_request as any)?.phone_number || "—"}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Fournisseur actuel</span>
                      <span className="text-foreground">{(selectedOrder.port_request as any)?.carrier || "Non spécifié"}</span>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700 mt-2">En traitement</Badge>
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

              {/* Phase 2 — Livraison & activation (compatible commandes historiques) */}
              <div className="pt-4 border-t border-border">
                <OrderShippingActivationPanel order={selectedOrder} variant="client" />
              </div>

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