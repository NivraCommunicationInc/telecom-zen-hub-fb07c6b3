/**
 * useServiceCatalog — Load real catalog data from DB, never invent.
 *
 * Sources of truth:
 *   - Plans (Internet / Mobile / TV) → public.services (filter by category)
 *   - TV bouquets / packs            → public.channel_packages
 *   - Equipment (SIM, modems, terminals) → public.services (category='Équipement')
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CatalogPlan {
  id: string;
  name: string;
  category: string;
  price: number;
}

export interface CatalogBouquet {
  id: string;
  name: string;
  category: string;
  price: number; // discounted_price ?? original_price
}

export function useServicePlans(category: "Mobile" | "Internet" | "TV" | "Équipement" | null, enabled = true) {
  const [plans, setPlans] = useState<CatalogPlan[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !category) return;
    let alive = true;
    setLoading(true);
    supabase
      .from("services")
      .select("id,name,category,price,status,is_active")
      .eq("category", category)
      .or("status.eq.active,is_active.eq.true")
      .order("price", { ascending: true })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          setPlans([]);
        } else {
          setPlans(
            (data || []).map((d: any) => ({
              id: d.id,
              name: d.name,
              category: d.category,
              price: Number(d.price ?? 0),
            }))
          );
        }
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [category, enabled]);

  return { plans, loading };
}

export function useChannelPackages(enabled = true) {
  const [packs, setPacks] = useState<CatalogBouquet[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setLoading(true);
    supabase
      .from("channel_packages")
      .select("id,name,category,original_price,discounted_price,is_active")
      .eq("is_active", true)
      .order("discounted_price", { ascending: true })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          setPacks([]);
        } else {
          setPacks(
            (data || []).map((d: any) => ({
              id: d.id,
              name: d.name,
              category: d.category,
              price: Number(d.discounted_price ?? d.original_price ?? 0),
            }))
          );
        }
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [enabled]);

  return { packs, loading };
}
