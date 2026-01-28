/**
 * FieldSalesDashboard - iOS-style professional dashboard for field sales representatives
 * Features: Real-time stats, objectives tracking, notifications, leaderboard preview
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, DollarSign, ShoppingCart, TrendingUp, 
  Loader2, Clock, CheckCircle, Target, Award, 
  ChevronRight, Zap, Trophy, Flame, Star, Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import StaffBackground from "@/components/staff/StaffBackground";
import { IOSHeader } from "@/components/field-sales/ios/IOSHeader";
import { IOSBottomNav } from "@/components/field-sales/ios/IOSBottomNav";
import { IOSSidebar } from "@/components/field-sales/ios/IOSSidebar";
import { IOSWidgetCard, IOSStatWidget, IOSProgressWidget } from "@/components/field-sales/ios/IOSWidgetCard";
import { IOSNotificationCenter, FieldSalesNotification } from "@/components/field-sales/ios/IOSNotificationCenter";
import { cn } from "@/lib/utils";

interface DashboardStats {
  todaySales: number;
  todayRevenue: number;
  weekSales: number;
  weekCommissions: number;
  pendingSales: number;
  monthTarget: number;
  monthProgress: number;
  rank: number;
  totalReps: number;
}

interface RecentSale {
  id: string;
  customer_name: string;
  total_amount: number;
  payment_status: string;
  created_at: string;
}

interface Objective {
  id: string;
  label: string;
  current: number;
  target: number;
  reward: string;
  icon: React.ReactNode;
}

export default function FieldSalesDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    todayRevenue: 0,
    weekSales: 0,
    weekCommissions: 0,
    pendingSales: 0,
    monthTarget: 50,
    monthProgress: 0,
    rank: 0,
    totalReps: 0,
  });
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [notifications, setNotifications] = useState<FieldSalesNotification[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      // Get profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", session.user.id)
        .maybeSingle();
      
      setStaffName(profile?.full_name || session.user.email?.split("@")[0] || "Vendeur");
      setStaffEmail(profile?.email || session.user.email || "");

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
      const [todayRes, weekRes, monthRes, pendingRes, recentRes, commissionsRes, leaderboardRes] = await Promise.all([
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
          .select("id, customer_name, total_amount, payment_status, created_at")
          .eq("salesperson_id", session.user.id)
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("sales_commissions")
          .select("commission_amount")
          .eq("salesperson_id", session.user.id)
          .gte("created_at", weekStartISO)
          .in("status", ["pending", "validated"]),
        supabase
          .from("field_sales_leaderboard")
          .select("user_id, total_sales")
          .order("total_sales", { ascending: false }),
      ]);

      const todayTotal = (todayRes.data || []).reduce((sum, s) => sum + (s.total_amount || 0), 0);
      const weekCommTotal = (commissionsRes.data || []).reduce((sum, c) => sum + (c.commission_amount || 0), 0);
      const monthSalesCount = monthRes.data?.length || 0;
      const monthTarget = 50;

      // Calculate rank
      const leaderboard = leaderboardRes.data || [];
      const userRankIndex = leaderboard.findIndex(l => l.user_id === session.user.id);
      const rank = userRankIndex >= 0 ? userRankIndex + 1 : leaderboard.length + 1;

      setStats({
        todaySales: todayRes.data?.length || 0,
        todayRevenue: todayTotal,
        weekSales: weekRes.data?.length || 0,
        weekCommissions: weekCommTotal,
        pendingSales: pendingRes.count || 0,
        monthTarget,
        monthProgress: Math.round((monthSalesCount / monthTarget) * 100),
        rank,
        totalReps: leaderboard.length || 1,
      });

      setRecentSales(recentRes.data || []);

      // Generate objectives
      setObjectives([
        {
          id: "daily",
          label: "Objectif du jour",
          current: todayRes.data?.length || 0,
          target: 5,
          reward: "+25$ bonus",
          icon: <Flame className="h-4 w-4" />,
        },
        {
          id: "weekly",
          label: "Objectif hebdomadaire",
          current: weekRes.data?.length || 0,
          target: 25,
          reward: "+100$ bonus",
          icon: <Star className="h-4 w-4" />,
        },
        {
          id: "monthly",
          label: "Objectif mensuel",
          current: monthSalesCount,
          target: monthTarget,
          reward: "+250$ bonus",
          icon: <Trophy className="h-4 w-4" />,
        },
      ]);

      // Mock notifications for demo
      setNotifications([
        {
          id: "1",
          type: "commission",
          title: "Commission validée",
          message: "Votre commission de 45.00$ a été validée et sera versée prochainement.",
          createdAt: new Date().toISOString(),
          isRead: false,
        },
        {
          id: "2",
          type: "achievement",
          title: "Nouvel objectif atteint!",
          message: "Félicitations! Vous avez atteint 10 ventes cette semaine.",
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          isRead: false,
        },
        {
          id: "3",
          type: "bonus",
          title: "Bonus débloqué",
          message: "Vous avez gagné un bonus de 50$ pour avoir atteint votre objectif quotidien.",
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          isRead: true,
        },
      ]);

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

  const handleMarkNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => 
      n.id === id ? { ...n, isRead: true } : n
    ));
  };

  const handleMarkAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const getPaymentStatusConfig = (status: string) => {
    switch (status) {
      case "confirmed":
        return { label: "Payé", className: "bg-emerald-500/20 text-emerald-400" };
      case "pending":
        return { label: "En attente", className: "bg-amber-500/20 text-amber-400" };
      default:
        return { label: status, className: "bg-slate-500/20 text-slate-400" };
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative">
        <StaffBackground />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4 z-10"
        >
          <div className="p-4 rounded-2xl bg-orange-500/20">
            <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
          </div>
          <p className="text-slate-400 font-medium">Chargement...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative bg-slate-950">
      <StaffBackground />
      
      <IOSHeader
        title={`Bonjour, ${staffName.split(" ")[0]} 👋`}
        subtitle={format(new Date(), "EEEE d MMMM", { locale: fr })}
        onMenuToggle={() => setSidebarOpen(true)}
        onNotificationClick={() => setNotificationsOpen(true)}
        onRefresh={handleRefresh}
        isRefreshing={refreshing}
        notificationCount={unreadCount}
      />

      <IOSSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        userName={staffName}
        userEmail={staffEmail}
      />

      <IOSNotificationCenter
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
        onMarkAsRead={handleMarkNotificationAsRead}
        onMarkAllAsRead={handleMarkAllNotificationsAsRead}
      />

      <main className="relative z-10 pb-24">
        <div className="p-4 space-y-4">
          {/* Hero CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Button
              onClick={() => navigate("/field-sales/pos")}
              className="w-full h-16 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold text-lg shadow-xl shadow-orange-500/30 rounded-2xl group relative overflow-hidden"
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0"
                animate={{ x: ["-100%", "100%"] }}
                transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              />
              <Plus className="h-6 w-6 mr-3" />
              Nouvelle Vente
              <Sparkles className="h-5 w-5 ml-auto opacity-70" />
            </Button>
          </motion.div>

          {/* Stats Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 gap-3"
          >
            <IOSStatWidget
              label="Ventes aujourd'hui"
              value={stats.todaySales}
              subValue={`${stats.todayRevenue.toFixed(2)} $`}
              icon={<ShoppingCart className="h-5 w-5" />}
              color="orange"
              onClick={() => navigate("/field-sales/sales")}
            />
            <IOSStatWidget
              label="Commissions"
              value={`${stats.weekCommissions.toFixed(0)}$`}
              subValue="Cette semaine"
              icon={<DollarSign className="h-5 w-5" />}
              color="emerald"
              trend="up"
              trendValue="+12%"
              onClick={() => navigate("/field-sales/commissions")}
            />
          </motion.div>

          {/* Rank Widget */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <IOSWidgetCard
              onClick={() => navigate("/field-sales/leaderboard")}
              className="p-4 cursor-pointer active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-3 rounded-2xl",
                    stats.rank <= 3 ? "bg-amber-500/20" : "bg-slate-800"
                  )}>
                    <Trophy className={cn(
                      "h-6 w-6",
                      stats.rank === 1 && "text-yellow-400",
                      stats.rank === 2 && "text-slate-300",
                      stats.rank === 3 && "text-amber-600",
                      stats.rank > 3 && "text-slate-500"
                    )} />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Classement</p>
                    <p className="text-xs text-slate-500">
                      {stats.rank <= 3 ? "Vous êtes dans le top 3!" : "Continuez vos efforts!"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-white">#{stats.rank}</p>
                  <p className="text-xs text-slate-500">sur {stats.totalReps}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-600 ml-2" />
              </div>
            </IOSWidgetCard>
          </motion.div>

          {/* Objectives */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-purple-400" />
                Objectifs & Bonus
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/field-sales/objectives")}
                className="text-slate-400 hover:text-white text-xs px-2"
              >
                Voir tout
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
            
            {objectives.slice(0, 2).map((obj) => (
              <IOSProgressWidget
                key={obj.id}
                label={obj.label}
                current={obj.current}
                target={obj.target}
                icon={obj.icon}
                color={obj.id === "daily" ? "orange" : obj.id === "weekly" ? "purple" : "emerald"}
              />
            ))}
          </motion.div>

          {/* Pending Alert */}
          <AnimatePresence>
            {stats.pendingSales > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <IOSWidgetCard
                  onClick={() => navigate("/field-sales/sales?filter=pending")}
                  className="p-4 border-amber-500/30 bg-amber-500/10 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/20">
                      <Clock className="h-5 w-5 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-amber-200 font-medium">
                        {stats.pendingSales} vente(s) en attente
                      </p>
                      <p className="text-xs text-amber-400/70">
                        Paiements non confirmés
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-amber-400" />
                  </div>
                </IOSWidgetCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Recent Sales */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <IOSWidgetCard className="overflow-hidden">
              <div className="p-4 border-b border-slate-800/60">
                <div className="flex items-center justify-between">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-orange-400" />
                    Ventes récentes
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/field-sales/sales")}
                    className="text-slate-400 hover:text-white text-xs px-2"
                  >
                    Tout voir
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
              
              <div className="divide-y divide-slate-800/40">
                {recentSales.length === 0 ? (
                  <div className="p-8 text-center">
                    <ShoppingCart className="h-10 w-10 text-slate-700 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">Aucune vente récente</p>
                    <p className="text-slate-600 text-xs mt-1">Commencez à vendre!</p>
                  </div>
                ) : (
                  recentSales.map((sale, index) => {
                    const status = getPaymentStatusConfig(sale.payment_status);
                    
                    return (
                      <motion.button
                        key={sale.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 + index * 0.1 }}
                        onClick={() => navigate(`/field-sales/sales/${sale.id}`)}
                        className="w-full p-4 flex items-center gap-3 hover:bg-slate-800/40 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{sale.customer_name}</p>
                          <p className="text-xs text-slate-500">
                            {format(new Date(sale.created_at), "HH:mm", { locale: fr })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-orange-400">{sale.total_amount.toFixed(2)} $</p>
                          <span className={cn(
                            "inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-medium",
                            status.className
                          )}>
                            {status.label}
                          </span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-600" />
                      </motion.button>
                    );
                  })
                )}
              </div>
            </IOSWidgetCard>
          </motion.div>
        </div>
      </main>

      <IOSBottomNav />
    </div>
  );
}
