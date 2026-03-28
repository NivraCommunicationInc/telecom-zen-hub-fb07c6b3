/**
 * CoreFieldAgentsPage — Enterprise-grade HR/Commission/Payroll management for Nivra Core.
 * 10 Tabs: Agents, Commissions, Commission Grids, Grid Assignments, Withdrawals, Disputes, Payroll, Time Tracking, Schedules, Tax Documents
 */
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Users, DollarSign, TrendingUp, Loader2, Search, Check, X, AlertTriangle,
  Clock, Banknote, BarChart3, UserCheck, UserX, Edit3, Eye, FileText,
  ChevronRight, ArrowLeft, Phone, Mail, Calendar, Shield, Save,
  MessageSquare, Download, CreditCard, Receipt, Plus, Trash2,
  Timer, ClipboardList, Grid3X3, Link2, Briefcase, Zap, FileSpreadsheet,
  ChevronLeft,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import FilterBar, { defaultFilters, applyFilters, type FilterConfig } from "@/core-app/components/field-agents/FilterBar";
import { downloadCSV, COMMISSION_COLUMNS, PAYROLL_COLUMNS, TIME_COLUMNS, WITHDRAWAL_COLUMNS } from "@/core-app/components/field-agents/ExportUtils";
import DeleteConfirmDialog from "@/core-app/components/field-agents/DeleteConfirmDialog";
import PayrollDetailDialog from "@/core-app/components/field-agents/PayrollDetailDialog";
import WithdrawalTimeline from "@/core-app/components/field-agents/WithdrawalTimeline";

type TabView = "agents" | "commissions" | "grids" | "assignments" | "withdrawals" | "disputes" | "payroll" | "time" | "schedules" | "tax_docs";

interface AgentRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  total_sales: number;
  total_commission: number;
  pending_commission: number;
  approved_commission: number;
  paid_commission: number;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "En attente", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800" },
  pending_activation: { label: "Att. activation", cls: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800" },
  validated: { label: "Validée", cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800" },
  approved: { label: "Approuvé", cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800" },
  paid: { label: "Payé", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800" },
  rejected: { label: "Rejeté", cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800" },
  clawback: { label: "Récupéré", cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800" },
  disputed: { label: "Contesté", cls: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800" },
  open: { label: "Ouvert", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800" },
  under_review: { label: "En révision", cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800" },
  accepted: { label: "Accepté", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800" },
  closed: { label: "Fermé", cls: "bg-muted text-muted-foreground border-border" },
  cancelled: { label: "Annulé", cls: "bg-muted text-muted-foreground border-border" },
  draft: { label: "Brouillon", cls: "bg-muted text-muted-foreground border-border" },
  processing: { label: "En traitement", cls: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800" },
  generated: { label: "Généré", cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800" },
  sent: { label: "Envoyé", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800" },
  acknowledged: { label: "Reçu", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800" },
};

const fmtMoney = (n: number) => `${n.toFixed(2)} $`;
const RULE_TYPES: Record<string, string> = { base_rate: "Taux de base", volume_bonus: "Bonus volume", service_bonus: "Bonus service", territory_bonus: "Bonus territoire" };
const ADJ_TYPES: Record<string, string> = { deduction: "Retenue", bonus: "Bonus", correction: "Correction", clawback: "Récupération", tax_withholding: "Impôt retenu", other: "Autre" };
const DOC_TYPES: Record<string, string> = { t4: "T4", rl1: "Relevé 1", releve1: "Relevé 1", summary: "Sommaire", other: "Autre" };
const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export default function CoreFieldAgentsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabView>("agents");
  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState<AgentRow | null>(null);

  // Dialogs
  const [editAgent, setEditAgent] = useState<AgentRow | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", email: "", phone: "" });
  const [gridDialog, setGridDialog] = useState(false);
  const [editGridId, setEditGridId] = useState<string | null>(null);
  const [gridForm, setGridForm] = useState({ rule_name: "", rule_type: "base_rate", service_type: "", min_sales: "0", max_sales: "", bonus_amount: "0", bonus_percentage: "0" });
  const [assignDialog, setAssignDialog] = useState(false);
  const [assignForm, setAssignForm] = useState({ user_id: "", rule_id: "", notes: "" });
  const [payPeriodDialog, setPayPeriodDialog] = useState(false);
  const [ppForm, setPpForm] = useState({ period_name: "", start_date: "", end_date: "" });
  const [payrollEntryDialog, setPayrollEntryDialog] = useState(false);
  const [peForm, setPeForm] = useState({ pay_period_id: "", user_id: "", base_salary: "0", commission_total: "0", bonus_total: "0", hours_worked: "0", overtime_hours: "0", deductions_total: "0", notes: "" });
  const [adjustDialog, setAdjustDialog] = useState(false);
  const [adjForm, setAdjForm] = useState({ payroll_entry_id: "", adjustment_type: "deduction", label: "", amount: "0", notes: "" });
  const [scheduleDialog, setScheduleDialog] = useState(false);
  const [schForm, setSchForm] = useState({ user_id: "", day_of_week: "1", start_time: "09:00", end_time: "17:00", notes: "" });
  const [disputeResolution, setDisputeResolution] = useState<{ id: string; action: string } | null>(null);
  const [disputeNote, setDisputeNote] = useState("");
  const [withdrawalDetail, setWithdrawalDetail] = useState<any>(null);
  const [withdrawalAdminNote, setWithdrawalAdminNote] = useState("");
  const [rejectCommDialog, setRejectCommDialog] = useState<string | null>(null);
  const [rejectCommReason, setRejectCommReason] = useState("");
  const [taxDocDialog, setTaxDocDialog] = useState(false);
  const [taxDocForm, setTaxDocForm] = useState({ user_id: "", document_type: "t4", tax_year: String(new Date().getFullYear() - 1), notes: "", data_json: "{}" });

  // Filter states per tab
  const [commFilters, setCommFilters] = useState(defaultFilters);
  const [payrollFilters, setPayrollFilters] = useState(defaultFilters);
  const [timeFilters, setTimeFilters] = useState(defaultFilters);
  const [withdrawalFilters, setWithdrawalFilters] = useState(defaultFilters);

  // Pagination
  const PAGE_SIZE = 25;
  const [commPage, setCommPage] = useState(1);
  const [payrollPage, setPayrollPage] = useState(1);
  const [timePage, setTimePage] = useState(1);
  const [withdrawalPage, setWithdrawalPage] = useState(1);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string } | null>(null);

  // Payroll detail dialog
  const [payrollDetail, setPayrollDetail] = useState<any>(null);

  // Edit schedule
  const [editScheduleId, setEditScheduleId] = useState<string | null>(null);

  // Edit assignment
  const [editAssignId, setEditAssignId] = useState<string | null>(null);
  const [editAssignForm, setEditAssignForm] = useState({ notes: "", is_active: true });

  const invalidateAll = () => { qc.invalidateQueries({ queryKey: ["core-field"] }); };
  const { data: agents = [], isLoading: loadingAgents } = useQuery({
    queryKey: ["core-field", "agents"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, is_active, created_at, permissions").eq("role", "field_sales" as any);
      if (!roles?.length) return [];
      const userIds = roles.map((r: any) => r.user_id);
      const [{ data: profiles }, { data: salesOrders }, { data: commissions }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, email, phone").in("user_id", userIds),
        supabase.from("field_sales_orders").select("salesperson_id, total_amount").in("salesperson_id", userIds),
        supabase.from("sales_commissions").select("salesperson_id, commission_amount, status").in("salesperson_id", userIds),
      ]);
      const pm = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const sm = new Map<string, number>();
      const cm = new Map<string, { total: number; pending: number; approved: number; paid: number }>();
      for (const s of salesOrders || []) sm.set(s.salesperson_id, (sm.get(s.salesperson_id) || 0) + 1);
      for (const c of commissions || []) {
        const e = cm.get(c.salesperson_id) || { total: 0, pending: 0, approved: 0, paid: 0 };
        e.total += Number(c.commission_amount);
        if (c.status === "pending" || c.status === "pending_activation") e.pending += Number(c.commission_amount);
        if (c.status === "approved" || c.status === "validated") e.approved += Number(c.commission_amount);
        if (c.status === "paid") e.paid += Number(c.commission_amount);
        cm.set(c.salesperson_id, e);
      }
      return roles.map((r: any): AgentRow => {
        const p = pm.get(r.user_id) as any;
        const c = cm.get(r.user_id) || { total: 0, pending: 0, approved: 0, paid: 0 };
        return { user_id: r.user_id, full_name: p?.full_name, email: p?.email, phone: p?.phone, is_active: r.is_active !== false, created_at: r.created_at, total_sales: sm.get(r.user_id) || 0, total_commission: c.total, pending_commission: c.pending, approved_commission: c.approved, paid_commission: c.paid };
      });
    },
  });

  const { data: allCommissions = [] } = useQuery({
    queryKey: ["core-field", "commissions"],
    queryFn: async () => {
      const { data } = await supabase.from("sales_commissions").select("*, field_sales_orders!sales_commissions_field_order_id_fkey(customer_name, customer_email)").order("created_at", { ascending: false }).limit(200);
      return data || [];
    },
    enabled: tab === "commissions" || !!selectedAgent,
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["core-field", "rules"],
    queryFn: async () => { const { data } = await supabase.from("field_sales_commission_rules").select("*").order("min_sales"); return data || []; },
    enabled: tab === "grids" || tab === "assignments" || !!selectedAgent,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["core-field", "assignments"],
    queryFn: async () => { const { data } = await supabase.from("commission_grid_assignments").select("*").order("created_at", { ascending: false }); return data || []; },
    enabled: tab === "assignments" || !!selectedAgent,
  });

  const { data: withdrawals = [] } = useQuery({
    queryKey: ["core-field", "withdrawals"],
    queryFn: async () => { const { data } = await supabase.from("commission_withdrawal_requests").select("*").order("created_at", { ascending: false }).limit(200); return data || []; },
    enabled: tab === "withdrawals",
  });

  const { data: disputes = [] } = useQuery({
    queryKey: ["core-field", "disputes"],
    queryFn: async () => { const { data } = await supabase.from("commission_disputes").select("*, sales_commissions(commission_amount, sale_amount, status)").order("created_at", { ascending: false }).limit(200); return data || []; },
    enabled: tab === "disputes",
  });

  const { data: payPeriods = [] } = useQuery({
    queryKey: ["core-field", "pay-periods"],
    queryFn: async () => { const { data } = await supabase.from("pay_periods").select("*").order("start_date", { ascending: false }); return data || []; },
    enabled: tab === "payroll",
  });

  const { data: payrollEntries = [] } = useQuery({
    queryKey: ["core-field", "payroll-entries"],
    queryFn: async () => { const { data } = await supabase.from("payroll_entries").select("*, pay_periods(period_name, start_date, end_date), payroll_adjustments(*)").order("created_at", { ascending: false }).limit(200); return data || []; },
    enabled: tab === "payroll",
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["core-field", "time-entries"],
    queryFn: async () => { const { data } = await supabase.from("time_entries").select("*").order("punch_in", { ascending: false }).limit(200); return data || []; },
    enabled: tab === "time",
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ["core-field", "schedules"],
    queryFn: async () => { const { data } = await supabase.from("staff_schedules").select("*").order("user_id").order("day_of_week"); return data || []; },
    enabled: tab === "schedules",
  });

  const { data: taxDocs = [] } = useQuery({
    queryKey: ["core-field", "tax-docs"],
    queryFn: async () => { const { data } = await supabase.from("tax_documents").select("*").order("tax_year", { ascending: false }).order("created_at", { ascending: false }).limit(200); return data || []; },
    enabled: tab === "tax_docs",
  });

  // ═══ HELPERS ═══
  const logAudit = async (action: string, entityType: string, entityId: string, extra?: { field_changed?: string; old_value?: string; new_value?: string; details?: any }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).single();
    await supabase.from("hr_audit_log").insert({
      actor_user_id: user.id,
      actor_name: (profile as any)?.full_name || user.email,
      actor_role: "admin",
      action,
      entity_type: entityType,
      entity_id: entityId,
      ...(extra || {}),
    } as any);
  };

  const notifyEmployee = async (userId: string, notificationType: string, title: string, message: string) => {
    await supabase.from("staff_notifications").insert({
      user_id: userId,
      notification_type: notificationType,
      title,
      message,
    } as any);
  };

  // ═══ MUTATIONS ═══
  const approveCommission = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sales_commissions").update({ status: "validated", validated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      const comm = allCommissions.find((c: any) => c.id === id);
      if (comm) {
        await notifyEmployee(comm.salesperson_id, "commission_approved", "Commission approuvée", `Votre commission de ${fmtMoney(Number(comm.commission_amount))} a été approuvée.`);
        await logAudit("approve_commission", "sales_commissions", id, { field_changed: "status", old_value: "pending", new_value: "validated" });
      }
    },
    onSuccess: () => { invalidateAll(); toast.success("Commission approuvée"); },
  });
  const rejectCommission = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => { const { error } = await supabase.from("sales_commissions").update({ status: "rejected" as any, rejection_reason: reason }).eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidateAll(); toast.success("Commission rejetée"); },
  });
  const markCommissionPaid = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("sales_commissions").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidateAll(); toast.success("Commission marquée payée"); },
  });
  const toggleAgentStatus = useMutation({
    mutationFn: async ({ userId, activate }: { userId: string; activate: boolean }) => { const { error } = await supabase.from("user_roles").update({ is_active: activate }).eq("user_id", userId).eq("role", "field_sales" as any); if (error) throw error; },
    onSuccess: () => { invalidateAll(); toast.success("Statut mis à jour"); },
  });
  const saveAgentProfile = useMutation({
    mutationFn: async () => {
      if (!editAgent) return;
      const { data, error } = await supabase.functions.invoke("admin-manage-staff", {
        body: { action: "update_profile", user_id: editAgent.user_id, full_name: editForm.full_name.trim() || undefined, email: editForm.email.trim() || undefined, phone: editForm.phone.trim() || undefined },
      });
      if (error) throw error;
      const r = typeof data === "string" ? JSON.parse(data) : data;
      if (!r?.ok && !r?.success) throw new Error(r?.error?.message || r?.message || "Échec");
    },
    onSuccess: () => { invalidateAll(); setEditAgent(null); toast.success("Profil sauvegardé"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  // Commission Grid CRUD + EDIT
  const saveGrid = useMutation({
    mutationFn: async () => {
      const payload = {
        rule_name: gridForm.rule_name, rule_type: gridForm.rule_type as any,
        service_type: gridForm.service_type || null, min_sales: parseInt(gridForm.min_sales) || 0,
        max_sales: gridForm.max_sales ? parseInt(gridForm.max_sales) : null,
        bonus_amount: parseFloat(gridForm.bonus_amount) || 0, bonus_percentage: parseFloat(gridForm.bonus_percentage) || 0,
      };
      if (editGridId) {
        const { error } = await supabase.from("field_sales_commission_rules").update(payload).eq("id", editGridId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("field_sales_commission_rules").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidateAll(); setGridDialog(false); setEditGridId(null); toast.success(editGridId ? "Grille modifiée" : "Grille créée"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });
  const deleteGrid = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("field_sales_commission_rules").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidateAll(); toast.success("Grille supprimée"); },
  });
  const toggleGridActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => { const { error } = await supabase.from("field_sales_commission_rules").update({ is_active: active }).eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidateAll(); toast.success("Statut grille mis à jour"); },
  });

  // Grid Assignment
  const createAssignment = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("commission_grid_assignments").insert({
        user_id: assignForm.user_id, rule_id: assignForm.rule_id, notes: assignForm.notes || null, assigned_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setAssignDialog(false); toast.success("Grille assignée"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });
  const removeAssignment = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("commission_grid_assignments").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidateAll(); setDeleteConfirm(null); toast.success("Assignation retirée"); },
  });
  const updateAssignment = useMutation({
    mutationFn: async () => {
      if (!editAssignId) return;
      const { error } = await supabase.from("commission_grid_assignments").update({ notes: editAssignForm.notes || null, is_active: editAssignForm.is_active }).eq("id", editAssignId);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setEditAssignId(null); toast.success("Assignation modifiée"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  // Withdrawals — enhanced
  const updateWithdrawal = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const u: any = { status, reviewed_at: new Date().toISOString(), reviewed_by: user?.id };
      if (note) u.admin_notes = note;
      if (status === "paid") u.paid_at = new Date().toISOString();
      const { error } = await supabase.from("commission_withdrawal_requests").update(u).eq("id", id);
      if (error) throw error;
      // Notification
      const w = withdrawals.find((w: any) => w.id === id);
      if (w) {
        const msg = status === "approved" ? `Votre retrait de ${fmtMoney(Number(w.amount))} a été approuvé.`
          : status === "paid" ? `Votre retrait de ${fmtMoney(Number(w.amount))} a été payé.`
          : status === "rejected" ? `Votre retrait de ${fmtMoney(Number(w.amount))} a été rejeté.${note ? ` Raison: ${note}` : ""}`
          : `Votre retrait a été mis à jour: ${status}`;
        await notifyEmployee(w.influencer_id || w.user_id, "withdrawal_update", `Retrait ${status}`, msg);
        await logAudit(`withdrawal_${status}`, "commission_withdrawal_requests", id, { field_changed: "status", old_value: w.status, new_value: status });
      }
    },
    onSuccess: () => { invalidateAll(); setWithdrawalDetail(null); setWithdrawalAdminNote(""); toast.success("Retrait mis à jour"); },
  });

  // Disputes
  const resolveDispute = useMutation({
    mutationFn: async ({ id, action, note }: { id: string; action: string; note: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("commission_disputes").update({
        status: action, admin_response: note, resolved_at: new Date().toISOString(), resolved_by: user?.id,
      }).eq("id", id);
      if (error) throw error;
      await logAudit(`dispute_${action}`, "commission_disputes", id, { new_value: action, details: { note } });
    },
    onSuccess: () => { invalidateAll(); setDisputeResolution(null); setDisputeNote(""); toast.success("Contestation traitée"); },
  });

  // Pay Periods
  const createPayPeriod = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pay_periods").insert({ period_name: ppForm.period_name, start_date: ppForm.start_date, end_date: ppForm.end_date });
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setPayPeriodDialog(false); toast.success("Période de paie créée"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });
  const closePayPeriod = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("pay_periods").update({ status: "closed", closed_by: user?.id, closed_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Période fermée"); },
  });
  const markPeriodPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pay_periods").update({ status: "paid" }).eq("id", id);
      if (error) throw error;
      // Notify all employees with payroll entries in this period
      const entries = payrollEntries.filter((pe: any) => pe.pay_period_id === id);
      for (const pe of entries) {
        await supabase.from("staff_notifications").insert({ notification_type: "payroll_ready", title: "Paie disponible", message: `Votre fiche de paie est prête. Net: ${fmtMoney(Number(pe.net_pay))}` } as any);
      }
    },
    onSuccess: () => { invalidateAll(); toast.success("Période marquée payée"); },
  });

  // Payroll Entries
  const createPayrollEntry = useMutation({
    mutationFn: async () => {
      const gross = parseFloat(peForm.base_salary) + parseFloat(peForm.commission_total) + parseFloat(peForm.bonus_total);
      const net = gross - parseFloat(peForm.deductions_total);
      const { error } = await supabase.from("payroll_entries").insert({
        pay_period_id: peForm.pay_period_id, user_id: peForm.user_id,
        base_salary: parseFloat(peForm.base_salary), commission_total: parseFloat(peForm.commission_total),
        bonus_total: parseFloat(peForm.bonus_total), hours_worked: parseFloat(peForm.hours_worked),
        overtime_hours: parseFloat(peForm.overtime_hours), deductions_total: parseFloat(peForm.deductions_total),
        gross_pay: gross, net_pay: net, notes: peForm.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setPayrollEntryDialog(false); toast.success("Entrée de paie créée"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });
  const approvePayroll = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("payroll_entries").update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Paie approuvée"); },
  });
  const markPayrollPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("payroll_entries").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      // Auto-generate PDF
      try {
        await supabase.functions.invoke("generate-payslip-pdf", { body: { payroll_entry_id: id } });
      } catch (e) { console.error("PDF auto-gen failed:", e); }
      // Notify employee
      const entry = payrollEntries.find((pe: any) => pe.id === id);
      if (entry) {
        await supabase.from("staff_notifications").insert({ notification_type: "payroll_paid", title: "Paie versée", message: `Votre paie de ${fmtMoney(Number(entry.net_pay))} a été versée. Le PDF est disponible dans votre portail.` } as any);
      }
    },
    onSuccess: () => { invalidateAll(); toast.success("Paie marquée payée + PDF généré + employé notifié"); },
  });

  // Auto-aggregate payroll for a period
  const autoAggregate = useMutation({
    mutationFn: async (periodId: string) => {
      const period = payPeriods.find((p: any) => p.id === periodId);
      if (!period) throw new Error("Période introuvable");
      const { data: { user } } = await supabase.auth.getUser();

      // Get all field_sales agents
      const agentIds = agents.map(a => a.user_id);
      if (!agentIds.length) throw new Error("Aucun agent trouvé");

      // Fetch approved commissions in period range
      const { data: periodCommissions } = await supabase.from("sales_commissions")
        .select("salesperson_id, commission_amount, bonus_amount")
        .in("salesperson_id", agentIds)
        .gte("created_at", period.start_date)
        .lte("created_at", period.end_date + "T23:59:59Z")
        .in("status", ["validated", "approved", "paid"]);

      // Fetch approved time entries in period range
      const { data: periodTime } = await supabase.from("time_entries")
        .select("user_id, total_hours, entry_type")
        .in("user_id", agentIds)
        .gte("punch_in", period.start_date)
        .lte("punch_in", period.end_date + "T23:59:59Z")
        .eq("status", "approved");

      // Aggregate per agent
      const agentData = new Map<string, { commission: number; bonus: number; hours: number; overtime: number }>();
      for (const c of periodCommissions || []) {
        const d = agentData.get(c.salesperson_id) || { commission: 0, bonus: 0, hours: 0, overtime: 0 };
        d.commission += Number(c.commission_amount);
        d.bonus += Number(c.bonus_amount || 0);
        agentData.set(c.salesperson_id, d);
      }
      for (const t of periodTime || []) {
        const d = agentData.get(t.user_id) || { commission: 0, bonus: 0, hours: 0, overtime: 0 };
        if (t.entry_type === "overtime") d.overtime += Number(t.total_hours || 0);
        else d.hours += Number(t.total_hours || 0);
        agentData.set(t.user_id, d);
      }

      let created = 0;
      for (const [uid, data] of agentData) {
        if (data.commission === 0 && data.hours === 0) continue;
        // Check if entry already exists
        const existing = payrollEntries.find((pe: any) => pe.pay_period_id === periodId && pe.user_id === uid);
        if (existing) continue;

        const gross = data.commission + data.bonus;
        const deductions = Math.round(gross * 0.15 * 100) / 100; // 15% estimate
        const net = gross - deductions;

        const { error } = await supabase.from("payroll_entries").insert({
          pay_period_id: periodId, user_id: uid, base_salary: 0,
          commission_total: data.commission, bonus_total: data.bonus,
          hours_worked: data.hours, overtime_hours: data.overtime,
          gross_pay: gross, deductions_total: deductions, net_pay: net,
          notes: `Auto-généré: ${(periodCommissions || []).filter(c => c.salesperson_id === uid).length} commissions, ${data.hours.toFixed(1)}h travaillées`,
        });
        if (error) console.error("Error creating payroll for", uid, error);
        else created++;
      }
      if (created === 0) throw new Error("Aucune nouvelle fiche à générer (déjà existantes ou aucune donnée)");
      return created;
    },
    onSuccess: (count) => { invalidateAll(); toast.success(`${count} fiche(s) de paie auto-générée(s)`); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  // Adjustments
  const createAdjustment = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("payroll_adjustments").insert({
        payroll_entry_id: adjForm.payroll_entry_id, adjustment_type: adjForm.adjustment_type as any,
        label: adjForm.label, amount: parseFloat(adjForm.amount), applied_by: user?.id, notes: adjForm.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setAdjustDialog(false); toast.success("Ajustement ajouté"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  // Time Entries
  const approveTimeEntry = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("time_entries").update({ status: "approved", approved_by: user?.id, approved_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Temps approuvé"); },
  });
  const rejectTimeEntry = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("time_entries").update({ status: "rejected" }).eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidateAll(); toast.success("Temps rejeté"); },
  });

  // Schedules
  const createSchedule = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("staff_schedules").insert({
        user_id: schForm.user_id, day_of_week: parseInt(schForm.day_of_week),
        start_time: schForm.start_time, end_time: schForm.end_time, notes: schForm.notes || null, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setScheduleDialog(false); toast.success("Horaire ajouté"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });
  const deleteSchedule = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("staff_schedules").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { invalidateAll(); setDeleteConfirm(null); toast.success("Horaire supprimé"); },
  });
  const updateSchedule = useMutation({
    mutationFn: async () => {
      if (!editScheduleId) return;
      const { error } = await supabase.from("staff_schedules").update({
        day_of_week: parseInt(schForm.day_of_week), start_time: schForm.start_time, end_time: schForm.end_time, notes: schForm.notes || null,
      }).eq("id", editScheduleId);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); setScheduleDialog(false); setEditScheduleId(null); toast.success("Horaire modifié"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });
  // Confirmed delete handler
  const handleConfirmedDelete = () => {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    if (type === "grid") deleteGrid.mutate(id);
    else if (type === "assignment") removeAssignment.mutate(id);
    else if (type === "schedule") deleteSchedule.mutate(id);
  };

  // Tax Documents
  const createTaxDoc = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      let dataJson = {};
      try { dataJson = JSON.parse(taxDocForm.data_json); } catch {}
      const { error } = await supabase.from("tax_documents").insert({
        user_id: taxDocForm.user_id, document_type: taxDocForm.document_type as any,
        tax_year: parseInt(taxDocForm.tax_year), notes: taxDocForm.notes || null,
        data_json: dataJson, generated_by: user?.id, generated_at: new Date().toISOString(), status: "generated",
      });
      if (error) throw error;
      // Notify employee
      await supabase.from("staff_notifications").insert({ notification_type: "tax_document", title: "Document fiscal disponible", message: `Votre ${DOC_TYPES[taxDocForm.document_type] || taxDocForm.document_type} ${taxDocForm.tax_year} est disponible.` } as any);
    },
    onSuccess: () => { invalidateAll(); setTaxDocDialog(false); toast.success("Document fiscal créé"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });
  const updateTaxDocStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const u: any = { status };
      if (status === "sent") u.sent_at = new Date().toISOString();
      const { error } = await supabase.from("tax_documents").update(u).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast.success("Statut mis à jour"); },
  });

  // ═══ COMPUTED ═══
  const filtered = useMemo(() => {
    if (!search.trim()) return agents;
    const q = search.toLowerCase();
    return agents.filter((a) => (a.full_name || "").toLowerCase().includes(q) || (a.email || "").toLowerCase().includes(q));
  }, [agents, search]);

  const profileMap = useMemo(() => new Map(agents.map((a) => [a.user_id, a])), [agents]);
  const getName = (uid: string) => profileMap.get(uid)?.full_name || uid.slice(0, 8);

  const totalStats = useMemo(() => ({
    active: agents.filter((a) => a.is_active).length,
    sales: agents.reduce((s, a) => s + a.total_sales, 0),
    commission: agents.reduce((s, a) => s + a.total_commission, 0),
    pending: agents.reduce((s, a) => s + a.pending_commission, 0),
    paid: agents.reduce((s, a) => s + a.paid_commission, 0),
    owed: agents.reduce((s, a) => s + a.approved_commission, 0),
  }), [agents]);

  const pendingWithdrawalsCount = withdrawals.filter((w: any) => w.status === "pending").length;
  const openDisputes = disputes.filter((d: any) => d.status === "open" || d.status === "under_review").length;

  // Agent options for filter dropdowns
  const agentOptions = useMemo(() => agents.map((a) => ({ value: a.user_id, label: a.full_name || a.email || a.user_id.slice(0, 8) })), [agents]);
  const commStatusOpts = [{ value: "pending", label: "En attente" }, { value: "pending_activation", label: "Att. activation" }, { value: "validated", label: "Validée" }, { value: "paid", label: "Payé" }, { value: "rejected", label: "Rejeté" }];
  const payrollStatusOpts = [{ value: "draft", label: "Brouillon" }, { value: "approved", label: "Approuvé" }, { value: "paid", label: "Payé" }];
  const timeStatusOpts = [{ value: "pending", label: "En attente" }, { value: "approved", label: "Approuvé" }, { value: "rejected", label: "Rejeté" }];
  const withdrawalStatusOpts = [{ value: "pending", label: "En attente" }, { value: "approved", label: "Approuvé" }, { value: "paid", label: "Payé" }, { value: "rejected", label: "Rejeté" }, { value: "cancelled", label: "Annulé" }];

  // Filtered data
  const filteredComms = useMemo(() => applyFilters(allCommissions, commFilters, { statusKey: "status", agentKey: "salesperson_id", dateKey: "created_at" }), [allCommissions, commFilters]);
  const filteredPayroll = useMemo(() => applyFilters(payrollEntries, payrollFilters, { statusKey: "status", agentKey: "user_id", dateKey: "created_at" }), [payrollEntries, payrollFilters]);
  const filteredTime = useMemo(() => applyFilters(timeEntries, timeFilters, { statusKey: "status", agentKey: "user_id", dateKey: "punch_in" }), [timeEntries, timeFilters]);
  const filteredWithdrawals = useMemo(() => applyFilters(withdrawals, withdrawalFilters, { statusKey: "status", agentKey: "agent_id", dateKey: "created_at" }), [withdrawals, withdrawalFilters]);

  // Paginate helper
  const paginate = <T,>(data: T[], page: number) => ({ items: data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), totalPages: Math.max(1, Math.ceil(data.length / PAGE_SIZE)), total: data.length });

  const TABS: { key: TabView; label: string; icon: typeof Users; badge?: number }[] = [
    { key: "agents", label: "Vendeurs", icon: Users },
    { key: "commissions", label: "Commissions", icon: DollarSign },
    { key: "grids", label: "Grilles", icon: Grid3X3 },
    { key: "assignments", label: "Assignations", icon: Link2 },
    { key: "withdrawals", label: "Retraits", icon: Banknote, badge: pendingWithdrawalsCount },
    { key: "disputes", label: "Contestations", icon: MessageSquare, badge: openDisputes },
    { key: "payroll", label: "Paie", icon: Briefcase },
    { key: "time", label: "Temps", icon: Timer },
    { key: "schedules", label: "Horaires", icon: ClipboardList },
    { key: "tax_docs", label: "Documents fiscaux", icon: FileSpreadsheet },
  ];

  // Helper: open edit grid dialog
  const openEditGrid = (r: any) => {
    setEditGridId(r.id);
    setGridForm({
      rule_name: r.rule_name, rule_type: r.rule_type, service_type: r.service_type || "",
      min_sales: String(r.min_sales || 0), max_sales: r.max_sales ? String(r.max_sales) : "",
      bonus_amount: String(Number(r.bonus_amount)), bonus_percentage: String(Number(r.bonus_percentage)),
    });
    setGridDialog(true);
  };

  // ═══ AGENT DETAIL ═══
  if (selectedAgent) {
    const a = selectedAgent;
    const ac = allCommissions.filter((c: any) => c.salesperson_id === a.user_id);
    return (
      <div className="space-y-6">
        <button onClick={() => setSelectedAgent(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Retour</button>
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div className={cn("h-14 w-14 rounded-full flex items-center justify-center text-lg font-bold", a.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300")}>{(a.full_name || "?")[0]?.toUpperCase()}</div>
              <div>
                <h2 className="text-lg font-bold text-foreground">{a.full_name || "Sans nom"}</h2>
                <p className="text-xs text-muted-foreground">{a.email} · {a.phone || "—"}</p>
                <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border mt-1 inline-block", a.is_active ? STATUS_BADGE.approved.cls : STATUS_BADGE.rejected.cls)}>{a.is_active ? "Actif" : "Suspendu"}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setEditAgent(a); setEditForm({ full_name: a.full_name || "", email: a.email || "", phone: a.phone || "" }); }}><Edit3 className="h-3 w-3 mr-1" /> Modifier</Button>
              <Button size="sm" variant={a.is_active ? "destructive" : "default"} onClick={() => toggleAgentStatus.mutate({ userId: a.user_id, activate: !a.is_active })}>
                {a.is_active ? <><UserX className="h-3 w-3 mr-1" /> Suspendre</> : <><UserCheck className="h-3 w-3 mr-1" /> Réactiver</>}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-4 border-t border-border">
            {[{ l: "Ventes", v: a.total_sales }, { l: "Total comm.", v: fmtMoney(a.total_commission) }, { l: "Attente", v: fmtMoney(a.pending_commission), c: "text-amber-600" }, { l: "Approuvé", v: fmtMoney(a.approved_commission), c: "text-blue-600" }, { l: "Payé", v: fmtMoney(a.paid_commission), c: "text-emerald-600" }].map((k) => (
              <div key={k.l} className="text-center"><p className="text-[10px] text-muted-foreground">{k.l}</p><p className={cn("text-sm font-bold mt-0.5", k.c || "text-foreground")}>{k.v}</p></div>
            ))}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-bold text-foreground mb-2">Grilles assignées</h3>
          {assignments.filter((as: any) => as.user_id === a.user_id && as.is_active).length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Aucune grille assignée</p>
          ) : assignments.filter((as: any) => as.user_id === a.user_id && as.is_active).map((as: any) => {
            const rule = rules.find((r: any) => r.id === as.rule_id);
            return (
              <div key={as.id} className="flex items-center justify-between p-2 rounded border border-border mb-1">
                <div><p className="text-sm font-medium text-foreground">{rule?.rule_name || "—"}</p><p className="text-[10px] text-muted-foreground">{RULE_TYPES[rule?.rule_type] || rule?.rule_type} · {rule?.bonus_amount > 0 ? `${rule.bonus_amount}$` : `${rule?.bonus_percentage}%`}</p></div>
                <Button size="sm" variant="ghost" onClick={() => setDeleteConfirm({ type: "assignment", id: as.id })}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              </div>
            );
          })}
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-bold text-foreground mb-2">Historique commissions</h3>
          {ac.length === 0 ? <p className="text-xs text-muted-foreground py-4 text-center">Aucune</p> : ac.slice(0, 30).map((c: any) => {
            const b = STATUS_BADGE[c.status] || STATUS_BADGE.pending;
            return (
              <div key={c.id} className="flex items-center justify-between p-2 rounded border border-border mb-1">
                <div><span className="text-sm font-semibold text-foreground">{fmtMoney(Number(c.commission_amount))}</span> <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border ml-1", b.cls)}>{b.label}</span><p className="text-[10px] text-muted-foreground">{fmtMoney(Number(c.sale_amount))} @ {(Number(c.commission_rate) * 100).toFixed(0)}%</p></div>
                <div className="flex items-center gap-1">
                  {c.status === "validated" && <Button size="sm" variant="outline" onClick={() => markCommissionPaid.mutate(c.id)}>Payer</Button>}
                  <span className="text-[10px] text-muted-foreground">{format(new Date(c.created_at), "dd/MM/yy")}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Vendeurs terrain — RH & Paie</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Agents, commissions, grilles, paie, temps, horaires, documents fiscaux</p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { l: "Agents actifs", v: `${totalStats.active}/${agents.length}` },
          { l: "Ventes totales", v: totalStats.sales },
          { l: "Commissions", v: fmtMoney(totalStats.commission), c: "text-emerald-600" },
          { l: "En attente", v: fmtMoney(totalStats.pending), c: "text-amber-600" },
          { l: "Payé", v: fmtMoney(totalStats.paid), c: "text-blue-600" },
          { l: "Solde dû", v: fmtMoney(totalStats.owed), c: "text-red-600" },
        ].map((k) => (
          <div key={k.l} className="bg-card border border-border rounded-xl p-4">
            <p className="text-[11px] text-muted-foreground font-medium">{k.l}</p>
            <p className={cn("text-lg font-bold mt-1", k.c || "text-foreground")}>{k.v}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn("flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap", tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <t.icon className="h-4 w-4" />{t.label}
            {t.badge !== undefined && t.badge > 0 && <span className="ml-1 text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full h-4 min-w-[16px] flex items-center justify-center px-1">{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* ═══ AGENTS TAB ═══ */}
      {tab === "agents" && (
        <div className="space-y-4">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-sm" /></div>
          {loadingAgents ? <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" /> : filtered.length === 0 ? <p className="text-center text-sm text-muted-foreground py-12">Aucun vendeur</p> : (
            <div className="space-y-2">{filtered.map((a) => (
              <div key={a.user_id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-muted/30">
                <div className="flex items-center gap-3 cursor-pointer min-w-0" onClick={() => setSelectedAgent(a)}>
                  <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0", a.is_active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300")}>{(a.full_name || "?")[0]?.toUpperCase()}</div>
                  <div className="min-w-0"><p className="text-sm font-semibold text-foreground truncate">{a.full_name || "Sans nom"} <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border ml-1", a.is_active ? STATUS_BADGE.approved.cls : STATUS_BADGE.rejected.cls)}>{a.is_active ? "Actif" : "Suspendu"}</span></p><p className="text-xs text-muted-foreground truncate">{a.email} · {a.total_sales} ventes · {fmtMoney(a.total_commission)}</p></div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => setSelectedAgent(a)}><Eye className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { setEditAgent(a); setEditForm({ full_name: a.full_name || "", email: a.email || "", phone: a.phone || "" }); }}><Edit3 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}</div>
          )}
        </div>
      )}

      {/* ═══ COMMISSIONS TAB ═══ */}
      {tab === "commissions" && (() => {
        const { items: pageComms, totalPages: commTotalPages, total: commTotal } = paginate(filteredComms, commPage);
        return (
        <div className="space-y-3">
          <FilterBar
            filters={commFilters}
            onChange={(f) => { setCommFilters(f); setCommPage(1); }}
            config={{
              statusOptions: commStatusOpts,
              agentOptions: agentOptions,
              showDateRange: true,
              onExport: () => downloadCSV(
                filteredComms.map((c: any) => ({ ...c, agent_name: getName(c.salesperson_id) })),
                "commissions",
                COMMISSION_COLUMNS
              ),
            }}
          />
          <p className="text-[10px] text-muted-foreground">{commTotal} résultat(s)</p>
          {pageComms.length === 0 ? <p className="text-center text-sm text-muted-foreground py-12">Aucune commission</p> : pageComms.map((c: any) => {
          const b = STATUS_BADGE[c.status] || STATUS_BADGE.pending;
          return (
            <div key={c.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
              <div><div className="flex items-center gap-2"><span className="text-sm font-semibold text-foreground">{fmtMoney(Number(c.commission_amount))}</span><span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", b.cls)}>{b.label}</span></div><p className="text-xs text-muted-foreground mt-0.5">{getName(c.salesperson_id)} · {fmtMoney(Number(c.sale_amount))} @ {(Number(c.commission_rate)*100).toFixed(0)}%{c.bonus_amount > 0 ? ` + ${fmtMoney(Number(c.bonus_amount))} bonus` : ""}</p></div>
              <div className="flex items-center gap-2 shrink-0">
                {(c.status === "pending" || c.status === "pending_activation") && <><Button size="icon" variant="ghost" className="text-emerald-600" onClick={() => approveCommission.mutate(c.id)}><Check className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="text-destructive" onClick={() => { setRejectCommDialog(c.id); setRejectCommReason(""); }}><X className="h-4 w-4" /></Button></>}
                {c.status === "validated" && <Button size="sm" variant="outline" onClick={() => markCommissionPaid.mutate(c.id)}>Payer</Button>}
                <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr })}</span>
              </div>
            </div>
          );
        })}{commTotalPages > 1 && <div className="flex items-center justify-center gap-2 pt-2"><Button size="sm" variant="outline" disabled={commPage === 1} onClick={() => setCommPage(p => p - 1)}><ChevronLeft className="h-3 w-3" /></Button><span className="text-xs text-muted-foreground">{commPage}/{commTotalPages}</span><Button size="sm" variant="outline" disabled={commPage === commTotalPages} onClick={() => setCommPage(p => p + 1)}><ChevronRight className="h-3 w-3" /></Button></div>}
        </div>);
      })()}

      {/* ═══ GRIDS TAB — with EDIT ═══ */}
      {tab === "grids" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center"><h3 className="text-sm font-bold text-foreground">Grilles de commission</h3><Button size="sm" onClick={() => { setEditGridId(null); setGridForm({ rule_name: "", rule_type: "base_rate", service_type: "", min_sales: "0", max_sales: "", bonus_amount: "0", bonus_percentage: "0" }); setGridDialog(true); }}><Plus className="h-3 w-3 mr-1" /> Nouvelle grille</Button></div>
          {rules.length === 0 ? <p className="text-center text-sm text-muted-foreground py-12">Aucune grille</p> : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-[11px] text-muted-foreground"><th className="pb-2 font-medium">Nom</th><th className="pb-2 font-medium">Type</th><th className="pb-2 font-medium">Service</th><th className="pb-2 font-medium text-right">Ventes min</th><th className="pb-2 font-medium text-right">Ventes max</th><th className="pb-2 font-medium text-right">Bonus $</th><th className="pb-2 font-medium text-right">Bonus %</th><th className="pb-2 font-medium text-center">Actif</th><th className="pb-2"></th></tr></thead><tbody>
              {rules.map((r: any) => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2.5 font-medium text-foreground">{r.rule_name}</td>
                  <td className="py-2.5 text-muted-foreground">{RULE_TYPES[r.rule_type] || r.rule_type}</td>
                  <td className="py-2.5 text-muted-foreground">{r.service_type || "—"}</td>
                  <td className="py-2.5 text-right text-foreground">{r.min_sales}</td>
                  <td className="py-2.5 text-right text-foreground">{r.max_sales ?? "∞"}</td>
                  <td className="py-2.5 text-right text-foreground">{Number(r.bonus_amount).toFixed(2)} $</td>
                  <td className="py-2.5 text-right text-foreground">{Number(r.bonus_percentage).toFixed(1)}%</td>
                  <td className="py-2.5 text-center">
                    <button onClick={() => toggleGridActive.mutate({ id: r.id, active: !r.is_active })} className="cursor-pointer">
                      {r.is_active ? <Check className="h-4 w-4 text-emerald-600 mx-auto" /> : <X className="h-4 w-4 text-destructive mx-auto" />}
                    </button>
                  </td>
                  <td className="py-2.5 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => openEditGrid(r)}><Edit3 className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteConfirm({ type: "grid", id: r.id })}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody></table></div>
          )}
        </div>
      )}

      {/* ═══ ASSIGNMENTS TAB ═══ */}
      {tab === "assignments" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center"><h3 className="text-sm font-bold text-foreground">Grilles assignées aux vendeurs</h3><Button size="sm" onClick={() => { setAssignForm({ user_id: "", rule_id: "", notes: "" }); setAssignDialog(true); }}><Plus className="h-3 w-3 mr-1" /> Assigner</Button></div>
          {assignments.length === 0 ? <p className="text-center text-sm text-muted-foreground py-12">Aucune assignation</p> : (
            <div className="space-y-2">{assignments.map((a: any) => {
              const rule = rules.find((r: any) => r.id === a.rule_id);
              return (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
                  <div><p className="text-sm font-medium text-foreground">{getName(a.user_id)}</p><p className="text-xs text-muted-foreground">{rule?.rule_name || "—"} · {RULE_TYPES[rule?.rule_type] || "?"}{a.notes && ` · ${a.notes}`}</p></div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", a.is_active ? STATUS_BADGE.approved.cls : STATUS_BADGE.rejected.cls)}>{a.is_active ? "Actif" : "Inactif"}</span>
                    <Button size="icon" variant="ghost" onClick={() => { setEditAssignId(a.id); setEditAssignForm({ notes: a.notes || "", is_active: a.is_active !== false }); }}><Edit3 className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteConfirm({ type: "assignment", id: a.id })}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                </div>
              );
            })}</div>
          )}
        </div>
      )}

      {/* ═══ WITHDRAWALS TAB — Enhanced with Timeline ═══ */}
      {tab === "withdrawals" && (() => {
        const { items: pageWith, totalPages: withTotalPages, total: withTotal } = paginate(filteredWithdrawals, withdrawalPage);
        return (
        <div className="space-y-3">
          <FilterBar filters={withdrawalFilters} onChange={(f) => { setWithdrawalFilters(f); setWithdrawalPage(1); }} config={{ statusOptions: withdrawalStatusOpts, agentOptions: agentOptions, showDateRange: true, onExport: () => downloadCSV(filteredWithdrawals.map((w: any) => ({ ...w, agent_name: getName(w.agent_id) })), "retraits", WITHDRAWAL_COLUMNS) }} />
          <p className="text-[10px] text-muted-foreground">{withTotal} résultat(s)</p>
          {pageWith.length === 0 ? <p className="text-center text-sm text-muted-foreground py-12">Aucun retrait</p> : pageWith.map((w: any) => {
            const b = STATUS_BADGE[w.status] || STATUS_BADGE.pending;
            return (
              <div key={w.id} className="p-4 rounded-xl border border-border bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{fmtMoney(Number(w.amount))}</span>
                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", b.cls)}>{b.label}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{format(new Date(w.created_at), "dd/MM/yyyy HH:mm")}</span>
                </div>
                <WithdrawalTimeline withdrawal={w} />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Agent:</span> <span className="font-medium text-foreground">{getName(w.agent_id)}</span></div>
                  {w.reviewed_at && <div><span className="text-muted-foreground">Revu:</span> <span className="text-foreground">{format(new Date(w.reviewed_at), "dd/MM/yy HH:mm")}</span></div>}
                  {w.paid_at && <div><span className="text-muted-foreground">Payé:</span> <span className="text-emerald-600 font-medium">{format(new Date(w.paid_at), "dd/MM/yy HH:mm")}</span></div>}
                </div>
                {w.notes && <p className="text-xs text-muted-foreground">Note agent: {w.notes}</p>}
                {w.admin_notes && <p className="text-xs text-amber-600">Note admin: {w.admin_notes}</p>}
                {(w.status === "pending" || w.status === "approved") && (
                  <div className="flex gap-2 pt-1 border-t border-border">
                    {w.status === "pending" && (
                      <>
                        <Button size="sm" variant="outline" className="text-emerald-600" onClick={() => { setWithdrawalDetail(w); setWithdrawalAdminNote(""); }}><Eye className="h-3 w-3 mr-1" /> Détails & action</Button>
                        <Button size="sm" variant="ghost" className="text-emerald-600" onClick={() => updateWithdrawal.mutate({ id: w.id, status: "approved" })}><Check className="h-3 w-3 mr-1" /> Approuver</Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { setWithdrawalDetail(w); setWithdrawalAdminNote(""); }}><X className="h-3 w-3 mr-1" /> Rejeter</Button>
                      </>
                    )}
                    {w.status === "approved" && <Button size="sm" onClick={() => updateWithdrawal.mutate({ id: w.id, status: "paid" })}><CreditCard className="h-3 w-3 mr-1" /> Marquer payé</Button>}
                  </div>
                )}
              </div>
            );
          })}
          {withTotalPages > 1 && <div className="flex items-center justify-center gap-2 pt-2"><Button size="sm" variant="outline" disabled={withdrawalPage === 1} onClick={() => setWithdrawalPage(p => p - 1)}><ChevronLeft className="h-3 w-3" /></Button><span className="text-xs text-muted-foreground">{withdrawalPage}/{withTotalPages}</span><Button size="sm" variant="outline" disabled={withdrawalPage === withTotalPages} onClick={() => setWithdrawalPage(p => p + 1)}><ChevronRight className="h-3 w-3" /></Button></div>}
        </div>);
      })()}

      {/* ═══ DISPUTES TAB ═══ */}
      {tab === "disputes" && (
        <div className="space-y-2">{disputes.length === 0 ? <p className="text-center text-sm text-muted-foreground py-12">Aucune contestation</p> : disputes.map((d: any) => {
          const b = STATUS_BADGE[d.status] || STATUS_BADGE.open;
          return (
            <div key={d.id} className="p-4 rounded-xl border border-border bg-card space-y-2">
              <div className="flex items-center justify-between">
                <div><span className="text-sm font-semibold text-foreground">{getName(d.agent_id)}</span> <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border ml-1", b.cls)}>{b.label}</span></div>
                <span className="text-[10px] text-muted-foreground">{format(new Date(d.created_at), "dd/MM/yyyy")}</span>
              </div>
              <p className="text-xs text-muted-foreground">{d.reason}</p>
              {d.admin_response && <p className="text-xs text-blue-600">Réponse: {d.admin_response}</p>}
              {d.sales_commissions && <p className="text-[10px] text-muted-foreground">Commission: {fmtMoney(Number(d.sales_commissions.commission_amount))}</p>}
              {(d.status === "open" || d.status === "under_review") && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => { setDisputeResolution({ id: d.id, action: "accepted" }); setDisputeNote(""); }}>Accepter</Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => { setDisputeResolution({ id: d.id, action: "rejected" }); setDisputeNote(""); }}>Rejeter</Button>
                </div>
              )}
            </div>
          );
        })}</div>
      )}

      {/* ═══ PAYROLL TAB — with Auto-Aggregate ═══ */}
      {tab === "payroll" && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center"><h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Calendar className="h-4 w-4" /> Périodes de paie</h3><Button size="sm" onClick={() => { setPpForm({ period_name: "", start_date: "", end_date: "" }); setPayPeriodDialog(true); }}><Plus className="h-3 w-3 mr-1" /> Nouvelle période</Button></div>
            {payPeriods.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Aucune période</p> : (
              <div className="space-y-2">{payPeriods.map((pp: any) => {
                const b = STATUS_BADGE[pp.status] || STATUS_BADGE.draft;
                return (
                  <div key={pp.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                    <div><p className="text-sm font-medium text-foreground">{pp.period_name}</p><p className="text-xs text-muted-foreground">{format(new Date(pp.start_date), "dd/MM/yyyy")} → {format(new Date(pp.end_date), "dd/MM/yyyy")}</p></div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", b.cls)}>{b.label}</span>
                      {(pp.status === "open" || pp.status === "closed") && (
                        <Button size="sm" variant="outline" onClick={() => autoAggregate.mutate(pp.id)} disabled={autoAggregate.isPending}>
                          <Zap className="h-3 w-3 mr-1" /> Auto-générer fiches
                        </Button>
                      )}
                      {(pp.status === "closed" || pp.status === "paid") && (
                        <Button size="sm" variant="outline" className="text-blue-600" onClick={async () => {
                          const entries = payrollEntries.filter((pe: any) => pe.pay_period_id === pp.id);
                          if (!entries.length) { toast.error("Aucune fiche pour cette période"); return; }
                          toast.info(`Génération batch: ${entries.length} PDF(s)…`);
                          let ok = 0;
                          for (const pe of entries) {
                            try {
                              const { error } = await supabase.functions.invoke("generate-payslip-pdf", { body: { payroll_entry_id: pe.id } });
                              if (!error) ok++;
                            } catch {}
                          }
                          toast.success(`${ok}/${entries.length} PDF(s) générés`);
                          invalidateAll();
                        }}><Download className="h-3 w-3 mr-1" /> Batch PDF</Button>
                      )}
                      {pp.status === "open" && <Button size="sm" variant="outline" onClick={() => closePayPeriod.mutate(pp.id)}>Fermer</Button>}
                      {pp.status === "closed" && <Button size="sm" variant="outline" onClick={() => markPeriodPaid.mutate(pp.id)}>Marquer payé</Button>}
                    </div>
                  </div>
                );
              })}</div>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Receipt className="h-4 w-4" /> Fiches de paie</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setAdjForm({ payroll_entry_id: "", adjustment_type: "deduction", label: "", amount: "0", notes: "" }); setAdjustDialog(true); }}><Plus className="h-3 w-3 mr-1" /> Ajustement</Button>
                <Button size="sm" onClick={() => { setPeForm({ pay_period_id: "", user_id: "", base_salary: "0", commission_total: "0", bonus_total: "0", hours_worked: "0", overtime_hours: "0", deductions_total: "0", notes: "" }); setPayrollEntryDialog(true); }}><Plus className="h-3 w-3 mr-1" /> Nouvelle fiche</Button>
              </div>
            </div>
            <FilterBar
              filters={payrollFilters}
              onChange={(f) => { setPayrollFilters(f); setPayrollPage(1); }}
              config={{
                statusOptions: payrollStatusOpts,
                agentOptions: agentOptions,
                onExport: () => downloadCSV(
                  filteredPayroll.map((pe: any) => ({ ...pe, employee_name: getName(pe.user_id), period_name: pe.pay_periods?.period_name || "—" })),
                  "fiches-paie",
                  PAYROLL_COLUMNS
                ),
              }}
            />
            {(() => {
              const { items: pagePE, totalPages: peTotalPages } = paginate(filteredPayroll, payrollPage);
              return pagePE.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Aucune fiche de paie</p> : (
              <>
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-[11px] text-muted-foreground"><th className="pb-2 font-medium">Employé</th><th className="pb-2 font-medium">Période</th><th className="pb-2 font-medium text-right">Comm.</th><th className="pb-2 font-medium text-right">Bonus</th><th className="pb-2 font-medium text-right">Heures</th><th className="pb-2 font-medium text-right">Brut</th><th className="pb-2 font-medium text-right">Retenues</th><th className="pb-2 font-medium text-right">Net</th><th className="pb-2 font-medium">Statut</th><th className="pb-2"></th></tr></thead><tbody>
                {pagePE.map((pe: any) => {
                  const b = STATUS_BADGE[pe.status] || STATUS_BADGE.draft;
                  return (
                    <tr key={pe.id} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer" onClick={() => setPayrollDetail(pe)}>
                      <td className="py-2.5 font-medium text-foreground">{getName(pe.user_id)}</td>
                      <td className="py-2.5 text-muted-foreground text-xs">{pe.pay_periods?.period_name || "—"}</td>
                      <td className="py-2.5 text-right">{fmtMoney(Number(pe.commission_total))}</td>
                      <td className="py-2.5 text-right">{fmtMoney(Number(pe.bonus_total))}</td>
                      <td className="py-2.5 text-right">{Number(pe.hours_worked)}h</td>
                      <td className="py-2.5 text-right font-medium">{fmtMoney(Number(pe.gross_pay))}</td>
                      <td className="py-2.5 text-right text-destructive">{fmtMoney(Number(pe.deductions_total))}</td>
                      <td className="py-2.5 text-right font-bold text-emerald-600">{fmtMoney(Number(pe.net_pay))}</td>
                      <td className="py-2.5"><span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", b.cls)}>{b.label}</span></td>
                      <td className="py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        {pe.status === "draft" && <Button size="sm" variant="ghost" onClick={() => approvePayroll.mutate(pe.id)}>Approuver</Button>}
                        {pe.status === "approved" && <Button size="sm" variant="ghost" onClick={() => markPayrollPaid.mutate(pe.id)}>Payer</Button>}
                        <Button size="sm" variant="ghost" className="text-blue-600" onClick={async () => {
                          toast.info("Génération du PDF en cours…");
                          try {
                            const { data, error } = await supabase.functions.invoke("generate-payslip-pdf", { body: { payroll_entry_id: pe.id } });
                            if (error) throw error;
                            if (data?.pdf_url) { window.open(data.pdf_url, "_blank"); toast.success(`PDF ${data.payroll_number} généré`); qc.invalidateQueries({ queryKey: ["core-field", "payroll-entries"] }); }
                          } catch (e: any) { toast.error("Erreur PDF: " + (e.message || "échec")); }
                        }}><Download className="h-3 w-3 mr-1" /> PDF</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody></table></div>
              {peTotalPages > 1 && <div className="flex items-center justify-center gap-2 pt-2"><Button size="sm" variant="outline" disabled={payrollPage === 1} onClick={() => setPayrollPage(p => p - 1)}><ChevronLeft className="h-3 w-3" /></Button><span className="text-xs text-muted-foreground">{payrollPage}/{peTotalPages}</span><Button size="sm" variant="outline" disabled={payrollPage === peTotalPages} onClick={() => setPayrollPage(p => p + 1)}><ChevronRight className="h-3 w-3" /></Button></div>}
              </>);
            })()}
          </div>

          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Résumé par agent</h3>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-[11px] text-muted-foreground"><th className="pb-2 font-medium">Agent</th><th className="pb-2 font-medium text-right">Ventes</th><th className="pb-2 font-medium text-right">Commission</th><th className="pb-2 font-medium text-right">Attente</th><th className="pb-2 font-medium text-right">Approuvé</th><th className="pb-2 font-medium text-right">Payé</th></tr></thead><tbody>
              {agents.map((a) => (
                <tr key={a.user_id} className="border-b border-border/50 hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedAgent(a)}>
                  <td className="py-2.5"><p className="font-medium text-foreground">{a.full_name || "—"}</p></td>
                  <td className="py-2.5 text-right">{a.total_sales}</td>
                  <td className="py-2.5 text-right">{fmtMoney(a.total_commission)}</td>
                  <td className="py-2.5 text-right text-amber-600">{fmtMoney(a.pending_commission)}</td>
                  <td className="py-2.5 text-right text-blue-600">{fmtMoney(a.approved_commission)}</td>
                  <td className="py-2.5 text-right text-emerald-600">{fmtMoney(a.paid_commission)}</td>
                </tr>
              ))}
            </tbody></table></div>
          </div>
        </div>
      )}

      {/* ═══ TIME TRACKING TAB ═══ */}
      {tab === "time" && (() => {
        const { items: pageTime, totalPages: timeTotalPages, total: timeTotal } = paginate(filteredTime, timePage);
        return (
        <div className="space-y-4">
          <FilterBar filters={timeFilters} onChange={(f) => { setTimeFilters(f); setTimePage(1); }} config={{ statusOptions: timeStatusOpts, agentOptions: agentOptions, showDateRange: true, onExport: () => downloadCSV(filteredTime.map((te: any) => ({ ...te, employee_name: getName(te.user_id) })), "temps", TIME_COLUMNS) }} />
          <p className="text-[10px] text-muted-foreground">{timeTotal} résultat(s)</p>
          {pageTime.length === 0 ? <p className="text-center text-sm text-muted-foreground py-12">Aucune entrée</p> : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-[11px] text-muted-foreground"><th className="pb-2 font-medium">Employé</th><th className="pb-2 font-medium">Punch In</th><th className="pb-2 font-medium">Punch Out</th><th className="pb-2 font-medium text-right">Heures</th><th className="pb-2 font-medium">Type</th><th className="pb-2 font-medium">Statut</th><th className="pb-2"></th></tr></thead><tbody>
              {pageTime.map((te: any) => {
                const b = STATUS_BADGE[te.status] || STATUS_BADGE.pending;
                return (
                  <tr key={te.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2.5 font-medium text-foreground">{getName(te.user_id)}</td>
                    <td className="py-2.5 text-muted-foreground text-xs">{format(new Date(te.punch_in), "dd/MM HH:mm")}</td>
                    <td className="py-2.5 text-muted-foreground text-xs">{te.punch_out ? format(new Date(te.punch_out), "dd/MM HH:mm") : "—"}</td>
                    <td className="py-2.5 text-right">{te.total_hours ? `${te.total_hours}h` : "—"}</td>
                    <td className="py-2.5 text-muted-foreground">{te.entry_type}</td>
                    <td className="py-2.5"><span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", b.cls)}>{b.label}</span></td>
                    <td className="py-2.5 text-right">
                      {te.status === "pending" && <div className="flex gap-1 justify-end"><Button size="icon" variant="ghost" className="text-emerald-600" onClick={() => approveTimeEntry.mutate(te.id)}><Check className="h-3 w-3" /></Button><Button size="icon" variant="ghost" className="text-destructive" onClick={() => rejectTimeEntry.mutate(te.id)}><X className="h-3 w-3" /></Button></div>}
                    </td>
                  </tr>
                );
              })}
            </tbody></table></div>
          )}
          {timeTotalPages > 1 && <div className="flex items-center justify-center gap-2 pt-2"><Button size="sm" variant="outline" disabled={timePage === 1} onClick={() => setTimePage(p => p - 1)}><ChevronLeft className="h-3 w-3" /></Button><span className="text-xs text-muted-foreground">{timePage}/{timeTotalPages}</span><Button size="sm" variant="outline" disabled={timePage === timeTotalPages} onClick={() => setTimePage(p => p + 1)}><ChevronRight className="h-3 w-3" /></Button></div>}
        </div>);
      })()}

      {/* ═══ SCHEDULES TAB — with Edit ═══ */}
      {tab === "schedules" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center"><h3 className="text-sm font-bold text-foreground flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Horaires</h3><Button size="sm" onClick={() => { setEditScheduleId(null); setSchForm({ user_id: "", day_of_week: "1", start_time: "09:00", end_time: "17:00", notes: "" }); setScheduleDialog(true); }}><Plus className="h-3 w-3 mr-1" /> Ajouter</Button></div>
          {schedules.length === 0 ? <p className="text-center text-sm text-muted-foreground py-12">Aucun horaire</p> : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-[11px] text-muted-foreground"><th className="pb-2 font-medium">Employé</th><th className="pb-2 font-medium">Jour</th><th className="pb-2 font-medium">Début</th><th className="pb-2 font-medium">Fin</th><th className="pb-2 font-medium">Notes</th><th className="pb-2"></th></tr></thead><tbody>
              {schedules.map((s: any) => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="py-2.5 font-medium text-foreground">{getName(s.user_id)}</td>
                  <td className="py-2.5 text-muted-foreground">{DAYS[s.day_of_week]}</td>
                  <td className="py-2.5 text-foreground">{s.start_time}</td>
                  <td className="py-2.5 text-foreground">{s.end_time}</td>
                  <td className="py-2.5 text-muted-foreground text-xs">{s.notes || "—"}</td>
                  <td className="py-2.5 text-right">
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => { setEditScheduleId(s.id); setSchForm({ user_id: s.user_id, day_of_week: String(s.day_of_week), start_time: s.start_time, end_time: s.end_time, notes: s.notes || "" }); setScheduleDialog(true); }}><Edit3 className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteConfirm({ type: "schedule", id: s.id })}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody></table></div>
          )}
        </div>
      )}

      {/* ═══ TAX DOCUMENTS TAB ═══ */}
      {tab === "tax_docs" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Documents fiscaux</h3>
            <Button size="sm" onClick={() => { setTaxDocForm({ user_id: "", document_type: "t4", tax_year: String(new Date().getFullYear() - 1), notes: "", data_json: "{}" }); setTaxDocDialog(true); }}><Plus className="h-3 w-3 mr-1" /> Nouveau document</Button>
          </div>
          {taxDocs.length === 0 ? <p className="text-center text-sm text-muted-foreground py-12">Aucun document fiscal</p> : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-[11px] text-muted-foreground"><th className="pb-2 font-medium">Employé</th><th className="pb-2 font-medium">Type</th><th className="pb-2 font-medium">Année</th><th className="pb-2 font-medium">Statut</th><th className="pb-2 font-medium">Généré</th><th className="pb-2 font-medium">Notes</th><th className="pb-2"></th></tr></thead><tbody>
              {taxDocs.map((td: any) => {
                const b = STATUS_BADGE[td.status] || STATUS_BADGE.draft;
                return (
                  <tr key={td.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="py-2.5 font-medium text-foreground">{getName(td.user_id)}</td>
                    <td className="py-2.5 text-foreground font-medium">{DOC_TYPES[td.document_type] || td.document_type}</td>
                    <td className="py-2.5 text-foreground">{td.tax_year}</td>
                    <td className="py-2.5"><span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", b.cls)}>{b.label}</span></td>
                    <td className="py-2.5 text-muted-foreground text-xs">{td.generated_at ? format(new Date(td.generated_at), "dd/MM/yy") : "—"}</td>
                    <td className="py-2.5 text-muted-foreground text-xs">{td.notes || "—"}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex gap-1 justify-end">
                        {td.status === "draft" && <Button size="sm" variant="ghost" onClick={async () => {
                          toast.info("Génération du document fiscal…");
                          try {
                            const { data, error } = await supabase.functions.invoke("generate-tax-document-pdf", { body: { tax_document_id: td.id } });
                            if (error) throw error;
                            if (data?.pdf_url) { window.open(data.pdf_url, "_blank"); invalidateAll(); toast.success(`${data.doc_ref} généré`); }
                          } catch (e: any) { toast.error("Erreur: " + (e.message || "échec")); }
                        }}>Générer PDF</Button>}
                        {td.status === "generated" && <Button size="sm" variant="ghost" onClick={() => updateTaxDocStatus.mutate({ id: td.id, status: "sent" })}>Envoyer</Button>}
                        {td.pdf_url && <Button size="sm" variant="ghost" className="text-blue-600" onClick={async () => {
                          const { data } = await supabase.storage.from("payslips").createSignedUrl(td.pdf_url, 3600);
                          if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                        }}><Download className="h-3 w-3" /></Button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody></table></div>
          )}
        </div>
      )}

      {/* ═══ DIALOGS ═══ */}

      {/* Edit Agent */}
      <Dialog open={!!editAgent} onOpenChange={(o) => !o && setEditAgent(null)}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Modifier vendeur</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {[{ l: "Nom", k: "full_name" }, { l: "Courriel", k: "email" }, { l: "Téléphone", k: "phone" }].map((f) => (<div key={f.k}><Label className="text-xs">{f.l}</Label><Input value={(editForm as any)[f.k]} onChange={(e) => setEditForm((p) => ({ ...p, [f.k]: e.target.value }))} /></div>))}
          </div>
          <DialogFooter><Button onClick={() => saveAgentProfile.mutate()} disabled={saveAgentProfile.isPending}>{saveAgentProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sauvegarder"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Grid */}
      <Dialog open={gridDialog} onOpenChange={(o) => { if (!o) { setGridDialog(false); setEditGridId(null); } }}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{editGridId ? "Modifier la grille" : "Nouvelle grille de commission"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Nom</Label><Input value={gridForm.rule_name} onChange={(e) => setGridForm((p) => ({ ...p, rule_name: e.target.value }))} /></div>
            <div><Label className="text-xs">Type</Label><Select value={gridForm.rule_type} onValueChange={(v) => setGridForm((p) => ({ ...p, rule_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(RULE_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Service</Label><Input value={gridForm.service_type} onChange={(e) => setGridForm((p) => ({ ...p, service_type: e.target.value }))} placeholder="internet, tv…" /></div>
              <div><Label className="text-xs">Ventes min</Label><Input type="number" value={gridForm.min_sales} onChange={(e) => setGridForm((p) => ({ ...p, min_sales: e.target.value }))} /></div>
              <div><Label className="text-xs">Ventes max</Label><Input type="number" value={gridForm.max_sales} onChange={(e) => setGridForm((p) => ({ ...p, max_sales: e.target.value }))} placeholder="∞" /></div>
              <div><Label className="text-xs">Bonus ($)</Label><Input type="number" value={gridForm.bonus_amount} onChange={(e) => setGridForm((p) => ({ ...p, bonus_amount: e.target.value }))} /></div>
              <div><Label className="text-xs">Bonus (%)</Label><Input type="number" value={gridForm.bonus_percentage} onChange={(e) => setGridForm((p) => ({ ...p, bonus_percentage: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => saveGrid.mutate()} disabled={saveGrid.isPending || !gridForm.rule_name}>{saveGrid.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editGridId ? "Sauvegarder" : "Créer"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Grid */}
      <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Assigner une grille</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Vendeur</Label><Select value={assignForm.user_id} onValueChange={(v) => setAssignForm((p) => ({ ...p, user_id: v }))}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>{agents.map((a) => <SelectItem key={a.user_id} value={a.user_id}>{a.full_name || a.email || a.user_id.slice(0, 8)}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs">Grille</Label><Select value={assignForm.rule_id} onValueChange={(v) => setAssignForm((p) => ({ ...p, rule_id: v }))}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>{rules.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.rule_name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs">Notes</Label><Input value={assignForm.notes} onChange={(e) => setAssignForm((p) => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={() => createAssignment.mutate()} disabled={createAssignment.isPending || !assignForm.user_id || !assignForm.rule_id}>{createAssignment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assigner"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Period */}
      <Dialog open={payPeriodDialog} onOpenChange={setPayPeriodDialog}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Nouvelle période de paie</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Nom</Label><Input value={ppForm.period_name} onChange={(e) => setPpForm((p) => ({ ...p, period_name: e.target.value }))} placeholder="Paie Mars 2026" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Début</Label><Input type="date" value={ppForm.start_date} onChange={(e) => setPpForm((p) => ({ ...p, start_date: e.target.value }))} /></div>
              <div><Label className="text-xs">Fin</Label><Input type="date" value={ppForm.end_date} onChange={(e) => setPpForm((p) => ({ ...p, end_date: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => createPayPeriod.mutate()} disabled={createPayPeriod.isPending || !ppForm.period_name || !ppForm.start_date || !ppForm.end_date}>{createPayPeriod.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payroll Entry */}
      <Dialog open={payrollEntryDialog} onOpenChange={setPayrollEntryDialog}>
        <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Nouvelle fiche de paie</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Période</Label><Select value={peForm.pay_period_id} onValueChange={(v) => setPeForm((p) => ({ ...p, pay_period_id: v }))}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>{payPeriods.map((pp: any) => <SelectItem key={pp.id} value={pp.id}>{pp.period_name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs">Employé</Label><Select value={peForm.user_id} onValueChange={(v) => setPeForm((p) => ({ ...p, user_id: v }))}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>{agents.map((a) => <SelectItem key={a.user_id} value={a.user_id}>{a.full_name || a.email || a.user_id.slice(0, 8)}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Salaire base ($)</Label><Input type="number" value={peForm.base_salary} onChange={(e) => setPeForm((p) => ({ ...p, base_salary: e.target.value }))} /></div>
              <div><Label className="text-xs">Commission ($)</Label><Input type="number" value={peForm.commission_total} onChange={(e) => setPeForm((p) => ({ ...p, commission_total: e.target.value }))} /></div>
              <div><Label className="text-xs">Bonus ($)</Label><Input type="number" value={peForm.bonus_total} onChange={(e) => setPeForm((p) => ({ ...p, bonus_total: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs">Heures</Label><Input type="number" value={peForm.hours_worked} onChange={(e) => setPeForm((p) => ({ ...p, hours_worked: e.target.value }))} /></div>
              <div><Label className="text-xs">Heures supp.</Label><Input type="number" value={peForm.overtime_hours} onChange={(e) => setPeForm((p) => ({ ...p, overtime_hours: e.target.value }))} /></div>
              <div><Label className="text-xs">Retenues ($)</Label><Input type="number" value={peForm.deductions_total} onChange={(e) => setPeForm((p) => ({ ...p, deductions_total: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Notes</Label><Input value={peForm.notes} onChange={(e) => setPeForm((p) => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={() => createPayrollEntry.mutate()} disabled={createPayrollEntry.isPending || !peForm.pay_period_id || !peForm.user_id}>{createPayrollEntry.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjustment */}
      <Dialog open={adjustDialog} onOpenChange={setAdjustDialog}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Ajustement de paie</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Fiche de paie</Label><Select value={adjForm.payroll_entry_id} onValueChange={(v) => setAdjForm((p) => ({ ...p, payroll_entry_id: v }))}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>{payrollEntries.map((pe: any) => <SelectItem key={pe.id} value={pe.id}>{getName(pe.user_id)} — {pe.pay_periods?.period_name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs">Type</Label><Select value={adjForm.adjustment_type} onValueChange={(v) => setAdjForm((p) => ({ ...p, adjustment_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ADJ_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div><Label className="text-xs">Libellé</Label><Input value={adjForm.label} onChange={(e) => setAdjForm((p) => ({ ...p, label: e.target.value }))} /></div>
            <div><Label className="text-xs">Montant ($)</Label><Input type="number" value={adjForm.amount} onChange={(e) => setAdjForm((p) => ({ ...p, amount: e.target.value }))} /></div>
            <div><Label className="text-xs">Notes</Label><Input value={adjForm.notes} onChange={(e) => setAdjForm((p) => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={() => createAdjustment.mutate()} disabled={createAdjustment.isPending || !adjForm.payroll_entry_id || !adjForm.label}>{createAdjustment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ajouter"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule */}
      <Dialog open={scheduleDialog} onOpenChange={(o) => { if (!o) { setScheduleDialog(false); setEditScheduleId(null); } }}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{editScheduleId ? "Modifier l'horaire" : "Ajouter un horaire"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {!editScheduleId && <div><Label className="text-xs">Employé</Label><Select value={schForm.user_id} onValueChange={(v) => setSchForm((p) => ({ ...p, user_id: v }))}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>{agents.map((a) => <SelectItem key={a.user_id} value={a.user_id}>{a.full_name || a.email || a.user_id.slice(0, 8)}</SelectItem>)}</SelectContent></Select></div>}
            <div><Label className="text-xs">Jour</Label><Select value={schForm.day_of_week} onValueChange={(v) => setSchForm((p) => ({ ...p, day_of_week: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Début</Label><Input type="time" value={schForm.start_time} onChange={(e) => setSchForm((p) => ({ ...p, start_time: e.target.value }))} /></div>
              <div><Label className="text-xs">Fin</Label><Input type="time" value={schForm.end_time} onChange={(e) => setSchForm((p) => ({ ...p, end_time: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Notes</Label><Input value={schForm.notes} onChange={(e) => setSchForm((p) => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={() => editScheduleId ? updateSchedule.mutate() : createSchedule.mutate()} disabled={createSchedule.isPending || updateSchedule.isPending || (!editScheduleId && !schForm.user_id)}>{(createSchedule.isPending || updateSchedule.isPending) ? <Loader2 className="h-4 w-4 animate-spin" /> : editScheduleId ? "Sauvegarder" : "Ajouter"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute Resolution */}
      <Dialog open={!!disputeResolution} onOpenChange={(o) => !o && setDisputeResolution(null)}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{disputeResolution?.action === "accepted" ? "Accepter" : "Rejeter"} la contestation</DialogTitle></DialogHeader>
          <div><Label className="text-xs">Note / réponse</Label><Input value={disputeNote} onChange={(e) => setDisputeNote(e.target.value)} placeholder="Justification…" /></div>
          <DialogFooter><Button onClick={() => { if (disputeResolution) resolveDispute.mutate({ id: disputeResolution.id, action: disputeResolution.action, note: disputeNote }); }} disabled={resolveDispute.isPending}>{resolveDispute.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmer"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdrawal Detail */}
      <Dialog open={!!withdrawalDetail} onOpenChange={(o) => !o && setWithdrawalDetail(null)}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Détail du retrait</DialogTitle></DialogHeader>
          {withdrawalDetail && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-muted-foreground text-xs">Agent</p><p className="font-medium text-foreground">{getName(withdrawalDetail.agent_id)}</p></div>
                <div><p className="text-muted-foreground text-xs">Montant</p><p className="font-bold text-foreground">{fmtMoney(Number(withdrawalDetail.amount))}</p></div>
                <div><p className="text-muted-foreground text-xs">Demandé le</p><p className="text-foreground">{format(new Date(withdrawalDetail.created_at), "dd/MM/yyyy HH:mm")}</p></div>
                <div><p className="text-muted-foreground text-xs">Statut</p><span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", (STATUS_BADGE[withdrawalDetail.status] || STATUS_BADGE.pending).cls)}>{(STATUS_BADGE[withdrawalDetail.status] || STATUS_BADGE.pending).label}</span></div>
              </div>
              {withdrawalDetail.notes && <div><p className="text-xs text-muted-foreground">Note de l'agent:</p><p className="text-sm text-foreground">{withdrawalDetail.notes}</p></div>}
              <div><Label className="text-xs">Note admin</Label><Textarea value={withdrawalAdminNote} onChange={(e) => setWithdrawalAdminNote(e.target.value)} placeholder="Note interne…" /></div>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" className="text-destructive" onClick={() => { if (withdrawalDetail) updateWithdrawal.mutate({ id: withdrawalDetail.id, status: "rejected", note: withdrawalAdminNote }); }}>Rejeter</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { if (withdrawalDetail) updateWithdrawal.mutate({ id: withdrawalDetail.id, status: "approved", note: withdrawalAdminNote }); }}>Approuver</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tax Document */}
      <Dialog open={taxDocDialog} onOpenChange={setTaxDocDialog}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Nouveau document fiscal</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Employé</Label><Select value={taxDocForm.user_id} onValueChange={(v) => setTaxDocForm((p) => ({ ...p, user_id: v }))}><SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger><SelectContent>{agents.map((a) => <SelectItem key={a.user_id} value={a.user_id}>{a.full_name || a.email || a.user_id.slice(0, 8)}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Type</Label><Select value={taxDocForm.document_type} onValueChange={(v) => setTaxDocForm((p) => ({ ...p, document_type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(DOC_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs">Année fiscale</Label><Input type="number" value={taxDocForm.tax_year} onChange={(e) => setTaxDocForm((p) => ({ ...p, tax_year: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Notes</Label><Input value={taxDocForm.notes} onChange={(e) => setTaxDocForm((p) => ({ ...p, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter><Button onClick={() => createTaxDoc.mutate()} disabled={createTaxDoc.isPending || !taxDocForm.user_id}>{createTaxDoc.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Edit Assignment Dialog */}
      <Dialog open={!!editAssignId} onOpenChange={(o) => !o && setEditAssignId(null)}>
        <DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Modifier l'assignation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Notes</Label><Input value={editAssignForm.notes} onChange={(e) => setEditAssignForm((p) => ({ ...p, notes: e.target.value }))} /></div>
            <div className="flex items-center gap-2"><Label className="text-xs">Actif</Label><input type="checkbox" checked={editAssignForm.is_active} onChange={(e) => setEditAssignForm((p) => ({ ...p, is_active: e.target.checked }))} /></div>
          </div>
          <DialogFooter><Button onClick={() => updateAssignment.mutate()} disabled={updateAssignment.isPending}>{updateAssignment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sauvegarder"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <DeleteConfirmDialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} onConfirm={handleConfirmedDelete} />

      {/* Payroll Detail */}
      <PayrollDetailDialog entry={payrollDetail} agentName={payrollDetail ? getName(payrollDetail.user_id) : ""} open={!!payrollDetail} onClose={() => setPayrollDetail(null)} />

      {/* Reject Commission */}
      <Dialog open={!!rejectCommDialog} onOpenChange={(o) => !o && setRejectCommDialog(null)}>
        <DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Rejeter la commission</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Raison du rejet</Label><Textarea value={rejectCommReason} onChange={(e) => setRejectCommReason(e.target.value)} placeholder="Expliquez la raison…" /></div>
          </div>
          <DialogFooter><Button variant="destructive" onClick={() => { if (rejectCommDialog && rejectCommReason.trim()) { rejectCommission.mutate({ id: rejectCommDialog, reason: rejectCommReason }); setRejectCommDialog(null); } }} disabled={!rejectCommReason.trim() || rejectCommission.isPending}>{rejectCommission.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rejeter"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
