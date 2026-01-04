/**
 * Order Line Items Builder
 * 
 * Builds structured line_items for orders that can be used by PDF generators
 * to display each service/equipment/fee on its own row with prices.
 */

export type LineItemType = "Internet" | "TV" | "Mobile" | "Streaming" | "Security" | "Equipment" | "Fee" | "Other";
export type LineItemCategory = "service" | "equipment" | "fee";

export interface OrderLineItem {
  type: LineItemType;
  name: string;
  qty: number;
  unitPrice: number;
  /** e.g. "/mois", "/30 jours", "Frais unique" */
  priceLabel: string;
  category: LineItemCategory;
  /** Optional description */
  description?: string;
}

interface ServiceInput {
  type: "Internet" | "TV" | "Mobile" | "Streaming" | "Security" | "Other";
  name: string;
  price: number;
  priceLabel?: string;
  description?: string;
}

interface EquipmentInput {
  name: string;
  quantity: number;
  unitPrice: number;
  description?: string;
}

interface FeeInput {
  name: string;
  amount: number;
  description?: string;
}

/**
 * Builds a structured line_items array for an order
 */
export function buildOrderLineItems(params: {
  services?: ServiceInput[];
  equipment?: EquipmentInput[];
  fees?: FeeInput[];
}): OrderLineItem[] {
  const lineItems: OrderLineItem[] = [];

  // Add services
  if (params.services) {
    for (const service of params.services) {
      if (service.name && service.price !== undefined) {
        lineItems.push({
          type: service.type,
          name: service.name,
          qty: 1,
          unitPrice: service.price,
          priceLabel: service.priceLabel || (service.type === "Mobile" ? "/30 jours" : "/mois"),
          category: "service",
          description: service.description,
        });
      }
    }
  }

  // Add equipment
  if (params.equipment) {
    for (const item of params.equipment) {
      if (item.name && item.unitPrice > 0) {
        lineItems.push({
          type: "Equipment",
          name: item.name,
          qty: item.quantity || 1,
          unitPrice: item.unitPrice,
          priceLabel: "Frais unique",
          category: "equipment",
          description: item.description,
        });
      }
    }
  }

  // Add fees
  if (params.fees) {
    for (const fee of params.fees) {
      if (fee.name && fee.amount > 0) {
        lineItems.push({
          type: "Fee",
          name: fee.name,
          qty: 1,
          unitPrice: fee.amount,
          priceLabel: "Frais unique",
          category: "fee",
          description: fee.description,
        });
      }
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
    version: 1,
  };
}

/**
 * Extracts line_items from equipment_details JSON
 */
export function extractLineItemsFromOrder(equipmentDetails: any): OrderLineItem[] | null {
  if (!equipmentDetails || typeof equipmentDetails !== 'object') {
    return null;
  }

  const lineItems = equipmentDetails.line_items;
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return null;
  }

  // Validate and normalize each line item
  return lineItems.filter((item: any) => 
    item && typeof item === 'object' && item.name
  ).map((item: any) => ({
    type: item.type || "Other",
    name: item.name,
    qty: item.qty || item.quantity || 1,
    unitPrice: item.unitPrice ?? item.price ?? -1,
    priceLabel: item.priceLabel || "/mois",
    category: item.category || "service",
    description: item.description,
  }));
}
