import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Package, 
  CreditCard, 
  Truck, 
  CheckCircle, 
  Clock, 
  MapPin, 
  Receipt,
  Loader2,
  Copy
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { portalClient as supabase } from "@/integrations/backend/portalClient";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";
import { useClientAuth } from "@/hooks/useClientAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ClientEquipmentOrderDetailsProps {
  order: any;
  onClose: () => void;
}

// Equipment order statuses for client view
const statusConfig: Record<string, { color: string; label: string; icon: any }> = {
  pending: { color: "bg-amber-500/20 text-amber-500", label: "Brouillon", icon: Clock },
  payment_pending: { color: "bg-amber-500/20 text-amber-500", label: "Paiement en attente", icon: CreditCard },
  paid: { color: "bg-blue-500/20 text-blue-500", label: "Payé", icon: CheckCircle },
  ready_to_ship: { color: "bg-cyan-500/20 text-cyan-500", label: "Prêt à expédier", icon: Package },
  shipped: { color: "bg-purple-500/20 text-purple-500", label: "Expédié", icon: Truck },
  completed: { color: "bg-emerald-500/20 text-emerald-500", label: "Terminé", icon: CheckCircle },
  cancelled: { color: "bg-red-500/20 text-red-500", label: "Annulé", icon: Clock },
};

import { useWriteGuard } from "@/hooks/useWriteGuard";

export default function ClientEquipmentOrderDetails({ order, onClose }: ClientEquipmentOrderDetailsProps) {
  const queryClient = useQueryClient();
  const writeGuard = useWriteGuard();
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch order lines
  const { data: orderLines, isLoading: loadingLines } = useQuery({
    queryKey: ["client-equipment-order-lines", order.id],
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

  // Calculate balance
  const totalAmount = Number(order.total_amount) || 0;
  const amountPaid = Number(order.amount_paid) || 0;
  const balanceDue = totalAmount - amountPaid;

  // Check if payment is allowed
  const canPay = balanceDue > 0 && 
    (order.status === "payment_pending" || order.status === "pending") &&
    order.payment_status !== "captured" && 
    order.payment_status !== "paid";

  // ============================================================
  // LEGACY BILLING INSERT REMOVED (P0 cleanup)
  // Equipment order payments must go through the canonical
  // PayPal checkout flow or be recorded by an admin in Core.
  // The client portal does NOT fabricate invoices or payments.
  // ============================================================

  const handlePayNow = writeGuard(() => {
    // Redirect client to the canonical portal payment page
    toast.info("Veuillez utiliser la section Facturation de votre portail pour effectuer le paiement.", { duration: 5000 });
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié`);
  };

  const StatusIcon = statusConfig[order.status]?.icon || Clock;

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto">
      {/* Status Header */}
      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            statusConfig[order.status]?.color?.replace("text-", "bg-").split(" ")[0] || "bg-muted"
          }`}>
            <StatusIcon className={`w-5 h-5 ${statusConfig[order.status]?.color?.split(" ")[1] || "text-muted-foreground"}`} />
          </div>
          <div>
            <p className="font-medium">Commande Équipement</p>
            <p className="text-sm text-muted-foreground font-mono">{order.order_number || `#${order.id.slice(0, 8)}`}</p>
          </div>
        </div>
        <Badge className={statusConfig[order.status]?.color || "bg-muted"}>
          {statusConfig[order.status]?.label || order.status}
        </Badge>
      </div>

      {/* Order Items */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Articles commandés
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingLines ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {orderLines?.map((line: any) => (
                <div key={line.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{line.item_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Qté: {line.quantity} × {Number(line.unit_price).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                    </p>
                    {/* Show serial numbers (read-only for client) */}
                    {line.serial_numbers && line.serial_numbers.length > 0 && (
                      <div className="mt-1">
                        {line.serial_numbers.map((sn: string, idx: number) => (
                          sn && (
                            <span key={idx} className="inline-block text-xs font-mono bg-muted px-2 py-0.5 rounded mr-1">
                              S/N: {sn}
                            </span>
                          )
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="font-medium">
                    {Number(line.line_total).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" />
            Résumé de la commande
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Sous-total</span>
            <span>{Number(order.subtotal || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
          </div>
          {order.delivery_fee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Livraison</span>
              <span>{Number(order.delivery_fee).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">TPS (5%)</span>
            <span>{Number(order.tps_amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">TVQ (9.975%)</span>
            <span>{Number(order.tvq_amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{totalAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
          </div>
          {amountPaid > 0 && (
            <div className="flex justify-between text-sm text-emerald-600">
              <span>Montant payé</span>
              <span>{amountPaid.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
            </div>
          )}
          {balanceDue > 0 && (
            <div className="flex justify-between font-bold text-amber-600">
              <span>Solde à payer</span>
              <span>{balanceDue.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shipping Address */}
      {(order.shipping_address || order.shipping_city) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Adresse de livraison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {order.shipping_address}
              {order.shipping_city && `, ${order.shipping_city}`}
              {order.shipping_province && `, ${order.shipping_province}`}
              {order.shipping_postal_code && ` ${order.shipping_postal_code}`}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tracking Info */}
      {order.tracking_number && (
        <Card className="border-cyan-500/30 bg-cyan-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Truck className="w-4 h-4 text-cyan-500" />
              Suivi d'expédition
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                {order.carrier && <p className="text-sm text-muted-foreground">{order.carrier}</p>}
                <p className="font-mono text-cyan-600">{order.tracking_number}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(order.tracking_number, "Numéro de suivi")}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            {order.tracking_url && (
              <Button
                variant="link"
                className="p-0 h-auto mt-2 text-cyan-500"
                onClick={() => window.open(order.tracking_url, "_blank")}
              >
                Suivre mon colis →
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Section */}
      {canPay && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              Paiement requis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-background rounded-lg border">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">Solde à payer</span>
                <span className="text-2xl font-bold text-primary">
                  {balanceDue.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </span>
              </div>
            </div>
            <Button
              onClick={handlePayNow}
              disabled={isProcessing || writeGuard.isReadOnly}
              title={writeGuard.disabledReason}
              className="w-full h-12 text-lg"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Traitement en cours...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5 mr-2" />
                  Payer maintenant
                </>
              )}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Paiement sécurisé • Facture générée automatiquement
            </p>
          </CardContent>
        </Card>
      )}

      {/* Payment Completed Notice */}
      {!canPay && balanceDue <= 0 && order.payment_status === "captured" && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="font-medium text-emerald-600">Paiement complété</p>
                <p className="text-sm text-muted-foreground">
                  Votre facture est disponible dans la section Factures
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order Date */}
      <div className="text-center text-sm text-muted-foreground pb-2">
        Commande passée le {format(new Date(order.created_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
      </div>
    </div>
  );
}
