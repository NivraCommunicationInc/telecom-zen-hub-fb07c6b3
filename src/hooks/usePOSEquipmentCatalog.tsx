import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface POSEquipmentCatalogItem {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  category: string;
  is_active: boolean | null;
}

/**
 * Equipment catalog for internal POS.
 * Source of truth: same `services` table used by the website.
 */
export function usePOSEquipmentCatalog() {
  return useQuery({
    queryKey: ["pos-equipment-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id,name,description,price,category,is_active")
        .eq("is_active", true)
        .eq("category", "Équipement")
        .order("name", { ascending: true });

      if (error) throw error;
      return (data || []) as POSEquipmentCatalogItem[];
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}
