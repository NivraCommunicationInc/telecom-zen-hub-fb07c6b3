/**
 * FieldMyPay — Employee-facing portal for commissions, payslips, withdrawals, disputes, time tracking, schedules, grids, and tax docs.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  DollarSign, Loader2, Clock, Receipt, MessageSquare, Timer, ClipboardList,
  Banknote, Plus, ArrowRight, Check, X, AlertTriangle, Calendar, FileSpreadsheet,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "En attente", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800" },
  pending_activation: { label: "Att. activation", cls: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800" },
  validated: { label: "Validée", cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800" },
  approved: { label: "Approuvé", cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800" },
  paid: { label: "Payé", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800" },
  rejected: { label: "Rejeté", cls: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800" },
  open: { label: "Ouvert", cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800" },
  under_review: { label: "En révision", cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800" },
  accepted: { label: "Accepté", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800" },
  draft: { label: "Brouillon", cls: "bg-muted text-muted-foreground border-border" },
  closed: { label: "Fermé", cls: "bg-muted text-muted-foreground border-border" },
  cancelled: { label: "Annulé", cls: "bg-muted text-muted-foreground border-border" },
  generated: { label: "Généré", cls: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800" },
  sent: { label: "Envoyé", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800" },
  acknowledged: { label: "Reçu", cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800" },
};

type Tab = "commissions" | "payslips" | "withdrawals" | "disputes" | "time" | "schedule" | "grids" | "tax_docs";

const fmtMoney = (n: number) => `${n.toFixed(2)} $`;
const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const DOC_TYPES: Record<string, string> = { t4: "T4", rl1: "Relevé 1", releve1: "Relevé 1", summary: "Sommaire", other: "Autre" };

export default function FieldMyPay() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("commissions");
  const [withdrawDialog, setWithdrawDialog] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNotes, setWithdrawNotes] = useState("");
  const [disputeDialog, setDisputeDialog] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [punchNote, setPunchNote] = useState("");

  // ═══ QUERIES ═══
  const { data: myCommissions = [] } = useQuery({
    queryKey: ["my-commissions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from("sales_commissions").select("*").eq("salesperson_id", user.id).order("created_at", { ascending: false }).limit(100);
      return data || [];
    },
  });

  const { data: myPayroll = [] } = useQuery({
    queryKey: ["my-payroll"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from("payroll_entries").select("*, pay_periods(period_name, start_date, end_date), payroll_adjustments(*)").eq("user_id", user.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: tab === "payslips",
  });

  const { data: myWithdrawals = [] } = useQuery({
    queryKey: ["my-withdrawals"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from("commission_withdrawal_requests").select("*").eq("agent_id", user.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: tab === "withdrawals",
  });

  const { data: myDisputes = [] } = useQuery({
    queryKey: ["my-disputes"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from("commission_disputes").select("*, sales_commissions(commission_amount, sale_amount)").eq("agent_id", user.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: tab === "disputes",
  });

  const { data: myTime = [] } = useQuery({
    queryKey: ["my-time"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from("time_entries").select("*").eq("user_id", user.id).order("punch_in", { ascending: false }).limit(50);
      return data || [];
    },
    enabled: tab === "time",
  });

  const { data: mySchedule = [] } = useQuery({
    queryKey: ["my-schedule"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from("staff_schedules").select("*").eq("user_id", user.id).eq("is_active", true).order("day_of_week");
      return data || [];
    },
    enabled: tab === "schedule",
  });

  const { data: myGrids = [] } = useQuery({
    queryKey: ["my-grids"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from("commission_grid_assignments").select("*, field_sales_commission_rules(*)").eq("user_id", user.id).eq("is_active", true);
      return data || [];
    },
    enabled: tab === "grids",
  });

  const { data: myTaxDocs = [] } = useQuery({
    queryKey: ["my-tax-docs"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from("tax_documents").select("*").eq("user_id", user.id).order("tax_year", { ascending: false });
      return data || [];
    },
    enabled: tab === "tax_docs",
  });

  // ═══ COMPUTED ═══
  const totalEarned = myCommissions.reduce((s, c: any) => s + Number(c.commission_amount), 0);
  const totalPending = myCommissions.filter((c: any) => c.status === "pending" || c.status === "pending_activation").reduce((s, c: any) => s + Number(c.commission_amount), 0);
  const totalApproved = myCommissions.filter((c: any) => c.status === "validated" || c.status === "approved").reduce((s, c: any) => s + Number(c.commission_amount), 0);
  const totalPaid = myCommissions.filter((c: any) => c.status === "paid").reduce((s, c: any) => s + Number(c.commission_amount), 0);
  const pendingWithdrawals = myWithdrawals.filter((w: any) => w.status === "pending" || w.status === "approved").reduce((s, w: any) => s + Number(w.amount), 0);
  const available = Math.max(0, totalApproved - pendingWithdrawals);

  // ═══ MUTATIONS ═══
  const requestWithdrawal = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");
      const amt = parseFloat(withdrawAmount);
      if (isNaN(amt) || amt <= 0 || amt > available) throw new Error("Montant invalide");
      const { error } = await supabase.from("commission_withdrawal_requests").insert({ agent_id: user.id, amount: amt, notes: withdrawNotes || null });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-withdrawals"] }); setWithdrawDialog(false); setWithdrawAmount(""); setWithdrawNotes(""); toast.success("Demande de retrait soumise"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const cancelWithdrawal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commission_withdrawal_requests").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-withdrawals"] }); toast.success("Retrait annulé"); },
  });

  const createDispute = useMutation({
    mutationFn: async () => {
      if (!disputeDialog) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");
      const { error } = await supabase.from("commission_disputes").insert({ commission_id: disputeDialog, agent_id: user.id, reason: disputeReason });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-disputes"] }); setDisputeDialog(null); setDisputeReason(""); toast.success("Contestation soumise"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const punchIn = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");
      const { error } = await supabase.from("time_entries").insert({ user_id: user.id, punch_in: new Date().toISOString(), notes: punchNote || null });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-time"] }); setPunchNote(""); toast.success("Punch In enregistré"); },
  });

  const punchOut = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non connecté");
      const { data: openPunches } = await supabase.from("time_entries").select("id, punch_in").eq("user_id", user.id).is("punch_out", null).order("punch_in", { ascending: false }).limit(1);
      if (!openPunches?.length) throw new Error("Aucun punch in ouvert");
      const entry = openPunches[0];
      const punchOutTime = new Date();
      const hours = (punchOutTime.getTime() - new Date(entry.punch_in).getTime()) / 3600000;
      const { error } = await supabase.from("time_entries").update({ punch_out: punchOutTime.toISOString(), total_hours: Math.round(hours * 100) / 100 }).eq("id", entry.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-time"] }); toast.success("Punch Out enregistré"); },
  });

  const acknowledgeTaxDoc = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tax_documents").update({ status: "acknowledged" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-tax-docs"] }); toast.success("Document marqué comme reçu"); },
  });

  const TABS: { key: Tab; label: string; icon: typeof DollarSign }[] = [
    { key: "commissions", label: "Commissions", icon: DollarSign },
    { key: "payslips", label: "Fiches de paie", icon: Receipt },
    { key: "withdrawals", label: "Retraits", icon: Banknote },
    { key: "disputes", label: "Contestations", icon: MessageSquare },
    { key: "time", label: "Temps", icon: Timer },
    { key: "schedule", label: "Horaire", icon: ClipboardList },
    { key: "grids", label: "Ma grille", icon: DollarSign },
    { key: "tax_docs", label: "Documents fiscaux", icon: FileSpreadsheet },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Ma paie & commissions</h1>
        <p className="text-sm text-muted-foreground">Suivi complet de vos revenus, temps, documents fiscaux</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { l: "Total gagné", v: fmtMoney(totalEarned) },
          { l: "En attente", v: fmtMoney(totalPending), c: "text-amber-600" },
          { l: "Approuvé", v: fmtMoney(totalApproved), c: "text-blue-600" },
          { l: "Payé", v: fmtMoney(totalPaid), c: "text-emerald-600" },
          { l: "Disponible retrait", v: fmtMoney(available), c: "text-primary" },
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
          <button key={t.key} onClick={() => setTab(t.key)} className={cn("flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap", tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <t.icon className="h-4 w-4" />{t.label}
          </button>
        ))}
      </div>

      {/* ═══ COMMISSIONS ═══ */}
      {tab === "commissions" && (
        <div className="space-y-2">{myCommissions.length === 0 ? <p className="text-center text-sm text-muted-foreground py-12">Aucune commission</p> : myCommissions.map((c: any) => {
          const b = STATUS_BADGE[c.status] || STATUS_BADGE.pending;
          return (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
              <div><span className="text-sm font-semibold text-foreground">{fmtMoney(Number(c.commission_amount))}</span> <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border ml-1", b.cls)}>{b.label}</span><p className="text-xs text-muted-foreground mt-0.5">{fmtMoney(Number(c.sale_amount))} @ {(Number(c.commission_rate)*100).toFixed(0)}%{Number(c.bonus_amount) > 0 ? ` + ${fmtMoney(Number(c.bonus_amount))}` : ""}</p></div>
              <div className="flex items-center gap-2 shrink-0">
                {(c.status === "rejected" || c.status === "clawback") && <Button size="sm" variant="outline" onClick={() => { setDisputeDialog(c.id); setDisputeReason(""); }}>Contester</Button>}
                <span className="text-[10px] text-muted-foreground">{format(new Date(c.created_at), "dd/MM/yy")}</span>
              </div>
            </div>
          );
        })}</div>
      )}

      {/* ═══ PAYSLIPS ═══ */}
      {tab === "payslips" && (
        <div className="space-y-3">{myPayroll.length === 0 ? <p className="text-center text-sm text-muted-foreground py-12">Aucune fiche de paie</p> : myPayroll.map((pe: any) => {
          const b = STATUS_BADGE[pe.status] || STATUS_BADGE.draft;
          const adjs = pe.payroll_adjustments || [];
          return (
            <div key={pe.id} className="p-4 rounded-xl border border-border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-semibold text-foreground">{pe.pay_periods?.period_name || "—"}</p><p className="text-xs text-muted-foreground">{pe.pay_periods?.start_date} → {pe.pay_periods?.end_date}</p></div>
                <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", b.cls)}>{b.label}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="p-2 rounded border border-border"><p className="text-muted-foreground">Base</p><p className="font-bold text-foreground">{fmtMoney(Number(pe.base_salary))}</p></div>
                <div className="p-2 rounded border border-border"><p className="text-muted-foreground">Commission</p><p className="font-bold text-foreground">{fmtMoney(Number(pe.commission_total))}</p></div>
                <div className="p-2 rounded border border-border"><p className="text-muted-foreground">Bonus</p><p className="font-bold text-foreground">{fmtMoney(Number(pe.bonus_total))}</p></div>
                <div className="p-2 rounded border border-border"><p className="text-muted-foreground">Heures</p><p className="font-bold text-foreground">{pe.hours_worked}h{Number(pe.overtime_hours) > 0 ? ` (+${pe.overtime_hours}h)` : ""}</p></div>
              </div>
              {adjs.length > 0 && (
                <div className="space-y-1"><p className="text-[10px] font-medium text-muted-foreground uppercase">Ajustements</p>{adjs.map((a: any) => (
                  <div key={a.id} className="flex justify-between text-xs px-2 py-1 rounded bg-muted/50"><span>{a.label} ({a.adjustment_type})</span><span className={a.adjustment_type === "bonus" ? "text-emerald-600" : "text-destructive"}>{a.adjustment_type === "bonus" ? "+" : "-"}{fmtMoney(Math.abs(Number(a.amount)))}</span></div>
                ))}</div>
              )}
              <div className="flex justify-between pt-2 border-t border-border text-sm">
                <div><span className="text-muted-foreground">Brut: </span><span className="font-bold text-foreground">{fmtMoney(Number(pe.gross_pay))}</span></div>
                <div><span className="text-muted-foreground">Retenues: </span><span className="font-bold text-destructive">{fmtMoney(Number(pe.deductions_total))}</span></div>
                <div><span className="text-muted-foreground">Net: </span><span className="font-bold text-emerald-600">{fmtMoney(Number(pe.net_pay))}</span></div>
              </div>
              {pe.notes && <p className="text-[10px] text-muted-foreground italic">{pe.notes}</p>}
            </div>
          );
        })}</div>
      )}

      {/* ═══ WITHDRAWALS — Enhanced ═══ */}
      {tab === "withdrawals" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Solde disponible: <span className="font-bold text-primary">{fmtMoney(available)}</span></p>
            <Button size="sm" onClick={() => setWithdrawDialog(true)} disabled={available <= 0}><Plus className="h-3 w-3 mr-1" /> Demander un retrait</Button>
          </div>
          {myWithdrawals.length === 0 ? <p className="text-center text-sm text-muted-foreground py-12">Aucune demande</p> : myWithdrawals.map((w: any) => {
            const b = STATUS_BADGE[w.status] || STATUS_BADGE.pending;
            return (
              <div key={w.id} className="p-4 rounded-xl border border-border bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{fmtMoney(Number(w.amount))}</span>
                    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", b.cls)}>{b.label}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{format(new Date(w.created_at), "dd/MM/yyyy HH:mm")}</span>
                </div>
                {w.notes && <p className="text-xs text-muted-foreground">Note: {w.notes}</p>}
                {w.admin_notes && <p className="text-xs text-amber-600">Réponse admin: {w.admin_notes}</p>}
                <div className="flex gap-2 text-xs text-muted-foreground">
                  {w.reviewed_at && <span>Revu: {format(new Date(w.reviewed_at), "dd/MM/yy")}</span>}
                  {w.paid_at && <span className="text-emerald-600 font-medium">Payé: {format(new Date(w.paid_at), "dd/MM/yy")}</span>}
                </div>
                {w.status === "pending" && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => cancelWithdrawal.mutate(w.id)}><X className="h-3 w-3 mr-1" /> Annuler</Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ DISPUTES ═══ */}
      {tab === "disputes" && (
        <div className="space-y-2">{myDisputes.length === 0 ? <p className="text-center text-sm text-muted-foreground py-12">Aucune contestation</p> : myDisputes.map((d: any) => {
          const b = STATUS_BADGE[d.status] || STATUS_BADGE.open;
          return (
            <div key={d.id} className="p-3 rounded-xl border border-border bg-card space-y-2">
              <div className="flex items-center justify-between"><span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", b.cls)}>{b.label}</span><span className="text-[10px] text-muted-foreground">{format(new Date(d.created_at), "dd/MM/yy")}</span></div>
              <p className="text-xs text-foreground">{d.reason}</p>
              {d.admin_response && <p className="text-xs text-blue-600">Réponse admin: {d.admin_response}</p>}
              {d.sales_commissions && <p className="text-[10px] text-muted-foreground">Montant: {fmtMoney(Number(d.sales_commissions.commission_amount))}</p>}
            </div>
          );
        })}</div>
      )}

      {/* ═══ TIME ═══ */}
      {tab === "time" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-foreground">Punch In / Out</h3>
            <div className="flex gap-3 items-end">
              <div className="flex-1"><Label className="text-xs">Note (optionnel)</Label><Input value={punchNote} onChange={(e) => setPunchNote(e.target.value)} placeholder="Raison…" /></div>
              <Button onClick={() => punchIn.mutate()} disabled={punchIn.isPending} className="bg-emerald-600 hover:bg-emerald-700"><Timer className="h-4 w-4 mr-1" /> Punch In</Button>
              <Button onClick={() => punchOut.mutate()} disabled={punchOut.isPending} variant="destructive"><Timer className="h-4 w-4 mr-1" /> Punch Out</Button>
            </div>
          </div>
          {myTime.length === 0 ? <p className="text-center text-sm text-muted-foreground py-8">Aucune entrée</p> : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border text-left text-[11px] text-muted-foreground"><th className="pb-2 font-medium">Date</th><th className="pb-2 font-medium">In</th><th className="pb-2 font-medium">Out</th><th className="pb-2 font-medium text-right">Heures</th><th className="pb-2 font-medium">Type</th><th className="pb-2 font-medium">Statut</th></tr></thead><tbody>
              {myTime.map((te: any) => {
                const b = STATUS_BADGE[te.status] || STATUS_BADGE.pending;
                return (
                  <tr key={te.id} className="border-b border-border/50"><td className="py-2 text-foreground">{format(new Date(te.punch_in), "dd/MM/yy")}</td><td className="py-2 text-muted-foreground">{format(new Date(te.punch_in), "HH:mm")}</td><td className="py-2 text-muted-foreground">{te.punch_out ? format(new Date(te.punch_out), "HH:mm") : "—"}</td><td className="py-2 text-right">{te.total_hours ? `${te.total_hours}h` : "—"}</td><td className="py-2 text-muted-foreground">{te.entry_type}</td><td className="py-2"><span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", b.cls)}>{b.label}</span></td></tr>
                );
              })}
            </tbody></table></div>
          )}
        </div>
      )}

      {/* ═══ SCHEDULE ═══ */}
      {tab === "schedule" && (
        <div className="space-y-2">{mySchedule.length === 0 ? <p className="text-center text-sm text-muted-foreground py-12">Aucun horaire assigné</p> : mySchedule.map((s: any) => (
          <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-card">
            <div><p className="text-sm font-medium text-foreground">{DAYS[s.day_of_week]}</p>{s.notes && <p className="text-xs text-muted-foreground">{s.notes}</p>}</div>
            <p className="text-sm font-mono text-foreground">{s.start_time} → {s.end_time}</p>
          </div>
        ))}</div>
      )}

      {/* ═══ MY GRIDS ═══ */}
      {tab === "grids" && (
        <div className="space-y-2">{myGrids.length === 0 ? <p className="text-center text-sm text-muted-foreground py-12">Aucune grille de commission assignée</p> : myGrids.map((g: any) => {
          const r = g.field_sales_commission_rules;
          return (
            <div key={g.id} className="p-4 rounded-xl border border-border bg-card">
              <p className="text-sm font-semibold text-foreground">{r?.rule_name || "—"}</p>
              <p className="text-xs text-muted-foreground mt-1">{r?.rule_type === "base_rate" ? "Taux de base" : r?.rule_type === "volume_bonus" ? "Bonus volume" : r?.rule_type === "service_bonus" ? "Bonus service" : r?.rule_type === "territory_bonus" ? "Bonus territoire" : r?.rule_type}</p>
              <div className="flex gap-4 mt-2 text-xs">
                {Number(r?.bonus_amount) > 0 && <span>Bonus: <span className="font-bold text-emerald-600">{fmtMoney(Number(r.bonus_amount))}</span></span>}
                {Number(r?.bonus_percentage) > 0 && <span>Taux: <span className="font-bold text-blue-600">{r.bonus_percentage}%</span></span>}
                <span>Ventes min: <span className="font-bold">{r?.min_sales || 0}</span></span>
                {r?.max_sales && <span>Max: <span className="font-bold">{r.max_sales}</span></span>}
              </div>
              {g.notes && <p className="text-[10px] text-muted-foreground mt-2">{g.notes}</p>}
            </div>
          );
        })}</div>
      )}

      {/* ═══ TAX DOCUMENTS ═══ */}
      {tab === "tax_docs" && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Mes documents fiscaux</h3>
          {myTaxDocs.length === 0 ? <p className="text-center text-sm text-muted-foreground py-12">Aucun document fiscal disponible</p> : myTaxDocs.map((td: any) => {
            const b = STATUS_BADGE[td.status] || STATUS_BADGE.draft;
            return (
              <div key={td.id} className="p-4 rounded-xl border border-border bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{DOC_TYPES[td.document_type] || td.document_type} — {td.tax_year}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{td.generated_at ? `Généré le ${format(new Date(td.generated_at), "dd/MM/yyyy")}` : "Non généré"}</p>
                  </div>
                  <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded border", b.cls)}>{b.label}</span>
                </div>
                {td.notes && <p className="text-xs text-muted-foreground">{td.notes}</p>}
                {td.status === "sent" && (
                  <Button size="sm" variant="outline" onClick={() => acknowledgeTaxDoc.mutate(td.id)}>
                    <Check className="h-3 w-3 mr-1" /> Confirmer réception
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ DIALOGS ═══ */}
      <Dialog open={withdrawDialog} onOpenChange={setWithdrawDialog}>
        <DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Demander un retrait</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Disponible: <span className="font-bold text-primary">{fmtMoney(available)}</span></p>
            <div><Label className="text-xs">Montant ($)</Label><Input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} max={available} /></div>
            <div><Label className="text-xs">Notes</Label><Textarea value={withdrawNotes} onChange={(e) => setWithdrawNotes(e.target.value)} placeholder="Raison ou détails…" /></div>
          </div>
          <DialogFooter><Button onClick={() => requestWithdrawal.mutate()} disabled={requestWithdrawal.isPending || !withdrawAmount}>{requestWithdrawal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Soumettre"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!disputeDialog} onOpenChange={(o) => !o && setDisputeDialog(null)}>
        <DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Contester une commission</DialogTitle></DialogHeader>
          <div><Label className="text-xs">Raison</Label><Textarea value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} placeholder="Expliquez votre contestation…" /></div>
          <DialogFooter><Button onClick={() => createDispute.mutate()} disabled={createDispute.isPending || !disputeReason}>{createDispute.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Soumettre"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
