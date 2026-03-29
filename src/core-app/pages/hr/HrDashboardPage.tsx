/**
 * HrDashboardPage — HR & Payroll admin dashboard with key HR metrics.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users, UserPlus, Clock, FileText, DollarSign, AlertTriangle,
  Briefcase, CheckCircle2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { corePath } from "@/core-app/lib/corePaths";

export default function HrDashboardPage() {
  const { data: stats } = useQuery({
    queryKey: ["hr-dashboard-stats"],
    queryFn: async () => {
      const [employees, pending, active, onLeave] = await Promise.all([
        supabase.from("employee_records").select("id", { count: "exact", head: true }),
        supabase.from("employee_records").select("id", { count: "exact", head: true }).eq("status", "pending_invitation"),
        supabase.from("employee_records").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("employee_records").select("id", { count: "exact", head: true }).eq("status", "on_leave"),
      ]);
      return {
        total: employees.count ?? 0,
        pending: pending.count ?? 0,
        active: active.count ?? 0,
        onLeave: onLeave.count ?? 0,
      };
    },
  });

  const cards = [
    { label: "Employés total", value: stats?.total ?? 0, icon: Users, color: "text-primary", href: "/hr/employees" },
    { label: "Actifs", value: stats?.active ?? 0, icon: CheckCircle2, color: "text-emerald-500", href: "/hr/employees" },
    { label: "En attente", value: stats?.pending ?? 0, icon: UserPlus, color: "text-amber-500", href: "/hr/onboarding" },
    { label: "En congé", value: stats?.onLeave ?? 0, icon: AlertTriangle, color: "text-orange-500", href: "/hr/employees" },
  ];

  const quickLinks = [
    { label: "Employés", icon: Users, href: "/hr/employees" },
    { label: "Onboarding", icon: UserPlus, href: "/hr/onboarding" },
    { label: "Paie", icon: DollarSign, href: "/hr/payroll" },
    { label: "Commissions", icon: Briefcase, href: "/hr/commissions" },
    { label: "Temps & Punch", icon: Clock, href: "/hr/time" },
    { label: "Documents RH", icon: FileText, href: "/hr/documents" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">HR & Payroll</h1>
        <p className="text-sm text-muted-foreground">Centre de gestion des ressources humaines</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Link key={card.label} to={corePath(card.href)}>
            <Card className="hover:border-primary/30 transition-colors cursor-pointer">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{card.value}</p>
                  </div>
                  <card.icon className={`h-8 w-8 ${card.color} opacity-60`} />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick access */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Accès rapide
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {quickLinks.map((link) => (
              <Link
                key={link.label}
                to={corePath(link.href)}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors"
              >
                <link.icon className="h-6 w-6 text-primary" />
                <span className="text-xs font-medium text-foreground">{link.label}</span>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
