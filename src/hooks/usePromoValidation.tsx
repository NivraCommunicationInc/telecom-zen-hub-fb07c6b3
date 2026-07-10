import { useState, useCallback } from "react";
import { backendClient } from "@/integrations/backend/client";

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
  // Referral code specific fields
  is_referral_code?: boolean;
  referral_code_id?: string;
  influencer_id?: string;
}

interface PromoValidationResult {
  valid: boolean;
  error?: string;
  promo?: AppliedPromo;
  discount_amount?: number;
  eligible_subtotal?: number;
}

export const usePromoValidation = () => {
  const [isValidating, setIsValidating] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);

  const validatePromo = useCallback(async (
    code: string,
    clientEmail: string,
    clientId: string | undefined,
    cartItems: CartItem[],
    subtotalBeforeDiscount: number
  ): Promise<PromoValidationResult> => {
    setIsValidating(true);
    try {
      const { data, error } = await backendClient.functions.invoke("validate-promo", {
        body: {
          code: code.trim(),
          client_email: clientEmail,
          client_id: clientId,
          cart_items: cartItems,
          subtotal_before_discount: subtotalBeforeDiscount,
        },
      });

      if (error) throw error;

      if (data.valid && data.promo) {
        const promo: AppliedPromo = {
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
          // Referral code specific fields
          is_referral_code: data.is_referral_code || false,
          referral_code_id: data.referral_code_id,
          influencer_id: data.influencer_id,
        };
        setAppliedPromo(promo);
        return { valid: true, promo, discount_amount: data.discount_amount, eligible_subtotal: data.eligible_subtotal };
      }

      return { valid: false, error: data.error };
    } catch (err: any) {
      console.error("Error validating promo:", err);
      return { valid: false, error: "Erreur lors de la validation" };
    } finally {
      setIsValidating(false);
    }
  }, []);

  const clearPromo = useCallback(() => {
    setAppliedPromo(null);
  }, []);

  const recordRedemption = useCallback(async (
    orderId: string,
    orderNumber: string,
    clientId: string | undefined,
    clientEmail: string
  ) => {
    if (!appliedPromo) return;

    try {
      // F33-2/F33-3 — referral attributions must go through the server-side
      // Edge Function referrals-attach-on-order. Direct INSERT on
      // referral_attributions is blocked at DB level (Phase A part 1).
      if (appliedPromo.is_referral_code && appliedPromo.referral_code_id && appliedPromo.influencer_id) {
        await backendClient.functions.invoke("referrals-attach-on-order", {
          body: {
            referral_code: appliedPromo.code,
            order_id: orderId,
            referred_user_id: clientId,
            referred_email: clientEmail.toLowerCase(),
            idempotency_key: `promo:${orderId}:${appliedPromo.referral_code_id}`,
          },
        });
      } else {
        // Regular promo code - record in promotion_redemptions
        await backendClient.from("promotion_redemptions").insert({
          promotion_id: appliedPromo.id,
          order_id: orderId,
          order_number: orderNumber,
          client_id: clientId || null,
          client_email: clientEmail.toLowerCase(),
          discount_amount: appliedPromo.discount_amount,
        });
      }
    } catch (err) {
      console.error("Error recording promo/referral redemption:", err);
    }
  }, [appliedPromo]);

  return {
    isValidating,
    appliedPromo,
    setAppliedPromo,
    validatePromo,
    clearPromo,
    recordRedemption,
  };
};

export default usePromoValidation;
