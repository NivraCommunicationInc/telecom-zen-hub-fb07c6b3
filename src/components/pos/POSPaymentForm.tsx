import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CreditCard, Banknote, Clock } from "lucide-react";

export interface PaymentData {
  payment_method: "card" | "interac" | "deferred";
  payment_reference?: string;
  notes?: string;
}

interface POSPaymentFormProps {
  onSubmit: (data: PaymentData) => void;
}

export function POSPaymentForm({ onSubmit }: POSPaymentFormProps) {
  const [method, setMethod] = useState<PaymentData["payment_method"]>("card");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ payment_method: method, payment_reference: reference || undefined, notes: notes || undefined });
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700/50">
      <CardHeader><CardTitle className="text-white flex items-center gap-2"><CreditCard className="h-5 w-5" />Mode de paiement</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <RadioGroup value={method} onValueChange={(v) => setMethod(v as any)} className="space-y-3">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-700/30 border border-slate-600/50 cursor-pointer">
              <RadioGroupItem value="card" id="card" /><Label htmlFor="card" className="flex items-center gap-2 text-white cursor-pointer"><CreditCard className="h-5 w-5 text-cyan-400" />Carte de crédit</Label>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-700/30 border border-slate-600/50 cursor-pointer">
              <RadioGroupItem value="interac" id="interac" /><Label htmlFor="interac" className="flex items-center gap-2 text-white cursor-pointer"><Banknote className="h-5 w-5 text-emerald-400" />Interac e-Transfer</Label>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-700/30 border border-slate-600/50 cursor-pointer">
              <RadioGroupItem value="deferred" id="deferred" /><Label htmlFor="deferred" className="flex items-center gap-2 text-white cursor-pointer"><Clock className="h-5 w-5 text-amber-400" />Paiement différé</Label>
            </div>
          </RadioGroup>
          {method !== "deferred" && <div><Label className="text-slate-300">Référence de paiement</Label><Input value={reference} onChange={e => setReference(e.target.value)} className="bg-slate-700/50 border-slate-600" placeholder="Numéro de confirmation..." /></div>}
          <div><Label className="text-slate-300">Notes internes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} className="bg-slate-700/50 border-slate-600" placeholder="Notes optionnelles..." /></div>
          <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-400 text-white">Confirmer la commande</Button>
        </form>
      </CardContent>
    </Card>
  );
}
