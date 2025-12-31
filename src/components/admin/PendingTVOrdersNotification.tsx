import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tv, AlertCircle, ArrowRight, User, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface PendingTVOrder {
  id: string;
  order_number: string;
  service_type: string;
  status: string;
  created_at: string;
  client_email: string;
  selected_channels: any;
  profiles?: {
    full_name: string | null;
    email: string | null;
  };
}

const PendingTVOrdersNotification = () => {
  const { data: pendingOrders, isLoading } = useQuery({
    queryKey: ["admin-pending-tv-orders"],
    queryFn: async () => {
      // Fetch orders that are TV related and pending channel confirmation
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

      // Fetch profiles for each order
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
    refetchInterval: 30000, // Refresh every 30 seconds for live updates
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
                    <span>{channelCount} chaîne{channelCount !== 1 ? "s" : ""} sélectionnée{channelCount !== 1 ? "s" : ""}</span>
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
                <Link to="/admin/orders">
                  <Button size="sm" variant="outline" className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10">
                    Confirmer
                  </Button>
                </Link>
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
  );
};

export default PendingTVOrdersNotification;
