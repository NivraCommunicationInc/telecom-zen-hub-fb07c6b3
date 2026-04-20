/**
 * HrPayrollPage — Professional payroll administration
 * Sections: Header period nav | Employee payroll table | Bulk actions | Adjustments | History
 */
import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DollarSign, CheckCircle, FileText, Loader2, Calendar, Download, Send, Wand2,
  ChevronLeft, ChevronRight, Lock, Edit, Plus, Users, TrendingUp, Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// ─── Tax constants (Quebec 2026 estimates) ───────────────────────────────────
const TAX_RATES = {
  federal: 0.15,
  provincial: 0.12,
  rpc: 0.0595,
  ae: 0.0134,
  rqap: 0.00494,
};
const RPC_MAX_ANNUAL = 4055.50; // 2025 max — used as ceiling estimate

const PERIOD_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Brouillon", variant: "secondary" },
  open: { label: "Ouverte", variant: "default" },
  processing: { label: "En traitement", variant: "outline" },
  closed: { label: "Finalisée", variant: "destructive" },
};

const ENTRY_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Brouillon", variant: "secondary" },
  pending_approval: { label: "En attente", variant: "outline" },
  approved: { label: "Approuvée", variant: "default" },
  paid: { label: "Payée", variant: "default" },
  rejected: { label: "Rejetée", variant: "destructive" },
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n: number) => `${(n || 0).toFixed(2)} $`;

function computeDeductions(gross: number) {
  const fed = gross * TAX_RATES.federal;
  const prov = gross * TAX_RATES.provincial;
  const rpc = Math.min(gross * TAX_RATES.rpc, RPC_MAX_ANNUAL / 24);
  const ae = gross * TAX_RATES.ae;
  const rqap = gross * TAX_RATES.rqap;
  const total = fed + prov + rpc + ae + rqap;
  return { fed, prov, rpc, ae, rqap, total };
}

function getPeriodDefinition(which: "first" | "fifteenth", now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = which === "first"
    ? new Date(year, month, 1)
    : new Date(year, month, 16);
  const end = which === "first"
    ? new Date(year, month, 15)
    : new Date(year, month + 1, 0);

  return {
    start,
    end,
    startISO: start.toISOString().slice(0, 10),
    endISO: end.toISOString().slice(0, 10),
    label: which === "first"
      ? `Période 1-15 ${format(start, "MMMM yyyy", { locale: fr })}`
      : `Période 16-${format(end, "d", { locale: fr })} ${format(start, "MMMM yyyy", { locale: fr })}`,
  };
}

export default function HrPayrollPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("payroll");
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");

  // Adjustment dialog state
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustEntry, setAdjustEntry] = useState<any>(null);
  const [adjustForm, setAdjustForm] = useState({ type: "bonus", amount: "", reason: "", notes: "" });

  // Add employee dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    user_id: "", hours: "", rate: "", commissions: "", bonus: "", deductions: "", notes: "",
  });

  // Edit entry dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    hours: "", rate: "", commissions: "", bonus: "", notes: "",
  });

  // ─── Periods ──────────────────────────────────────────────────────────────
  const { data: periods = [], isLoading: loadingPeriods } = useQuery({
    queryKey: ["hr-pay-periods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pay_periods")
        .select("*")
        .order("start_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  // ─── Detect expected current period (based on today's date) ──────────────
  const today = new Date();
  const expectedHalf: "first" | "fifteenth" = today.getDate() <= 15 ? "first" : "fifteenth";
  const expectedPeriodDef = getPeriodDefinition(expectedHalf, today);
  const expectedLabel = expectedPeriodDef.label;
  const expectedPeriod = periods.find((p: any) =>
    p.start_date === expectedPeriodDef.startISO && p.end_date === expectedPeriodDef.endISO
  ) || null;

  useEffect(() => {
    if (periods.length === 0) {
      if (selectedPeriod !== null) setSelectedPeriod(null);
      return;
    }
    const selectedStillExists = selectedPeriod && periods.some((p: any) => p.id === selectedPeriod);
    if (selectedStillExists) return;
    setSelectedPeriod(expectedPeriod?.id ?? periods[0].id);
  }, [periods, expectedPeriod?.id, selectedPeriod]);

  const currentPeriod = periods.find((p: any) => p.id === selectedPeriod) || null;
  const periodIndex = periods.findIndex((p: any) => p.id === selectedPeriod);
  const isLocked = currentPeriod?.status === "closed";
  const showMissingCurrentPeriodState = !expectedPeriod;
  const showMissingEntriesState = !!expectedPeriod && currentPeriod?.id === expectedPeriod.id && !loadingEntries && entries.length === 0;

  // ─── Entries for selected period ──────────────────────────────────────────
  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ["hr-payroll-entries", selectedPeriod],
    enabled: !!selectedPeriod,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_entries")
        .select("*")
        .eq("pay_period_id", selectedPeriod!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = [...new Set(data.map((e: any) => e.user_id))];
      if (userIds.length) {
        const { data: emps } = await supabase
          .from("employee_records")
          .select("user_id, first_name, last_name, job_title, hourly_rate, work_email")
          .in("user_id", userIds);
        const map = Object.fromEntries((emps || []).map((p: any) => [p.user_id, p]));
        return data.map((e: any) => ({
          ...e,
          _emp: map[e.user_id] || null,
          _name: map[e.user_id] ? `${map[e.user_id].first_name} ${map[e.user_id].last_name}` : e.user_id.slice(0, 8),
        }));
      }
      return data;
    },
  });

  // ─── Adjustments for current period ──────────────────────────────────────
  const { data: adjustments = [] } = useQuery({
    queryKey: ["hr-payroll-adjustments", selectedPeriod, entries.length],
    enabled: !!selectedPeriod && entries.length > 0,
    queryFn: async () => {
      const entryIds = entries.map((e: any) => e.id);
      const { data, error } = await supabase
        .from("payroll_adjustments")
        .select("*")
        .in("payroll_entry_id", entryIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // ─── History (all periods with summary) ──────────────────────────────────
  const { data: history = [] } = useQuery({
    queryKey: ["hr-payroll-history"],
    queryFn: async () => {
      const { data: pds, error } = await supabase
        .from("pay_periods")
        .select("*")
        .order("start_date", { ascending: false })
        .limit(20);
      if (error) throw error;
      // Aggregate per period
      const summary = await Promise.all((pds || []).map(async (p: any) => {
        const { data: ents } = await supabase
          .from("payroll_entries")
          .select("gross_pay, net_pay, status")
          .eq("pay_period_id", p.id);
        const totalGross = (ents || []).reduce((s: number, e: any) => s + (e.gross_pay || 0), 0);
        const totalNet = (ents || []).reduce((s: number, e: any) => s + (e.net_pay || 0), 0);
        return {
          ...p,
          _employees: ents?.length || 0,
          _totalGross: totalGross,
          _totalNet: totalNet,
        };
      }));
      return summary;
    },
  });

  // ─── Mutations ───────────────────────────────────────────────────────────
  const autoGenerateMut = useMutation({
    mutationFn: async (which: "first" | "fifteenth") => {
      const periodDef = getPeriodDefinition(which);

      const { data: existingPeriod, error: existingPeriodErr } = await supabase
        .from("pay_periods")
        .select("id, period_name, start_date, end_date")
        .eq("start_date", periodDef.startISO)
        .eq("end_date", periodDef.endISO)
        .maybeSingle();
      if (existingPeriodErr) throw existingPeriodErr;

      let periodId = existingPeriod?.id;
      if (!periodId) {
        const { data: createdPeriod, error: createPeriodErr } = await supabase
          .from("pay_periods")
          .insert({
            period_name: periodDef.label,
            start_date: periodDef.startISO,
            end_date: periodDef.endISO,
            status: "draft",
          })
          .select("id")
          .single();
        if (createPeriodErr) throw createPeriodErr;
        periodId = createdPeriod.id;
      }

      const { data: emps, error: empErr } = await supabase
        .from("employee_records")
        .select("user_id, base_salary, hourly_rate, salary_type")
        .eq("status", "active")
        .not("user_id", "is", null);
      if (empErr) throw empErr;

      const activeEmployees = (emps ?? []).filter((emp: any) => !!emp.user_id);
      if (activeEmployees.length === 0) return { periodId, created: 0 };

      const activeUserIds = activeEmployees.map((emp: any) => emp.user_id);
      const { data: existingEntries, error: existingEntriesErr } = await supabase
        .from("payroll_entries")
        .select("user_id")
        .eq("pay_period_id", periodId)
        .in("user_id", activeUserIds);
      if (existingEntriesErr) throw existingEntriesErr;

      const existingUserIds = new Set((existingEntries ?? []).map((entry: any) => entry.user_id));
      const employeesToInsert = activeEmployees.filter((emp: any) => !existingUserIds.has(emp.user_id));
      if (employeesToInsert.length === 0) return { periodId, created: 0 };

      const userIds = employeesToInsert.map((emp: any) => emp.user_id);
      const [hoursRes, commsRes] = await Promise.all([
        supabase
          .from("time_entries")
          .select("user_id, total_hours")
          .in("user_id", userIds)
          .gte("punch_in", `${periodDef.startISO}T00:00:00Z`)
          .lte("punch_in", `${periodDef.endISO}T23:59:59Z`)
          .not("total_hours", "is", null),
        supabase
          .from("unified_commissions" as any)
          .select("employee_id, amount")
          .in("employee_id", userIds)
          .in("status", ["validated", "payable", "pending"])
          .gte("created_at", `${periodDef.startISO}T00:00:00Z`)
          .lte("created_at", `${periodDef.endISO}T23:59:59Z`),
      ]);

      if (hoursRes.error) throw hoursRes.error;
      if (commsRes.error) throw commsRes.error;

      const hoursByUser = new Map<string, number>();
      for (const row of hoursRes.data ?? []) {
        hoursByUser.set(row.user_id, (hoursByUser.get(row.user_id) ?? 0) + Number(row.total_hours || 0));
      }

      const commissionsByUser = new Map<string, number>();
      for (const row of (commsRes.data as any[]) ?? []) {
        const employeeId = row.employee_id as string;
        commissionsByUser.set(employeeId, (commissionsByUser.get(employeeId) ?? 0) + Number(row.amount || 0));
      }

      const rows = employeesToInsert.map((emp: any) => {
        const totalHours = hoursByUser.get(emp.user_id) ?? 0;
        const commissionTotal = commissionsByUser.get(emp.user_id) ?? 0;
        const baseSalary = emp.salary_type === "hourly"
          ? totalHours * Number(emp.hourly_rate || 0)
          : Number(emp.base_salary || 0) / 24;
        const gross = baseSalary + commissionTotal;
        const deductions = computeDeductions(gross);

        return {
          pay_period_id: periodId,
          user_id: emp.user_id,
          base_salary: Math.round(baseSalary * 100) / 100,
          commission_total: Math.round(commissionTotal * 100) / 100,
          bonus_total: 0,
          hours_worked: Math.round(totalHours * 100) / 100,
          overtime_hours: 0,
          gross_pay: Math.round(gross * 100) / 100,
          deductions_total: Math.round(deductions.total * 100) / 100,
          net_pay: Math.round((gross - deductions.total) * 100) / 100,
          status: "draft",
        };
      });

      const { data: inserted, error: insertErr } = await supabase
        .from("payroll_entries")
        .insert(rows)
        .select("id");
      if (insertErr) throw insertErr;

      return { periodId, created: inserted?.length ?? rows.length };
    },
    onSuccess: (r) => {
      toast.success(r.created > 0
        ? `Période prête — ${r.created} fiche(s) générée(s)`
        : "Période déjà prête — aucune fiche manquante");
      qc.invalidateQueries({ queryKey: ["hr-pay-periods"] });
      qc.invalidateQueries({ queryKey: ["hr-payroll-history"] });
      qc.invalidateQueries({ queryKey: ["hr-payroll-entries"] });
      setSelectedPeriod(r.periodId);
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const approveMut = useMutation({
    mutationFn: async (entryId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("payroll_entries")
        .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: user?.id })
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fiche approuvée");
      qc.invalidateQueries({ queryKey: ["hr-payroll-entries"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const approveAllMut = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const ids = entries.filter((e: any) => e.status === "draft" || e.status === "pending_approval").map((e: any) => e.id);
      if (ids.length === 0) throw new Error("Aucune fiche à approuver");
      const { error } = await supabase
        .from("payroll_entries")
        .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: user?.id })
        .in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} fiche(s) approuvée(s)`);
      qc.invalidateQueries({ queryKey: ["hr-payroll-entries"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const markPaidMut = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from("payroll_entries")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fiche marquée payée");
      qc.invalidateQueries({ queryKey: ["hr-payroll-entries"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const markAllPaidMut = useMutation({
    mutationFn: async () => {
      const ids = entries.filter((e: any) => e.status === "approved").map((e: any) => e.id);
      if (ids.length === 0) throw new Error("Aucune fiche approuvée à marquer payée");
      const { error } = await supabase
        .from("payroll_entries")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} fiche(s) marquée(s) payée(s)`);
      qc.invalidateQueries({ queryKey: ["hr-payroll-entries"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const finalizePeriodMut = useMutation({
    mutationFn: async () => {
      if (!selectedPeriod) throw new Error("Aucune période");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("pay_periods")
        .update({ status: "closed", closed_at: new Date().toISOString(), closed_by: user?.id })
        .eq("id", selectedPeriod);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Période finalisée — verrouillée");
      qc.invalidateQueries({ queryKey: ["hr-pay-periods"] });
      qc.invalidateQueries({ queryKey: ["hr-payroll-history"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const adjustMut = useMutation({
    mutationFn: async () => {
      if (!adjustEntry) throw new Error("Aucune fiche");
      const amt = parseFloat(adjustForm.amount);
      if (isNaN(amt) || amt === 0) throw new Error("Montant invalide");
      const { data: { user } } = await supabase.auth.getUser();
      const signedAmount = adjustForm.type === "deduction" ? -Math.abs(amt) : Math.abs(amt);

      const { error: aErr } = await supabase.from("payroll_adjustments").insert({
        payroll_entry_id: adjustEntry.id,
        adjustment_type: adjustForm.type,
        label: adjustForm.reason || (adjustForm.type === "bonus" ? "Bonus" : "Déduction"),
        amount: signedAmount,
        applied_by: user?.id,
        notes: adjustForm.notes || null,
      });
      if (aErr) throw aErr;

      // Recompute entry totals
      const newBonus = adjustForm.type === "bonus" ? (adjustEntry.bonus_total || 0) + Math.abs(amt) : (adjustEntry.bonus_total || 0);
      const newDed = adjustForm.type === "deduction"
        ? (adjustEntry.deductions_total || 0) + Math.abs(amt)
        : (adjustEntry.deductions_total || 0);
      const newGross = (adjustEntry.base_salary || 0) + (adjustEntry.commission_total || 0) + newBonus;
      const taxDed = computeDeductions(newGross).total;
      const newTotalDed = taxDed + (adjustForm.type === "deduction" ? Math.abs(amt) : 0)
        + Math.max(0, (adjustEntry.deductions_total || 0) - computeDeductions(adjustEntry.gross_pay || 0).total);

      const { error: uErr } = await supabase.from("payroll_entries").update({
        bonus_total: Math.round(newBonus * 100) / 100,
        gross_pay: Math.round(newGross * 100) / 100,
        deductions_total: Math.round(newTotalDed * 100) / 100,
        net_pay: Math.round((newGross - newTotalDed) * 100) / 100,
      }).eq("id", adjustEntry.id);
      if (uErr) throw uErr;
    },
    onSuccess: () => {
      toast.success("Ajustement enregistré");
      qc.invalidateQueries({ queryKey: ["hr-payroll-entries"] });
      qc.invalidateQueries({ queryKey: ["hr-payroll-adjustments"] });
      setAdjustOpen(false);
      setAdjustForm({ type: "bonus", amount: "", reason: "", notes: "" });
      setAdjustEntry(null);
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const notifyMut = useMutation({
    mutationFn: async () => {
      const eligible = entries.filter((e: any) => e.status === "approved" || e.status === "paid");
      let sent = 0;
      for (const e of eligible as any[]) {
        const { error } = await supabase.from("employee_notifications").insert({
          user_id: e.user_id,
          title: "Fiche de paie disponible",
          body: `Votre fiche de paie pour ${currentPeriod?.period_name || "la période en cours"} est disponible. Net: ${fmt(e.net_pay || 0)}`,
          notification_type: "payroll",
        });
        if (!error) sent++;
      }
      return sent;
    },
    onSuccess: (n) => toast.success(`${n} notification(s) envoyée(s)`),
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  // ─── Active employees (for "Add employee" dialog) ────────────────────────
  const { data: activeEmployees = [] } = useQuery({
    queryKey: ["hr-active-employees-for-payroll"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_records")
        .select("user_id, first_name, last_name, hourly_rate, base_salary, salary_type, job_title")
        .eq("status", "active")
        .not("user_id", "is", null)
        .order("first_name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const existingEntryUserIds = useMemo(
    () => new Set(entries.map((e: any) => e.user_id)),
    [entries],
  );
  const availableEmployees = useMemo(
    () => activeEmployees.filter((emp: any) => !existingEntryUserIds.has(emp.user_id)),
    [activeEmployees, existingEntryUserIds],
  );

  // ─── Add employee to current period (manual) ─────────────────────────────
  const addEmployeeMut = useMutation({
    mutationFn: async () => {
      if (!selectedPeriod) throw new Error("Aucune période");
      if (!addForm.user_id) throw new Error("Sélectionnez un employé");
      const hours = parseFloat(addForm.hours) || 0;
      const rate = parseFloat(addForm.rate) || 0;
      const commissions = parseFloat(addForm.commissions) || 0;
      const bonus = parseFloat(addForm.bonus) || 0;
      const manualDeductions = parseFloat(addForm.deductions) || 0;

      const baseSalary = hours * rate;
      const gross = baseSalary + commissions + bonus - manualDeductions;
      const ded = computeDeductions(Math.max(gross, 0));
      const totalDed = ded.total + manualDeductions;
      const net = gross - ded.total;

      const emp = activeEmployees.find((e: any) => e.user_id === addForm.user_id);
      const employeeName = emp ? `${emp.first_name} ${emp.last_name}` : null;

      const { error } = await supabase.from("payroll_entries").insert({
        pay_period_id: selectedPeriod,
        user_id: addForm.user_id,
        employee_name: employeeName,
        hours_worked: Math.round(hours * 100) / 100,
        hourly_rate: Math.round(rate * 100) / 100,
        base_salary: Math.round(baseSalary * 100) / 100,
        commission_total: Math.round(commissions * 100) / 100,
        bonus_total: Math.round(bonus * 100) / 100,
        deduction_total: Math.round(manualDeductions * 100) / 100,
        gross_pay: Math.round(gross * 100) / 100,
        federal_tax: Math.round(ded.fed * 100) / 100,
        provincial_tax: Math.round(ded.prov * 100) / 100,
        cpp_contributions: Math.round(ded.rpc * 100) / 100,
        ei_premiums: Math.round(ded.ae * 100) / 100,
        qpip_premiums: Math.round(ded.rqap * 100) / 100,
        deductions_total: Math.round(totalDed * 100) / 100,
        net_pay: Math.round(net * 100) / 100,
        notes: addForm.notes || null,
        status: "draft",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fiche ajoutée");
      qc.invalidateQueries({ queryKey: ["hr-payroll-entries"] });
      setAddOpen(false);
      setAddForm({ user_id: "", hours: "", rate: "", commissions: "", bonus: "", deductions: "", notes: "" });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  // Pre-fill rate + commissions when employee is selected in Add dialog
  const prefillAddFormForEmployee = async (userId: string) => {
    const emp = activeEmployees.find((e: any) => e.user_id === userId);
    const rate = emp?.hourly_rate ? String(emp.hourly_rate) : "";
    let commissionsTotal = 0;
    if (currentPeriod) {
      const { data: comms } = await supabase
        .from("unified_commissions" as any)
        .select("amount")
        .eq("employee_id", userId)
        .in("status", ["validated", "payable", "pending"])
        .gte("created_at", `${currentPeriod.start_date}T00:00:00Z`)
        .lte("created_at", `${currentPeriod.end_date}T23:59:59Z`);
      commissionsTotal = ((comms as any[]) ?? []).reduce((s, c) => s + Number(c.amount || 0), 0);
    }
    setAddForm(f => ({
      ...f,
      user_id: userId,
      rate: f.rate || rate,
      commissions: f.commissions || (commissionsTotal ? String(commissionsTotal.toFixed(2)) : ""),
    }));
  };

  // ─── Edit existing entry (full edit, recompute deductions) ───────────────
  const editEntryMut = useMutation({
    mutationFn: async () => {
      if (!editEntry) throw new Error("Aucune fiche");
      const hours = parseFloat(editForm.hours) || 0;
      const rate = parseFloat(editForm.rate) || 0;
      const commissions = parseFloat(editForm.commissions) || 0;
      const bonus = parseFloat(editForm.bonus) || 0;

      const baseSalary = hours * rate;
      const gross = baseSalary + commissions + bonus;
      const ded = computeDeductions(Math.max(gross, 0));
      const net = gross - ded.total;

      const { error } = await supabase.from("payroll_entries").update({
        hours_worked: Math.round(hours * 100) / 100,
        hourly_rate: Math.round(rate * 100) / 100,
        base_salary: Math.round(baseSalary * 100) / 100,
        commission_total: Math.round(commissions * 100) / 100,
        bonus_total: Math.round(bonus * 100) / 100,
        gross_pay: Math.round(gross * 100) / 100,
        federal_tax: Math.round(ded.fed * 100) / 100,
        provincial_tax: Math.round(ded.prov * 100) / 100,
        cpp_contributions: Math.round(ded.rpc * 100) / 100,
        ei_premiums: Math.round(ded.ae * 100) / 100,
        qpip_premiums: Math.round(ded.rqap * 100) / 100,
        deductions_total: Math.round(ded.total * 100) / 100,
        net_pay: Math.round(net * 100) / 100,
        notes: editForm.notes || null,
      } as any).eq("id", editEntry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fiche mise à jour");
      qc.invalidateQueries({ queryKey: ["hr-payroll-entries"] });
      setEditOpen(false);
      setEditEntry(null);
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const openEditDialog = (entry: any) => {
    setEditEntry(entry);
    setEditForm({
      hours: String(entry.hours_worked ?? ""),
      rate: String(entry.hourly_rate ?? entry._emp?.hourly_rate ?? ""),
      commissions: String(entry.commission_total ?? ""),
      bonus: String(entry.bonus_total ?? ""),
      notes: entry.notes ?? "",
    });
    setEditOpen(true);
  };

  // ─── PDF generation ──────────────────────────────────────────────────────
  const generatePayslipPDF = (entry: any) => {
    const periodName = currentPeriod?.period_name || "Période";
    const fullName = entry._name;
    const email = entry._emp?.work_email || "";
    const ded = computeDeductions(entry.gross_pay || 0);
    const html = `
<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8" /><title>Fiche de paie - ${fullName}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 40px; color: #1a1a1a; }
  .header { border-bottom: 3px solid #0066CC; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { color: #0066CC; margin: 0 0 4px; font-size: 24px; }
  .header p { margin: 0; color: #666; font-size: 12px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; font-size: 12px; }
  .info-grid div { padding: 8px; background: #f5f5f5; border-radius: 4px; }
  .info-grid strong { display: block; color: #0066CC; font-size: 10px; text-transform: uppercase; margin-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; }
  th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
  th { background: #0066CC; color: white; font-weight: 600; }
  .section-title { background: #f0f0f0; font-weight: bold; }
  .total-row { background: #f9f9f9; font-weight: bold; }
  .net-row { background: #0066CC; color: white; font-weight: bold; font-size: 15px; }
  @media print { body { padding: 20px; } }
</style></head><body>
  <div class="header"><h1>Nivra Telecom</h1><p>Fiche de paie — ${periodName}</p></div>
  <div class="info-grid">
    <div><strong>Employé</strong>${fullName}</div>
    <div><strong>Email</strong>${email}</div>
    <div><strong>Numéro de fiche</strong>${entry.payroll_number || "—"}</div>
    <div><strong>Période</strong>${periodName}</div>
  </div>
  <table>
    <thead><tr><th>Description</th><th style="text-align:right">Montant</th></tr></thead>
    <tbody>
      <tr class="section-title"><td colspan="2">Revenus</td></tr>
      <tr><td>Heures travaillées</td><td style="text-align:right">${entry.hours_worked || 0} h</td></tr>
      <tr><td>Salaire de base</td><td style="text-align:right">${fmt(entry.base_salary)}</td></tr>
      <tr><td>Commissions</td><td style="text-align:right">${fmt(entry.commission_total)}</td></tr>
      <tr><td>Bonus</td><td style="text-align:right">${fmt(entry.bonus_total)}</td></tr>
      <tr class="total-row"><td>Salaire brut</td><td style="text-align:right">${fmt(entry.gross_pay)}</td></tr>
      <tr class="section-title"><td colspan="2">Déductions estimées</td></tr>
      <tr><td>Impôt fédéral (15%)</td><td style="text-align:right">-${fmt(ded.fed)}</td></tr>
      <tr><td>Impôt provincial QC (12%)</td><td style="text-align:right">-${fmt(ded.prov)}</td></tr>
      <tr><td>RPC (5.95%)</td><td style="text-align:right">-${fmt(ded.rpc)}</td></tr>
      <tr><td>AE (1.34%)</td><td style="text-align:right">-${fmt(ded.ae)}</td></tr>
      <tr><td>RQAP (0.494%)</td><td style="text-align:right">-${fmt(ded.rqap)}</td></tr>
      <tr class="total-row"><td>Total déductions</td><td style="text-align:right">-${fmt(entry.deductions_total)}</td></tr>
      <tr class="net-row"><td>Salaire net</td><td style="text-align:right">${fmt(entry.net_pay)}</td></tr>
    </tbody>
  </table>
  <p style="font-size:10px;color:#888;text-align:center;margin-top:32px">Document généré le ${format(new Date(), "d MMMM yyyy 'à' HH:mm", { locale: fr })} — Nivra Telecom inc.</p>
  <script>window.onload = () => window.print();</script>
</body></html>`;
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return toast.error("Veuillez autoriser les fenêtres contextuelles");
    win.document.write(html);
    win.document.close();
  };

  const generateAllPDFs = () => {
    if (entries.length === 0) return toast.error("Aucune fiche");
    entries.forEach((e: any, i: number) => setTimeout(() => generatePayslipPDF(e), i * 500));
    toast.success(`${entries.length} fiche(s) en génération`);
  };

  // ─── CSV exports ────────────────────────────────────────────────────────
  const exportCSV = (entriesToExport: any[] = entries, periodName?: string) => {
    if (entriesToExport.length === 0) return toast.error("Aucune fiche à exporter");
    const cols = [["Numéro", "Employé", "Heures", "Base ($)", "Commission ($)", "Bonus ($)", "Brut ($)", "Déductions ($)", "Net ($)", "Statut"]];
    const rows = entriesToExport.map((e: any) => [
      e.payroll_number || "", e._name || e.user_id?.slice(0, 8),
      e.hours_worked, e.base_salary, e.commission_total, e.bonus_total,
      e.gross_pay, e.deductions_total, e.net_pay, e.status,
    ]);
    const csv = [...cols, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `paie_${(periodName || currentPeriod?.period_name || "export").replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exporté");
  };

  const exportHistoryPeriod = async (periodId: string, periodName: string) => {
    const { data } = await supabase.from("payroll_entries").select("*").eq("pay_period_id", periodId);
    if (!data) return;
    const userIds = [...new Set(data.map((e: any) => e.user_id))];
    const { data: emps } = await supabase.from("employee_records").select("user_id,first_name,last_name").in("user_id", userIds);
    const map = Object.fromEntries((emps || []).map((p: any) => [p.user_id, `${p.first_name} ${p.last_name}`]));
    exportCSV(data.map((e: any) => ({ ...e, _name: map[e.user_id] })), periodName);
  };

  // ─── Computed ───────────────────────────────────────────────────────────
  const filteredEntries = filterStatus === "all" ? entries : entries.filter((e: any) => e.status === filterStatus);
  const totalGross = entries.reduce((s: number, e: any) => s + (e.gross_pay || 0), 0);
  const totalNet = entries.reduce((s: number, e: any) => s + (e.net_pay || 0), 0);
  const adjustmentsByEntry = useMemo(() => {
    const m: Record<string, any[]> = {};
    adjustments.forEach((a: any) => {
      m[a.payroll_entry_id] = m[a.payroll_entry_id] || [];
      m[a.payroll_entry_id].push(a);
    });
    return m;
  }, [adjustments]);

  const periodStatus = currentPeriod ? PERIOD_STATUS[currentPeriod.status] || { label: currentPeriod.status, variant: "secondary" as const } : null;

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 max-w-7xl">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Paie — Administration
          </h1>
          <p className="text-xs text-muted-foreground">Périodes bi-mensuelles, fiches, ajustements, historique</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={autoGenerateMut.isPending}
            onClick={() => autoGenerateMut.mutate("first")} className="gap-1.5">
            <Wand2 className="h-3.5 w-3.5" />Générer paie 1-15
          </Button>
          <Button size="sm" variant="outline" disabled={autoGenerateMut.isPending}
            onClick={() => autoGenerateMut.mutate("fifteenth")} className="gap-1.5">
            <Wand2 className="h-3.5 w-3.5" />Générer paie 16-fin
          </Button>
        </div>
      </div>

      {/* SECTION 1 — Period header with prev/next nav */}
      {loadingPeriods ? (
        <Card><CardContent className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>
      ) : !currentPeriodExists ? (
        // Hero CTA — current half not yet generated
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{expectedLabel} non générée</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Aucune fiche de paie n'existe pour la période en cours. Cliquez ci-dessous pour la créer et générer automatiquement les fiches de tous les employés actifs.
              </p>
            </div>
            <Button size="lg" disabled={autoGenerateMut.isPending}
              onClick={() => autoGenerateMut.mutate(expectedHalf)} className="gap-2">
              {autoGenerateMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Générer maintenant
            </Button>
            {periods.length > 0 && currentPeriod && (
              <p className="text-[11px] text-muted-foreground">
                Vous pouvez consulter la période précédente ci-dessous : <button className="underline text-primary" onClick={() => { /* keep selectedPeriod */ }}>{currentPeriod.period_name}</button>
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Period header (shown when a period is selected) */}
      {!loadingPeriods && currentPeriod && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <Button size="sm" variant="outline" disabled={periodIndex >= periods.length - 1}
                onClick={() => setSelectedPeriod(periods[periodIndex + 1]?.id)}>
                <ChevronLeft className="h-4 w-4" />Précédente
              </Button>
              <div className="flex-1 text-center">
                <div className="flex items-center justify-center gap-3 mb-1">
                  <Calendar className="h-5 w-5 text-primary" />
                  <h2 className="text-lg font-bold">{currentPeriod.period_name}</h2>
                  {periodStatus && <Badge variant={periodStatus.variant}>{periodStatus.label}</Badge>}
                  {isLocked && <Lock className="h-4 w-4 text-destructive" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(currentPeriod.start_date), "d MMM yyyy", { locale: fr })} — {format(new Date(currentPeriod.end_date), "d MMM yyyy", { locale: fr })}
                </p>
              </div>
              <Button size="sm" variant="outline" disabled={periodIndex <= 0}
                onClick={() => setSelectedPeriod(periods[periodIndex - 1]?.id)}>
                Suivante<ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {/* Period KPIs */}
            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t">
              <div className="text-center">
                <Users className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-[10px] text-muted-foreground">Employés</p>
                <p className="text-lg font-bold">{entries.length}</p>
              </div>
              <div className="text-center">
                <TrendingUp className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-[10px] text-muted-foreground">Total brut</p>
                <p className="text-lg font-bold text-primary">{fmt(totalGross)}</p>
              </div>
              <div className="text-center">
                <Receipt className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                <p className="text-[10px] text-muted-foreground">Total net estimé</p>
                <p className="text-lg font-bold text-green-600">{fmt(totalNet)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TABS — payroll | adjustments | history */}
      {currentPeriod && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="payroll" className="text-xs">Fiches de paie</TabsTrigger>
            <TabsTrigger value="adjustments" className="text-xs">Ajustements ({adjustments.length})</TabsTrigger>
            <TabsTrigger value="history" className="text-xs">Historique</TabsTrigger>
          </TabsList>

          {/* TAB 1 — Payroll table + bulk actions */}
          <TabsContent value="payroll" className="space-y-3">
            {/* SECTION 3 — Bulk actions */}
            <Card>
              <CardContent className="p-3 flex flex-wrap gap-2 items-center justify-between">
                <div className="flex gap-2 items-center">
                  <Label className="text-xs">Filtre:</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="draft">Brouillon</SelectItem>
                      <SelectItem value="approved">Approuvée</SelectItem>
                      <SelectItem value="paid">Payée</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="default" disabled={isLocked || availableEmployees.length === 0}
                    onClick={() => setAddOpen(true)} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" />Ajouter un employé
                  </Button>
                  <Button size="sm" variant="outline" disabled={isLocked || approveAllMut.isPending}
                    onClick={() => approveAllMut.mutate()} className="gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5" />Approuver tous
                  </Button>
                  <Button size="sm" variant="default" disabled={isLocked || markAllPaidMut.isPending}
                    onClick={() => {
                      if (confirm("Marquer toutes les fiches approuvées comme payées ?")) markAllPaidMut.mutate();
                    }} className="gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" />Marquer tous payés
                  </Button>
                  <Button size="sm" variant="outline" onClick={generateAllPDFs} className="gap-1.5">
                    <FileText className="h-3.5 w-3.5" />Générer toutes les fiches
                  </Button>
                  <Button size="sm" variant="outline" disabled={notifyMut.isPending}
                    onClick={() => notifyMut.mutate()} className="gap-1.5">
                    <Send className="h-3.5 w-3.5" />Envoyer aux employés
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => exportCSV()} className="gap-1.5">
                    <Download className="h-3.5 w-3.5" />Export CSV
                  </Button>
                  <Button size="sm" variant="destructive" disabled={isLocked || finalizePeriodMut.isPending}
                    onClick={() => {
                      if (confirm("Finaliser la période ? Aucune modification ne sera permise après.")) finalizePeriodMut.mutate();
                    }} className="gap-1.5">
                    <Lock className="h-3.5 w-3.5" />Finaliser la période
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* SECTION 2 — Employee payroll table */}
            <Card>
              <CardContent className="p-0">
                {loadingEntries ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : filteredEntries.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">Aucune fiche pour ce filtre.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Employé</TableHead>
                        <TableHead className="text-[10px]">Heures</TableHead>
                        <TableHead className="text-[10px]">Taux</TableHead>
                        <TableHead className="text-[10px]">Base</TableHead>
                        <TableHead className="text-[10px]">Commission</TableHead>
                        <TableHead className="text-[10px]">Bonus</TableHead>
                        <TableHead className="text-[10px]">Brut</TableHead>
                        <TableHead className="text-[10px]">Déductions</TableHead>
                        <TableHead className="text-[10px]">Net estimé</TableHead>
                        <TableHead className="text-[10px]">Statut</TableHead>
                        <TableHead className="text-[10px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries.map((e: any) => {
                        const st = ENTRY_STATUS[e.status] || { label: e.status, variant: "secondary" as const };
                        const ded = computeDeductions(e.gross_pay || 0);
                        return (
                          <TableRow key={e.id}>
                            <TableCell className="text-xs">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-semibold shrink-0">
                                  {(e._emp?.first_name?.[0] || e._name?.[0] || "?").toUpperCase()}{(e._emp?.last_name?.[0] || "").toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-medium truncate">{e._name}</div>
                                  {e._emp?.job_title && (
                                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 mt-0.5">{e._emp.job_title}</Badge>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">{e.hours_worked}h</TableCell>
                            <TableCell className="text-xs">{e._emp?.hourly_rate ? `${e._emp.hourly_rate}$/h` : "—"}</TableCell>
                            <TableCell className="text-xs">{fmt(e.base_salary)}</TableCell>
                            <TableCell className="text-xs">{fmt(e.commission_total)}</TableCell>
                            <TableCell className="text-xs">{fmt(e.bonus_total)}</TableCell>
                            <TableCell className="text-xs font-medium">{fmt(e.gross_pay)}</TableCell>
                            <TableCell className="text-[10px] text-destructive" title={`Féd: ${fmt(ded.fed)} | Prov: ${fmt(ded.prov)} | RPC: ${fmt(ded.rpc)} | AE: ${fmt(ded.ae)} | RQAP: ${fmt(ded.rqap)}`}>
                              -{fmt(e.deductions_total)}
                            </TableCell>
                            <TableCell className="text-xs font-bold text-green-600">{fmt(e.net_pay)}</TableCell>
                            <TableCell><Badge variant={st.variant} className="text-[10px]">{st.label}</Badge></TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="sm" variant="default" className="h-6 text-[10px] gap-1"
                                  disabled={isLocked}
                                  onClick={() => openEditDialog(e)}>
                                  <Edit className="h-3 w-3" />Éditer
                                </Button>
                                <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1"
                                  disabled={isLocked}
                                  onClick={() => { setAdjustEntry(e); setAdjustOpen(true); }}>
                                  <Plus className="h-3 w-3" />Ajustement
                                </Button>
                                <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1"
                                  onClick={() => generatePayslipPDF(e)}>
                                  <FileText className="h-3 w-3" />PDF
                                </Button>
                                {(e.status === "draft" || e.status === "pending_approval") && (
                                  <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1"
                                    disabled={isLocked || approveMut.isPending}
                                    onClick={() => approveMut.mutate(e.id)}>
                                    <CheckCircle className="h-3 w-3" />Approuver
                                  </Button>
                                )}
                                {e.status === "approved" && (
                                  <Button size="sm" variant="default" className="h-6 text-[10px] gap-1"
                                    disabled={isLocked || markPaidMut.isPending}
                                    onClick={() => markPaidMut.mutate(e.id)}>
                                    <DollarSign className="h-3 w-3" />Payé
                                  </Button>
                                )}
                              </div>
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

          {/* TAB 2 — Adjustments */}
          <TabsContent value="adjustments">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">Ajustements de la période</CardTitle>
              </CardHeader>
              <CardContent>
                {adjustments.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">Aucun ajustement enregistré.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Employé</TableHead>
                        <TableHead className="text-[10px]">Type</TableHead>
                        <TableHead className="text-[10px]">Montant</TableHead>
                        <TableHead className="text-[10px]">Raison</TableHead>
                        <TableHead className="text-[10px]">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adjustments.map((a: any) => {
                        const entry = entries.find((e: any) => e.id === a.payroll_entry_id);
                        return (
                          <TableRow key={a.id}>
                            <TableCell className="text-xs">{entry?._name || "—"}</TableCell>
                            <TableCell><Badge variant={a.adjustment_type === "bonus" ? "default" : "destructive"} className="text-[10px]">{a.adjustment_type}</Badge></TableCell>
                            <TableCell className={`text-xs font-medium ${a.amount < 0 ? "text-destructive" : "text-green-600"}`}>{fmt(a.amount)}</TableCell>
                            <TableCell className="text-xs">{a.label}</TableCell>
                            <TableCell className="text-[10px] text-muted-foreground">{format(new Date(a.created_at), "d MMM yyyy HH:mm", { locale: fr })}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3 — History */}
          <TabsContent value="history">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Historique des paies</CardTitle></CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">Aucun historique.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Période</TableHead>
                        <TableHead className="text-[10px]">Employés</TableHead>
                        <TableHead className="text-[10px]">Total brut</TableHead>
                        <TableHead className="text-[10px]">Total net</TableHead>
                        <TableHead className="text-[10px]">Statut</TableHead>
                        <TableHead className="text-[10px]">Finalisée le</TableHead>
                        <TableHead className="text-[10px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((h: any) => {
                        const st = PERIOD_STATUS[h.status] || { label: h.status, variant: "secondary" as const };
                        return (
                          <TableRow key={h.id} className="cursor-pointer hover:bg-muted/30" onClick={() => { setSelectedPeriod(h.id); setActiveTab("payroll"); }}>
                            <TableCell className="text-xs font-medium">{h.period_name}</TableCell>
                            <TableCell className="text-xs">{h._employees}</TableCell>
                            <TableCell className="text-xs">{fmt(h._totalGross)}</TableCell>
                            <TableCell className="text-xs font-bold text-green-600">{fmt(h._totalNet)}</TableCell>
                            <TableCell><Badge variant={st.variant} className="text-[10px]">{st.label}</Badge></TableCell>
                            <TableCell className="text-[10px] text-muted-foreground">{h.closed_at ? format(new Date(h.closed_at), "d MMM yyyy", { locale: fr }) : "—"}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1"
                                onClick={(ev) => { ev.stopPropagation(); exportHistoryPeriod(h.id, h.period_name); }}>
                                <Download className="h-3 w-3" />CSV
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
        </Tabs>
      )}

      {/* Adjustment Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajustement — {adjustEntry?._name}</DialogTitle>
            <DialogDescription>Bonus ou déduction manuelle pour cette fiche</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={adjustForm.type} onValueChange={(v) => setAdjustForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bonus">Bonus (+)</SelectItem>
                  <SelectItem value="deduction">Déduction (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Montant ($)</Label>
              <Input type="number" step="0.01" value={adjustForm.amount}
                onChange={(e) => setAdjustForm(f => ({ ...f, amount: e.target.value }))} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Raison</Label>
              <Input value={adjustForm.reason}
                onChange={(e) => setAdjustForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Bonus performance, retenue avance..." className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes (optionnel)</Label>
              <Textarea value={adjustForm.notes}
                onChange={(e) => setAdjustForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} className="text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setAdjustOpen(false)}>Annuler</Button>
            <Button size="sm" disabled={!adjustForm.amount || adjustMut.isPending}
              onClick={() => adjustMut.mutate()}>
              {adjustMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add employee dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un employé à la période</DialogTitle>
            <DialogDescription>{currentPeriod?.period_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Employé</Label>
              <Select value={addForm.user_id} onValueChange={prefillAddFormForEmployee}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {availableEmployees.length === 0 ? (
                    <SelectItem value="none" disabled>Tous les employés actifs sont déjà dans la période</SelectItem>
                  ) : availableEmployees.map((emp: any) => (
                    <SelectItem key={emp.user_id} value={emp.user_id}>
                      {emp.first_name} {emp.last_name} {emp.job_title ? `— ${emp.job_title}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Heures travaillées</Label>
                <Input type="number" step="0.01" value={addForm.hours}
                  onChange={(e) => setAddForm(f => ({ ...f, hours: e.target.value }))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Taux horaire ($)</Label>
                <Input type="number" step="0.01" value={addForm.rate}
                  onChange={(e) => setAddForm(f => ({ ...f, rate: e.target.value }))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Commissions ($)</Label>
                <Input type="number" step="0.01" value={addForm.commissions}
                  onChange={(e) => setAddForm(f => ({ ...f, commissions: e.target.value }))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Bonus ($)</Label>
                <Input type="number" step="0.01" value={addForm.bonus}
                  onChange={(e) => setAddForm(f => ({ ...f, bonus: e.target.value }))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Déductions manuelles ($)</Label>
                <Input type="number" step="0.01" value={addForm.deductions}
                  onChange={(e) => setAddForm(f => ({ ...f, deductions: e.target.value }))} className="h-8 text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes (optionnel)</Label>
              <Textarea value={addForm.notes}
                onChange={(e) => setAddForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setAddOpen(false)}>Annuler</Button>
            <Button size="sm" disabled={!addForm.user_id || addEmployeeMut.isPending}
              onClick={() => addEmployeeMut.mutate()}>
              {addEmployeeMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Ajouter la fiche"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit entry dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Éditer la fiche — {editEntry?._name}</DialogTitle>
            <DialogDescription>Recalcule automatiquement les déductions et le net</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Heures travaillées</Label>
                <Input type="number" step="0.01" value={editForm.hours}
                  onChange={(e) => setEditForm(f => ({ ...f, hours: e.target.value }))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Taux horaire ($)</Label>
                <Input type="number" step="0.01" value={editForm.rate}
                  onChange={(e) => setEditForm(f => ({ ...f, rate: e.target.value }))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Commissions ($)</Label>
                <Input type="number" step="0.01" value={editForm.commissions}
                  onChange={(e) => setEditForm(f => ({ ...f, commissions: e.target.value }))} className="h-8 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Bonus ($)</Label>
                <Input type="number" step="0.01" value={editForm.bonus}
                  onChange={(e) => setEditForm(f => ({ ...f, bonus: e.target.value }))} className="h-8 text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes (optionnel)</Label>
              <Textarea value={editForm.notes}
                onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button size="sm" disabled={editEntryMut.isPending}
              onClick={() => editEntryMut.mutate()}>
              {editEntryMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
