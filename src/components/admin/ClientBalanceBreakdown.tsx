import { useQuery } from "@tanstack/react-query";
import { adminClient as supabase } from "@/integrations/backend/adminClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  Wallet, 
  FileText, 
  ExternalLink, 
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingDown,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useLedgerBalance } from "@/hooks/useLedgerBalance";
import { isPaymentCaptured } from "@/lib/billingValidation";

interface ClientBalanceBreakdownProps {
  clientUserId: string;
  clientEmail?: string;
  showTitle?: boolean;
  compact?: boolean;
}

interface UnpaidInvoice {
  source_table: string;
  id: string;
  client_id: string;
  invoice_number: string | null;
  period_start: string | null;
  period_end: string | null;
  issue_date: string;
  due_date: string | null;
  status: string;
  total: number;
  amount_paid: number;
  amount_due: number;
  description: string | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "En attente", color: "bg-amber-500/20 text-amber-500", icon: Clock },
  issued: { label: "Émise", color: "bg-blue-500/20 text-blue-500", icon: FileText },
  overdue: { label: "En retard", color: "bg-red-500/20 text-red-500", icon: AlertCircle },
  partial: { label: "Partielle", color: "bg-orange-500/20 text-orange-500", icon: Clock },
  paid: { label: "Payée", color: "bg-emerald-500/20 text-emerald-500", icon: CheckCircle },
};

export const ClientBalanceBreakdown = ({ 
  clientUserId, 
  clientEmail,
  showTitle = true,
  compact = false
}: ClientBalanceBreakdownProps) => {
  // Use the new ledger-based balance
  const { data: ledgerBalance, isLoading: ledgerLoading } = useLedgerBalance(clientUserId);

  // Fetch unpaid invoices from billing table
  const { data: billingInvoices, isLoading: billingLoading } = useQuery({
    queryKey: ["client-billing-unpaid", clientUserId],
    queryFn: async () => {
      let query = supabase
        .from("billing")
        .select("*")
        .in("status", ["pending", "overdue", "partial"]);

      // Query by user_id OR client_email
      if (clientEmail) {
        query = query.or(`user_id.eq.${clientUserId},client_email.eq.${clientEmail}`);
      } else {
        query = query.eq("user_id", clientUserId);
      }

      const { data, error } = await query.order("due_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientUserId,
  });

  // Fetch unpaid monthly invoices
  const { data: monthlyInvoices, isLoading: monthlyLoading } = useQuery({
    queryKey: ["client-monthly-unpaid", clientUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_invoices")
        .select("*")
        .eq("client_id", clientUserId)
        .in("status", ["issued", "overdue", "partial"])
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientUserId,
  });

  const isLoading = billingLoading || monthlyLoading || ledgerLoading;

  // Use ledger balance as the source of truth (only counts CAPTURED payments)
  const totalBalance = ledgerBalance?.balance ?? 0;
  const hasCredit = ledgerBalance?.isCredit ?? false;
  const availableCredit = ledgerBalance?.availableCredit ?? 0;
  const preauthorized = ledgerBalance?.preauthorized ?? 0;

  // Combine and sort all invoices
  const allUnpaidInvoices: UnpaidInvoice[] = [
    ...(billingInvoices || []).map(inv => ({
      source_table: 'billing',
      id: inv.id,
      client_id: inv.user_id,
      invoice_number: inv.invoice_number,
      period_start: null,
      period_end: null,
      issue_date: inv.created_at,
      due_date: inv.due_date,
      status: inv.status,
      total: Number(inv.amount) || 0,
      amount_paid: Number(inv.amount_paid) || 0,
      amount_due: (Number(inv.amount) || 0) - (Number(inv.amount_paid) || 0),
      description: inv.related_order_number || 'Facture de commande',
    })),
    ...(monthlyInvoices || []).map(inv => ({
      source_table: 'monthly_invoices',
      id: inv.id,
      client_id: inv.client_id,
      invoice_number: inv.invoice_number,
      period_start: inv.period_start,
      period_end: inv.period_end,
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      status: inv.status,
      total: Number(inv.total) || 0,
      amount_paid: Number(inv.amount_paid) || 0,
      amount_due: (Number(inv.total) || 0) - (Number(inv.amount_paid) || 0),
      description: `Période: ${inv.period_start} - ${inv.period_end}`,
    })),
  ].sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
  });

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className={compact ? "py-3" : ""}>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-12 w-full mb-4" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-card border-border ${totalBalance > 0 ? 'border-amber-500/30' : hasCredit ? 'border-emerald-500/30' : ''}`}>
      {showTitle && (
        <CardHeader className={compact ? "py-3" : ""}>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className={`w-5 h-5 ${totalBalance > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
            Solde du compte
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={compact ? "pt-0" : ""}>
        {/* Total Balance */}
        <div className={`p-4 rounded-lg mb-4 ${
          totalBalance > 0 
            ? 'bg-amber-500/10 border border-amber-500/30' 
            : hasCredit
            ? 'bg-emerald-500/10 border border-emerald-500/30'
            : 'bg-muted/50 border border-border'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {hasCredit ? 'Crédit disponible' : 'Solde en souffrance'}
              </p>
              <p className={`text-3xl font-bold ${totalBalance > 0 ? 'text-amber-500' : hasCredit ? 'text-emerald-500' : 'text-foreground'}`}>
                {hasCredit 
                  ? availableCredit.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })
                  : totalBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })
                }
              </p>
            </div>
            {totalBalance === 0 && !hasCredit && (
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            )}
            {totalBalance > 0 && (
              <AlertCircle className="w-8 h-8 text-amber-500" />
            )}
            {hasCredit && (
              <TrendingDown className="w-8 h-8 text-emerald-500" />
            )}
          </div>
        </div>

        {/* Preauthorized Notice */}
        {preauthorized > 0 && (
          <div className="mb-4 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-sm text-blue-600 font-medium">
                  Préautorisé: {preauthorized.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </p>
                <p className="text-xs text-muted-foreground">
                  Non capturé — n'affecte pas le solde
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Breakdown */}
        {allUnpaidInvoices.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Détail des factures impayées ({allUnpaidInvoices.length})
            </p>
            {allUnpaidInvoices.map((invoice) => {
              const statusInfo = statusConfig[invoice.status] || statusConfig.pending;
              const StatusIcon = statusInfo.icon;
              const isOverdue = invoice.due_date && new Date(invoice.due_date) < new Date() && invoice.status !== 'paid';

              return (
                <div 
                  key={`${invoice.source_table}-${invoice.id}`}
                  className={`p-3 border rounded-lg ${
                    isOverdue ? 'border-red-500/30 bg-red-500/5' : 'border-border bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-mono text-sm font-medium truncate">
                          {invoice.invoice_number || '—'}
                        </span>
                        <Badge className={`${statusInfo.color} text-xs`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {isOverdue && invoice.status !== 'overdue' ? 'En retard' : statusInfo.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {invoice.period_start && invoice.period_end 
                          ? `${format(new Date(invoice.period_start), "d MMM", { locale: fr })} - ${format(new Date(invoice.period_end), "d MMM yyyy", { locale: fr })}`
                          : invoice.description || 'Facture'
                        }
                      </p>
                      {invoice.due_date && (
                        <p className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                          Échéance: {format(new Date(invoice.due_date), "d MMM yyyy", { locale: fr })}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-foreground">
                        {invoice.amount_due.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                      </p>
                      {invoice.amount_paid > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Payé: {invoice.amount_paid.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                        </p>
                      )}
                    </div>
                    <Link 
                      to={invoice.source_table === 'monthly_invoices' 
                        ? `/admin/billing?invoice=${invoice.id}` 
                        : `/admin/billing?invoice=${invoice.id}`
                      }
                    >
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-4">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Aucune facture impayée</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientBalanceBreakdown;
