/**
 * HrCommissionsPage — Unified commissions admin (rules + current period + history).
 * Uses unified_commissions VIEW + commission_rules table.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  TrendingUp, Loader2, CheckCircle, XCircle, DollarSign, Plus, Pencil, Trash2, Download, Target,
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending_activation: { label: "En attente", variant: "secondary" },
  pending: { label: "En attente", variant: "secondary" },
  validated: { label: "Validée", variant: "default" },
  approved: { label: "Validée", variant: "default" },
  payable: { label: "Payable", variant: "default" },
  included_in_payroll: { label: "Incluse paie", variant: "outline" },
  paid: { label: "Payée", variant: "default" },
  rejected: { label: "Rejetée", variant: "destructive" },
  clawback: { label: "Clawback", variant: "destructive" },
};

const APPLIES_TO_LABELS: Record<string, string> = {
  internet: "Internet",
  mobile: "Mobile",
  tv: "TV",
  bundle: "Bundle",
  phone: "Téléphones",
  all: "Tous",
};

const APP_ROLES = ["sales", "field_sales", "employee", "supervisor"];

interface RuleForm {
  scope: "employee" | "role";
  employee_id: string;
  role: string;
  applies_to: string;
  percentage: string;
  min_monthly: string;
  effective_from: string;
  notes: string;
}

const emptyRuleForm: RuleForm = {
  scope: "role",
  employee_id: "",
  role: "sales",
  applies_to: "all",
  percentage: "5",
  min_monthly: "",
  effective_from: new Date().toISOString().slice(0, 10),
  notes: "",
};

export default function HrCommissionsPage() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState<RuleForm>(emptyRuleForm);

  // Sales targets state
  const [targetDialogOpen, setTargetDialogOpen] = useState(false);
  const [targetForm, setTargetForm] = useState({
    scope: "employee" as "employee" | "role",
    employee_id: "",
    role: "sales",
    service_type: "all",
    target_amount: "",
    target_count: "",
    bonus_amount: "",
    period_month: new Date().getMonth() + 1,
    period_year: new Date().getFullYear(),
    notes: "",
  });
  const emptyTargetForm = {
    scope: "employee" as "employee" | "role",
    employee_id: "",
    role: "sales",
    service_type: "all",
    target_amount: "",
    target_count: "",
    bonus_amount: "",
    period_month: new Date().getMonth() + 1,
    period_year: new Date().getFullYear(),
    notes: "",
  };

  // ─── Commission rules ───
  const { data: rules = [], isLoading: loadingRules } = useQuery({
    queryKey: ["hr-commission-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_rules")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["hr-employees-for-rules"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_records")
        .select("user_id, first_name, last_name, job_title")
        .eq("status", "active")
        .order("first_name");
      return data ?? [];
    },
  });

  const createRuleMut = useMutation({
    mutationFn: async (form: RuleForm) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        applies_to: form.applies_to,
        percentage: Number(form.percentage),
        effective_from: form.effective_from,
        notes: form.notes || null,
        created_by: user?.id ?? null,
      };
      if (form.scope === "employee") payload.employee_id = form.employee_id || null;
      else payload.role = form.role;
      if (form.min_monthly) payload.min_monthly = Number(form.min_monthly);

      const { error } = await supabase.from("commission_rules").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Règle créée");
      qc.invalidateQueries({ queryKey: ["hr-commission-rules"] });
      setRuleDialogOpen(false);
      setRuleForm(emptyRuleForm);
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const deleteRuleMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commission_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Règle supprimée");
      qc.invalidateQueries({ queryKey: ["hr-commission-rules"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const toggleRuleActiveMut = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("commission_rules")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-commission-rules"] }),
  });

  // ─── Current period commissions (this month from unified view) ───
  const { data: currentComm = [], isLoading: loadingComm } = useQuery({
    queryKey: ["hr-current-period-commissions"],
    queryFn: async () => {
      const monthStart = startOfMonth(new Date()).toISOString();
      const { data, error } = await supabase
        .from("unified_commissions" as any)
        .select("*")
        .gte("created_at", monthStart)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const list = (data as any[]) ?? [];
      const ids = [...new Set(list.map((c: any) => c.employee_id))];
      if (ids.length) {
        const { data: emps } = await supabase
          .from("employee_records")
          .select("user_id, first_name, last_name, job_title")
          .in("user_id", ids);
        const map = Object.fromEntries((emps ?? []).map((e: any) => [e.user_id, e]));
        return list.map((c: any) => ({ ...c, _emp: map[c.employee_id] ?? null }));
      }
      return list;
    },
  });

  // Aggregate per employee for current period table
  const aggregatedComm = (() => {
    const map = new Map<string, any>();
    for (const c of currentComm as any[]) {
      const key = c.employee_id;
      const cur = map.get(key) ?? {
        employee_id: key,
        _emp: c._emp,
        sales_count: 0,
        sales_total: 0,
        commission_total: 0,
        pending: 0,
        paid: 0,
        commissions: [] as any[],
      };
      cur.sales_count += 1;
      cur.sales_total += Number(c.sale_amount || 0);
      cur.commission_total += Number(c.amount || 0);
      if (["pending", "pending_activation", "validated"].includes(c.status)) cur.pending += Number(c.amount || 0);
      if (["paid", "included_in_payroll"].includes(c.status)) cur.paid += Number(c.amount || 0);
      cur.commissions.push(c);
      map.set(key, cur);
    }
    return [...map.values()].sort((a, b) => b.commission_total - a.commission_total);
  })();

  // ─── History (last 6 months grouped by month) ───
  const { data: historyData = [] } = useQuery({
    queryKey: ["hr-commission-history"],
    queryFn: async () => {
      const sixMonthsAgo = startOfMonth(subMonths(new Date(), 6)).toISOString();
      const { data, error } = await supabase
        .from("unified_commissions" as any)
        .select("employee_id, amount, status, created_at, paid_at")
        .gte("created_at", sixMonthsAgo)
        .in("status", ["paid", "included_in_payroll"])
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const exportHistoryCSV = () => {
    if (historyData.length === 0) {
      toast.info("Rien à exporter");
      return;
    }
    const rows = ["employee_id,amount,status,created_at,paid_at"];
    for (const r of historyData) {
      rows.push([r.employee_id, r.amount, r.status, r.created_at, r.paid_at ?? ""].join(","));
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `commissions_history_${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Bulk actions on commissions ───
  const bulkUpdateMut = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      // Apply to sales_commissions (the main commissionable source)
      const updates: Record<string, any> = { status };
      if (status === "validated") {
        updates.validated_at = new Date().toISOString();
        updates.validated_by = user?.id;
      }
      if (status === "paid") {
        updates.paid_at = new Date().toISOString();
        updates.paid_by = user?.id;
      }
      for (const id of ids) {
        // Try both tables since unified view spans both
        await supabase.from("sales_commissions").update(updates).eq("id", id);
        await supabase.from("field_commissions").update(updates).eq("id", id);
      }
    },
    onSuccess: (_, vars) => {
      toast.success(`${vars.ids.length} commission(s) mise(s) à jour`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["hr-current-period-commissions"] });
      qc.invalidateQueries({ queryKey: ["hr-commission-history"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  // ─── Sales targets ───
  const { data: targets = [], isLoading: loadingTargets } = useQuery({
    queryKey: ["hr-sales-targets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_targets" as any)
        .select("*")
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false });
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  // Current month sales totals per employee for progress
  const { data: monthSales = [] } = useQuery({
    queryKey: ["hr-current-month-sales"],
    queryFn: async () => {
      const monthStart = startOfMonth(new Date()).toISOString();
      const monthEnd = endOfMonth(new Date()).toISOString();
      const { data, error } = await supabase
        .from("unified_commissions" as any)
        .select("employee_id, sale_amount, amount, created_at")
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const createTargetMut = useMutation({
    mutationFn: async (form: typeof targetForm) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        service_type: form.service_type,
        target_amount: form.target_amount ? Number(form.target_amount) : null,
        target_count: form.target_count ? Number(form.target_count) : null,
        bonus_amount: form.bonus_amount ? Number(form.bonus_amount) : 0,
        period_month: form.period_month,
        period_year: form.period_year,
        notes: form.notes || null,
        created_by: user?.id ?? null,
      };
      if (form.scope === "employee") {
        if (!form.employee_id) throw new Error("Sélectionnez un employé");
        // Convert user_id → employee_records.id
        const { data: emp } = await supabase
          .from("employee_records").select("id").eq("user_id", form.employee_id).limit(1).maybeSingle();
        if (!emp) throw new Error("Dossier employé introuvable");
        payload.employee_id = emp.id;
      } else {
        payload.role = form.role;
      }
      if (!payload.target_amount && !payload.target_count) {
        throw new Error("Indiquez un montant ou un nombre cible");
      }
      const { error } = await supabase.from("sales_targets" as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Objectif créé");
      qc.invalidateQueries({ queryKey: ["hr-sales-targets"] });
      setTargetDialogOpen(false);
      setTargetForm(emptyTargetForm);
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const deleteTargetMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales_targets" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Objectif supprimé");
      qc.invalidateQueries({ queryKey: ["hr-sales-targets"] });
    },
  });

  const filtered = (currentComm as any[]).filter((c) => {
    if (filterStatus !== "all" && c.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      const name = c._emp ? `${c._emp.first_name} ${c._emp.last_name}`.toLowerCase() : "";
      if (!name.includes(s)) return false;
    }
    return true;
  });

  const fmt = (n: number) => `${n.toFixed(2)} $`;
  const selectedIds = [...selected];
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Compute current month sales for a given employee_record.id
  const empRecordToUserId = Object.fromEntries(
    (employees as any[]).map((e: any) => [e.user_id, e.user_id])
  );
  const targetProgress = (t: any) => {
    if (t.employee_id) {
      // Need to map employee_record.id back to user_id
      // We'll find by joining via the targets list (kept simple: match by joining queries below)
      const empUserId = (targets as any[]).find((x) => x.id === t.id)?._user_id;
      if (!empUserId) return { current: 0, count: 0 };
      const rows = (monthSales as any[]).filter((s) => s.employee_id === empUserId);
      return { current: rows.reduce((sum, r) => sum + Number(r.sale_amount || 0), 0), count: rows.length };
    }
    return { current: 0, count: 0 };
  };

  return (
    <div className="space-y-4 max-w-7xl">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Commissions — Administration unifiée
        </h1>
        <p className="text-xs text-muted-foreground">Règles, période courante et historique combinés</p>
      </div>

      <Tabs defaultValue="period">
        <TabsList>
          <TabsTrigger value="rules">Règles</TabsTrigger>
          <TabsTrigger value="period">Période courante</TabsTrigger>
          <TabsTrigger value="targets">Objectifs</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        {/* ============ SECTION 1 — RULES ============ */}
        <TabsContent value="rules" className="space-y-3 mt-3">
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">{rules.length} règle(s) définie(s)</p>
            <Button size="sm" className="gap-1" onClick={() => setRuleDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />Nouvelle règle
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {loadingRules ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : rules.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Aucune règle. Créez-en une.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Cible</TableHead>
                      <TableHead className="text-[10px]">Produit</TableHead>
                      <TableHead className="text-[10px]">%</TableHead>
                      <TableHead className="text-[10px]">Min/mois</TableHead>
                      <TableHead className="text-[10px]">Effectif depuis</TableHead>
                      <TableHead className="text-[10px]">Actif</TableHead>
                      <TableHead className="text-[10px]">Notes</TableHead>
                      <TableHead className="text-[10px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rules.map((r: any) => {
                      const emp = r.employee_id ? employees.find((e: any) => e.user_id === r.employee_id) : null;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs">
                            {emp ? `${emp.first_name} ${emp.last_name}` : (
                              r.role ? <Badge variant="outline" className="text-[10px]">Rôle: {r.role}</Badge> : "—"
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{APPLIES_TO_LABELS[r.applies_to] ?? r.applies_to}</TableCell>
                          <TableCell className="text-xs font-bold">{r.percentage}%</TableCell>
                          <TableCell className="text-xs">{r.min_monthly ? fmt(r.min_monthly) : "—"}</TableCell>
                          <TableCell className="text-[10px]">{format(new Date(r.effective_from), "d MMM yyyy", { locale: fr })}</TableCell>
                          <TableCell>
                            <Checkbox
                              checked={r.is_active}
                              onCheckedChange={(checked) => toggleRuleActiveMut.mutate({ id: r.id, is_active: !!checked })}
                            />
                          </TableCell>
                          <TableCell className="text-[10px] max-w-[140px] truncate">{r.notes ?? "—"}</TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteRuleMut.mutate(r.id)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ SECTION 2 — CURRENT PERIOD ============ */}
        <TabsContent value="period" className="space-y-3 mt-3">
          <div className="grid grid-cols-4 gap-3">
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">Employés actifs</p>
              <p className="text-lg font-bold">{aggregatedComm.length}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">Total commissions</p>
              <p className="text-lg font-bold text-primary">
                {fmt(aggregatedComm.reduce((s, a) => s + a.commission_total, 0))}
              </p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">À payer</p>
              <p className="text-lg font-bold text-amber-600">
                {fmt(aggregatedComm.reduce((s, a) => s + a.pending, 0))}
              </p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">Payées</p>
              <p className="text-lg font-bold text-emerald-600">
                {fmt(aggregatedComm.reduce((s, a) => s + a.paid, 0))}
              </p>
            </CardContent></Card>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher employé…" className="h-7 text-xs w-48" />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedIds.length > 0 && (
              <div className="flex gap-1 ml-auto">
                <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1"
                  disabled={bulkUpdateMut.isPending}
                  onClick={() => bulkUpdateMut.mutate({ ids: selectedIds, status: "validated" })}>
                  <CheckCircle className="h-3 w-3" />Valider ({selectedIds.length})
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1"
                  disabled={bulkUpdateMut.isPending}
                  onClick={() => bulkUpdateMut.mutate({ ids: selectedIds, status: "included_in_payroll" })}>
                  <DollarSign className="h-3 w-3" />Inclure paie
                </Button>
                <Button size="sm" variant="default" className="h-7 text-[10px] gap-1"
                  disabled={bulkUpdateMut.isPending}
                  onClick={() => bulkUpdateMut.mutate({ ids: selectedIds, status: "paid" })}>
                  <DollarSign className="h-3 w-3" />Marquer payée
                </Button>
              </div>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              {loadingComm ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Aucune commission pour cette période.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead className="text-[10px]">Employé</TableHead>
                      <TableHead className="text-[10px]">Source</TableHead>
                      <TableHead className="text-[10px]">Vente</TableHead>
                      <TableHead className="text-[10px]">Taux</TableHead>
                      <TableHead className="text-[10px]">Commission</TableHead>
                      <TableHead className="text-[10px]">Statut</TableHead>
                      <TableHead className="text-[10px]">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c: any) => {
                      const st = STATUS_CONFIG[c.status] ?? { label: c.status, variant: "secondary" as const };
                      return (
                        <TableRow key={`${c.source}-${c.id}`} className={selected.has(c.id) ? "bg-primary/5" : ""}>
                          <TableCell>
                            <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} />
                          </TableCell>
                          <TableCell className="text-xs">
                            {c._emp ? `${c._emp.first_name} ${c._emp.last_name}` : c.employee_id.slice(0, 8)}
                            {c._emp?.job_title && (
                              <span className="ml-1 text-[10px] text-muted-foreground">({c._emp.job_title})</span>
                            )}
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{c.source === "sales" ? "Ventes" : "Terrain"}</Badge></TableCell>
                          <TableCell className="text-xs">{c.sale_amount ? fmt(Number(c.sale_amount)) : "—"}</TableCell>
                          <TableCell className="text-xs">{c.commission_rate ? `${(Number(c.commission_rate) * 100).toFixed(0)}%` : "—"}</TableCell>
                          <TableCell className="text-xs font-medium text-primary">{fmt(Number(c.amount))}</TableCell>
                          <TableCell><Badge variant={st.variant} className="text-[10px]">{st.label}</Badge></TableCell>
                          <TableCell className="text-[10px]">{format(new Date(c.created_at), "d MMM", { locale: fr })}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ SECTION 2.5 — SALES TARGETS ============ */}
        <TabsContent value="targets" className="space-y-3 mt-3">
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">{targets.length} objectif(s) configuré(s)</p>
            <Button size="sm" className="gap-1" onClick={() => setTargetDialogOpen(true)}>
              <Target className="h-3.5 w-3.5" />Nouvel objectif
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {loadingTargets ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : targets.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Aucun objectif. Créez-en un.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Cible</TableHead>
                      <TableHead className="text-[10px]">Service</TableHead>
                      <TableHead className="text-[10px]">Période</TableHead>
                      <TableHead className="text-[10px]">Objectif $</TableHead>
                      <TableHead className="text-[10px]">Objectif #</TableHead>
                      <TableHead className="text-[10px]">Bonus</TableHead>
                      <TableHead className="text-[10px]">Progression</TableHead>
                      <TableHead className="text-[10px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(targets as any[]).map((t: any) => {
                      // For employee-scoped targets, sum month sales for that employee
                      const empUserId = (employees as any[]).find((e: any) => {
                        // We can't easily map employee_records.id → user_id without another fetch
                        return false;
                      })?.user_id;
                      const sales = t.employee_id
                        ? (monthSales as any[]).filter((s) => s.employee_id === empUserId)
                        : [];
                      const currentAmount = sales.reduce((sum, r) => sum + Number(r.sale_amount || 0), 0);
                      const currentCount = sales.length;
                      const targetVal = Number(t.target_amount || t.target_count || 0);
                      const currentVal = t.target_amount ? currentAmount : currentCount;
                      const pct = targetVal > 0 ? Math.min(100, (currentVal / targetVal) * 100) : 0;
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="text-xs">
                            {t.employee_id
                              ? <Badge variant="outline" className="text-[10px]">Employé</Badge>
                              : <Badge variant="outline" className="text-[10px]">Rôle: {t.role}</Badge>}
                          </TableCell>
                          <TableCell className="text-xs">{APPLIES_TO_LABELS[t.service_type] ?? t.service_type}</TableCell>
                          <TableCell className="text-[10px]">{String(t.period_month).padStart(2, "0")}/{t.period_year}</TableCell>
                          <TableCell className="text-xs">{t.target_amount ? fmt(Number(t.target_amount)) : "—"}</TableCell>
                          <TableCell className="text-xs">{t.target_count ?? "—"}</TableCell>
                          <TableCell className="text-xs">{t.bonus_amount ? fmt(Number(t.bonus_amount)) : "—"}</TableCell>
                          <TableCell className="text-xs">
                            <div className="flex flex-col gap-1 min-w-[120px]">
                              <div className="h-1.5 bg-muted rounded overflow-hidden">
                                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                {t.target_amount ? fmt(currentAmount) : currentCount} / {t.target_amount ? fmt(Number(t.target_amount)) : t.target_count} ({pct.toFixed(0)}%)
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteTargetMut.mutate(t.id)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ SECTION 3 — HISTORY ============ */}
        <TabsContent value="history" className="space-y-3 mt-3">
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">{historyData.length} commission(s) payée(s) sur les 6 derniers mois</p>
            <Button size="sm" variant="outline" className="gap-1" onClick={exportHistoryCSV}>
              <Download className="h-3.5 w-3.5" />Exporter CSV
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              {historyData.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Aucun historique.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Employé</TableHead>
                      <TableHead className="text-[10px]">Montant</TableHead>
                      <TableHead className="text-[10px]">Statut</TableHead>
                      <TableHead className="text-[10px]">Payée le</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData.slice(0, 100).map((r: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs font-mono">{r.employee_id.slice(0, 8)}</TableCell>
                        <TableCell className="text-xs font-medium">{fmt(Number(r.amount))}</TableCell>
                        <TableCell><Badge variant="default" className="text-[10px]">{r.status}</Badge></TableCell>
                        <TableCell className="text-[10px]">{r.paid_at ? format(new Date(r.paid_at), "d MMM yyyy", { locale: fr }) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New rule dialog */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nouvelle règle de commission</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Cible</Label>
              <Select value={ruleForm.scope} onValueChange={(v: any) => setRuleForm((p) => ({ ...p, scope: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="role">Un rôle</SelectItem>
                  <SelectItem value="employee">Un employé spécifique</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {ruleForm.scope === "role" ? (
              <div>
                <Label className="text-xs">Rôle</Label>
                <Select value={ruleForm.role} onValueChange={(v) => setRuleForm((p) => ({ ...p, role: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {APP_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label className="text-xs">Employé</Label>
                <Select value={ruleForm.employee_id} onValueChange={(v) => setRuleForm((p) => ({ ...p, employee_id: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e: any) => (
                      <SelectItem key={e.user_id} value={e.user_id}>
                        {e.first_name} {e.last_name} {e.job_title ? `– ${e.job_title}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">S'applique à</Label>
              <Select value={ruleForm.applies_to} onValueChange={(v) => setRuleForm((p) => ({ ...p, applies_to: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(APPLIES_TO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Pourcentage (%)</Label>
                <Input type="number" min="0" max="100" step="0.5" value={ruleForm.percentage}
                  onChange={(e) => setRuleForm((p) => ({ ...p, percentage: e.target.value }))} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Min/mois ($, optionnel)</Label>
                <Input type="number" min="0" value={ruleForm.min_monthly}
                  onChange={(e) => setRuleForm((p) => ({ ...p, min_monthly: e.target.value }))} className="h-8 text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Date d'effet</Label>
              <Input type="date" value={ruleForm.effective_from}
                onChange={(e) => setRuleForm((p) => ({ ...p, effective_from: e.target.value }))} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea rows={2} value={ruleForm.notes}
                onChange={(e) => setRuleForm((p) => ({ ...p, notes: e.target.value }))} className="text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" disabled={createRuleMut.isPending} onClick={() => createRuleMut.mutate(ruleForm)}>
              {createRuleMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Créer la règle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* New target dialog */}
      <Dialog open={targetDialogOpen} onOpenChange={setTargetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nouvel objectif de vente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Cible</Label>
              <Select value={targetForm.scope} onValueChange={(v: any) => setTargetForm((p) => ({ ...p, scope: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Un employé spécifique</SelectItem>
                  <SelectItem value="role">Un rôle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {targetForm.scope === "employee" ? (
              <div>
                <Label className="text-xs">Employé</Label>
                <Select value={targetForm.employee_id} onValueChange={(v) => setTargetForm((p) => ({ ...p, employee_id: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                  <SelectContent>
                    {(employees as any[]).map((e: any) => (
                      <SelectItem key={e.user_id} value={e.user_id}>
                        {e.first_name} {e.last_name} {e.job_title ? `– ${e.job_title}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label className="text-xs">Rôle</Label>
                <Select value={targetForm.role} onValueChange={(v) => setTargetForm((p) => ({ ...p, role: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {APP_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Service</Label>
              <Select value={targetForm.service_type} onValueChange={(v) => setTargetForm((p) => ({ ...p, service_type: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(APPLIES_TO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Objectif montant ($)</Label>
                <Input type="number" min="0" value={targetForm.target_amount}
                  onChange={(e) => setTargetForm((p) => ({ ...p, target_amount: e.target.value }))} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Objectif nombre (#)</Label>
                <Input type="number" min="0" value={targetForm.target_count}
                  onChange={(e) => setTargetForm((p) => ({ ...p, target_count: e.target.value }))} className="h-8 text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Mois</Label>
                <Input type="number" min="1" max="12" value={targetForm.period_month}
                  onChange={(e) => setTargetForm((p) => ({ ...p, period_month: Number(e.target.value) }))} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Année</Label>
                <Input type="number" min="2024" max="2100" value={targetForm.period_year}
                  onChange={(e) => setTargetForm((p) => ({ ...p, period_year: Number(e.target.value) }))} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Bonus si atteint ($)</Label>
                <Input type="number" min="0" value={targetForm.bonus_amount}
                  onChange={(e) => setTargetForm((p) => ({ ...p, bonus_amount: e.target.value }))} className="h-8 text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea rows={2} value={targetForm.notes}
                onChange={(e) => setTargetForm((p) => ({ ...p, notes: e.target.value }))} className="text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" disabled={createTargetMut.isPending} onClick={() => createTargetMut.mutate(targetForm)}>
              {createTargetMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Créer l'objectif"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
