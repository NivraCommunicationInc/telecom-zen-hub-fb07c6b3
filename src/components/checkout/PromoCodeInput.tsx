import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Ticket, X, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { backendClient } from "@/integrations/backend/client";
import { useToast } from "@/hooks/use-toast";

interface CartItem {
  type: 'service' | 'one_time_fee' | 'equipment' | 'delivery' | 'installation';
  amount: number;
  name: string;
}

interface AppliedPromo {
  id: string;
  code: string;
  name: string;
  discount_type: string;
  discount_value: number;
  discount_amount: number;
  applies_to: Record<string, boolean>;
  stackable: boolean;
  new_customers_only?: boolean;
  duration?: string;
}

interface PromoCodeInputProps {
  clientEmail: string;
  clientId?: string;
  cartItems: CartItem[];
  subtotalBeforeDiscount: number;
  appliedPromo: AppliedPromo | null;
  onPromoApplied: (promo: AppliedPromo | null) => void;
  disabled?: boolean;
}

export const PromoCodeInput = ({
  clientEmail,
  clientId,
  cartItems,
  subtotalBeforeDiscount,
  appliedPromo,
  onPromoApplied,
  disabled = false,
}: PromoCodeInputProps) => {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApplyPromo = async () => {
    if (!code.trim()) {
      setError("Veuillez entrer un code promo");
      return;
    }

    if (appliedPromo && !appliedPromo.stackable) {
      setError("Un code promo est déjà appliqué et n'est pas cumulable");
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const { data, error: invokeError } = await backendClient.functions.invoke("validate-promo", {
        body: {
          code: code.trim(),
          client_email: clientEmail,
          client_id: clientId,
          cart_items: cartItems,
          subtotal_before_discount: subtotalBeforeDiscount,
        },
      });

      if (invokeError) throw invokeError;

      if (!data.valid) {
        setError(data.error || "Code promo invalide");
        return;
      }

      const newPromo: AppliedPromo = {
        id: data.promo.id,
        code: data.promo.code,
        name: data.promo.name,
        discount_type: data.promo.discount_type,
        discount_value: data.promo.discount_value,
        discount_amount: data.discount_amount,
        applies_to: data.promo.applies_to,
        stackable: data.promo.stackable,
        new_customers_only: data.promo.new_customers_only,
        duration: data.promo.duration,
      };

      onPromoApplied(newPromo);
      setCode("");
      toast({
        title: "Code promo appliqué",
        description: `${newPromo.name} - Réduction de ${newPromo.discount_amount.toFixed(2)} $`,
      });
    } catch (err: any) {
      console.error("Error validating promo:", err);
      setError("Erreur lors de la validation du code promo");
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemovePromo = () => {
    onPromoApplied(null);
    toast({ title: "Code promo retiré" });
  };

  return (
    <div className="space-y-3">
      {appliedPromo ? (
        <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  {appliedPromo.code}
                </p>
                {appliedPromo.duration === "first_cycle_only" && (
                  <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    1er mois seulement
                  </Badge>
                )}
              </div>
              <p className="text-xs text-emerald-600 dark:text-emerald-500">
                {appliedPromo.discount_type === "percent" 
                  ? `${appliedPromo.discount_value}% de rabais`
                  : `-${appliedPromo.discount_amount.toFixed(2)} $`}
                {appliedPromo.applies_to?.services && !appliedPromo.applies_to?.one_time_fees && " (forfaits)"}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemovePromo}
            disabled={disabled}
            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Code promo"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleApplyPromo();
                  }
                }}
                className="pl-10 uppercase font-mono"
                disabled={disabled || isValidating}
              />
            </div>
            <Button
              variant="outline"
              onClick={handleApplyPromo}
              disabled={disabled || isValidating || !code.trim()}
            >
              {isValidating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Appliquer"
              )}
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PromoCodeInput;
