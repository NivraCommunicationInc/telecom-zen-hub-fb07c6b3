import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Gift, X, CheckCircle, Loader2, AlertCircle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { normalizePromoCode } from "@/lib/validation/normalize";

export interface AppliedReferral {
  code: string;
  type: "client" | "influencer";
  // Client referral fields
  referrer_user_id?: string;
  referrer_name?: string;
  // Influencer referral fields
  referral_code_id?: string;
  influencer_id?: string;
  // Discount info (may be 0 for tracking-only referrals)
  discount_type: string;
  discount_value: number;
  discount_amount: number;
  applies_to: Record<string, boolean>;
  duration?: string;
  name: string;
}

interface ReferralCodeInputProps {
  clientEmail: string;
  clientId?: string;
  cartItems: { type: string; amount: number; name: string }[];
  subtotalBeforeDiscount: number;
  appliedReferral: AppliedReferral | null;
  onReferralApplied: (referral: AppliedReferral | null) => void;
  /** Whether a promo discount is already active (for overlap messaging) */
  hasActivePromoDiscount: boolean;
  disabled?: boolean;
}

export const ReferralCodeInput = ({
  clientEmail,
  clientId,
  cartItems,
  subtotalBeforeDiscount,
  appliedReferral,
  onReferralApplied,
  hasActivePromoDiscount,
  disabled = false,
}: ReferralCodeInputProps) => {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApply = async () => {
    if (!code.trim()) {
      setError("Veuillez entrer un code de parrainage");
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const normalizedCode = normalizePromoCode(code);

      const { data, error: invokeError } = await supabase.functions.invoke("validate-promo", {
        body: {
          code: normalizedCode,
          client_email: clientEmail,
          client_id: clientId,
          cart_items: cartItems,
          subtotal_before_discount: subtotalBeforeDiscount,
        },
      });

      if (invokeError) throw invokeError;

      if (!data.valid) {
        setError(data.error || "Code de parrainage invalide");
        return;
      }

      // Check if this is actually a referral code (client or influencer)
      const isClientReferral = data.is_client_referral === true;
      const isInfluencerReferral = data.is_referral_code === true;

      if (!isClientReferral && !isInfluencerReferral) {
        // It's a promo code, not a referral
        setError("Ce code est un code promotionnel. Veuillez l'entrer dans le champ « Code promotionnel » ci-dessous.");
        return;
      }

      const referral: AppliedReferral = {
        code: data.promo?.code || normalizedCode,
        type: isClientReferral ? "client" : "influencer",
        referrer_user_id: data.referrer_user_id,
        referrer_name: data.referrer_name,
        referral_code_id: data.referral_code_id,
        influencer_id: data.influencer_id,
        discount_type: data.promo?.discount_type || "fixed_amount",
        discount_value: data.promo?.discount_value || 0,
        discount_amount: data.discount_amount || 0,
        applies_to: data.promo?.applies_to || {},
        duration: data.promo?.duration,
        name: data.promo?.name || "Code de parrainage",
      };

      onReferralApplied(referral);
      setCode("");
      toast({
        title: "Code de parrainage accepté",
        description: isClientReferral
          ? "Votre parrain recevra une carte-cadeau de 25$ après 3 mois de service payé."
          : `Rabais de ${referral.discount_amount.toFixed(2)} $ appliqué.`,
      });
    } catch (err: any) {
      console.error("Error validating referral:", err);
      setError("Erreur lors de la validation du code de parrainage");
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemove = () => {
    onReferralApplied(null);
    toast({ title: "Code de parrainage retiré" });
  };

  // Determine overlap message
  const hasReferralDiscount = (appliedReferral?.discount_amount ?? 0) > 0;
  const showOverlapMessage = hasReferralDiscount && hasActivePromoDiscount;

  return (
    <div className="space-y-3">
      {appliedReferral ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg border bg-[#003366]/5 border-[#003366]/20">
            <div className="flex items-center gap-2">
              <Gift className="w-4 h-4 text-[#003366]" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[#003366]">
                    {appliedReferral.code}
                  </p>
                  <Badge variant="secondary" className="text-xs bg-[#003366]/10 text-[#003366]">
                    Parrainage
                  </Badge>
                  {appliedReferral.type === "influencer" && appliedReferral.duration === "first_cycle_only" && (
                    <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                      1er mois seulement
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-[#003366]/70">
                  {appliedReferral.type === "client"
                    ? "✅ Code de parrainage validé — votre parrain recevra une carte-cadeau de 25$ après 3 mois de service payé"
                    : hasReferralDiscount
                      ? `-${appliedReferral.discount_amount.toFixed(2)} $ de rabais`
                      : "Code de parrainage enregistré"}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={disabled}
              className="text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Overlap message */}
          {showOverlapMessage && (
            <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 border border-amber-200">
              <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                Votre code de parrainage est bien enregistré. Une promotion équivalente est déjà appliquée à votre commande — un seul rabais par commande.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Gift className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Code de parrainage"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase().replace(/[.,;:!?]+$/, ""));
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleApply();
                  }
                }}
                className="pl-10 uppercase font-mono"
                disabled={disabled || isValidating}
              />
            </div>
            <Button
              variant="outline"
              onClick={handleApply}
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

export default ReferralCodeInput;
