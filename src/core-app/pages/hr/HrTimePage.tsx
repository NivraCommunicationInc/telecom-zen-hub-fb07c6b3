/**
 * HrTimePage — Real time & punch admin: logs, corrections, approvals.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Clock, Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "secondary" },
  approved: { label: "Approuvé", variant: "default" },
  rejected: { label: "Rejeté", variant: "destructive" },
  correction_requested: { label: "Correction dem.", variant: "outline" },
};

export default function HrTimePage() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["hr-time-entries-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .order("punch_in", { ascending: false })
        .limit(200);
      if (error) throw error;

      const userIds = [...new Set(data.map((e: any) => e.user_id))];
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);
        const map = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));
        return data.map((e: any) => ({ ...e, _profile: map[e.user_id] || null }));
      }
      return data;
    },
  });

  // Approve
  const approveMut = useMutation({
    mutationFn: async (entryId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("time_entries")
        .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: user?.id })
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entrée approuvée");
      qc.invalidateQueries({ queryKey: ["hr-time-entries-admin"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  // Reject
  const rejectMut = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from("time_entries")
        .update({ status: "rejected" })
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entrée rejetée");
      qc.invalidateQueries({ queryKey: ["hr-time-entries-admin"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const filtered = entries.filter((e: any) => {
    if (filterStatus !== "all" && e.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      const name = e._profile?.full_name?.toLowerCase() || "";
      if (!name.includes(s)) return false;
    }
    return true;
  });

  // KPIs
  const totalHours = entries.reduce((s: number, e: any) => s + (e.total_hours || 0), 0);
  const pendingCount = entries.filter((e: any) => e.status === "pending" || e.status === "correction_requested").length;
  const approvedCount = entries.filter((e: any) => e.status === "approved").length;

  // Group by employee for summary
  const byEmployee = entries.reduce((acc: Record<string, { name: string; hours: number; count: number }>, e: any) => {
    const key = e.user_id;
    if (!acc[key]) acc[key] = { name: e._profile?.full_name || key.slice(0, 8), hours: 0, count: 0 };
    acc[key].hours += e.total_hours || 0;
    acc[key].count += 1;
    return acc;
  }, {});

  const fmtTime = (iso: string) => {
    try { return format(new Date(iso), "d MMM HH:mm", { locale: fr }); } catch { return iso; }
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Temps & Punch — Administration
        </h1>
        <p className="text-xs text-muted-foreground">Logs de punch, approbations, corrections, totaux par employé</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground">Total entrées</p>
          <p className="text-lg font-bold">{entries.length}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground">Total heures</p>
          <p className="text-lg font-bold text-primary">{totalHours.toFixed(1)}h</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground">En attente</p>
          <p className="text-lg font-bold text-amber-600">{pendingCount}</p>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground">Approuvées</p>
          <p className="text-lg font-bold text-green-600">{approvedCount}</p>
        </CardContent></Card>
      </div>

      {/* Employee summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Résumé par employé</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(byEmployee).map(([uid, info]) => {
              const emp = info as { name: string; hours: number; count: number };
              return (
                <div key={uid} className="p-2 rounded-md border text-xs">
                  <p className="font-medium truncate">{emp.name}</p>
                  <p className="text-muted-foreground">{emp.hours.toFixed(1)}h · {emp.count} entrées</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher employé…" className="h-7 text-xs w-48" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="approved">Approuvé</SelectItem>
            <SelectItem value="rejected">Rejeté</SelectItem>
            <SelectItem value="correction_requested">Correction dem.</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Aucune entrée de temps trouvée.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Employé</TableHead>
                  <TableHead className="text-[10px]">Type</TableHead>
                  <TableHead className="text-[10px]">Punch In</TableHead>
                  <TableHead className="text-[10px]">Punch Out</TableHead>
                  <TableHead className="text-[10px]">Pause (min)</TableHead>
                  <TableHead className="text-[10px]">Total</TableHead>
                  <TableHead className="text-[10px]">Notes</TableHead>
                  <TableHead className="text-[10px]">Statut</TableHead>
                  <TableHead className="text-[10px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e: any) => {
                  const st = STATUS_CONFIG[e.status] || { label: e.status, variant: "secondary" as const };
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs">{e._profile?.full_name || e.user_id.slice(0, 8)}</TableCell>
                      <TableCell className="text-[10px]">{e.entry_type}</TableCell>
                      <TableCell className="text-[10px] font-mono">{fmtTime(e.punch_in)}</TableCell>
                      <TableCell className="text-[10px] font-mono">{e.punch_out ? fmtTime(e.punch_out) : <Badge variant="outline" className="text-[9px]">En cours</Badge>}</TableCell>
                      <TableCell className="text-xs">{e.break_minutes || 0}</TableCell>
                      <TableCell className="text-xs font-medium">{e.total_hours ? `${e.total_hours.toFixed(1)}h` : "—"}</TableCell>
                      <TableCell className="text-[10px] max-w-[120px] truncate">{e.notes || "—"}</TableCell>
                      <TableCell><Badge variant={st.variant} className="text-[10px]">{st.label}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {(e.status === "pending" || e.status === "correction_requested") && (
                            <>
                              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1"
                                disabled={approveMut.isPending}
                                onClick={() => approveMut.mutate(e.id)}>
                                <CheckCircle className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 text-destructive"
                                disabled={rejectMut.isPending}
                                onClick={() => rejectMut.mutate(e.id)}>
                                <XCircle className="h-3 w-3" />
                              </Button>
                            </>
                          )}
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
    </div>
  );
}
