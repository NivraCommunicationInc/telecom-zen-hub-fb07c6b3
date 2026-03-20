/**
 * Step 6 — Payment Options
 * Option A: Send payment link
 * Option B: Take card payment directly
 */
import { useState } from "react";
import { Link2, CreditCard, Send, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldSalePayment, FieldSaleCustomer } from "@/field-app/lib/fieldSaleTypes";
import { toast } from "sonner";

interface Props {
  payment: FieldSalePayment;
  customer: FieldSaleCustomer;
  totalAmount: number;
  onChange: (p: FieldSalePayment) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function StepPayment({ payment, customer, totalAmount, onChange, onNext, onBack }: Props) {
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(payment.status === "sent");

  const handleSendLink = async () => {
    if (!customer.email.trim()) {
      toast.error("Le client doit avoir un courriel pour recevoir le lien de paiement.");
      return;
    }
    setSendingLink(true);
    // In production: generate Stripe payment link and send via email
    await new Promise((r) => setTimeout(r, 1500));
    onChange({ ...payment, method: "send_link", status: "sent", linkSentTo: customer.email });
    setLinkSent(true);
    setSendingLink(false);
    toast.success(`Lien de paiement envoyé à ${customer.email}`);
  };

  const handleCardPayment = () => {
    // In production: open Stripe terminal or inline card form
    onChange({ ...payment, method: "card_present", status: "completed" });
    toast.success("Paiement traité avec succès");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-[#000000]">Paiement</h2>
        <p className="text-sm text-[#6B7280] mt-0.5">
          Montant total : <span className="font-bold text-[#000000]">{totalAmount.toFixed(2)} $</span>
        </p>
      </div>

      {/* Option A: Send link */}
      <div className={cn(
        "rounded-xl border-2 p-5 transition-all",
        payment.method === "send_link" ? "border-[#22C55E] bg-[#F0FDF4]" : "border-[#E5E7EB] bg-white"
      )}>
        <button
          type="button"
          onClick={() => onChange({ ...payment, method: "send_link", status: "pending" })}
          className="w-full text-left"
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center",
              payment.method === "send_link" ? "bg-[#DCFCE7]" : "bg-[#F3F4F6]"
            )}>
              <Link2 className={cn("h-5 w-5", payment.method === "send_link" ? "text-[#16A34A]" : "text-[#6B7280]")} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#000000]">Envoyer un lien de paiement</p>
              <p className="text-xs text-[#6B7280] mt-0.5">Le client paiera en ligne via un lien sécurisé</p>
            </div>
          </div>
        </button>

        {payment.method === "send_link" && (
          <div className="mt-4 pt-4 border-t border-[#BBF7D0] space-y-3">
            <div>
              <label className="text-xs font-medium text-[#374151] mb-1 block">Envoyer le lien à</label>
              <div className="flex items-center gap-2 text-sm text-[#000000] bg-white border border-[#E5E7EB] rounded-lg px-3 py-2.5">
                <Mail className="h-4 w-4 text-[#6B7280]" />
                <span>{customer.email || "Aucun courriel — requis"}</span>
              </div>
            </div>

            {linkSent ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-[#DCFCE7] text-sm text-[#16A34A] font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Lien envoyé à {payment.linkSentTo}
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSendLink}
                disabled={sendingLink || !customer.email.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#3B82F6] text-white text-sm font-medium hover:bg-[#2563EB] disabled:opacity-40 transition-colors"
              >
                {sendingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Envoyer le lien de paiement
              </button>
            )}
          </div>
        )}
      </div>

      {/* Option B: Card present */}
      <div className={cn(
        "rounded-xl border-2 p-5 transition-all",
        payment.method === "card_present" ? "border-[#22C55E] bg-[#F0FDF4]" : "border-[#E5E7EB] bg-white"
      )}>
        <button
          type="button"
          onClick={() => onChange({ ...payment, method: "card_present", status: "pending" })}
          className="w-full text-left"
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center",
              payment.method === "card_present" ? "bg-[#DCFCE7]" : "bg-[#F3F4F6]"
            )}>
              <CreditCard className={cn("h-5 w-5", payment.method === "card_present" ? "text-[#16A34A]" : "text-[#6B7280]")} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#000000]">Prendre le paiement maintenant</p>
              <p className="text-xs text-[#6B7280] mt-0.5">Le client paie par carte sur place</p>
            </div>
          </div>
        </button>

        {payment.method === "card_present" && (
          <div className="mt-4 pt-4 border-t border-[#BBF7D0] space-y-3">
            {payment.status === "completed" ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-[#DCFCE7] text-sm text-[#16A34A] font-medium">
                <CheckCircle2 className="h-4 w-4" />
                Paiement complété — {totalAmount.toFixed(2)} $
              </div>
            ) : (
              <>
                <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-lg p-3 text-xs text-[#92400E]">
                  ⚠️ Le paiement sera traité de manière sécurisée via le processeur de paiement.
                </div>
                <button
                  type="button"
                  onClick={handleCardPayment}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#22C55E] text-white text-sm font-semibold hover:bg-[#16A34A] transition-colors"
                >
                  <CreditCard className="h-4 w-4" />
                  Traiter le paiement — {totalAmount.toFixed(2)} $
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="flex-1 py-2.5 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors">
          ← Retour
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={payment.status === "pending"}
          className="flex-1 py-2.5 rounded-lg bg-[#22C55E] text-white text-sm font-semibold hover:bg-[#16A34A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Continuer →
        </button>
      </div>
    </div>
  );
}
