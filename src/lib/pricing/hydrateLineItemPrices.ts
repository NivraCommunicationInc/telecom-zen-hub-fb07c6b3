import { supabase } from "@/integrations/backend/client";
import type { OrderLineItem } from "@/lib/orderLineItems";

type ServiceRow = {
  id: string;
  name: string;
  price: number | null;
  category: string | null;
  is_active: boolean | null;
};

type StreamingCatalogRow = {
  id: string;
  name: string;
  price_monthly: number;
  status: string;
};

type StreamingServiceRow = {
  id: string;
  name: string;
  monthly_price: number;
  is_active: boolean | null;
};

const normalizeKey = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
};

const needsUnitPrice = (item: OrderLineItem): boolean => {
  return !Number.isFinite(item.unit_price) || item.unit_price < 0;
};

export async function hydrateLineItemPricesFromCatalog(
  lineItems: OrderLineItem[]
): Promise<{ lineItems: OrderLineItem[]; changed: boolean }> {
  const hasAnyMissing = lineItems.some(needsUnitPrice);
  if (!hasAnyMissing) return { lineItems, changed: false };

  // Fetch catalogue tables (small enough to cache per call)
  const [servicesRes, streamingCatalogRes, streamingServicesRes] = await Promise.all([
    supabase
      .from("services")
      .select("id,name,price,category,is_active")
      .eq("is_active", true),
    supabase
      .from("streaming_catalog")
      .select("id,name,price_monthly,status")
      .eq("status", "active"),
    // Backward compatibility: some flows still use streaming_services
    supabase
      .from("streaming_services")
      .select("id,name,monthly_price,is_active")
      .eq("is_active", true),
  ]);

  // If catalogue tables are not accessible due to RLS, fail gracefully
  const services = (servicesRes.data || []) as ServiceRow[];
  const streamingCatalog = (streamingCatalogRes.data || []) as StreamingCatalogRow[];
  const streamingServices = (streamingServicesRes.data || []) as StreamingServiceRow[];

  const serviceById = new Map<string, ServiceRow>();
  const serviceByName = new Map<string, ServiceRow>();
  for (const s of services) {
    serviceById.set(s.id, s);
    serviceByName.set(normalizeKey(s.name), s);
  }

  const streamingById = new Map<string, { name: string; price: number }>();
  const streamingByName = new Map<string, { name: string; price: number }>();
  for (const s of streamingCatalog) {
    streamingById.set(s.id, { name: s.name, price: Number(s.price_monthly) });
    streamingByName.set(normalizeKey(s.name), { name: s.name, price: Number(s.price_monthly) });
  }
  for (const s of streamingServices) {
    streamingById.set(s.id, { name: s.name, price: Number(s.monthly_price) });
    streamingByName.set(normalizeKey(s.name), { name: s.name, price: Number(s.monthly_price) });
  }

  let changed = false;

  const hydrated = lineItems.map((item) => {
    if (!needsUnitPrice(item)) return item;

    const refId = item.ref_id;
    const key = normalizeKey(item.name);

    // 1) Streaming lookup
    if (item.type === "streaming") {
      const match =
        (refId ? streamingById.get(refId) : undefined) ??
        streamingByName.get(key);

      if (match && Number.isFinite(match.price) && match.price > 0) {
        changed = true;
        return { ...item, unit_price: match.price };
      }

      return item;
    }

    // 2) General services/equipment lookup
    const match = (refId ? serviceById.get(refId) : undefined) ?? serviceByName.get(key);

    if (match && match.price !== null && Number.isFinite(Number(match.price)) && Number(match.price) > 0) {
      changed = true;
      return { ...item, unit_price: Number(match.price) };
    }

    return item;
  });

  return { lineItems: hydrated, changed };
}
