/**
 * Order Line Items Builder
 *
 * Builds structured line_items for orders that can be used by PDF generators
 * to display each service/equipment/fee/discount on its own row with prices.
 *
 * This is the SINGLE SOURCE OF TRUTH for order pricing shape in contracts/invoices.
 */

export type LineItemType =
  | "internet"
  | "tv"
  | "mobile"
  | "streaming"
  | "security"
  | "other"
  | "activation"
  | "installation"
  | "delivery"
  | "reactivation"
  | "sim"
  | "router"
  | "terminal"
  | "equipment"
  | "fee"
  | "discount";

export type LineItemCategory = "service" | "equipment" | "fee" | "discount";
export type LineItemPeriod = "monthly" | "30_days" | "one_time";

export interface OrderLineItem {
  /** Category: service, equipment, fee, discount */
  category: LineItemCategory;
  /** Specific type within category */
  type: LineItemType;
  /** Display name */
  name: string;
  /** Quantity */
  qty: number;
  /** Unit price in dollars (use -1 sentinel for unknown) */
  unit_price: number;
  /** Billing period */
  period: LineItemPeriod;
  /** Whether item is taxable */
  taxable: boolean;
  /** Optional description */
  description?: string;
  /** Optional reference id (ex: plan_id from catalogue) */
  ref_id?: string;
}

// Legacy types for backward compatibility
export type LegacyLineItemType =
  | "Internet"
  | "TV"
  | "Mobile"
  | "Streaming"
  | "Security"
  | "Equipment"
  | "Fee"
  | "Other";

export interface LegacyOrderLineItem {
  type: LegacyLineItemType;
  name: string;
  qty: number;
  unitPrice: number;
  priceLabel: string;
  category: LineItemCategory;
  description?: string;
}

export interface ServiceInput {
  type: "Internet" | "TV" | "Mobile" | "Streaming" | "Security" | "Other";
  name: string;
  price?: number;
  qty?: number;
  taxable?: boolean;
  period?: LineItemPeriod;
  /** Optional reference id from catalogue */
  refId?: string;
  description?: string;
}

export interface EquipmentInput {
  name: string;
  quantity: number;
  unitPrice?: number;
  taxable?: boolean;
  /** Optional reference id from catalogue */
  refId?: string;
  description?: string;
}

export interface FeeInput {
  name: string;
  amount?: number;
  qty?: number;
  taxable?: boolean;
  /** Optional reference id from catalogue */
  refId?: string;
  description?: string;
}

export interface DiscountInput {
  name: string;
  amount?: number;
  qty?: number;
  /** Usually false (discounts themselves aren't taxed) */
  taxable?: boolean;
  period?: LineItemPeriod;
  /** Optional reference id from catalogue */
  refId?: string;
  description?: string;
}

/**
 * Maps service type to specific line item type
 */
function mapServiceType(serviceType: string): LineItemType {
  const t = serviceType.toLowerCase();
  if (t === "internet" || t.includes("internet") || t.includes("fibre")) return "internet";
  if (t === "tv" || t.includes("tv") || t.includes("télé")) return "tv";
  if (t === "mobile" || t.includes("mobile") || t.includes("cell")) return "mobile";
  if (t === "streaming" || t.includes("stream")) return "streaming";
  if (t === "security" || t.includes("sécurité") || t.includes("alarm")) return "security";
  if (t === "discount" || t.includes("rabais") || t.includes("discount")) return "discount";
  return "other";
}

/**
 * Determines period based on service type
 */
function getPeriodForService(type: LineItemType): LineItemPeriod {
  if (type === "mobile") return "30_days";
  return "monthly";
}

const toNumberOrUnknown = (value: unknown): number => {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : -1;
};

/**
 * Builds a structured line_items array for an order.
 * NOTE: This function DOES NOT fetch prices from the backend; callers should
 * pass the authoritative price from the catalogue whenever possible.
 */
export function buildOrderLineItems(params: {
  services?: ServiceInput[];
  equipment?: EquipmentInput[];
  fees?: FeeInput[];
  discounts?: DiscountInput[];
}): OrderLineItem[] {
  const lineItems: OrderLineItem[] = [];

  // Add services
  if (params.services) {
    for (const service of params.services) {
      if (!service?.name) continue;

      const itemType = mapServiceType(service.type);
      const unitPrice = toNumberOrUnknown(service.price);

      lineItems.push({
        category: "service",
        type: itemType,
        name: service.name,
        qty: service.qty ?? 1,
        unit_price: unitPrice,
        period: service.period ?? getPeriodForService(itemType),
        taxable: service.taxable !== false,
        description: service.description,
        ref_id: service.refId,
      });
    }
  }

  // Add equipment
  if (params.equipment) {
    for (const item of params.equipment) {
      if (!item?.name) continue;

      // Determine specific equipment type
      let equipType: LineItemType = "equipment";
      const lowerName = item.name.toLowerCase();
      if (lowerName.includes("sim") || lowerName.includes("esim")) equipType = "sim";
      else if (lowerName.includes("routeur") || lowerName.includes("router")) equipType = "router";
      else if (lowerName.includes("terminal")) equipType = "terminal";

      const unitPrice = toNumberOrUnknown(item.unitPrice);

      lineItems.push({
        category: "equipment",
        type: equipType,
        name: item.name,
        qty: item.quantity || 1,
        unit_price: unitPrice,
        period: "one_time",
        taxable: item.taxable !== false,
        description: item.description,
        ref_id: item.refId,
      });
    }
  }

  // Add fees
  if (params.fees) {
    for (const fee of params.fees) {
      if (!fee?.name) continue;

      // Determine specific fee type
      let feeType: LineItemType = "fee";
      const lowerName = fee.name.toLowerCase();
      if (lowerName.includes("activation")) feeType = "activation";
      else if (lowerName.includes("installation")) feeType = "installation";
      else if (lowerName.includes("livraison") || lowerName.includes("delivery")) feeType = "delivery";
      else if (lowerName.includes("réactivation") || lowerName.includes("reactivation")) feeType = "reactivation";

      const unitPrice = toNumberOrUnknown(fee.amount);

      lineItems.push({
        category: "fee",
        type: feeType,
        name: fee.name,
        qty: fee.qty ?? 1,
        unit_price: unitPrice,
        period: "one_time",
        taxable: fee.taxable !== false,
        description: fee.description,
        ref_id: fee.refId,
      });
    }
  }

  // Add discounts
  if (params.discounts) {
    for (const discount of params.discounts) {
      if (!discount?.name) continue;

      const unitPrice = toNumberOrUnknown(discount.amount);

      lineItems.push({
        category: "discount",
        type: "discount",
        name: discount.name,
        qty: discount.qty ?? 1,
        unit_price: unitPrice,
        period: discount.period ?? "one_time",
        taxable: discount.taxable === true, // default false
        description: discount.description,
        ref_id: discount.refId,
      });
    }
  }

  return lineItems;
}

/**
 * Wraps line_items into an equipment_details JSON structure
 */
export function wrapLineItemsForOrder(lineItems: OrderLineItem[]): Record<string, any> {
  return {
    line_items: lineItems,
    generated_at: new Date().toISOString(),
    version: 2, // Version 2 = new format with period/taxable
  };
}

/**
 * Extracts line_items from equipment_details JSON.
 * Normalizes both old and new formats to the new OrderLineItem format.
 */
export function extractLineItemsFromOrder(equipmentDetails: any): OrderLineItem[] | null {
  if (!equipmentDetails || typeof equipmentDetails !== "object") return null;

  const lineItems = equipmentDetails.line_items;
  if (!Array.isArray(lineItems) || lineItems.length === 0) return null;

  return lineItems
    .filter((item: any) => item && typeof item === "object" && item.name)
    .map((item: any): OrderLineItem => {
      // Category
      let category: LineItemCategory = item.category || "service";
      if (!(["service", "equipment", "fee", "discount"] as const).includes(category)) {
        category = "service";
      }

      // Type
      let itemType: LineItemType;
      if (item.type && typeof item.type === "string") {
        const t = item.type.toLowerCase();
        if (
          [
            "internet",
            "tv",
            "mobile",
            "streaming",
            "security",
            "other",
            "activation",
            "installation",
            "delivery",
            "reactivation",
            "sim",
            "router",
            "terminal",
            "equipment",
            "fee",
            "discount",
          ].includes(t)
        ) {
          itemType = t as LineItemType;
        } else {
          itemType = mapServiceType(t);
        }
      } else {
        itemType =
          category === "discount"
            ? "discount"
            : category === "equipment"
              ? "equipment"
              : category === "fee"
                ? "fee"
                : "other";
      }

      // Period
      let period: LineItemPeriod = "monthly";
      if (item.period && ["monthly", "30_days", "one_time"].includes(item.period)) {
        period = item.period;
      } else if (item.priceLabel) {
        const label = String(item.priceLabel).toLowerCase();
        if (label.includes("30") || label.includes("jour")) period = "30_days";
        else if (label.includes("unique") || label.includes("one") || label.includes("frais")) period = "one_time";
      } else if (category === "equipment" || category === "fee" || category === "discount") {
        period = "one_time";
      } else if (itemType === "mobile") {
        period = "30_days";
      }

      // Price
      const unitPriceRaw = item.unit_price ?? item.unitPrice ?? item.price;
      const unitPrice = toNumberOrUnknown(unitPriceRaw);

      // Optional reference id
      const refId =
        item.ref_id ??
        item.refId ??
        item.plan_id ??
        item.planId ??
        item.catalog_id ??
        item.catalogId;

      return {
        category,
        type: itemType,
        name: item.name,
        qty: Number(item.qty ?? item.quantity ?? 1) || 1,
        unit_price: unitPrice,
        period,
        taxable: item.taxable !== false,
        description: item.description,
        ref_id: typeof refId === "string" ? refId : undefined,
      };
    });
}

/**
 * Helper to format period for display
 */
export function formatPeriodLabel(period: LineItemPeriod): string {
  switch (period) {
    case "monthly":
      return "/mois";
    case "30_days":
      return "/30 jours";
    case "one_time":
      return "Frais unique";
    default:
      return "/mois";
  }
}

/**
 * Helper to get display type name
 */
export function getTypeDisplayName(type: LineItemType): string {
  const names: Record<LineItemType, string> = {
    internet: "Internet",
    tv: "TV",
    mobile: "Mobile",
    streaming: "Streaming",
    security: "Sécurité",
    other: "Autre",
    activation: "Activation",
    installation: "Installation",
    delivery: "Livraison",
    reactivation: "Réactivation",
    sim: "SIM",
    router: "Routeur",
    terminal: "Terminal",
    equipment: "Équipement",
    fee: "Frais",
    discount: "Rabais",
  };
  return names[type] || type;
}

/**
 * Calculate totals from line items.
 * Unknown prices (-1) are excluded from totals.
 */
export function calculateLineItemTotals(lineItems: OrderLineItem[]): {
  serviceSubtotal: number;
  equipmentSubtotal: number;
  feeSubtotal: number;
  discountTotal: number;
  taxableSubtotal: number;
  total: number;
} {
  let serviceSubtotal = 0;
  let equipmentSubtotal = 0;
  let feeSubtotal = 0;
  let discountTotal = 0;
  let taxableGross = 0;

  for (const item of lineItems) {
    if (item.unit_price < 0) continue;

    const lineTotal = item.unit_price * item.qty;

    if (item.category === "service") serviceSubtotal += lineTotal;
    else if (item.category === "equipment") equipmentSubtotal += lineTotal;
    else if (item.category === "fee") feeSubtotal += lineTotal;
    else if (item.category === "discount") discountTotal += lineTotal;

    if (item.taxable && item.category !== "discount") {
      taxableGross += lineTotal;
    }
  }

  const taxableSubtotal = Math.max(0, taxableGross - discountTotal);
  const total = serviceSubtotal + equipmentSubtotal + feeSubtotal - discountTotal;

  return {
    serviceSubtotal,
    equipmentSubtotal,
    feeSubtotal,
    discountTotal,
    taxableSubtotal,
    total,
  };
}
