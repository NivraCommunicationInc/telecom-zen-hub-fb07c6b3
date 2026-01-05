/**
 * e-Transfer Proof Submission Form (Client Portal)
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSubmitProof } from "@/hooks/usePaymentProofs";
import { Upload, FileText, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface ETransferProofSubmitProps {
  paymentId: string;
  expectedAmount: number;
  etransferReference?: string;
  onSuccess?: () => void;
}

export function ETransferProofSubmit({
  paymentId,
  expectedAmount,
  etransferReference,
  onSuccess,
}: ETransferProofSubmitProps) {
  const [file, setFile] = useState<File | null>(null);
  const [senderName, setSenderName] = useState("");
  const [senderBank, setSenderBank] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [transferAmount, setTransferAmount] = useState(expectedAmount.toString());
  const [transferReference, setTransferReference] = useState(etransferReference || "");
  const [notes, setNotes] = useState("");

  const { mutate: submitProof, isPending, isSuccess } = useSubmitProof();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    submitProof({
      paymentId,
      senderName: senderName || undefined,
      senderBank: senderBank || undefined,
      transferDate: transferDate || undefined,
      transferAmount: parseFloat(transferAmount) || undefined,
      transferReference: transferReference || undefined,
      notes: notes || undefined,
      file: file || undefined,
    }, {
      onSuccess: () => {
        onSuccess?.();
      },
    });
  };

  if (isSuccess) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-emerald-600">
            <CheckCircle className="w-6 h-6" />
            <div>
              <p className="font-medium">Preuve soumise avec succès</p>
              <p className="text-sm text-muted-foreground">
                Votre preuve de paiement est en cours de vérification.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Soumettre une preuve de paiement
        </CardTitle>
        <CardDescription>
          Envoyez une capture d'écran ou confirmation de votre virement Interac.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {etransferReference && (
          <div className="mb-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
            <p className="text-sm font-medium">Référence e-Transfer à utiliser:</p>
            <p className="text-lg font-mono font-bold text-primary">{etransferReference}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File Upload */}
          <div>
            <Label htmlFor="proof-file">Capture d'écran / Confirmation (optionnel)</Label>
            <div className="mt-1">
              <label 
                htmlFor="proof-file" 
                className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
              >
                {file ? (
                  <>
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="text-sm">{file.name}</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Cliquez pour téléverser (PNG, JPG, PDF)
                    </span>
                  </>
                )}
              </label>
              <input
                id="proof-file"
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Sender Name */}
            <div>
              <Label htmlFor="sender-name">Nom du titulaire</Label>
              <Input
                id="sender-name"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Jean Dupont"
              />
            </div>

            {/* Bank */}
            <div>
              <Label htmlFor="sender-bank">Institution bancaire</Label>
              <Input
                id="sender-bank"
                value={senderBank}
                onChange={(e) => setSenderBank(e.target.value)}
                placeholder="Desjardins, RBC, etc."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Transfer Date */}
            <div>
              <Label htmlFor="transfer-date">Date du virement</Label>
              <Input
                id="transfer-date"
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
              />
            </div>

            {/* Amount */}
            <div>
              <Label htmlFor="transfer-amount">Montant envoyé</Label>
              <Input
                id="transfer-amount"
                type="number"
                step="0.01"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
              />
              {parseFloat(transferAmount) !== expectedAmount && (
                <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Montant attendu: {expectedAmount.toFixed(2)} $
                </p>
              )}
            </div>
          </div>

          {/* Reference */}
          <div>
            <Label htmlFor="transfer-ref">Numéro de confirmation Interac</Label>
            <Input
              id="transfer-ref"
              value={transferReference}
              onChange={(e) => setTransferReference(e.target.value)}
              placeholder="Ex: CA1234567890"
            />
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes additionnelles (optionnel)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Informations supplémentaires..."
              rows={2}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Soumettre la preuve
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default ETransferProofSubmit;
