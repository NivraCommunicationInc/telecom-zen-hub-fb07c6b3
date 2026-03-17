/**
 * Hook for fetching site offers for field sales portal
 * Uses the same data source as the main website
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FieldSalesOffer {
  id: string;
  offer_type: string;
  category: string;
  name_fr: string;
  description_fr: string | null;
  price_monthly: number | null;
  price_setup: number | null;
  discount_percent: number | null;
  discount_amount: number | null;
  is_featured: boolean;
  features_json: {
    badge?: string;
    features?: string[];
    speed?: string;
  } | null;
  sort_order: number;
}

type ServiceRow = {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string | null;
};

function normalizeCategory(category: string): "internet" | "tv" | "mobile" | "bundle" | "other" {
  const c = (category || "").trim().toLowerCase();
  if (c === "internet") return "internet";
  if (c === "tv") return "tv";
  if (c === "mobile") return "mobile";
  // Backoffice catalog uses capitalized FR labels
  if (c.includes("internet") && c.includes("tv")) return "tv";
  if (c.includes("internet")) return "internet";
  if (c.includes("tv")) return "tv";
  if (c.includes("mobile")) return "mobile";
  return "other";
}

function extractSpeed(name: string, description: string): string | undefined {
  const src = `${name} ${description}`;
  const match = src.match(/(\d+)\s*(mbps|gbps)/i);
  if (match) {
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (unit === "gbps") return `${value} Gbps`;
    return `${value} Mbps`;
  }
  if (src.toLowerCase().includes("giga")) return "1 Gbps";
  return undefined;
}

function splitFeatures(description: string | null): string[] {
  if (!description) return [];
  // Most entries are comma-separated on the website catalog
  return description
    .split(/,|\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function useFieldSalesOffers(category?: string) {
  return useQuery({
    queryKey: ["field-sales-offers", category],
    queryFn: async () => {
      // IMPORTANT:
      // The main website catalog lives in the "services" catalog (via services_public).
      // site_offers_public currently contains only a few promo/legacy entries.
      // The POS must show ALL forfaits Internet/TV/Mobile, so we hydrate from services_public
      // and then merge any site_offers_public rows.

      const [servicesRes, siteOffersRes] = await Promise.all([
        supabase
          .from("services_public")
          .select("id, name, category, price, description")
          .order("category", { ascending: true })
          .order("price", { ascending: true }),
        supabase
          .from("site_offers_public")
          .select(
            "id, offer_type, category, name_fr, description_fr, price_monthly, price_setup, discount_percent, discount_amount, is_featured, features_json, sort_order"
          )
          .order("sort_order", { ascending: true }),
      ]);

      if (servicesRes.error) {
        console.error("[useFieldSalesOffers] Failed to fetch services_public:", servicesRes.error);
        return [];
      }
      if (siteOffersRes.error) {
        console.warn("[useFieldSalesOffers] Failed to fetch site_offers_public:", siteOffersRes.error);
      }

      const services = (servicesRes.data || []) as ServiceRow[];
      const siteOffers = ((siteOffersRes.data || []) as FieldSalesOffer[]) || [];

      const mappedFromServices: FieldSalesOffer[] = services
        .map((s, idx) => {
          const normalized = normalizeCategory(s.category);
          const offerType = normalized === "tv" ? "bundle" : "plan";
          const features = splitFeatures(s.description);
          const speed = extractSpeed(s.name, s.description || "");

          return {
            id: s.id,
            offer_type: offerType,
            category: normalized === "other" ? "other" : normalized,
            name_fr: s.name,
            description_fr: s.description,
            price_monthly: Number(s.price),
            price_setup: 0,
            discount_percent: null,
            discount_amount: null,
            is_featured: false,
            features_json: features.length || speed ? { features, speed } : null,
            // deterministic order: keeps catalog stable
            sort_order: 10_000 + idx,
          };
        })
        // Keep POS service catalog focused on forfaits
        .filter((o) => ["internet", "tv", "mobile"].includes(o.category));

      // Merge (site_offers override same id)
      const byId = new Map<string, FieldSalesOffer>();
      for (const o of mappedFromServices) byId.set(o.id, o);
      for (const o of siteOffers) {
        // normalize legacy categories if needed
        const normalized = normalizeCategory(o.category);
        byId.set(o.id, { ...o, category: normalized === "other" ? o.category : normalized });
      }

      let all = Array.from(byId.values());

      if (category && category !== "all") {
        all = all.filter((o) => o.category === category);
      }

      // Keep site_offers sort_order first if present, then services
      all.sort((a, b) => (a.sort_order ?? 10_000) - (b.sort_order ?? 10_000));
      return all;
    },
    staleTime: 30 * 1000,
  });
}

// ═══ PHASE 3: TAX_RATES export REMOVED ═══
// Use estimateTaxes() from '@/lib/pricing/serverTaxEngine' for UI previews.
import { estimateTaxes, estimateMonthlyWithTax } from "@/lib/pricing/serverTaxEngine";

export interface SelectedService {
  offerId: string;
  name: string;
  category: string;
  priceMonthly: number;
  priceSetup: number;
  quantity: number;
}

export function calculateFieldSalesTotals(services: SelectedService[]) {
  const monthlySubtotal = services.reduce((sum, s) => sum + (s.priceMonthly * s.quantity), 0);
  const setupSubtotal = services.reduce((sum, s) => sum + (s.priceSetup * s.quantity), 0);
  
  const serviceCount = services.length;
  const activationFee = serviceCount === 0 ? 0 : serviceCount === 1 ? 25 : 45;
  
  const oneTimeTotal = setupSubtotal + activationFee;
  const taxableSubtotal = monthlySubtotal + oneTimeTotal;
  
  const { tps, tvq, total } = estimateTaxes(taxableSubtotal);

  return {
    monthlySubtotal,
    setupSubtotal,
    activationFee,
    oneTimeTotal,
    taxableSubtotal,
    tps,
    tvq,
    total,
    firstMonthTotal: total,
    recurringMonthly: estimateMonthlyWithTax(monthlySubtotal),
  };
}
