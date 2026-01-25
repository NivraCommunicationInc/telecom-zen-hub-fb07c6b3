import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Shield, LogOut, Loader2, ShoppingCart, Users, FileText, 
  Calendar, Ticket, DollarSign, Settings, BarChart3,
  Package, Tv, Smartphone, Wifi, Bell, UserCog, RefreshCw,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import StaffBackground from "@/components/staff/StaffBackground";
import { StaffSidebar } from "@/components/staff/StaffSidebar";

interface DashboardStats {
  totalOrders: number;
  pendingOrders: number;
  totalClients: number;
  openTickets: number;
  todayAppointments: number;
  unpaidInvoices: number;
}

interface StaffInfo {
  name: string;
  email: string;
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "teal" | "orange" | "pink" | "yellow" | "blue" | "green" | "purple" | "red";
  highlight?: boolean;
}

const StatCard = ({ label, value, icon, color, highlight }: StatCardProps) => {
  const colorClasses = {
    teal: "from-teal-500 to-cyan-500",
    orange: "from-orange-500 to-amber-500",
    pink: "from-pink-500 to-rose-500",
    yellow: "from-yellow-500 to-amber-400",
    blue: "from-blue-500 to-indigo-500",
    green: "from-green-500 to-emerald-500",
    purple: "from-purple-500 to-violet-500",
    red: "from-red-500 to-rose-500",
  };

  return (
    <Card className={`border-slate-700/50 bg-slate-900/60 backdrop-blur-xl ${highlight ? "ring-2 ring-yellow-500/50" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl bg-gradient-to-br ${colorClasses[color]} shadow-lg`}>
            {icon}
          </div>
          <div>
            <p className="text-sm text-slate-400">{label}</p>
            <p className={`text-2xl font-bold ${highlight ? "text-yellow-400" : "text-white"}`}>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default function StaffAdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    pendingOrders: 0,
    totalClients: 0,
    openTickets: 0,
    todayAppointments: 0,
    unpaidInvoices: 0,
  });

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchStaffInfo(), fetchStats()]);
      setLoading(false);
    };
    loadData();
  }, []);

  const fetchStaffInfo = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("user_id", session.user.id)
          .maybeSingle();
        
        setStaffInfo({
          name: profile?.full_name || session.user.email?.split("@")[0] || "Admin",
          email: session.user.email || "",
        });
      }
    } catch (error) {
      console.error("Error fetching staff info:", error);
    }
  };

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
      <div className="min-h-screen flex items-center justify-center relative">
        <StaffBackground />
        <Loader2 className="h-10 w-10 animate-spin text-teal-400 z-10" />
      </div>
    );
  }

  const quickActions = [
    { label: "Commandes", icon: ShoppingCart, href: "/admin/orders", color: "from-blue-500 to-indigo-500" },
    { label: "Clients", icon: Users, href: "/admin/clients", color: "from-green-500 to-emerald-500" },
    { label: "Factures", icon: FileText, href: "/admin/billing", color: "from-purple-500 to-violet-500" },
    { label: "Rendez-vous", icon: Calendar, href: "/admin/appointments", color: "from-orange-500 to-amber-500" },
    { label: "Tickets", icon: Ticket, href: "/admin/support", color: "from-pink-500 to-rose-500" },
    { label: "Paiements", icon: DollarSign, href: "/admin/payments", color: "from-teal-500 to-cyan-500" },
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
    <div className="min-h-screen relative flex">
      <StaffBackground />
      
      {/* Sidebar */}
      <StaffSidebar 
        onSignOut={handleLogout}
        userEmail={staffInfo?.email}
        userName={staffInfo?.name}
      />
      
      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Header for mobile */}
        <header className="lg:hidden sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-400 shadow-lg shadow-teal-500/20">
                  <Shield className="h-6 w-6 text-slate-900" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Portail Admin</h1>
                  <p className="text-sm text-slate-400">Bienvenue, {staffInfo?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fetchStats()}
                  className="text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Déconnexion
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 relative z-10 space-y-6 overflow-auto">
          {/* Full Panel Button */}
          <div className="flex justify-end">
            <Button
              onClick={goToAdmin}
              className="bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-900 hover:from-teal-600 hover:to-cyan-600"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Panneau complet
            </Button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard 
              label="Commandes" 
              value={stats.totalOrders} 
              icon={<ShoppingCart className="h-5 w-5 text-white" />}
              color="blue"
            />
            <StatCard 
              label="En attente" 
              value={stats.pendingOrders} 
              icon={<Package className="h-5 w-5 text-white" />}
              color="orange"
              highlight={stats.pendingOrders > 0}
            />
            <StatCard 
              label="Clients" 
              value={stats.totalClients} 
              icon={<Users className="h-5 w-5 text-white" />}
              color="green"
            />
            <StatCard 
              label="Tickets ouverts" 
              value={stats.openTickets} 
              icon={<Ticket className="h-5 w-5 text-white" />}
              color="pink"
              highlight={stats.openTickets > 0}
            />
            <StatCard 
              label="RDV aujourd'hui" 
              value={stats.todayAppointments} 
              icon={<Calendar className="h-5 w-5 text-white" />}
              color="purple"
            />
            <StatCard 
              label="Factures impayées" 
              value={stats.unpaidInvoices} 
              icon={<FileText className="h-5 w-5 text-white" />}
              color="red"
              highlight={stats.unpaidInvoices > 0}
            />
          </div>

          {/* Quick Actions */}
          <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-teal-400" />
                Actions rapides
              </CardTitle>
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
                      className={`p-4 rounded-xl bg-gradient-to-r ${action.color} text-white hover:opacity-90 transition-all hover:scale-105 flex flex-col items-center gap-2 shadow-lg`}
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
            <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Package className="h-5 w-5 text-teal-400" />
                  Catalogue
                </CardTitle>
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
                        className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 hover:text-white hover:border-teal-500/30 transition-all flex items-center gap-3"
                      >
                        <Icon className="h-5 w-5 text-teal-400" />
                        <span className="font-medium">{action.label}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Settings className="h-5 w-5 text-teal-400" />
                  Administration
                </CardTitle>
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
                        className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 hover:text-white hover:border-teal-500/30 transition-all flex items-center gap-3"
                      >
                        <Icon className="h-5 w-5 text-teal-400" />
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
    </div>
  );
}
