import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Plus, Minus, Truck, ShoppingCart, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EquipmentOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Array<{ user_id: string; email: string; full_name: string }>;
  onSuccess?: () => void;
}

interface CartItem {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  quantity: number;
  requires_serial: boolean;
  type: string;
}

const TPS_RATE = 0.05;
const TVQ_RATE = 0.09975;
const DEFAULT_DELIVERY_FEE = 30;

export default function EquipmentOrderDialog({
  open,
  onOpenChange,
  clients,
  onSuccess,
}: EquipmentOrderDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedClientId, setSelectedClientId] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"ship" | "pickup">("ship");
  const [shippingAddress, setShippingAddress] = useState({
    address: "",
    city: "",
    province: "QC",
    postal_code: "",
  });
  const [internalNotes, setInternalNotes] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [catalogTab, setCatalogTab] = useState("all");

  // Fetch inventory items
  const { data: inventoryItems, isLoading: loadingInventory } = useQuery({
    queryKey: ["inventory-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .in("status", ["active", "hold"])
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  // Filter items by type
  const filteredItems = useMemo(() => {
    if (!inventoryItems) return [];
    if (catalogTab === "all") return inventoryItems;
    return inventoryItems.filter((item: any) => item.type === catalogTab);
  }, [inventoryItems, catalogTab]);

  // Get selected client profile for prefilling address
  const selectedClient = useMemo(() => {
    return clients.find((c) => c.user_id === selectedClientId);
  }, [clients, selectedClientId]);

  // Fetch client profile for address
  const { data: clientProfile } = useQuery({
    queryKey: ["client-profile-address", selectedClientId],
    enabled: !!selectedClientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("service_address, service_city, service_province, service_postal_code")
        .eq("user_id", selectedClientId)
        .single();
      if (error) return null;
      return data;
    },
  });

  // Auto-fill shipping address when client is selected
  const handleClientSelect = (userId: string) => {
    setSelectedClientId(userId);
  };

  // Prefill address when clientProfile loads
  useMemo(() => {
    if (clientProfile && deliveryMethod === "ship") {
      setShippingAddress({
        address: clientProfile.service_address || "",
        city: clientProfile.service_city || "",
        province: clientProfile.service_province || "QC",
        postal_code: clientProfile.service_postal_code || "",
      });
    }
  }, [clientProfile, deliveryMethod]);

  // Cart operations
  const addToCart = (item: any) => {
    const existing = cart.find((c) => c.id === item.id);
    if (existing) {
      setCart(cart.map((c) => (c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c)));
    } else {
      setCart([
        ...cart,
        {
          id: item.id,
          name: item.name,
          sku: item.sku,
          price: item.price,
          quantity: 1,
          requires_serial: item.requires_serial,
          type: item.type,
        },
      ]);
    }
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(
      cart
        .map((c) => (c.id === itemId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter((c) => c.id !== itemId));
  };

  // Calculate totals
  const calculations = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const deliveryFee = deliveryMethod === "ship" ? DEFAULT_DELIVERY_FEE : 0;
    const taxableAmount = subtotal + deliveryFee;
    const tps = taxableAmount * TPS_RATE;
    const tvq = taxableAmount * TVQ_RATE;
    const total = taxableAmount + tps + tvq;

    return { subtotal, deliveryFee, tps, tvq, total };
  }, [cart, deliveryMethod]);

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClientId || cart.length === 0) {
        throw new Error("Veuillez sélectionner un client et ajouter des articles");
      }

      const client = clients.find((c) => c.user_id === selectedClientId);

      // Create the equipment order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: selectedClientId,
          client_email: client?.email,
          service_type: "equipment",
          category: "equipment",
          order_type: "equipment",
          status: "pending",
          payment_status: "pending",
          subtotal: calculations.subtotal,
          delivery_fee: calculations.deliveryFee,
          activation_fee: 0,
          installation_fee: 0,
          tps_amount: calculations.tps,
          tvq_amount: calculations.tvq,
          total_amount: calculations.total,
          delivery_method: deliveryMethod === "ship" ? "Standard Québec Delivery" : "Pickup",
          shipping_address: deliveryMethod === "ship" ? shippingAddress.address : null,
          shipping_city: deliveryMethod === "ship" ? shippingAddress.city : null,
          shipping_province: deliveryMethod === "ship" ? shippingAddress.province : null,
          shipping_postal_code: deliveryMethod === "ship" ? shippingAddress.postal_code : null,
          internal_notes: internalNotes || null,
          created_by: "admin",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order lines
      const orderLines = cart.map((item) => ({
        order_id: order.id,
        inventory_item_id: item.id,
        item_name: item.name,
        item_sku: item.sku,
        unit_price: item.price,
        quantity: item.quantity,
        line_total: item.price * item.quantity,
        requires_serial: item.requires_serial,
        serial_numbers: [],
      }));

      const { error: linesError } = await supabase.from("equipment_order_lines").insert(orderLines);

      if (linesError) throw linesError;

      return order;
    },
    onSuccess: (order) => {
      toast({
        title: "Commande créée",
        description: `Commande équipement #${order.order_number || order.id.slice(0, 8)} créée avec succès`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer la commande",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setSelectedClientId("");
    setDeliveryMethod("ship");
    setShippingAddress({ address: "", city: "", province: "QC", postal_code: "" });
    setInternalNotes("");
    setCart([]);
  };

  const canSubmit = selectedClientId && cart.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Nouvelle commande équipement / accessoires
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Client & Items Selection */}
          <div className="space-y-4 overflow-auto pr-2">
            {/* Client Selection */}
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select value={selectedClientId} onValueChange={handleClientSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.user_id} value={client.user_id}>
                      {client.full_name || client.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Delivery Method */}
            <div className="space-y-2">
              <Label>Méthode de livraison</Label>
              <Select
                value={deliveryMethod}
                onValueChange={(v) => setDeliveryMethod(v as "ship" | "pickup")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ship">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4" />
                      Livraison (+${DEFAULT_DELIVERY_FEE})
                    </div>
                  </SelectItem>
                  <SelectItem value="pickup">Ramassage en magasin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Shipping Address */}
            {deliveryMethod === "ship" && (
              <div className="space-y-2 p-3 border rounded-md bg-muted/30">
                <Label className="text-sm font-medium">Adresse de livraison</Label>
                <Input
                  placeholder="Adresse"
                  value={shippingAddress.address}
                  onChange={(e) => setShippingAddress({ ...shippingAddress, address: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Ville"
                    value={shippingAddress.city}
                    onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
                  />
                  <Input
                    placeholder="Code postal"
                    value={shippingAddress.postal_code}
                    onChange={(e) =>
                      setShippingAddress({ ...shippingAddress, postal_code: e.target.value })
                    }
                  />
                </div>
              </div>
            )}

            {/* Catalog */}
            <div className="space-y-2">
              <Label>Catalogue</Label>
              <Tabs value={catalogTab} onValueChange={setCatalogTab}>
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="all">Tous</TabsTrigger>
                  <TabsTrigger value="equipment">Équipement</TabsTrigger>
                  <TabsTrigger value="accessory">Accessoires</TabsTrigger>
                </TabsList>
              </Tabs>

              <ScrollArea className="h-48 border rounded-md p-2">
                {loadingInventory ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredItems.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">Aucun article</div>
                ) : (
                  <div className="space-y-2">
                    {filteredItems.map((item: any) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 border rounded hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              {item.type === "equipment" ? "Équipement" : "Accessoire"}
                            </Badge>
                            {item.requires_serial && (
                              <Badge variant="secondary" className="text-xs">
                                S/N requis
                              </Badge>
                            )}
                            <span>${item.price.toFixed(2)}</span>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => addToCart(item)}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes internes</Label>
              <Textarea
                placeholder="Notes pour cette commande..."
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          {/* Right: Cart & Summary */}
          <div className="space-y-4 overflow-auto pl-2 border-l">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-muted-foreground" />
              <Label>Panier ({cart.length} article{cart.length !== 1 ? "s" : ""})</Label>
            </div>

            {cart.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 border rounded-md">
                Aucun article ajouté
              </div>
            ) : (
              <ScrollArea className="h-48">
                <div className="space-y-2 pr-2">
                  {cart.map((item) => (
                    <Card key={item.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            ${item.price.toFixed(2)} x {item.quantity} = $
                            {(item.price * item.quantity).toFixed(2)}
                          </p>
                          {item.requires_serial && (
                            <Badge variant="secondary" className="text-xs mt-1">
                              S/N requis
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(item.id, -1)}
                          >
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="w-8 text-center text-sm">{item.quantity}</span>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => updateQuantity(item.id, 1)}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Summary */}
            <Card className="bg-muted/30">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Sous-total</span>
                  <span>${calculations.subtotal.toFixed(2)}</span>
                </div>
                {calculations.deliveryFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Livraison</span>
                    <span>${calculations.deliveryFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>TPS (5%)</span>
                  <span>${calculations.tps.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>TVQ (9.975%)</span>
                  <span>${calculations.tvq.toFixed(2)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>Total</span>
                  <span>${calculations.total.toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Annuler
              </Button>
              <Button
                onClick={() => createOrderMutation.mutate()}
                disabled={!canSubmit || createOrderMutation.isPending}
                className="flex-1"
              >
                {createOrderMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Package className="w-4 h-4 mr-2" />
                )}
                Créer la commande
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
