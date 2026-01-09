/**
 * Client Portal - Orders Page
 * 
 * Displays client's order history.
 */

import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Package, Calendar, DollarSign } from "lucide-react";
import { portalSupabase } from "@/integrations/supabase/portalClient";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  service_type: string;
}

const PortalOrders = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isFrench = language === "fr";
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      const { data: { session } } = await portalSupabase.auth.getSession();
      
      if (!session) {
        navigate("/portal/auth", { 
          state: { redirectTo: "/portal/orders" },
          replace: true 
        });
        return;
      }

      const { data } = await portalSupabase
        .from("orders")
        .select("id, order_number, status, total_amount, created_at, service_type")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      setOrders(data || []);
      setIsLoading(false);
    };

    fetchOrders();
  }, [navigate]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      completed: "default",
      pending: "secondary",
      processing: "secondary",
      cancelled: "destructive",
    };
    const labels: Record<string, string> = {
      completed: isFrench ? "Complété" : "Completed",
      pending: isFrench ? "En attente" : "Pending",
      processing: isFrench ? "En cours" : "Processing",
      cancelled: isFrench ? "Annulé" : "Cancelled",
    };
    return (
      <Badge variant={variants[status] || "outline"}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link to="/portal/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {isFrench ? "Retour au tableau de bord" : "Back to dashboard"}
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">
            {isFrench ? "Mes commandes" : "My Orders"}
          </h1>
          <Link to="/portal/new-order">
            <Button>
              {isFrench ? "Nouvelle commande" : "New Order"}
            </Button>
          </Link>
        </div>

        {orders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {isFrench ? "Aucune commande trouvée" : "No orders found"}
              </p>
              <Link to="/portal/new-order">
                <Button className="mt-4">
                  {isFrench ? "Passer une commande" : "Place an order"}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">
                      {isFrench ? "Commande" : "Order"} #{order.order_number}
                    </CardTitle>
                    {getStatusBadge(order.status)}
                  </div>
                  <CardDescription>
                    {order.service_type}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(order.created_at), "PPP", { 
                        locale: isFrench ? fr : undefined 
                      })}
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      {order.total_amount?.toFixed(2)} $
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default PortalOrders;
