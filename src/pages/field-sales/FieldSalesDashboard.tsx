/**
 * FieldSalesDashboard - Main dashboard for field sales representatives
 * Mobile-first with quick access to key actions
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  PlusCircle, DollarSign, ShoppingCart, TrendingUp, 
  LogOut, RefreshCw, Loader2, Clock, CheckCircle,
  AlertCircle, Briefcase
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import StaffBackground from "@/components/staff/StaffBackground";
import { FieldSalesNav } from "@/components/field-sales/FieldSalesNav";
import { OfflineSyncIndicator } from "@/components/field-sales/OfflineSyncIndicator";
interface DashboardStats {
  todaySales: number;
  todayRevenue: number;
  weekSales: number;
  weekCommissions: number;
  pendingSales: number;
}

interface ServiceItem {
  offer_id: string;
  name: string;
  category: string;
  price_monthly: number;
}

interface RecentSale {
  id: string;
  customer_name: string;
  total_amount: number;
  payment_status: string;
  created_at: string;
  sync_status: string;
  services: ServiceItem[];
}

export default function FieldSalesDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayRevenue: 0,
    weekSales: 0,
    weekCommissions: 0,
    pendingSales: 0,
  });
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Get profile name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", session.user.id)
        .maybeSingle();
      
      setStaffName(profile?.full_name || session.user.email?.split("@")[0] || "Vendeur");

      // Get today's date range
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      // Get week start
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 7);
      const weekStartISO = weekStart.toISOString();

      // Fetch stats in parallel
      const [todayRes, weekRes, pendingRes, recentRes, commissionsRes] = await Promise.all([
        // Today's sales
        supabase
          .from("field_sales_orders")
          .select("id, total_amount")
          .eq("salesperson_id", session.user.id)
          .gte("created_at", todayISO),
        // Week's sales
        supabase
          .from("field_sales_orders")
          .select("id, total_amount")
          .eq("salesperson_id", session.user.id)
          .gte("created_at", weekStartISO),
        // Pending sales
        supabase
          .from("field_sales_orders")
          .select("id", { count: "exact", head: true })
          .eq("salesperson_id", session.user.id)
          .eq("payment_status", "pending"),
        // Recent sales
        supabase
          .from("field_sales_orders")
          .select("id, customer_name, total_amount, payment_status, created_at, sync_status, services")
          .eq("salesperson_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(5),
        // Week's commissions
        supabase
          .from("sales_commissions")
          .select("commission_amount")
          .eq("salesperson_id", session.user.id)
          .gte("created_at", weekStartISO)
          .in("status", ["pending", "validated"]),
      ]);

      const todayTotal = (todayRes.data || []).reduce((sum, s) => sum + (s.total_amount || 0), 0);
      const weekTotal = (weekRes.data || []).reduce((sum, s) => sum + (s.total_amount || 0), 0);
      const weekCommTotal = (commissionsRes.data || []).reduce((sum, c) => sum + (c.commission_amount || 0), 0);

      setStats({
        todaySales: todayRes.data?.length || 0,
        todayRevenue: todayTotal,
        weekSales: weekRes.data?.length || 0,
        weekCommissions: weekCommTotal,
        pendingSales: pendingRes.count || 0,
      });

      // Parse services as array
      const parsedSales = (recentRes.data || []).map(sale => ({
        ...sale,
        services: Array.isArray(sale.services) ? sale.services as unknown as ServiceItem[] : [],
      }));
      setRecentSales(parsedSales);
    } catch (error) {
      console.error("Error loading dashboard:", error);
      toast.error("Erreur de chargement");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnexion réussie");
    navigate("/field-sales");
  };

  const getPaymentStatusConfig = (status: string) => {
    switch (status) {
      case "confirmed":
        return { label: "Payé", icon: CheckCircle, className: "text-emerald-400" };
      case "pending":
        return { label: "En attente", icon: Clock, className: "text-amber-400" };
      case "failed":
        return { label: "Échec", icon: AlertCircle, className: "text-red-400" };
      default:
        return { label: status, icon: Clock, className: "text-slate-400" };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <StaffBackground />
        <Loader2 className="h-10 w-10 animate-spin text-orange-400 z-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative pb-20">
      <StaffBackground />
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-slate-700/50">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 shadow-lg shadow-orange-500/20">
                <Briefcase className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Bonjour, {staffName.split(" ")[0]}</h1>
                <p className="text-xs text-slate-400">{format(new Date(), "EEEE d MMMM", { locale: fr })}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <OfflineSyncIndicator />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={refreshing}
                className="text-slate-400 hover:text-white"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-slate-400 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4 relative z-10">
        {/* Quick Action */}
        <Button
          onClick={() => navigate("/field-sales/new-sale")}
          className="w-full h-16 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold text-lg shadow-xl shadow-orange-500/30"
        >
          <PlusCircle className="h-6 w-6 mr-3" />
          Nouvelle Vente
        </Button>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Ventes aujourd'hui"
            value={stats.todaySales}
            subValue={`${stats.todayRevenue.toFixed(2)} $`}
            icon={<ShoppingCart className="h-5 w-5" />}
            color="orange"
          />
          <StatCard
            label="Cette semaine"
            value={stats.weekSales}
            subValue={`${stats.weekCommissions.toFixed(2)} $ com.`}
            icon={<TrendingUp className="h-5 w-5" />}
            color="amber"
          />
        </div>

        {/* Pending Alert */}
        {stats.pendingSales > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/10 backdrop-blur-xl">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-amber-400" />
                <span className="text-amber-200 font-medium">
                  {stats.pendingSales} vente(s) en attente de paiement
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Sales */}
        <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-orange-400" />
              Ventes récentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentSales.length === 0 ? (
              <p className="text-slate-400 text-center py-4">Aucune vente récente</p>
            ) : (
              recentSales.map((sale) => {
                const status = getPaymentStatusConfig(sale.payment_status);
                const StatusIcon = status.icon;
                
                return (
                  <button
                    key={sale.id}
                    onClick={() => navigate(`/field-sales/sales/${sale.id}`)}
                    className="w-full p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-orange-500/30 transition-all text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white">{sale.customer_name}</p>
                        <p className="text-xs text-slate-400">
                          {format(new Date(sale.created_at), "HH:mm", { locale: fr })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-orange-400">{sale.total_amount.toFixed(2)} $</p>
                        <div className={`flex items-center gap-1 text-xs ${status.className}`}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>
      </main>

      <FieldSalesNav />
    </div>
  );
}

function StatCard({ 
  label, 
  value, 
  subValue, 
  icon, 
  color 
}: { 
  label: string; 
  value: number; 
  subValue: string; 
  icon: React.ReactNode; 
  color: "orange" | "amber"; 
}) {
  const colorClasses = {
    orange: "from-orange-500/20 to-orange-500/5 border-orange-500/30",
    amber: "from-amber-500/20 to-amber-500/5 border-amber-500/30",
  };

  return (
    <Card className={`border bg-gradient-to-br backdrop-blur-xl ${colorClasses[color]}`}>
      <CardContent className="py-4 px-3">
        <div className="flex items-start justify-between mb-2">
          <div className={`p-2 rounded-lg ${color === "orange" ? "bg-orange-500/20 text-orange-400" : "bg-amber-500/20 text-amber-400"}`}>
            {icon}
          </div>
          <span className="text-3xl font-bold text-white">{value}</span>
        </div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className={`text-sm font-medium ${color === "orange" ? "text-orange-400" : "text-amber-400"}`}>{subValue}</p>
      </CardContent>
    </Card>
  );
}
