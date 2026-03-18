/**
 * Pending e-Transfer Proofs Notification Card (Admin Dashboard)
 */

import { usePendingProofs } from "@/hooks/usePaymentProofs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  Clock, 
  FileCheck, 
  ExternalLink, 
  DollarSign,
  AlertCircle,
} from "lucide-react";

interface PendingETransferProofsProps {
  limit?: number;
}

export function PendingETransferProofs({ limit = 5 }: PendingETransferProofsProps) {
  const { data: proofs, isLoading, error } = usePendingProofs();

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return null;
  }

  const pendingProofs = proofs?.slice(0, limit) || [];
  const totalPending = proofs?.length || 0;

  if (totalPending === 0) {
    return null;
  }

  return (
    <Card className="bg-card border-border border-amber-500/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileCheck className="w-5 h-5 text-amber-500" />
            Preuves e-Transfer en attente
          </CardTitle>
          <Badge className="bg-amber-500/20 text-amber-600">
            {totalPending} en attente
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {pendingProofs.map((proof: any) => {
            const billing = proof.billing;
            const amount = billing?.amount || proof.transfer_amount || 0;

            return (
              <div 
                key={proof.id}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 rounded-full">
                    <Clock className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {billing?.invoice_number || "Facture"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Soumis {format(new Date(proof.created_at), "d MMM à HH:mm", { locale: fr })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-bold text-amber-600 flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      {Number(amount).toFixed(2)}
                    </p>
                    {proof.match_confidence !== null && (
                      <p className="text-xs text-muted-foreground">
                        Confiance: {Math.round(proof.match_confidence * 100)}%
                      </p>
                    )}
                  </div>
                  <Link to={`/admin/billing?invoice=${proof.payment_id}`}>
                    <Button size="sm" variant="outline">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {totalPending > limit && (
          <div className="mt-3 text-center">
            <Link to="/admin/billing?filter=verification">
              <Button variant="link" className="text-amber-600">
                Voir les {totalPending} preuves en attente
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PendingETransferProofs;
