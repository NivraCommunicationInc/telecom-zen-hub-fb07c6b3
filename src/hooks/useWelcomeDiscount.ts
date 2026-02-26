import { useQuery } from "@tanstack/react-query";
import { portalClient as supabase } from "@/integrations/backend";

/**
 * Welcome Discount Hook
 * 
 * Automatically provides a 50% discount on services (monthly recurring)
 * for first-time customers on their first bill only.
 * 
 * Checks if the user already has billing_subscriptions. If none exist,
 * the user qualifies for the welcome discount.
 */

const WELCOME_DISCOUNT_PERCENT = 50;

interface WelcomeDiscountResult {
  isNewCustomer: boolean;
  isLoading: boolean;
  discountPercent: number;
  /** Calculate discount amount for given monthly service total */
  getDiscountAmount: (monthlyServiceTotal: number) => number;
  /** Label for display */
  label: string;
}

export const useWelcomeDiscount = (userId: string | undefined): WelcomeDiscountResult => {
  const { data: existingSubscriptions, isLoading } = useQuery({
    queryKey: ["welcome-discount-check", userId],
    queryFn: async () => {
      if (!userId) return [];

      // Check if user has any existing completed orders (truly indicates they're an existing customer)
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id")
        .eq("user_id", userId)
        .in("status", ["completed", "installation_completed", "activated", "active"])
        .limit(1);

      if (error) {
        console.warn("[useWelcomeDiscount] Error checking orders:", error);
        return [];
      }

      return orders || [];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const isNewCustomer = !isLoading && (existingSubscriptions?.length === 0);

  return {
    isNewCustomer,
    isLoading,
    discountPercent: isNewCustomer ? WELCOME_DISCOUNT_PERCENT : 0,
    getDiscountAmount: (monthlyServiceTotal: number) => {
      if (!isNewCustomer) return 0;
      return Math.round(monthlyServiceTotal * (WELCOME_DISCOUNT_PERCENT / 100) * 100) / 100;
    },
    label: `Rabais nouveau client (${WELCOME_DISCOUNT_PERCENT}% — 1er mois)`,
  };
};

export default useWelcomeDiscount;
