/**
 * useVanStock — Real equipment inventory available (in_stock/reserved).
 * Restricted to items technicians install: Borne WiFi, Terminal TV, POD WiFi.
 * SIM and other categories are intentionally excluded.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VanStockItem {
  id: string;
  catalog_name: string | null;
  category: string | null;
  sku: string | null;
  serial_number: string | null;
  status: string;
  warehouse_location: string | null;
  condition: string | null;
}

export type TechCategory = "borne" | "terminal" | "pod";

export interface VanStockSummary {
  bornes: number;
  terminals: number;
  pods: number;
  /** Legacy alias kept so old dashboard code keeps compiling. */
  modems: number;
  sims: number;
  total: number;
  lowStock: boolean;
  items: VanStockItem[];
}

export function classifyTechItem(item: {
  catalog_name: string | null;
  category: string | null;
  sku: string | null;
}): TechCategory | null {
  const s = `${item.catalog_name || ""} ${item.category || ""} ${item.sku || ""}`.toLowerCase();
  if (/pod/.test(s)) return "pod";
  if (/(terminal|décodeur|decodeur|tv|iptv|box)/i.test(s)) return "terminal";
  if (/(borne|modem|router|routeur|wifi|passerelle|gateway|ont)/i.test(s)) return "borne";
  return null;
}

export function useVanStock() {
  return useQuery({
    queryKey: ["tech-van-stock"],
    staleTime: 30_000,
    queryFn: async (): Promise<VanStockSummary> => {
      const { data, error } = await supabase
        .from("equipment_inventory")
        .select("id, catalog_name, category, sku, serial_number, status, warehouse_location, condition")
        .in("status", ["in_stock", "reserved"])
        .order("catalog_name", { ascending: true });
      if (error) throw error;
      const all = (data as VanStockItem[]) || [];
      const items = all.filter((it) => classifyTechItem(it) !== null);
      let bornes = 0, terminals = 0, pods = 0;
      for (const it of items) {
        const c = classifyTechItem(it);
        if (c === "borne") bornes++;
        else if (c === "terminal") terminals++;
        else if (c === "pod") pods++;
      }
      return {
        bornes,
        terminals,
        pods,
        modems: bornes, // legacy alias
        sims: 0,
        total: items.length,
        lowStock: bornes < 2 || terminals < 2,
        items,
      };
    },
  });
}
