/**
 * HrSchedulesPage — Full schedule management.
 * Sections: Weekly calendar grid | Create/Edit shift | Copy week | Planned hours summary | Leave requests
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Calendar, Plus, Loader2, Pencil, Trash2, Copy, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import {
  format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, isSameDay,
  startOfMonth, endOfMonth, parseISO, differenceInMinutes, eachDayOfInterval
} from "date-fns";
import { fr } from "date-fns/locale";

const SHIFT_TYPES: Record<string, { label: string; color: string }> = {
  regular: { label: "Régulier", color: "bg-primary/15 text-primary border-primary/30" },
  training: { label: "Formation", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  meeting: { label: "Réunion", color: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30" },
  field: { label: "Terrain", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  remote: { label: "Télétravail", color: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30" },
};

const LEAVE_TYPES: Record<string, string> = {
  vacation: "Vacances", sick: "Maladie", personal: "Personnel",
  unpaid: "Sans solde", bereavement: "Deuil", parental: "Parental", other: "Autre",
};

const LEAVE_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "secondary" },
  approved: { label: "Approuvé", variant: "default" },
  rejected: { label: "Rejeté", variant: "destructive" },
  cancelled: { label: "Annulé", variant: "outline" },
};

export default function HrSchedulesPage() {
  const qc = useQueryClient();
  const [weekRef, setWeekRef] = useState(new Date());
  const weekStart = useMemo(() => startOfWeek(weekRef, { weekStartsOn: 1 }), [weekRef]);
  const weekEnd = useMemo(() => endOfWeek(weekRef, { weekStartsOn: 1 }), [weekRef]);
  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

  // ─── Employees ─────────────────────────────────────────────────────────
  const { data: employees = [] } = useQuery({
    queryKey: ["hr-active-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_records")
        .select("user_id, first_name, last_name, job_title, status")
        .eq("status", "active")
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
  });

  const empMap = useMemo(() => {
    const m: Record<string, any> = {};
    for (const e of employees) m[e.user_id] = e;
    return m;
  }, [employees]);

  const empName = (uid: string) => {
    const e = empMap[uid];
    return e ? `${e.first_name || ""} ${e.last_name || ""}`.trim() || uid.slice(0, 8) : uid.slice(0, 8);
  };

  // ─── Shifts for current week ───────────────────────────────────────────
  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ["hr-shifts", weekStart.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_shifts" as any)
        .select("*")
        .gte("shift_date", format(weekStart, "yyyy-MM-dd"))
        .lte("shift_date", format(weekEnd, "yyyy-MM-dd"))
        .order("start_time");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // ─── Shifts for current month (for summary) ────────────────────────────
  const monthStart = useMemo(() => startOfMonth(weekRef), [weekRef]);
  const monthEnd = useMemo(() => endOfMonth(weekRef), [weekRef]);

  const { data: monthShifts = [] } = useQuery({
    queryKey: ["hr-shifts-month", monthStart.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_shifts" as any)
        .select("*")
        .gte("shift_date", format(monthStart, "yyyy-MM-dd"))
        .lte("shift_date", format(monthEnd, "yyyy-MM-dd"));
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // ─── Time entries for variance ─────────────────────────────────────────
  const { data: timeEntries = [] } = useQuery({
    queryKey: ["hr-time-entries-week", weekStart.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("user_id, total_hours, punch_in")
        .gte("punch_in", weekStart.toISOString())
        .lte("punch_in", weekEnd.toISOString());
      if (error) throw error;
      return data || [];
    },
  });

  // ─── Leave requests for week ───────────────────────────────────────────
  const { data: leaves = [] } = useQuery({
    queryKey: ["hr-leaves-week", weekStart.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_leave_requests" as any)
        .select("*")
        .lte("start_date", format(weekEnd, "yyyy-MM-dd"))
        .gte("end_date", format(weekStart, "yyyy-MM-dd"))
        .order("start_date");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // ─── Index: shifts by user+date, leaves by user+date ───────────────────
  const shiftIndex = useMemo(() => {
    const idx: Record<string, any[]> = {};
    for (const s of shifts) {
      const k = `${s.user_id}|${s.shift_date}`;
      if (!idx[k]) idx[k] = [];
      idx[k].push(s);
    }
    return idx;
  }, [shifts]);

  const leaveIndex = useMemo(() => {
    const idx: Record<string, any[]> = {};
    for (const l of leaves) {
      if (l.status !== "approved") continue;
      const days = eachDayOfInterval({ start: parseISO(l.start_date), end: parseISO(l.end_date) });
      for (const d of days) {
        const k = `${l.user_id}|${format(d, "yyyy-MM-dd")}`;
        if (!idx[k]) idx[k] = [];
        idx[k].push(l);
      }
    }
    return idx;
  }, [leaves]);

  // ─── Mutations ─────────────────────────────────────────────────────────
  const [shiftDialog, setShiftDialog] = useState<{ open: boolean; mode: "create" | "edit"; data: any | null }>({ open: false, mode: "create", data: null });
  const [shiftForm, setShiftForm] = useState({
    user_id: "", shift_date: format(new Date(), "yyyy-MM-dd"),
    start_time: "09:00", end_time: "17:00", shift_type: "regular", notes: "",
  });

  const openCreate = (presetDate?: Date, presetUser?: string) => {
    setShiftForm({
      user_id: presetUser || "",
      shift_date: format(presetDate || new Date(), "yyyy-MM-dd"),
      start_time: "09:00", end_time: "17:00", shift_type: "regular", notes: "",
    });
    setShiftDialog({ open: true, mode: "create", data: null });
  };

  const openEdit = (s: any) => {
    setShiftForm({
      user_id: s.user_id, shift_date: s.shift_date,
      start_time: s.start_time?.slice(0, 5) || "09:00",
      end_time: s.end_time?.slice(0, 5) || "17:00",
      shift_type: s.shift_type || "regular", notes: s.notes || "",
    });
    setShiftDialog({ open: true, mode: "edit", data: s });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!shiftForm.user_id) throw new Error("Sélectionnez un employé");
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        user_id: shiftForm.user_id,
        shift_date: shiftForm.shift_date,
        start_time: shiftForm.start_time,
        end_time: shiftForm.end_time,
        shift_type: shiftForm.shift_type,
        notes: shiftForm.notes || null,
      };
      if (shiftDialog.mode === "create") {
        const { error } = await supabase.from("employee_shifts" as any).insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employee_shifts" as any).update(payload).eq("id", shiftDialog.data.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(shiftDialog.mode === "create" ? "Quart créé" : "Quart modifié");
      setShiftDialog({ open: false, mode: "create", data: null });
      qc.invalidateQueries({ queryKey: ["hr-shifts"] });
      qc.invalidateQueries({ queryKey: ["hr-shifts-month"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const [deleteShift, setDeleteShift] = useState<any | null>(null);
  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!deleteShift) return;
      const { error } = await supabase.from("employee_shifts" as any).delete().eq("id", deleteShift.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Quart supprimé");
      setDeleteShift(null);
      qc.invalidateQueries({ queryKey: ["hr-shifts"] });
      qc.invalidateQueries({ queryKey: ["hr-shifts-month"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  // ─── Copy week ─────────────────────────────────────────────────────────
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyTarget, setCopyTarget] = useState(format(addWeeks(weekStart, 1), "yyyy-MM-dd"));

  const copyMut = useMutation({
    mutationFn: async () => {
      if (shifts.length === 0) throw new Error("Aucun quart à copier");
      const targetStart = startOfWeek(parseISO(copyTarget), { weekStartsOn: 1 });
      const { data: { user } } = await supabase.auth.getUser();
      const rows = shifts.map((s: any) => {
        const offset = differenceInMinutes(parseISO(s.shift_date), weekStart) / (60 * 24);
        const newDate = addDays(targetStart, Math.round(offset));
        return {
          user_id: s.user_id,
          shift_date: format(newDate, "yyyy-MM-dd"),
          start_time: s.start_time,
          end_time: s.end_time,
          shift_type: s.shift_type,
          notes: s.notes,
          created_by: user?.id || null,
        };
      });
      const { error } = await supabase.from("employee_shifts" as any).insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} quart(s) copié(s)`);
      setCopyOpen(false);
      qc.invalidateQueries({ queryKey: ["hr-shifts"] });
      qc.invalidateQueries({ queryKey: ["hr-shifts-month"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  // ─── Helpers ───────────────────────────────────────────────────────────
  const shiftHours = (s: any): number => {
    if (!s.start_time || !s.end_time) return 0;
    const [sh, sm] = s.start_time.split(":").map(Number);
    const [eh, em] = s.end_time.split(":").map(Number);
    return Math.max(0, (eh + em / 60) - (sh + sm / 60));
  };

  // ─── Summary per employee ──────────────────────────────────────────────
  const summary = useMemo(() => {
    const rows: { uid: string; name: string; weekHours: number; monthHours: number; restDays: number; workedHours: number; variance: number }[] = [];
    for (const e of employees) {
      const wk = shifts.filter((s: any) => s.user_id === e.user_id);
      const mo = monthShifts.filter((s: any) => s.user_id === e.user_id);
      const weekHours = wk.reduce((sum, s) => sum + shiftHours(s), 0);
      const monthHours = mo.reduce((sum, s) => sum + shiftHours(s), 0);
      const workedDates = new Set(wk.map((s: any) => s.shift_date));
      const restDays = 7 - workedDates.size;
      const workedHours = timeEntries.filter((t: any) => t.user_id === e.user_id).reduce((sum, t: any) => sum + Number(t.total_hours || 0), 0);
      const variance = workedHours - weekHours;
      rows.push({
        uid: e.user_id, name: empName(e.user_id),
        weekHours, monthHours, restDays, workedHours, variance,
      });
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }, [employees, shifts, monthShifts, timeEntries]);

  // ─── Render shift cell ─────────────────────────────────────────────────
  const renderCell = (uid: string, day: Date) => {
    const k = `${uid}|${format(day, "yyyy-MM-dd")}`;
    const dayShifts = shiftIndex[k] || [];
    const dayLeaves = leaveIndex[k] || [];

    if (dayLeaves.length > 0) {
      return (
        <div className="p-1 min-h-[44px] flex items-center justify-center cursor-pointer hover:bg-muted/30 rounded"
          onClick={() => openCreate(day, uid)}>
          <Badge variant="destructive" className="text-[9px]">{LEAVE_TYPES[dayLeaves[0].leave_type]}</Badge>
        </div>
      );
    }
    if (dayShifts.length === 0) {
      return (
        <div className="p-1 min-h-[44px] flex items-center justify-center text-[10px] text-muted-foreground/60 cursor-pointer hover:bg-muted/30 rounded"
          onClick={() => openCreate(day, uid)}>
          Repos
        </div>
      );
    }
    return (
      <div className="p-1 min-h-[44px] space-y-1">
        {dayShifts.map((s: any) => {
          const t = SHIFT_TYPES[s.shift_type] || SHIFT_TYPES.regular;
          return (
            <div key={s.id} className={`text-[10px] px-1.5 py-1 rounded border ${t.color} group relative cursor-pointer`}
              onClick={() => openEdit(s)}>
              <div className="font-mono font-medium">{s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}</div>
              <div className="text-[9px] opacity-80">{t.label}</div>
              <button onClick={(ev) => { ev.stopPropagation(); setDeleteShift(s); }}
                className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 hover:bg-destructive/20 rounded p-0.5">
                <Trash2 className="h-2.5 w-2.5 text-destructive" />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" /> Horaires
          </h1>
          <p className="text-xs text-muted-foreground">Calendrier hebdomadaire · Quarts · Congés · Variance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setCopyOpen(true)}>
            <Copy className="h-3.5 w-3.5" /> Copier la semaine
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1" onClick={() => openCreate()}>
            <Plus className="h-3.5 w-3.5" /> Ajouter un quart
          </Button>
        </div>
      </div>

      {/* Week navigation */}
      <Card>
        <CardContent className="p-3 flex items-center justify-between">
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setWeekRef(subWeeks(weekRef, 1))}>
            <ChevronLeft className="h-3.5 w-3.5" /> Précédente
          </Button>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Semaine du</p>
            <p className="text-sm font-bold">
              {format(weekStart, "d MMM", { locale: fr })} → {format(weekEnd, "d MMM yyyy", { locale: fr })}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setWeekRef(new Date())}>Aujourd'hui</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setWeekRef(addWeeks(weekRef, 1))}>
              Suivante <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="grid">
        <TabsList className="h-8">
          <TabsTrigger value="grid" className="text-xs">Calendrier</TabsTrigger>
          <TabsTrigger value="summary" className="text-xs">Résumé heures</TabsTrigger>
          <TabsTrigger value="leaves" className="text-xs">Absences ({leaves.length})</TabsTrigger>
        </TabsList>

        {/* SECTION 1 — Grid */}
        <TabsContent value="grid" className="mt-3">
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-[10px] text-left p-2 sticky left-0 bg-muted/30 z-10 min-w-[140px]">Employé</th>
                      {weekDays.map((d) => (
                        <th key={d.toISOString()} className={`text-[10px] p-2 min-w-[110px] text-center ${isSameDay(d, new Date()) ? "bg-primary/10" : ""}`}>
                          <div className="font-medium">{format(d, "EEE", { locale: fr })}</div>
                          <div className="text-muted-foreground font-normal">{format(d, "d MMM", { locale: fr })}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {employees.length === 0 ? (
                      <tr><td colSpan={8} className="text-xs text-center text-muted-foreground py-6">Aucun employé actif.</td></tr>
                    ) : employees.map((e: any) => (
                      <tr key={e.user_id} className="border-b hover:bg-muted/20">
                        <td className="text-xs p-2 sticky left-0 bg-card z-10">
                          <div className="font-medium truncate">{e.first_name} {e.last_name}</div>
                          {e.job_title && <div className="text-[10px] text-muted-foreground truncate">{e.job_title}</div>}
                        </td>
                        {weekDays.map((d) => (
                          <td key={d.toISOString()} className={`align-top border-l ${isSameDay(d, new Date()) ? "bg-primary/5" : ""}`}>
                            {renderCell(e.user_id, d)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
            <span>Légende:</span>
            {Object.entries(SHIFT_TYPES).map(([k, t]) => (
              <span key={k} className={`px-1.5 py-0.5 rounded border ${t.color}`}>{t.label}</span>
            ))}
            <span className="px-1.5 py-0.5 rounded border bg-destructive/15 text-destructive border-destructive/30">Congé approuvé</span>
          </div>
        </TabsContent>

        {/* SECTION 4 — Summary */}
        <TabsContent value="summary" className="mt-3">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Employé</TableHead>
                    <TableHead className="text-[10px] text-right">Planifié (semaine)</TableHead>
                    <TableHead className="text-[10px] text-right">Planifié (mois)</TableHead>
                    <TableHead className="text-[10px] text-right">Jours repos</TableHead>
                    <TableHead className="text-[10px] text-right">Travaillé</TableHead>
                    <TableHead className="text-[10px] text-right">Variance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-xs text-center text-muted-foreground py-6">Aucun employé.</TableCell></TableRow>
                  ) : summary.map((s) => {
                    const varianceClass = s.variance > 0.5 ? "text-emerald-600" : s.variance < -0.5 ? "text-destructive" : "text-muted-foreground";
                    return (
                      <TableRow key={s.uid}>
                        <TableCell className="text-xs font-medium">{s.name}</TableCell>
                        <TableCell className="text-xs text-right font-semibold">{s.weekHours.toFixed(1)}h</TableCell>
                        <TableCell className="text-xs text-right">{s.monthHours.toFixed(1)}h</TableCell>
                        <TableCell className="text-xs text-right">{s.restDays}</TableCell>
                        <TableCell className="text-xs text-right">{s.workedHours.toFixed(1)}h</TableCell>
                        <TableCell className={`text-xs text-right font-mono ${varianceClass}`}>
                          {s.variance >= 0 ? "+" : ""}{s.variance.toFixed(1)}h
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SECTION 5 — Leaves */}
        <TabsContent value="leaves" className="mt-3">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Employé</TableHead>
                    <TableHead className="text-[10px]">Type</TableHead>
                    <TableHead className="text-[10px]">Dates</TableHead>
                    <TableHead className="text-[10px]">Conflits horaire</TableHead>
                    <TableHead className="text-[10px]">Statut</TableHead>
                    <TableHead className="text-[10px]">Raison</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaves.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-xs text-center text-muted-foreground py-6">Aucune demande de congé pour cette semaine.</TableCell></TableRow>
                  ) : leaves.map((l: any) => {
                    const days = eachDayOfInterval({ start: parseISO(l.start_date), end: parseISO(l.end_date) });
                    const conflicts = l.status === "approved" ? days.filter((d) => shiftIndex[`${l.user_id}|${format(d, "yyyy-MM-dd")}`]?.length > 0).length : 0;
                    const st = LEAVE_STATUS[l.status] || { label: l.status, variant: "secondary" as const };
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs font-medium">{empName(l.user_id)}</TableCell>
                        <TableCell className="text-xs">{LEAVE_TYPES[l.leave_type] || l.leave_type}</TableCell>
                        <TableCell className="text-[10px]">
                          {format(parseISO(l.start_date), "d MMM", { locale: fr })} → {format(parseISO(l.end_date), "d MMM yyyy", { locale: fr })}
                        </TableCell>
                        <TableCell>
                          {conflicts > 0
                            ? <Badge variant="destructive" className="text-[10px]">{conflicts} conflit(s)</Badge>
                            : <span className="text-[10px] text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell><Badge variant={st.variant} className="text-[10px]">{st.label}</Badge></TableCell>
                        <TableCell className="text-[10px] max-w-[200px] truncate">{l.reason || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* SECTION 2 — Create/Edit dialog */}
      <Dialog open={shiftDialog.open} onOpenChange={(o) => setShiftDialog((d) => ({ ...d, open: o }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">{shiftDialog.mode === "create" ? "Ajouter un quart" : "Modifier le quart"}</DialogTitle>
            <DialogDescription className="text-xs">
              {shiftDialog.mode === "edit" && shiftDialog.data && `${empName(shiftDialog.data.user_id)} · ${format(parseISO(shiftDialog.data.shift_date), "d MMM yyyy", { locale: fr })}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Employé</Label>
              <Select value={shiftForm.user_id} onValueChange={(v) => setShiftForm({ ...shiftForm, user_id: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e: any) => (
                    <SelectItem key={e.user_id} value={e.user_id}>{e.first_name} {e.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" className="h-8 text-xs" value={shiftForm.shift_date} onChange={(e) => setShiftForm({ ...shiftForm, shift_date: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Début</Label>
                <Input type="time" className="h-8 text-xs" value={shiftForm.start_time} onChange={(e) => setShiftForm({ ...shiftForm, start_time: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Fin</Label>
                <Input type="time" className="h-8 text-xs" value={shiftForm.end_time} onChange={(e) => setShiftForm({ ...shiftForm, end_time: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={shiftForm.shift_type} onValueChange={(v) => setShiftForm({ ...shiftForm, shift_type: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SHIFT_TYPES).map(([k, t]) => (
                    <SelectItem key={k} value={k}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea className="text-xs min-h-[60px]" value={shiftForm.notes} onChange={(e) => setShiftForm({ ...shiftForm, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => setShiftDialog({ open: false, mode: "create", data: null })}>Annuler</Button>
            <Button size="sm" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
              {saveMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : (shiftDialog.mode === "create" ? "Créer" : "Enregistrer")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SECTION 3 — Copy week dialog */}
      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Copier la semaine</DialogTitle>
            <DialogDescription className="text-xs">
              Copie {shifts.length} quart(s) vers la semaine sélectionnée.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Semaine cible (n'importe quel jour)</Label>
            <Input type="date" className="h-8 text-xs" value={copyTarget} onChange={(e) => setCopyTarget(e.target.value)} />
            <p className="text-[10px] text-muted-foreground">
              Source: {format(weekStart, "d MMM", { locale: fr })} → {format(weekEnd, "d MMM yyyy", { locale: fr })}
            </p>
          </div>
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => setCopyOpen(false)}>Annuler</Button>
            <Button size="sm" disabled={copyMut.isPending || shifts.length === 0} onClick={() => copyMut.mutate()}>
              {copyMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Copier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteShift} onOpenChange={(o) => !o && setDeleteShift(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Supprimer ce quart ?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {deleteShift && `${empName(deleteShift.user_id)} · ${format(parseISO(deleteShift.shift_date), "d MMM yyyy", { locale: fr })} · ${deleteShift.start_time?.slice(0, 5)}–${deleteShift.end_time?.slice(0, 5)}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={(ev) => { ev.preventDefault(); deleteMut.mutate(); }} disabled={deleteMut.isPending}>
              {deleteMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
