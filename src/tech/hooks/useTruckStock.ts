import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TruckItem {
  id: string;
  catalog_name: string;
  category: string;
  sku: string | null;
  serial_number: string | null;
  status: string;
}

// Items currently held by the logged-in technician (status = 'assigned_to_tech'
// or catalog matches truck loadout). Falls back to items where assigned_by = me.
export function useTruckStock() {
  const [items, setItems] = useState<TruckItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      const uid = user.user?.id;
      if (!uid) { if (alive) setLoading(false); return; }
      const { data } = await supabase
        .from("equipment_inventory")
        .select("id, catalog_name, category, sku, serial_number, status, assigned_by")
        .eq("assigned_by", uid)
        .in("status", ["in_stock", "assigned_to_tech", "reserved"])
        .order("catalog_name")
        .limit(50);
      if (alive) {
        setItems(((data ?? []) as TruckItem[]));
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return { items, loading };
}
