/**
 * RhSchedule — Employee punch in/out + today timeline + week summary.
 * Big clock, real-time status, geolocation captured if available.
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, addDays, isSameDay, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Clock, Loader2, Play, Square, AlertTriangle, CheckCircle2, MapPin,
} from "lucide-react";
import { toast } from "sonner";

const DAY_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DAY_FULL = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function getCoords(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    const t = setTimeout(() => resolve(null), 5000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(t);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => { clearTimeout(t); resolve(null); },
      { timeout: 5000, maximumAge: 60000 },
    );
  });
}

export default function RhSchedule() {
  const qc = useQueryClient();
  const [now, setNow] = useState(new Date());
  const [punchNote, setPunchNote] = useState("");
  const [correctionOpen, setCorrectionOpen] = useState<any>(null);
  const [correctionNote, setCorrectionNote] = useState("");

  // Live clock tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: userId } = useQuery({
    queryKey: ["rh-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
  });

  // Active punch (no punch_out)
  const { data: activePunch, isLoading: loadingActive } = useQuery({
    queryKey: ["rh-active-punch", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from("time_entries")
        .select("*")
        .eq("user_id", userId)
        .is("punch_out", null)
        .order("punch_in", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
    refetchInterval: 30000,
  });

  // Today's entries
  const today = startOfDay(now);
  const { data: todayEntries = [] } = useQuery({
    queryKey: ["rh-today-entries", userId, today.toDateString()],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("time_entries")
        .select("*")
        .eq("user_id", userId)
        .gte("punch_in", today.toISOString())
        .order("punch_in", { ascending: true });
      return data ?? [];
    },
    enabled: !!userId,
  });

  // This week's entries (for the bars chart)
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const { data: weekEntries = [] } = useQuery({
    queryKey: ["rh-week-entries", userId, weekStart.toDateString()],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("time_entries")
        .select("punch_in, punch_out, total_hours")
        .eq("user_id", userId)
        .gte("punch_in", weekStart.toISOString())
        .lte("punch_in", weekEnd.toISOString())
        .order("punch_in", { ascending: true });
      return data ?? [];
    },
    enabled: !!userId,
  });

  // Upcoming recurring schedule (current + next week) from staff_schedules (day_of_week)
  const { data: weekSchedules = [] } = useQuery({
    queryKey: ["rh-week-schedule", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("staff_schedules")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("day_of_week", { ascending: true });
      return data ?? [];
    },
    enabled: !!userId,
  });

  // Punch In
  const punchInMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Non authentifié");
      const coords = await getCoords();
      const { error } = await supabase.from("time_entries").insert({
        user_id: userId,
        punch_in: new Date().toISOString(),
        entry_type: "regular",
        status: "pending",
        notes: punchNote || null,
        punch_in_lat: coords?.lat ?? null,
        punch_in_lng: coords?.lng ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      const t = format(new Date(), "HH:mm");
      toast.success(`Entrée pointée à ${t}`);
      setPunchNote("");
      qc.invalidateQueries({ queryKey: ["rh-active-punch"] });
      qc.invalidateQueries({ queryKey: ["rh-today-entries"] });
      qc.invalidateQueries({ queryKey: ["rh-week-entries"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur lors du punch"),
  });

  // Punch Out
  const punchOutMut = useMutation({
    mutationFn: async () => {
      if (!activePunch) throw new Error("Aucun punch actif");
      const coords = await getCoords();
      const punchOut = new Date();
      const punchIn = new Date(activePunch.punch_in);
      const totalH = (punchOut.getTime() - punchIn.getTime()) / 3600000;
      const breakMins = activePunch.break_minutes || 0;
      const netHours = Math.max(0, totalH - breakMins / 60);

      const { error } = await supabase
        .from("time_entries")
        .update({
          punch_out: punchOut.toISOString(),
          total_hours: Math.round(netHours * 100) / 100,
          notes: punchNote || activePunch.notes,
          punch_out_lat: coords?.lat ?? null,
          punch_out_lng: coords?.lng ?? null,
        })
        .eq("id", activePunch.id);
      if (error) throw error;
    },
    onSuccess: () => {
      const t = format(new Date(), "HH:mm");
      toast.success(`Sortie pointée à ${t}`);
      setPunchNote("");
      qc.invalidateQueries({ queryKey: ["rh-active-punch"] });
      qc.invalidateQueries({ queryKey: ["rh-today-entries"] });
      qc.invalidateQueries({ queryKey: ["rh-week-entries"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  // Correction request
  const correctionMut = useMutation({
    mutationFn: async () => {
      if (!correctionOpen || !correctionNote.trim()) throw new Error("Raison obligatoire");
      const { error } = await supabase
        .from("time_entries")
        .update({
          status: "rejected",
          notes: `${correctionOpen.notes || ""}\n[CORRECTION DEMANDÉE]: ${correctionNote.trim()}`.trim(),
        })
        .eq("id", correctionOpen.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande de correction soumise");
      setCorrectionOpen(null);
      setCorrectionNote("");
      qc.invalidateQueries({ queryKey: ["rh-today-entries"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  // Calculate today total + elapsed
  const todayTotalH = todayEntries.reduce((s: number, e: any) => s + (Number(e.total_hours) || 0), 0);
  const elapsed = activePunch
    ? (now.getTime() - new Date(activePunch.punch_in).getTime()) / 3600000
    : 0;
  const liveTotal = todayTotalH + elapsed;
  const onDuty = !!activePunch;

  // Week aggregation per day
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekHoursPerDay = weekDays.map((day) => {
    const sum = weekEntries
      .filter((e: any) => isSameDay(new Date(e.punch_in), day))
      .reduce((s: number, e: any) => s + (Number(e.total_hours) || 0), 0);
    return { day, hours: Math.round(sum * 10) / 10 };
  });
  const weekTotal = weekHoursPerDay.reduce((s, d) => s + d.hours, 0);
  const maxHoursDay = Math.max(...weekHoursPerDay.map((d) => d.hours), 1);

  if (loadingActive) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const fmtH = (h: number) => {
    const totalMins = Math.round(h * 60);
    const hh = Math.floor(totalMins / 60);
    const mm = totalMins % 60;
    return `${hh}h ${mm.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Clock className="h-6 w-6 text-violet-600" />
          Mon horaire & Punch
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Pointage, journée et semaine en temps réel</p>
      </div>

      {/* ───── TOP — Big clock + status ───── */}
      <Card className={cn(
        "border-2 transition-colors",
        onDuty
          ? "border-emerald-400 dark:border-emerald-700 bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/20"
          : "border-border bg-gradient-to-br from-muted/40 to-background",
      )}>
        <CardContent className="py-8 px-6">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            {/* Big clock */}
            <div className="text-center lg:text-left">
              <p className="text-6xl lg:text-7xl font-mono font-bold text-foreground tabular-nums">
                {format(now, "HH:mm:ss")}
              </p>
              <p className="text-sm text-muted-foreground mt-1 capitalize">
                {format(now, "EEEE d MMMM yyyy", { locale: fr })}
              </p>
              <Badge
                variant={onDuty ? "default" : "secondary"}
                className={cn(
                  "mt-3 text-xs uppercase tracking-wider",
                  onDuty ? "bg-emerald-600 hover:bg-emerald-700" : "",
                )}
              >
                {onDuty ? "✓ EN SERVICE" : "○ HORS SERVICE"}
              </Badge>
              {onDuty && (
                <p className="text-xs text-muted-foreground mt-2">
                  Depuis {format(new Date(activePunch.punch_in), "HH:mm")} · {fmtH(elapsed)}
                </p>
              )}
            </div>

            {/* Big punch button */}
            <div className="flex flex-col gap-3 w-full lg:w-auto items-stretch lg:items-end">
              <Button
                size="lg"
                variant={onDuty ? "destructive" : "default"}
                className={cn(
                  "h-16 px-10 text-lg font-bold gap-3 shadow-lg",
                  !onDuty && "bg-emerald-600 hover:bg-emerald-700",
                )}
                onClick={() => onDuty ? punchOutMut.mutate() : punchInMut.mutate()}
                disabled={punchInMut.isPending || punchOutMut.isPending}
              >
                {(punchInMut.isPending || punchOutMut.isPending) ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : onDuty ? (
                  <><Square className="h-6 w-6" />Pointer la sortie</>
                ) : (
                  <><Play className="h-6 w-6" />Pointer l'entrée</>
                )}
              </Button>
              <Textarea
                value={punchNote}
                onChange={(e) => setPunchNote(e.target.value)}
                placeholder="Note (optionnel)…"
                rows={1}
                className="text-xs w-full lg:w-72"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ───── MIDDLE — Today timeline ───── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Aujourd'hui</span>
            <span className="text-xs text-muted-foreground font-normal">
              Total: <span className="font-bold text-foreground">{fmtH(liveTotal)}</span>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayEntries.length === 0 && !onDuty ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucun pointage aujourd'hui.</p>
          ) : (
            <div className="space-y-2">
              {todayEntries.map((t: any) => {
                const isActive = !t.punch_out;
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "flex items-center justify-between gap-3 py-2 px-3 rounded-md border",
                      isActive
                        ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                        : "bg-muted/40 border-transparent",
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn("h-2 w-2 rounded-full shrink-0", isActive ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground")} />
                      <div className="text-sm font-mono">
                        <span className="font-semibold">{format(new Date(t.punch_in), "HH:mm")}</span>
                        <span className="text-muted-foreground"> entrée</span>
                        {t.punch_out && (
                          <>
                            <span className="text-muted-foreground"> → </span>
                            <span className="font-semibold">{format(new Date(t.punch_out), "HH:mm")}</span>
                            <span className="text-muted-foreground"> sortie</span>
                          </>
                        )}
                        {isActive && <span className="ml-2 text-xs text-emerald-600 font-semibold">en cours…</span>}
                      </div>
                      {(t.punch_in_lat || t.punch_out_lat) && (
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {t.total_hours != null && (
                        <span className="text-xs font-bold text-foreground">{Number(t.total_hours).toFixed(1)}h</span>
                      )}
                      {t.status === "approved" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                      {!isActive && t.status !== "approved" && (
                        <Button
                          size="icon" variant="ghost" className="h-6 w-6"
                          onClick={() => { setCorrectionOpen(t); setCorrectionNote(""); }}
                          title="Demander correction"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ───── BOTTOM — Week summary bars ───── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Cette semaine ({format(weekStart, "d MMM", { locale: fr })} – {format(weekEnd, "d MMM", { locale: fr })})</span>
            <span className="text-xs text-muted-foreground font-normal">
              Total: <span className="font-bold text-foreground">{fmtH(weekTotal)}</span>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 items-end h-32">
            {weekHoursPerDay.map((d, idx) => {
              const isToday = isSameDay(d.day, now);
              const heightPct = maxHoursDay > 0 ? (d.hours / maxHoursDay) * 100 : 0;
              return (
                <div key={idx} className="flex flex-col items-center justify-end gap-1.5 h-full">
                  <span className="text-[10px] font-mono text-muted-foreground">{d.hours.toFixed(1)}h</span>
                  <div
                    className={cn(
                      "w-full rounded-t-md transition-all",
                      isToday ? "bg-violet-500" : "bg-violet-200 dark:bg-violet-900/50",
                      d.hours === 0 && "bg-muted",
                    )}
                    style={{ height: `${Math.max(heightPct, 2)}%` }}
                  />
                  <span className={cn(
                    "text-[10px] font-medium",
                    isToday ? "text-violet-600 dark:text-violet-400 font-bold" : "text-muted-foreground",
                  )}>
                    {DAY_SHORT[d.day.getDay()]}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ───── UPCOMING — Recurring schedule (this week + next) ───── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4 text-violet-600" />
            Mon horaire à venir
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {weekSchedules.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              Aucun horaire récurrent publié. Contactez votre superviseur.
            </p>
          ) : (
            <>
              {[0, 1].map((weekOffset) => {
                const wkStart = addDays(weekStart, weekOffset * 7);
                const wkLabel = weekOffset === 0 ? "Cette semaine" : "Semaine prochaine";
                return (
                  <div key={weekOffset}>
                    <p className="text-xs font-semibold text-foreground mb-2">
                      {wkLabel}{" "}
                      <span className="text-muted-foreground font-normal">
                        ({format(wkStart, "d MMM", { locale: fr })} – {format(addDays(wkStart, 6), "d MMM", { locale: fr })})
                      </span>
                    </p>
                    <div className="grid grid-cols-7 gap-1.5">
                      {Array.from({ length: 7 }, (_, i) => {
                        const day = addDays(wkStart, i);
                        const slots = weekSchedules.filter((s: any) => s.day_of_week === day.getDay());
                        const isToday = isSameDay(day, now);
                        return (
                          <div
                            key={i}
                            className={cn(
                              "rounded-md border p-2 min-h-[70px] flex flex-col gap-1",
                              isToday
                                ? "bg-violet-100 dark:bg-violet-950/40 border-violet-400"
                                : slots.length > 0
                                  ? "bg-muted/30 border-border"
                                  : "border-dashed border-border bg-background",
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className={cn("text-[10px] font-medium uppercase", isToday ? "text-violet-700 dark:text-violet-300" : "text-muted-foreground")}>
                                {DAY_SHORT[day.getDay()]}
                              </span>
                              <span className={cn("text-[10px] font-mono", isToday ? "text-violet-700 dark:text-violet-300 font-bold" : "text-muted-foreground")}>
                                {format(day, "d")}
                              </span>
                            </div>
                            {slots.length === 0 ? (
                              <span className="text-[10px] text-muted-foreground italic">Repos</span>
                            ) : (
                              slots.map((s: any) => (
                                <span key={s.id} className="text-[10px] font-mono text-foreground">
                                  {s.start_time?.slice(0, 5)}–{s.end_time?.slice(0, 5)}
                                </span>
                              ))
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </CardContent>
      </Card>

      {/* Correction dialog */}
      <Dialog open={!!correctionOpen} onOpenChange={(o) => !o && setCorrectionOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Demander une correction
            </DialogTitle>
          </DialogHeader>
          {correctionOpen && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p>{format(new Date(correctionOpen.punch_in), "d MMMM yyyy", { locale: fr })}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(correctionOpen.punch_in), "HH:mm")}
                  {correctionOpen.punch_out ? ` — ${format(new Date(correctionOpen.punch_out), "HH:mm")}` : ""}
                  {correctionOpen.total_hours ? ` · ${Number(correctionOpen.total_hours).toFixed(1)}h` : ""}
                </p>
              </div>
              <div>
                <Label>Raison de la correction *</Label>
                <Textarea value={correctionNote} onChange={(e) => setCorrectionNote(e.target.value)}
                  placeholder="Expliquez l'erreur à corriger…" rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionOpen(null)}>Annuler</Button>
            <Button onClick={() => correctionMut.mutate()} disabled={correctionMut.isPending || !correctionNote.trim()}>
              {correctionMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Soumettre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
