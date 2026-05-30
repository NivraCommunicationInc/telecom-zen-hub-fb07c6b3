/**
 * PaymentMethodPicker — Headless, presentational picker for the 3
 * canonical Nivra payment methods, mirroring Field's Step 5 sale flow
 * (src/field-app/components/sale/StepPaymentPaypal.tsx).
 *
 * Identifiers MUST stay in sync with FieldPaymentMethod
 * (src/field-app/lib/fieldSaleTypes.ts) so the same backend / edge
 * functions handle both Field and any portal that consumes this picker
 * (OneView CS, Core manual order, etc.).
 *
 * This component is intentionally presentation-only:
 *   - No data fetching
 *   - No edge function calls
 *   - No mutation of order / invoice / intent state
 * The parent owns all side effects (link generation, card capture,
 * email send, polling). This keeps Field's existing flow untouched
 * while giving Core / OneView a consistent UI primitive.
 */
import { CreditCard, Mail, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export type SharedPaymentMethod = "paypal_onsite" | "paypal_email" | "card_manual";

export interface PaymentMethodPickerProps {
  /** Currently selected method (controlled). */
  value: SharedPaymentMethod | null;
  /** Called when the user picks a method. */
  onChange: (method: SharedPaymentMethod) => void;
  /** Recipient email shown in the "Envoyer par courriel" description. */
  recipientEmail?: string | null;
  /** Disables every option (e.g. while submitting). */
  disabled?: boolean;
  /** Optional className for the outer grid. */
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
    id: "paypal_onsite",
    icon: CreditCard,
    title: "Payer sur place",
    desc: () => "Génère un lien + QR. Le client paie sur votre appareil.",
  },
  {
    id: "paypal_email",
    icon: Mail,
    title: "Envoyer par courriel",
    desc: (email) => `Envoie un lien PayPal à ${email || "—"}`,
  },
  {
    id: "card_manual",
    icon: Lock,
    title: "Prise en charge manuelle — Carte de crédit",
    desc: () =>
      "Saisie sécurisée. Traitement par un administrateur Nivra Core.",
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
        const emailMissing = opt.id === "paypal_email" && !recipientEmail;
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
