/**
 * MobileInvoiceCard - Responsive card display for invoices on mobile
 * Replaces table rows on small screens
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  FileText, 
  Download, 
  Eye, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle,
  Calendar,
  Clock
} from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

interface MobileInvoiceCardProps {
  invoice: any;
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
  calculateTotal: (inv: any) => number;
  onViewPDF: (inv: any) => void;
  onDownloadPDF: (inv: any) => void;
  onPreview: (inv: any) => void;
  onPay: (inv: any) => void;
  onDispute: (inv: any) => void;
}

export function MobileInvoiceCard({
  invoice,
  statusLabels,
  statusColors,
  calculateTotal,
  onViewPDF,
  onDownloadPDF,
  onPreview,
  onPay,
  onDispute
}: MobileInvoiceCardProps) {
  const isOverdue = invoice.due_date && isPast(parseISO(invoice.due_date)) && invoice.status !== "paid";
  const total = calculateTotal(invoice);
  const lateFeeAmount = isOverdue && !invoice.late_fee_applied ? Number(invoice.amount) * 0.05 : 0;
  const balanceDue = Number(invoice.balance_due);
  const isPaid = invoice.status === "paid" || (balanceDue <= 0 && invoice.balance_due !== null);

  return (
    <Card className={`bg-card border-border overflow-hidden ${isOverdue ? 'border-l-4 border-l-red-500' : ''}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header: Invoice number + Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-sm font-bold text-foreground truncate">
              {invoice.invoice_number || invoice.id.slice(0, 8)}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
              <Calendar className="w-3 h-3 flex-shrink-0" />
              <span>{format(new Date(invoice.created_at), "d MMM yyyy", { locale: fr })}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <Badge className={statusColors[isOverdue && invoice.status !== "paid" ? "overdue" : invoice.status] || "bg-muted"}>
              {isOverdue && invoice.status !== "paid" ? "En retard" : statusLabels[invoice.status] || invoice.status}
            </Badge>
            {invoice.preauth_discount_applied && (
              <Badge className="bg-emerald-500/20 text-emerald-500 text-xs">
                -5$/mois
              </Badge>
            )}
          </div>
        </div>

        {/* Amounts Grid */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="bg-muted/30 p-2 rounded-lg">
            <p className="text-xs text-muted-foreground">Montant</p>
            <p className="font-medium">
              {Number(invoice.amount || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
            </p>
          </div>
          
          <div className="bg-muted/30 p-2 rounded-lg">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-bold text-foreground">
              {total.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
            </p>
          </div>

          {(Number(invoice.fees || 0) + lateFeeAmount) > 0 && (
            <div className="bg-amber-500/10 p-2 rounded-lg">
              <p className="text-xs text-muted-foreground">Frais</p>
              <p className="font-medium text-amber-500">
                +{(Number(invoice.fees || 0) + lateFeeAmount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                {lateFeeAmount > 0 && <span className="text-xs block text-red-500">(+5% retard)</span>}
              </p>
            </div>
          )}

          {Number(invoice.credits || 0) > 0 && (
            <div className="bg-emerald-500/10 p-2 rounded-lg">
              <p className="text-xs text-muted-foreground">Crédits</p>
              <p className="font-medium text-emerald-500">
                -{Number(invoice.credits || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
              </p>
            </div>
          )}
        </div>

        {/* Due Date & Balance */}
        <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
          <div className="flex items-center gap-2">
            <Clock className={`w-4 h-4 ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`} />
            <div className="text-sm">
              <span className="text-muted-foreground">Échéance: </span>
              <span className={isOverdue ? "text-red-500 font-medium" : ""}>
                {invoice.due_date ? format(new Date(invoice.due_date), "d MMM yyyy", { locale: fr }) : "—"}
              </span>
            </div>
          </div>
          
          {invoice.balance_due !== null && invoice.balance_due !== undefined && (
            <div className="text-right">
              {balanceDue <= 0 ? (
                <span className="text-emerald-500 font-medium flex items-center gap-1 text-sm">
                  <CheckCircle className="w-3 h-3" />
                  Payé
                </span>
              ) : (
                <div>
                  <p className="text-xs text-muted-foreground">Solde dû</p>
                  <p className="text-amber-500 font-bold text-sm">
                    {balanceDue.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          <Button 
            size="sm" 
            variant="outline"
            className="flex-1 min-w-[80px]"
            onClick={() => onViewPDF(invoice)}
          >
            <FileText className="w-4 h-4 mr-1" />
            PDF
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            className="flex-1 min-w-[80px]"
            onClick={() => onDownloadPDF(invoice)}
          >
            <Download className="w-4 h-4 mr-1" />
            Télécharger
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => onPreview(invoice)}
          >
            <Eye className="w-4 h-4" />
          </Button>
          
          {/* Pay button */}
          {!isPaid && (
            <Button 
              size="sm" 
              variant="hero"
              className="flex-1 min-w-[100px]"
              onClick={() => onPay(invoice)}
            >
              <DollarSign className="w-4 h-4 mr-1" />
              Payer
            </Button>
          )}
          
          {/* Dispute button for paid invoices */}
          {invoice.status === "paid" && (
            <Button 
              size="sm" 
              variant="outline"
              className="text-amber-500 border-amber-500/50 hover:bg-amber-500/10"
              onClick={() => onDispute(invoice)}
            >
              <AlertTriangle className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default MobileInvoiceCard;
