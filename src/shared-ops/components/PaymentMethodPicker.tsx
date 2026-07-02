/**
 * PaymentMethodPicker — Presentational picker for the 3 canonical Nivra
 * payment methods (all Square-processed). Mirrors Field's Step 5 sale flow.
 *
 * All three flows are processed by Square:
 *   - square_onsite  → client pays on the agent's device (inline widget)
 *   - square_email   → payment link sent by email (PayerCommande / Square)
 *   - card_manual    → secured intake, processed by a Nivra Core administrator
 *
 * Parent owns all side effects (link generation, card capture, email send,
 * polling). No PayPal.
 */
import { CreditCard, Mail, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export type SharedPaymentMethod = "square_onsite" | "square_email" | "card_manual";

export interface PaymentMethodPickerProps {
  value: SharedPaymentMethod | null;
  onChange: (method: SharedPaymentMethod) => void;
  recipientEmail?: string | null;
  disabled?: boolean;
  className?: string;
}

interface OptionDef {
  id: SharedPaymentMethod;
  icon: typeof CreditCard;
  title: string;
  desc: (email?: string | null) => string;
}

const OPTIONS: OptionDef[] = [
  {
    id: "square_onsite",
    icon: CreditCard,
    title: "Payer sur place",
    desc: () => "Génère un lien + QR. Le client paie sur votre appareil (Square).",
  },
  {
    id: "square_email",
    icon: Mail,
    title: "Envoyer par courriel",
    desc: (email) => `Envoie un lien de paiement Square à ${email || "—"}`,
  },
  {
    id: "card_manual",
    icon: Lock,
    title: "Prise en charge manuelle — Carte de crédit",
    desc: () =>
      "Saisie sécurisée. Traitement par un administrateur Nivra Core (Square).",
  },
];

export function PaymentMethodPicker({
  value,
  onChange,
  recipientEmail,
  disabled = false,
  className,
}: PaymentMethodPickerProps) {
  return (
    <div role="radiogroup" aria-label="Méthode de paiement" className={cn("grid gap-3", className)}>
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const selected = value === opt.id;
        const emailMissing = opt.id === "square_email" && !recipientEmail;
        const itemDisabled = disabled || emailMissing;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={itemDisabled}
            disabled={itemDisabled}
            onClick={() => onChange(opt.id)}
            className={cn(
              "text-left rounded-2xl p-4 border transition-all flex items-center gap-4 min-h-[72px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected
                ? "border-primary bg-primary/10 shadow-md"
                : "border-border bg-card hover:bg-muted",
              itemDisabled && "opacity-60 cursor-not-allowed",
            )}
          >
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground">{opt.title}</h3>
              <p className="text-xs text-muted-foreground truncate">
                {opt.desc(recipientEmail)}
                {emailMissing ? " — adresse courriel requise" : ""}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default PaymentMethodPicker;
