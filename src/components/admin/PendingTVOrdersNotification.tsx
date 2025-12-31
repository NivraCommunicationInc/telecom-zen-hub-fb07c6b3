import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tv, AlertCircle, ArrowRight, User, Clock, CheckCircle, X, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

interface ChannelSelection {
  id?: string;
  name: string;
  type: "base" | "free_choice" | "paid";
  price?: number;
}

interface PendingTVOrder {
  id: string;
  order_number: string;
  service_type: string;
  status: string;
  created_at: string;
  client_email: string | null;
  selected_channels: unknown;
  user_id: string;
  profiles?: {
    full_name: string | null;
    email: string | null;
  } | null;
}

const PendingTVOrdersNotification = () => {
  const [selectedOrder, setSelectedOrder] = useState<PendingTVOrder | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: pendingOrders, isLoading } = useQuery({
    queryKey: ["admin-pending-tv-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          order_number,
          service_type,
          status,
          created_at,
          client_email,
          selected_channels,
          user_id
        `)
        .or("service_type.ilike.%tv%,service_type.ilike.%télé%,service_type.ilike.%iptv%")
        .in("status", ["pending", "processing"])
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      const ordersWithProfiles = await Promise.all(
        (data || []).map(async (order) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, email")
            .eq("user_id", order.user_id)
            .maybeSingle();
          
          return {
            ...order,
            profiles: profile,
          };
        })
      );

      return ordersWithProfiles as PendingTVOrder[];
    },
    refetchInterval: 30000,
  });

  const { data: totalPending } = useQuery({
    queryKey: ["admin-total-pending-tv"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .or("service_type.ilike.%tv%,service_type.ilike.%télé%,service_type.ilike.%iptv%")
        .in("status", ["pending", "processing"]);

      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });

  const confirmChannelsMutation = useMutation({
    mutationFn: async (order: PendingTVOrder) => {
      // Update order status to confirmed
      const { error: orderError } = await supabase
        .from("orders")
        .update({
          status: "confirmed",
          channel_selection_locked: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (orderError) throw orderError;

      // Update related support ticket if exists
      const { data: tickets } = await supabase
        .from("support_tickets")
        .select("id")
        .ilike("subject", `%${order.order_number}%`)
        .eq("status", "open")
        .limit(1);

      if (tickets && tickets.length > 0) {
        await supabase
          .from("support_tickets")
          .update({ status: "in_progress" })
          .eq("id", tickets[0].id);
      }

      return order;
    },
    onSuccess: (order) => {
      toast({
        title: "Chaînes confirmées",
        description: `Commande ${order.order_number} confirmée avec succès`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-pending-tv-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-total-pending-tv"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats-dashboard"] });
      setConfirmDialogOpen(false);
      setSelectedOrder(null);
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de confirmer les chaînes",
        variant: "destructive",
      });
      console.error("Confirm error:", error);
    },
  });

  const handleOpenConfirmDialog = (order: PendingTVOrder) => {
    setSelectedOrder(order);
    setConfirmDialogOpen(true);
  };

  const handleConfirmChannels = () => {
    if (selectedOrder) {
      confirmChannelsMutation.mutate(selectedOrder);
    }
  };

  const getChannelsByType = (channels: unknown) => {
    if (!channels || !Array.isArray(channels)) return { base: [] as ChannelSelection[], free: [] as ChannelSelection[], paid: [] as ChannelSelection[] };
    
    const typedChannels = channels as ChannelSelection[];
    return {
      base: typedChannels.filter((ch) => ch.type === "base"),
      free: typedChannels.filter((ch) => ch.type === "free_choice"),
      paid: typedChannels.filter((ch) => ch.type === "paid"),
    };
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/3" />
            <div className="h-20 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!pendingOrders || pendingOrders.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className="relative">
              <Tv className="w-5 h-5 text-amber-400" />
              <AlertCircle className="w-3 h-3 text-amber-500 absolute -top-1 -right-1" />
            </div>
            Commandes TV en attente
            <Badge variant="destructive" className="ml-2 bg-amber-500 hover:bg-amber-600">
              {totalPending}
            </Badge>
          </CardTitle>
          <Link to="/admin/orders">
            <Button variant="ghost" size="sm" className="text-amber-400 hover:text-amber-300">
              Voir toutes <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground mb-4">
            Ces commandes TV nécessitent une confirmation des chaînes
          </p>
          
          {pendingOrders.map((order) => {
            const channelCount = Array.isArray(order.selected_channels) 
              ? order.selected_channels.length 
              : 0;

            return (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border hover:border-amber-500/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {order.profiles?.full_name || order.client_email || "Client"}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{order.order_number}</span>
                      <span>•</span>
                      <span>{channelCount} chaîne{channelCount !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs text-amber-500">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: fr })}
                    </div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                    onClick={() => handleOpenConfirmDialog(order)}
                  >
                    Confirmer
                  </Button>
                </div>
              </div>
            );
          })}

          {totalPending && totalPending > 5 && (
            <p className="text-xs text-center text-muted-foreground pt-2">
              + {totalPending - 5} autres commandes en attente
            </p>
          )}
        </CardContent>
      </Card>

      {/* Quick Confirm Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tv className="w-5 h-5 text-cyan-400" />
              Confirmer les chaînes - {selectedOrder?.order_number}
            </DialogTitle>
            <DialogDescription>
              Client: {selectedOrder?.profiles?.full_name || selectedOrder?.client_email || "N/A"}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              {(() => {
                const { base, free, paid } = getChannelsByType(selectedOrder.selected_channels);
                const totalPaidPrice = paid.reduce((sum, ch) => sum + (ch.price || 0), 0);

                return (
                  <>
                    {/* Base Channels */}
                    {base.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                          <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">
                            Chaînes de base ({base.length})
                          </Badge>
                        </h4>
                        <ScrollArea className="h-24 rounded-md border border-border p-2">
                          <div className="flex flex-wrap gap-1">
                            {base.map((ch, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {ch.name}
                              </Badge>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}

                    {/* Free Choice Channels */}
                    {free.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                          <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-400">
                            Chaînes au choix ({free.length})
                          </Badge>
                        </h4>
                        <ScrollArea className="h-24 rounded-md border border-border p-2">
                          <div className="flex flex-wrap gap-1">
                            {free.map((ch, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs border-cyan-500/30">
                                {ch.name}
                              </Badge>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}

                    {/* Paid Channels */}
                    {paid.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                          <Badge variant="secondary" className="bg-purple-500/20 text-purple-400">
                            Chaînes payantes ({paid.length})
                          </Badge>
                          <span className="text-xs text-purple-400">
                            +${totalPaidPrice.toFixed(2)}/mois
                          </span>
                        </h4>
                        <ScrollArea className="h-24 rounded-md border border-border p-2">
                          <div className="flex flex-wrap gap-1">
                            {paid.map((ch, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs border-purple-500/30">
                                {ch.name} {ch.price && `($${ch.price})`}
                              </Badge>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}

                    {/* Summary */}
                    <div className="bg-accent/50 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Total chaînes</span>
                        <span className="font-medium">
                          {base.length + free.length + paid.length} chaînes
                        </span>
                      </div>
                      {totalPaidPrice > 0 && (
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-sm text-muted-foreground">Frais mensuels supplémentaires</span>
                          <span className="font-medium text-purple-400">
                            +${totalPaidPrice.toFixed(2)}/mois
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
              disabled={confirmChannelsMutation.isPending}
            >
              <X className="w-4 h-4 mr-2" />
              Annuler
            </Button>
            <Button
              onClick={handleConfirmChannels}
              disabled={confirmChannelsMutation.isPending}
              className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600"
            >
              {confirmChannelsMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Confirmer les chaînes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PendingTVOrdersNotification;
