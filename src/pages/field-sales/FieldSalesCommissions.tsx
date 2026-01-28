/**
 * FieldSalesCommissions - iOS-style commission dashboard with cashout and bonus tracking
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { 
  DollarSign, TrendingUp, Clock, CheckCircle, 
  Loader2, Wallet, ArrowUpRight, Target, Gift,
  ChevronRight, Sparkles, ArrowDownRight
} from "lucide-react";
import { format, startOfWeek, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import StaffBackground from "@/components/staff/StaffBackground";
import { IOSHeader } from "@/components/field-sales/ios/IOSHeader";
import { IOSBottomNav } from "@/components/field-sales/ios/IOSBottomNav";
import { IOSWidgetCard, IOSStatWidget } from "@/components/field-sales/ios/IOSWidgetCard";
import { CashoutRequestDialog } from "@/components/field-sales/CashoutRequestDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface Commission {
  id: string;
  field_order_id: string | null;
  converted_order_id: string | null;
  commission_amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
}

interface CashoutRequest {
  id: string;
  amount: number;
  method: string;
  destination: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
}

interface CommissionStats {
  pending: number;
  validated: number;
  paid: number;
  available: number;
  total: number;
}

interface Bonus {
  id: string;
  label: string;
  threshold: number;
  reward: number;
  current: number;
  achieved: boolean;
}

export default function FieldSalesCommissions() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [cashoutDialogOpen, setCashoutDialogOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id || null);
      setLoading(false);
    });
  }, []);

  // Fetch commissions
  const { data: commissions = [] } = useQuery({
    queryKey: ["field-sales-commissions", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("sales_commissions")
        .select("*")
        .eq("salesperson_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Commission[];
    },
    enabled: !!userId,
  });

  // Fetch cashout requests
  const { data: cashoutRequests = [] } = useQuery({
    queryKey: ["field-sales-cashout-requests", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("field_sales_cashout_requests")
        .select("*")
        .eq("salesperson_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as CashoutRequest[];
    },
    enabled: !!userId,
  });

  // Calculate stats
  const stats: CommissionStats = {
    pending: commissions.filter(c => c.status === "pending").reduce((sum, c) => sum + c.commission_amount, 0),
    validated: commissions.filter(c => c.status === "validated").reduce((sum, c) => sum + c.commission_amount, 0),
    paid: commissions.filter(c => c.status === "paid").reduce((sum, c) => sum + c.commission_amount, 0),
    available: commissions.filter(c => c.status === "validated").reduce((sum, c) => sum + c.commission_amount, 0),
    total: commissions.reduce((sum, c) => sum + c.commission_amount, 0),
  };

  // Period stats
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const monthStart = startOfMonth(now);

  const periodStats = {
    today: commissions.filter(c => new Date(c.created_at) >= today).reduce((sum, c) => sum + c.commission_amount, 0),
    week: commissions.filter(c => new Date(c.created_at) >= weekStart).reduce((sum, c) => sum + c.commission_amount, 0),
    month: commissions.filter(c => new Date(c.created_at) >= monthStart).reduce((sum, c) => sum + c.commission_amount, 0),
  };

  // Generate bonuses based on sales count
  const monthlySales = commissions.filter(c => new Date(c.created_at) >= monthStart).length;
  const bonuses: Bonus[] = [
    { id: "10sales", label: "10 ventes", threshold: 10, reward: 50, current: monthlySales, achieved: monthlySales >= 10 },
    { id: "25sales", label: "25 ventes", threshold: 25, reward: 100, current: monthlySales, achieved: monthlySales >= 25 },
    { id: "50sales", label: "50 ventes", threshold: 50, reward: 250, current: monthlySales, achieved: monthlySales >= 50 },
    { id: "100sales", label: "100 ventes", threshold: 100, reward: 500, current: monthlySales, achieved: monthlySales >= 100 },
  ];

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "paid":
        return { label: "Payé", icon: CheckCircle, className: "bg-emerald-500/20 text-emerald-400" };
      case "validated":
        return { label: "Validé", icon: ArrowUpRight, className: "bg-blue-500/20 text-blue-400" };
      case "pending":
        return { label: "En attente", icon: Clock, className: "bg-amber-500/20 text-amber-400" };
      case "approved":
        return { label: "Approuvé", icon: CheckCircle, className: "bg-emerald-500/20 text-emerald-400" };
      case "rejected":
        return { label: "Refusé", icon: ArrowDownRight, className: "bg-red-500/20 text-red-400" };
      default:
        return { label: status, icon: Clock, className: "bg-slate-500/20 text-slate-400" };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative bg-slate-950">
        <StaffBackground />
        <div className="flex flex-col items-center gap-4 z-10">
          <div className="p-4 rounded-2xl bg-emerald-500/20">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
          </div>
          <p className="text-slate-400 font-medium">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative bg-slate-950">
      <StaffBackground />
      
      <IOSHeader
        title="Mes Gains"
        subtitle="Commissions et bonus"
      />

      <main className="relative z-10 pb-24">
        <div className="p-4 space-y-4">
          {/* Main Balance Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <IOSWidgetCard
              variant="gradient"
              gradientFrom="from-emerald-500/20"
              gradientTo="to-emerald-500/5"
              className="p-6 border-emerald-500/20"
            >
              <div className="text-center">
                <p className="text-slate-400 text-sm mb-1">Solde disponible</p>
                <motion.p
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  className="text-5xl font-bold text-white mb-4"
                >
                  ${stats.available.toFixed(2)}
                </motion.p>
                
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-amber-400 font-semibold">${stats.pending.toFixed(0)}</p>
                    <p className="text-xs text-slate-500">En attente</p>
                  </div>
                  <div className="text-center">
                    <p className="text-blue-400 font-semibold">${stats.validated.toFixed(0)}</p>
                    <p className="text-xs text-slate-500">Validé</p>
                  </div>
                  <div className="text-center">
                    <p className="text-emerald-400 font-semibold">${stats.paid.toFixed(0)}</p>
                    <p className="text-xs text-slate-500">Payé</p>
                  </div>
                </div>

                <Button
                  onClick={() => setCashoutDialogOpen(true)}
                  disabled={stats.available < 25}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold rounded-xl h-12"
                >
                  <Wallet className="h-5 w-5 mr-2" />
                  Demander un retrait
                  <Sparkles className="h-4 w-4 ml-auto opacity-70" />
                </Button>
                {stats.available < 25 && (
                  <p className="text-xs text-slate-500 mt-2">Minimum: 25$ pour un retrait</p>
                )}
              </div>
            </IOSWidgetCard>
          </motion.div>

          {/* Period Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-3 gap-3"
          >
            <IOSWidgetCard className="p-3 text-center">
              <p className="text-xl font-bold text-white">${periodStats.today.toFixed(0)}</p>
              <p className="text-xs text-slate-500">Aujourd'hui</p>
            </IOSWidgetCard>
            <IOSWidgetCard className="p-3 text-center">
              <p className="text-xl font-bold text-white">${periodStats.week.toFixed(0)}</p>
              <p className="text-xs text-slate-500">Cette semaine</p>
            </IOSWidgetCard>
            <IOSWidgetCard className="p-3 text-center">
              <p className="text-xl font-bold text-white">${periodStats.month.toFixed(0)}</p>
              <p className="text-xs text-slate-500">Ce mois</p>
            </IOSWidgetCard>
          </motion.div>

          {/* Bonus Milestones */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <IOSWidgetCard className="overflow-hidden">
              <div className="p-4 border-b border-slate-800/60">
                <h2 className="text-white font-semibold flex items-center gap-2">
                  <Gift className="h-4 w-4 text-amber-400" />
                  Bonus mensuels
                  <span className="text-xs text-slate-500 font-normal ml-auto">
                    {monthlySales} ventes ce mois
                  </span>
                </h2>
              </div>
              
              <div className="p-4 grid grid-cols-2 gap-3">
                {bonuses.map((bonus) => {
                  const progress = Math.min(100, (bonus.current / bonus.threshold) * 100);
                  
                  return (
                    <div
                      key={bonus.id}
                      className={cn(
                        "p-3 rounded-xl border transition-all",
                        bonus.achieved 
                          ? "bg-emerald-500/10 border-emerald-500/30" 
                          : "bg-slate-900/60 border-slate-800/60"
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-slate-400">{bonus.label}</span>
                        {bonus.achieved && (
                          <CheckCircle className="h-4 w-4 text-emerald-400" />
                        )}
                      </div>
                      <p className={cn(
                        "font-bold",
                        bonus.achieved ? "text-emerald-400" : "text-white"
                      )}>
                        +${bonus.reward}
                      </p>
                      {!bonus.achieved && (
                        <>
                          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
                            <div 
                              className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">
                            {bonus.current}/{bonus.threshold}
                          </p>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </IOSWidgetCard>
          </motion.div>

          {/* Tabs: Commissions & Cashouts */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Tabs defaultValue="commissions">
              <TabsList className="w-full bg-slate-900/80 border border-slate-800/60 p-1 rounded-2xl mb-4">
                <TabsTrigger 
                  value="commissions" 
                  className="flex-1 rounded-xl data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400"
                >
                  Commissions
                </TabsTrigger>
                <TabsTrigger 
                  value="cashouts" 
                  className="flex-1 rounded-xl data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400"
                >
                  Retraits
                </TabsTrigger>
              </TabsList>

              <TabsContent value="commissions" className="mt-0">
                <IOSWidgetCard className="overflow-hidden">
                  <div className="divide-y divide-slate-800/40">
                    {commissions.length === 0 ? (
                      <div className="p-8 text-center">
                        <DollarSign className="h-10 w-10 text-slate-700 mx-auto mb-2" />
                        <p className="text-slate-500">Aucune commission</p>
                        <p className="text-xs text-slate-600 mt-1">Effectuez des ventes pour gagner</p>
                      </div>
                    ) : (
                      commissions.slice(0, 15).map((commission, index) => {
                        const status = getStatusConfig(commission.status);
                        const StatusIcon = status.icon;
                        
                        return (
                          <motion.div
                            key={commission.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center justify-between p-4"
                          >
                            <div>
                              <p className="text-white font-medium">
                                +${commission.commission_amount.toFixed(2)}
                              </p>
                              <p className="text-xs text-slate-500">
                                {format(new Date(commission.created_at), "d MMM yyyy, HH:mm", { locale: fr })}
                              </p>
                            </div>
                            <div className={cn(
                              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                              status.className
                            )}>
                              <StatusIcon className="h-3 w-3" />
                              {status.label}
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </IOSWidgetCard>
              </TabsContent>

              <TabsContent value="cashouts" className="mt-0">
                <IOSWidgetCard className="overflow-hidden">
                  <div className="divide-y divide-slate-800/40">
                    {cashoutRequests.length === 0 ? (
                      <div className="p-8 text-center">
                        <Wallet className="h-10 w-10 text-slate-700 mx-auto mb-2" />
                        <p className="text-slate-500">Aucune demande de retrait</p>
                      </div>
                    ) : (
                      cashoutRequests.map((request, index) => {
                        const status = getStatusConfig(request.status);
                        const StatusIcon = status.icon;
                        
                        return (
                          <motion.div
                            key={request.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex items-center justify-between p-4"
                          >
                            <div>
                              <p className="text-white font-medium">
                                ${request.amount.toFixed(2)}
                              </p>
                              <p className="text-xs text-slate-500">
                                {request.method === "interac" ? "Interac" : 
                                 request.method === "cheque" ? "Chèque" : "Comptant"} • {format(new Date(request.created_at), "d MMM", { locale: fr })}
                              </p>
                            </div>
                            <div className={cn(
                              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                              status.className
                            )}>
                              <StatusIcon className="h-3 w-3" />
                              {status.label}
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </IOSWidgetCard>
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </main>

      <IOSBottomNav />

      <CashoutRequestDialog
        open={cashoutDialogOpen}
        onOpenChange={setCashoutDialogOpen}
        availableBalance={stats.available}
      />
    </div>
  );
}
