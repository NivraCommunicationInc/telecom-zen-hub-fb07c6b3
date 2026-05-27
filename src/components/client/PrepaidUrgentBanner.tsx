/**
 * Prepaid Urgent Banner - Shows when client has pending invoices requiring renewal
 * Displays prominently in portal layout when payment is needed
 * 
 * CRITICAL: Uses portalClient for authenticated RLS queries
 * TERMINOLOGY: Uses prepaid-friendly labels (no "impayé", "dette", "overdue")
 */

import { useLedgerBalance } from "@/hooks/useLedgerBalance";
import { portalClient } from "@/integrations/backend/portalClient";
import { AlertTriangle, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { differenceInDays } from "date-fns";
import { getPrepaidBannerContent } from "@/lib/constants/billingLabels";
import { useCanonicalClientData } from "@/hooks/useCanonicalClientData";

interface PrepaidUrgentBannerProps {
  userId: string;
}

export function PrepaidUrgentBanner({ userId }: PrepaidUrgentBannerProps) {
  // Use portal client for proper RLS authentication
  const { data: ledger } = useLedgerBalance(userId, portalClient);
  const { data: canonicalData } = useCanonicalClientData(userId);
  
  const pendingInvoices = (canonicalData?.invoices || [])
    .filter((invoice: any) => ["pending", "not_renewed"].includes(String(invoice.status || "").toLowerCase()) && Number(invoice.balance_due || 0) > 0)
    .sort((a: any, b: any) => new Date(a.due_date || a.created_at || 0).getTime() - new Date(b.due_date || b.created_at || 0).getTime());
  const oldestDueDate = pendingInvoices[0]?.due_date || null;
  const pendingData = {
    count: pendingInvoices.length,
    oldestDueDate,
    daysPastDue: oldestDueDate ? Math.max(0, differenceInDays(new Date(), new Date(oldestDueDate))) : 0,
  };

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
