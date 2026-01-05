import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/portalClient";
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
  CreditCard
} from "lucide-react";
import { Link } from "react-router-dom";

interface ClientBalanceSummaryProps {
  userId: string;
  userEmail?: string;
}

interface UnpaidInvoice {
  source_table: string;
  id: string;
  invoice_number: string | null;
  period_start: string | null;
  period_end: string | null;
  issue_date: string;
  due_date: string | null;
  status: string;
  total: number;
  amount_paid: number;
  amount_due: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "En attente", color: "bg-amber-500/20 text-amber-500", icon: Clock },
  issued: { label: "Émise", color: "bg-blue-500/20 text-blue-500", icon: FileText },
  overdue: { label: "Paiement en retard", color: "bg-red-500/20 text-red-500", icon: AlertCircle },
  renewal_due: { label: "Renouvellement dû", color: "bg-orange-500/20 text-orange-500", icon: Clock },
  in_verification: { label: "En vérification (grâce 24h)", color: "bg-cyan-500/20 text-cyan-500", icon: Clock },
  expired: { label: "Expiré (non-renouvelé)", color: "bg-red-600/20 text-red-600", icon: AlertCircle },
  suspended: { label: "Service en suspension", color: "bg-red-500/20 text-red-500", icon: AlertCircle },
  partial: { label: "Partielle", color: "bg-orange-500/20 text-orange-500", icon: Clock },
  paid: { label: "Payée", color: "bg-emerald-500/20 text-emerald-500", icon: CheckCircle },
};

/**
 * Check if a payment is considered "captured" (affects balance)
 * Only captured payments reduce the amount due
 */
function isPaymentCaptured(status: string, paidAt: string | null): boolean {
  return status === "paid" && !!paidAt;
}

export const ClientBalanceSummary = ({ userId, userEmail }: ClientBalanceSummaryProps) => {
  // Fetch billing invoices (non-cancelled only)
  const { data: billingInvoices, isLoading: billingLoading } = useQuery({
    queryKey: ["my-billing-ledger", userId],
    queryFn: async () => {
      let query = supabase
        .from("billing")
        .select("*")
        .not("status", "in", '("cancelled","voided")');

      if (userEmail) {
        query = query.or(`user_id.eq.${userId},client_email.eq.${userEmail}`);
      } else {
        query = query.eq("user_id", userId);
      }

      const { data, error } = await query.order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // Fetch monthly invoices (non-cancelled only)
  const { data: monthlyInvoices, isLoading: monthlyLoading } = useQuery({
    queryKey: ["my-monthly-ledger", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_invoices")
        .select("*")
        .eq("client_id", userId)
        .not("status", "in", '("cancelled","voided")')
        .order("issue_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const isLoading = billingLoading || monthlyLoading;

  // LEDGER-BASED BALANCE CALCULATION
  // Balance = sum(invoice debits) - sum(captured payments)
  let totalInvoiced = 0;
  let totalCapturedPayments = 0;

  // Process billing invoices
  for (const inv of billingInvoices || []) {
    const invoiceAmount = Number(inv.amount) || 0;
    const amountPaid = Number(inv.amount_paid) || 0;
    
    totalInvoiced += invoiceAmount;
    
    // Only count captured payments (paid status + paid_at timestamp)
    if (amountPaid > 0 && isPaymentCaptured(inv.status, inv.paid_at)) {
      totalCapturedPayments += amountPaid;
    }
  }

  // Process monthly invoices
  for (const inv of monthlyInvoices || []) {
    const invoiceAmount = Number(inv.total) || 0;
    const amountPaid = Number(inv.amount_paid) || 0;
    
    totalInvoiced += invoiceAmount;
    
    // Only count captured payments
    if (amountPaid > 0 && isPaymentCaptured(inv.status, inv.paid_at)) {
      totalCapturedPayments += amountPaid;
    }
  }

  // Calculate ledger balance
  const ledgerBalance = totalInvoiced - totalCapturedPayments;
  const isCredit = ledgerBalance < 0;
  const displayBalance = Math.abs(ledgerBalance);

  // Combine UNPAID invoices only for display (not paid ones)
  const allUnpaidInvoices: UnpaidInvoice[] = [
    ...(billingInvoices || [])
      .filter(inv => inv.status !== "paid") // Only unpaid
      .map(inv => ({
        source_table: 'billing',
        id: inv.id,
        invoice_number: inv.invoice_number,
        period_start: null,
        period_end: null,
        issue_date: inv.created_at,
        due_date: inv.due_date,
        status: inv.status,
        total: Number(inv.amount) || 0,
        amount_paid: Number(inv.amount_paid) || 0,
        amount_due: (Number(inv.amount) || 0) - (Number(inv.amount_paid) || 0),
      })),
    ...(monthlyInvoices || [])
      .filter(inv => inv.status !== "paid") // Only unpaid
      .map(inv => ({
        source_table: 'monthly_invoices',
        id: inv.id,
        invoice_number: inv.invoice_number,
        period_start: inv.period_start,
        period_end: inv.period_end,
        issue_date: inv.issue_date,
        due_date: inv.due_date,
        status: inv.status,
        total: Number(inv.total) || 0,
        amount_paid: Number(inv.amount_paid) || 0,
        amount_due: (Number(inv.total) || 0) - (Number(inv.amount_paid) || 0),
      })),
  ]
    .filter(inv => inv.amount_due > 0) // Only show if actually has balance
    .sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

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

  return (
    <div className="space-y-3">
      {/* Prepaid info banner */}
      <Card className="bg-cyan-500/10 border-cyan-500/30">
        <CardContent className="p-3">
          <p className="text-xs text-cyan-700 dark:text-cyan-300">
            <strong>Service prépayé</strong> = renouvellement seulement si paiement confirmé. Après 90 jours sans renouvellement, le numéro peut devenir irrécupérable (nouveau numéro requis).
          </p>
        </CardContent>
      </Card>

      <Card className={`bg-card border-border ${!isCredit && ledgerBalance > 0 ? 'border-amber-500/30' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isCredit ? 'bg-blue-500/20' : ledgerBalance > 0 ? 'bg-amber-500/20' : 'bg-emerald-500/20'
            }`}>
              {isCredit ? (
                <CreditCard className="w-5 h-5 text-blue-500" />
              ) : (
                <DollarSign className={`w-5 h-5 ${ledgerBalance > 0 ? 'text-amber-500' : 'text-emerald-500'}`} />
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">
                {isCredit ? "Crédit disponible" : "Solde dû"}
              </p>
              <p className={`text-xl font-bold ${
                isCredit ? 'text-blue-500' : ledgerBalance > 0 ? 'text-amber-500' : 'text-emerald-500'
              }`}>
                {displayBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
              </p>
            </div>
          </div>

        {/* Invoice breakdown */}
        {allUnpaidInvoices.length > 0 ? (
          <div className="space-y-2 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">
              Factures en attente ({allUnpaidInvoices.length})
            </p>
            {allUnpaidInvoices.slice(0, 3).map((invoice) => {
              const statusInfo = statusConfig[invoice.status] || statusConfig.pending;
              const isOverdue = invoice.due_date && new Date(invoice.due_date) < new Date();

              return (
                <div 
                  key={`${invoice.source_table}-${invoice.id}`}
                  className={`p-2 rounded-lg flex items-center justify-between ${
                    isOverdue ? 'bg-red-500/5 border border-red-500/20' : 'bg-muted/30'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium truncate">
                        {invoice.invoice_number || '—'}
                      </span>
                      <Badge className={`${statusInfo.color} text-xs`}>
                        {isOverdue ? 'En retard' : statusInfo.label}
                      </Badge>
                    </div>
                    {invoice.due_date && (
                      <p className={`text-xs ${isOverdue ? 'text-red-500' : 'text-muted-foreground'}`}>
                        Échéance: {format(new Date(invoice.due_date), "d MMM yyyy", { locale: fr })}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="font-bold text-sm">
                      {invoice.amount_due.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                    </p>
                  </div>
                </div>
              );
            })}
            {allUnpaidInvoices.length > 3 && (
              <Link to="/portal/invoices">
                <Button variant="link" size="sm" className="p-0 h-auto text-xs">
                  Voir toutes les factures ({allUnpaidInvoices.length})
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
