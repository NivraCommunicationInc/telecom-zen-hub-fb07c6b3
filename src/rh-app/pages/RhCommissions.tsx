/**
 * RhCommissions — Employee commission history for RH portal.
 * Queries BOTH sales_commissions (salesperson_id, commission_amount)
 * and field_commissions (agent_id, amount) to show a unified view.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  DollarSign, Loader2, Filter, AlertCircle, TrendingUp,
  Clock, CheckCircle2, XCircle, RotateCcw, Receipt,
} from "lucide-react";
import { Link } from "react-router-dom";

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n || 0);

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending: { label: "En attente", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400", icon: <Clock className="h-3 w-3" /> },
  pending_activation: { label: "En attente d'activation", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400", icon: <Clock className="h-3 w-3" /> },
  validated: { label: "Validée", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400", icon: <CheckCircle2 className="h-3 w-3" /> },
  approved: { label: "Approuvée", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400", icon: <CheckCircle2 className="h-3 w-3" /> },
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
}

export default function RhCommissions() {
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterYear, setFilterYear] = useState("all");

  const { data: commissions, isLoading } = useQuery({
    queryKey: ["rh-commissions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Fetch from both tables in parallel
      const [salesRes, fieldRes] = await Promise.all([
        supabase
          .from("sales_commissions")
          .select("id, commission_amount, sale_amount, commission_rate, bonus_amount, bonus_type, status, notes, rejection_reason, paid_at, created_at")
          .eq("salesperson_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("field_commissions")
          .select("id, amount, status, notes, clawback_reason, paid_at, created_at")
          .eq("agent_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      const unified: UnifiedCommission[] = [];

      (salesRes.data ?? []).forEach((c: any) => {
        unified.push({
          id: c.id,
          source: "sales",
          amount: Number(c.commission_amount || 0),
          saleAmount: Number(c.sale_amount || 0),
          rate: Number(c.commission_rate || 0),
          bonusAmount: Number(c.bonus_amount || 0),
          bonusType: c.bonus_type || null,
          status: c.status,
          notes: c.notes || null,
          rejectionReason: c.rejection_reason || null,
          clawbackReason: null,
          paidAt: c.paid_at,
          createdAt: c.created_at,
        });
      });

      (fieldRes.data ?? []).forEach((c: any) => {
        unified.push({
          id: c.id,
          source: "field",
          amount: Number(c.amount || 0),
          saleAmount: 0,
          rate: 0,
          bonusAmount: 0,
          bonusType: null,
          status: c.status,
          notes: c.notes || null,
          rejectionReason: null,
          clawbackReason: c.clawback_reason || null,
          paidAt: c.paid_at,
          createdAt: c.created_at,
        });
      });

      unified.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return unified;
    },
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
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-primary" />
          Mes commissions
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historique complet de vos commissions sur ventes
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard icon={<TrendingUp className="h-4 w-4 text-primary" />} label="Total gagné" value={fmt(stats.total)} />
        <KpiCard icon={<Clock className="h-4 w-4 text-amber-600" />} label="En attente" value={fmt(stats.pending)} />
        <KpiCard icon={<CheckCircle2 className="h-4 w-4 text-blue-600" />} label="Validées" value={fmt(stats.validated)} />
        <KpiCard icon={<DollarSign className="h-4 w-4 text-emerald-600" />} label="Payées" value={fmt(stats.paid)} />
        <KpiCard icon={<XCircle className="h-4 w-4 text-destructive" />} label="Rejetées/Récup." value={fmt(stats.lost)} />
      </div>

      {/* Link to payslips */}
      <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/20">
        <Receipt className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Les commissions payées sont incluses dans vos fiches de paie.
        </p>
        <Link to="/rh/paie" className="text-xs font-medium text-primary hover:underline ml-auto">
          Voir mes fiches →
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {allStatuses.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_CONFIG[s]?.label || s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-[120px] h-9 text-sm">
            <SelectValue placeholder="Année" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filterStatus !== "all" || filterYear !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterStatus("all"); setFilterYear("all"); }} className="text-xs">
            Réinitialiser
          </Button>
        )}
      </div>

      {/* Commission list */}
      {!filtered.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
            <p>Aucune commission trouvée{filterStatus !== "all" || filterYear !== "all" ? " avec ces filtres" : ""}.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => {
            const cfg = STATUS_CONFIG[c.status] || { label: c.status, cls: "bg-muted text-muted-foreground", icon: null };
            return (
              <Card key={c.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="flex items-center justify-between py-3.5 px-5">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">
                        {fmt(c.amount)}
                      </span>
                      <Badge className={cn("text-[10px] font-semibold gap-1", cfg.cls)}>
                        {cfg.icon}{cfg.label}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {c.source === "sales" ? "Vente" : "Terrain"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{format(new Date(c.createdAt), "d MMM yyyy", { locale: fr })}</span>
                      {c.saleAmount > 0 && (
                        <span>Vente: {fmt(c.saleAmount)} × {(c.rate * 100).toFixed(0)}%</span>
                      )}
                      {c.bonusAmount > 0 && (
                        <span className="text-emerald-600">Bonus: {fmt(c.bonusAmount)}{c.bonusType ? ` (${c.bonusType})` : ""}</span>
                      )}
                      {c.paidAt && (
                        <span className="text-emerald-600">Payée le {format(new Date(c.paidAt), "d MMM yyyy", { locale: fr })}</span>
                      )}
                    </div>
                    {/* Reason displays */}
                    {c.rejectionReason && (
                      <p className="text-xs text-destructive">Raison: {c.rejectionReason}</p>
                    )}
                    {c.clawbackReason && (
                      <p className="text-xs text-destructive">Récupération: {c.clawbackReason}</p>
                    )}
                    {c.notes && (
                      <p className="text-xs text-muted-foreground italic truncate max-w-md">{c.notes}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-lg font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
