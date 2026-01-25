/**
 * Ledger Balance Card Component
 * Real-time balance display with preauthorized vs captured distinction
 */

import { useLedgerBalance } from "@/hooks/useLedgerBalance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Wallet, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface LedgerBalanceCardProps {
  clientId: string;
  showTitle?: boolean;
  compact?: boolean;
}

export function LedgerBalanceCard({ 
  clientId, 
  showTitle = true,
  compact = false 
}: LedgerBalanceCardProps) {
  const { data: balance, isLoading, error } = useLedgerBalance(clientId);

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        {showTitle && (
          <CardHeader className={compact ? "py-3" : ""}>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
        )}
        <CardContent className={compact ? "pt-0" : ""}>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !balance) {
    return (
      <Card className="bg-card border-border border-red-500/30">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-500">
            <AlertCircle className="w-5 h-5" />
            <span>Erreur de chargement du solde</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Single balance state: positive = owes money, negative = has credit, zero = balanced
  const balanceAmount = balance.balance;
  const hasCredit = balanceAmount < 0;
  const owesAmount = balanceAmount > 0;
  const isBalanced = balanceAmount === 0;

  return (
    <Card className={`bg-card border-border ${owesAmount ? 'border-amber-500/30' : hasCredit ? 'border-emerald-500/30' : ''}`}>
      {showTitle && (
        <CardHeader className={compact ? "py-3" : ""}>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className={`w-5 h-5 ${owesAmount ? 'text-amber-500' : hasCredit ? 'text-emerald-500' : 'text-muted-foreground'}`} />
            Solde du compte
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={compact ? "pt-0" : ""}>
        {/* Single Balance Display */}
        <div className={`p-4 rounded-lg ${
          owesAmount 
            ? 'bg-amber-500/10 border border-amber-500/30' 
            : hasCredit
            ? 'bg-emerald-500/10 border border-emerald-500/30'
            : 'bg-muted/50 border border-border'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {hasCredit ? 'Crédit disponible' : owesAmount ? 'Solde à payer' : 'Compte équilibré'}
              </p>
              <p className={`text-3xl font-bold ${
                owesAmount ? 'text-amber-500' : hasCredit ? 'text-emerald-500' : 'text-foreground'
              }`}>
                {Math.abs(balanceAmount).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
              </p>
              {hasCredit && (
                <p className="text-xs text-emerald-600 mt-1">
                  Ce crédit sera appliqué automatiquement à votre prochaine facture
                </p>
              )}
            </div>
            {owesAmount ? (
              <TrendingUp className="w-8 h-8 text-amber-500" />
            ) : hasCredit ? (
              <TrendingDown className="w-8 h-8 text-emerald-500" />
            ) : (
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            )}
          </div>
        </div>

        {/* Zero Balance State - only when no transactions at all */}
        {isBalanced && balance.totalDebits === 0 && (
          <div className="mt-4 text-center">
            <CheckCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Aucune transaction</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default LedgerBalanceCard;
