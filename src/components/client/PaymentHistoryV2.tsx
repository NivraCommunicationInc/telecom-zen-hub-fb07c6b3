/**
 * Payment History V2 - Clear separation of Credits (payments) vs Debits (invoices)
 * Uses V2 billing tables as source of truth
 */

import { useQuery } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Calendar,
  CreditCard,
  FileText,
  Banknote,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface PaymentHistoryV2Props {
  userId: string;
}

interface LedgerEntry {
  id: string;
  type: 'credit' | 'debit';
  date: string;
  description: string;
  amount: number;
  reference: string | null;
  status: string;
  method?: string;
}

const methodLabels: Record<string, string> = {
  interac: "Interac",
  paypal: "PayPal",
  cash: "Comptant",
  credit_card: "Carte",
  bank_transfer: "Virement",
};

export function PaymentHistoryV2({ userId }: PaymentHistoryV2Props) {
  const { data: entries, isLoading } = useQuery({
    queryKey: ["ledger-history-v2", userId],
    queryFn: async () => {
      // Get customer_id first
      const { data: customer } = await backendClient
        .from('billing_customers')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!customer) return [];

      // Fetch invoices (debits)
      const { data: invoices } = await backendClient
        .from('billing_invoices')
        .select('id, invoice_number, created_at, total, status, type')
        .eq('customer_id', customer.id)
        .not('status', 'in', '("cancelled","refunded")')
        .order('created_at', { ascending: false })
        .limit(50);

      // Fetch payments (credits)
      const { data: payments } = await backendClient
        .from('billing_payments')
        .select('id, reference, created_at, amount, status, method')
        .eq('customer_id', customer.id)
        .eq('status', 'confirmed')
        .order('created_at', { ascending: false })
        .limit(50);

      const ledgerEntries: LedgerEntry[] = [];

      // Add invoices as debits
      for (const inv of invoices || []) {
        ledgerEntries.push({
          id: inv.id,
          type: 'debit',
          date: inv.created_at,
          description: `Facture ${inv.invoice_number || inv.id.slice(0, 8)}`,
          amount: Number(inv.total) || 0,
          reference: inv.invoice_number,
          status: inv.status,
        });
      }

      // Add payments as credits
      for (const pay of payments || []) {
        ledgerEntries.push({
          id: pay.id,
          type: 'credit',
          date: pay.created_at,
          description: `Paiement reçu`,
          amount: Number(pay.amount) || 0,
          reference: pay.reference,
          status: pay.status,
          method: pay.method,
        });
      }

      // Sort by date descending
      ledgerEntries.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      return ledgerEntries;
    },
    enabled: !!userId,
  });

  const credits = entries?.filter(e => e.type === 'credit') || [];
  const debits = entries?.filter(e => e.type === 'debit') || [];

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const EntryRow = ({ entry }: { entry: LedgerEntry }) => (
    <div className={`p-3 rounded-lg flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 ${
      entry.type === 'credit' 
        ? 'bg-emerald-500/5 border border-emerald-500/20' 
        : 'bg-amber-500/5 border border-amber-500/20'
    }`}>
      {/* Left side: Icon + Description */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center ${
          entry.type === 'credit' ? 'bg-emerald-500/20' : 'bg-amber-500/20'
        }`}>
          {entry.type === 'credit' ? (
            <ArrowDownCircle className="w-5 h-5 text-emerald-500" />
          ) : (
            <ArrowUpCircle className="w-5 h-5 text-amber-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{entry.description}</p>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3 flex-shrink-0" />
            <span className="whitespace-nowrap">{format(new Date(entry.date), "d MMM yyyy", { locale: fr })}</span>
            {entry.method && (
              <>
                <span className="hidden sm:inline">•</span>
                <span className="whitespace-nowrap">{methodLabels[entry.method] || entry.method}</span>
              </>
            )}
          </div>
        </div>
      </div>
      {/* Right side: Amount */}
      <div className="text-right flex-shrink-0 pl-[52px] sm:pl-0">
        <p className={`font-bold text-base sm:text-sm ${
          entry.type === 'credit' ? 'text-emerald-500' : 'text-amber-500'
        }`}>
          {entry.type === 'credit' ? '+' : '-'}
          {entry.amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
        </p>
        {entry.reference && (
          <p className="text-xs text-muted-foreground font-mono truncate max-w-[120px] sm:max-w-none">{entry.reference}</p>
        )}
      </div>
    </div>
  );

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Banknote className="w-5 h-5 text-primary" />
          Historique des transactions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4 h-auto">
            <TabsTrigger value="all" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
              <span className="hidden sm:inline">Tout</span>
              <span className="sm:hidden">Tous</span>
              <span className="ml-1">({entries?.length || 0})</span>
            </TabsTrigger>
            <TabsTrigger value="credits" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
              <ArrowDownCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-0.5 sm:mr-1 text-emerald-500 flex-shrink-0" />
              <span className="truncate">{credits.length}</span>
            </TabsTrigger>
            <TabsTrigger value="debits" className="text-xs sm:text-sm py-2 px-1 sm:px-3">
              <ArrowUpCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-0.5 sm:mr-1 text-amber-500 flex-shrink-0" />
              <span className="truncate">{debits.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-2">
            {entries && entries.length > 0 ? (
              entries.slice(0, 10).map(entry => (
                <EntryRow key={entry.id} entry={entry} />
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Aucune transaction</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="credits" className="space-y-2">
            {credits.length > 0 ? (
              credits.slice(0, 10).map(entry => (
                <EntryRow key={entry.id} entry={entry} />
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Aucun paiement enregistré</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="debits" className="space-y-2">
            {debits.length > 0 ? (
              debits.slice(0, 10).map(entry => (
                <EntryRow key={entry.id} entry={entry} />
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Aucune facture</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default PaymentHistoryV2;
