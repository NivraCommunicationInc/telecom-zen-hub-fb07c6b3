import ClientLayout from "@/components/client/ClientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const ClientOrders = () => {
  const { user } = useAuth();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["client-orders-all", user?.id, user?.email],
    queryFn: async () => {
      // RLS policy handles email matching automatically
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-500",
    processing: "bg-cyan-500/20 text-cyan-500",
    completed: "bg-emerald-500/20 text-emerald-500",
    cancelled: "bg-red-500/20 text-red-500",
  };

  const statusLabels: Record<string, string> = {
    pending: "En attente",
    processing: "En cours",
    completed: "Terminé",
    cancelled: "Annulé",
  };

  return (
    <ClientLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Mes commandes</h1>
          <p className="text-muted-foreground mt-1">Suivez vos commandes et services</p>
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
                {orders.map((order: any) => (
                  <div
                    key={order.id}
                    className="p-4 bg-accent/50 rounded-lg border border-border"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium text-foreground">{order.service_type}</h3>
                          <Badge className={statusColors[order.status] || "bg-muted"}>
                            {statusLabels[order.status] || order.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Commande #{order.id.slice(0, 8)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(order.created_at), "d MMMM yyyy", { locale: fr })}
                        </p>
                        {order.tracking_number && (
                          <p className="text-sm text-cyan-500 mt-2">
                            Suivi: {order.tracking_number}
                          </p>
                        )}
                      </div>
                      {order.total_amount && (
                        <div className="text-right">
                          <p className="text-lg font-bold text-foreground">
                            {Number(order.total_amount).toLocaleString("fr-CA", {
                              style: "currency",
                              currency: "CAD",
                            })}
                          </p>
                        </div>
                      )}
                    </div>
                    {order.notes && (
                      <p className="text-sm text-muted-foreground mt-3 pt-3 border-t border-border">
                        {order.notes}
                      </p>
                    )}
                  </div>
                ))}
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
    </ClientLayout>
  );
};

export default ClientOrders;