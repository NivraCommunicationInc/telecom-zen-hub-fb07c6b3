/**
 * HrTimePage — Full time & punch management.
 * Sections: Live punch | Entries table (filter/edit/delete) | Manual add | Per-employee summary | CSV export
 */
import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Clock, Loader2, LogOut, Plus, Pencil, Trash2, Download, Users, Calendar as CalIcon } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, parseISO, differenceInMinutes } from "date-fns";
import { fr } from "date-fns/locale";
import { resolveProfileNames } from "@/hooks/useProfileName";

const todayISO = () => format(new Date(), "yyyy-MM-dd");

const ENTRY_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "secondary" },
  approved: { label: "Approuvée", variant: "default" },
  rejected: { label: "Rejetée", variant: "destructive" },
  correction_requested: { label: "Correction dem.", variant: "outline" },
};

// Build ISO timestamp from date(YYYY-MM-DD) + time(HH:mm)
const buildIso = (date: string, time: string) => {
  if (!date || !time) return null;
  return new Date(`${date}T${time}:00`).toISOString();
};

// Tick clock for live durations
function useNowTick(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const fmtDur = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = Math.max(0, mins % 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
};

export default function HrTimePage() {
  const qc = useQueryClient();
  const now = useNowTick(30000);

  // ─── Filters ───────────────────────────────────────────────────────────
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterRange, setFilterRange] = useState<"week" | "month" | "custom">("month");
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [customTo, setCustomTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));

  const range = useMemo(() => {
    if (filterRange === "week") return { from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) };
    if (filterRange === "month") return { from: startOfMonth(new Date()), to: endOfMonth(new Date()) };
    return { from: parseISO(customFrom), to: parseISO(customTo) };
  }, [filterRange, customFrom, customTo]);

  // ─── Employees ─────────────────────────────────────────────────────────
  const { data: employees = [] } = useQuery({
    queryKey: ["hr-active-employees-with-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_records")
        .select("user_id, first_name, last_name, job_title, status")
        .eq("status", "active")
        .order("first_name");
      if (error) throw error;
      const rows = data || [];
      const ids = rows.map((r: any) => r.user_id);
      const names = await resolveProfileNames(ids);
      return rows.map((r: any) => ({ ...r, _profile_name: names[r.user_id] }));
    },
  });

  const empMap = useMemo(() => {
    const m: Record<string, any> = {};
    for (const e of employees) m[e.user_id] = e;
    return m;
  }, [employees]);

  const empName = (uid: string) => {
    const e = empMap[uid];
    if (e) {
      const n = `${e.first_name || ""} ${e.last_name || ""}`.trim();
      return n || e._profile_name || "Employé";
    }
    return "Employé";
  };

  // ─── Time entries (range) ──────────────────────────────────────────────
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["hr-time-entries", range.from.toISOString(), range.to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .gte("punch_in", range.from.toISOString())
        .lte("punch_in", range.to.toISOString())
        .order("punch_in", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  // ─── Currently on duty (today, no punch_out) ───────────────────────────
  const { data: onDuty = [] } = useQuery({
    queryKey: ["hr-on-duty"],
    queryFn: async () => {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .gte("punch_in", dayStart.toISOString())
        .is("punch_out", null)
        .order("punch_in", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  // ─── Audit logger ──────────────────────────────────────────────────────
  const logAudit = async (action: string, entityId: string, payload: any, reason?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("hr_audit_log" as any).insert({
      actor_user_id: user?.id || null,
      action,
      entity_type: "time_entry",
      entity_id: entityId,
      details: payload,
      old_value: payload?.old ? JSON.stringify(payload.old) : null,
      new_value: payload?.new ? JSON.stringify(payload.new) : null,
      field_changed: reason ? `reason: ${reason}` : null,
    });
  };

  // ─── Punch out (live) ──────────────────────────────────────────────────
  const punchOutMut = useMutation({
    mutationFn: async (entry: any) => {
      const out = new Date();
      const totalH = differenceInMinutes(out, new Date(entry.punch_in)) / 60 - (entry.break_minutes || 0) / 60;
      const { error } = await supabase
        .from("time_entries")
        .update({ punch_out: out.toISOString(), total_hours: Math.round(totalH * 100) / 100 })
        .eq("id", entry.id);
      if (error) throw error;
      await logAudit("time_entry_punch_out_admin", entry.id, { new: { punch_out: out.toISOString(), total_hours: totalH } });
    },
    onSuccess: () => {
      toast.success("Sortie pointée");
      qc.invalidateQueries({ queryKey: ["hr-on-duty"] });
      qc.invalidateQueries({ queryKey: ["hr-time-entries"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  // ─── Edit dialog ───────────────────────────────────────────────────────
  const [editEntry, setEditEntry] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ date: "", inTime: "", outTime: "", breakMin: "0", notes: "", reason: "" });

  const openEdit = (e: any) => {
    const ins = new Date(e.punch_in);
    const outs = e.punch_out ? new Date(e.punch_out) : null;
    setEditEntry(e);
    setEditForm({
      date: format(ins, "yyyy-MM-dd"),
      inTime: format(ins, "HH:mm"),
      outTime: outs ? format(outs, "HH:mm") : "",
      breakMin: String(e.break_minutes || 0),
      notes: e.notes || "",
      reason: "",
    });
  };

  const editMut = useMutation({
    mutationFn: async () => {
      if (!editEntry) throw new Error("Aucune entrée");
      if (!editForm.reason.trim()) throw new Error("Raison requise (audit)");
      const newIn = buildIso(editForm.date, editForm.inTime);
      const newOut = editForm.outTime ? buildIso(editForm.date, editForm.outTime) : null;
      if (!newIn) throw new Error("Heure d'entrée invalide");
      const breakMin = parseInt(editForm.breakMin) || 0;
      let totalHours: number | null = null;
      if (newOut) {
        totalHours = Math.round((differenceInMinutes(new Date(newOut), new Date(newIn)) / 60 - breakMin / 60) * 100) / 100;
      }
      const { error } = await supabase
        .from("time_entries")
        .update({
          punch_in: newIn,
          punch_out: newOut,
          break_minutes: breakMin,
          total_hours: totalHours,
          notes: editForm.notes || null,
        })
        .eq("id", editEntry.id);
      if (error) throw error;
      await logAudit("time_entry_modified", editEntry.id, {
        old: { punch_in: editEntry.punch_in, punch_out: editEntry.punch_out, break_minutes: editEntry.break_minutes, notes: editEntry.notes },
        new: { punch_in: newIn, punch_out: newOut, break_minutes: breakMin, notes: editForm.notes },
      }, editForm.reason);
    },
    onSuccess: () => {
      toast.success("Entrée modifiée");
      setEditEntry(null);
      qc.invalidateQueries({ queryKey: ["hr-time-entries"] });
      qc.invalidateQueries({ queryKey: ["hr-on-duty"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  // ─── Delete ────────────────────────────────────────────────────────────
  const [deleteEntry, setDeleteEntry] = useState<any | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  const deleteMut = useMutation({
    mutationFn: async () => {
      if (!deleteEntry) throw new Error("Aucune entrée");
      if (!deleteReason.trim()) throw new Error("Raison requise");
      await logAudit("time_entry_deleted", deleteEntry.id, { old: deleteEntry }, deleteReason);
      const { error } = await supabase.from("time_entries").delete().eq("id", deleteEntry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entrée supprimée");
      setDeleteEntry(null);
      setDeleteReason("");
      qc.invalidateQueries({ queryKey: ["hr-time-entries"] });
      qc.invalidateQueries({ queryKey: ["hr-on-duty"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  // ─── Add manual entry ──────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    user_id: "",
    date: todayISO(),
    inTime: "09:00",
    outTime: "",
    breakMin: "0",
    notes: "",
    reason: "",
  });

  const addMut = useMutation({
    mutationFn: async () => {
      if (!addForm.user_id) throw new Error("Sélectionnez un employé");
      if (!addForm.reason.trim()) throw new Error("Raison requise");
      const newIn = buildIso(addForm.date, addForm.inTime);
      const newOut = addForm.outTime ? buildIso(addForm.date, addForm.outTime) : null;
      if (!newIn) throw new Error("Heure d'entrée invalide");
      const breakMin = parseInt(addForm.breakMin) || 0;
      let totalHours: number | null = null;
      if (newOut) totalHours = Math.round((differenceInMinutes(new Date(newOut), new Date(newIn)) / 60 - breakMin / 60) * 100) / 100;
      const { data, error } = await supabase
        .from("time_entries")
        .insert({
          user_id: addForm.user_id,
          punch_in: newIn,
          punch_out: newOut,
          break_minutes: breakMin,
          total_hours: totalHours,
          notes: addForm.notes || null,
          entry_type: "manual",
          status: "approved",
        })
        .select("id")
        .single();
      if (error) throw error;
      await logAudit("time_entry_created_manual", data.id, {
        new: { user_id: addForm.user_id, punch_in: newIn, punch_out: newOut, break_minutes: breakMin, notes: addForm.notes },
      }, addForm.reason);
    },
    onSuccess: () => {
      toast.success("Entrée ajoutée");
      setAddOpen(false);
      setAddForm({ user_id: "", date: todayISO(), inTime: "09:00", outTime: "", breakMin: "0", notes: "", reason: "" });
      qc.invalidateQueries({ queryKey: ["hr-time-entries"] });
      qc.invalidateQueries({ queryKey: ["hr-on-duty"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  // ─── Filtered entries ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return entries.filter((e: any) => filterEmployee === "all" || e.user_id === filterEmployee);
  }, [entries, filterEmployee]);

  // ─── Per-employee summary ──────────────────────────────────────────────
  const summary = useMemo(() => {
    const byUser: Record<string, { hours: number; days: Set<string>; entries: number }> = {};
    for (const e of entries) {
      if (!byUser[e.user_id]) byUser[e.user_id] = { hours: 0, days: new Set(), entries: 0 };
      byUser[e.user_id].hours += Number(e.total_hours || 0);
      byUser[e.user_id].days.add(format(new Date(e.punch_in), "yyyy-MM-dd"));
      byUser[e.user_id].entries += 1;
    }
    return Object.entries(byUser).map(([uid, s]) => ({
      uid,
      name: empName(uid),
      hours: s.hours,
      days: s.days.size,
      avg: s.days.size ? s.hours / s.days.size : 0,
      entries: s.entries,
    })).sort((a, b) => b.hours - a.hours);
  }, [entries, empMap]);

  // ─── CSV export ────────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [["Employé", "Date", "Punch In", "Punch Out", "Pause (min)", "Heures", "Notes", "Statut"]];
    for (const e of filtered) {
      rows.push([
        empName(e.user_id),
        format(new Date(e.punch_in), "yyyy-MM-dd"),
        format(new Date(e.punch_in), "HH:mm"),
        e.punch_out ? format(new Date(e.punch_out), "HH:mm") : "",
        String(e.break_minutes || 0),
        e.total_hours != null ? Number(e.total_hours).toFixed(2) : "",
        (e.notes || "").replace(/[\n,;]/g, " "),
        e.status || "",
      ]);
    }
    const csv = rows.map(r => r.map(c => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `temps_${format(range.from, "yyyy-MM-dd")}_${format(range.to, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exporté");
  };

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Temps & Punch
          </h1>
          <p className="text-xs text-muted-foreground">Gestion en temps réel · Modifications · Résumés · Export</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={exportCSV}>
            <Download className="h-3.5 w-3.5" /> Exporter CSV
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Ajouter une entrée
          </Button>
        </div>
      </div>

      {/* SECTION 1 — On duty */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-600" /> En service maintenant ({onDuty.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {onDuty.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Aucun employé en service.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {onDuty.map((e: any) => {
                const mins = differenceInMinutes(now, new Date(e.punch_in));
                return (
                  <div key={e.id} className="flex items-center justify-between p-3 rounded-md border bg-emerald-50/50 dark:bg-emerald-950/20">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{empName(e.user_id)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Depuis {format(new Date(e.punch_in), "HH:mm")} · <span className="font-mono text-emerald-700 dark:text-emerald-400">{fmtDur(mins)}</span>
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1"
                      disabled={punchOutMut.isPending}
                      onClick={() => punchOutMut.mutate(e)}>
                      <LogOut className="h-3 w-3" /> Sortie
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="entries">
        <TabsList className="h-8">
          <TabsTrigger value="entries" className="text-xs">Entrées</TabsTrigger>
          <TabsTrigger value="summary" className="text-xs">Résumé par employé</TabsTrigger>
        </TabsList>

        {/* SECTION 2 — Entries table */}
        <TabsContent value="entries" className="space-y-3 mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger className="h-8 text-xs w-56"><SelectValue placeholder="Employé" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les employés</SelectItem>
                {employees.map((e: any) => (
                  <SelectItem key={e.user_id} value={e.user_id}>{e.first_name} {e.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterRange} onValueChange={(v: any) => setFilterRange(v)}>
              <SelectTrigger className="h-8 text-xs w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Semaine courante</SelectItem>
                <SelectItem value="month">Mois courant</SelectItem>
                <SelectItem value="custom">Personnalisé</SelectItem>
              </SelectContent>
            </Select>
            {filterRange === "custom" && (
              <>
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-8 text-xs w-36" />
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-8 text-xs w-36" />
              </>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">
              <CalIcon className="h-3 w-3 inline mr-1" />
              {format(range.from, "d MMM", { locale: fr })} → {format(range.to, "d MMM yyyy", { locale: fr })}
            </span>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Aucune entrée.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Employé</TableHead>
                      <TableHead className="text-[10px]">Date</TableHead>
                      <TableHead className="text-[10px]">Entrée</TableHead>
                      <TableHead className="text-[10px]">Sortie</TableHead>
                      <TableHead className="text-[10px]">Pause</TableHead>
                      <TableHead className="text-[10px]">Total</TableHead>
                      <TableHead className="text-[10px]">Notes</TableHead>
                      <TableHead className="text-[10px]">Statut</TableHead>
                      <TableHead className="text-[10px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((e: any) => {
                      const st = ENTRY_STATUS[e.status] || { label: e.status, variant: "secondary" as const };
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="text-xs">{empName(e.user_id)}</TableCell>
                          <TableCell className="text-[10px]">{format(new Date(e.punch_in), "d MMM yyyy", { locale: fr })}</TableCell>
                          <TableCell className="text-[10px] font-mono">{format(new Date(e.punch_in), "HH:mm")}</TableCell>
                          <TableCell className="text-[10px] font-mono">
                            {e.punch_out ? format(new Date(e.punch_out), "HH:mm") : <Badge variant="outline" className="text-[9px]">En cours</Badge>}
                          </TableCell>
                          <TableCell className="text-[10px]">{e.break_minutes || 0}m</TableCell>
                          <TableCell className="text-xs font-medium">{e.total_hours != null ? `${Number(e.total_hours).toFixed(2)}h` : "—"}</TableCell>
                          <TableCell className="text-[10px] max-w-[160px] truncate">{e.notes || "—"}</TableCell>
                          <TableCell><Badge variant={st.variant} className="text-[10px]">{st.label}</Badge></TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => openEdit(e)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => setDeleteEntry(e)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
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

        {/* SECTION 4 — Summary */}
        <TabsContent value="summary" className="mt-3">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Employé</TableHead>
                    <TableHead className="text-[10px] text-right">Jours travaillés</TableHead>
                    <TableHead className="text-[10px] text-right">Total heures</TableHead>
                    <TableHead className="text-[10px] text-right">Moyenne / jour</TableHead>
                    <TableHead className="text-[10px] text-right">Entrées</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-xs text-center text-muted-foreground py-6">Aucune donnée pour la période.</TableCell></TableRow>
                  ) : summary.map((s) => (
                    <TableRow key={s.uid}>
                      <TableCell className="text-xs font-medium">{s.name}</TableCell>
                      <TableCell className="text-xs text-right">{s.days}</TableCell>
                      <TableCell className="text-xs text-right font-semibold text-primary">{s.hours.toFixed(2)}h</TableCell>
                      <TableCell className="text-xs text-right">{s.avg.toFixed(2)}h</TableCell>
                      <TableCell className="text-xs text-right">{s.entries}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* SECTION 3 — Add manual */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Ajouter une entrée de temps</DialogTitle>
            <DialogDescription className="text-xs">Saisie manuelle — un journal d'audit sera créé.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Employé</Label>
              <Select value={addForm.user_id} onValueChange={(v) => setAddForm({ ...addForm, user_id: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e: any) => (
                    <SelectItem key={e.user_id} value={e.user_id}>{e.first_name} {e.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-3">
                <Label className="text-xs">Date</Label>
                <Input type="date" className="h-8 text-xs" value={addForm.date} onChange={(e) => setAddForm({ ...addForm, date: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Entrée</Label>
                <Input type="time" className="h-8 text-xs" value={addForm.inTime} onChange={(e) => setAddForm({ ...addForm, inTime: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Sortie</Label>
                <Input type="time" className="h-8 text-xs" value={addForm.outTime} onChange={(e) => setAddForm({ ...addForm, outTime: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Pause (min)</Label>
                <Input type="number" min="0" className="h-8 text-xs" value={addForm.breakMin} onChange={(e) => setAddForm({ ...addForm, breakMin: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea className="text-xs min-h-[60px]" value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Raison (audit) *</Label>
              <Input className="h-8 text-xs" value={addForm.reason} onChange={(e) => setAddForm({ ...addForm, reason: e.target.value })} placeholder="ex. Oubli de pointage" />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => setAddOpen(false)}>Annuler</Button>
            <Button size="sm" disabled={addMut.isPending} onClick={() => addMut.mutate()}>
              {addMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SECTION 2 — Edit dialog */}
      <Dialog open={!!editEntry} onOpenChange={(o) => !o && setEditEntry(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Modifier l'entrée — {editEntry && empName(editEntry.user_id)}</DialogTitle>
            <DialogDescription className="text-xs">Une raison est requise pour le journal d'audit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-3">
                <Label className="text-xs">Date</Label>
                <Input type="date" className="h-8 text-xs" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Entrée</Label>
                <Input type="time" className="h-8 text-xs" value={editForm.inTime} onChange={(e) => setEditForm({ ...editForm, inTime: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Sortie</Label>
                <Input type="time" className="h-8 text-xs" value={editForm.outTime} onChange={(e) => setEditForm({ ...editForm, outTime: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Pause (min)</Label>
                <Input type="number" min="0" className="h-8 text-xs" value={editForm.breakMin} onChange={(e) => setEditForm({ ...editForm, breakMin: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea className="text-xs min-h-[60px]" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Raison de la modification *</Label>
              <Input className="h-8 text-xs" value={editForm.reason} onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })} placeholder="ex. Correction d'horaire" />
            </div>
          </div>
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => setEditEntry(null)}>Annuler</Button>
            <Button size="sm" disabled={editMut.isPending} onClick={() => editMut.mutate()}>
              {editMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteEntry} onOpenChange={(o) => { if (!o) { setDeleteEntry(null); setDeleteReason(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Supprimer cette entrée ?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {deleteEntry && (
                <>Employé: <strong>{empName(deleteEntry.user_id)}</strong> · {format(new Date(deleteEntry.punch_in), "d MMM yyyy HH:mm", { locale: fr })}</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label className="text-xs">Raison de la suppression *</Label>
            <Input className="h-8 text-xs mt-1" value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder="ex. Doublon, erreur de saisie" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={(ev) => { ev.preventDefault(); deleteMut.mutate(); }}
              disabled={deleteMut.isPending}>
              {deleteMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
