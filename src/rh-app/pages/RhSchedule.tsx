/**
 * RhSchedule — Employee's schedule and time punch (read-only view + punch actions).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Loader2 } from "lucide-react";

export default function RhSchedule() {
  const { data: schedules, isLoading } = useQuery({
    queryKey: ["rh-schedules"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("staff_schedules")
        .select("*")
        .eq("user_id", user.id)
        .gte("schedule_date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
        .order("schedule_date", { ascending: true });
      return data ?? [];
    },
  });

  const { data: timeEntries } = useQuery({
    queryKey: ["rh-time-entries"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("time_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("clock_in", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Clock className="h-6 w-6 text-teal-600" />
          Mon horaire & Punch
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Votre horaire planifié et historique de pointage</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Horaire planifié</CardTitle>
          </CardHeader>
          <CardContent>
            {!schedules?.length ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucun horaire planifié.</p>
            ) : (
              <div className="space-y-2">
                {schedules.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                    <span className="text-sm font-medium text-foreground">
                      {new Date(s.schedule_date).toLocaleDateString("fr-CA", { weekday: "short", month: "short", day: "numeric" })}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {s.start_time?.slice(0, 5)} — {s.end_time?.slice(0, 5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historique de pointage</CardTitle>
          </CardHeader>
          <CardContent>
            {!timeEntries?.length ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucun pointage enregistré.</p>
            ) : (
              <div className="space-y-2">
                {timeEntries.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                    <span className="text-sm font-medium text-foreground">
                      {new Date(t.clock_in).toLocaleDateString("fr-CA", { month: "short", day: "numeric" })}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(t.clock_in).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
                      {t.clock_out ? ` — ${new Date(t.clock_out).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}` : " (en cours)"}
                    </span>
                    {t.total_hours != null && (
                      <span className="text-xs font-bold text-foreground">{Number(t.total_hours).toFixed(1)}h</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
