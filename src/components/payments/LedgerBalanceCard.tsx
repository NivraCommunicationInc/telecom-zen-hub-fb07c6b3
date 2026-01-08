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

  const hasBalance = balance.balance > 0;
  const hasCredit = balance.isCredit;
  const creditBlocked = balance.creditBlocked;
  const outstandingInvoices = balance.outstandingInvoices || 0;

  return (
    <Card className={`bg-card border-border ${hasBalance ? 'border-amber-500/30' : hasCredit ? 'border-emerald-500/30' : ''}`}>
      {showTitle && (
        <CardHeader className={compact ? "py-3" : ""}>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className={`w-5 h-5 ${hasBalance ? 'text-amber-500' : 'text-emerald-500'}`} />
            Solde du compte
          </CardTitle>
        </CardHeader>
      )}
      <CardContent className={compact ? "pt-0" : ""}>
        {/* Main Balance */}
        <div className={`p-4 rounded-lg ${
          hasBalance 
            ? 'bg-amber-500/10 border border-amber-500/30' 
            : hasCredit
            ? 'bg-emerald-500/10 border border-emerald-500/30'
            : 'bg-muted/50 border border-border'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {hasCredit ? 'Crédit disponible' : 'Solde à payer'}
              </p>
              <p className={`text-3xl font-bold ${
                hasBalance ? 'text-amber-500' : hasCredit ? 'text-emerald-500' : 'text-foreground'
              }`}>
                {hasCredit 
                  ? balance.availableCredit.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })
                  : balance.balance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })
                }
              </p>
            </div>
            {hasBalance ? (
              <TrendingUp className="w-8 h-8 text-amber-500" />
            ) : hasCredit ? (
              <TrendingDown className="w-8 h-8 text-emerald-500" />
            ) : (
              <CheckCircle className="w-8 h-8 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Breakdown */}
        {!compact && (
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 bg-muted/30 rounded-lg">
              <p className="text-muted-foreground">Total facturé</p>
              <p className="text-lg font-semibold">
                {balance.totalDebits.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
              </p>
            </div>
            <div className="p-3 bg-muted/30 rounded-lg">
              <p className="text-muted-foreground">Total payé</p>
              <p className="text-lg font-semibold text-emerald-600">
                {balance.totalCredits.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
              </p>
            </div>
          </div>
        )}

        {/* Credit Blocked Warning */}
        {creditBlocked && (
          <div className="mt-3 flex items-center gap-2 p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <div className="flex-1">
              <p className="text-sm text-amber-600 font-medium">
                Crédit bloqué: {outstandingInvoices} facture{outstandingInvoices > 1 ? 's' : ''} impayée{outstandingInvoices > 1 ? 's' : ''}
              </p>
              <p className="text-xs text-muted-foreground">
                Le crédit sera disponible après paiement de toutes les factures
              </p>
            </div>
          </div>
        )}

        {/* Preauthorized Warning */}
        {balance.preauthorized > 0 && (
          <div className="mt-3 flex items-center gap-2 p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <Clock className="w-4 h-4 text-blue-500" />
            <div className="flex-1">
              <p className="text-sm text-blue-600">
                Préautorisé en attente: {balance.preauthorized.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
              </p>
              <p className="text-xs text-muted-foreground">
                Ce montant n'affecte pas encore le solde
              </p>
            </div>
            <Badge className="bg-blue-500/20 text-blue-600">En cours</Badge>
          </div>
        )}

        {/* Zero Balance State */}
        {!hasBalance && !hasCredit && balance.totalDebits === 0 && (
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
