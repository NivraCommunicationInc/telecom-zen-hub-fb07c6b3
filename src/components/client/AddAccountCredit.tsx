import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { portalClient as supabase } from "@/integrations/backend";
import { toast } from "sonner";
import {
  Plus,
  DollarSign,
  Info,
  CheckCircle,
  ArrowRight,
  Wallet,
  Copy,
  Send,
  Lock,
} from "lucide-react";

interface AddAccountCreditProps {
  userId: string;
  userEmail?: string;
  currentBalance: number;
  onPaymentSuccess?: () => void;
}

const PRESET_AMOUNTS = [25, 50, 100, 200];
const MIN_AMOUNT = 5;
const MAX_AMOUNT = 1000;
const INTERAC_EMAIL = "support@nivra-telecom.ca";

export const AddAccountCredit = ({
  userId,
  currentBalance,
}: AddAccountCreditProps) => {
  const [customAmount, setCustomAmount] = useState("");
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [accountNumber, setAccountNumber] = useState<string>("—");

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("account_number")
        .eq("user_id", userId)
        .maybeSingle();
      if (data?.account_number) setAccountNumber(data.account_number);
    })();
  }, [userId]);

  const balanceDue = currentBalance > 0 ? currentBalance : 0;
  const existingCredit = currentBalance < 0 ? Math.abs(currentBalance) : 0;

  const amount = selectedAmount || parseFloat(customAmount) || 0;
  const isValid = amount >= MIN_AMOUNT && amount <= MAX_AMOUNT;

  const appliedToBalance = Math.min(amount, balanceDue);
  const appliedToCredit = Math.max(0, amount - balanceDue);

  const copy = (text: string, label: string) =>
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copié !`));

  const handleSelectPreset = (preset: number) => {
    setSelectedAmount(preset);
    setCustomAmount("");
    setShowPayment(false);
  };

  const handleCustomChange = (value: string) => {
    const sanitized = value.replace(/[^0-9.]/g, "");
    setCustomAmount(sanitized);
    setSelectedAmount(null);
    setShowPayment(false);
  };

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Comment fonctionne le crédit au compte?</p>
            {balanceDue > 0 ? (
              <p>
                Votre solde actuel est de{" "}
                <strong className="text-amber-600">
                  {balanceDue.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </strong>
                . Le montant payé sera d'abord appliqué à votre solde. Tout excédent sera converti en crédit disponible.
              </p>
            ) : existingCredit > 0 ? (
              <p>
                Vous avez déjà un crédit de{" "}
                <strong className="text-primary">
                  {existingCredit.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </strong>
                . Le montant ajouté sera ajouté à votre crédit existant.
              </p>
            ) : (
              <p>
                Votre compte est à jour. Le montant payé sera converti en crédit disponible pour vos prochaines factures.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Amount Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="w-5 h-5 text-primary" />
            Choisir un montant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {PRESET_AMOUNTS.map((preset) => (
              <button
                key={preset}
                onClick={() => handleSelectPreset(preset)}
                className={`py-4 px-3 rounded-xl border-2 transition-all font-semibold text-lg ${
                  selectedAmount === preset
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-foreground hover:border-muted-foreground/30"
                }`}
              >
                {preset.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
              </button>
            ))}
          </div>

          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Montant personnalisé"
              value={customAmount}
              onChange={(e) => handleCustomChange(e.target.value)}
              className={`pl-10 h-12 text-lg ${selectedAmount === null && customAmount ? "border-primary" : ""}`}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Minimum: {MIN_AMOUNT.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })} · Maximum: {MAX_AMOUNT.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
          </p>
        </CardContent>
      </Card>

      {/* Breakdown Preview */}
      {isValid && !showPayment && (
        <Card className="border-primary/20">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-primary" />
              Répartition du paiement
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Montant total</span>
                <span className="font-semibold text-foreground">
                  {amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </span>
              </div>
              {appliedToBalance > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">→ Appliqué au solde dû</span>
                  <span className="text-amber-600 font-medium">
                    {appliedToBalance.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">→ Crédit au compte</span>
                <span className="text-primary font-medium">
                  {appliedToCredit.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                </span>
              </div>
              {existingCredit > 0 && appliedToCredit > 0 && (
                <div className="flex justify-between pt-2 border-t border-border">
                  <span className="text-muted-foreground">Crédit total après paiement</span>
                  <span className="text-primary font-bold">
                    {(existingCredit + appliedToCredit).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                  </span>
                </div>
              )}
            </div>
            <Button onClick={() => setShowPayment(true)} className="w-full mt-2" size="lg">
              <Wallet className="w-5 h-5 mr-2" />
              Voir les instructions de paiement
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Interac Instructions */}
      {showPayment && isValid && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="w-5 h-5 text-primary" />
              Paiement par virement Interac — {amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-primary bg-primary/5">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Send className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm">Virement Interac</p>
                <p className="text-xs text-muted-foreground">Traitement automatique — aucune intervention requise</p>
              </div>
              <Badge className="ml-auto bg-primary/10 text-primary border-0 text-xs">Sécurisé</Badge>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 divide-y divide-border">
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-xs text-muted-foreground">Adresse courriel</p>
                  <p className="text-sm font-semibold text-foreground">{INTERAC_EMAIL}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => copy(INTERAC_EMAIL, "Courriel")}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-xs text-muted-foreground">Montant</p>
                  <p className="text-sm font-semibold text-foreground">
                    {amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => copy(amount.toFixed(2), "Montant")}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-xs text-muted-foreground">Réponse à la question de sécurité</p>
                  <p className="text-sm font-bold text-foreground">{accountNumber}</p>
                  <p className="text-xs text-amber-600 mt-0.5">⚠️ Utilisez exactement ce numéro</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => copy(accountNumber, "Numéro de compte")}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <Lock className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Les virements Interac sont traités automatiquement. Votre paiement sera appliqué à votre compte dès réception.
              </p>
            </div>

            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => setShowPayment(false)}
            >
              ← Modifier le montant
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AddAccountCredit;
