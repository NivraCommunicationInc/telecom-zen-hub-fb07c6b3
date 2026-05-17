/**
 * PayslipDetailDialog — Detailed payslip view for HR portal.
 * Shows full breakdown: revenues, deductions, adjustments, linked commissions, PDF download, acknowledgment.
 */
import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  DollarSign, Clock, FileText, Receipt, Download, CheckCircle2,
  Loader2, TrendingUp, TrendingDown, AlertCircle, Link2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n || 0);

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: "Brouillon", cls: "bg-muted text-muted-foreground" },
  approved: { label: "Approuvé", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" },
  processing: { label: "En traitement", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" },
  scheduled: { label: "Programmé", cls: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" },
  pending: { label: "En attente", cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400" },
  sent: { label: "Envoyé", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" },
  paid: { label: "Payé", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" },
  confirmed: { label: "Confirmé", cls: "bg-emerald-200 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300" },
  failed: { label: "Échoué", cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400" },
  cancelled: { label: "Annulé", cls: "bg-muted text-muted-foreground" },
};

const ADJ_LABELS: Record<string, string> = {
  deduction: "Retenue",
  bonus: "Bonus",
  correction: "Correction",
  clawback: "Récupération",
  tax_withholding: "Impôt retenu",
  other: "Autre",
};

interface PayslipEntry {
  id: string;
  payroll_number: string | null;
  status: string;
  base_salary: number;
  commission_total: number;
  bonus_total: number;
  hours_worked: number;
  overtime_hours: number;
  gross_pay: number;
  deductions_total: number;
  net_pay: number;
  notes: string | null;
  pdf_url: string | null;
  paystub_pdf_url?: string | null;
  commission_gross?: number;
  bonus_amount?: number;
  federal_tax?: number;
  quebec_tax?: number;
  rrq?: number;
  ae?: number;
  rqap?: number;
  disability_insurance?: number;
  payment_status?: string | null;
  total_gross?: number;
  created_at: string;
  paid_at: string | null;
  acknowledged_at: string | null;
  pay_periods: {
    period_name: string;
    start_date: string;
    end_date: string;
  } | null;
  payroll_adjustments: Array<{
    id: string;
    adjustment_type: string;
    label: string;
    amount: number;
    notes: string | null;
  }>;
}

interface Props {
  entry: PayslipEntry | null;
  open: boolean;
  onClose: () => void;
}

export default function PayslipDetailDialog({ entry, open, onClose }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);
  const queryClient = useQueryClient();

  // Fetch linked commissions for this payroll entry
  const { data: linkedCommissions } = useQuery({
    queryKey: ["payroll-commission-links", entry?.id],
    queryFn: async () => {
      if (!entry) return [];
      const { data } = await supabase
        .from("payroll_commission_links" as any)
        .select("id, commission_id, commission_source, amount, created_at")
        .eq("payroll_entry_id", entry.id);
      return (data as any[]) ?? [];
    },
    enabled: !!entry?.id && open,
  });

  const handleDownload = useCallback(async () => {
    const pdfPath = entry?.paystub_pdf_url || entry?.pdf_url;
    if (!pdfPath) return;
    setDownloading(true);
    try {
      const path = pdfPath.includes("/documents/") ? pdfPath.split("/documents/").pop()! : pdfPath;
      const directUrl = pdfPath.startsWith("http") && !pdfPath.includes("/documents/") ? pdfPath : null;
      const { data, error } = directUrl
        ? { data: { signedUrl: directUrl }, error: null }
        : await supabase.storage.from("documents").createSignedUrl(path, 300);
      if (error || !data?.signedUrl) throw new Error("Erreur de téléchargement");
      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.download = `fiche-paie-${entry.payroll_number || entry.id}.pdf`;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Téléchargement démarré");
    } catch {
      toast.error("Impossible de télécharger le PDF");
    } finally {
      setDownloading(false);
    }
  }, [entry]);

  const handleAcknowledge = useCallback(async () => {
    if (!entry) return;
    setAcknowledging(true);
    try {
      const { error } = await supabase
        .from("payroll_entries")
        .update({ acknowledged_at: new Date().toISOString() })
        .eq("id", entry.id);
      if (error) throw error;
      toast.success("Réception confirmée");
      queryClient.invalidateQueries({ queryKey: ["rh-payslips"] });
      onClose();
    } catch {
      toast.error("Erreur lors de la confirmation");
    } finally {
      setAcknowledging(false);
    }
  }, [entry, queryClient, onClose]);

  if (!entry) return null;

  const effectiveStatus = entry.payment_status || entry.status;
  const status = STATUS_MAP[effectiveStatus] || { label: effectiveStatus, cls: "bg-muted text-muted-foreground" };
  const adjustments = entry.payroll_adjustments || [];
  const deductionAdjs = adjustments.filter(
    (a) => ["deduction", "clawback", "tax_withholding"].includes(a.adjustment_type)
  );
  const bonusAdjs = adjustments.filter(
    (a) => !["deduction", "clawback", "tax_withholding"].includes(a.adjustment_type)
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5 text-primary" />
            Fiche de paie — {entry.payroll_number || "Sans numéro"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg border border-border bg-muted/20">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {entry.pay_periods?.period_name || "Période inconnue"}
              </p>
              {entry.pay_periods && (
                <p className="text-xs text-muted-foreground">
                  {format(new Date(entry.pay_periods.start_date), "d MMM yyyy", { locale: fr })}
                  {" — "}
                  {format(new Date(entry.pay_periods.end_date), "d MMM yyyy", { locale: fr })}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Créé le {format(new Date(entry.created_at), "d MMMM yyyy", { locale: fr })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={cn("text-xs font-semibold", status.cls)}>{status.label}</Badge>
              {entry.acknowledged_at && (
                <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Accusé reçu
                </Badge>
              )}
            </div>
          </div>

          {/* REVENUS */}
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 mb-3">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Revenus
            </h3>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  <Row label="Salaire de base" value={fmtMoney(Number(entry.base_salary))} icon={<DollarSign className="h-3.5 w-3.5" />} />
                  <Row label="Heures travaillées" value={`${Number(entry.hours_worked)}h`} icon={<Clock className="h-3.5 w-3.5" />} />
                  <Row label="Heures supplémentaires" value={`${Number(entry.overtime_hours)}h`} icon={<Clock className="h-3.5 w-3.5" />} subtle={Number(entry.overtime_hours) === 0} />
                  <Row label="Commissions incluses" value={fmtMoney(Number(entry.commission_total))} icon={<DollarSign className="h-3.5 w-3.5" />} highlight={Number(entry.commission_total) > 0} />
                  <Row label="Bonus" value={fmtMoney(Number(entry.bonus_total))} icon={<DollarSign className="h-3.5 w-3.5" />} highlight={Number(entry.bonus_total) > 0} />
                  {bonusAdjs.map((adj) => (
                    <Row
                      key={adj.id}
                      label={`${ADJ_LABELS[adj.adjustment_type] || adj.adjustment_type}: ${adj.label}`}
                      value={`+ ${fmtMoney(Math.abs(Number(adj.amount)))}`}
                      icon={<FileText className="h-3.5 w-3.5" />}
                      highlight
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* COMMISSIONS LIÉES */}
          {linkedCommissions && linkedCommissions.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 mb-3">
                <Link2 className="h-4 w-4 text-primary" />
                Commissions incluses ({linkedCommissions.length})
              </h3>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {linkedCommissions.map((lc: any) => (
                      <tr key={lc.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 w-8 text-muted-foreground">
                          <DollarSign className="h-3.5 w-3.5" />
                        </td>
                        <td className="py-2.5">
                          <span className="text-sm text-foreground">
                            Commission {lc.commission_source === "sales" ? "vente" : "terrain"}
                          </span>
                          <p className="text-[10px] text-muted-foreground">
                            ID: {lc.commission_id.slice(0, 8)}…
                          </p>
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">
                          {fmtMoney(Number(lc.amount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* RETENUES — Détail canonique (synchronisé avec Nivra Core) */}
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 mb-3">
              <TrendingDown className="h-4 w-4 text-destructive" />
              Retenues légales et déductions
            </h3>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  <Row
                    label="Impôt fédéral"
                    value={`- ${fmtMoney(Number(entry.federal_tax || 0))}`}
                    icon={<FileText className="h-3.5 w-3.5" />}
                    destructive
                  />
                  <Row
                    label="Impôt provincial (Québec)"
                    value={`- ${fmtMoney(Number(entry.quebec_tax || 0))}`}
                    icon={<FileText className="h-3.5 w-3.5" />}
                    destructive
                  />
                  <Row
                    label="RRQ (Régime de rentes du Québec)"
                    value={`- ${fmtMoney(Number(entry.rrq || 0))}`}
                    icon={<FileText className="h-3.5 w-3.5" />}
                    destructive
                  />
                  <Row
                    label="AE (Assurance-emploi)"
                    value={`- ${fmtMoney(Number(entry.ae || 0))}`}
                    icon={<FileText className="h-3.5 w-3.5" />}
                    destructive
                  />
                  <Row
                    label="RQAP (Régime québécois d'assurance parentale)"
                    value={`- ${fmtMoney(Number(entry.rqap || 0))}`}
                    icon={<FileText className="h-3.5 w-3.5" />}
                    destructive
                  />
                  {Number(entry.disability_insurance || 0) > 0 && (
                    <Row
                      label="Assurance invalidité"
                      value={`- ${fmtMoney(Number(entry.disability_insurance))}`}
                      icon={<FileText className="h-3.5 w-3.5" />}
                      destructive
                    />
                  )}
                  {deductionAdjs.map((adj) => (
                    <Row
                      key={adj.id}
                      label={`${ADJ_LABELS[adj.adjustment_type] || adj.adjustment_type}: ${adj.label}`}
                      value={`- ${fmtMoney(Math.abs(Number(adj.amount)))}`}
                      icon={<FileText className="h-3.5 w-3.5" />}
                      destructive
                      sublabel={adj.notes || undefined}
                    />
                  ))}
                  <tr className="bg-muted/30 border-t-2 border-border">
                    <td className="px-4 py-2.5 w-8 text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5" />
                    </td>
                    <td className="py-2.5 font-bold text-foreground">Total des retenues</td>
                    <td className="px-4 py-2.5 text-right font-bold text-destructive">
                      - {fmtMoney(Number(entry.deductions_total))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <Separator />

          {/* RÉSUMÉ FINANCIER */}
          <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 space-y-2">
            <h3 className="text-sm font-bold text-foreground mb-3">Résumé financier</h3>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Revenu brut</span>
              <span className="font-semibold text-foreground">{fmtMoney(Number(entry.gross_pay))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total retenues</span>
              <span className="font-semibold text-destructive">- {fmtMoney(Number(entry.deductions_total))}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between items-center">
              <span className="font-bold text-foreground">Net à payer</span>
              <span className="text-xl font-bold text-emerald-600">{fmtMoney(Number(entry.net_pay))}</span>
            </div>
          </div>

          {/* Notes */}
          {entry.notes && (
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Note</p>
              <p className="text-sm text-foreground">{entry.notes}</p>
            </div>
          )}

          {/* Dates */}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            {entry.paid_at && (
              <span>Payé le {format(new Date(entry.paid_at), "d MMMM yyyy", { locale: fr })}</span>
            )}
            {entry.acknowledged_at && (
              <span>Accusé le {format(new Date(entry.acknowledged_at), "d MMMM yyyy", { locale: fr })}</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-2">
            {entry.pdf_url ? (
              <Button
                variant="default"
                size="sm"
                onClick={handleDownload}
                disabled={downloading}
              >
                {downloading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Télécharger PDF
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                <AlertCircle className="h-4 w-4 mr-2 text-muted-foreground" />
                PDF non disponible
              </Button>
            )}

            {!entry.acknowledged_at && entry.status !== "draft" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAcknowledge}
                disabled={acknowledging}
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
              >
                {acknowledging ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Confirmer réception
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* Reusable table row */
function Row({
  label,
  value,
  icon,
  highlight,
  destructive,
  subtle,
  sublabel,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: boolean;
  destructive?: boolean;
  subtle?: boolean;
  sublabel?: string;
}) {
  return (
    <tr className={cn("border-b border-border last:border-0", subtle && "opacity-50")}>
      <td className="px-4 py-2.5 w-8 text-muted-foreground">{icon}</td>
      <td className="py-2.5">
        <span className="text-sm text-foreground">{label}</span>
        {sublabel && <p className="text-[10px] text-muted-foreground">{sublabel}</p>}
      </td>
      <td className={cn(
        "px-4 py-2.5 text-right font-semibold",
        destructive && "text-destructive",
        highlight && "text-emerald-600",
        !destructive && !highlight && "text-foreground",
      )}>
        {value}
      </td>
    </tr>
  );
}
