/**
 * EquipmentStockPicker — Inline stock browser for order-processing EquipmentStep.
 * Lists in-stock equipment_inventory items filtered by unit type, and returns the
 * chosen row to the caller (which will autofill serial/mac/iccid/imei + reserve it).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Package, Search, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type StockUnitType =
  | "sim" | "esim" | "router" | "modem" | "borne_wifi" | "tv_box" | "device" | "other";

export interface StockItem {
  id: string;
  catalog_name: string | null;
  category: string | null;
  sku: string | null;
  serial_number: string | null;
  mac_address: string | null;
  imei: string | null;
  status: string | null;
  warehouse_location: string | null;
}

const CATEGORY_HINTS: Record<StockUnitType, string[]> = {
  sim:        ["sim"],
  esim:       ["esim", "sim"],
  router:     ["router", "routeur", "modem"],
  modem:      ["modem", "router"],
  borne_wifi: ["borne", "wifi", "router"],
  tv_box:     ["tv", "terminal", "iptv", "box"],
  device:     ["mobile", "device", "phone", "cellulaire"],
  other:      [],
};

function matchesType(item: StockItem, type: StockUnitType): boolean {
  if (type === "other") return true;
  const hints = CATEGORY_HINTS[type] || [];
  const haystack = `${item.category ?? ""} ${item.catalog_name ?? ""} ${item.sku ?? ""}`.toLowerCase();
  return hints.some((h) => haystack.includes(h));
}

interface Props {
  unitType: StockUnitType;
  onSelect: (item: StockItem) => void;
  className?: string;
}

export function EquipmentStockPicker({ unitType, onSelect, className }: Props) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);

  const { data: allStock = [], isLoading } = useQuery({
    queryKey: ["equipment-stock-in_stock"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipment_inventory")
        .select("id, catalog_name, category, sku, serial_number, mac_address, imei, status, warehouse_location")
        .eq("status", "in_stock")
        .order("catalog_name", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data as StockItem[]) ?? [];
    },
  });

  const filtered = useMemo(() => {
    const byType = allStock.filter((i) => matchesType(i, unitType));
    const q = search.trim().toLowerCase();
    if (!q) return byType;
    return byType.filter((i) =>
      [i.catalog_name, i.sku, i.serial_number, i.mac_address, i.imei]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [allStock, unitType, search]);

  return (
    <div className={cn("mt-3 border border-dashed border-gray-300 rounded-lg bg-white", className)}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
      >
        <span className="flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-gray-500" />
          Choisir depuis le stock {isLoading ? "…" : `(${filtered.length} dispo)`}
        </span>
        <span className="text-gray-400">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="p-3 pt-0 space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 w-3.5 h-3.5 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher S/N, MAC, ICCID, SKU…"
              className="h-8 text-xs pl-7 border-gray-300 text-gray-900"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 py-3 text-xs text-gray-500">
              <Loader2 className="w-3 h-3 animate-spin" /> Chargement du stock…
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-gray-500 py-2">Aucun équipement en stock ne correspond à ce type.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-md bg-white">
              {filtered.slice(0, 50).map((item) => {
                const primary = item.serial_number || item.imei || item.mac_address || item.sku || item.id.slice(0, 8);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item)}
                    className="w-full text-left px-3 py-2 hover:bg-emerald-50 transition-colors flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate">
                        {item.catalog_name || item.sku || "Équipement"}
                      </p>
                      <p className="text-[10px] text-gray-500 font-mono truncate">
                        {primary}
                        {item.warehouse_location ? ` · ${item.warehouse_location}` : ""}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7 text-[10px] px-2 border-emerald-300 text-emerald-700 shrink-0">
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Assigner
                    </Button>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
