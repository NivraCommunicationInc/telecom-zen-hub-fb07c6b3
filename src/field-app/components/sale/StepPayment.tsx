/**
 * Step 6 — Payment Options
 * STRIPE DISABLED — 2026-03-21
 * Card payments via Stripe are no longer available.
 * Only "Send payment link" option remains (will be migrated to PayPal).
 */
import { useState } from "react";
import { Link2, Send, Mail, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { FieldSalePayment, FieldSaleCustomer } from "@/field-app/lib/fieldSaleTypes";
import { toast } from "sonner";

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
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(payment.status === "sent");

  // ── Option A: Send payment link (Stripe disabled — will show error) ──
  const handleSendLink = async () => {
    if (!customer.email.trim()) {
      toast.error("Le client doit avoir un courriel pour recevoir le lien de paiement.");
      return;
    }
    setSendingLink(true);
    try {
      const { data, error } = await supabase.functions.invoke("field-sale-payment", {
        body: {
          action: "create_payment_link",
          amount: totalAmount,
          customer_email: customer.email,
          customer_name: `${customer.first_name} ${customer.last_name}`,
          description: `Nivra — Commande terrain`,
          lead_id: leadId || null,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      onChange({ ...payment, method: "send_link", status: "sent", linkSentTo: customer.email });
      setLinkSent(true);
      toast.success(`Lien de paiement envoyé à ${customer.email}`);
    } catch (err) {
      console.error("[StepPayment] send link error:", err);
      toast.error("Erreur lors de l'envoi du lien de paiement. Veuillez réessayer ou utiliser PayPal / Interac.");
    } finally {
      setSendingLink(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Paiement</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Montant total : <span className="font-bold text-foreground">{totalAmount.toFixed(2)} $</span>
        </p>
      </div>

      {/* Option A: Send link */}
      <div className={cn(
        "rounded-xl border-2 p-5 transition-all",
        payment.method === "send_link" ? "border-primary bg-primary/5" : "border-border bg-card"
      )}>
        <button
          type="button"
          onClick={() => onChange({ ...payment, method: "send_link", status: "pending" })}
          className="w-full text-left"
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center",
              payment.method === "send_link" ? "bg-primary/10" : "bg-muted"
            )}>
              <Link2 className={cn("h-5 w-5", payment.method === "send_link" ? "text-primary" : "text-muted-foreground")} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Envoyer un lien de paiement</p>
              <p className="text-xs text-muted-foreground mt-0.5">Le client paiera en ligne via un lien sécurisé</p>
            </div>
          </div>
        </button>

        {payment.method === "send_link" && (
          <div className="mt-4 pt-4 border-t border-primary/20 space-y-3">
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Envoyer le lien à</label>
              <div className="flex items-center gap-2 text-sm text-foreground bg-card border border-border rounded-lg px-3 py-2.5">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{customer.email || "Aucun courriel — requis"}</span>
              </div>
            </div>

            {linkSent ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 text-sm text-primary font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Lien envoyé à {payment.linkSentTo}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSendLink}
                disabled={sendingLink || !customer.email.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                {sendingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sendingLink ? "Envoi en cours…" : "Envoyer le lien de paiement"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Option B: Card present — DISABLED */}
      <div className="rounded-xl border-2 border-border bg-muted/50 p-5 opacity-60">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-muted">
            <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-muted-foreground">Paiement par carte sur place</p>
            <p className="text-xs text-muted-foreground mt-0.5">Temporairement indisponible — utilisez le lien de paiement</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="flex-1 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">
          ← Retour
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={payment.status === "pending"}
          className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Continuer →
        </button>
      </div>
    </div>
  );
}
