import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Tv, AlertCircle, ArrowRight, User, Clock, CheckCircle, X, Loader2, Pencil, Search, Plus, Minus } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

interface ChannelSelection {
  id?: string;
  name: string;
  type: "base" | "free_choice" | "paid";
  price?: number;
  category?: string;
}

interface TVChannel {
  id: string;
  name: string;
  category: string;
  price: number | null;
  is_active: boolean;
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
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedChannels, setEditedChannels] = useState<ChannelSelection[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  // Fetch available channels from tv_channels table
  const { data: availableChannels } = useQuery({
    queryKey: ["available-tv-channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tv_channels")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as TVChannel[];
    },
    enabled: confirmDialogOpen,
  });

  const { data: pendingOrders, isLoading } = useQuery({
    queryKey: ["admin-pending-tv-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(`id, order_number, service_type, status, created_at, client_email, selected_channels, user_id`)
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
          return { ...order, profiles: profile };
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

  // Initialize edited channels when order is selected
  useEffect(() => {
    if (selectedOrder && confirmDialogOpen) {
      const channels = Array.isArray(selectedOrder.selected_channels) 
        ? (selectedOrder.selected_channels as ChannelSelection[])
        : [];
      setEditedChannels(channels);
      setIsEditMode(false);
      setSearchQuery("");
    }
  }, [selectedOrder, confirmDialogOpen]);

  const confirmChannelsMutation = useMutation({
    mutationFn: async ({ order, channels }: { order: PendingTVOrder; channels: ChannelSelection[] }) => {
      const { error: orderError } = await supabase
        .from("orders")
        .update({
          status: "confirmed",
          channel_selection_locked: false,
          selected_channels: JSON.parse(JSON.stringify(channels)),
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (orderError) throw orderError;

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
      confirmChannelsMutation.mutate({ order: selectedOrder, channels: editedChannels });
    }
  };

  const getChannelsByType = (channels: ChannelSelection[]) => {
    return {
      base: channels.filter((ch) => ch.type === "base"),
      free: channels.filter((ch) => ch.type === "free_choice"),
      paid: channels.filter((ch) => ch.type === "paid"),
    };
  };

  const isChannelSelected = (channelName: string) => {
    return editedChannels.some((ch) => ch.name === channelName);
  };

  const getChannelType = (category: string): "base" | "free_choice" | "paid" => {
    const baseCategories = ["base", "basic", "inclus"];
    const paidCategories = ["premium", "sports", "paid", "payant"];
    
    if (baseCategories.some(c => category.toLowerCase().includes(c))) return "base";
    if (paidCategories.some(c => category.toLowerCase().includes(c))) return "paid";
    return "free_choice";
  };

  const toggleChannel = (channel: TVChannel) => {
    const channelType = getChannelType(channel.category);
    
    if (isChannelSelected(channel.name)) {
      setEditedChannels(prev => prev.filter(ch => ch.name !== channel.name));
    } else {
      setEditedChannels(prev => [
        ...prev,
        {
          id: channel.id,
          name: channel.name,
          type: channelType,
          price: channel.price || 0,
          category: channel.category,
        },
      ]);
    }
  };

  const removeChannel = (channelName: string) => {
    setEditedChannels(prev => prev.filter(ch => ch.name !== channelName));
  };

  const filteredChannels = availableChannels?.filter(ch => 
    ch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ch.category.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const groupedAvailableChannels = filteredChannels.reduce((acc, ch) => {
    if (!acc[ch.category]) acc[ch.category] = [];
    acc[ch.category].push(ch);
    return acc;
  }, {} as Record<string, TVChannel[]>);

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

  const { base, free, paid } = getChannelsByType(editedChannels);
  const totalPaidPrice = paid.reduce((sum, ch) => sum + (ch.price || 0), 0);

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
            const channelCount = Array.isArray(order.selected_channels) ? order.selected_channels.length : 0;
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

      {/* Edit & Confirm Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tv className="w-5 h-5 text-cyan-400" />
                {isEditMode ? "Modifier les chaînes" : "Confirmer les chaînes"} - {selectedOrder?.order_number}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditMode(!isEditMode)}
                className="text-cyan-400"
              >
                {isEditMode ? <X className="w-4 h-4 mr-1" /> : <Pencil className="w-4 h-4 mr-1" />}
                {isEditMode ? "Annuler modif." : "Modifier"}
              </Button>
            </DialogTitle>
            <DialogDescription>
              Client: {selectedOrder?.profiles?.full_name || selectedOrder?.client_email || "N/A"}
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4 overflow-hidden">
              {isEditMode ? (
                /* Edit Mode - Show available channels */
                <Tabs defaultValue="current" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="current">Sélection actuelle ({editedChannels.length})</TabsTrigger>
                    <TabsTrigger value="available">Ajouter des chaînes</TabsTrigger>
                  </TabsList>

                  <TabsContent value="current" className="space-y-4">
                    {/* Current Selection with Remove Buttons */}
                    {base.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Badge className="bg-emerald-500/20 text-emerald-400">Base ({base.length})</Badge>
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {base.map((ch, idx) => (
                            <Badge key={idx} variant="outline" className="pr-1 flex items-center gap-1">
                              {ch.name}
                              <button
                                onClick={() => removeChannel(ch.name)}
                                className="ml-1 hover:text-red-400 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {free.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Badge className="bg-cyan-500/20 text-cyan-400">Au choix ({free.length})</Badge>
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {free.map((ch, idx) => (
                            <Badge key={idx} variant="outline" className="border-cyan-500/30 pr-1 flex items-center gap-1">
                              {ch.name}
                              <button
                                onClick={() => removeChannel(ch.name)}
                                className="ml-1 hover:text-red-400 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {paid.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Badge className="bg-purple-500/20 text-purple-400">Payantes ({paid.length})</Badge>
                          <span className="text-xs text-purple-400">+${totalPaidPrice.toFixed(2)}/mois</span>
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {paid.map((ch, idx) => (
                            <Badge key={idx} variant="outline" className="border-purple-500/30 pr-1 flex items-center gap-1">
                              {ch.name} {ch.price ? `($${ch.price})` : ""}
                              <button
                                onClick={() => removeChannel(ch.name)}
                                className="ml-1 hover:text-red-400 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {editedChannels.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">
                        Aucune chaîne sélectionnée. Utilisez l'onglet "Ajouter des chaînes".
                      </p>
                    )}
                  </TabsContent>

                  <TabsContent value="available" className="space-y-4">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Rechercher une chaîne..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>

                    <ScrollArea className="h-[300px] pr-4">
                      {Object.entries(groupedAvailableChannels).map(([category, channels]) => (
                        <div key={category} className="mb-4">
                          <h4 className="text-sm font-medium text-muted-foreground mb-2 sticky top-0 bg-background py-1">
                            {category} ({channels.length})
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            {channels.map((ch) => {
                              const isSelected = isChannelSelected(ch.name);
                              return (
                                <div
                                  key={ch.id}
                                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all ${
                                    isSelected
                                      ? "border-cyan-500 bg-cyan-500/10"
                                      : "border-border hover:border-muted-foreground"
                                  }`}
                                  onClick={() => toggleChannel(ch)}
                                >
                                  <Checkbox checked={isSelected} />
                                  <span className="text-sm flex-1 truncate">{ch.name}</span>
                                  {ch.price && ch.price > 0 && (
                                    <Badge variant="secondary" className="text-xs bg-purple-500/20 text-purple-400">
                                      ${ch.price}
                                    </Badge>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      {filteredChannels.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">
                          Aucune chaîne trouvée
                        </p>
                      )}
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              ) : (
                /* View Mode - Show current selection */
                <>
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
                            <Badge key={idx} variant="outline" className="text-xs">{ch.name}</Badge>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

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
                            <Badge key={idx} variant="outline" className="text-xs border-cyan-500/30">{ch.name}</Badge>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {paid.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                        <Badge variant="secondary" className="bg-purple-500/20 text-purple-400">
                          Chaînes payantes ({paid.length})
                        </Badge>
                        <span className="text-xs text-purple-400">+${totalPaidPrice.toFixed(2)}/mois</span>
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
                </>
              )}

              {/* Summary */}
              <div className="bg-accent/50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total chaînes</span>
                  <span className="font-medium">{editedChannels.length} chaînes</span>
                </div>
                {totalPaidPrice > 0 && (
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-sm text-muted-foreground">Frais mensuels supplémentaires</span>
                    <span className="font-medium text-purple-400">+${totalPaidPrice.toFixed(2)}/mois</span>
                  </div>
                )}
              </div>
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
