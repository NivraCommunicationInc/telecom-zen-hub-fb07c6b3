/**
 * PayrollDetailDialog — Detailed payroll entry view with adjustments history.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { DollarSign, Clock, FileText, Receipt } from "lucide-react";

const fmtMoney = (n: number) => `${n.toFixed(2)} $`;

const STATUS_CLS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  approved: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
};
const STATUS_LABELS: Record<string, string> = { draft: "Brouillon", approved: "Approuvé", paid: "Payé" };
const ADJ_TYPES: Record<string, string> = { deduction: "Retenue", bonus: "Bonus", correction: "Correction", clawback: "Récupération", tax_withholding: "Impôt retenu", other: "Autre" };

interface Props {
  entry: any;
  agentName: string;
  open: boolean;
  onClose: () => void;
}

export default function PayrollDetailDialog({ entry, agentName, open, onClose }: Props) {
  if (!entry) return null;
  const adjustments = entry.payroll_adjustments || [];
  const b = STATUS_CLS[entry.status] || STATUS_CLS.draft;
  const label = STATUS_LABELS[entry.status] || entry.status;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Fiche de paie — {agentName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header info */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Période: <span className="font-medium text-foreground">{entry.pay_periods?.period_name || "—"}</span></p>
              {entry.payroll_number && <p className="text-xs text-muted-foreground">Réf: {entry.payroll_number}</p>}
            </div>
            <span className={cn("text-[10px] font-semibold px-2 py-1 rounded border", b)}>{label}</span>
          </div>

          {/* Financial grid */}
          <div className="grid grid-cols-2 gap-3 p-4 bg-muted/30 rounded-lg border border-border">
            {[
              { icon: DollarSign, label: "Salaire de base", value: fmtMoney(Number(entry.base_salary || 0)), color: "text-foreground" },
              { icon: DollarSign, label: "Commissions", value: fmtMoney(Number(entry.commission_total || 0)), color: "text-blue-600" },
              { icon: DollarSign, label: "Bonus", value: fmtMoney(Number(entry.bonus_total || 0)), color: "text-emerald-600" },
              { icon: Clock, label: "Heures travaillées", value: `${Number(entry.hours_worked || 0)}h`, color: "text-foreground" },
              { icon: Clock, label: "Heures supp.", value: `${Number(entry.overtime_hours || 0)}h`, color: "text-amber-600" },
              { icon: DollarSign, label: "Retenues", value: `- ${fmtMoney(Number(entry.deductions_total || 0))}`, color: "text-destructive" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <item.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  <p className={cn("text-sm font-semibold", item.color)}>{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="flex justify-between items-center p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div>
              <p className="text-xs text-muted-foreground">Brut</p>
              <p className="text-lg font-bold text-foreground">{fmtMoney(Number(entry.gross_pay || 0))}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Net à payer</p>
              <p className="text-lg font-bold text-emerald-600">{fmtMoney(Number(entry.net_pay || 0))}</p>
            </div>
          </div>

          {/* Adjustments history */}
          <div>
            <h4 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Historique des ajustements ({adjustments.length})</h4>
            {adjustments.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">Aucun ajustement</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {adjustments.map((adj: any) => (
                  <div key={adj.id} className="flex items-center justify-between p-2 rounded border border-border bg-card">
                    <div>
                      <p className="text-xs font-medium text-foreground">{adj.label}</p>
                      <p className="text-[10px] text-muted-foreground">{ADJ_TYPES[adj.adjustment_type] || adj.adjustment_type}{adj.notes ? ` · ${adj.notes}` : ""}</p>
                    </div>
                    <span className={cn("text-sm font-bold", adj.adjustment_type === "deduction" || adj.adjustment_type === "clawback" || adj.adjustment_type === "tax_withholding" ? "text-destructive" : "text-emerald-600")}>
                      {adj.adjustment_type === "deduction" || adj.adjustment_type === "clawback" || adj.adjustment_type === "tax_withholding" ? "−" : "+"}{fmtMoney(Number(adj.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes & dates */}
          {entry.notes && <div className="text-xs text-muted-foreground border-t border-border pt-2">Note: {entry.notes}</div>}
          <div className="flex gap-4 text-[10px] text-muted-foreground">
            <span>Créé: {format(new Date(entry.created_at), "dd/MM/yyyy HH:mm")}</span>
            {entry.paid_at && <span>Payé: {format(new Date(entry.paid_at), "dd/MM/yyyy HH:mm")}</span>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
