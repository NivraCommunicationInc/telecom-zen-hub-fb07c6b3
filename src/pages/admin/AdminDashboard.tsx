import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { 
  Package, Users, CreditCard, TrendingUp, MessageSquare, Calendar, 
  AlertTriangle, Activity, Smartphone, Plus, FileText, UserPlus, 
  Building2, Tag, FileSignature, CalendarPlus, Briefcase, Wrench, 
  UserCog, Megaphone, Settings, DollarSign, Wallet, ArrowRight
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend";
import { Link, useNavigate } from "react-router-dom";
import { format, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import PendingTVOrdersNotification from "@/components/admin/PendingTVOrdersNotification";
import { LiveActivityWidget } from "@/components/admin/live-activity/LiveActivityWidget";
import { PageHeader } from "@/components/admin/ui/PageHeader";
import { StatCard } from "@/components/admin/ui/StatCard";
import { SectionCard } from "@/components/admin/ui/SectionCard";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats-dashboard"],
    queryFn: async () => {
      const today = new Date().toISOString();
      const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

      const [
        ordersRes, clientsRes, billingRes, requestsRes, overdueRes,
        appointmentsRes, activityRes, analyticsRes, paymentsRes,
      ] = await Promise.all([
        supabase.from("orders").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("billing").select("amount").eq("status", "paid"),
        supabase.from("contact_requests").select("*", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("billing").select("*", { count: "exact", head: true }).eq("status", "overdue"),
        supabase.from("appointments").select("*", { count: "exact", head: true }).eq("status", "scheduled"),
        supabase.from("activity_logs").select("*", { count: "exact", head: true }).gte("created_at", thirtyDaysAgo),
        supabase.from("telecom_analytics").select("activations_count, contract_savings"),
        supabase.from("billing_payments").select("*", { count: "exact", head: true }).eq("status", "pending"),
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
        pendingPayments: paymentsRes.count || 0,
      };
    },
  });

  const quickActions = [
    { icon: Package, label: "Commande", href: "/admin/orders?action=new", color: "text-primary" },
    { icon: UserPlus, label: "Client", href: "/admin/clients?action=new", color: "text-emerald-400" },
    { icon: FileText, label: "Facture", href: "/admin/billing?action=new", color: "text-sky-400" },
    { icon: Building2, label: "Compte", href: "/admin/accounts?action=new", color: "text-violet-400" },
    { icon: CalendarPlus, label: "Rendez-vous", href: "/admin/appointments?action=new", color: "text-amber-400" },
    { icon: Tag, label: "Promotion", href: "/admin/promotions?action=new", color: "text-pink-400" },
  ];

  const navCards = [
    { icon: MessageSquare, label: "Demandes", desc: "Traiter les soumissions", href: "/admin/requests" },
    { icon: Package, label: "Commandes", desc: "Gérer les commandes", href: "/admin/orders" },
    { icon: Users, label: "Clients", desc: "Profils et historiques", href: "/admin/clients" },
    { icon: Wallet, label: "Paiements", desc: "PayPal, Interac, Carte", href: "/admin/payments" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Tableau de bord"
          subtitle={`Bienvenue dans l'administration Nivra · ${format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}`}
        />

        {/* Primary KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/admin/orders">
            <StatCard
              label="Commandes"
              value={isLoading ? "—" : stats?.orders || 0}
              icon={Package}
            />
          </Link>
          <Link to="/admin/clients">
            <StatCard
              label="Clients"
              value={isLoading ? "—" : stats?.clients || 0}
              icon={Users}
            />
          </Link>
          <Link to="/admin/billing">
            <StatCard
              label="Revenus totaux"
              value={isLoading ? "—" : (stats?.revenue?.toLocaleString("fr-CA", { style: "currency", currency: "CAD" }) || "$0")}
              icon={CreditCard}
            />
          </Link>
          <Link to="/admin/payments">
            <StatCard
              label="Paiements en attente"
              value={isLoading ? "—" : stats?.pendingPayments || 0}
              icon={Wallet}
            />
          </Link>
        </div>

        {/* Secondary stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Smartphone className="w-4 h-4 text-primary" />
              <span className="text-sm text-muted-foreground">Activations</span>
            </div>
            <p className="text-xl font-bold text-foreground">{isLoading ? "—" : stats?.activations || 0}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-muted-foreground">Renouvellements</span>
            </div>
            <p className="text-xl font-bold text-foreground">{isLoading ? "—" : stats?.overdue || 0}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-muted-foreground">Rendez-vous</span>
            </div>
            <p className="text-xl font-bold text-foreground">{isLoading ? "—" : stats?.appointments || 0}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-violet-400" />
              <span className="text-sm text-muted-foreground">Économies clients</span>
            </div>
            <p className="text-xl font-bold text-foreground">
              {isLoading ? "—" : (stats?.savings?.toLocaleString("fr-CA", { style: "currency", currency: "CAD" }) || "$0")}
            </p>
          </div>
        </div>

        <PendingTVOrdersNotification />

        {/* Quick actions + Activity side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Create */}
          <SectionCard title="Créer rapidement" icon={Plus} className="lg:col-span-1">
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  className="h-auto py-3 flex flex-col items-center gap-1.5 text-sm border-border hover:border-primary/30 hover:bg-primary/5"
                  onClick={() => navigate(action.href)}
                >
                  <action.icon className={`w-5 h-5 ${action.color}`} />
                  <span className="text-[13px] font-medium text-foreground">{action.label}</span>
                </Button>
              ))}
            </div>
          </SectionCard>

          {/* Activity */}
          <SectionCard
            title="Aperçu de l'activité"
            icon={Activity}
            className="lg:col-span-2"
            actions={
              <Link to="/admin/activity" className="text-sm text-primary hover:underline flex items-center gap-1">
                Voir tout <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            }
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                <span className="text-muted-foreground">
                  {stats?.activity || 0} actions les 30 derniers jours
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="text-muted-foreground">
                  {stats?.requests || 0} nouvelles demandes
                </span>
              </div>
              <LiveActivityWidget />
            </div>
          </SectionCard>
        </div>

        {/* Navigation Cards */}
        <SectionCard title="Navigation rapide" icon={TrendingUp}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {navCards.map((card) => (
              <Link
                key={card.label}
                to={card.href}
                className="group p-4 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-all"
              >
                <card.icon className="w-5 h-5 text-primary mb-3" />
                <h3 className="text-sm font-semibold text-foreground mb-1">{card.label}</h3>
                <p className="text-[13px] text-muted-foreground">{card.desc}</p>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
