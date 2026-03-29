/**
 * RhSchedule — Employee schedule + Punch In/Out system.
 * Uses time_entries (punch_in/punch_out) and staff_schedules.
 */
import { useState } from "react";
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
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Clock, Loader2, Play, Square, AlertTriangle, FileText, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

export default function RhSchedule() {
  const [correctionOpen, setCorrectionOpen] = useState<any>(null);
  const [correctionNote, setCorrectionNote] = useState("");
  const [punchNote, setPunchNote] = useState("");
  const queryClient = useQueryClient();

  const { data: userId } = useQuery({
    queryKey: ["rh-user-id"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id ?? null;
    },
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
    refetchInterval: 30000, // real-time refresh every 30s
  });

  // Time entries history
  const { data: timeEntries, isLoading } = useQuery({
    queryKey: ["rh-time-entries", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("time_entries")
        .select("*")
        .eq("user_id", userId)
        .order("punch_in", { ascending: false })
        .limit(30);
      return data ?? [];
    },
    enabled: !!userId,
  });

  // Schedules
  const { data: schedules } = useQuery({
    queryKey: ["rh-schedules", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("staff_schedules")
        .select("*")
        .eq("user_id", userId)
        .gte("effective_from", new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10))
        .order("day_of_week", { ascending: true });
      return data ?? [];
    },
    enabled: !!userId,
  });

  // Punch In
  const punchInMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Non authentifié");
      const { error } = await supabase
        .from("time_entries")
        .insert({
          user_id: userId,
          punch_in: new Date().toISOString(),
          entry_type: "regular",
          status: "pending",
          notes: punchNote || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Punch In enregistré ✓");
      setPunchNote("");
      queryClient.invalidateQueries({ queryKey: ["rh-active-punch"] });
      queryClient.invalidateQueries({ queryKey: ["rh-time-entries"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur lors du punch"),
  });

  // Punch Out
  const punchOutMutation = useMutation({
    mutationFn: async () => {
      if (!activePunch) throw new Error("Aucun punch actif");
      const punchOut = new Date();
      const punchIn = new Date(activePunch.punch_in);
      const totalHours = (punchOut.getTime() - punchIn.getTime()) / 3600000;
      const breakMins = activePunch.break_minutes || 0;
      const netHours = Math.max(0, totalHours - breakMins / 60);

      const { error } = await supabase
        .from("time_entries")
        .update({
          punch_out: punchOut.toISOString(),
          total_hours: Math.round(netHours * 100) / 100,
          notes: punchNote || activePunch.notes,
        })
        .eq("id", activePunch.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Punch Out enregistré ✓");
      setPunchNote("");
      queryClient.invalidateQueries({ queryKey: ["rh-active-punch"] });
      queryClient.invalidateQueries({ queryKey: ["rh-time-entries"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur lors du punch out"),
  });

  // Correction request
  const correctionMutation = useMutation({
    mutationFn: async () => {
      if (!correctionOpen || !correctionNote.trim()) throw new Error("Raison obligatoire");
      const { error } = await supabase
        .from("time_entries")
        .update({
          status: "correction_requested",
          notes: `${correctionOpen.notes || ""}\n[CORRECTION DEMANDÉE]: ${correctionNote.trim()}`.trim(),
        })
        .eq("id", correctionOpen.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande de correction soumise");
      setCorrectionOpen(null);
      setCorrectionNote("");
      queryClient.invalidateQueries({ queryKey: ["rh-time-entries"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

  if (isLoading || loadingActive) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const elapsed = activePunch
    ? ((Date.now() - new Date(activePunch.punch_in).getTime()) / 3600000).toFixed(1)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Clock className="h-6 w-6 text-primary" />
          Mon horaire & Punch
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Pointage en temps réel et horaire planifié</p>
      </div>

      {/* Active Punch / Punch Actions */}
      <Card className={cn(
        "border-2 transition-colors",
        activePunch ? "border-emerald-400 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-border"
      )}>
        <CardContent className="py-5 px-5">
          {activePunch ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
                  <div>
                    <p className="text-sm font-bold text-foreground">Punch actif</p>
                    <p className="text-xs text-muted-foreground">
                      Depuis {format(new Date(activePunch.punch_in), "HH:mm", { locale: fr })} · {elapsed}h écoulées
                    </p>
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => punchOutMutation.mutate()}
                  disabled={punchOutMutation.isPending}
                >
                  {punchOutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Square className="h-4 w-4 mr-2" />}
                  Punch Out
                </Button>
              </div>
              <Textarea
                value={punchNote}
                onChange={(e) => setPunchNote(e.target.value)}
                placeholder="Ajouter une note (optionnel)..."
                rows={2}
                className="text-sm"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Aucun punch actif</p>
                  <p className="text-xs text-muted-foreground">Commencez votre journée</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => punchInMutation.mutate()}
                  disabled={punchInMutation.isPending}
                >
                  {punchInMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                  Punch In
                </Button>
              </div>
              <Textarea
                value={punchNote}
                onChange={(e) => setPunchNote(e.target.value)}
                placeholder="Note pour ce punch (optionnel)..."
                rows={2}
                className="text-sm"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Schedules */}
        <Card>
          <CardHeader><CardTitle className="text-base">Horaire planifié</CardTitle></CardHeader>
          <CardContent>
            {!schedules?.length ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucun horaire planifié.</p>
            ) : (
              <div className="space-y-2">
                {schedules.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                    <span className="text-sm font-medium text-foreground">{DAYS[s.day_of_week] || `Jour ${s.day_of_week}`}</span>
                    <span className="text-sm text-muted-foreground">{s.start_time?.slice(0, 5)} — {s.end_time?.slice(0, 5)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Time entries */}
        <Card>
          <CardHeader><CardTitle className="text-base">Historique de pointage</CardTitle></CardHeader>
          <CardContent>
            {!timeEntries?.length ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucun pointage enregistré.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {timeEntries.map((t: any) => {
                  const isActive = !t.punch_out;
                  const canCorrect = t.status !== "correction_requested" && t.status !== "approved" && !isActive;
                  return (
                    <div key={t.id} className={cn(
                      "flex items-center justify-between py-2 px-3 rounded-md",
                      isActive ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800" : "bg-muted/50"
                    )}>
                      <div className="space-y-0.5">
                        <span className="text-sm font-medium text-foreground">
                          {format(new Date(t.punch_in), "d MMM", { locale: fr })}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(t.punch_in), "HH:mm")}
                          {t.punch_out ? ` — ${format(new Date(t.punch_out), "HH:mm")}` : " (en cours)"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {t.total_hours != null && (
                          <span className="text-xs font-bold text-foreground">{Number(t.total_hours).toFixed(1)}h</span>
                        )}
                        {t.status === "correction_requested" && (
                          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">Correction</Badge>
                        )}
                        {t.status === "approved" && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        )}
                        {canCorrect && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
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
      </div>

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
                <Textarea
                  value={correctionNote}
                  onChange={(e) => setCorrectionNote(e.target.value)}
                  placeholder="Expliquez l'erreur à corriger..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionOpen(null)}>Annuler</Button>
            <Button onClick={() => correctionMutation.mutate()} disabled={correctionMutation.isPending || !correctionNote.trim()}>
              {correctionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Soumettre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
