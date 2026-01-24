import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Package, Truck, CreditCard, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { useToast } from "@/hooks/use-toast";

interface EquipmentOrderDetailsProps {
  order: any;
  onUpdate: () => void;
}

// Equipment order statuses
const equipmentStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-amber-500/20 text-amber-500", label: "En attente de paiement" },
  payment_pending: { color: "bg-amber-500/20 text-amber-500", label: "Paiement en attente" },
  paid: { color: "bg-blue-500/20 text-blue-500", label: "Payé" },
  ready_to_ship: { color: "bg-cyan-500/20 text-cyan-500", label: "Prêt à expédier" },
  shipped: { color: "bg-purple-500/20 text-purple-500", label: "Expédié" },
  completed: { color: "bg-emerald-500/20 text-emerald-500", label: "Terminé" },
  cancelled: { color: "bg-red-500/20 text-red-500", label: "Annulé" },
};

const paymentStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-amber-500/20 text-amber-500", label: "En attente" },
  verification: { color: "bg-blue-500/20 text-blue-500", label: "Vérification" },
  paid: { color: "bg-emerald-500/20 text-emerald-500", label: "Payé" },
  captured: { color: "bg-emerald-500/20 text-emerald-500", label: "Capturé" },
  declined: { color: "bg-red-500/20 text-red-500", label: "Refusé" },
  fraud: { color: "bg-red-600/20 text-red-600", label: "Fraude" },
};

export default function EquipmentOrderDetails({ order, onUpdate }: EquipmentOrderDetailsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [paymentForm, setPaymentForm] = useState({
    payment_method: "card",
    payment_reference: "",
    amount: order.total_amount || 0,
  });

  const [shippingForm, setShippingForm] = useState({
    tracking_number: order.tracking_number || "",
    tracking_url: order.tracking_url || "",
    carrier: order.carrier || "",
  });

  // Fetch order lines
  const { data: orderLines, isLoading: loadingLines, refetch: refetchLines } = useQuery({
    queryKey: ["equipment-order-lines", order.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_order_lines")
        .select("*")
        .eq("order_id", order.id)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  // Check if all required serial numbers are entered
  const allSerialsEntered = orderLines?.every((line: any) => {
    if (!line.requires_serial) return true;
    const serials = line.serial_numbers || [];
    return serials.length >= line.quantity && serials.every((s: string) => s.trim() !== "");
  });

  const hasSerialRequirements = orderLines?.some((line: any) => line.requires_serial);

  // Update serial numbers
  const updateSerialsMutation = useMutation({
    mutationFn: async ({ lineId, serials }: { lineId: string; serials: string[] }) => {
      const { error } = await supabase
        .from("equipment_order_lines")
        .update({ serial_numbers: serials })
        .eq("id", lineId);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchLines();
      toast({ title: "Numéros de série mis à jour" });
    },
    onError: () => {
      toast({ title: "Erreur", variant: "destructive" });
    },
  });

  // Process payment mutation
  const processPaymentMutation = useMutation({
    mutationFn: async () => {
      const currentUser = (await supabase.auth.getUser()).data.user;
      
      // Update order to paid status
      const { error: orderError } = await supabase
        .from("orders")
        .update({
          payment_status: "captured",
          status: allSerialsEntered || !hasSerialRequirements ? "ready_to_ship" : "paid",
          payment_reference: paymentForm.payment_reference || `NIVRA-EQ-${Date.now()}`,
          amount_paid: paymentForm.amount,
          processed_by: currentUser?.id,
          processed_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (orderError) throw orderError;

      // ============================================================
      // TODO: LEGACY BILLING - Migrate to billing_invoices V2
      // Source of truth temporaire: billing table
      // Date: 2026-01-24 - Backlog migration
      // ============================================================
      const { error: billingError } = await supabase.from("billing").insert({
        user_id: order.user_id,
        client_email: order.client_email,
        order_id: order.id,
        related_order_number: order.order_number,
        amount: order.total_amount,
        subtotal: order.subtotal,
        delivery_fee: order.delivery_fee || 0,
        tps_amount: order.tps_amount,
        tvq_amount: order.tvq_amount,
        status: "paid",
        paid_at: new Date().toISOString(),
        amount_paid: paymentForm.amount,
        payment_reference: paymentForm.payment_reference,
        notes: `Commande équipement - ${paymentForm.payment_method}`,
      });

      if (billingError) {
        console.error("[LEGACY] billing insert error:", billingError);
        throw billingError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({ title: "Paiement traité et facture générée" });
      onUpdate();
    },
    onError: (error: any) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  // Ship order mutation
  const shipOrderMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "shipped",
          tracking_number: shippingForm.tracking_number,
          tracking_url: shippingForm.tracking_url,
          carrier: shippingForm.carrier,
          shipped_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({ title: "Commande expédiée" });
      onUpdate();
    },
    onError: () => {
      toast({ title: "Erreur lors de l'expédition", variant: "destructive" });
    },
  });

  // Complete order mutation
  const completeOrderMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("orders")
        .update({ status: "completed" })
        .eq("id", order.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({ title: "Commande terminée" });
      onUpdate();
    },
  });

  const isPaid = order.payment_status === "captured" || order.payment_status === "paid";
  const canShip = isPaid && allSerialsEntered && order.status !== "shipped" && order.status !== "completed";
  const isShipped = order.status === "shipped";

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium">Commande Équipement</p>
                <p className="text-sm text-muted-foreground">{order.order_number}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={equipmentStatusConfig[order.status]?.color || "bg-gray-500/20"}>
                {equipmentStatusConfig[order.status]?.label || order.status}
              </Badge>
              <Badge className={paymentStatusConfig[order.payment_status]?.color || "bg-gray-500/20"}>
                {paymentStatusConfig[order.payment_status]?.label || order.payment_status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Order Lines */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="w-4 h-4" />
            Articles commandés
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingLines ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            orderLines?.map((line: any) => (
              <div key={line.id} className="p-3 border rounded-md space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{line.item_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {line.item_sku && `SKU: ${line.item_sku} • `}
                      Qté: {line.quantity} × ${line.unit_price.toFixed(2)} = ${line.line_total.toFixed(2)}
                    </p>
                  </div>
                  {line.requires_serial && (
                    <Badge variant={
                      (line.serial_numbers?.length || 0) >= line.quantity ? "default" : "secondary"
                    }>
                      {line.serial_numbers?.length || 0}/{line.quantity} S/N
                    </Badge>
                  )}
                </div>

                {/* Serial Number Inputs */}
                {line.requires_serial && (
                  <div className="space-y-2 pt-2 border-t">
                    <Label className="text-xs">Numéros de série</Label>
                    {Array.from({ length: line.quantity }).map((_, idx) => (
                      <Input
                        key={idx}
                        placeholder={`S/N ${idx + 1}`}
                        value={line.serial_numbers?.[idx] || ""}
                        onChange={(e) => {
                          const newSerials = [...(line.serial_numbers || [])];
                          newSerials[idx] = e.target.value;
                          updateSerialsMutation.mutate({ lineId: line.id, serials: newSerials });
                        }}
                        className="h-8 text-sm"
                      />
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Payment Section */}
      {!isPaid && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Traiter le paiement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Méthode</Label>
                <Select
                  value={paymentForm.payment_method}
                  onValueChange={(v) => setPaymentForm({ ...paymentForm, payment_method: v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card">Carte</SelectItem>
                    <SelectItem value="e-transfer">Virement</SelectItem>
                    <SelectItem value="cash">Comptant</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Montant</Label>
                <Input
                  type="number"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: parseFloat(e.target.value) || 0 })}
                  className="h-9"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Référence de paiement</Label>
              <Input
                placeholder="Numéro de transaction..."
                value={paymentForm.payment_reference}
                onChange={(e) => setPaymentForm({ ...paymentForm, payment_reference: e.target.value })}
                className="h-9"
              />
            </div>
            <Button
              onClick={() => processPaymentMutation.mutate()}
              disabled={processPaymentMutation.isPending}
              className="w-full"
            >
              {processPaymentMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Confirmer paiement et générer facture
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Serial Number Warning */}
      {isPaid && hasSerialRequirements && !allSerialsEntered && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-4 h-4" />
              <p className="text-sm font-medium">
                Tous les numéros de série doivent être saisis avant l'expédition
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Shipping Section */}
      {isPaid && (order.status === "paid" || order.status === "ready_to_ship" || canShip) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Expédition
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Transporteur</Label>
                <Input
                  placeholder="Purolator, Postes Canada..."
                  value={shippingForm.carrier}
                  onChange={(e) => setShippingForm({ ...shippingForm, carrier: e.target.value })}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Numéro de suivi</Label>
                <Input
                  placeholder="Numéro de suivi..."
                  value={shippingForm.tracking_number}
                  onChange={(e) => setShippingForm({ ...shippingForm, tracking_number: e.target.value })}
                  className="h-9"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">URL de suivi</Label>
              <Input
                placeholder="https://..."
                value={shippingForm.tracking_url}
                onChange={(e) => setShippingForm({ ...shippingForm, tracking_url: e.target.value })}
                className="h-9"
              />
            </div>
            <Button
              onClick={() => shipOrderMutation.mutate()}
              disabled={!canShip || shipOrderMutation.isPending}
              className="w-full"
            >
              {shipOrderMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Truck className="w-4 h-4 mr-2" />
              )}
              Marquer comme expédié
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Complete Order */}
      {isShipped && order.status !== "completed" && (
        <Button
          onClick={() => completeOrderMutation.mutate()}
          disabled={completeOrderMutation.isPending}
          variant="outline"
          className="w-full"
        >
          {completeOrderMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <CheckCircle className="w-4 h-4 mr-2" />
          )}
          Marquer comme terminé
        </Button>
      )}
    </div>
  );
}
