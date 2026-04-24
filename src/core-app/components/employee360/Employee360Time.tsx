import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Clock, MapPin } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Props = { userId: string };

const DAY_FULL = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export default function Employee360Time({ userId }: Props) {
  const { data: entries, isLoading } = useQuery({
    queryKey: ["e360-time", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("time_entries")
        .select("*")
        .eq("user_id", userId)
        .order("punch_in", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const { data: schedules } = useQuery({
    queryKey: ["e360-schedules", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("staff_schedules")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("day_of_week", { ascending: true });
      return data ?? [];
    },
  });

  if (isLoading) {
    return <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const totalHours = entries?.reduce((s, e) => s + (Number(e.total_hours) ?? 0), 0) ?? 0;
  const activePunch = entries?.find((e) => !e.punch_out);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total heures (affichées)</p><p className="text-lg font-semibold text-foreground">{totalHours.toFixed(1)}h</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Entrées</p><p className="text-lg font-semibold text-foreground">{entries?.length ?? 0}</p></CardContent></Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Punch actif</p>
            <div className="flex items-center gap-2">
              {activePunch ? (
                <>
                  <Clock className="h-4 w-4 text-primary animate-pulse" />
                  <span className="text-sm font-medium text-primary">En cours</span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Aucun</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Horaires planifiés (récurrents) */}
      {schedules && schedules.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Horaire récurrent</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jour</TableHead>
                  <TableHead>Début</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs">{DAY_FULL[s.day_of_week] ?? s.day_of_week}</TableCell>
                    <TableCell className="text-xs">{s.start_time}</TableCell>
                    <TableCell className="text-xs">{s.end_time}</TableCell>
                    <TableCell><Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "Actif" : "Inactif"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Punch entries */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Entrées de temps</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!entries?.length ? (
            <p className="p-4 text-sm text-muted-foreground">Aucune entrée de temps.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Punch In</TableHead>
                  <TableHead>Punch Out</TableHead>
                  <TableHead>Heures</TableHead>
                  <TableHead>Géo</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e: any) => {
                  const hasGeo = e.punch_in_lat != null || e.punch_out_lat != null;
                  const geoLink = e.punch_in_lat != null && e.punch_in_lng != null
                    ? `https://www.google.com/maps?q=${e.punch_in_lat},${e.punch_in_lng}`
                    : null;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs">{format(new Date(e.punch_in), "dd MMM HH:mm", { locale: fr })}</TableCell>
                      <TableCell className="text-xs">{e.punch_out ? format(new Date(e.punch_out), "dd MMM HH:mm", { locale: fr }) : <Badge variant="outline" className="text-[10px]">En cours</Badge>}</TableCell>
                      <TableCell className="font-medium">{e.total_hours != null ? `${Number(e.total_hours).toFixed(1)}h` : "—"}</TableCell>
                      <TableCell>
                        {hasGeo && geoLink ? (
                          <a href={geoLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline" title={`${e.punch_in_lat}, ${e.punch_in_lng}`}>
                            <MapPin className="h-3 w-3" />
                            <span className="text-[10px]">Voir</span>
                          </a>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">Sans géo</Badge>
                        )}
                      </TableCell>
                      <TableCell><Badge variant={e.status === "approved" ? "default" : "secondary"}>{e.status}</Badge></TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">{e.notes || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
