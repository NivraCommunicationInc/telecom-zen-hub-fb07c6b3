/**
 * AccountOrdersTab — Full order history for the account
 */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface AccountOrdersTabProps {
  orders: any[];
}

const orderStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "outline" },
  processing: { label: "En traitement", variant: "secondary" },
  completed: { label: "Terminée", variant: "default" },
  cancelled: { label: "Annulée", variant: "destructive" },
  delivered: { label: "Livrée", variant: "default" },
  installed: { label: "Installée", variant: "default" },
  activated: { label: "Activée", variant: "default" },
  failed: { label: "Échouée", variant: "destructive" },
};

export function AccountOrdersTab({ orders }: AccountOrdersTabProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Historique des commandes ({orders.length})</h3>
      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Aucune commande</p>
      ) : (
        <div className="space-y-2">
          {orders.map((order: any) => {
            const st = orderStatusConfig[order.status] || { label: order.status, variant: "outline" as const };
            return (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 rounded-md border hover:bg-accent/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/admin/orders/${order.id}`)}
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-mono font-medium">{order.order_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.service_type && `${order.service_type} • `}
                      {order.created_at && format(new Date(order.created_at), "d MMM yyyy à HH:mm", { locale: fr })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {order.total_price != null && (
                    <span className="text-sm font-medium">{order.total_price.toFixed(2)} $</span>
                  )}
                  <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
