/**
 * HrEmployeesPage — Canonical employee list from employee_records.
 * Single source of truth for HR employee management.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Search, Plus, FolderOpen, Users, Filter, Mail, Loader2,
} from "lucide-react";
import { corePath } from "@/core-app/lib/corePaths";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase as sb } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { enqueueCommunication } from "@/lib/enqueueCommunication";
const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending_invitation: { label: "Invitation en attente", variant: "outline" },
  onboarding: { label: "Onboarding", variant: "secondary" },
  active: { label: "Actif", variant: "default" },
  on_leave: { label: "En congé", variant: "secondary" },
  suspended: { label: "Suspendu", variant: "destructive" },
  terminated: { label: "Terminé", variant: "destructive" },
};

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "Temps plein",
  part_time: "Temps partiel",
  contract: "Contractuel",
  seasonal: "Saisonnier",
  intern: "Stagiaire",
};

export default function HrEmployeesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [resendingId, setResendingId] = useState<string | null>(null);

  const handleResend = async (e: React.MouseEvent, empId: string, email: string | null) => {
    e.stopPropagation();
    if (!email) {
      toast.error("Aucun email pour cet employé");
      return;
    }
    setResendingId(empId);
    try {
      let error: any = null;
      try { await enqueueCommunication({
        channel: "email",
        templateKey: "employee_invite",
        recipient: email,
        idempotencyKey: `employee-invite-resend:${empId}`,
        templateVars: { employee_id: empId, invite_link: `https://app.nivra-telecom.ca/employee-onboarding/${empId}` },
        priority: 1,
        entityType: "employee",
        entityId: empId,
      }); } catch (__e) { error = __e; }
      if (error) throw error;
      toast.success(`Invitation envoyée à ${email}`);
    } catch (err: any) {
      toast.error(`Erreur lors de l'envoi: ${err.message ?? "inconnue"}`);
    } finally {
      setResendingId(null);
    }
  };

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["hr-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_records")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Extract unique departments
  const departments = useMemo(() => {
    const depts = new Set(employees.map((e) => e.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [employees]);

  // Filtered list
  const filtered = useMemo(() => {
    let list = employees;
    if (statusFilter !== "all") list = list.filter((e) => e.status === statusFilter);
    if (deptFilter !== "all") list = list.filter((e) => e.department === deptFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) =>
        `${e.first_name} ${e.last_name}`.toLowerCase().includes(q) ||
        e.employee_number?.toLowerCase().includes(q) ||
        e.work_email?.toLowerCase().includes(q) ||
        e.job_title?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [employees, statusFilter, deptFilter, search]);

  // Stats
  const activeCount = employees.filter((e) => e.status === "active").length;
  const pendingCount = employees.filter((e) => e.status === "pending_invitation" || e.status === "onboarding").length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Employés
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {employees.length} employé(s) · {activeCount} actif(s) · {pendingCount} en attente
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => navigate(corePath("/hr/employees/new"))}>
          <Plus className="h-3.5 w-3.5" />
          Nouvel employé
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, numéro, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <Filter className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {Object.entries(STATUS_MAP).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Département" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les départements</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d!}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Employee table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Numéro</TableHead>
                <TableHead className="text-xs">Nom</TableHead>
                <TableHead className="text-xs">Poste</TableHead>
                <TableHead className="text-xs">Département</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Statut</TableHead>
                <TableHead className="text-xs">Date d'embauche</TableHead>
                <TableHead className="text-xs w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-xs">
                    Chargement…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-xs">
                    Aucun employé trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((emp) => {
                  const statusCfg = STATUS_MAP[emp.status] ?? { label: emp.status, variant: "outline" as const };
                  return (
                    <TableRow
                      key={emp.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(corePath(`/hr/employees/${emp.id}`))}
                    >
                      <TableCell className="text-xs font-mono text-primary">
                        {emp.employee_number}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {emp.first_name} {emp.last_name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {emp.job_title || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {emp.department || "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {EMPLOYMENT_TYPE_LABELS[emp.employment_type] ?? emp.employment_type}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusCfg.variant} className="text-[10px]">
                          {statusCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {emp.hire_date
                          ? format(new Date(emp.hire_date), "d MMM yyyy", { locale: fr })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {emp.status !== "active" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              title="Renvoyer l'invitation"
                              disabled={resendingId === emp.id}
                              onClick={(e) => handleResend(e, emp.id, emp.work_email)}
                            >
                              {resendingId === emp.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Mail className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(corePath(`/hr/employees/${emp.id}`));
                            }}
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
