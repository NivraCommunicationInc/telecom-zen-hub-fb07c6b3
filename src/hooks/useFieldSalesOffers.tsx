/**
 * Hook for fetching site offers for field sales portal
 * Uses the same data source as the main website
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FieldSalesOffer {
  id: string;
  offer_type: string;
  category: string;
  name_fr: string;
  description_fr: string | null;
  price_monthly: number | null;
  price_setup: number | null;
  discount_percent: number | null;
  discount_amount: number | null;
  is_featured: boolean;
  features_json: {
    badge?: string;
    features?: string[];
    speed?: string;
  } | null;
  sort_order: number;
}

export function useFieldSalesOffers(category?: string) {
  return useQuery({
    queryKey: ["field-sales-offers", category],
    queryFn: async () => {
      let query = supabase
        .from("site_offers")
        .select("id, offer_type, category, name_fr, description_fr, price_monthly, price_setup, discount_percent, discount_amount, is_featured, features_json, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (category && category !== "all") {
        query = query.eq("category", category);
      }

      // Filter by valid date range
      const now = new Date().toISOString();
      query = query.or(`valid_from.is.null,valid_from.lte.${now}`);
      query = query.or(`valid_until.is.null,valid_until.gte.${now}`);

      const { data, error } = await query;

      if (error) {
        console.error("Failed to fetch field sales offers:", error);
        return [];
      }

      return (data || []) as FieldSalesOffer[];
    },
    staleTime: 30 * 1000,
  });
}

// Calculate totals using the same logic as billingCalculator
export const TAX_RATES = {
  TPS: 0.05,
  TVQ: 0.09975,
};

export interface SelectedService {
  offerId: string;
  name: string;
  category: string;
  priceMonthly: number;
  priceSetup: number;
  quantity: number;
}

export function calculateFieldSalesTotals(services: SelectedService[]) {
  const monthlySubtotal = services.reduce((sum, s) => sum + (s.priceMonthly * s.quantity), 0);
  const setupSubtotal = services.reduce((sum, s) => sum + (s.priceSetup * s.quantity), 0);
  
  // Calculate activation fee based on number of services
  const serviceCount = services.length;
  const activationFee = serviceCount === 0 ? 0 : serviceCount === 1 ? 25 : 45;
  
  const oneTimeTotal = setupSubtotal + activationFee;
  const taxableSubtotal = monthlySubtotal + oneTimeTotal;
  
  const tps = Math.round(taxableSubtotal * TAX_RATES.TPS * 100) / 100;
  const tvq = Math.round(taxableSubtotal * TAX_RATES.TVQ * 100) / 100;
  const total = Math.round((taxableSubtotal + tps + tvq) * 100) / 100;

  return {
    monthlySubtotal,
    setupSubtotal,
    activationFee,
    oneTimeTotal,
    taxableSubtotal,
    tps,
    tvq,
    total,
    firstMonthTotal: total,
    recurringMonthly: Math.round((monthlySubtotal * (1 + TAX_RATES.TPS + TAX_RATES.TVQ)) * 100) / 100,
  };
}
