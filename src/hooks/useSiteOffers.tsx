import { useQuery } from "@tanstack/react-query";
import { backendClient } from "@/integrations/backend/client";

export interface SiteOffer {
  id: string;
  offer_type: string;
  category: string;
  name_fr: string;
  name_en: string | null;
  description_fr: string | null;
  description_en: string | null;
  price_monthly: number | null;
  price_setup: number | null;
  discount_percent: number | null;
  discount_amount: number | null;
  promo_code: string | null;
  valid_from: string | null;
  valid_until: string | null;
  is_featured: boolean;
  features_json: Record<string, unknown> | null;
  sort_order: number;
}

export function useSiteOffers(options?: { category?: string; featured?: boolean }) {
  return useQuery({
    queryKey: ["site-offers", options?.category, options?.featured],
    queryFn: async () => {
      // Use secure public view that excludes internal metadata (created_by_id, updated_by_id, etc.)
      // The view already filters is_active and date validity
      let query = backendClient
        .from("site_offers_public")
        .select("*")
        .order("sort_order", { ascending: true });

      if (options?.category) {
        query = query.eq("category", options.category);
      }

      if (options?.featured) {
        query = query.eq("is_featured", true);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Failed to fetch site offers:", error);
        return [];
      }

      return (data || []) as SiteOffer[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
