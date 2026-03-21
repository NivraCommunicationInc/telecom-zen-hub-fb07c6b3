/**
 * FieldSaleSuccess — Order submission success page.
 * Updated for PayPal/Interac payment methods only.
 */
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle2, ArrowRight, Wallet, Banknote, Copy, Clock } from "lucide-react";
import { fieldPath } from "@/field-app/lib/fieldPaths";
import { toast } from "sonner";

const METHOD_DISPLAY: Record<string, { label: string; icon: typeof Wallet }> = {
  paypal: { label: "PayPal", icon: Wallet },
  interac: { label: "Virement Interac", icon: Banknote },
  deferred: { label: "Différé", icon: Clock },
};

export default function FieldSaleSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const leadId = params.get("leadId") || "";
  const total = params.get("total") || "0.00";
  const paymentMethod = params.get("payment") || "paypal";
  const paymentStatus = params.get("status") || "pending";

  const method = METHOD_DISPLAY[paymentMethod] || METHOD_DISPLAY.paypal;
  const MethodIcon = method.icon;

  return (
    <div className="max-w-lg mx-auto text-center space-y-6 py-8">
      <div className="flex justify-center">
        <div className="h-20 w-20 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Commande soumise !</h1>
        <p className="text-sm text-muted-foreground mt-1">La commande a été créée et sera synchronisée avec Core.</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 text-left space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Référence</span>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs text-foreground">{leadId.slice(0, 8).toUpperCase()}</span>
            <button type="button" onClick={() => { navigator.clipboard.writeText(leadId); toast.success("Copié"); }} className="text-muted-foreground hover:text-foreground">
              <Copy className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="font-bold text-foreground">{total} $</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Méthode de paiement</span>
          <span className="text-foreground flex items-center gap-1.5">
            <MethodIcon className="h-3.5 w-3.5 text-primary" /> {method.label}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Statut paiement</span>
          <span className={paymentStatus === "completed" ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
            {paymentStatus === "completed" ? "✅ Payé" : "⏳ En attente"}
          </span>
        </div>
      </div>

      {paymentStatus !== "completed" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
          <p className="text-sm font-medium text-amber-800">⏳ En attente du paiement</p>
          <p className="text-xs text-amber-700 mt-1">
            {paymentMethod === "interac"
              ? "Le client doit envoyer le virement Interac. Vous serez notifié dès réception."
              : "Le paiement PayPal sera traité automatiquement."}
          </p>
        </div>
      )}

      <div className="space-y-3">
        <button
          onClick={() => navigate(fieldPath("/submissions"))}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          Voir mes commandes
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => navigate(fieldPath("/sale/new"))}
          className="w-full py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
        >
          Nouvelle vente
        </button>
      </div>
    </div>
  );
}
