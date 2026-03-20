/**
 * FieldSaleSuccess — Order submission success page.
 */
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle2, ArrowRight, Send, CreditCard, Copy } from "lucide-react";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { toast } from "sonner";

export default function FieldSaleSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const leadId = params.get("leadId") || "";
  const total = params.get("total") || "0.00";
  const paymentMethod = params.get("payment") || "send_link";
  const paymentStatus = params.get("status") || "pending";

  return (
    <div className="max-w-lg mx-auto text-center space-y-6 py-8">
      {/* Success icon */}
      <div className="flex justify-center">
        <div className="h-20 w-20 rounded-full bg-[#DCFCE7] flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-[#16A34A]" />
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-[#000000]">Commande soumise !</h1>
        <p className="text-sm text-[#6B7280] mt-1">La commande a été créée avec succès.</p>
      </div>

      {/* Order details */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 text-left space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-[#6B7280]">Référence</span>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-[#000000]">{leadId.slice(0, 8).toUpperCase()}</span>
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(leadId); toast.success("Copié"); }}
              className="text-[#6B7280] hover:text-[#000000]"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#6B7280]">Total</span>
          <span className="font-bold text-[#000000]">{total} $</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#6B7280]">Méthode de paiement</span>
          <span className="text-[#000000] flex items-center gap-1.5">
            {paymentMethod === "send_link" ? (
              <><Send className="h-3.5 w-3.5 text-[#3B82F6]" /> Lien envoyé</>
            ) : (
              <><CreditCard className="h-3.5 w-3.5 text-[#22C55E]" /> Carte sur place</>
            )}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-[#6B7280]">Statut paiement</span>
          <span className={paymentStatus === "completed" ? "text-[#16A34A] font-medium" : "text-[#F59E0B] font-medium"}>
            {paymentStatus === "completed" ? "✅ Payé" : paymentStatus === "sent" ? "📧 Lien envoyé" : "⏳ En attente"}
          </span>
        </div>
      </div>

      {/* Next steps */}
      {paymentMethod === "send_link" && paymentStatus !== "completed" && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-4 text-left">
          <p className="text-sm font-medium text-[#92400E]">⏳ En attente du paiement client</p>
          <p className="text-xs text-[#92400E]/80 mt-1">
            Le client recevra un lien de paiement sécurisé par courriel. La commande sera traitée dès réception du paiement.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <button
          onClick={() => navigate(fieldPath("/sale/new"))}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#22C55E] text-white text-sm font-semibold hover:bg-[#16A34A] transition-colors"
        >
          Nouvelle vente
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => navigate(fieldPath("/dashboard"))}
          className="w-full py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
        >
          Retour au tableau de bord
        </button>
      </div>
    </div>
  );
}
