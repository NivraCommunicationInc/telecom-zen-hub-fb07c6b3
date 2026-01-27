/**
 * LeaderboardTab - Sales representative ranking and performance tracking
 */
import { useQuery } from "@tanstack/react-query";
import { adminClient as adminSupabase } from "@/integrations/backend/adminClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Medal, Award, TrendingUp, Target, DollarSign, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  user_id: string;
  full_name: string | null;
  email: string;
  total_sales: number;
  total_revenue: number;
  total_commissions: number;
  total_bonuses: number;
  sales_today: number;
  sales_this_week: number;
  sales_this_month: number;
}

export function LeaderboardTab() {
  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ["field-sales-leaderboard"],
    queryFn: async () => {
      const { data, error } = await adminSupabase
        .from("field_sales_leaderboard")
        .select("*")
        .order("total_sales", { ascending: false });

      if (error) throw error;
      return data as LeaderboardEntry[];
    },
  });

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-5 w-5 text-yellow-400" />;
      case 1:
        return <Medal className="h-5 w-5 text-slate-300" />;
      case 2:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-slate-500 font-bold">{index + 1}</span>;
    }
  };

  const getRankClass = (index: number) => {
    switch (index) {
      case 0:
        return "bg-yellow-500/10 border-yellow-500/30";
      case 1:
        return "bg-slate-400/10 border-slate-400/30";
      case 2:
        return "bg-amber-600/10 border-amber-600/30";
      default:
        return "";
    }
  };

  const topPerformers = leaderboard?.slice(0, 3) || [];

  return (
    <div className="space-y-6">
      {/* Top 3 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoading ? (
          [...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))
        ) : (
          topPerformers.map((performer, index) => (
            <Card key={performer.user_id} className={cn(
              "border-2 relative overflow-hidden",
              getRankClass(index),
              "bg-slate-800/50"
            )}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-full",
                      index === 0 ? "bg-yellow-500/20" :
                      index === 1 ? "bg-slate-400/20" :
                      "bg-amber-600/20"
                    )}>
                      {getRankIcon(index)}
                    </div>
                    <div>
                      <p className="font-bold text-white">
                        {performer.full_name || "Sans nom"}
                      </p>
                      <p className="text-xs text-slate-500">{performer.email}</p>
                    </div>
                  </div>
                  <Badge className={cn(
                    "text-xs",
                    index === 0 ? "bg-yellow-500/20 text-yellow-400 border-0" :
                    index === 1 ? "bg-slate-400/20 text-slate-300 border-0" :
                    "bg-amber-600/20 text-amber-400 border-0"
                  )}>
                    #{index + 1}
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-2xl font-bold text-white">{performer.total_sales}</p>
                    <p className="text-xs text-slate-500">Ventes totales</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-emerald-400">
                      ${performer.total_commissions.toFixed(0)}
                    </p>
                    <p className="text-xs text-slate-500">Commissions</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Full Leaderboard Table */}
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-orange-400" />
            Classement complet
          </CardTitle>
          <CardDescription>Performance de tous les représentants</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="month">
            <TabsList className="bg-slate-900/50 border border-slate-700 mb-4">
              <TabsTrigger value="today">Aujourd'hui</TabsTrigger>
              <TabsTrigger value="week">Cette semaine</TabsTrigger>
              <TabsTrigger value="month">Ce mois</TabsTrigger>
              <TabsTrigger value="all">Total</TabsTrigger>
            </TabsList>

            <TabsContent value="today">
              <LeaderboardTable 
                data={leaderboard} 
                isLoading={isLoading}
                salesKey="sales_today"
              />
            </TabsContent>
            <TabsContent value="week">
              <LeaderboardTable 
                data={leaderboard} 
                isLoading={isLoading}
                salesKey="sales_this_week"
              />
            </TabsContent>
            <TabsContent value="month">
              <LeaderboardTable 
                data={leaderboard} 
                isLoading={isLoading}
                salesKey="sales_this_month"
              />
            </TabsContent>
            <TabsContent value="all">
              <LeaderboardTable 
                data={leaderboard} 
                isLoading={isLoading}
                salesKey="total_sales"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function LeaderboardTable({ 
  data, 
  isLoading,
  salesKey 
}: { 
  data: LeaderboardEntry[] | undefined; 
  isLoading: boolean;
  salesKey: keyof LeaderboardEntry;
}) {
  const sorted = data?.sort((a, b) => 
    (b[salesKey] as number) - (a[salesKey] as number)
  );

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!sorted || sorted.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Aucun représentant actif</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-slate-700 hover:bg-transparent">
          <TableHead className="text-slate-400 w-12">#</TableHead>
          <TableHead className="text-slate-400">Représentant</TableHead>
          <TableHead className="text-slate-400 text-right">Ventes</TableHead>
          <TableHead className="text-slate-400 text-right">Revenus</TableHead>
          <TableHead className="text-slate-400 text-right">Commissions</TableHead>
          <TableHead className="text-slate-400 text-right">Bonus</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((entry, index) => (
          <TableRow key={entry.user_id} className="border-slate-700">
            <TableCell className="text-center">
              {index < 3 ? (
                <div className="flex justify-center">
                  {index === 0 && <Trophy className="h-4 w-4 text-yellow-400" />}
                  {index === 1 && <Medal className="h-4 w-4 text-slate-300" />}
                  {index === 2 && <Award className="h-4 w-4 text-amber-600" />}
                </div>
              ) : (
                <span className="text-slate-500">{index + 1}</span>
              )}
            </TableCell>
            <TableCell>
              <p className="text-white font-medium">{entry.full_name || "Sans nom"}</p>
              <p className="text-xs text-slate-500">{entry.email}</p>
            </TableCell>
            <TableCell className="text-right">
              <span className="font-bold text-white">{entry[salesKey] as number}</span>
            </TableCell>
            <TableCell className="text-right text-white">
              ${(entry.total_revenue as number).toFixed(2)}
            </TableCell>
            <TableCell className="text-right text-emerald-400">
              ${(entry.total_commissions as number).toFixed(2)}
            </TableCell>
            <TableCell className="text-right text-amber-400">
              ${(entry.total_bonuses as number).toFixed(2)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
