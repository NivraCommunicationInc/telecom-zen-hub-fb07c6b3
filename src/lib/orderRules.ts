/**
 * orderRules — canonical business rules for the unified order flow.
 * Used by Field, Core, OneView, and the public checkout.
 *
 * Rules (non-negotiable):
 *  - Internet plan     → 1× Borne WiFi (min 1, max 1)
 *  - TV plan           → 1× Borne WiFi (min 1, max 1) + Terminals TV (min 1, max 4)
 *  - Mobile plan       → 1× SIM (min 1, max 1)
 *
 * Required items cannot be removed as long as the parent service is in the cart.
 * Terminal TV can be adjusted between 1 and 4.
 */

export type OrderServiceCategory = "internet" | "tv" | "mobile" | "security" | "other";
export type OrderEquipmentKind = "borne_wifi" | "terminal_tv" | "sim" | "esim" | "other";

export interface CartService {
  id: string;
  category: OrderServiceCategory | string;
  monthlyPrice?: number;
  name?: string;
}

export interface CartEquipment {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  /** kind is optional in legacy data — inferred from name when missing */
  kind?: OrderEquipmentKind;
}

export interface EquipmentCatalogItem {
  id: string;
  name: string;
  category: string;
  price: number;
}

export interface RequiredEquipmentSlot {
  kind: OrderEquipmentKind;
  category: OrderServiceCategory;
  min: number;
  max: number;
  reason: string; // human-readable, shown as a small hint
}

/** Detect the "kind" of an equipment from its display name. */
export function inferEquipmentKind(name: string): OrderEquipmentKind {
  const n = (name || "").toLowerCase();
  if (n.includes("born") || n.includes("wifi") || n.includes("router") || n.includes("routeur") || n.includes("mesh")) {
    return "borne_wifi";
  }
  if (n.includes("terminal") || n.includes("iptv") || n.includes("4k")) return "terminal_tv";
  if (n.includes("esim")) return "esim";
  if (n.includes("sim")) return "sim";
  return "other";
}

/** Given the services currently in the cart, return the mandatory equipment slots. */
export function requiredEquipmentSlots(services: CartService[]): RequiredEquipmentSlot[] {
  const cats = new Set(services.map((s) => (s.category || "").toLowerCase()));
  const slots: RequiredEquipmentSlot[] = [];

  const hasInternet = cats.has("internet");
  const hasTv = cats.has("tv");
  const hasMobile = cats.has("mobile");

  if (hasInternet || hasTv) {
    slots.push({
      kind: "borne_wifi",
      category: "internet",
      min: 1,
      max: 1,
      reason: "Requis pour la connexion Internet et TV",
    });
  }
  if (hasTv) {
    slots.push({
      kind: "terminal_tv",
      category: "tv",
      min: 1,
      max: 4,
      reason: "Minimum 1 terminal par forfait TV (max 4 par compte)",
    });
  }
  if (hasMobile) {
    slots.push({
      kind: "sim",
      category: "mobile",
      min: 1,
      max: 1,
      reason: "Une SIM est requise pour activer le mobile",
    });
  }

  return slots;
}

/**
 * Applies auto-selection rules to an equipment list.
 * - Ensures every mandatory slot is present with at least `min` quantity.
 * - Removes items whose parent service is no longer in the cart.
 * - Never exceeds `max` quantity for a given slot.
 * Returns a new list (does not mutate).
 */
export function reconcileEquipment(
  services: CartService[],
  currentEquipment: CartEquipment[],
  catalog: EquipmentCatalogItem[],
): CartEquipment[] {
  const slots = requiredEquipmentSlots(services);
  const requiredKinds = new Set(slots.map((s) => s.kind));

  // 1. Drop items whose category is no longer required (except explicit "other")
  const activeCategories = new Set(services.map((s) => (s.category || "").toLowerCase()));
  const kept: CartEquipment[] = currentEquipment.filter((e) => {
    const kind = e.kind || inferEquipmentKind(e.name);
    if (kind === "other") return true; // user extras
    const requiredCat: OrderServiceCategory | null =
      kind === "borne_wifi" ? "internet"
      : kind === "terminal_tv" ? "tv"
      : kind === "sim" || kind === "esim" ? "mobile"
      : null;
    if (!requiredCat) return true;
    // borne_wifi stays as long as internet OR tv is in cart
    if (kind === "borne_wifi") return activeCategories.has("internet") || activeCategories.has("tv");
    return activeCategories.has(requiredCat);
  });

  // 2. Enforce quantities and add missing mandatory items
  const byKind = new Map<OrderEquipmentKind, CartEquipment>();
  for (const item of kept) {
    const k = item.kind || inferEquipmentKind(item.name);
    if (!byKind.has(k)) byKind.set(k, { ...item, kind: k });
    else {
      const cur = byKind.get(k)!;
      byKind.set(k, { ...cur, quantity: cur.quantity + item.quantity });
    }
  }

  for (const slot of slots) {
    const existing = byKind.get(slot.kind);
    if (existing) {
      const q = Math.min(slot.max, Math.max(slot.min, existing.quantity));
      byKind.set(slot.kind, { ...existing, quantity: q });
    } else {
      const catalogItem = catalog.find((c) => inferEquipmentKind(c.name) === slot.kind);
      if (catalogItem) {
        byKind.set(slot.kind, {
          id: catalogItem.id,
          name: catalogItem.name,
          category: catalogItem.category,
          price: catalogItem.price,
          quantity: slot.min,
          kind: slot.kind,
        });
      }
    }
  }

  // Preserve "other" extras that were kept but not accounted for
  const kinds = new Set(byKind.keys());
  for (const e of kept) {
    const k = e.kind || inferEquipmentKind(e.name);
    if (!kinds.has(k) && k === "other") {
      byKind.set(("other-" + e.id) as any, { ...e, kind: "other" });
    }
  }

  return Array.from(byKind.values()).filter((e) => e.quantity > 0);
}

/** Returns true when this equipment kind is currently required (i.e. cannot be removed). */
export function isEquipmentLocked(kind: OrderEquipmentKind, services: CartService[]): boolean {
  const slots = requiredEquipmentSlots(services);
  const slot = slots.find((s) => s.kind === kind);
  if (!slot) return false;
  return slot.min > 0;
}

/** Returns the effective min/max for a given kind based on current services. */
export function equipmentBounds(
  kind: OrderEquipmentKind,
  services: CartService[],
): { min: number; max: number } {
  const slot = requiredEquipmentSlots(services).find((s) => s.kind === kind);
  if (!slot) return { min: 0, max: 5 };
  return { min: slot.min, max: slot.max };
}
