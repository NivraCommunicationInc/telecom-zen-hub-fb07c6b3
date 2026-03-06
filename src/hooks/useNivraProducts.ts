/**
 * React Query hook for Nivra external API products.
 * Replaces hardcoded pricing with live data from the API.
 */
import { useQuery } from "@tanstack/react-query";
import {
  fetchNivraProducts,
  mapProductTypeToCategory,
  type NivraProduct,
} from "@/lib/api/nivraApi";

export interface NivraServiceItem {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  category: string;
  product_type: string;
}

/**
 * Fetch all products from the Nivra API.
 * Returns raw products + mapped service items compatible with existing Service interface.
 */
export function useNivraProducts() {
  const query = useQuery({
    queryKey: ["nivra-products"],
    queryFn: fetchNivraProducts,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Map to Service-compatible items (id, name, description, price, category)
  const services: NivraServiceItem[] = (query.data || []).map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    description: "", // API doesn't provide description
    price: p.base_price,
    category: mapProductTypeToCategory(p.product_type),
    product_type: p.product_type,
  }));

  // Build SKU lookup
  const skuMap = new Map<string, NivraProduct>();
  for (const p of query.data || []) {
    skuMap.set(p.sku, p);
  }

  return {
    products: query.data || [],
    services,
    skuMap,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

/**
 * Get equipment prices from the API products.
 */
export function useNivraEquipmentPrices() {
  const { products, isLoading } = useNivraProducts();

  const getPrice = (sku: string, fallback: number): number => {
    const product = products.find((p) => p.sku === sku);
    return product ? product.base_price : fallback;
  };

  return {
    routerPrice: getPrice("EQ-ROUTER", 60),
    terminalPrice: getPrice("EQ-TVBOX", 50),
    simPrice: getPrice("FEE-SIM", 25),
    esimPrice: getPrice("FEE-ESIM", 25),
    deliveryFee: getPrice("FEE-DELIVERY", 30),
    activation1Price: getPrice("FEE-ACT-1", 25),
    activation2PlusPrice: getPrice("FEE-ACT-2PLUS", 45),
    isLoading,
  };
}
