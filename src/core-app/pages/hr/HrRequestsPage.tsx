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
import { MessageSquare, Loader2, CheckCircle, XCircle, DollarSign, FileText, Clock, AlertTriangle } from "lucide-react";
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

export default function HrRequestsPage() {
  const qc = useQueryClient();

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

      const ids = [...new Set(data.map((w: any) => w.employee_id))];
      if (ids.length) {
        const { data: recs } = await supabase.from("employee_records").select("user_id, first_name, last_name, employee_number").in("user_id", ids);
        const map = Object.fromEntries((recs || []).map((r: any) => [r.user_id, r]));
        return data.map((w: any) => ({ ...w, _emp: map[w.employee_id] || null }));
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

      const ids = [...new Set(data.map((d: any) => d.employee_id))];
      if (ids.length) {
        const { data: recs } = await supabase.from("employee_records").select("user_id, first_name, last_name, employee_number").in("user_id", ids);
        const map = Object.fromEntries((recs || []).map((r: any) => [r.user_id, r]));
        return data.map((d: any) => ({ ...d, _emp: map[d.employee_id] || null }));
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

      const ids = [...new Set(data.map((l: any) => l.employee_id))];
      if (ids.length) {
        const { data: recs } = await supabase.from("employee_records").select("user_id, first_name, last_name, employee_number").in("user_id", ids);
        const map = Object.fromEntries((recs || []).map((r: any) => [r.user_id, r]));
        return data.map((l: any) => ({ ...l, _emp: map[l.employee_id] || null }));
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

  const pendingW = withdrawals.filter((w: any) => w.status === "pending" || w.status === "requested").length;
  const pendingD = disputes.filter((d: any) => d.status === "pending").length;
  const pendingTotal = pendingW + pendingD + letterReqs.length + punchCorrections.length;
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

      <Tabs defaultValue="withdrawals">
        <TabsList className="flex flex-wrap gap-1">
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
                        <TableCell className="text-xs">{w.payment_method || "—"}</TableCell>
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
