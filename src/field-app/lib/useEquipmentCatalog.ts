/**
 * Hook to fetch equipment catalog from DB (services table, category=Équipement).
 * Replaces hardcoded EQUIPMENT_CATALOG in StepEquipment.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Router, Tv, Smartphone, Package } from "lucide-react";
import type { FieldConfig } from "./useFieldConfig";

export interface EquipmentItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string | null;
  requiredServiceCategory: string;
  maxQty: number;
  icon: typeof Router;
}

/** Map equipment names to service categories and icons */
function resolveEquipmentMeta(name: string, config?: FieldConfig): { category: string; icon: typeof Router; maxQty: number } {
  const n = name.toLowerCase();
  if (n.includes("router") || n.includes("routeur") || n.includes("born") || n.includes("borne") || n.includes("mesh")) {
    const isRouter = n.includes("router") || n.includes("routeur");
    return {
      category: "internet",
      icon: Router,
      maxQty: isRouter ? (config?.max_router_qty ?? 1) : (config?.max_borne_qty ?? 3),
    };
  }
  if (n.includes("terminal") || n.includes("iptv") || n.includes("4k")) {
    return { category: "tv", icon: Tv, maxQty: config?.max_terminal_qty ?? 5 };
  }
  if (n.includes("sim") || n.includes("esim")) {
    return { category: "mobile", icon: Smartphone, maxQty: config?.max_sim_qty ?? 5 };
  }
  if (n.includes("cam") || n.includes("détect") || n.includes("panneau") || n.includes("sensor") || n.includes("panel")) {
    return { category: "security", icon: Package, maxQty: 4 };
  }
  return { category: "other", icon: Package, maxQty: 5 };
}

export function useEquipmentCatalog(config?: FieldConfig) {
  return useQuery({
    queryKey: ["field-equipment-catalog", config?.max_router_qty],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services_public")
        .select("id, name, category, price, description")
        .ilike("category", "%quipement%")
        .order("name");

      if (error) {
        console.error("[EquipmentCatalog] Error:", error);
        return [];
      }

      return (data || []).map((item: any): EquipmentItem => {
        const meta = resolveEquipmentMeta(item.name, config);
        return {
          id: item.id,
          name: item.name,
          price: Number(item.price) || 0,
          category: meta.category,
          description: item.description,
          requiredServiceCategory: meta.category,
          maxQty: meta.maxQty,
          icon: meta.icon,
        };
      });
    },
    staleTime: 5 * 60 * 1000,
  });
}
