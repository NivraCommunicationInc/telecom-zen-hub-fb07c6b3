/**
 * HrPayrollPage2 — Complete professional payroll system (Bell/Telus grade).
 *
 * - Header with current period + payroll actions (preview, process, history).
 * - Tabs by role group (Tous, Field Sales, Employés, Techniciens, Admin, RH).
 * - Per-employee cards: earnings (commissions OR hours OR both), bonus,
 *   adjustments, computed deductions, NET À PAYER, payment method.
 * - Bottom run summary totals.
 * - History modal with past payroll_runs and their entries.
 * - Employee settings drawer (pay_type, hourly_rate, BPA, payment method).
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Calendar, DollarSign, Download, History, Loader2, Play, Plus, Settings, Trash2, Users,
} from "lucide-react";
import { toast } from "sonner";

// ─────────────── Helpers ───────────────
const fmtMoney = (n: number | string | null | undefined) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 2 }).format(Number(n) || 0);
const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};
const shortDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" }) : "—";

function getLastThursday(now = new Date()): Date {
  const d = new Date(now);
  for (let i = 0; i < 8; i++) {
    const test = new Date(d);
    test.setUTCDate(d.getUTCDate() - i);
    test.setUTCHours(23, 0, 0, 0);
    if (test.getUTCDay() === 4 && test.getTime() <= now.getTime()) return test;
  }
  return d;
}
function lastFridayOfMonth(refDate: Date): Date {
  const y = refDate.getUTCFullYear();
  const m = refDate.getUTCMonth();
  const last = new Date(Date.UTC(y, m + 1, 0));
  const offset = (last.getUTCDay() - 5 + 7) % 7;
  last.setUTCDate(last.getUTCDate() - offset);
  return last;
}

const ROLE_GROUPS = [
  { key: "all", label: "Tous", roles: ["field_sales", "employee", "technician", "admin", "hr"] },
  { key: "field_sales", label: "Field Sales", roles: ["field_sales"] },
  { key: "employee", label: "Employés", roles: ["employee"] },
  { key: "technician", label: "Techniciens", roles: ["technician"] },
  { key: "admin", label: "Admin", roles: ["admin"] },
  { key: "hr", label: "RH", roles: ["hr"] },
] as const;

const PAY_TYPE_BADGES: Record<string, { label: string; cls: string }> = {
  commission: { label: "Commission", cls: "bg-purple-100 text-purple-800 border-purple-200" },
  hourly: { label: "Horaire", cls: "bg-blue-100 text-blue-800 border-blue-200" },
  hourly_commission: { label: "Horaire + Commission", cls: "bg-green-100 text-green-800 border-green-200" },
};

const ROLE_BADGE_CLS: Record<string, string> = {
  field_sales: "bg-purple-50 text-purple-700",
  employee: "bg-blue-50 text-blue-700",
  technician: "bg-amber-50 text-amber-700",
  admin: "bg-red-50 text-red-700",
  hr: "bg-emerald-50 text-emerald-700",
};

const ADJUSTMENT_TYPES = [
  { value: "allocation", label: "Allocation" },
  { value: "bonus", label: "Bonus" },
  { value: "advance", label: "Avance" },
  { value: "deduction", label: "Déduction" },
  { value: "reimbursement", label: "Remboursement" },
  { value: "other", label: "Autre" },
];

const ADJUSTMENT_PRESETS = [
  { type: "allocation", description: "Kilométrage", amount: 0, taxable: false },
  { type: "allocation", description: "Repas", amount: 0, taxable: false },
  { type: "allocation", description: "Équipement / téléphone", amount: 0, taxable: false },
  { type: "bonus", description: "Bonus de performance", amount: 0, taxable: true },
  { type: "bonus", description: "Prime de signature", amount: 0, taxable: true },
  { type: "reimbursement", description: "Remboursement frais", amount: 0, taxable: false },
  { type: "advance", description: "Avance sur salaire", amount: 0, taxable: true },
  { type: "deduction", description: "Retenue / correction", amount: 0, taxable: true },
  { type: "other", description: "Vacances / congé férié payé", amount: 0, taxable: true },
];

// ─────────────── Page ───────────────
export default function HrPayrollPage2() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<string>("all");
  const [preview, setPreview] = useState<any | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [drillIn, setDrillIn] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeRow | null>(null);
  const [adjustmentFor, setAdjustmentFor] = useState<EmployeeRow | null>(null);
  // Per-employee live overrides (real-time recompute before saving / running)
  const [excludedComm, setExcludedComm] = useState<Set<string>>(new Set());
  const [localHours, setLocalHours] = useState<Map<string, { h: number; ot: number }>>(new Map());
  // Employee multi-select for payroll processing
  const [selectedEmps, setSelectedEmps] = useState<Set<string>>(new Set());
  const [previewingStub, setPreviewingStub] = useState<string | null>(null);
  function toggleExcludedComm(id: string) {
    setExcludedComm((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleSelectedEmp(id: string) {
    setSelectedEmps((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function setLocalHoursFor(empId: string, h: number, ot: number) {
    setLocalHours((prev) => { const n = new Map(prev); n.set(empId, { h, ot }); return n; });
  }

  // Period boundaries
  const now = new Date();
  const cutoff = useMemo(() => getLastThursday(now), [now.toDateString()]);
  const pStart = useMemo(() => {
    const d = new Date(cutoff);
    d.setUTCDate(d.getUTCDate() - 7);
    return d;
  }, [cutoff]);
  const payDate = useMemo(() => {
    const f = new Date(cutoff);
    f.setUTCDate(cutoff.getUTCDate() + 1);
    return f;
  }, [cutoff]);
  const nextBonusFriday = useMemo(() => lastFridayOfMonth(payDate), [payDate]);

  // Employees (active payroll settings + profile + role)
  const { data: employees } = useQuery({
    queryKey: ["hr-payroll2-employees"],
    queryFn: async (): Promise<EmployeeRow[]> => {
      const { data: settings } = await supabase
        .from("employee_payroll_settings")
        .select("*")
        .eq("is_active", true);
      const ids = (settings ?? []).map((s: any) => s.employee_id);
      if (!ids.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, agent_number, avatar_url")
        .in("user_id", ids);
      const pmap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      return (settings ?? []).map((s: any) => ({
        ...s,
        profile: pmap.get(s.employee_id) || null,
      }));
    },
  });

  // Payable commissions: once approved, Field commissions can be paid at any payroll run.
  const { data: periodCommissions } = useQuery({
    queryKey: ["hr-payroll2-commissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_commissions")
        .select("id, agent_id, amount, description, commission_type, earned_at, order_id")
        .eq("status", "approved")
        .order("earned_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Period timesheets
  const { data: timesheets } = useQuery({
    queryKey: ["hr-payroll2-timesheets", pStart.toISOString().slice(0, 10)],
    queryFn: async () => {
      const { data } = await supabase
        .from("timesheet_entries")
        .select("*")
        .eq("pay_period_start", pStart.toISOString().slice(0, 10));
      return data ?? [];
    },
  });

  // Period adjustments (not yet attached to a run)
  const { data: adjustments } = useQuery({
    queryKey: ["hr-payroll2-adjustments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pay_adjustments")
        .select("*")
        .is("payroll_run_id", null);
      return data ?? [];
    },
  });

  // Payroll runs history
  const { data: runs } = useQuery({
    queryKey: ["hr-payroll2-runs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payroll_runs")
        .select("*")
        .order("pay_date", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: drillEntries } = useQuery({
    queryKey: ["hr-payroll2-entries", drillIn],
    enabled: !!drillIn,
    queryFn: async () => {
      const { data } = await supabase
        .from("payroll_entries")
        .select("*, profile:profiles!user_id(full_name, email, agent_number)")
        .eq("run_id", drillIn!);
      return data ?? [];
    },
  });

  // Filter by tab
  const filteredEmployees = useMemo(() => {
    const group = ROLE_GROUPS.find((g) => g.key === tab) ?? ROLE_GROUPS[0];
    return (employees ?? []).filter((e) => (group.roles as readonly string[]).includes(e.employee_role || ""));
  }, [employees, tab]);

  // Per-employee compute summary
  function getCommissions(empId: string) {
    return (periodCommissions ?? []).filter((c: any) => c.agent_id === empId);
  }
  function getTimesheet(empId: string) {
    return (timesheets ?? []).find((t: any) => t.employee_id === empId) || null;
  }
  function getAdjustments(empId: string) {
    return (adjustments ?? []).filter((a: any) => a.employee_id === empId);
  }
  function computeSummary(emp: EmployeeRow) {
    const isHourly = emp.pay_type === "hourly" || emp.pay_type === "hourly_commission";
    const isCommission = emp.pay_type === "commission" || emp.pay_type === "hourly_commission";
    const ts = getTimesheet(emp.employee_id);
    const rate = Number(emp.hourly_rate || 0);
    const lh = localHours.get(emp.employee_id);
    const hWorked = lh ? lh.h : Number(ts?.hours_worked || 0);
    const otWorked = lh ? lh.ot : Number(ts?.overtime_hours || 0);
    const hourly = isHourly ? hWorked * rate : 0;
    const overtime = isHourly ? otWorked * rate * 1.5 : 0;
    const allComm = isCommission ? getCommissions(emp.employee_id) : [];
    const includedComm = allComm.filter((c: any) => !excludedComm.has(c.id));
    const commTotal = includedComm.reduce((s: number, c: any) => s + Number(c.amount || 0), 0);
    const adj = getAdjustments(emp.employee_id);
    const adjTotal = adj.reduce((s: number, a: any) => s + Number(a.amount || 0), 0);
    const gross = hourly + overtime + commTotal + adjTotal;

    // Estimated deductions (simplified preview — actual computed by edge function)
    const fedRate = 0.15, qcRate = 0.15, rrqRate = 0.059, aeRate = 0.0166, rqapRate = 0.00494;
    const disRate = Number(emp.disability_insurance_rate || 0.02);
    const ded = gross > 0 ? gross * (fedRate + qcRate + rrqRate + aeRate + rqapRate + disRate) : 0;
    const net = gross - ded;
    return { hourly, overtime, commTotal, adjTotal, gross, ded, net, ts, adj, hWorked, otWorked, commissions: allComm, includedComm, commCount: allComm.length };
  }

  // Aggregate totals — based on SELECTED employees (fallback: all visible)
  const selectionList = useMemo(
    () => filteredEmployees.filter((e) => selectedEmps.size === 0 || selectedEmps.has(e.employee_id)),
    [filteredEmployees, selectedEmps],
  );
  const totals = useMemo(() => {
    const t = { gross: 0, ded: 0, net: 0, count: 0, bonus: 0 };
    for (const e of selectionList) {
      const s = computeSummary(e);
      t.gross += s.gross;
      t.ded += s.ded;
      t.net += s.net;
      t.count += 1;
    }
    return t;
  }, [selectionList, periodCommissions, timesheets, adjustments, excludedComm, localHours]);

  function buildRunBody(extra: Record<string, unknown> = {}) {
    const body: Record<string, unknown> = {
      excluded_commission_ids: Array.from(excludedComm),
      ...extra,
    };
    if (selectedEmps.size > 0) body.employee_ids = Array.from(selectedEmps);
    return body;
  }

  // Mutations
  const previewMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("process-payroll", {
        body: buildRunBody({ dry_run: true }),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => { setPreview(d); toast.success("Aperçu chargé"); },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      if (selectedEmps.size === 0) {
        throw new Error("Sélectionnez au moins un employé à payer.");
      }
      const { data, error } = await supabase.functions.invoke("process-payroll", {
        body: buildRunBody(),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(`Paie traitée — ${d.employee_count} employé(s), net ${fmtMoney(d.total_net)}`);
      setPreview(null);
      setSelectedEmps(new Set());
      qc.invalidateQueries({ queryKey: ["hr-payroll2-runs"] });
      qc.invalidateQueries({ queryKey: ["hr-payroll2-commissions"] });
      qc.invalidateQueries({ queryKey: ["hr-payroll2-adjustments"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur de traitement"),
  });

  // Paystub preview (per employee — opens generated PDF in new tab)
  const stubPreviewMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      setPreviewingStub(employeeId);
      const { data, error } = await supabase.functions.invoke("process-payroll", {
        body: { dry_run: true, preview_employee_id: employeeId, excluded_commission_ids: Array.from(excludedComm) },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      setPreviewingStub(null);
      if (!d?.pdf_base64) { toast.error("Aperçu indisponible"); return; }
      const bytes = Uint8Array.from(atob(d.pdf_base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
    },
    onError: (e: any) => { setPreviewingStub(null); toast.error(e.message || "Erreur"); },
  });

  return (
    <div className="space-y-6 p-6">
      {/* SECTION 1 — Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">Gestion de la paie</CardTitle>
              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Période : <strong className="text-foreground">Dimanche {shortDate(pStart)} au Jeudi {shortDate(cutoff)} 18h00</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  <span>Date de paie : <strong className="text-foreground">Vendredi {shortDate(payDate)}</strong></span>
                </div>
                <div className="text-xs">
                  Prochaine paie bonus : <strong>{shortDate(nextBonusFriday)}</strong>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending}>
                {previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Aperçu de la paie
              </Button>
              <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
                {runMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
                Traiter la paie
              </Button>
              <Button variant="ghost" onClick={() => setHistoryOpen(true)}>
                <History className="h-4 w-4" />
                Historique
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* SECTION 2 — Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          {ROLE_GROUPS.map((g) => (
            <TabsTrigger key={g.key} value={g.key}>{g.label}</TabsTrigger>
          ))}
        </TabsList>

        {ROLE_GROUPS.map((g) => (
          <TabsContent key={g.key} value={g.key} className="space-y-4 mt-4">
            {filteredEmployees.length === 0 && (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Aucun employé dans ce groupe</CardContent></Card>
            )}
            {filteredEmployees.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={filteredEmployees.every((e) => selectedEmps.has(e.employee_id))}
                    onChange={(e) => {
                      const next = new Set(selectedEmps);
                      if (e.target.checked) filteredEmployees.forEach((emp) => next.add(emp.employee_id));
                      else filteredEmployees.forEach((emp) => next.delete(emp.employee_id));
                      setSelectedEmps(next);
                    }}
                  />
                  <span className="font-medium">Tout sélectionner</span>
                  <Badge variant="secondary">{selectedEmps.size} sélectionné(s)</Badge>
                </div>
                {selectedEmps.size > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => setSelectedEmps(new Set())}>Désélectionner tout</Button>
                )}
              </div>
            )}
            {filteredEmployees.map((emp) => (
              <EmployeeCard
                key={emp.employee_id}
                emp={emp}
                summary={computeSummary(emp)}
                excludedComm={excludedComm}
                onToggleComm={toggleExcludedComm}
                onLocalHoursChange={(h, ot) => setLocalHoursFor(emp.employee_id, h, ot)}
                onEditSettings={() => setEditingEmployee(emp)}
                onAddAdjustment={() => setAdjustmentFor(emp)}
                periodStart={pStart}
                periodEnd={cutoff}
                onSavedTimesheet={() => qc.invalidateQueries({ queryKey: ["hr-payroll2-timesheets"] })}
                onAdjustmentDeleted={() => qc.invalidateQueries({ queryKey: ["hr-payroll2-adjustments"] })}
                selected={selectedEmps.has(emp.employee_id)}
                onToggleSelected={() => toggleSelectedEmp(emp.employee_id)}
                onPreviewStub={() => stubPreviewMutation.mutate(emp.employee_id)}
                previewingStub={previewingStub === emp.employee_id}
              />
            ))}
          </TabsContent>
        ))}
      </Tabs>

      {/* SECTION 4 — Run summary */}
      {filteredEmployees.length > 0 && (
        <Card className="border-primary/40">
          <CardHeader><CardTitle>Récapitulatif</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Stat label="Total employés" value={String(totals.count)} />
            <Stat label="Total brut" value={fmtMoney(totals.gross)} />
            <Stat label="Total déductions" value={fmtMoney(totals.ded)} />
            <Stat label="Total net" value={fmtMoney(totals.net)} accent />
            <Stat label="Total bonus" value={fmtMoney(totals.bonus)} />
          </CardContent>
        </Card>
      )}

      {/* History dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Historique des paies</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° run</TableHead>
                  <TableHead>Date paie</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Employés</TableHead>
                  <TableHead>Brut</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(runs ?? []).map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.run_number}</TableCell>
                    <TableCell>{shortDate(r.pay_date)}</TableCell>
                    <TableCell className="text-xs">{shortDate(r.period_start)} → {shortDate(r.period_end)}</TableCell>
                    <TableCell>{r.employee_count ?? 0}</TableCell>
                    <TableCell>{fmtMoney(r.total_gross)}</TableCell>
                    <TableCell className="font-semibold">{fmtMoney(r.total_net)}</TableCell>
                    <TableCell><Badge variant={r.status === "completed" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => setDrillIn(r.id)}>Voir les détails</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Drill-in dialog */}
      <Dialog open={!!drillIn} onOpenChange={(o) => !o && setDrillIn(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Détails de la paie</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead>Brut</TableHead>
                  <TableHead>Déductions</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Talon</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(drillEntries ?? []).map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="font-medium">{e.profile?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{e.profile?.agent_number ?? ""}</div>
                    </TableCell>
                    <TableCell>{fmtMoney(e.total_gross)}</TableCell>
                    <TableCell className="text-destructive">{fmtMoney(e.deductions_total)}</TableCell>
                    <TableCell className="font-semibold text-emerald-700">{fmtMoney(e.net_pay)}</TableCell>
                    <TableCell>
                      {e.paystub_pdf_url ? (
                        <a href={e.paystub_pdf_url} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="ghost"><Download className="h-4 w-4" /> PDF</Button>
                        </a>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings drawer */}
      <EmployeeSettingsSheet
        emp={editingEmployee}
        onClose={() => setEditingEmployee(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["hr-payroll2-employees"] })}
      />

      {/* Adjustment dialog */}
      <AdjustmentDialog
        emp={adjustmentFor}
        onClose={() => setAdjustmentFor(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["hr-payroll2-adjustments"] })}
      />

      {/* Preview dialog */}
      {preview && (
        <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Aperçu de la paie</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <div>Employés : <strong>{preview.employee_count}</strong></div>
              <div>Total brut : <strong>{fmtMoney(preview.total_gross)}</strong></div>
              <div>Total déductions : <strong className="text-destructive">{fmtMoney(preview.total_deductions)}</strong></div>
              <div>Total net : <strong className="text-emerald-700">{fmtMoney(preview.total_net)}</strong></div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─────────────── EmployeeCard ───────────────
function EmployeeCard({
  emp, summary, onEditSettings, onAddAdjustment, periodStart, periodEnd,
  onSavedTimesheet, onAdjustmentDeleted, excludedComm, onToggleComm, onLocalHoursChange,
  selected, onToggleSelected, onPreviewStub, previewingStub,
}: {
  emp: EmployeeRow;
  summary: any;
  onEditSettings: () => void;
  onAddAdjustment: () => void;
  periodStart: Date; periodEnd: Date;
  onSavedTimesheet: () => void;
  onAdjustmentDeleted: () => void;
  excludedComm: Set<string>;
  onToggleComm: (id: string) => void;
  onLocalHoursChange: (h: number, ot: number) => void;
  selected: boolean;
  onToggleSelected: () => void;
  onPreviewStub: () => void;
  previewingStub: boolean;
}) {
  const isHourly = emp.pay_type === "hourly" || emp.pay_type === "hourly_commission";
  const isCommission = emp.pay_type === "commission" || emp.pay_type === "hourly_commission";
  const payBadge = PAY_TYPE_BADGES[emp.pay_type] ?? PAY_TYPE_BADGES.commission;

  const [hours, setHours] = useState<string>(summary.ts ? String(summary.ts.hours_worked ?? 0) : "");
  const [overtime, setOvertime] = useState<string>(summary.ts ? String(summary.ts.overtime_hours ?? 0) : "");
  const [savingTs, setSavingTs] = useState(false);

  function handleHoursChange(v: string) {
    setHours(v);
    onLocalHoursChange(Number(v) || 0, Number(overtime) || 0);
  }
  function handleOvertimeChange(v: string) {
    setOvertime(v);
    onLocalHoursChange(Number(hours) || 0, Number(v) || 0);
  }

  async function saveTimesheet() {
    setSavingTs(true);
    try {
      const payload = {
        employee_id: emp.employee_id,
        pay_period_start: periodStart.toISOString().slice(0, 10),
        pay_period_end: periodEnd.toISOString().slice(0, 10),
        hours_worked: Number(hours) || 0,
        overtime_hours: Number(overtime) || 0,
        status: "approved",
      };
      if (summary.ts) {
        const { error } = await supabase.from("timesheet_entries").update(payload).eq("id", summary.ts.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("timesheet_entries").insert(payload as any);
        if (error) throw error;
      }
      toast.success("Heures enregistrées");
      onSavedTimesheet();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSavingTs(false);
    }
  }

  async function deleteAdjustment(id: string) {
    const { error } = await supabase.from("pay_adjustments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Ajustement supprimé"); onAdjustmentDeleted(); }
  }

  const role = emp.employee_role || "—";
  const initials = (emp.profile?.full_name || emp.profile?.email || "?").split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();
  const rate = Number(emp.hourly_rate || 0);
  const hNum = Number(hours) || 0;
  const otNum = Number(overtime) || 0;
  const liveRegular = hNum * rate;
  const liveOvertime = otNum * rate * 1.5;
  const liveHourlySubtotal = liveRegular + liveOvertime;

  return (
    <Card className={selected ? "ring-2 ring-primary/60" : ""}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-input"
              checked={selected}
              onChange={onToggleSelected}
              aria-label="Inclure dans la paie"
            />
            {emp.profile?.avatar_url ? (
              <img src={emp.profile.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center font-bold text-foreground">
                {initials}
              </div>
            )}
            <div>
              <div className="font-semibold text-base">{emp.profile?.full_name ?? emp.profile?.email ?? emp.employee_id.slice(0, 8)}</div>
              <div className="text-xs text-muted-foreground">{emp.profile?.agent_number ? `N° ${emp.profile.agent_number}` : emp.profile?.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={ROLE_BADGE_CLS[role] ?? ""}>{role}</Badge>
            <Badge variant="outline" className={payBadge.cls}>{payBadge.label}</Badge>
            <Button size="sm" variant="outline" onClick={onPreviewStub} disabled={previewingStub}>
              {previewingStub ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Voir le talon
            </Button>
            <Button size="sm" variant="ghost" onClick={onEditSettings}><Settings className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Commissions — detailed list with include/exclude checkboxes */}
        {isCommission && (
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Commissions approuvées</div>
            {summary.commissions.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">Aucune commission approuvée disponible</div>
            ) : (
              <>
                <div className="space-y-1">
                  {summary.commissions.map((c: any) => {
                    const included = !excludedComm.has(c.id);
                    return (
                      <label key={c.id} className={`flex items-center gap-2 text-sm rounded px-2 py-1 cursor-pointer hover:bg-muted ${included ? "" : "opacity-50 line-through"}`}>
                        <input
                          type="checkbox"
                          checked={included}
                          onChange={() => onToggleComm(c.id)}
                          className="h-4 w-4 rounded border-input"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {c.order_id ? `Commande ${String(c.order_id).slice(0, 8)}` : "Commission"}
                            {c.description ? <span className="text-muted-foreground"> — {c.description}</span> : null}
                          </div>
                          <div className="text-xs text-muted-foreground">{shortDate(c.earned_at)}</div>
                        </div>
                        <div className="font-semibold">{fmtMoney(c.amount)}</div>
                      </label>
                    );
                  })}
                </div>
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span>
                    {summary.includedComm.length} / {summary.commissions.length} commission(s) approuvée(s) — Total
                  </span>
                  <span className="font-semibold">{fmtMoney(summary.commTotal)}</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Hourly input */}
        {isHourly && (
          <div className="rounded-md border bg-muted/30 p-3 space-y-2">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Heures travaillées</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Heures régulières × {fmtMoney(rate)}/h</Label>
                <Input type="number" step="0.25" value={hours} onChange={(e) => handleHoursChange(e.target.value)} placeholder="0" />
                <div className="text-xs text-muted-foreground mt-1">= {fmtMoney(liveRegular)}</div>
              </div>
              <div>
                <Label className="text-xs">Heures supp × {fmtMoney(rate * 1.5)}/h</Label>
                <Input type="number" step="0.25" value={overtime} onChange={(e) => handleOvertimeChange(e.target.value)} placeholder="0" />
                <div className="text-xs text-muted-foreground mt-1">= {fmtMoney(liveOvertime)}</div>
              </div>
            </div>
            <div className="flex justify-between items-center text-sm pt-2 border-t">
              <span>Total : {hNum + otNum} h — Sous-total horaire</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{fmtMoney(liveHourlySubtotal)}</span>
                <Button size="sm" variant="outline" onClick={saveTimesheet} disabled={savingTs}>
                  {savingTs ? <Loader2 className="h-3 w-3 animate-spin" /> : "Enregistrer"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Adjustments */}
        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <div className="flex justify-between items-center">
            <div className="text-xs font-semibold uppercase text-muted-foreground">Ajustements</div>
            <Button size="sm" variant="outline" onClick={onAddAdjustment}><Plus className="h-3 w-3" /> Ajouter</Button>
          </div>
          {summary.adj.length === 0 && <div className="text-xs text-muted-foreground">Aucun ajustement pour cette période</div>}
          {summary.adj.map((a: any) => (
            <div key={a.id} className="flex justify-between items-center text-sm">
              <div>
                <span className="font-medium capitalize">{a.adjustment_type}</span>
                <span className="text-muted-foreground"> — {a.description}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={Number(a.amount) >= 0 ? "text-emerald-700" : "text-destructive"}>{fmtMoney(a.amount)}</span>
                <Button size="sm" variant="ghost" onClick={() => deleteAdjustment(a.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </div>

        {/* Deductions preview */}
        <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-sm">
          <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Déductions estimées (calcul exact au traitement)</div>
          <div className="flex justify-between"><span>Total brut</span><span className="font-semibold">{fmtMoney(summary.gross)}</span></div>
          <div className="flex justify-between text-destructive"><span>Déductions estimées (~)</span><span>-{fmtMoney(summary.ded)}</span></div>
        </div>

        {/* NET */}
        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4 flex justify-between items-center">
          <div>
            <div className="text-xs font-semibold uppercase text-emerald-700">Net à payer (estimé)</div>
            <div className="text-2xl font-bold text-emerald-700">{fmtMoney(summary.net)}</div>
          </div>
          <Badge className="bg-white border border-emerald-300 text-emerald-700 capitalize">{emp.payment_method ?? "interac"}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// helper type for summary
type EmployeeRow = {
  id: string;
  employee_id: string;
  pay_type: string;
  hourly_rate: number;
  employee_role: string | null;
  payment_method: string | null;
  payment_details: any;
  federal_claim_amount: number;
  quebec_claim_amount: number;
  disability_insurance_rate: number;
  is_active: boolean;
  profile: any | null;
};


// ─────────────── Stat ───────────────
function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold ${accent ? "text-emerald-700" : ""}`}>{value}</div>
    </div>
  );
}

// ─────────────── Settings sheet ───────────────
function EmployeeSettingsSheet({ emp, onClose, onSaved }: { emp: EmployeeRow | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useMemo(() => { if (emp) setForm({ ...emp }); }, [emp?.id]);
  if (!emp || !form) return null;

  async function save() {
    setSaving(true);
    try {
      const { error } = await supabase.from("employee_payroll_settings").update({
        pay_type: form.pay_type,
        hourly_rate: Number(form.hourly_rate) || 0,
        federal_claim_amount: Number(form.federal_claim_amount) || 0,
        quebec_claim_amount: Number(form.quebec_claim_amount) || 0,
        disability_insurance_rate: Number(form.disability_insurance_rate) || 0,
        payment_method: form.payment_method,
      }).eq("id", emp.id);
      if (error) throw error;
      toast.success("Paramètres enregistrés");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={!!emp} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader><SheetTitle>Paramètres de paie</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="text-sm font-medium">{emp.profile?.full_name ?? emp.profile?.email}</div>
          <div>
            <Label>Type de paie</Label>
            <Select value={form.pay_type} onValueChange={(v) => setForm({ ...form, pay_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="commission">Commission</SelectItem>
                <SelectItem value="hourly">Horaire</SelectItem>
                <SelectItem value="hourly_commission">Horaire + Commission</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Taux horaire ($/h)</Label>
            <Input type="number" step="0.01" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} />
          </div>
          <div>
            <Label>BPA fédéral (TD1)</Label>
            <Input type="number" step="0.01" value={form.federal_claim_amount} onChange={(e) => setForm({ ...form, federal_claim_amount: e.target.value })} />
          </div>
          <div>
            <Label>Crédit personnel QC (TP-1015)</Label>
            <Input type="number" step="0.01" value={form.quebec_claim_amount} onChange={(e) => setForm({ ...form, quebec_claim_amount: e.target.value })} />
          </div>
          <div>
            <Label>Taux assurance invalidité</Label>
            <Input type="number" step="0.001" value={form.disability_insurance_rate} onChange={(e) => setForm({ ...form, disability_insurance_rate: e.target.value })} />
          </div>
          <div>
            <Label>Méthode de paiement</Label>
            <Select value={form.payment_method ?? "interac"} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="interac">Interac</SelectItem>
                <SelectItem value="direct_deposit">Dépôt direct</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sauvegarder"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─────────────── Adjustment dialog ───────────────
function AdjustmentDialog({ emp, onClose, onSaved }: { emp: EmployeeRow | null; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState("allocation");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [taxable, setTaxable] = useState(true);
  const [saving, setSaving] = useState(false);

  if (!emp) return null;

  async function save() {
    if (!description || !amount) { toast.error("Description et montant requis"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("pay_adjustments").insert({
        employee_id: emp.employee_id,
        adjustment_type: type,
        description,
        amount: Number(amount),
        is_taxable: taxable,
      } as any);
      if (error) throw error;
      toast.success("Ajustement ajouté");
      setDescription(""); setAmount(""); setType("allocation"); setTaxable(true);
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!emp} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouvel ajustement</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div><Label>Montant (négatif pour déduction)</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="flex items-center gap-2"><Switch checked={taxable} onCheckedChange={setTaxable} /><Label>Imposable</Label></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ajouter"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
