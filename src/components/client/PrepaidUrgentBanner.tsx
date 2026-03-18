/**
 * Prepaid Urgent Banner - Shows when client has pending invoices requiring renewal
 * Displays prominently in portal layout when payment is needed
 * 
 * CRITICAL: Uses portalClient for authenticated RLS queries
 * TERMINOLOGY: Uses prepaid-friendly labels (no "impayé", "dette", "overdue")
 */

import { useLedgerBalance } from "@/hooks/useLedgerBalance";
import { useQuery } from "@tanstack/react-query";
import { portalClient } from "@/integrations/backend/portalClient";
import { AlertTriangle, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { differenceInDays } from "date-fns";
import { getPrepaidBannerContent } from "@/lib/constants/billingLabels";

interface PrepaidUrgentBannerProps {
  userId: string;
}

export function PrepaidUrgentBanner({ userId }: PrepaidUrgentBannerProps) {
  // Use portal client for proper RLS authentication
  const { data: ledger } = useLedgerBalance(userId, portalClient);
  
  // Check for pending invoices requiring renewal
  const { data: pendingData } = useQuery({
    queryKey: ["renewal-check-v2", userId],
    queryFn: async () => {
      // Get customer_id first
      const { data: customer } = await portalClient
        .from('billing_customers')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!customer) return { count: 0, oldestDueDate: null, daysPastDue: 0 };

      // Check for pending invoices past due date (need renewal)
      // PREPAID MODEL: Only pending/not_renewed statuses, NOT "overdue"
      const { data: pendingInvoices } = await portalClient
        .from('billing_invoices')
        .select('id, due_date, balance_due')
        .eq('customer_id', customer.id)
        .in('status', ['pending', 'not_renewed'])
        .gt('balance_due', 0)
        .order('due_date', { ascending: true });

      if (!pendingInvoices || pendingInvoices.length === 0) {
        return { count: 0, oldestDueDate: null, daysPastDue: 0 };
      }

      const oldestDueDate = pendingInvoices[0]?.due_date;
      const daysPastDue = oldestDueDate 
        ? Math.max(0, differenceInDays(new Date(), new Date(oldestDueDate)))
        : 0;

      return {
        count: pendingInvoices.length,
        oldestDueDate,
        daysPastDue,
      };
    },
    enabled: !!userId,
    staleTime: 60000, // 1 minute
  });

  // Don't show if no pending invoices or balance is credit/zero
  if (!pendingData?.count || !ledger || ledger.balance <= 0) {
    return null;
  }

  const isUrgent = pendingData.daysPastDue > 7;
  const isCritical = pendingData.daysPastDue > 30;
  const bannerContent = getPrepaidBannerContent(pendingData.daysPastDue);

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
              {bannerContent.title}
            </span>
            <span className="ml-2 text-sm opacity-90">
              {pendingData.count} facture{pendingData.count > 1 ? 's' : ''} en attente de renouvellement
              {pendingData.daysPastDue > 0 && ` depuis ${pendingData.daysPastDue} jour${pendingData.daysPastDue > 1 ? 's' : ''}`}
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
              Renouveler maintenant
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default PrepaidUrgentBanner;
