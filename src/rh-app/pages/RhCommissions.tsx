/**
 * RhCommissions — Employee commission history with actions.
 * Features: withdrawal requests, dispute, filters, KPI, sale link.
 */
import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  DollarSign, Loader2, Filter, AlertCircle, TrendingUp,
  Clock, CheckCircle2, XCircle, RotateCcw, Receipt,
  Banknote, AlertTriangle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useEmployeeWallet, fmtCAD } from "@/rh-app/hooks/useEmployeeWallet";
import { usePortalRealtime } from "@/hooks/usePortalRealtime";

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n || 0);

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending: { label: "En attente", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400", icon: <Clock className="h-3 w-3" /> },
  pending_activation: { label: "Activation en attente", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400", icon: <Clock className="h-3 w-3" /> },
  validated: { label: "Validée", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400", icon: <CheckCircle2 className="h-3 w-3" /> },
  approved: { label: "Approuvée", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400", icon: <CheckCircle2 className="h-3 w-3" /> },
  payable: { label: "Payable", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400", icon: <Banknote className="h-3 w-3" /> },
  included_in_payroll: { label: "Incluse dans paie", cls: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400", icon: <Receipt className="h-3 w-3" /> },
  paid: { label: "Payée", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400", icon: <DollarSign className="h-3 w-3" /> },
  rejected: { label: "Rejetée", cls: "bg-destructive/10 text-destructive", icon: <XCircle className="h-3 w-3" /> },
  clawback: { label: "Récupération", cls: "bg-destructive/10 text-destructive", icon: <RotateCcw className="h-3 w-3" /> },
};

interface UnifiedCommission {
  id: string;
  source: "sales" | "field";
  amount: number;
  saleAmount: number;
  rate: number;
  bonusAmount: number;
  bonusType: string | null;
  status: string;
  notes: string | null;
  rejectionReason: string | null;
  clawbackReason: string | null;
  paidAt: string | null;
  createdAt: string;
  linkedToPayroll?: boolean;
}

export default function RhCommissions() {
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNotes, setWithdrawNotes] = useState("");
  const [disputeOpen, setDisputeOpen] = useState<UnifiedCommission | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const queryClient = useQueryClient();

  const { data: userId } = useQuery({
    queryKey: ["rh-user-id"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id ?? null;
    },
  });

  // Fetch payroll links to know which commissions are already in a payslip
  const { data: payrollLinks } = useQuery({
    queryKey: ["rh-payroll-commission-links", userId],
    queryFn: async () => {
      if (!userId) return new Set<string>();
      // Get all payroll_entry ids for this user, then get links
      const { data: entries } = await supabase
        .from("payroll_entries")
        .select("id")
        .eq("user_id", userId!);
      if (!entries?.length) return new Set<string>();
      const entryIds = entries.map((e: any) => e.id);
      const { data: links } = await supabase
        .from("payroll_commission_links" as any)
        .select("commission_id, commission_source")
        .in("payroll_entry_id", entryIds);
      const set = new Set<string>();
      (links as any[] ?? []).forEach((l: any) => set.add(`${l.commission_source}:${l.commission_id}`));
      return set;
    },
    enabled: !!userId,
  });

  const { data: commissions, isLoading } = useQuery({
    queryKey: ["rh-commissions", userId, payrollLinks ? "ready" : "waiting"],
    queryFn: async () => {
      if (!userId) return [];
      const [salesRes, fieldRes] = await Promise.all([
        supabase
          .from("sales_commissions")
          .select("id, commission_amount, sale_amount, commission_rate, bonus_amount, bonus_type, status, notes, rejection_reason, paid_at, created_at")
          .eq("salesperson_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("field_commissions")
          .select("id, amount, status, notes, clawback_reason, paid_at, created_at")
          .eq("agent_id", userId)
          .order("created_at", { ascending: false }),
      ]);

      const linked = payrollLinks ?? new Set<string>();
      const unified: UnifiedCommission[] = [];
      (salesRes.data ?? []).forEach((c: any) => {
        unified.push({
          id: c.id, source: "sales", amount: Number(c.commission_amount || 0),
          saleAmount: Number(c.sale_amount || 0), rate: Number(c.commission_rate || 0),
          bonusAmount: Number(c.bonus_amount || 0), bonusType: c.bonus_type || null,
          status: c.status, notes: c.notes || null, rejectionReason: c.rejection_reason || null,
          clawbackReason: null, paidAt: c.paid_at, createdAt: c.created_at,
          linkedToPayroll: linked.has(`sales:${c.id}`),
        });
      });
      (fieldRes.data ?? []).forEach((c: any) => {
        unified.push({
          id: c.id, source: "field", amount: Number(c.amount || 0),
          saleAmount: 0, rate: 0, bonusAmount: 0, bonusType: null,
          status: c.status, notes: c.notes || null, rejectionReason: null,
          clawbackReason: c.clawback_reason || null, paidAt: c.paid_at, createdAt: c.created_at,
          linkedToPayroll: linked.has(`field:${c.id}`),
        });
      });
      unified.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return unified;
    },
    enabled: !!userId,
  });

  // Withdrawal requests
  const { data: withdrawals } = useQuery({
    queryKey: ["rh-withdrawals", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("commission_withdrawal_requests")
        .select("*")
        .eq("agent_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: !!userId,
  });

  const { data: wallet } = useEmployeeWallet(userId);

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Non authentifié");
      const amt = parseFloat(withdrawAmount);
      if (isNaN(amt) || amt <= 0) throw new Error("Montant invalide");
      // Client-side balance check (DB trigger is the real guard)
      if (wallet && amt > wallet.available_balance) {
        throw new Error(`Solde insuffisant. Disponible: ${fmtCAD(wallet.available_balance)}`);
      }
      const { error } = await supabase
        .from("commission_withdrawal_requests")
        .insert({ agent_id: userId, amount: amt, status: "pending", notes: withdrawNotes || null });
      if (error) {
        // Parse DB trigger error for friendly message
        if (error.message?.includes("Solde insuffisant")) throw new Error(error.message);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Demande de retrait soumise");
      setWithdrawOpen(false);
      setWithdrawAmount("");
      setWithdrawNotes("");
      queryClient.invalidateQueries({ queryKey: ["rh-withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["employee-wallet"] });
    },
    onError: (e: any) => toast.error(e.message || "Erreur lors de la demande"),
  });

  const disputeMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !disputeOpen) throw new Error("Données manquantes");
      if (!disputeReason.trim()) throw new Error("La raison est obligatoire");
      const { error } = await supabase
        .from("commission_disputes")
        .insert({
          commission_id: disputeOpen.id,
          agent_id: userId,
          reason: disputeReason.trim(),
          status: "pending",
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contestation soumise");
      setDisputeOpen(null);
      setDisputeReason("");
    },
    onError: (e: any) => toast.error(e.message || "Erreur lors de la contestation"),
  });

  const years = useMemo(() => {
    if (!commissions?.length) return [];
    const set = new Set<string>();
    commissions.forEach((c) => set.add(new Date(c.createdAt).getFullYear().toString()));
    return Array.from(set).sort().reverse();
  }, [commissions]);

  const filtered = useMemo(() => {
    if (!commissions) return [];
    return commissions.filter((c) => {
      if (filterStatus !== "all" && c.status !== filterStatus) return false;
      if (filterYear !== "all" && new Date(c.createdAt).getFullYear().toString() !== filterYear) return false;
      return true;
    });
  }, [commissions, filterStatus, filterYear]);

  const stats = useMemo(() => {
    if (!commissions?.length) return { total: 0, pending: 0, validated: 0, paid: 0, lost: 0 };
    const s = { total: 0, pending: 0, validated: 0, paid: 0, lost: 0 };
    commissions.forEach((c) => {
      s.total += c.amount;
      if (["pending", "pending_activation"].includes(c.status)) s.pending += c.amount;
      else if (["validated", "approved"].includes(c.status)) s.validated += c.amount;
      else if (c.status === "paid") s.paid += c.amount;
      else if (["rejected", "clawback"].includes(c.status)) s.lost += c.amount;
    });
    return s;
  }, [commissions]);

  const allStatuses = useMemo(() => {
    if (!commissions) return [];
    return Array.from(new Set(commissions.map((c) => c.status)));
  }, [commissions]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-primary" />
            Mes commissions
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Historique, retraits et contestations</p>
        </div>
        <Button size="sm" onClick={() => setWithdrawOpen(true)}>
          <Banknote className="h-4 w-4 mr-2" />
          Demander un retrait
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard icon={<TrendingUp className="h-4 w-4 text-primary" />} label="Total gagné" value={fmt(stats.total)} />
        <KpiCard icon={<Clock className="h-4 w-4 text-amber-600" />} label="En attente" value={fmt(stats.pending)} />
        <KpiCard icon={<CheckCircle2 className="h-4 w-4 text-blue-600" />} label="Validées" value={fmt(stats.validated)} />
        <KpiCard icon={<DollarSign className="h-4 w-4 text-emerald-600" />} label="Payées" value={fmt(stats.paid)} />
        <KpiCard icon={<XCircle className="h-4 w-4 text-destructive" />} label="Rejetées/Récup." value={fmt(stats.lost)} />
      </div>

      {/* Withdrawal requests status */}
      {withdrawals && withdrawals.length > 0 && (
        <Card>
          <CardContent className="py-3 px-5">
            <p className="text-xs font-bold text-foreground mb-2">Demandes de retrait récentes</p>
            <div className="space-y-1.5">
              {withdrawals.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{format(new Date(w.created_at), "d MMM yyyy", { locale: fr })}</span>
                  <span className="font-semibold text-foreground">{fmt(Number(w.amount))}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {w.status === "pending" ? "En attente" : w.status === "approved" ? "Approuvé" : w.status === "paid" ? "Payé" : w.status === "rejected" ? "Refusé" : w.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Link to payslips */}
      <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/20">
        <Receipt className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Les commissions payées sont incluses dans vos fiches de paie.</p>
        <Link to="/rh/paie" className="text-xs font-medium text-primary hover:underline ml-auto">Voir mes fiches →</Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {allStatuses.map((s) => <SelectItem key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-[120px] h-9 text-sm"><SelectValue placeholder="Année" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        {(filterStatus !== "all" || filterYear !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterStatus("all"); setFilterYear("all"); }} className="text-xs">Réinitialiser</Button>
        )}
      </div>

      {/* Commission list */}
      {!filtered.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
            <p>Aucune commission trouvée.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const cfg = STATUS_CONFIG[c.status] || { label: c.status, cls: "bg-muted text-muted-foreground", icon: null };
            const canDispute = ["pending", "validated", "approved", "rejected"].includes(c.status);
            return (
              <Card key={c.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="flex items-center justify-between py-3.5 px-5 gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{fmt(c.amount)}</span>
                      <Badge className={cn("text-[10px] font-semibold gap-1", cfg.cls)}>{cfg.icon}{cfg.label}</Badge>
                      <Badge variant="outline" className="text-[10px]">{c.source === "sales" ? "Vente" : "Terrain"}</Badge>
                      {c.linkedToPayroll && (
                        <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400 gap-1">
                          <Receipt className="h-2.5 w-2.5" /> Incluse dans paie
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{format(new Date(c.createdAt), "d MMM yyyy", { locale: fr })}</span>
                      {c.saleAmount > 0 && <span>Vente: {fmt(c.saleAmount)} × {(c.rate * 100).toFixed(0)}%</span>}
                      {c.bonusAmount > 0 && <span className="text-emerald-600">Bonus: {fmt(c.bonusAmount)}</span>}
                      {c.paidAt && <span className="text-emerald-600">Payée le {format(new Date(c.paidAt), "d MMM yyyy", { locale: fr })}</span>}
                    </div>
                    {c.rejectionReason && <p className="text-xs text-destructive">Raison: {c.rejectionReason}</p>}
                    {c.clawbackReason && <p className="text-xs text-destructive">Récupération: {c.clawbackReason}</p>}
                    {c.notes && <p className="text-xs text-muted-foreground italic truncate max-w-md">{c.notes}</p>}
                  </div>
                  {canDispute && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 text-xs text-amber-600 hover:text-amber-700"
                      onClick={() => { setDisputeOpen(c); setDisputeReason(""); }}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                      Contester
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Withdrawal dialog */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Demander un retrait
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Show available balance */}
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground">Solde disponible</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {wallet ? fmtCAD(wallet.available_balance) : "—"}
              </p>
            </div>
            <div>
              <Label htmlFor="withdraw-amount">Montant ($)</Label>
              <Input
                id="withdraw-amount"
                type="number"
                min="1"
                step="0.01"
                max={wallet?.available_balance || 0}
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0.00"
              />
              {withdrawAmount && wallet && parseFloat(withdrawAmount) > wallet.available_balance && (
                <p className="text-xs text-destructive mt-1">Montant supérieur au solde disponible</p>
              )}
            </div>
            <div>
              <Label htmlFor="withdraw-notes">Notes (optionnel)</Label>
              <Textarea
                id="withdraw-notes"
                value={withdrawNotes}
                onChange={(e) => setWithdrawNotes(e.target.value)}
                placeholder="Raison du retrait..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Annuler</Button>
            <Button onClick={() => withdrawMutation.mutate()} disabled={withdrawMutation.isPending || !withdrawAmount}>
              {withdrawMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Soumettre
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispute dialog */}
      <Dialog open={!!disputeOpen} onOpenChange={(o) => !o && setDisputeOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Contester une commission
            </DialogTitle>
          </DialogHeader>
          {disputeOpen && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p>Commission: <strong>{fmt(disputeOpen.amount)}</strong></p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(disputeOpen.createdAt), "d MMMM yyyy", { locale: fr })} · {disputeOpen.source === "sales" ? "Vente" : "Terrain"}
                </p>
              </div>
              <div>
                <Label htmlFor="dispute-reason">Raison de la contestation *</Label>
                <Textarea
                  id="dispute-reason"
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  placeholder="Expliquez pourquoi vous contestez cette commission..."
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeOpen(null)}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={() => disputeMutation.mutate()}
              disabled={disputeMutation.isPending || !disputeReason.trim()}
            >
              {disputeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Soumettre la contestation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-muted-foreground">{label}</span></div>
        <p className="text-lg font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
