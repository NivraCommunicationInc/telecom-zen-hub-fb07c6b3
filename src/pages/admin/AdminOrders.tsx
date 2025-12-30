import { useState } from "react";
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
import { Package, Plus, Eye, Send } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useActivityLog } from "@/hooks/useActivityLog";

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-500",
  verification: "bg-blue-500/20 text-blue-500",
  hold: "bg-purple-500/20 text-purple-500",
  backorder: "bg-orange-500/20 text-orange-500",
  cancel: "bg-red-500/20 text-red-500",
  shipped: "bg-cyan-500/20 text-cyan-400",
  completed: "bg-emerald-500/20 text-emerald-500",
};

const statusLabels: Record<string, string> = {
  pending: "En attente",
  verification: "Vérification",
  hold: "En attente",
  backorder: "Rupture de stock",
  cancel: "Annulé",
  shipped: "Expédié",
  completed: "Terminé",
};

const statusOptions = [
  { value: "pending", label: "En attente" },
  { value: "verification", label: "Vérification" },
  { value: "hold", label: "En attente" },
  { value: "backorder", label: "Rupture de stock" },
  { value: "cancel", label: "Annulé" },
  { value: "shipped", label: "Expédié" },
  { value: "completed", label: "Terminé" },
];

const AdminOrders = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { logActivity } = useActivityLog();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [newOrder, setNewOrder] = useState({
    user_id: "",
    service_type: "",
    total_amount: "",
    notes: "",
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      // Get orders
      const { data: ordersData, error: ordersErr } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (ordersErr) throw ordersErr;

      // Get profiles for user info
      if (ordersData && ordersData.length > 0) {
        const userIds = [...new Set(ordersData.map((o: any) => o.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, email, full_name")
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

  const createOrderMutation = useMutation({
    mutationFn: async (order: typeof newOrder) => {
      const { data, error } = await supabase.from("orders").insert({
        user_id: order.user_id,
        service_type: order.service_type,
        total_amount: order.total_amount ? parseFloat(order.total_amount) : null,
        notes: order.notes,
        status: "pending",
      }).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      logActivity("create", "order", data.id, { service_type: data.service_type });
      toast({ title: "Commande créée avec succès" });
      setCreateDialogOpen(false);
      setNewOrder({ user_id: "", service_type: "", total_amount: "", notes: "" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async (order: any) => {
      const { error } = await supabase
        .from("orders")
        .update({
          status: order.status,
          tracking_number: order.tracking_number,
          sim_number: order.sim_number,
          imei_number: order.imei_number,
          serial_number: order.serial_number,
          notes: order.notes,
        })
        .eq("id", order.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      logActivity("update", "order", selectedOrder?.id, { status: selectedOrder?.status });
      toast({ title: "Commande mise à jour" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  const sendUpdateMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const order = orders?.find((o: any) => o.id === orderId);
      if (!order) throw new Error("Order not found");

      const { error } = await supabase.from("messages").insert({
        sender_id: (await supabase.auth.getUser()).data.user?.id,
        recipient_id: order.user_id,
        subject: `Mise à jour de votre commande #${orderId.slice(0, 8)}`,
        content: `Votre commande a été mise à jour. Nouveau statut: ${statusLabels[order.status] || order.status}${order.tracking_number ? `\n\nNuméro de suivi: ${order.tracking_number}` : ""}`,
        related_order_id: orderId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Mise à jour envoyée au client" });
    },
    onError: () => {
      toast({ title: "Erreur lors de l'envoi", variant: "destructive" });
    },
  });

  const handleViewDetails = (order: any) => {
    setSelectedOrder({ ...order });
    setDetailsDialogOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Commandes</h1>
            <p className="text-muted-foreground mt-1">Gérer toutes les commandes clients</p>
          </div>
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
                  <Select
                    value={newOrder.user_id}
                    onValueChange={(v) => setNewOrder({ ...newOrder, user_id: v })}
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

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-cyan-400" />
              Liste des commandes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : orders && orders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">ID</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Client</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Service</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Montant</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order: any) => (
                      <tr key={order.id} className="border-b border-border/50 hover:bg-accent/50">
                        <td className="py-3 px-4 text-sm text-foreground font-mono">
                          {order.id.slice(0, 8)}...
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm text-foreground">{order.profiles?.full_name || "N/A"}</p>
                          <p className="text-xs text-muted-foreground">{order.profiles?.email}</p>
                        </td>
                        <td className="py-3 px-4 text-sm text-foreground">{order.service_type}</td>
                        <td className="py-3 px-4 text-sm text-foreground">
                          {order.total_amount
                            ? Number(order.total_amount).toLocaleString("fr-CA", {
                                style: "currency",
                                currency: "CAD",
                              })
                            : "—"}
                        </td>
                        <td className="py-3 px-4">
                          <Badge className={statusColors[order.status] || "bg-muted"}>
                            {statusLabels[order.status] || order.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {format(new Date(order.created_at), "d MMM yyyy", { locale: fr })}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleViewDetails(order)}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => sendUpdateMutation.mutate(order.id)}
                            >
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
                <p className="text-muted-foreground">Aucune commande pour le moment</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Details Dialog */}
        <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Détails de la commande</DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Statut</Label>
                    <Select
                      value={selectedOrder.status}
                      onValueChange={(v) => setSelectedOrder({ ...selectedOrder, status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Numéro de suivi</Label>
                    <Input
                      value={selectedOrder.tracking_number || ""}
                      onChange={(e) =>
                        setSelectedOrder({ ...selectedOrder, tracking_number: e.target.value })
                      }
                      placeholder="Numéro de suivi..."
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>SIM</Label>
                    <Input
                      value={selectedOrder.sim_number || ""}
                      onChange={(e) =>
                        setSelectedOrder({ ...selectedOrder, sim_number: e.target.value })
                      }
                      placeholder="SIM..."
                    />
                  </div>
                  <div>
                    <Label>IMEI</Label>
                    <Input
                      value={selectedOrder.imei_number || ""}
                      onChange={(e) =>
                        setSelectedOrder({ ...selectedOrder, imei_number: e.target.value })
                      }
                      placeholder="IMEI..."
                    />
                  </div>
                  <div>
                    <Label>Série</Label>
                    <Input
                      value={selectedOrder.serial_number || ""}
                      onChange={(e) =>
                        setSelectedOrder({ ...selectedOrder, serial_number: e.target.value })
                      }
                      placeholder="Série..."
                    />
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={selectedOrder.notes || ""}
                    onChange={(e) => setSelectedOrder({ ...selectedOrder, notes: e.target.value })}
                    placeholder="Notes internes..."
                  />
                </div>
                <div className="flex gap-2">
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
                    onClick={() => {
                      sendUpdateMutation.mutate(selectedOrder.id);
                    }}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Notifier le client
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminOrders;
