import { useQuery } from "@tanstack/react-query";
import { portalClient as portalSupabase } from "@/integrations/backend";

export interface StreamingCatalogItem {
  id: string;
  name: string;
  status: "active" | "hold" | "inactive";
  category: "video" | "music";
  description: string | null;
  price_monthly: number;
  currency: string;
  features: string[];
  sort_order: number;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface StreamingSnapshot {
  id: string;
  name: string;
  price_monthly: number;
  category: "video" | "music";
}

/**
 * Portal-only hook for fetching active streaming catalog items.
 * Uses portalSupabase client to avoid session conflicts with admin.
 */
export const usePortalStreamingCatalogActive = () => {
  return useQuery({
    queryKey: ["portal-streaming-catalog-active"],
    queryFn: async () => {
      // Use secure public view that hides internal business logic fields
      const { data, error } = await portalSupabase
        .from("streaming_catalog_public")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as StreamingCatalogItem[];
    },
    staleTime: 30000,
  });
};

// Helper to create snapshot for orders
export const createStreamingSnapshot = (items: StreamingCatalogItem[]): StreamingSnapshot[] => {
  return items.map(item => ({
    id: item.id,
    name: item.name,
    price_monthly: item.price_monthly,
    category: item.category,
  }));
};

// Helper to calculate total
export const calculateStreamingTotal = (items: StreamingCatalogItem[]): number => {
  return items.reduce((sum, item) => sum + item.price_monthly, 0);
};
