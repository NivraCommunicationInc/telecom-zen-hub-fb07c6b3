import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CreditCard, Banknote, Clock, Loader2 } from "lucide-react";

export interface PaymentData {
  payment_method: "card" | "interac" | "deferred";
  payment_reference?: string;
  notes?: string;
  stripe_payment_intent_id?: string;
}

interface POSPaymentFormProps {
  onSubmit: (data: PaymentData) => void;
  isSubmitting?: boolean;
  totalAmount?: number;
  invoiceId?: string;
  renderStripePayment?: () => React.ReactNode;
}

export function POSPaymentForm({ onSubmit, isSubmitting, totalAmount, renderStripePayment }: POSPaymentFormProps) {
  const [method, setMethod] = useState<PaymentData["payment_method"]>("card");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (method === "card" && renderStripePayment) return;
    onSubmit({ payment_method: method, payment_reference: reference || undefined, notes: notes || undefined });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center justify-between">
          <span className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Mode de paiement</span>
          {totalAmount !== undefined && <span className="text-primary font-bold">{totalAmount.toFixed(2)} $</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <RadioGroup value={method} onValueChange={(v) => setMethod(v as any)} className="space-y-3">
            {/* 1. Card — PRIMARY */}
            <div className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
              method === "card" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
            }`}>
              <RadioGroupItem value="card" id="card" />
              <Label htmlFor="card" className="flex items-center gap-2 text-foreground cursor-pointer">
                <CreditCard className="h-5 w-5 text-primary" />
                Carte de crédit (Stripe)
              </Label>
            </div>
            {/* 2. Interac */}
            <div className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
              method === "interac" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
            }`}>
              <RadioGroupItem value="interac" id="interac" />
              <Label htmlFor="interac" className="flex items-center gap-2 text-foreground cursor-pointer">
                <Banknote className="h-5 w-5 text-primary" />
                Interac e-Transfer
              </Label>
            </div>
            {/* 3. Deferred */}
            <div className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
              method === "deferred" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
            }`}>
              <RadioGroupItem value="deferred" id="deferred" />
              <Label htmlFor="deferred" className="flex items-center gap-2 text-foreground cursor-pointer">
                <Clock className="h-5 w-5 text-primary" />
                Paiement différé
              </Label>
            </div>
          </RadioGroup>

          {/* Stripe Elements inline form for card */}
          {method === "card" && renderStripePayment && (
            <div className="rounded-xl border border-primary/30 bg-muted/30 p-4">
              {renderStripePayment()}
            </div>
          )}

          {method !== "deferred" && method !== "card" && (
            <div>
              <Label className="text-foreground">Référence de paiement</Label>
              <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Numéro de confirmation..." />
            </div>
          )}
          <div>
            <Label className="text-foreground">Notes internes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes optionnelles..." />
          </div>

          {method !== "card" && (
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmer la commande
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
