/**
 * Step 6 — Payment Options
 * PayPal = primary recommended. Interac = secondary.
 * Stripe/card flows permanently removed.
 */
import { useState } from "react";
import { Wallet, Banknote, Mail, Copy, Check, Info, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ETRANSFER_CONFIG } from "@/config/company";
import type { FieldSalePayment, FieldSaleCustomer } from "@/field-app/lib/fieldSaleTypes";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface Props {
  payment: FieldSalePayment;
  customer: FieldSaleCustomer;
  totalAmount: number;
  leadId?: string;
  onChange: (p: FieldSalePayment) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function StepPayment({ payment, customer, totalAmount, leadId, onChange, onNext, onBack }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(ETRANSFER_CONFIG.email);
    setCopied(true);
    toast.success("Courriel copié!");
    setTimeout(() => setCopied(false), 2000);
  };

  const canContinue =
    payment.method === "paypal" ||
    (payment.method === "interac" && (payment.interacReference?.trim() || "").length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Paiement</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Montant total : <span className="font-bold text-foreground">{totalAmount.toFixed(2)} $</span>
        </p>
      </div>

      {/* Option A: PayPal — PRIMARY */}
      <div className={cn(
        "rounded-xl border-2 p-5 transition-all cursor-pointer",
        payment.method === "paypal" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-muted-foreground/30"
      )}>
        <button
          type="button"
          onClick={() => onChange({ ...payment, method: "paypal", status: "pending" })}
          className="w-full text-left"
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center",
              payment.method === "paypal" ? "bg-primary/10" : "bg-muted"
            )}>
              <Wallet className={cn("h-5 w-5", payment.method === "paypal" ? "text-primary" : "text-muted-foreground")} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">PayPal</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Le client paiera en ligne via PayPal (carte ou compte PayPal)
              </p>
            </div>
            <Badge className="bg-primary/10 text-primary border-0 text-xs">Recommandé</Badge>
          </div>
        </button>

        {payment.method === "paypal" && (
          <div className="mt-4 pt-4 border-t border-primary/20">
            <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg">
              <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Le paiement sera effectué par le client via PayPal lors de la confirmation de la commande. Un lien de paiement sécurisé lui sera envoyé automatiquement.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Option B: Interac — SECONDARY */}
      <div className={cn(
        "rounded-xl border-2 p-5 transition-all cursor-pointer",
        payment.method === "interac" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-muted-foreground/30"
      )}>
        <button
          type="button"
          onClick={() => onChange({ ...payment, method: "interac", status: "pending" })}
          className="w-full text-left"
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center",
              payment.method === "interac" ? "bg-primary/10" : "bg-muted"
            )}>
              <Banknote className={cn("h-5 w-5", payment.method === "interac" ? "text-primary" : "text-muted-foreground")} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Virement Interac</p>
              <p className="text-xs text-muted-foreground mt-0.5">Le client paiera par virement bancaire</p>
            </div>
          </div>
        </button>

        {payment.method === "interac" && (
          <div className="mt-4 pt-4 border-t border-primary/20 space-y-3">
            <div className="p-3 bg-muted/50 border border-border rounded-lg">
              <p className="text-xs font-medium text-foreground mb-2">Envoyer le virement Interac à :</p>
              <div className="flex items-center gap-2 p-2 bg-background rounded border border-border">
                <Mail className="w-4 h-4 text-primary" />
                <span className="font-mono text-sm flex-1">{ETRANSFER_CONFIG.emailDisplay}</span>
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="text-xs px-2 py-1 rounded border border-border hover:bg-muted transition-colors flex items-center gap-1"
                >
                  {copied ? <><Check className="w-3 h-3 text-primary" /> Copié</> : <><Copy className="w-3 h-3" /> Copier</>}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 bg-muted/50 rounded-lg border border-border">
                <p className="text-[10px] text-muted-foreground mb-0.5">Question de sécurité</p>
                <p className="text-xs font-medium text-foreground">{ETRANSFER_CONFIG.securityQuestion}</p>
              </div>
              <div className="p-2 bg-muted/50 rounded-lg border border-border">
                <p className="text-[10px] text-muted-foreground mb-0.5">Réponse</p>
                <p className="text-xs font-medium text-foreground">{ETRANSFER_CONFIG.securityAnswer}</p>
              </div>
            </div>

            <div className="p-2 bg-muted/50 rounded-lg border border-border">
              <p className="text-[10px] text-muted-foreground mb-0.5">Montant exact</p>
              <p className="text-base font-bold text-foreground">{totalAmount.toFixed(2)} $</p>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Référence du virement Interac</label>
              <Input
                value={payment.interacReference || ""}
                onChange={(e) => onChange({ ...payment, interacReference: e.target.value })}
                placeholder="Ex: TRF-847291"
                className="text-sm"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">
          ← Retour
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Continuer →
        </button>
      </div>
    </div>
  );
}
