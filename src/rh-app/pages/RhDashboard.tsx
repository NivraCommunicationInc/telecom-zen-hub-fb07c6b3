/**
 * RhDashboard — Employee RH home page.
 * Shows summary cards: latest payslip, pending documents, upcoming schedule.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt, FileText, Clock, DollarSign, Bell } from "lucide-react";
import { Link } from "react-router-dom";

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
        .eq("read", false);
      return count ?? 0;
    },
    enabled: !!user?.id,
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n || 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Bonjour{profile?.first_name ? `, ${profile.first_name}` : ""} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {profile?.job_title || "Votre espace ressources humaines"}
        </p>
      </div>

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
                {latestPayslip ? fmt(Number(latestPayslip.net_pay)) : "—"}
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
              <p className="text-xl font-bold text-foreground">Voir détails</p>
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
