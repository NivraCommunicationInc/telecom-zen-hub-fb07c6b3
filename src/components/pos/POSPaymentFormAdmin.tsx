/**
 * POSPaymentFormAdmin — Enhanced payment form for Admin POS
 * Méthodes : Carte de crédit (Square inline), Interac e-Transfer, Comptant, Paiement différé
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard, Banknote, Clock, Loader2, Check, Copy, Mail, DollarSign, Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ETRANSFER_CONFIG } from "@/config/company";
import { SquarePaymentForm } from "@/components/payment/SquarePaymentForm";
import { supabase } from "@/integrations/supabase/client";

export type AdminPaymentMethod = "card" | "interac" | "cash" | "deferred";

export interface AdminPaymentData {
  payment_method: AdminPaymentMethod;
  payment_reference?: string;
  square_payment_id?: string;
  notes?: string;
}

interface POSPaymentFormAdminProps {
  onSubmit: (data: AdminPaymentData) => void;
  isSubmitting?: boolean;
  totalAmount: number;
  customerEmail?: string;
  customerName?: string;
}

export function POSPaymentFormAdmin({
  onSubmit, isSubmitting, totalAmount, customerEmail, customerName,
}: POSPaymentFormAdminProps) {
  const [method, setMethod] = useState<AdminPaymentMethod>("card");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const [squarePaid, setSquarePaid] = useState<string | null>(null);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(ETRANSFER_CONFIG.email);
    setCopied(true);
    toast.success("Courriel copié!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (method === "card" && !squarePaid) {
      toast.error("Complétez le paiement Square avant de continuer");
      return;
    }
    onSubmit({
      payment_method: method,
      payment_reference: reference || undefined,
      square_payment_id: squarePaid || undefined,
      notes: notes || undefined,
    });
  };

  const paymentMethods: { value: AdminPaymentMethod; label: string; icon: React.ReactNode; color: string; badge?: string }[] = [
    { value: "card", label: "Carte de crédit (Square)", icon: <CreditCard className="h-5 w-5" />, color: "text-cyan-400", badge: "Recommandé" },
    { value: "interac", label: "Interac e-Transfer", icon: <Banknote className="h-5 w-5" />, color: "text-emerald-400" },
    { value: "cash", label: "Comptant", icon: <Wallet className="h-5 w-5" />, color: "text-green-400" },
    { value: "deferred", label: "Paiement différé", icon: <Clock className="h-5 w-5" />, color: "text-amber-400" },
  ];

  return (
    <Card className="bg-slate-800/50 border-slate-700/50">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <span className="flex items-center gap-2"><DollarSign className="h-5 w-5" />Mode de paiement</span>
          <Badge className="bg-orange-500/20 text-orange-400 border-0 text-lg px-3">{totalAmount.toFixed(2)} $</Badge>
        </CardTitle>
        <CardDescription className="text-slate-400">
          Sélectionnez le mode de paiement. Les paiements par carte sont traités directement via Square sur cet appareil.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <RadioGroup value={method} onValueChange={(v) => setMethod(v as AdminPaymentMethod)} className="space-y-3">
            {paymentMethods.map((pm) => (
              <div key={pm.value}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                  method === pm.value ? "bg-slate-700/50 border-cyan-500/50" : "bg-slate-700/30 border-slate-600/50 hover:border-slate-500/50",
                )}
                onClick={() => setMethod(pm.value)}
              >
                <RadioGroupItem value={pm.value} id={pm.value} />
                <Label htmlFor={pm.value} className={cn("flex items-center gap-2 cursor-pointer flex-1", pm.color)}>
                  {pm.icon}
                  <span className="text-white">{pm.label}</span>
                  {pm.badge && <Badge className="ml-auto bg-emerald-500/20 text-emerald-400 border-0 text-xs">{pm.badge}</Badge>}
                </Label>
                {method === pm.value && <Check className="w-5 h-5 text-cyan-400" />}
              </div>
            ))}
          </RadioGroup>

          {/* Interac Info */}
          {method === "interac" && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
              <p className="text-sm font-medium text-white">Envoyez le virement Interac à :</p>
              <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <Mail className="w-5 h-5 text-emerald-400" />
                <span className="font-mono text-lg flex-1 text-white">{ETRANSFER_CONFIG.emailDisplay}</span>
                <Button type="button" variant="outline" size="sm" onClick={handleCopyEmail}
                  className="gap-2 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10">
                  {copied ? <><Check className="w-4 h-4" />Copié!</> : <><Copy className="w-4 h-4" />Copier</>}
                </Button>
              </div>
              <p className="text-sm text-slate-400">Montant: <span className="text-white font-semibold">{totalAmount.toFixed(2)} $</span></p>
            </div>
          )}

          {/* Card — inline Square widget */}
          {method === "card" && (
            <div className="space-y-3 p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/30">
              <p className="text-xs text-cyan-300 uppercase tracking-wider font-semibold">Paiement par carte — Square</p>
              {squarePaid ? (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 space-y-1">
                  <p className="text-sm text-emerald-300 font-semibold flex items-center gap-2">
                    <Check className="h-4 w-4" /> Paiement Square approuvé
                  </p>
                  <p className="text-[11px] text-emerald-200 font-mono break-all">Réf : {squarePaid}</p>
                  <p className="text-[11px] text-slate-300">Cliquez « Confirmer le paiement » pour créer la commande.</p>
                </div>
              ) : (
                <SquarePaymentForm
                  amount={totalAmount}
                  customerName={customerName}
                  customerEmail={customerEmail}
                  onBeforeCharge={async () => {
                    const { data, error } = await supabase.functions.invoke("pos-square-intent", {
                      body: { amount: totalAmount, customer_email: customerEmail, customer_name: customerName },
                    });
                    if (error || !(data as any)?.ok) {
                      throw new Error((data as any)?.error || error?.message || "Impossible de créer l'intention Square");
                    }
                    return { intent_id: (data as any).intent_id as string };
                  }}
                  onSuccess={(_receipt, paymentId) => {
                    setSquarePaid(paymentId || null);
                  }}
                />
              )}
            </div>
          )}

          {/* Reference for non-card, non-deferred */}
          {method !== "deferred" && method !== "card" && (
            <div>
              <Label className="text-slate-300">Référence de paiement</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)}
                className="bg-slate-700/50 border-slate-600"
                placeholder={method === "interac" ? "Numéro de confirmation Interac..." : "Numéro de confirmation..."} />
            </div>
          )}

          {method === "deferred" && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <p className="text-sm text-amber-300 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                La commande sera créée avec le statut « En attente de paiement »
              </p>
            </div>
          )}

          <div>
            <Label className="text-slate-300">Notes internes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              className="bg-slate-700/50 border-slate-600"
              placeholder="Notes visibles uniquement par le personnel..." rows={3} />
          </div>

          <Button type="submit" disabled={isSubmitting || (method === "card" && !squarePaid)}
            className={cn("w-full font-bold text-white",
              method === "deferred" ? "bg-amber-500 hover:bg-amber-400" : "bg-orange-500 hover:bg-orange-400")}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {method === "deferred" ? "Créer commande en attente" : "Confirmer le paiement"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default POSPaymentFormAdmin;
