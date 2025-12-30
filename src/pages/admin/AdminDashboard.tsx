import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Users, CreditCard, TrendingUp, MessageSquare, Calendar, AlertTriangle, Activity, Smartphone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { format, subDays } from "date-fns";

const AdminDashboard = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats-dashboard"],
    queryFn: async () => {
      const today = new Date().toISOString();
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

      const [
        ordersRes,
        clientsRes,
        billingRes,
        requestsRes,
        overdueRes,
        appointmentsRes,
        activityRes,
        analyticsRes,
      ] = await Promise.all([
        supabase.from("orders").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("billing").select("amount").eq("status", "paid"),
        supabase.from("contact_requests").select("*", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("billing").select("*", { count: "exact", head: true }).eq("status", "overdue"),
        supabase.from("appointments").select("*", { count: "exact", head: true }).eq("status", "scheduled"),
        supabase.from("activity_logs").select("*", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
        supabase.from("telecom_analytics").select("activations_count, contract_savings"),
      ]);

      const totalRevenue = billingRes.data?.reduce((sum, b) => sum + Number(b.amount), 0) || 0;
      const totalActivations = analyticsRes.data?.reduce((sum, a) => sum + Number(a.activations_count || 0), 0) || 0;
      const totalSavings = analyticsRes.data?.reduce((sum, a) => sum + Number(a.contract_savings || 0), 0) || 0;

      return {
        orders: ordersRes.count || 0,
        clients: clientsRes.count || 0,
        revenue: totalRevenue,
        requests: requestsRes.count || 0,
        overdue: overdueRes.count || 0,
        appointments: appointmentsRes.count || 0,
        activity: activityRes.count || 0,
        activations: totalActivations,
        savings: totalSavings,
      };
    },
  });

  const statCards = [
    {
      title: "Commandes",
      value: stats?.orders || 0,
      icon: Package,
      color: "from-cyan-500 to-cyan-400",
      href: "/admin/orders",
    },
    {
      title: "Clients",
      value: stats?.clients || 0,
      icon: Users,
      color: "from-emerald-500 to-emerald-400",
      href: "/admin/clients",
    },
    {
      title: "Revenus totaux",
      value: `${stats?.revenue?.toLocaleString("fr-CA", { style: "currency", currency: "CAD" }) || "$0"}`,
      icon: CreditCard,
      color: "from-violet-500 to-violet-400",
      href: "/admin/billing",
    },
    {
      title: "Nouvelles demandes",
      value: stats?.requests || 0,
      icon: MessageSquare,
      color: "from-amber-500 to-amber-400",
      href: "/admin/requests",
    },
  ];

  const secondaryStats = [
    {
      title: "Activations",
      value: stats?.activations || 0,
      icon: Smartphone,
      color: "text-cyan-400",
      description: "Total des activations clients",
    },
    {
      title: "Factures en retard",
      value: stats?.overdue || 0,
      icon: AlertTriangle,
      color: "text-red-500",
      description: "Nécessitent une action",
    },
    {
      title: "Consultations à venir",
      value: stats?.appointments || 0,
      icon: Calendar,
      color: "text-emerald-400",
      description: "Rendez-vous planifiés",
    },
    {
      title: "Économies clients",
      value: stats?.savings?.toLocaleString("fr-CA", { style: "currency", currency: "CAD" }) || "$0",
      icon: TrendingUp,
      color: "text-violet-400",
      description: "Total des économies",
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Tableau de bord</h1>
          <p className="text-muted-foreground mt-1">
            Bienvenue dans l'administration Nivra • {format(new Date(), "EEEE d MMMM yyyy", { locale: require("date-fns/locale/fr").fr })}
          </p>
        </div>

        {/* Primary Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat) => (
            <Link key={stat.title} to={stat.href}>
              <Card className="bg-card border-border hover:border-cyan-400/30 transition-colors cursor-pointer">
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
            </Link>
          ))}
        </div>

        {/* Secondary Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {secondaryStats.map((stat) => (
            <Card key={stat.title} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  <span className="text-sm text-muted-foreground">{stat.title}</span>
                </div>
                {isLoading ? (
                  <div className="h-6 w-16 bg-muted animate-pulse rounded" />
                ) : (
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Activity Overview */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-400" />
              Aperçu de l'activité
            </CardTitle>
            <Link to="/admin/activity" className="text-sm text-cyan-400 hover:underline">
              Voir tout
            </Link>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-cyan-400"></div>
                <span className="text-muted-foreground">{stats?.activity || 0} actions les 30 derniers jours</span>
              </div>
            </div>
          </CardContent>
        </Card>

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
              <Link
                to="/admin/requests"
                className="p-4 rounded-lg border border-border hover:border-cyan-400/50 hover:bg-accent/50 transition-all"
              >
                <MessageSquare className="w-6 h-6 text-cyan-400 mb-2" />
                <h3 className="font-medium text-foreground">Voir les demandes</h3>
                <p className="text-sm text-muted-foreground">Traiter les nouvelles demandes de consultation</p>
              </Link>
              <Link
                to="/admin/orders"
                className="p-4 rounded-lg border border-border hover:border-cyan-400/50 hover:bg-accent/50 transition-all"
              >
                <Package className="w-6 h-6 text-emerald-400 mb-2" />
                <h3 className="font-medium text-foreground">Gérer les commandes</h3>
                <p className="text-sm text-muted-foreground">Voir et mettre à jour les commandes clients</p>
              </Link>
              <Link
                to="/admin/clients"
                className="p-4 rounded-lg border border-border hover:border-cyan-400/50 hover:bg-accent/50 transition-all"
              >
                <Users className="w-6 h-6 text-violet-400 mb-2" />
                <h3 className="font-medium text-foreground">Gérer les clients</h3>
                <p className="text-sm text-muted-foreground">Voir les profils et historiques clients</p>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
