import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Users, CreditCard, TrendingUp, MessageSquare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const AdminDashboard = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [ordersRes, clientsRes, billingRes, requestsRes] = await Promise.all([
        supabase.from("orders").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("billing").select("amount").eq("status", "paid"),
        supabase.from("contact_requests").select("*", { count: "exact", head: true }).eq("status", "new"),
      ]);

      const totalRevenue = billingRes.data?.reduce((sum, b) => sum + Number(b.amount), 0) || 0;

      return {
        orders: ordersRes.count || 0,
        clients: clientsRes.count || 0,
        revenue: totalRevenue,
        requests: requestsRes.count || 0,
      };
    },
  });

  const statCards = [
    {
      title: "Commandes",
      value: stats?.orders || 0,
      icon: Package,
      color: "from-cyan-500 to-cyan-400",
    },
    {
      title: "Clients",
      value: stats?.clients || 0,
      icon: Users,
      color: "from-emerald-500 to-emerald-400",
    },
    {
      title: "Revenus",
      value: `${stats?.revenue?.toLocaleString("fr-CA", { style: "currency", currency: "CAD" }) || "$0"}`,
      icon: CreditCard,
      color: "from-violet-500 to-violet-400",
    },
    {
      title: "Nouvelles demandes",
      value: stats?.requests || 0,
      icon: MessageSquare,
      color: "from-amber-500 to-amber-400",
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Tableau de bord</h1>
          <p className="text-muted-foreground mt-1">Bienvenue dans l'administration Nivra</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat) => (
            <Card key={stat.title} className="bg-card border-border">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.color}`}>
                  <stat.icon className="w-4 h-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="h-8 w-24 bg-muted animate-pulse rounded" />
                ) : (
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              Actions rapides
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a
                href="/admin/requests"
                className="p-4 rounded-lg border border-border hover:border-cyan-400/50 hover:bg-accent/50 transition-all"
              >
                <MessageSquare className="w-6 h-6 text-cyan-400 mb-2" />
                <h3 className="font-medium text-foreground">Voir les demandes</h3>
                <p className="text-sm text-muted-foreground">Traiter les nouvelles demandes de consultation</p>
              </a>
              <a
                href="/admin/orders"
                className="p-4 rounded-lg border border-border hover:border-cyan-400/50 hover:bg-accent/50 transition-all"
              >
                <Package className="w-6 h-6 text-emerald-400 mb-2" />
                <h3 className="font-medium text-foreground">Gérer les commandes</h3>
                <p className="text-sm text-muted-foreground">Voir et mettre à jour les commandes clients</p>
              </a>
              <a
                href="/admin/clients"
                className="p-4 rounded-lg border border-border hover:border-cyan-400/50 hover:bg-accent/50 transition-all"
              >
                <Users className="w-6 h-6 text-violet-400 mb-2" />
                <h3 className="font-medium text-foreground">Gérer les clients</h3>
                <p className="text-sm text-muted-foreground">Voir les profils et historiques clients</p>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
