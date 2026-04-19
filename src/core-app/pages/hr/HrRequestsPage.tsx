/**
 * HrRequestsPage — Unified HR requests queue (letters, withdrawals, disputes, punch corrections).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { MessageSquare, Loader2, CheckCircle, XCircle, DollarSign, FileText, Clock, AlertTriangle, Plane } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "outline" },
  requested: { label: "Demandé", variant: "outline" },
  approved: { label: "Approuvé", variant: "default" },
  rejected: { label: "Rejeté", variant: "destructive" },
  resolved: { label: "Résolu", variant: "default" },
  paid: { label: "Payé", variant: "default" },
  processing: { label: "En traitement", variant: "secondary" },
  correction_requested: { label: "Correction", variant: "outline" },
};

const LEAVE_TYPE_LABEL: Record<string, string> = {
  vacation: "Vacances",
  sick: "Maladie",
  personal: "Personnel",
  parttime: "Temps partiel",
  unpaid: "Sans solde",
  other: "Autre",
};

function businessDays(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const s = new Date(start), e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export default function HrRequestsPage() {
  const qc = useQueryClient();
  const [leaveFilterStatus, setLeaveFilterStatus] = useState<string>("pending");
  const [leaveFilterType, setLeaveFilterType] = useState<string>("all");
  const [refuseDialog, setRefuseDialog] = useState<{ id: string; employee: string } | null>(null);
  const [refuseReason, setRefuseReason] = useState("");

  // Withdrawal requests
  const { data: withdrawals = [], isLoading: loadW } = useQuery({
    queryKey: ["hr-req-withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      const ids = [...new Set(data.map((w: any) => w.agent_id))];
      if (ids.length) {
        const { data: recs } = await supabase.from("employee_records").select("user_id, first_name, last_name, employee_number").in("user_id", ids);
        const map = Object.fromEntries((recs || []).map((r: any) => [r.user_id, r]));
        return data.map((w: any) => ({ ...w, _emp: map[w.agent_id] || null }));
      }
      return data;
    },
  });

  // Disputes
  const { data: disputes = [], isLoading: loadD } = useQuery({
    queryKey: ["hr-req-disputes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_disputes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      const ids = [...new Set(data.map((d: any) => d.agent_id))];
      if (ids.length) {
        const { data: recs } = await supabase.from("employee_records").select("user_id, first_name, last_name, employee_number").in("user_id", ids);
        const map = Object.fromEntries((recs || []).map((r: any) => [r.user_id, r]));
        return data.map((d: any) => ({ ...d, _emp: map[d.agent_id] || null }));
      }
      return data;
    },
  });

  // Letter requests
  const { data: letterReqs = [], isLoading: loadL } = useQuery({
    queryKey: ["hr-req-letters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employment_letters")
        .select("*")
        .eq("status", "requested")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      const ids = [...new Set(data.map((l: any) => l.user_id))];
      if (ids.length) {
        const { data: recs } = await supabase.from("employee_records").select("user_id, first_name, last_name, employee_number").in("user_id", ids);
        const map = Object.fromEntries((recs || []).map((r: any) => [r.user_id, r]));
        return data.map((l: any) => ({ ...l, _emp: map[l.user_id] || null }));
      }
      return data;
    },
  });

  // Punch corrections
  const { data: punchCorrections = [], isLoading: loadP } = useQuery({
    queryKey: ["hr-req-punch-corrections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("status", "correction_requested")
        .order("punch_in", { ascending: false })
        .limit(50);
      if (error) throw error;

      const ids = [...new Set(data.map((t: any) => t.user_id))];
      if (ids.length) {
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
        const map = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));
        return data.map((t: any) => ({ ...t, _profile: map[t.user_id] || null }));
      }
      return data;
    },
  });

  // Leave requests (vacances / maladie / personnel / temps partiel)
  const { data: leaveReqs = [], isLoading: loadLeave } = useQuery({
    queryKey: ["hr-req-leaves"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hr_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const ids = [...new Set((data || []).map((r: any) => r.employee_id))];
      if (ids.length) {
        const { data: recs } = await supabase
          .from("employee_records")
          .select("id, user_id, first_name, last_name, employee_number")
          .in("id", ids);
        const map = Object.fromEntries((recs || []).map((r: any) => [r.id, r]));
        return (data || []).map((r: any) => ({ ...r, _emp: map[r.employee_id] || null }));
      }
      return data || [];
    },
  });

  // Approve / decline leave request → updates status, sends notification
  const leaveDecisionMut = useMutation({
    mutationFn: async (vars: { id: string; decision: "approved" | "declined"; reason?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const req = (leaveReqs as any[]).find((l) => l.id === vars.id);
      if (!req) throw new Error("Demande introuvable");

      const { error: upErr } = await supabase
        .from("hr_requests")
        .update({
          status: vars.decision,
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          review_note: vars.reason ?? null,
        })
        .eq("id", vars.id);
      if (upErr) throw upErr;

      // Send notification to employee
      if (req._emp?.user_id) {
        const typeLabel = LEAVE_TYPE_LABEL[req.request_type] || req.request_type;
        const dateRange = req.start_date && req.end_date
          ? `du ${format(new Date(req.start_date), "d MMM yyyy", { locale: fr })} au ${format(new Date(req.end_date), "d MMM yyyy", { locale: fr })}`
          : "demandé";
        const title = vars.decision === "approved"
          ? "Demande de congé approuvée"
          : "Demande de congé refusée";
        const message = vars.decision === "approved"
          ? `Votre demande de ${typeLabel} ${dateRange} a été approuvée.`
          : `Votre demande de ${typeLabel} ${dateRange} a été refusée.${vars.reason ? ` Raison: ${vars.reason}` : ""}`;

        await supabase.from("employee_notifications").insert({
          user_id: req._emp.user_id,
          notification_type: "leave_request",
          title,
          message,
        });
      }
    },
    onSuccess: () => {
      toast.success("Décision enregistrée");
      qc.invalidateQueries({ queryKey: ["hr-req-leaves"] });
      setRefuseDialog(null);
      setRefuseReason("");
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  // Generic status update
  const updateMut = useMutation({
    mutationFn: async ({ table, id, status, extraFields }: { table: string; id: string; status: string; extraFields?: Record<string, any> }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const updates: Record<string, any> = { status, ...extraFields };
      if (status === "approved") {
        updates.approved_by = user?.id;
        updates.approved_at = new Date().toISOString();
      }
      if (status === "resolved") {
        updates.resolved_by = user?.id;
        updates.resolved_at = new Date().toISOString();
      }
      const { error } = await supabase.from(table).update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Statut mis à jour");
      qc.invalidateQueries({ queryKey: ["hr-req-withdrawals"] });
      qc.invalidateQueries({ queryKey: ["hr-req-disputes"] });
      qc.invalidateQueries({ queryKey: ["hr-req-letters"] });
      qc.invalidateQueries({ queryKey: ["hr-req-punch-corrections"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  // Filtered leave list
  const filteredLeaves = (leaveReqs as any[]).filter((r) => {
    if (leaveFilterStatus !== "all" && r.status !== leaveFilterStatus) return false;
    if (leaveFilterType !== "all" && r.request_type !== leaveFilterType) return false;
    return true;
  });

  // Counters (current month for approved/declined)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const leavePending = (leaveReqs as any[]).filter((r) => r.status === "pending").length;
  const leaveApprovedThisMonth = (leaveReqs as any[]).filter(
    (r) => r.status === "approved" && r.reviewed_at && new Date(r.reviewed_at) >= monthStart
  ).length;
  const leaveDeclinedThisMonth = (leaveReqs as any[]).filter(
    (r) => r.status === "declined" && r.reviewed_at && new Date(r.reviewed_at) >= monthStart
  ).length;

  const pendingW = withdrawals.filter((w: any) => w.status === "pending" || w.status === "requested").length;
  const pendingD = disputes.filter((d: any) => d.status === "pending").length;
  const pendingTotal = pendingW + pendingD + letterReqs.length + punchCorrections.length + leavePending;
  const loading = loadW || loadD || loadL || loadP;

  const empName = (item: any) => item._emp ? `${item._emp.first_name} ${item._emp.last_name}` : (item._profile?.full_name || "—");

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Demandes RH
        </h1>
        <p className="text-xs text-muted-foreground">{pendingTotal} demande(s) en attente</p>
      </div>

      <Tabs defaultValue="leaves">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="leaves" className="gap-1">
            <Plane className="h-3 w-3" />Demandes de congé ({leavePending})
          </TabsTrigger>
          <TabsTrigger value="withdrawals" className="gap-1">
            <DollarSign className="h-3 w-3" />Retraits ({withdrawals.length})
          </TabsTrigger>
          <TabsTrigger value="disputes" className="gap-1">
            <AlertTriangle className="h-3 w-3" />Contestations ({disputes.length})
          </TabsTrigger>
          <TabsTrigger value="letters" className="gap-1">
            <FileText className="h-3 w-3" />Lettres ({letterReqs.length})
          </TabsTrigger>
          <TabsTrigger value="punches" className="gap-1">
            <Clock className="h-3 w-3" />Corrections punch ({punchCorrections.length})
          </TabsTrigger>
        </TabsList>

        {/* ============ LEAVE REQUESTS ============ */}
        <TabsContent value="leaves" className="space-y-3 mt-3">
          {/* Counters */}
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">En attente</p>
              <p className="text-lg font-bold text-amber-600">{leavePending}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">Approuvées (mois)</p>
              <p className="text-lg font-bold text-emerald-600">{leaveApprovedThisMonth}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">Refusées (mois)</p>
              <p className="text-lg font-bold text-destructive">{leaveDeclinedThisMonth}</p>
            </CardContent></Card>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="text-xs">Statut:</Label>
            <Select value={leaveFilterStatus} onValueChange={setLeaveFilterStatus}>
              <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="approved">Approuvées</SelectItem>
                <SelectItem value="declined">Refusées</SelectItem>
              </SelectContent>
            </Select>
            <Label className="text-xs ml-2">Type:</Label>
            <Select value={leaveFilterType} onValueChange={setLeaveFilterType}>
              <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                {Object.entries(LEAVE_TYPE_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {loadLeave ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : filteredLeaves.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Aucune demande pour ces filtres.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Employé</TableHead>
                      <TableHead className="text-[10px]">Type</TableHead>
                      <TableHead className="text-[10px]">Dates</TableHead>
                      <TableHead className="text-[10px]">J. ouvrables</TableHead>
                      <TableHead className="text-[10px]">Raison</TableHead>
                      <TableHead className="text-[10px]">Soumise</TableHead>
                      <TableHead className="text-[10px]">Statut</TableHead>
                      <TableHead className="text-[10px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeaves.map((r: any) => {
                      const st = STATUS_BADGE[r.status] || { label: r.status, variant: "secondary" as const };
                      const days = businessDays(r.start_date, r.end_date);
                      const dateRange = r.start_date && r.end_date
                        ? `${format(new Date(r.start_date), "d MMM", { locale: fr })} → ${format(new Date(r.end_date), "d MMM yyyy", { locale: fr })}`
                        : "—";
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs">{empName(r)}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-[10px]">
                              {LEAVE_TYPE_LABEL[r.request_type] || r.request_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[10px]">{dateRange}</TableCell>
                          <TableCell className="text-xs font-medium">{days || (r.hours_requested ? `${r.hours_requested}h` : "—")}</TableCell>
                          <TableCell className="text-[10px] max-w-[180px] truncate">{r.reason || "—"}</TableCell>
                          <TableCell className="text-[10px]">{format(new Date(r.created_at), "d MMM yyyy", { locale: fr })}</TableCell>
                          <TableCell><Badge variant={st.variant} className="text-[10px]">{st.label}</Badge></TableCell>
                          <TableCell>
                            {r.status === "pending" ? (
                              <div className="flex gap-1">
                                <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1"
                                  disabled={leaveDecisionMut.isPending}
                                  onClick={() => leaveDecisionMut.mutate({ id: r.id, decision: "approved" })}>
                                  <CheckCircle className="h-3 w-3" />Approuver
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive gap-1"
                                  disabled={leaveDecisionMut.isPending}
                                  onClick={() => setRefuseDialog({ id: r.id, employee: empName(r) })}>
                                  <XCircle className="h-3 w-3" />Refuser
                                </Button>
                              </div>
                            ) : r.review_note ? (
                              <span className="text-[10px] text-muted-foreground italic">{r.review_note}</span>
                            ) : null}
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

        {/* Withdrawals */}
        <TabsContent value="withdrawals">
          <Card><CardContent className="p-0">
            {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> :
            withdrawals.length === 0 ? <p className="text-xs text-muted-foreground text-center py-8">Aucun retrait.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-[10px]">Employé</TableHead>
                  <TableHead className="text-[10px]">Montant</TableHead>
                  <TableHead className="text-[10px]">Méthode</TableHead>
                  <TableHead className="text-[10px]">Statut</TableHead>
                  <TableHead className="text-[10px]">Date</TableHead>
                  <TableHead className="text-[10px]">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {withdrawals.map((w: any) => {
                    const st = STATUS_BADGE[w.status] || { label: w.status, variant: "secondary" as const };
                    return (
                      <TableRow key={w.id}>
                        <TableCell className="text-xs">{empName(w)}</TableCell>
                        <TableCell className="text-xs font-medium">{(w.amount ?? 0).toFixed(2)} $</TableCell>
                        <TableCell className="text-xs">{w.notes || "—"}</TableCell>
                        <TableCell><Badge variant={st.variant} className="text-[10px]">{st.label}</Badge></TableCell>
                        <TableCell className="text-[10px]">{format(new Date(w.created_at), "d MMM yyyy", { locale: fr })}</TableCell>
                        <TableCell>
                          {(w.status === "pending" || w.status === "requested") && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1"
                                disabled={updateMut.isPending}
                                onClick={() => updateMut.mutate({ table: "commission_withdrawal_requests", id: w.id, status: "approved" })}>
                                <CheckCircle className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive"
                                disabled={updateMut.isPending}
                                onClick={() => updateMut.mutate({ table: "commission_withdrawal_requests", id: w.id, status: "rejected" })}>
                                <XCircle className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* Disputes */}
        <TabsContent value="disputes">
          <Card><CardContent className="p-0">
            {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> :
            disputes.length === 0 ? <p className="text-xs text-muted-foreground text-center py-8">Aucune contestation.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-[10px]">Employé</TableHead>
                  <TableHead className="text-[10px]">Raison</TableHead>
                  <TableHead className="text-[10px]">Statut</TableHead>
                  <TableHead className="text-[10px]">Date</TableHead>
                  <TableHead className="text-[10px]">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {disputes.map((d: any) => {
                    const st = STATUS_BADGE[d.status] || { label: d.status, variant: "secondary" as const };
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="text-xs">{empName(d)}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{d.reason || "—"}</TableCell>
                        <TableCell><Badge variant={st.variant} className="text-[10px]">{st.label}</Badge></TableCell>
                        <TableCell className="text-[10px]">{format(new Date(d.created_at), "d MMM yyyy", { locale: fr })}</TableCell>
                        <TableCell>
                          {d.status === "pending" && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1"
                                disabled={updateMut.isPending}
                                onClick={() => updateMut.mutate({ table: "commission_disputes", id: d.id, status: "resolved" })}>
                                <CheckCircle className="h-3 w-3" />Résoudre
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive"
                                disabled={updateMut.isPending}
                                onClick={() => updateMut.mutate({ table: "commission_disputes", id: d.id, status: "rejected" })}>
                                <XCircle className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* Letters */}
        <TabsContent value="letters">
          <Card><CardContent className="p-0">
            {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> :
            letterReqs.length === 0 ? <p className="text-xs text-muted-foreground text-center py-8">Aucune demande de lettre en attente.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-[10px]">Employé</TableHead>
                  <TableHead className="text-[10px]">Type</TableHead>
                  <TableHead className="text-[10px]">Date</TableHead>
                  <TableHead className="text-[10px]">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {letterReqs.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs">{empName(l)}</TableCell>
                      <TableCell className="text-xs">{l.letter_type}</TableCell>
                      <TableCell className="text-[10px]">{format(new Date(l.created_at), "d MMM yyyy", { locale: fr })}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1"
                            disabled={updateMut.isPending}
                            onClick={() => updateMut.mutate({ table: "employment_letters", id: l.id, status: "approved" })}>
                            <CheckCircle className="h-3 w-3" />Approuver
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive"
                            disabled={updateMut.isPending}
                            onClick={() => updateMut.mutate({ table: "employment_letters", id: l.id, status: "rejected" })}>
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* Punch corrections */}
        <TabsContent value="punches">
          <Card><CardContent className="p-0">
            {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> :
            punchCorrections.length === 0 ? <p className="text-xs text-muted-foreground text-center py-8">Aucune demande de correction.</p> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-[10px]">Employé</TableHead>
                  <TableHead className="text-[10px]">Punch In</TableHead>
                  <TableHead className="text-[10px]">Punch Out</TableHead>
                  <TableHead className="text-[10px]">Notes</TableHead>
                  <TableHead className="text-[10px]">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {punchCorrections.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs">{t._profile?.full_name || t.user_id.slice(0, 8)}</TableCell>
                      <TableCell className="text-[10px] font-mono">{format(new Date(t.punch_in), "d MMM HH:mm", { locale: fr })}</TableCell>
                      <TableCell className="text-[10px] font-mono">{t.punch_out ? format(new Date(t.punch_out), "d MMM HH:mm", { locale: fr }) : "—"}</TableCell>
                      <TableCell className="text-[10px] max-w-[200px] truncate">{t.notes || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1"
                            disabled={updateMut.isPending}
                            onClick={() => updateMut.mutate({ table: "time_entries", id: t.id, status: "approved" })}>
                            <CheckCircle className="h-3 w-3" />Approuver
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 text-[10px] text-destructive"
                            disabled={updateMut.isPending}
                            onClick={() => updateMut.mutate({ table: "time_entries", id: t.id, status: "rejected" })}>
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
