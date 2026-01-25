/**
 * Client Balance Summary - V2 Billing System
 * Uses useLedgerBalance hook as single source of truth
 */

import { useLedgerBalance } from "@/hooks/useLedgerBalance";
import { useQuery } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  FileText, 
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  ExternalLink,
  CreditCard,
  Calendar
} from "lucide-react";
import { Link } from "react-router-dom";

interface ClientBalanceSummaryProps {
  userId: string;
  userEmail?: string;
}

interface UnpaidInvoice {
  id: string;
  invoice_number: string;
  due_date: string;
  status: string;
  total: number;
  amount_paid: number;
  balance_due: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "En attente", color: "bg-amber-500/20 text-amber-500", icon: Clock },
  issued: { label: "Émise", color: "bg-blue-500/20 text-blue-500", icon: FileText },
  overdue: { label: "En retard", color: "bg-red-500/20 text-red-500", icon: AlertCircle },
  partial: { label: "Partielle", color: "bg-orange-500/20 text-orange-500", icon: Clock },
  paid: { label: "Payée", color: "bg-emerald-500/20 text-emerald-500", icon: CheckCircle },
};

export const ClientBalanceSummary = ({ userId }: ClientBalanceSummaryProps) => {
  // Use V2 ledger balance hook
  const { data: ledger, isLoading: ledgerLoading } = useLedgerBalance(userId);

  // Fetch unpaid invoices from V2 system
  const { data: unpaidInvoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ["unpaid-invoices-v2", userId],
    queryFn: async () => {
      // Get customer_id first
      const { data: customer } = await backendClient
        .from('billing_customers')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!customer) return [];

      const { data, error } = await backendClient
        .from('billing_invoices')
        .select('id, invoice_number, due_date, status, total, amount_paid, balance_due')
        .eq('customer_id', customer.id)
        .not('status', 'in', '("paid","cancelled","refunded")')
        .order('due_date', { ascending: true });

      if (error) throw error;
      return (data || []) as UnpaidInvoice[];
    },
    enabled: !!userId,
  });

  const isLoading = ledgerLoading || invoicesLoading;

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div>
              <Skeleton className="h-4 w-20 mb-1" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const balance = ledger?.balance ?? 0;
  const isCredit = balance < 0;
  const displayBalance = Math.abs(balance);

  return (
    <div className="space-y-3 col-span-full sm:col-span-1">
      {/* Prepaid info banner */}
      <Card className="bg-cyan-500/10 border-cyan-500/30">
        <CardContent className="p-2 sm:p-3">
          <p className="text-xs text-cyan-700 dark:text-cyan-300">
            <strong>Service prépayé</strong> = renouvellement seulement si paiement confirmé.
          </p>
        </CardContent>
      </Card>

      <Card className={`bg-card border-border ${!isCredit && balance > 0 ? 'border-amber-500/30' : ''}`}>
        <CardContent className="p-3 sm:p-4">
          {/* Balance Display */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center ${
                isCredit ? 'bg-blue-500/20' : balance > 0 ? 'bg-amber-500/20' : 'bg-emerald-500/20'
              }`}>
                {isCredit ? (
                  <CreditCard className="w-5 h-5 text-blue-500" />
                ) : (
                  <DollarSign className={`w-5 h-5 ${balance > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground uppercase truncate">
                  {isCredit ? "Crédit disponible" : "Solde dû"}
                </p>
                <p className={`text-lg sm:text-xl font-bold ${
                  isCredit ? 'text-blue-500' : balance > 0 ? 'text-amber-500' : 'text-emerald-500'
                }`}>
                  {displayBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </p>
              </div>
            </div>
            
            {/* Pay Now Button - Only show if balance > 0 */}
            {balance > 0 && (
              <Link to="/portal/invoices" className="w-full sm:w-auto">
                <Button 
                  className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground"
                  size="sm"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Payer
                </Button>
              </Link>
            )}
          </div>

          {/* Last Payment Info */}
          {ledger?.lastPaymentDate && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2 text-sm mb-4 p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs sm:text-sm">Dernier paiement</span>
              </div>
              <div className="text-left sm:text-right pl-6 sm:pl-0">
                <span className="font-medium text-sm">
                  {ledger.lastPaymentAmount?.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </span>
                <span className="text-muted-foreground ml-2 text-xs sm:text-sm">
                  {format(new Date(ledger.lastPaymentDate), "d MMM yyyy", { locale: fr })}
                </span>
              </div>
            </div>
          )}

          {/* Unpaid Invoices */}
          {unpaidInvoices && unpaidInvoices.length > 0 ? (
            <div className="space-y-2 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">
                Factures en attente ({unpaidInvoices.length})
              </p>
              {unpaidInvoices.slice(0, 3).map((invoice) => {
                const statusInfo = statusConfig[invoice.status] || statusConfig.pending;
                const isOverdue = invoice.due_date && new Date(invoice.due_date) < new Date();
                const amountDue = invoice.balance_due ?? (invoice.total - (invoice.amount_paid || 0));

                  return (
                    <div 
                      key={invoice.id}
                      className={`p-2 rounded-lg flex flex-col sm:flex-row sm:items-center gap-2 ${
                        isOverdue ? 'bg-red-500/5 border border-red-500/20' : 'bg-muted/30'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-medium truncate max-w-[100px]">
                            {invoice.invoice_number || '—'}
                          </span>
                          <Badge className={`${statusInfo.color} text-xs`}>
                            {isOverdue ? 'En retard' : statusInfo.label}
                          </Badge>
                        </div>
                        {invoice.due_date && (
                          <p className={`text-xs truncate ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`}>
                            Échéance: {format(new Date(invoice.due_date), "d MMM", { locale: fr })}
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-sm">
                          {amountDue.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                        </p>
                      </div>
                    </div>
                  );
              })}
              {unpaidInvoices.length > 3 && (
                <Link to="/portal/invoices">
                  <Button variant="link" size="sm" className="p-0 h-auto text-xs">
                    Voir toutes les factures ({unpaidInvoices.length})
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="pt-3 border-t border-border text-center">
              <CheckCircle className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Aucune facture impayée</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientBalanceSummary;
