/**
 * SquarePaymentSuccessCard — persistent success confirmation for Square payments.
 * - Stays visible until the user clicks "Fermer" (no auto-dismiss).
 * - Displays the Square payment reference in a dedicated box with a "Copier" button.
 * - Used by CoreSquarePaymentDialog, EmployeeSquarePaymentDialog, SquarePaymentForm,
 *   and ClientPayBalanceCard.
 */
import { CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  amountLabel?: string;
  /** One or more Square payment references (square_payment_id). */
  squareRefs: string[];
  /** Optional secondary line (e.g. "Reçu envoyé à ..."). */
  extraNote?: string;
  onClose: () => void;
}

export function SquarePaymentSuccessCard({ amountLabel, squareRefs, extraNote, onClose }: Props) {
  const refs = squareRefs.filter(Boolean);

  const copyAll = () => {
    const text = refs.join(", ");
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => toast.success(refs.length > 1 ? "Références copiées" : "Référence copiée"),
      () => toast.error("Impossible de copier"),
    );
  };

  return (
    <div className="py-6 text-center space-y-4">
      <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
      <div>
        <p className="font-semibold text-foreground">Paiement approuvé par Square</p>
        {amountLabel && (
          <p className="text-sm text-muted-foreground mt-1">{amountLabel}</p>
        )}
      </div>

      {refs.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-left space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {refs.length > 1 ? "Références Square" : "Référence Square"}
          </p>
          <div className="flex items-start gap-2">
            <div className="flex-1 font-mono text-sm font-semibold text-foreground break-all">
              {refs.map((r) => (
                <div key={r}>{r}</div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyAll}
              className="shrink-0"
            >
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copier
            </Button>
          </div>
        </div>
      )}

      {extraNote && (
        <p className="text-xs text-muted-foreground">{extraNote}</p>
      )}

      <Button type="button" onClick={onClose} className="mt-2 w-full sm:w-auto">
        Fermer
      </Button>
    </div>
  );
}

export default SquarePaymentSuccessCard;
