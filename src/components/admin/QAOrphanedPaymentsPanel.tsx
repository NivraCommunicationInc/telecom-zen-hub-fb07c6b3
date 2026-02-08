/**
 * QAOrphanedPaymentsPanel
 * Shows payments/invoices without linked client profiles
 * This list should always be empty in a healthy system
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, RefreshCw, Mail, DollarSign, FileText } from "lucide-react";
import { usePaymentsWithoutClient } from "@/hooks/useUnifiedClientSearch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQueryClient } from "@tanstack/react-query";

interface QAOrphanedPaymentsPanelProps {
  onCreateProfile?: (email: string, fullName: string) => void;
}

export function QAOrphanedPaymentsPanel({ onCreateProfile }: QAOrphanedPaymentsPanelProps) {
  const queryClient = useQueryClient();
  const { data: orphanedPayments, isLoading, refetch } = usePaymentsWithoutClient();

  const handleRefresh = async () => {
    await refetch();
    queryClient.invalidateQueries({ queryKey: ["qa-payments-without-client"] });
  };

  const totalOrphaned = orphanedPayments?.length || 0;
  const totalAmount = orphanedPayments?.reduce((sum, p) => sum + Number(p.total_paid || 0), 0) || 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            {totalOrphaned === 0 ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            )}
            Paiements sans profil client
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Actualiser
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <div className="flex gap-4 mb-4">
          <Badge className={totalOrphaned === 0 ? "bg-green-500/20 text-green-400" : "bg-amber-500/20 text-amber-400"}>
            {totalOrphaned} email(s) orphelin(s)
          </Badge>
          {totalAmount > 0 && (
            <Badge className="bg-red-500/20 text-red-400">
              <DollarSign className="w-3 h-3 mr-1" />
              {totalAmount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} non liés
            </Badge>
          )}
        </div>

        {/* Healthy state */}
        {totalOrphaned === 0 && !isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
            <p className="font-medium text-green-400">Système sain</p>
            <p className="text-sm">Tous les paiements sont liés à un profil client.</p>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-8 text-muted-foreground">
            <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
            <p>Analyse en cours...</p>
          </div>
        )}

        {/* Orphaned list */}
        {totalOrphaned > 0 && !isLoading && (
          <ScrollArea className="max-h-96">
            <div className="space-y-2">
              {orphanedPayments?.map((item, index) => (
                <div
                  key={`${item.email}-${index}`}
                  className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="font-mono text-sm">{item.email}</span>
                      </div>
                      {item.full_name && (
                        <p className="text-sm text-muted-foreground ml-6">
                          {item.full_name}
                        </p>
                      )}
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground ml-6">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {item.invoice_count} facture(s)
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" />
                          {Number(item.total_paid || 0).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} payé
                        </span>
                      </div>
                    </div>
                    
                    {onCreateProfile && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onCreateProfile(item.email, item.full_name || "")}
                      >
                        Créer profil
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* SQL Reference */}
        <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs font-mono text-muted-foreground">
          <p className="mb-1">-- Vue: qa_payments_without_client</p>
          <p>SELECT email, full_name, invoice_count, total_paid FROM qa_payments_without_client;</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default QAOrphanedPaymentsPanel;
