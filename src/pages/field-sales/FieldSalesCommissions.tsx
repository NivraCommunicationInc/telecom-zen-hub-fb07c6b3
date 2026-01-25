/**
 * FieldSalesCommissions - Commission tracking and earnings dashboard
 * Shows daily/weekly/monthly earnings with status breakdown
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, TrendingUp, Clock, CheckCircle, 
  Loader2, Calendar, Wallet
} from "lucide-react";
import { format, startOfWeek, startOfMonth, endOfWeek, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import StaffBackground from "@/components/staff/StaffBackground";
import { FieldSalesNav } from "@/components/field-sales/FieldSalesNav";

interface Commission {
  id: string;
  field_order_id: string | null;
  converted_order_id: string | null;
  commission_amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
}

interface CommissionStats {
  pending: number;
  validated: number;
  paid: number;
  total: number;
}

export default function FieldSalesCommissions() {
  const [loading, setLoading] = useState(true);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [stats, setStats] = useState<CommissionStats>({
    pending: 0,
    validated: 0,
    paid: 0,
    total: 0,
  });
  const [periodStats, setPeriodStats] = useState({
    today: 0,
    week: 0,
    month: 0,
  });

  useEffect(() => {
    loadCommissions();
  }, []);

  const loadCommissions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data, error } = await supabase
        .from("sales_commissions")
        .select("*")
        .eq("salesperson_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const commissionData = data || [];
      setCommissions(commissionData);

      // Calculate stats
      const pending = commissionData
        .filter((c) => c.status === "pending")
        .reduce((sum, c) => sum + c.commission_amount, 0);
      const validated = commissionData
        .filter((c) => c.status === "validated")
        .reduce((sum, c) => sum + c.commission_amount, 0);
      const paid = commissionData
        .filter((c) => c.status === "paid")
        .reduce((sum, c) => sum + c.commission_amount, 0);

      setStats({
        pending,
        validated,
        paid,
        total: pending + validated + paid,
      });

      // Calculate period stats
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const monthStart = startOfMonth(now);

      const todayEarnings = commissionData
        .filter((c) => new Date(c.created_at) >= today)
        .reduce((sum, c) => sum + c.commission_amount, 0);

      const weekEarnings = commissionData
        .filter((c) => new Date(c.created_at) >= weekStart)
        .reduce((sum, c) => sum + c.commission_amount, 0);

      const monthEarnings = commissionData
        .filter((c) => new Date(c.created_at) >= monthStart)
        .reduce((sum, c) => sum + c.commission_amount, 0);

      setPeriodStats({
        today: todayEarnings,
        week: weekEarnings,
        month: monthEarnings,
      });
    } catch (error) {
      console.error("Error loading commissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "paid":
        return { label: "Payé", icon: Wallet, className: "text-emerald-400 bg-emerald-500/10" };
      case "validated":
        return { label: "Validé", icon: CheckCircle, className: "text-blue-400 bg-blue-500/10" };
      case "pending":
        return { label: "En attente", icon: Clock, className: "text-amber-400 bg-amber-500/10" };
      default:
        return { label: status, icon: Clock, className: "text-slate-400 bg-slate-500/10" };
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
          <h1 className="text-xl font-bold text-white">Mes Commissions</h1>
          <p className="text-sm text-slate-400">Suivi de vos gains</p>
        </div>
      </header>

      <main className="p-4 space-y-4 relative z-10">
        {/* Total Earnings Card */}
        <Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/20 to-amber-500/10 backdrop-blur-xl">
          <CardContent className="py-6">
            <div className="text-center">
              <p className="text-slate-300 text-sm mb-1">Total des gains</p>
              <p className="text-4xl font-bold text-white">{stats.total.toFixed(2)} $</p>
              <div className="flex justify-center gap-4 mt-4 text-sm">
                <div className="text-center">
                  <p className="text-amber-400 font-semibold">{stats.pending.toFixed(2)} $</p>
                  <p className="text-slate-400 text-xs">En attente</p>
                </div>
                <div className="text-center">
                  <p className="text-blue-400 font-semibold">{stats.validated.toFixed(2)} $</p>
                  <p className="text-slate-400 text-xs">Validé</p>
                </div>
                <div className="text-center">
                  <p className="text-emerald-400 font-semibold">{stats.paid.toFixed(2)} $</p>
                  <p className="text-slate-400 text-xs">Payé</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Period Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
            <CardContent className="py-4 px-3 text-center">
              <p className="text-2xl font-bold text-white">{periodStats.today.toFixed(0)} $</p>
              <p className="text-xs text-slate-400">Aujourd'hui</p>
            </CardContent>
          </Card>
          <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
            <CardContent className="py-4 px-3 text-center">
              <p className="text-2xl font-bold text-white">{periodStats.week.toFixed(0)} $</p>
              <p className="text-xs text-slate-400">Cette semaine</p>
            </CardContent>
          </Card>
          <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
            <CardContent className="py-4 px-3 text-center">
              <p className="text-2xl font-bold text-white">{periodStats.month.toFixed(0)} $</p>
              <p className="text-xs text-slate-400">Ce mois</p>
            </CardContent>
          </Card>
        </div>

        {/* Commission History */}
        <Card className="border-slate-700/50 bg-slate-900/60 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-400" />
              Historique des commissions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {commissions.length === 0 ? (
              <p className="text-slate-400 text-center py-4">Aucune commission encore</p>
            ) : (
              commissions.slice(0, 20).map((commission) => {
                const status = getStatusConfig(commission.status);
                const StatusIcon = status.icon;

                return (
                  <div
                    key={commission.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/50"
                  >
                    <div>
                      <p className="text-white font-medium">
                        +{commission.commission_amount.toFixed(2)} $
                      </p>
                      <p className="text-xs text-slate-400">
                        {format(new Date(commission.created_at), "d MMM yyyy", { locale: fr })}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${status.className}`}>
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </div>
                  </div>
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
