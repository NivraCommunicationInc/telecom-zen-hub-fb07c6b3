import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Package, Users, CreditCard, TrendingUp, MessageSquare, Calendar, 
  AlertTriangle, Activity, Smartphone, Plus, FileText, UserPlus, 
  Building2, Tag, FileSignature, CalendarPlus, Briefcase, Wrench, 
  UserCog, Megaphone, Settings
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import PendingTVOrdersNotification from "@/components/admin/PendingTVOrdersNotification";

const AdminDashboard = () => {
  const navigate = useNavigate();
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
      title: "Rendez-vous à venir",
      value: stats?.appointments || 0,
      icon: Calendar,
      color: "text-emerald-400",
      description: "Installations planifiées",
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
            Bienvenue dans l'administration Nivra • {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
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

        {/* Pending TV Orders Notification */}
        <PendingTVOrdersNotification />

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

        {/* Quick Create Actions */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-cyan-400" />
              Créer rapidement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2 hover:border-blue-500 hover:bg-blue-500/10"
                onClick={() => navigate("/admin/billing?action=new")}
              >
                <FileText className="w-5 h-5 text-blue-500" />
                <span className="text-xs font-medium">Nouvelle facture</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2 hover:border-cyan-500 hover:bg-cyan-500/10"
                onClick={() => navigate("/admin/orders?action=new")}
              >
                <Package className="w-5 h-5 text-cyan-500" />
                <span className="text-xs font-medium">Nouvelle commande</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2 hover:border-emerald-500 hover:bg-emerald-500/10"
                onClick={() => navigate("/admin/clients?action=new")}
              >
                <UserPlus className="w-5 h-5 text-emerald-500" />
                <span className="text-xs font-medium">Nouveau client</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2 hover:border-violet-500 hover:bg-violet-500/10"
                onClick={() => navigate("/admin/accounts?action=new")}
              >
                <Building2 className="w-5 h-5 text-violet-500" />
                <span className="text-xs font-medium">Nouveau compte</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2 hover:border-amber-500 hover:bg-amber-500/10"
                onClick={() => navigate("/admin/services?action=new")}
              >
                <Settings className="w-5 h-5 text-amber-500" />
                <span className="text-xs font-medium">Nouveau service</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2 hover:border-pink-500 hover:bg-pink-500/10"
                onClick={() => navigate("/admin/promotions?action=new")}
              >
                <Tag className="w-5 h-5 text-pink-500" />
                <span className="text-xs font-medium">Nouvelle promotion</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2 hover:border-indigo-500 hover:bg-indigo-500/10"
                onClick={() => navigate("/admin/contracts?action=new")}
              >
                <FileSignature className="w-5 h-5 text-indigo-500" />
                <span className="text-xs font-medium">Nouveau contrat</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2 hover:border-teal-500 hover:bg-teal-500/10"
                onClick={() => navigate("/admin/appointments?action=new")}
              >
                <CalendarPlus className="w-5 h-5 text-teal-500" />
                <span className="text-xs font-medium">Nouveau rendez-vous</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2 hover:border-orange-500 hover:bg-orange-500/10"
                onClick={() => navigate("/admin/careers?action=new")}
              >
                <Briefcase className="w-5 h-5 text-orange-500" />
                <span className="text-xs font-medium">Ajouter un poste</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2 hover:border-red-500 hover:bg-red-500/10"
                onClick={() => navigate("/admin/technicians?action=new")}
              >
                <Wrench className="w-5 h-5 text-red-500" />
                <span className="text-xs font-medium">Nouveau technicien</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2 hover:border-sky-500 hover:bg-sky-500/10"
                onClick={() => navigate("/admin/employees?action=new")}
              >
                <UserCog className="w-5 h-5 text-sky-500" />
                <span className="text-xs font-medium">Nouvel employé</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2 hover:border-yellow-500 hover:bg-yellow-500/10"
                onClick={() => navigate("/admin/system-status?action=new")}
              >
                <Megaphone className="w-5 h-5 text-yellow-500" />
                <span className="text-xs font-medium">Nouvelle annonce</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Navigation */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-400" />
              Navigation rapide
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
                <p className="text-sm text-muted-foreground">Traiter les nouvelles demandes de soumission</p>
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
