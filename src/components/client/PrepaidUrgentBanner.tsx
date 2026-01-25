/**
 * Prepaid Urgent Banner - Shows when client has overdue invoices
 * Displays prominently in portal layout when payment is late
 */

import { useLedgerBalance } from "@/hooks/useLedgerBalance";
import { useQuery } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend/client";
import { AlertTriangle, CreditCard, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { differenceInDays } from "date-fns";

interface PrepaidUrgentBannerProps {
  userId: string;
}

export function PrepaidUrgentBanner({ userId }: PrepaidUrgentBannerProps) {
  const { data: ledger } = useLedgerBalance(userId);
  
  // Check for overdue invoices
  const { data: overdueData } = useQuery({
    queryKey: ["overdue-check-v2", userId],
    queryFn: async () => {
      // Get customer_id first
      const { data: customer } = await backendClient
        .from('billing_customers')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!customer) return { count: 0, oldestDueDate: null, daysOverdue: 0 };

      // Check for overdue invoices
      const { data: overdueInvoices } = await backendClient
        .from('billing_invoices')
        .select('id, due_date, balance_due')
        .eq('customer_id', customer.id)
        .eq('status', 'overdue')
        .order('due_date', { ascending: true });

      if (!overdueInvoices || overdueInvoices.length === 0) {
        return { count: 0, oldestDueDate: null, daysOverdue: 0 };
      }

      const oldestDueDate = overdueInvoices[0]?.due_date;
      const daysOverdue = oldestDueDate 
        ? differenceInDays(new Date(), new Date(oldestDueDate))
        : 0;

      return {
        count: overdueInvoices.length,
        oldestDueDate,
        daysOverdue,
      };
    },
    enabled: !!userId,
    staleTime: 60000, // 1 minute
  });

  // Don't show if no overdue invoices or balance is credit/zero
  if (!overdueData?.count || !ledger || ledger.balance <= 0) {
    return null;
  }

  const isUrgent = overdueData.daysOverdue > 7;
  const isCritical = overdueData.daysOverdue > 30;

  return (
    <div 
      className={`w-full py-3 px-4 ${
        isCritical 
          ? 'bg-red-600 text-white' 
          : isUrgent 
          ? 'bg-red-500/90 text-white' 
          : 'bg-amber-500 text-amber-950'
      }`}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <span className="font-semibold">
              {isCritical 
                ? 'Action urgente requise!' 
                : isUrgent 
                ? 'Paiement en retard' 
                : 'Facture(s) impayée(s)'}
            </span>
            <span className="ml-2 text-sm opacity-90">
              {overdueData.count} facture{overdueData.count > 1 ? 's' : ''} en attente
              {overdueData.daysOverdue > 0 && ` depuis ${overdueData.daysOverdue} jour${overdueData.daysOverdue > 1 ? 's' : ''}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg">
            {ledger.balance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
          </span>
          <Link to="/portal/invoices">
            <Button 
              size="sm" 
              variant={isCritical ? "secondary" : "outline"}
              className={isCritical 
                ? "bg-white text-red-600 hover:bg-white/90" 
                : isUrgent 
                ? "border-white text-white hover:bg-white/20"
                : "border-amber-950 text-amber-950 hover:bg-amber-950/10"
              }
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Payer maintenant
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default PrepaidUrgentBanner;
