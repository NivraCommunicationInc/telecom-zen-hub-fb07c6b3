/**
 * HrSchedulesPage — Admin schedule management: view, create, assign employee schedules.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Calendar, Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export default function HrSchedulesPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState("all");
  const [form, setForm] = useState({
    user_id: "",
    day_of_week: "1",
    start_time: "09:00",
    end_time: "17:00",
    effective_from: new Date().toISOString().slice(0, 10),
  });

  // All schedules
  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ["hr-schedules-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_schedules")
        .select("*")
        .order("day_of_week", { ascending: true });
      if (error) throw error;

      const userIds = [...new Set(data.map((s: any) => s.user_id))];
      if (userIds.length) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
        const map = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));
        return data.map((s: any) => ({ ...s, _name: map[s.user_id]?.full_name || s.user_id.slice(0, 8) }));
      }
      return data;
    },
  });

  // Employees for dropdown
  const { data: employees = [] } = useQuery({
    queryKey: ["hr-employees-dropdown"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_records")
        .select("user_id, first_name, last_name, employee_number")
        .eq("status", "active")
        .order("first_name");
      return data ?? [];
    },
  });

  // Create schedule
  const createMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("staff_schedules").insert({
        user_id: form.user_id,
        day_of_week: parseInt(form.day_of_week),
        start_time: form.start_time,
        end_time: form.end_time,
        effective_from: form.effective_from,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Horaire créé");
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ["hr-schedules-admin"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  // Delete schedule
  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff_schedules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Horaire supprimé");
      qc.invalidateQueries({ queryKey: ["hr-schedules-admin"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const employeeNames = [...new Set(schedules.map((s: any) => s.user_id))];
  const filtered = selectedEmployee === "all" ? schedules : schedules.filter((s: any) => s.user_id === selectedEmployee);

  // Group by employee
  const byEmployee = filtered.reduce((acc: Record<string, any[]>, s: any) => {
    const key = s.user_id;
    acc[key] = acc[key] || [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Horaires — Administration
          </h1>
          <p className="text-xs text-muted-foreground">{schedules.length} horaire(s) actif(s)</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Ajouter horaire</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Créer un horaire</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Employé</Label>
                <Select value={form.user_id} onValueChange={(v) => setForm(f => ({ ...f, user_id: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e: any) => (
                      <SelectItem key={e.user_id} value={e.user_id}>{e.first_name} {e.last_name} ({e.employee_number})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Jour</Label>
                <Select value={form.day_of_week} onValueChange={(v) => setForm(f => ({ ...f, day_of_week: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d, i) => (
                      <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Début</Label>
                  <Input type="time" value={form.start_time} onChange={(e) => setForm(f => ({ ...f, start_time: e.target.value }))} className="h-8 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fin</Label>
                  <Input type="time" value={form.end_time} onChange={(e) => setForm(f => ({ ...f, end_time: e.target.value }))} className="h-8 text-xs" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Effectif à partir de</Label>
                <Input type="date" value={form.effective_from} onChange={(e) => setForm(f => ({ ...f, effective_from: e.target.value }))} className="h-8 text-xs" />
              </div>
            </div>
            <DialogFooter>
              <Button size="sm" disabled={!form.user_id || createMut.isPending}
                onClick={() => createMut.mutate()}>
                {createMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
          <SelectTrigger className="h-7 text-xs w-52"><SelectValue placeholder="Tous les employés" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les employés</SelectItem>
            {employeeNames.map((uid: string) => {
              const s = schedules.find((s: any) => s.user_id === uid);
              return <SelectItem key={uid} value={uid}>{s?._name || uid.slice(0, 8)}</SelectItem>;
            })}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : Object.keys(byEmployee).length === 0 ? (
        <Card><CardContent className="py-8 text-center text-xs text-muted-foreground">Aucun horaire trouvé.</CardContent></Card>
      ) : (
        Object.entries(byEmployee).map(([uid, items]) => (
          <Card key={uid}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{(items as any[])[0]?._name}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[10px]">Jour</TableHead>
                    <TableHead className="text-[10px]">Début</TableHead>
                    <TableHead className="text-[10px]">Fin</TableHead>
                    <TableHead className="text-[10px]">Effectif depuis</TableHead>
                    <TableHead className="text-[10px]">Actif</TableHead>
                    <TableHead className="text-[10px] w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(items as any[]).map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs font-medium">{DAYS[s.day_of_week] || `Jour ${s.day_of_week}`}</TableCell>
                      <TableCell className="text-xs font-mono">{s.start_time?.slice(0, 5)}</TableCell>
                      <TableCell className="text-xs font-mono">{s.end_time?.slice(0, 5)}</TableCell>
                      <TableCell className="text-xs">{s.effective_from || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={s.is_active ? "default" : "secondary"} className="text-[10px]">
                          {s.is_active ? "Actif" : "Inactif"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive"
                          onClick={() => deleteMut.mutate(s.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
