/**
 * HrPayslips — Enterprise-grade payslip list for RH portal.
 * Features: filters (year/period/status), detailed view dialog, PDF download,
 * acknowledgment, real data from payroll_entries + payroll_adjustments.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Receipt, Download, Eye, Loader2, Filter, CheckCircle2,
  DollarSign, AlertCircle, FileText,
} from "lucide-react";
import PayslipDetailDialog from "@/hr-app/components/PayslipDetailDialog";
import { usePortalRealtime } from "@/hooks/usePortalRealtime";

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; cls: string }> = {
  draft: { label: "Brouillon", variant: "secondary", cls: "bg-muted text-muted-foreground" },
  approved: { label: "Approuvé", variant: "default", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" },
  processing: { label: "En traitement", variant: "outline", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" },
  paid: { label: "Payé", variant: "default", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" },
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n || 0);

export default function HrPayslips() {
  usePortalRealtime(["payroll_entries", "billing_payments"], [["rh-payslips"]]);
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  /* ── Fetch all payslips with adjustments ── */
  const { data: payslips, isLoading } = useQuery({
    queryKey: ["rh-payslips"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("payroll_entries")
        .select(`
          *,
          pay_periods(period_name, start_date, end_date),
          payroll_adjustments(id, adjustment_type, label, amount, notes)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("payslips fetch error:", error);
        return [];
      }
      return data ?? [];
    },
  });

  /* ── Derived: available years ── */
  const years = useMemo(() => {
    if (!payslips?.length) return [];
    const set = new Set<string>();
    payslips.forEach((p: any) => {
      const y = new Date(p.created_at).getFullYear().toString();
      set.add(y);
    });
    return Array.from(set).sort().reverse();
  }, [payslips]);

  /* ── Filtered list ── */
  const filtered = useMemo(() => {
    if (!payslips) return [];
    return payslips.filter((p: any) => {
      if (filterYear !== "all") {
        const y = new Date(p.created_at).getFullYear().toString();
        if (y !== filterYear) return false;
      }
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      return true;
    });
  }, [payslips, filterYear, filterStatus]);

  /* ── Summary stats ── */
  const stats = useMemo(() => {
    if (!filtered?.length) return { count: 0, totalNet: 0, totalGross: 0, acknowledged: 0 };
    return {
      count: filtered.length,
      totalNet: filtered.reduce((s: number, p: any) => s + Number(p.net_pay || 0), 0),
      totalGross: filtered.reduce((s: number, p: any) => s + Number(p.gross_pay || 0), 0),
      acknowledged: filtered.filter((p: any) => p.acknowledged_at).length,
    };
  }, [filtered]);

  const handleDownload = async (e: React.MouseEvent, pdfUrl: string, payrollNumber: string) => {
    e.stopPropagation();
    if (!pdfUrl) return;
    const { data } = await supabase.storage.from("payslips").createSignedUrl(pdfUrl, 300);
    if (data?.signedUrl) {
      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.download = `fiche-paie-${payrollNumber || "doc"}.pdf`;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Receipt className="h-6 w-6 text-primary" />
          Mes fiches de paie
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historique complet de vos fiches de paie avec détail des revenus et retenues
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          icon={<FileText className="h-4 w-4 text-primary" />}
          label="Fiches"
          value={stats.count.toString()}
        />
        <SummaryCard
          icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
          label="Total net"
          value={fmtMoney(stats.totalNet)}
        />
        <SummaryCard
          icon={<DollarSign className="h-4 w-4 text-blue-600" />}
          label="Total brut"
          value={fmtMoney(stats.totalGross)}
        />
        <SummaryCard
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          label="Accusés"
          value={`${stats.acknowledged} / ${stats.count}`}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-[130px] h-9 text-sm">
            <SelectValue placeholder="Année" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px] h-9 text-sm">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="draft">Brouillon</SelectItem>
            <SelectItem value="approved">Approuvé</SelectItem>
            <SelectItem value="processing">En traitement</SelectItem>
            <SelectItem value="paid">Payé</SelectItem>
          </SelectContent>
        </Select>
        {(filterYear !== "all" || filterStatus !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFilterYear("all"); setFilterStatus("all"); }}
            className="text-xs"
          >
            Réinitialiser
          </Button>
        )}
      </div>

      {/* Payslip list */}
      {!filtered.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
            <p>Aucune fiche de paie trouvée{filterYear !== "all" || filterStatus !== "all" ? " avec ces filtres" : ""}.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((p: any) => {
            const status = STATUS_MAP[p.status] || { label: p.status, variant: "secondary" as const, cls: "bg-muted text-muted-foreground" };
            const periodDates = p.pay_periods
              ? `${format(new Date(p.pay_periods.start_date), "d MMM", { locale: fr })} — ${format(new Date(p.pay_periods.end_date), "d MMM yyyy", { locale: fr })}`
              : "";

            return (
              <Card
                key={p.id}
                className="hover:shadow-md transition-all cursor-pointer border-border hover:border-primary/30"
                onClick={() => setSelectedEntry(p)}
              >
                <CardContent className="flex items-center justify-between py-4 px-5">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-foreground">
                        {p.payroll_number || "—"}
                      </span>
                      <Badge className={cn("text-[10px] font-semibold", status.cls)}>{status.label}</Badge>
                      {p.acknowledged_at && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {p.pay_periods?.period_name || "Période inconnue"}
                      {periodDates && <span className="ml-2 text-muted-foreground/70">· {periodDates}</span>}
                    </p>
                    <div className="flex gap-4 text-xs text-muted-foreground mt-0.5">
                      <span>Brut: {fmtMoney(Number(p.gross_pay))}</span>
                      <span>Retenues: {fmtMoney(Number(p.deductions_total))}</span>
                      {Number(p.commission_total) > 0 && (
                        <span className="text-blue-600">Comm: {fmtMoney(Number(p.commission_total))}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <div className="text-right">
                      <p className="text-lg font-bold text-emerald-600">{fmtMoney(Number(p.net_pay))}</p>
                      <p className="text-[10px] text-muted-foreground">Net à payer</p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); setSelectedEntry(p); }}
                        title="Voir le détail"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {p.pdf_url && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={(e) => handleDownload(e, p.pdf_url, p.payroll_number)}
                          title="Télécharger PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      <PayslipDetailDialog
        entry={selectedEntry}
        open={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />
    </div>
  );
}

/* ── Summary card ── */
function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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
