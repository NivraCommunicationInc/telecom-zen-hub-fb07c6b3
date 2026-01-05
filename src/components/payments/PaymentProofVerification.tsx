/**
 * Payment Proof Verification Panel (Admin/Employee)
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePaymentProofs, useVerifyProof, type PaymentProof } from "@/hooks/usePaymentProofs";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  ExternalLink,
  Loader2,
  Clock,
  User,
  Building,
  Calendar,
  DollarSign,
  Hash,
} from "lucide-react";

interface PaymentProofVerificationProps {
  paymentId: string;
  expectedAmount: number;
  etransferReference?: string;
  verifierName?: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "En attente", color: "bg-amber-500/20 text-amber-600", icon: Clock },
  verified: { label: "Vérifié", color: "bg-emerald-500/20 text-emerald-600", icon: CheckCircle },
  rejected: { label: "Rejeté", color: "bg-red-500/20 text-red-600", icon: XCircle },
  fraud: { label: "Fraude", color: "bg-red-600/20 text-red-700", icon: AlertTriangle },
};

export function PaymentProofVerification({
  paymentId,
  expectedAmount,
  etransferReference,
  verifierName,
}: PaymentProofVerificationProps) {
  const { data: proofs, isLoading } = usePaymentProofs(paymentId);
  const { mutate: verifyProof, isPending: isVerifying } = useVerifyProof();
  
  const [selectedProof, setSelectedProof] = useState<PaymentProof | null>(null);
  const [action, setAction] = useState<'verified' | 'rejected' | 'fraud' | null>(null);
  const [notes, setNotes] = useState("");

  const handleVerify = (proofId: string, status: 'verified' | 'rejected' | 'fraud') => {
    verifyProof({
      proofId,
      paymentId,
      status,
      notes,
      verifierName,
    }, {
      onSuccess: () => {
        setSelectedProof(null);
        setAction(null);
        setNotes("");
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!proofs || proofs.length === 0) {
    return (
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center">
            Aucune preuve de paiement soumise
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {proofs.map((proof) => {
          const status = statusConfig[proof.verification_status] || statusConfig.pending;
          const StatusIcon = status.icon;
          const amountMatch = proof.transfer_amount && 
            Math.abs(proof.transfer_amount - expectedAmount) < 0.01;
          const refMatch = proof.transfer_reference && etransferReference &&
            proof.transfer_reference.toLowerCase().includes(etransferReference.toLowerCase());

          return (
            <Card key={proof.id} className="bg-card">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Preuve #{proof.id.slice(0, 8)}
                  </CardTitle>
                  <Badge className={status.color}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {status.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Proof Details */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {proof.sender_name && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span>{proof.sender_name}</span>
                    </div>
                  )}
                  {proof.sender_bank && (
                    <div className="flex items-center gap-2">
                      <Building className="w-4 h-4 text-muted-foreground" />
                      <span>{proof.sender_bank}</span>
                    </div>
                  )}
                  {proof.transfer_date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>{format(new Date(proof.transfer_date), "d MMM yyyy", { locale: fr })}</span>
                    </div>
                  )}
                  {proof.transfer_amount && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                      <span className={amountMatch ? "text-emerald-600" : "text-amber-600"}>
                        {proof.transfer_amount.toFixed(2)} $
                        {!amountMatch && ` (attendu: ${expectedAmount.toFixed(2)} $)`}
                      </span>
                    </div>
                  )}
                  {proof.transfer_reference && (
                    <div className="flex items-center gap-2 col-span-2">
                      <Hash className="w-4 h-4 text-muted-foreground" />
                      <span className={`font-mono ${refMatch ? "text-emerald-600" : ""}`}>
                        {proof.transfer_reference}
                      </span>
                    </div>
                  )}
                </div>

                {/* Match Confidence */}
                {proof.match_confidence !== null && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Confiance auto:</span>
                    <Badge variant={proof.match_confidence >= 0.7 ? "default" : "secondary"}>
                      {Math.round(proof.match_confidence * 100)}%
                    </Badge>
                    {proof.auto_matched && (
                      <Badge className="bg-emerald-500/20 text-emerald-600">Auto-vérifié</Badge>
                    )}
                  </div>
                )}

                {/* File Link */}
                {proof.file_url && (
                  <a 
                    href={proof.file_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Voir le fichier ({proof.file_name})
                  </a>
                )}

                {/* Notes */}
                {proof.notes && (
                  <p className="text-sm text-muted-foreground italic">"{proof.notes}"</p>
                )}

                {/* Verification Notes */}
                {proof.verification_notes && (
                  <div className="p-2 bg-muted/50 rounded text-sm">
                    <span className="font-medium">Notes de vérification:</span> {proof.verification_notes}
                  </div>
                )}

                {/* Action Buttons (only for pending) */}
                {proof.verification_status === 'pending' && (
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      size="sm"
                      onClick={() => { setSelectedProof(proof); setAction('verified'); }}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Valider
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setSelectedProof(proof); setAction('rejected'); }}
                      className="flex-1"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Rejeter
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => { setSelectedProof(proof); setAction('fraud'); }}
                    >
                      <AlertTriangle className="w-4 h-4" />
                    </Button>
                  </div>
                )}

                {/* Verified By */}
                {proof.verified_at && proof.verified_by_name && (
                  <p className="text-xs text-muted-foreground">
                    Vérifié par {proof.verified_by_name} le{" "}
                    {format(new Date(proof.verified_at), "d MMM yyyy à HH:mm", { locale: fr })}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={!!selectedProof && !!action} onOpenChange={() => { setSelectedProof(null); setAction(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'verified' && "Confirmer le paiement"}
              {action === 'rejected' && "Rejeter la preuve"}
              {action === 'fraud' && "Signaler comme fraude"}
            </DialogTitle>
            <DialogDescription>
              {action === 'verified' && "Cette action marquera le paiement comme complété et créditera le compte du client."}
              {action === 'rejected' && "La preuve sera rejetée et le client devra soumettre une nouvelle preuve."}
              {action === 'fraud' && "Le compte sera signalé pour investigation. Cette action est sérieuse."}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Textarea
              placeholder="Notes de vérification (optionnel)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedProof(null); setAction(null); }}>
              Annuler
            </Button>
            <Button
              onClick={() => selectedProof && action && handleVerify(selectedProof.id, action)}
              disabled={isVerifying}
              variant={action === 'fraud' ? 'destructive' : action === 'verified' ? 'default' : 'secondary'}
            >
              {isVerifying ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : action === 'verified' ? (
                <CheckCircle className="w-4 h-4 mr-2" />
              ) : action === 'rejected' ? (
                <XCircle className="w-4 h-4 mr-2" />
              ) : (
                <AlertTriangle className="w-4 h-4 mr-2" />
              )}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default PaymentProofVerification;
