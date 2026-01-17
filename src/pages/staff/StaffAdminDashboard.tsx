import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Shield, LogOut, Loader2, ShoppingCart, Users, FileText, 
  Calendar, Ticket, DollarSign, Settings, BarChart3,
  Package, Tv, Smartphone, Wifi, Bell, UserCog
} from "lucide-react";
import { toast } from "sonner";

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  totalClients: number;
  openTickets: number;
  todayAppointments: number;
  unpaidInvoices: number;
}

export default function StaffAdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    totalClients: 0,
    openTickets: 0,
    todayAppointments: 0,
    unpaidInvoices: 0,
  });

  useEffect(() => {
    // StaffLayout already handles auth, just fetch data
    const loadData = async () => {
      await fetchStats();
      setLoading(false);
    };
    loadData();
  }, []);

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];

      const [orders, pendingOrders, clients, tickets, appointments, invoices] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["pending", "processing"]),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("appointments").select("id", { count: "exact", head: true }).gte("scheduled_at", today),
        supabase.from("billing").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);

      setStats({
        totalOrders: orders.count || 0,
        pendingOrders: pendingOrders.count || 0,
        totalClients: clients.count || 0,
        openTickets: tickets.count || 0,
        todayAppointments: appointments.count || 0,
        unpaidInvoices: invoices.count || 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnexion réussie");
    navigate("/staff");
  };

  const goToAdmin = () => {
    navigate("/admin");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  const quickActions = [
    { label: "Commandes", icon: ShoppingCart, href: "/admin/orders", color: "from-blue-500 to-blue-600" },
    { label: "Clients", icon: Users, href: "/admin/clients", color: "from-green-500 to-green-600" },
    { label: "Factures", icon: FileText, href: "/admin/billing", color: "from-purple-500 to-purple-600" },
    { label: "Rendez-vous", icon: Calendar, href: "/admin/appointments", color: "from-orange-500 to-orange-600" },
    { label: "Tickets", icon: Ticket, href: "/admin/support", color: "from-pink-500 to-pink-600" },
    { label: "Paiements", icon: DollarSign, href: "/admin/payments", color: "from-emerald-500 to-emerald-600" },
  ];

  const catalogActions = [
    { label: "Internet", icon: Wifi, href: "/admin/services?type=internet" },
    { label: "Mobile", icon: Smartphone, href: "/admin/services?type=mobile" },
    { label: "Télévision", icon: Tv, href: "/admin/services?type=tv" },
    { label: "Équipements", icon: Package, href: "/admin/equipment" },
  ];

  const adminActions = [
    { label: "Utilisateurs", icon: UserCog, href: "/admin/staff" },
    { label: "Paramètres", icon: Settings, href: "/admin/settings" },
    { label: "Rapports", icon: BarChart3, href: "/admin/reports" },
    { label: "Notifications", icon: Bell, href: "/admin/notifications" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-r from-red-500 to-red-600">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Administration</h1>
              <p className="text-sm text-slate-400">Nivra Telecom</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={goToAdmin}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Panneau complet
            </Button>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="text-slate-400 hover:text-white hover:bg-slate-700"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Commandes" value={stats.totalOrders} icon={ShoppingCart} />
          <StatCard label="En attente" value={stats.pendingOrders} icon={Package} highlight />
          <StatCard label="Clients" value={stats.totalClients} icon={Users} />
          <StatCard label="Tickets ouverts" value={stats.openTickets} icon={Ticket} highlight={stats.openTickets > 0} />
          <StatCard label="RDV aujourd'hui" value={stats.todayAppointments} icon={Calendar} />
          <StatCard label="Factures impayées" value={stats.unpaidInvoices} icon={FileText} highlight={stats.unpaidInvoices > 0} />
        </div>

        {/* Quick Actions */}
        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-white">Actions rapides</CardTitle>
            <CardDescription className="text-slate-400">Accédez aux modules principaux</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={() => navigate(action.href)}
                    className={`p-4 rounded-lg bg-gradient-to-r ${action.color} text-white hover:opacity-90 transition-opacity flex flex-col items-center gap-2`}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-sm font-medium">{action.label}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Catalog & Admin */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white">Catalogue</CardTitle>
              <CardDescription className="text-slate-400">Gérer les services et produits</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {catalogActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      onClick={() => navigate(action.href)}
                      className="p-4 rounded-lg border border-slate-600 bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-3"
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{action.label}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white">Administration</CardTitle>
              <CardDescription className="text-slate-400">Paramètres et configuration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {adminActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      onClick={() => navigate(action.href)}
                      className="p-4 rounded-lg border border-slate-600 bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-3"
                    >
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{action.label}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  icon: Icon, 
  highlight = false 
}: { 
  label: string; 
  value: number; 
  icon: React.ElementType; 
  highlight?: boolean;
}) {
  return (
    <div className={`p-4 rounded-lg border ${highlight ? "border-yellow-500/50 bg-yellow-500/10" : "border-slate-700 bg-slate-800/50"}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${highlight ? "text-yellow-500" : "text-slate-400"}`} />
        <span className="text-sm text-slate-400">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${highlight ? "text-yellow-500" : "text-white"}`}>{value}</p>
    </div>
  );
}
