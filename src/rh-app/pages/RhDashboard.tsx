/**
 * RhDashboard — Employee RH home page with financial wallet.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt, FileText, DollarSign, Bell, Wallet, Clock, Lock, TrendingUp, Banknote, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useEmployeeWallet, fmtCAD } from "@/rh-app/hooks/useEmployeeWallet";

export default function RhDashboard() {
  const { data: user } = useQuery({
    queryKey: ["rh-current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["rh-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, job_title")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: wallet, isLoading: walletLoading } = useEmployeeWallet(user?.id);

  const { data: latestPayslip } = useQuery({
    queryKey: ["rh-latest-payslip", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("payroll_entries")
        .select("id, payroll_number, status, net_pay, created_at, pay_periods(period_name)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: unreadNotifs } = useQuery({
    queryKey: ["rh-unread-notifs", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("employee_notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);
      return count ?? 0;
    },
    enabled: !!user?.id,
  });

  const w = wallet ?? { available_balance: 0, pending_balance: 0, validated_balance: 0, payable_balance: 0, in_payroll_balance: 0, locked_balance: 0, total_earned: 0, paid_via_payroll: 0, lost_total: 0, withdrawals_paid: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Bonjour{profile?.first_name ? `, ${profile.first_name}` : ""} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {profile?.job_title || "Votre espace ressources humaines"}
        </p>
      </div>

      {/* Wallet Section — Stripe/PayPal style */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Mon portefeuille
          </CardTitle>
        </CardHeader>
        <CardContent>
          {walletLoading ? (
            <div className="h-20 flex items-center justify-center text-muted-foreground text-sm">Chargement…</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Disponible
                </p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {fmtCAD(w.available_balance)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> En attente
                </p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                  {fmtCAD(w.pending_balance)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Banknote className="h-3 w-3" /> Payable
                </p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {fmtCAD(w.payable_balance)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Inclus en paie
                </p>
                <p className="text-2xl font-bold text-violet-600 dark:text-violet-400 mt-1">
                  {fmtCAD(w.in_payroll_balance)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Retraits en cours
                </p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                  {fmtCAD(w.locked_balance)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" /> Total gagné
                </p>
                <p className="text-2xl font-bold text-foreground mt-1">
                  {fmtCAD(w.total_earned)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick access cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/rh/paie">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-violet-200 dark:border-violet-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4 text-violet-600" />
                Dernière paie
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-foreground">
                {latestPayslip ? fmtCAD(Number(latestPayslip.net_pay)) : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {latestPayslip?.payroll_number || "Aucune fiche"}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/rh/commissions">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                Commissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-foreground">
                {wallet ? fmtCAD(w.available_balance + w.pending_balance) : "Voir détails"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Historique et solde</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/rh/documents-fiscaux">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Documents fiscaux
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-foreground">T4 / RL-1</p>
              <p className="text-xs text-muted-foreground mt-1">Sommaires internes</p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/rh/notifications">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Bell className="h-4 w-4 text-amber-600" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold text-foreground">
                {unreadNotifs ? `${unreadNotifs} non lue${unreadNotifs > 1 ? "s" : ""}` : "Tout lu ✓"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Alertes RH</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
