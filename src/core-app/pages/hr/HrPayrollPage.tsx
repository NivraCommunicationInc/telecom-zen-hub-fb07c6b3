/**
 * HrPayrollPage — Real payroll admin: periods, slips, approve, pay.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DollarSign, Plus, CheckCircle, Eye, FileText, Loader2, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Brouillon", variant: "secondary" },
  open: { label: "Ouverte", variant: "default" },
  processing: { label: "En traitement", variant: "outline" },
  closed: { label: "Fermée", variant: "destructive" },
};

const ENTRY_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Brouillon", variant: "secondary" },
  pending_approval: { label: "En attente", variant: "outline" },
  approved: { label: "Approuvée", variant: "default" },
  paid: { label: "Payée", variant: "default" },
  rejected: { label: "Rejetée", variant: "destructive" },
};

export default function HrPayrollPage() {
  const qc = useQueryClient();
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newPeriod, setNewPeriod] = useState({ period_name: "", start_date: "", end_date: "" });
  const [filterStatus, setFilterStatus] = useState("all");

  // Fetch pay periods
  const { data: periods = [], isLoading: loadingPeriods } = useQuery({
    queryKey: ["hr-pay-periods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pay_periods")
        .select("*")
        .order("start_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Fetch entries for selected period
  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ["hr-payroll-entries", selectedPeriod],
    enabled: !!selectedPeriod,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_entries")
        .select("*, pay_periods(period_name)")
        .eq("pay_period_id", selectedPeriod!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Enrich with employee names
      const userIds = [...new Set(data.map((e: any) => e.user_id))];
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);
        const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));
        return data.map((e: any) => ({ ...e, _profile: profileMap[e.user_id] || null }));
      }
      return data;
    },
  });

  // Fetch commission links for entries
  const { data: commLinks = [] } = useQuery({
    queryKey: ["hr-comm-links", selectedPeriod],
    enabled: !!selectedPeriod && entries.length > 0,
    queryFn: async () => {
      const entryIds = entries.map((e: any) => e.id);
      const { data, error } = await supabase
        .from("payroll_commission_links")
        .select("*")
        .in("payroll_entry_id", entryIds);
      if (error) throw error;
      return data;
    },
  });

  // Create period
  const createPeriodMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("pay_periods").insert({
        period_name: newPeriod.period_name,
        start_date: newPeriod.start_date,
        end_date: newPeriod.end_date,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Période de paie créée");
      qc.invalidateQueries({ queryKey: ["hr-pay-periods"] });
      setCreateOpen(false);
      setNewPeriod({ period_name: "", start_date: "", end_date: "" });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  // Approve entry
  const approveMut = useMutation({
    mutationFn: async (entryId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("payroll_entries")
        .update({ status: "approved", approved_at: new Date().toISOString(), approved_by: user?.id })
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fiche approuvée");
      qc.invalidateQueries({ queryKey: ["hr-payroll-entries"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  // Mark paid
  const markPaidMut = useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from("payroll_entries")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fiche marquée payée");
      qc.invalidateQueries({ queryKey: ["hr-payroll-entries"] });
    },
    onError: (e: Error) => toast.error("Erreur", { description: e.message }),
  });

  const fmt = (n: number) => `${n.toFixed(2)} $`;
  const filteredEntries = filterStatus === "all" ? entries : entries.filter((e: any) => e.status === filterStatus);

  const commLinksByEntry = commLinks.reduce((acc: Record<string, any[]>, cl: any) => {
    acc[cl.payroll_entry_id] = acc[cl.payroll_entry_id] || [];
    acc[cl.payroll_entry_id].push(cl);
    return acc;
  }, {});

  // KPIs
  const totalGross = entries.reduce((s: number, e: any) => s + (e.gross_pay || 0), 0);
  const totalNet = entries.reduce((s: number, e: any) => s + (e.net_pay || 0), 0);
  const approved = entries.filter((e: any) => e.status === "approved" || e.status === "paid").length;

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Paie — Administration
          </h1>
          <p className="text-xs text-muted-foreground">Périodes, fiches de paie, approbation et paiement</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Nouvelle période</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Créer une période de paie</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nom de la période</Label>
                <Input value={newPeriod.period_name} onChange={(e) => setNewPeriod(p => ({ ...p, period_name: e.target.value }))}
                  placeholder="Paie Mars 2026 - 1ère quinzaine" className="h-8 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Début</Label>
                  <Input type="date" value={newPeriod.start_date}
                    onChange={(e) => setNewPeriod(p => ({ ...p, start_date: e.target.value }))} className="h-8 text-xs" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fin</Label>
                  <Input type="date" value={newPeriod.end_date}
                    onChange={(e) => setNewPeriod(p => ({ ...p, end_date: e.target.value }))} className="h-8 text-xs" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button size="sm" disabled={!newPeriod.period_name || !newPeriod.start_date || !newPeriod.end_date || createPeriodMut.isPending}
                onClick={() => createPeriodMut.mutate()}>
                {createPeriodMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Créer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Periods list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" />Périodes de paie</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingPeriods ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : periods.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Aucune période de paie. Créez-en une.</p>
          ) : (
            <div className="space-y-1">
              {periods.map((p: any) => {
                const st = STATUS_MAP[p.status] || { label: p.status, variant: "secondary" as const };
                const isSelected = selectedPeriod === p.id;
                return (
                  <div key={p.id}
                    className={`flex items-center justify-between p-2.5 rounded-md cursor-pointer transition-colors ${isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50 border border-transparent"}`}
                    onClick={() => setSelectedPeriod(p.id)}>
                    <div>
                      <p className="text-xs font-medium">{p.period_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(p.start_date), "d MMM", { locale: fr })} — {format(new Date(p.end_date), "d MMM yyyy", { locale: fr })}
                      </p>
                    </div>
                    <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Entries for selected period */}
      {selectedPeriod && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-3">
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">Fiches</p>
              <p className="text-lg font-bold">{entries.length}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">Brut total</p>
              <p className="text-lg font-bold text-primary">{fmt(totalGross)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">Net total</p>
              <p className="text-lg font-bold">{fmt(totalNet)}</p>
            </CardContent></Card>
            <Card><CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground">Approuvées</p>
              <p className="text-lg font-bold text-green-600">{approved}/{entries.length}</p>
            </CardContent></Card>
          </div>

          {/* Filter */}
          <div className="flex gap-2 items-center">
            <Label className="text-xs">Filtre statut:</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="draft">Brouillon</SelectItem>
                <SelectItem value="pending_approval">En attente</SelectItem>
                <SelectItem value="approved">Approuvée</SelectItem>
                <SelectItem value="paid">Payée</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="p-0">
              {loadingEntries ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : filteredEntries.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Aucune fiche de paie pour cette période.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">#</TableHead>
                      <TableHead className="text-[10px]">Employé</TableHead>
                      <TableHead className="text-[10px]">Heures</TableHead>
                      <TableHead className="text-[10px]">Base</TableHead>
                      <TableHead className="text-[10px]">Commission</TableHead>
                      <TableHead className="text-[10px]">Bonus</TableHead>
                      <TableHead className="text-[10px]">Déductions</TableHead>
                      <TableHead className="text-[10px]">Brut</TableHead>
                      <TableHead className="text-[10px]">Net</TableHead>
                      <TableHead className="text-[10px]">Commissions liées</TableHead>
                      <TableHead className="text-[10px]">Statut</TableHead>
                      <TableHead className="text-[10px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.map((e: any) => {
                      const st = ENTRY_STATUS[e.status] || { label: e.status, variant: "secondary" as const };
                      const links = commLinksByEntry[e.id] || [];
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="text-[10px] font-mono">{e.payroll_number || "—"}</TableCell>
                          <TableCell className="text-xs">{e._profile?.full_name || e.user_id.slice(0, 8)}</TableCell>
                          <TableCell className="text-xs">{e.hours_worked}h{e.overtime_hours > 0 ? ` (+${e.overtime_hours}h OT)` : ""}</TableCell>
                          <TableCell className="text-xs">{fmt(e.base_salary)}</TableCell>
                          <TableCell className="text-xs">{fmt(e.commission_total)}</TableCell>
                          <TableCell className="text-xs">{fmt(e.bonus_total)}</TableCell>
                          <TableCell className="text-xs text-destructive">-{fmt(Math.abs(e.deductions_total))}</TableCell>
                          <TableCell className="text-xs font-medium">{fmt(e.gross_pay)}</TableCell>
                          <TableCell className="text-xs font-bold">{fmt(e.net_pay)}</TableCell>
                          <TableCell className="text-[10px]">
                            {links.length > 0 ? (
                              <span className="text-primary">{links.length} comm.</span>
                            ) : "—"}
                          </TableCell>
                          <TableCell><Badge variant={st.variant} className="text-[10px]">{st.label}</Badge></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {(e.status === "draft" || e.status === "pending_approval") && (
                                <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1"
                                  disabled={approveMut.isPending}
                                  onClick={() => approveMut.mutate(e.id)}>
                                  <CheckCircle className="h-3 w-3" />Approuver
                                </Button>
                              )}
                              {e.status === "approved" && (
                                <Button size="sm" variant="default" className="h-6 text-[10px] gap-1"
                                  disabled={markPaidMut.isPending}
                                  onClick={() => markPaidMut.mutate(e.id)}>
                                  <DollarSign className="h-3 w-3" />Payer
                                </Button>
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
        </>
      )}
    </div>
  );
}
