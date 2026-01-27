/**
 * POSPaymentForm - Payment method selection for POS checkout
 */
import { useState } from "react";
import { CreditCard, Banknote, Clock, Check, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type PaymentMethod = "interac" | "paypal" | "deferred";

interface PaymentOption {
  id: PaymentMethod;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    id: "interac",
    label: "Interac",
    description: "Virement électronique instantané",
    icon: CreditCard,
    color: "from-amber-500 to-orange-600",
  },
  {
    id: "paypal",
    label: "PayPal",
    description: "Paiement sécurisé PayPal",
    icon: Banknote,
    color: "from-blue-500 to-indigo-600",
  },
  {
    id: "deferred",
    label: "Différé",
    description: "Paiement à confirmer plus tard",
    icon: Clock,
    color: "from-slate-500 to-slate-600",
  },
];

export interface PaymentData {
  payment_method: PaymentMethod;
  payment_reference?: string;
  notes?: string;
}

interface POSPaymentFormProps {
  onSubmit: (data: PaymentData) => void;
  isSubmitting?: boolean;
  totalAmount: number;
}

export function POSPaymentForm({ onSubmit, isSubmitting, totalAmount }: POSPaymentFormProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("interac");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    onSubmit({
      payment_method: selectedMethod,
      payment_reference: reference || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <Card className="border-slate-700/50 bg-slate-900/80 backdrop-blur-xl">
      <CardHeader className="pb-4">
        <CardTitle className="text-white flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/20">
            <CreditCard className="h-5 w-5 text-emerald-400" />
          </div>
          Mode de Paiement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Amount Display */}
        <div className="text-center py-4 px-6 rounded-xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50">
          <p className="text-sm text-slate-400 mb-1">Montant à payer</p>
          <p className="text-3xl font-bold text-white">{totalAmount.toFixed(2)} $</p>
        </div>

        {/* Payment Methods */}
        <div className="space-y-2">
          {PAYMENT_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedMethod === option.id;

            return (
              <button
                key={option.id}
                onClick={() => setSelectedMethod(option.id)}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
                  isSelected
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600"
                )}
              >
                <div className={cn(
                  "p-3 rounded-xl bg-gradient-to-br text-white",
                  option.color
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-semibold">{option.label}</h4>
                  <p className="text-sm text-slate-400">{option.description}</p>
                </div>
                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Reference field */}
        {selectedMethod !== "deferred" && (
          <div>
            <label className="text-sm text-slate-300 mb-2 block">
              Référence de paiement (optionnel)
            </label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ex: Confirmation #12345"
              className="bg-slate-800/50 border-slate-600 text-white h-11"
            />
          </div>
        )}

        {/* Notes field */}
        <div>
          <label className="text-sm text-slate-300 mb-2 block">
            Notes internes (optionnel)
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes spéciales, demandes particulières..."
            className="bg-slate-800/50 border-slate-600 text-white resize-none"
            rows={2}
          />
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full h-12 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white font-bold text-lg"
        >
          <Receipt className="h-5 w-5 mr-2" />
          Finaliser la vente
        </Button>

        {/* Info */}
        <p className="text-center text-xs text-slate-500">
          {selectedMethod === "deferred" 
            ? "⚠️ Le paiement devra être confirmé ultérieurement"
            : "✓ Le contrat et la facture seront générés automatiquement"
          }
        </p>
      </CardContent>
    </Card>
  );
}
