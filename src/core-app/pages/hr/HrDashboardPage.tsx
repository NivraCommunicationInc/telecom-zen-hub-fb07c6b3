/**
 * HrDashboardPage — HR & Payroll command center.
 * 6 KPIs (real Supabase counts), recent hires, pending commissions, recent leave requests.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Users, Clock, DollarSign, Coins, Inbox, Briefcase,
  ArrowRight, Loader2, UserPlus, Brain,
} from "lucide-react";
import { corePath } from "@/core-app/lib/corePaths";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

const REQUEST_TYPE_LABELS: Record<string, string> = {
  vacation: "Vacances",
  sick_leave: "Congé maladie",
  personal_leave: "Congé personnel",
  part_time: "Temps partiel",
  other: "Autre",
};

const REQUEST_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "default",
  declined: "destructive",
  cancelled: "secondary",
};

export default function HrDashboardPage() {
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["hr-dashboard-stats-v2"],
    queryFn: async () => {
      const monthStart = startOfMonth(new Date()).toISOString();
      const monthEnd = endOfMonth(new Date()).toISOString();

      const [
        activeEmp,
        timeEntries,
        payrollMonth,
        pendingComm,
        pendingReq,
        openJobs,
        activeApps,
      ] = await Promise.all([
        supabase.from("employee_records").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("time_entries").select("total_hours")
          .gte("punch_in", monthStart).lte("punch_in", monthEnd)
          .not("total_hours", "is", null),
        supabase.from("payroll_entries").select("gross_pay")
          .gte("created_at", monthStart).lte("created_at", monthEnd),
        supabase.from("unified_commissions" as any).select("amount,status")
          .in("status", ["pending", "pending_activation", "validated", "payable"]),
        supabase.from("hr_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("jobs").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("job_applications").select("id", { count: "exact", head: true }).not("status", "in", "(hired,rejected)"),
      ]);

      const hoursMonth = (timeEntries.data ?? []).reduce(
        (s: number, e: any) => s + (Number(e.total_hours) || 0),
        0,
      );
      const payrollMass = (payrollMonth.data ?? []).reduce(
        (s: number, e: any) => s + (Number(e.gross_pay) || 0),
        0,
      );
      const pendingCommTotal = (pendingComm.data ?? []).reduce(
        (s: number, c: any) => s + (Number(c.amount) || 0),
        0,
      );

      return {
        active: activeEmp.count ?? 0,
        hoursMonth: Math.round(hoursMonth * 10) / 10,
        payrollMass,
        pendingComm: pendingCommTotal,
        pendingReq: pendingReq.count ?? 0,
        openJobs: openJobs.count ?? 0,
        activeApps: activeApps.count ?? 0,
      };
    },
  });

  const { data: recentHires = [] } = useQuery({
    queryKey: ["hr-dashboard-recent-hires"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_records")
        .select("id, first_name, last_name, job_title, hire_date, status")
        .order("hire_date", { ascending: false, nullsFirst: false })
        .limit(5);
      return data ?? [];
    },
  });

  const { data: topPendingComm = [] } = useQuery({
    queryKey: ["hr-dashboard-top-pending-comm"],
    queryFn: async () => {
      const { data } = await supabase
        .from("unified_commissions" as any)
        .select("employee_id, amount")
        .in("status", ["validated", "payable", "pending"])
        .order("created_at", { ascending: false })
        .limit(200);
      const list = (data as any[]) ?? [];
      const grouped = new Map<string, number>();
      for (const c of list) {
        grouped.set(c.employee_id, (grouped.get(c.employee_id) ?? 0) + Number(c.amount || 0));
      }
      const top = [...grouped.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      if (top.length === 0) return [];
      const ids = top.map(([id]) => id);
      const { data: emps } = await supabase
        .from("employee_records")
        .select("user_id, first_name, last_name, job_title")
        .in("user_id", ids);
      const map = Object.fromEntries((emps ?? []).map((e: any) => [e.user_id, e]));
      return top.map(([id, amount]) => ({ employee_id: id, amount, _emp: map[id] ?? null }));
    },
  });

  const { data: recentRequests = [] } = useQuery({
    queryKey: ["hr-dashboard-recent-requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("hr_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      const list = data ?? [];
      const ids = [...new Set(list.map((r: any) => r.employee_id))];
      if (ids.length === 0) return list;
      const { data: emps } = await supabase
        .from("employee_records")
        .select("user_id, first_name, last_name")
        .in("user_id", ids);
      const map = Object.fromEntries((emps ?? []).map((e: any) => [e.user_id, e]));
      return list.map((r: any) => ({ ...r, _emp: map[r.employee_id] ?? null }));
    },
  });

  const fmt = (n: number) => `${n.toFixed(2)} $`;

  const cards = [
    { label: "Employés actifs", value: stats?.active ?? 0, icon: Users, color: "text-primary", href: "/hr/employees", isMoney: false },
    { label: "Heures ce mois", value: stats?.hoursMonth ?? 0, icon: Clock, color: "text-emerald-600", href: "/hr/time", isMoney: false, suffix: " h" },
    { label: "Masse salariale (mois)", value: stats?.payrollMass ?? 0, icon: DollarSign, color: "text-violet-600", href: "/hr/payroll-runs", isMoney: true },
    { label: "Commissions à payer", value: stats?.pendingComm ?? 0, icon: Coins, color: "text-amber-600", href: "/hr/commissions", isMoney: true },
    { label: "Demandes en attente", value: stats?.pendingReq ?? 0, icon: Inbox, color: "text-orange-600", href: "/hr/requests", isMoney: false },
    { label: "Postes ouverts", value: stats?.openJobs ?? 0, icon: Briefcase, color: "text-blue-600", href: "/hr/careers", isMoney: false },
    { label: "Candidatures", value: stats?.activeApps ?? 0, icon: UserPlus, color: "text-primary", href: "/hr/applications", isMoney: false },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">HR & Payroll</h1>
        <p className="text-sm text-muted-foreground">Centre opérationnel des ressources humaines</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Button asChild className="justify-between h-11">
          <Link to={corePath("/hr/applications")}>Candidatures <UserPlus className="h-4 w-4" /></Link>
        </Button>
        <Button asChild variant="outline" className="justify-between h-11">
          <Link to={corePath("/hr/careers")}>Postes ouverts <Briefcase className="h-4 w-4" /></Link>
        </Button>
        <Button asChild variant="outline" className="justify-between h-11">
          <Link to={corePath("/hr/interviews")}>Entrevues IA <Brain className="h-4 w-4" /></Link>
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {cards.map((card) => (
          <Link key={card.label} to={corePath(card.href)}>
            <Card className="hover:border-primary/40 transition-colors cursor-pointer h-full">
              <CardContent className="pt-3 pb-3 px-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground truncate">{card.label}</p>
                    <p className="text-lg font-bold text-foreground mt-0.5 truncate">
                      {loadingStats ? "…" : (
                        card.isMoney
                          ? fmt(Number(card.value))
                          : `${card.value}${(card as any).suffix ?? ""}`
                      )}
                    </p>
                  </div>
                  <card.icon className={`h-5 w-5 ${card.color} shrink-0 opacity-70`} />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Two columns — recent hires + pending commissions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent hires */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-foreground">Employés récents</CardTitle>
            <Link to={corePath("/hr/employees")} className="text-xs text-primary hover:underline">
              Tout voir →
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentHires.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Aucun employé.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Nom</TableHead>
                    <TableHead className="text-[10px]">Poste</TableHead>
                    <TableHead className="text-[10px]">Embauche</TableHead>
                    <TableHead className="text-[10px]">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentHires.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs font-medium">
                        <Link to={corePath(`/hr/employees/${e.id}`)} className="hover:text-primary">
                          {e.first_name} {e.last_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">{e.job_title || "—"}</TableCell>
                      <TableCell className="text-[10px]">
                        {e.hire_date ? format(new Date(e.hire_date), "d MMM yyyy", { locale: fr }) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={e.status === "active" ? "default" : "outline"} className="text-[10px]">
                          {e.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pending commissions per employee */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-foreground">Commissions en attente</CardTitle>
            <Link to={corePath("/hr/commissions")} className="text-xs text-primary hover:underline">
              Tout voir →
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {topPendingComm.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Aucune commission en attente.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Employé</TableHead>
                    <TableHead className="text-[10px] text-right">Montant</TableHead>
                    <TableHead className="text-[10px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topPendingComm.map((row: any) => (
                    <TableRow key={row.employee_id}>
                      <TableCell className="text-xs font-medium">
                        {row._emp
                          ? `${row._emp.first_name} ${row._emp.last_name}`
                          : row.employee_id.slice(0, 8)}
                        {row._emp?.job_title && (
                          <span className="ml-1 text-[10px] text-muted-foreground">({row._emp.job_title})</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-amber-600 text-right">
                        {fmt(Number(row.amount))}
                      </TableCell>
                      <TableCell className="w-24">
                        <Button asChild size="sm" variant="outline" className="h-6 text-[10px] gap-1">
                          <Link to={corePath("/hr/payroll-runs")}>
                            Traiter <ArrowRight className="h-3 w-3" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent leave requests */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground">Demandes récentes</CardTitle>
          <Link to={corePath("/hr/requests")} className="text-xs text-primary hover:underline">
            Tout voir →
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentRequests.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Aucune demande récente.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Employé</TableHead>
                  <TableHead className="text-[10px]">Type</TableHead>
                  <TableHead className="text-[10px]">Du</TableHead>
                  <TableHead className="text-[10px]">Au</TableHead>
                  <TableHead className="text-[10px]">Statut</TableHead>
                  <TableHead className="text-[10px]">Demandé le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRequests.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-medium">
                      {r._emp ? `${r._emp.first_name} ${r._emp.last_name}` : r.employee_id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-xs">{REQUEST_TYPE_LABELS[r.request_type] ?? r.request_type}</TableCell>
                    <TableCell className="text-[10px]">
                      {format(new Date(r.start_date), "d MMM yyyy", { locale: fr })}
                    </TableCell>
                    <TableCell className="text-[10px]">
                      {r.end_date ? format(new Date(r.end_date), "d MMM yyyy", { locale: fr }) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={REQUEST_STATUS_VARIANT[r.status] ?? "secondary"} className="text-[10px]">
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[10px]">
                      {format(new Date(r.created_at), "d MMM yyyy", { locale: fr })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
