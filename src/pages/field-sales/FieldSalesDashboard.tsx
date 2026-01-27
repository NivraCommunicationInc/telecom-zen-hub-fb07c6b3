/**
 * FieldSalesDashboard - Professional POS-style dashboard for field sales representatives
 * Mobile-first with quick actions and real-time stats
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  PlusCircle, DollarSign, ShoppingCart, TrendingUp, 
  LogOut, RefreshCw, Loader2, Clock, CheckCircle,
  AlertCircle, Briefcase, Target, Award, ChevronRight,
  List, User, Wallet, Zap, Package
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import StaffBackground from "@/components/staff/StaffBackground";
import { OfflineSyncIndicator } from "@/components/field-sales/OfflineSyncIndicator";
import { cn } from "@/lib/utils";

interface DashboardStats {
  todaySales: number;
  todayRevenue: number;
  weekSales: number;
  weekCommissions: number;
  pendingSales: number;
  monthTarget: number;
  monthProgress: number;
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
    monthTarget: 50, // Default target
    monthProgress: 0,
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

      // Get date ranges
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 7);
      const weekStartISO = weekStart.toISOString();

      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthStartISO = monthStart.toISOString();

      // Fetch stats in parallel
      const [todayRes, weekRes, monthRes, pendingRes, recentRes, commissionsRes] = await Promise.all([
        supabase
          .from("field_sales_orders")
          .select("id, total_amount")
          .eq("salesperson_id", session.user.id)
          .gte("created_at", todayISO),
        supabase
          .from("field_sales_orders")
          .select("id, total_amount")
          .eq("salesperson_id", session.user.id)
          .gte("created_at", weekStartISO),
        supabase
          .from("field_sales_orders")
          .select("id")
          .eq("salesperson_id", session.user.id)
          .gte("created_at", monthStartISO),
        supabase
          .from("field_sales_orders")
          .select("id", { count: "exact", head: true })
          .eq("salesperson_id", session.user.id)
          .eq("payment_status", "pending"),
        supabase
          .from("field_sales_orders")
          .select("id, customer_name, total_amount, payment_status, created_at, sync_status, services")
          .eq("salesperson_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("sales_commissions")
          .select("commission_amount")
          .eq("salesperson_id", session.user.id)
          .gte("created_at", weekStartISO)
          .in("status", ["pending", "validated"]),
      ]);

      const todayTotal = (todayRes.data || []).reduce((sum, s) => sum + (s.total_amount || 0), 0);
      const weekCommTotal = (commissionsRes.data || []).reduce((sum, c) => sum + (c.commission_amount || 0), 0);
      const monthSalesCount = monthRes.data?.length || 0;
      const monthTarget = 50;

      setStats({
        todaySales: todayRes.data?.length || 0,
        todayRevenue: todayTotal,
        weekSales: weekRes.data?.length || 0,
        weekCommissions: weekCommTotal,
        pendingSales: pendingRes.count || 0,
        monthTarget,
        monthProgress: Math.round((monthSalesCount / monthTarget) * 100),
      });

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
        return { label: "Payé", icon: CheckCircle, className: "text-emerald-400 bg-emerald-500/10" };
      case "pending":
        return { label: "En attente", icon: Clock, className: "text-amber-400 bg-amber-500/10" };
      case "failed":
        return { label: "Échec", icon: AlertCircle, className: "text-red-400 bg-red-500/10" };
      default:
        return { label: status, icon: Clock, className: "text-slate-400 bg-slate-500/10" };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <StaffBackground />
        <div className="flex flex-col items-center gap-4 z-10">
          <Loader2 className="h-10 w-10 animate-spin text-orange-400" />
          <p className="text-slate-400">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      <StaffBackground />
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/50">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 shadow-lg shadow-orange-500/30">
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
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
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

      <main className="p-4 space-y-4 relative z-10 pb-8">
        {/* Main Action Button */}
        <Button
          onClick={() => navigate("/field-sales/new-sale")}
          className="w-full h-16 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold text-lg shadow-xl shadow-orange-500/30 group"
        >
          <PlusCircle className="h-6 w-6 mr-3 group-hover:scale-110 transition-transform" />
          Ouvrir la Caisse POS
          <Zap className="h-5 w-5 ml-auto opacity-60" />
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
            color="cyan"
          />
        </div>

        {/* Monthly Progress */}
        <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl overflow-hidden">
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-400" />
                <span className="text-white font-medium">Objectif mensuel</span>
              </div>
              <Badge variant="outline" className="text-purple-400 border-purple-500/30">
                {stats.monthProgress}%
              </Badge>
            </div>
            <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, stats.monthProgress)}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center">
              {Math.round(stats.monthProgress * stats.monthTarget / 100)} / {stats.monthTarget} ventes ce mois
            </p>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-2">
          <QuickActionButton
            icon={<List className="h-5 w-5" />}
            label="Ventes"
            onClick={() => navigate("/field-sales/sales")}
            color="blue"
          />
          <QuickActionButton
            icon={<Wallet className="h-5 w-5" />}
            label="Gains"
            onClick={() => navigate("/field-sales/commissions")}
            color="green"
          />
          <QuickActionButton
            icon={<Award className="h-5 w-5" />}
            label="Bonus"
            onClick={() => navigate("/field-sales/commissions")}
            color="amber"
            badge={stats.weekCommissions > 0 ? `+${stats.weekCommissions.toFixed(0)}$` : undefined}
          />
          <QuickActionButton
            icon={<User className="h-5 w-5" />}
            label="Compte"
            onClick={() => navigate("/field-sales/account")}
            color="purple"
          />
        </div>

        {/* Pending Alert */}
        {stats.pendingSales > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/10 backdrop-blur-xl">
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-amber-400" />
                <span className="text-amber-200 font-medium flex-1">
                  {stats.pendingSales} vente(s) en attente de paiement
                </span>
                <ChevronRight className="h-4 w-4 text-amber-400" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Sales */}
        <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-orange-400" />
                Ventes récentes
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/field-sales/sales")}
                className="text-slate-400 hover:text-white text-xs"
              >
                Voir tout
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentSales.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">Aucune vente récente</p>
                <p className="text-xs text-slate-500 mt-1">Commencez à vendre!</p>
              </div>
            ) : (
              recentSales.map((sale) => {
                const status = getPaymentStatusConfig(sale.payment_status);
                const StatusIcon = status.icon;
                
                return (
                  <button
                    key={sale.id}
                    onClick={() => navigate(`/field-sales/sales/${sale.id}`)}
                    className="w-full p-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-orange-500/30 transition-all text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white truncate">{sale.customer_name}</p>
                        <p className="text-xs text-slate-400">
                          {format(new Date(sale.created_at), "HH:mm", { locale: fr })} • {sale.services?.length || 0} service(s)
                        </p>
                      </div>
                      <div className="text-right ml-3">
                        <p className="font-bold text-orange-400">{sale.total_amount.toFixed(2)} $</p>
                        <div className={cn("flex items-center gap-1 text-xs px-2 py-0.5 rounded-full", status.className)}>
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-orange-400 ml-2 transition-colors" />
                    </div>
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

// Stat Card Component
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
  color: "orange" | "cyan" | "amber" | "emerald"; 
}) {
  const colorClasses = {
    orange: "from-orange-500/20 to-orange-500/5 border-orange-500/30",
    cyan: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30",
    amber: "from-amber-500/20 to-amber-500/5 border-amber-500/30",
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
  };

  const iconClasses = {
    orange: "bg-orange-500/20 text-orange-400",
    cyan: "bg-cyan-500/20 text-cyan-400",
    amber: "bg-amber-500/20 text-amber-400",
    emerald: "bg-emerald-500/20 text-emerald-400",
  };

  const textClasses = {
    orange: "text-orange-400",
    cyan: "text-cyan-400",
    amber: "text-amber-400",
    emerald: "text-emerald-400",
  };

  return (
    <Card className={cn("border bg-gradient-to-br backdrop-blur-xl", colorClasses[color])}>
      <CardContent className="py-4 px-4">
        <div className="flex items-start justify-between mb-2">
          <div className={cn("p-2 rounded-lg", iconClasses[color])}>
            {icon}
          </div>
          <span className="text-3xl font-bold text-white">{value}</span>
        </div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className={cn("text-sm font-semibold", textClasses[color])}>{subValue}</p>
      </CardContent>
    </Card>
  );
}

// Quick Action Button Component
function QuickActionButton({
  icon,
  label,
  onClick,
  color,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color: "blue" | "green" | "amber" | "purple";
  badge?: string;
}) {
  const colorClasses = {
    blue: "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30",
    green: "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30",
    amber: "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30",
    purple: "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 py-3 px-2 rounded-xl transition-all relative",
        colorClasses[color]
      )}
    >
      {badge && (
        <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[9px] bg-emerald-500 text-white">
          {badge}
        </Badge>
      )}
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}
