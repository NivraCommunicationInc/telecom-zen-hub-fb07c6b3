/**
 * RhDashboard — Employee RH home page.
 * Header with greeting + status + punch quick action,
 * 4 metric cards, 3 sections (planning / commissions / notifications).
 */
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Clock, DollarSign, Calendar, Inbox, Play, Square, Loader2, ArrowRight,
  Bell, TrendingUp,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { fmtCAD } from "@/rh-app/hooks/useEmployeeWallet";

const DAY_FULL = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function getCoords(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    const t = setTimeout(() => resolve(null), 5000);
    navigator.geolocation.getCurrentPosition(
      (pos) => { clearTimeout(t); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      () => { clearTimeout(t); resolve(null); },
      { timeout: 5000, maximumAge: 60000 },
    );
  });
}

function nextPayday(now: Date): Date {
  // Bi-monthly: 1st and 15th
  const d = now.getDate();
  if (d < 15) return new Date(now.getFullYear(), now.getMonth(), 15);
  // Otherwise next month's 1st
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

export default function RhDashboard() {
  const qc = useQueryClient();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const { data: user } = useQuery({
    queryKey: ["rh-current-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const { data: profile } = useQuery({
    queryKey: ["rh-profile-name", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, job_title")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Active punch
  const { data: activePunch } = useQuery({
    queryKey: ["rh-active-punch", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("time_entries")
        .select("id, punch_in")
        .eq("user_id", user.id)
        .is("punch_out", null)
        .order("punch_in", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Hours this month
  const { data: hoursMonth = 0 } = useQuery({
    queryKey: ["rh-hours-month", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const monthStart = startOfMonth(now).toISOString();
      const monthEnd = endOfMonth(now).toISOString();
      const { data } = await supabase
        .from("time_entries")
        .select("total_hours")
        .eq("user_id", user.id)
        .gte("punch_in", monthStart).lte("punch_in", monthEnd)
        .not("total_hours", "is", null);
      return (data ?? []).reduce((s: number, e: any) => s + (Number(e.total_hours) || 0), 0);
    },
    enabled: !!user?.id,
  });

  // Commissions this month
  const { data: commMonth = { total: 0, recent: [] as any[] } } = useQuery({
    queryKey: ["rh-comm-month", user?.id],
    queryFn: async () => {
      if (!user?.id) return { total: 0, recent: [] };
      const monthStart = startOfMonth(now).toISOString();
      const { data } = await supabase
        .from("unified_commissions" as any)
        .select("*")
        .eq("employee_id", user.id)
        .gte("created_at", monthStart)
        .order("created_at", { ascending: false });
      const list = (data as any[]) ?? [];
      const total = list.reduce((s, c) => s + Number(c.amount || 0), 0);
      return { total, recent: list.slice(0, 5) };
    },
    enabled: !!user?.id,
  });

  // Pending requests
  const { data: pendingReq = 0 } = useQuery({
    queryKey: ["rh-pending-req", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count } = await supabase
        .from("hr_requests")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", user.id)
        .eq("status", "pending");
      return count ?? 0;
    },
    enabled: !!user?.id,
  });

  // Week schedule
  const { data: schedules = [] } = useQuery({
    queryKey: ["rh-week-schedule", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("staff_schedules")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("day_of_week");
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  /* Realtime — staff_schedules for this user (synced from Core RH). */
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`rh-schedule-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff_schedules",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["rh-week-schedule", user.id] });
          toast("Horaire mis à jour");
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  // Notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ["rh-recent-notifs", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("employee_notifications")
        .select("id, title, body, created_at, is_read")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  // Punch in/out from header
  const punchMut = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Non authentifié");
      const coords = await getCoords();
      if (activePunch) {
        const punchOut = new Date();
        const punchIn = new Date(activePunch.punch_in);
        const totalH = (punchOut.getTime() - punchIn.getTime()) / 3600000;
        const { error } = await supabase
          .from("time_entries")
          .update({
            punch_out: punchOut.toISOString(),
            total_hours: Math.round(totalH * 100) / 100,
            punch_out_lat: coords?.lat ?? null,
            punch_out_lng: coords?.lng ?? null,
          })
          .eq("id", activePunch.id);
        if (error) throw error;
        return { kind: "out" as const, geo: !!coords };
      } else {
        const { error } = await supabase.from("time_entries").insert({
          user_id: user.id,
          punch_in: new Date().toISOString(),
          entry_type: "regular",
          status: "pending",
          punch_in_lat: coords?.lat ?? null,
          punch_in_lng: coords?.lng ?? null,
        });
        if (error) throw error;
        return { kind: "in" as const, geo: !!coords };
      }
    },
    onSuccess: (res) => {
      const base = res.kind === "in" ? "Entrée pointée ✓" : "Sortie pointée ✓";
      toast.success(res.geo ? base : `${base} (sans géolocalisation)`);
      qc.invalidateQueries({ queryKey: ["rh-active-punch"] });
      qc.invalidateQueries({ queryKey: ["rh-hours-month"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const onDuty = !!activePunch;
  const payday = nextPayday(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });

  return (
    <div className="space-y-6">
      {/* ─── HEADER ─── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Bonjour{profile?.first_name ? `, ${profile.first_name}` : ""} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1 capitalize">
            {format(now, "EEEE d MMMM yyyy", { locale: fr })}
            {profile?.job_title && ` · ${profile.job_title}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant={onDuty ? "default" : "secondary"}
            className={`text-xs uppercase tracking-wider ${onDuty ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
          >
            {onDuty ? "✓ EN SERVICE" : "○ HORS SERVICE"}
          </Badge>
          <Button
            size="sm"
            variant={onDuty ? "destructive" : "default"}
            className={`gap-1.5 ${!onDuty ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
            onClick={() => punchMut.mutate()}
            disabled={punchMut.isPending}
          >
            {punchMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" />
              : onDuty ? <><Square className="h-4 w-4" />Pointer sortie</>
              : <><Play className="h-4 w-4" />Pointer entrée</>}
          </Button>
        </div>
      </div>

      {/* ─── 4 METRICS ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Link to="/rh/horaire">
          <Card className="hover:border-violet-400 transition-colors cursor-pointer h-full">
            <CardContent className="pt-3 pb-3 px-3">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Heures ce mois</p>
              <p className="text-xl font-bold text-foreground mt-1">{hoursMonth.toFixed(1)} h</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/rh/commissions">
          <Card className="hover:border-violet-400 transition-colors cursor-pointer h-full">
            <CardContent className="pt-3 pb-3 px-3">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" />Commissions ce mois</p>
              <p className="text-xl font-bold text-emerald-600 mt-1">{fmtCAD(commMonth.total)}</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/rh/paie">
          <Card className="hover:border-violet-400 transition-colors cursor-pointer h-full">
            <CardContent className="pt-3 pb-3 px-3">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />Prochaine paie</p>
              <p className="text-xl font-bold text-violet-600 mt-1">
                {format(payday, "d MMMM", { locale: fr })}
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/rh/demandes">
          <Card className="hover:border-violet-400 transition-colors cursor-pointer h-full">
            <CardContent className="pt-3 pb-3 px-3">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Inbox className="h-3 w-3" />Demandes en attente</p>
              <p className="text-xl font-bold text-amber-600 mt-1">{pendingReq}</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ─── 3 SECTIONS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Planning */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-sm">Planning cette semaine</CardTitle>
            <Link to="/rh/horaire" className="text-xs text-violet-600 hover:underline">Voir →</Link>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {schedules.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Aucun horaire planifié.</p>
            ) : (
              Array.from({ length: 7 }, (_, i) => {
                const day = addDays(weekStart, i);
                const slots = schedules.filter((s: any) => s.day_of_week === day.getDay());
                const isToday = isSameDay(day, now);
                return (
                  <div key={i} className={`flex items-center justify-between py-1.5 px-2 rounded-md ${isToday ? "bg-violet-100 dark:bg-violet-950/40" : ""}`}>
                    <span className={`text-xs ${isToday ? "font-bold text-violet-700 dark:text-violet-300" : "text-foreground"}`}>
                      {DAY_FULL[day.getDay()].slice(0, 3)} {format(day, "d")}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {slots.length === 0 ? "Repos" : slots.map((s: any) => `${s.start_time?.slice(0, 5)}-${s.end_time?.slice(0, 5)}`).join(" · ")}
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recent commissions */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-sm">Commissions récentes</CardTitle>
            <Link to="/rh/commissions" className="text-xs text-violet-600 hover:underline">Voir →</Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {commMonth.recent.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Aucune commission ce mois.</p>
            ) : (
              commMonth.recent.map((c: any) => (
                <div key={`${c.source}-${c.id}`} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground">
                      <Badge variant="outline" className="text-[9px] mr-1">{c.source === "sales" ? "Ventes" : "Terrain"}</Badge>
                      {fmtCAD(Number(c.amount))}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(c.created_at), "d MMM", { locale: fr })} · {c.status}</p>
                  </div>
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between">
            <CardTitle className="text-sm">Notifications RH</CardTitle>
            <Link to="/rh/notifications" className="text-xs text-violet-600 hover:underline">Voir →</Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {notifications.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Aucune notification.</p>
            ) : (
              notifications.map((n: any) => (
                <div key={n.id} className={`py-1.5 px-2 rounded-md ${!n.is_read ? "bg-violet-50 dark:bg-violet-950/30 border-l-2 border-violet-500" : "border-l-2 border-transparent"}`}>
                  <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    {!n.is_read && <Bell className="h-3 w-3 text-violet-600" />}
                    {n.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>
                  <p className="text-[9px] text-muted-foreground mt-1">
                    {format(new Date(n.created_at), "d MMM HH:mm", { locale: fr })}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
