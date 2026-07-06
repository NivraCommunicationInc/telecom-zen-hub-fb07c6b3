/**
 * useVanStock — Real equipment inventory available (in_stock/reserved).
 * Groups by high-level category (Modem/Terminal TV/SIM) for van dashboard.
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

export interface VanStockSummary {
  modems: number;
  terminals: number;
  sims: number;
  total: number;
  lowStock: boolean;
  items: VanStockItem[];
}

function classify(item: VanStockItem): "modem" | "terminal" | "sim" | "other" {
  const s = `${item.catalog_name || ""} ${item.category || ""} ${item.sku || ""}`.toLowerCase();
  if (/(sim|esim|carte)/i.test(s)) return "sim";
  if (/(terminal|décodeur|decodeur|tv|iptv|box)/i.test(s)) return "terminal";
  if (/(modem|router|routeur|wifi|borne|passerelle|gateway|ont)/i.test(s)) return "modem";
  return "other";
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
      const items = (data as VanStockItem[]) || [];
      let modems = 0, terminals = 0, sims = 0;
      for (const it of items) {
        const c = classify(it);
        if (c === "modem") modems++;
        else if (c === "terminal") terminals++;
        else if (c === "sim") sims++;
      }
      return {
        modems, terminals, sims,
        total: items.length,
        lowStock: modems < 2 || terminals < 2 || sims < 5,
        items,
      };
    },
  });
}
