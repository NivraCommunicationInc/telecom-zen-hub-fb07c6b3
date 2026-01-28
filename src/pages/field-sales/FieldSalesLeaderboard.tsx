/**
 * FieldSalesLeaderboard - iOS-style leaderboard for field sales representatives
 * Features: Podium, rankings, stats, period filters
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { 
  Trophy, Medal, Award, TrendingUp, Crown,
  Loader2, User, ChevronUp, ChevronDown, Minus
} from "lucide-react";
import StaffBackground from "@/components/staff/StaffBackground";
import { IOSHeader } from "@/components/field-sales/ios/IOSHeader";
import { IOSBottomNav } from "@/components/field-sales/ios/IOSBottomNav";
import { IOSWidgetCard } from "@/components/field-sales/ios/IOSWidgetCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  user_id: string;
  full_name: string | null;
  email: string;
  total_sales: number;
  total_revenue: number;
  total_commissions: number;
  sales_today: number;
  sales_this_week: number;
  sales_this_month: number;
}

type Period = "today" | "week" | "month" | "all";

export default function FieldSalesLeaderboard() {
  const [period, setPeriod] = useState<Period>("month");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserId(session?.user?.id || null);
    });
  }, []);

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ["field-sales-leaderboard-user", period],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_sales_leaderboard")
        .select("*");

      if (error) throw error;
      
      // Sort by the selected period
      const sortKey = period === "today" ? "sales_today" :
                      period === "week" ? "sales_this_week" :
                      period === "month" ? "sales_this_month" : "total_sales";
      
      return (data as LeaderboardEntry[]).sort((a, b) => 
        (b[sortKey] as number) - (a[sortKey] as number)
      );
    },
  });

  const getSalesCount = (entry: LeaderboardEntry) => {
    switch (period) {
      case "today": return entry.sales_today;
      case "week": return entry.sales_this_week;
      case "month": return entry.sales_this_month;
      default: return entry.total_sales;
    }
  };

  const getPeriodLabel = () => {
    switch (period) {
      case "today": return "aujourd'hui";
      case "week": return "cette semaine";
      case "month": return "ce mois";
      default: return "au total";
    }
  };

  const top3 = leaderboard?.slice(0, 3) || [];
  const rest = leaderboard?.slice(3) || [];
  const currentUserRank = leaderboard?.findIndex(e => e.user_id === currentUserId);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative bg-slate-950">
        <StaffBackground />
        <div className="flex flex-col items-center gap-4 z-10">
          <div className="p-4 rounded-2xl bg-purple-500/20">
            <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
          </div>
          <p className="text-slate-400 font-medium">Chargement du classement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative bg-slate-950">
      <StaffBackground />
      
      <IOSHeader
        title="Classement"
        subtitle="Compétition entre vendeurs"
      />

      <main className="relative z-10 pb-24">
        <div className="p-4 space-y-4">
          {/* Period Tabs */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <TabsList className="w-full bg-slate-900/80 border border-slate-800/60 p-1 rounded-2xl">
                <TabsTrigger 
                  value="today" 
                  className="flex-1 rounded-xl data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
                >
                  Aujourd'hui
                </TabsTrigger>
                <TabsTrigger 
                  value="week" 
                  className="flex-1 rounded-xl data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
                >
                  Semaine
                </TabsTrigger>
                <TabsTrigger 
                  value="month" 
                  className="flex-1 rounded-xl data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
                >
                  Mois
                </TabsTrigger>
                <TabsTrigger 
                  value="all" 
                  className="flex-1 rounded-xl data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
                >
                  Total
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </motion.div>

          {/* Podium */}
          {top3.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="relative pt-8 pb-4"
            >
              <div className="flex items-end justify-center gap-2">
                {/* 2nd Place */}
                {top3[1] && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex flex-col items-center"
                  >
                    <Avatar className="h-16 w-16 border-2 border-slate-400 mb-2">
                      <AvatarFallback className="bg-gradient-to-br from-slate-400 to-slate-500 text-white font-bold">
                        {(top3[1].full_name || "?")[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-gradient-to-t from-slate-700 to-slate-600 rounded-t-xl px-6 py-4 text-center min-w-[100px]">
                      <Medal className="h-6 w-6 text-slate-300 mx-auto mb-1" />
                      <p className="text-white font-bold text-lg">2</p>
                      <p className="text-xs text-slate-400 truncate max-w-[80px]">
                        {top3[1].full_name?.split(" ")[0] || "—"}
                      </p>
                      <p className="text-slate-300 font-bold text-sm mt-1">
                        {getSalesCount(top3[1])} ventes
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* 1st Place */}
                {top3[0] && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-col items-center -mt-8"
                  >
                    <div className="relative">
                      <Crown className="h-8 w-8 text-yellow-400 absolute -top-6 left-1/2 -translate-x-1/2" />
                      <Avatar className="h-20 w-20 border-4 border-yellow-400 shadow-lg shadow-yellow-400/30">
                        <AvatarFallback className="bg-gradient-to-br from-yellow-400 to-amber-500 text-white font-bold text-2xl">
                          {(top3[0].full_name || "?")[0]}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="bg-gradient-to-t from-yellow-600 to-amber-500 rounded-t-xl px-8 py-6 text-center min-w-[120px] mt-2">
                      <Trophy className="h-8 w-8 text-yellow-200 mx-auto mb-1" />
                      <p className="text-white font-bold text-2xl">1</p>
                      <p className="text-sm text-yellow-200/80 truncate max-w-[100px]">
                        {top3[0].full_name?.split(" ")[0] || "—"}
                      </p>
                      <p className="text-white font-bold mt-1">
                        {getSalesCount(top3[0])} ventes
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* 3rd Place */}
                {top3[2] && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="flex flex-col items-center"
                  >
                    <Avatar className="h-14 w-14 border-2 border-amber-600 mb-2">
                      <AvatarFallback className="bg-gradient-to-br from-amber-600 to-amber-700 text-white font-bold">
                        {(top3[2].full_name || "?")[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-gradient-to-t from-amber-800 to-amber-700 rounded-t-xl px-5 py-3 text-center min-w-[90px]">
                      <Award className="h-5 w-5 text-amber-400 mx-auto mb-1" />
                      <p className="text-white font-bold text-lg">3</p>
                      <p className="text-xs text-amber-300/80 truncate max-w-[70px]">
                        {top3[2].full_name?.split(" ")[0] || "—"}
                      </p>
                      <p className="text-amber-200 font-bold text-sm mt-1">
                        {getSalesCount(top3[2])} ventes
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}

          {/* Your Position */}
          {currentUserRank !== undefined && currentUserRank >= 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <IOSWidgetCard className="p-4 border-orange-500/30 bg-orange-500/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-orange-500/20">
                    <TrendingUp className="h-5 w-5 text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold">Votre position</p>
                    <p className="text-xs text-slate-400">
                      {currentUserRank < 3 
                        ? "Vous êtes sur le podium! 🎉" 
                        : `${currentUserRank + 1 - 3} place(s) du podium`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-orange-400">#{currentUserRank + 1}</p>
                    <p className="text-xs text-slate-500">sur {leaderboard?.length || 0}</p>
                  </div>
                </div>
              </IOSWidgetCard>
            </motion.div>
          )}

          {/* Full Rankings */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <IOSWidgetCard className="overflow-hidden">
              <div className="p-4 border-b border-slate-800/60">
                <h2 className="text-white font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-cyan-400" />
                  Classement complet
                  <span className="text-xs text-slate-500 font-normal ml-auto">
                    {getPeriodLabel()}
                  </span>
                </h2>
              </div>

              <div className="divide-y divide-slate-800/40">
                {leaderboard?.map((entry, index) => {
                  const isCurrentUser = entry.user_id === currentUserId;
                  const sales = getSalesCount(entry);
                  
                  return (
                    <div
                      key={entry.user_id}
                      className={cn(
                        "flex items-center gap-3 p-4 transition-colors",
                        isCurrentUser && "bg-orange-500/10"
                      )}
                    >
                      {/* Rank */}
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0",
                        index === 0 && "bg-yellow-500/20 text-yellow-400",
                        index === 1 && "bg-slate-400/20 text-slate-300",
                        index === 2 && "bg-amber-600/20 text-amber-500",
                        index > 2 && "bg-slate-800 text-slate-500"
                      )}>
                        {index < 3 ? (
                          index === 0 ? <Trophy className="h-4 w-4" /> :
                          index === 1 ? <Medal className="h-4 w-4" /> :
                          <Award className="h-4 w-4" />
                        ) : (
                          index + 1
                        )}
                      </div>

                      {/* Avatar */}
                      <Avatar className={cn(
                        "h-10 w-10 border-2",
                        isCurrentUser ? "border-orange-500" : "border-slate-700"
                      )}>
                        <AvatarFallback className={cn(
                          "font-semibold",
                          isCurrentUser 
                            ? "bg-gradient-to-br from-orange-500 to-amber-500 text-white" 
                            : "bg-slate-800 text-slate-400"
                        )}>
                          {(entry.full_name || "?")[0]}
                        </AvatarFallback>
                      </Avatar>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "font-medium truncate",
                          isCurrentUser ? "text-orange-400" : "text-white"
                        )}>
                          {entry.full_name || "Sans nom"}
                          {isCurrentUser && <span className="text-xs ml-2">(vous)</span>}
                        </p>
                        <p className="text-xs text-slate-500">
                          ${entry.total_commissions.toFixed(0)} commissions
                        </p>
                      </div>

                      {/* Sales */}
                      <div className="text-right">
                        <p className={cn(
                          "font-bold",
                          isCurrentUser ? "text-orange-400" : "text-white"
                        )}>
                          {sales}
                        </p>
                        <p className="text-xs text-slate-500">ventes</p>
                      </div>
                    </div>
                  );
                })}

                {(!leaderboard || leaderboard.length === 0) && (
                  <div className="p-8 text-center">
                    <User className="h-10 w-10 text-slate-700 mx-auto mb-2" />
                    <p className="text-slate-500">Aucun vendeur actif</p>
                  </div>
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
