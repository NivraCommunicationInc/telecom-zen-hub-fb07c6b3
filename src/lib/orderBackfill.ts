/**
 * Order Line Items Backfill Utility
 * 
 * Creates structured line_items for old orders that don't have them.
 * This ensures contract PDFs display services correctly even for legacy orders.
 */

import { supabase } from "@/integrations/supabase/client";
import { 
  buildOrderLineItems, 
  wrapLineItemsForOrder, 
  type OrderLineItem 
} from "./orderLineItems";

interface OrderForBackfill {
  id: string;
  service_type?: string;
  category?: string;
  subtotal?: number;
  activation_fee?: number;
  delivery_fee?: number;
  installation_fee?: number;
  terminal_fee?: number;
  terminal_count?: number;
  router_fee?: number;
  sim_fee?: number;
  equipment_details?: any;
}

/**
 * Parse service_type string to extract individual services with estimated prices
 */
function parseServiceType(serviceType: string, subtotal: number): Array<{
  type: "Internet" | "TV" | "Mobile" | "Streaming" | "Security" | "Other";
  name: string;
  price: number;
  priceLabel: string;
}> {
  const services: Array<{
    type: "Internet" | "TV" | "Mobile" | "Streaming" | "Security" | "Other";
    name: string;
    price: number;
    priceLabel: string;
  }> = [];
  
  const lowerType = serviceType.toLowerCase();
  
  // Known plan patterns with prices
  const planPatterns = [
    // Mobile plans
    { regex: /mobile\s*(\d+)\s*\$?\s*\/?\s*30\s*jours?/i, type: "Mobile" as const, priceLabel: "/30 jours" },
    { regex: /mobile\s*(\d+)\s*\$/i, type: "Mobile" as const, priceLabel: "/30 jours" },
    // Internet plans
    { regex: /internet\s*(\d+)\s*mbps?/i, type: "Internet" as const, priceLabel: "/mois" },
    { regex: /giga(?:\s*\+\s*tv)?/i, type: "Internet" as const, priceLabel: "/mois" },
    { regex: /fibre/i, type: "Internet" as const, priceLabel: "/mois" },
    // TV plans
    { regex: /tv\s*(\d+)\s*choix/i, type: "TV" as const, priceLabel: "/mois" },
    { regex: /tv\s*basic/i, type: "TV" as const, priceLabel: "/mois" },
  ];
  
  // Split by common delimiters
  const parts = serviceType.split(/[,+]/).map(s => s.trim()).filter(Boolean);
  
  // If only one part and it's a combo (like "GIGA + TV 10 choix"), split further
  if (parts.length === 1 && lowerType.includes("giga") && lowerType.includes("tv")) {
    // It's a GIGA + TV combo bundle
    // Extract TV choices if present
    const tvMatch = serviceType.match(/tv\s*(\d+)\s*choix/i);
    const tvChoices = tvMatch ? parseInt(tvMatch[1]) : 0;
    
    // GIGA bundles have predefined prices based on TV choices
    const bundlePrices: Record<number, { internet: number; tv: number }> = {
      0: { internet: 75, tv: 0 },      // Basic
      5: { internet: 60, tv: 20 },     // 5 choices
      10: { internet: 60, tv: 30 },    // 10 choices
      15: { internet: 60, tv: 35 },    // 15 choices
      25: { internet: 60, tv: 50 },    // 25 choices
    };
    
    const prices = bundlePrices[tvChoices] || { internet: 60, tv: 30 };
    
    services.push({
      type: "Internet",
      name: "Internet 500 Mbps (GIGA)",
      price: prices.internet,
      priceLabel: "/mois",
    });
    
    if (tvChoices > 0) {
      services.push({
        type: "TV",
        name: `TV ${tvChoices} choix`,
        price: prices.tv,
        priceLabel: "/mois",
      });
    } else if (lowerType.includes("basic")) {
      services.push({
        type: "TV",
        name: "TV Basic (26 chaînes)",
        price: 15,
        priceLabel: "/mois",
      });
    }
  } else {
    // Process each part individually
    for (const part of parts) {
      const partLower = part.toLowerCase();
      
      // Try to extract price from the part itself
      const priceMatch = part.match(/(\d+)\s*\$?\s*(?:\/|\s+)?/);
      let extractedPrice = priceMatch ? parseInt(priceMatch[1]) : 0;
      
      // Detect type
      let type: "Internet" | "TV" | "Mobile" | "Streaming" | "Security" | "Other" = "Other";
      let priceLabel = "/mois";
      
      if (partLower.includes("mobile") || partLower.includes("cell")) {
        type = "Mobile";
        priceLabel = "/30 jours";
        // Default mobile prices if not extracted
        if (!extractedPrice) extractedPrice = 60;
      } else if (partLower.includes("internet") || partLower.includes("fibre") || partLower.includes("giga")) {
        type = "Internet";
        if (!extractedPrice) extractedPrice = 60;
      } else if (partLower.includes("tv") || partLower.includes("télé")) {
        type = "TV";
        // Try to get TV choices
        const choicesMatch = part.match(/(\d+)\s*choix/i);
        if (choicesMatch) {
          const choices = parseInt(choicesMatch[1]);
          const tvPrices: Record<number, number> = { 5: 20, 10: 30, 15: 35, 25: 50 };
          extractedPrice = tvPrices[choices] || 30;
        } else if (!extractedPrice) {
          extractedPrice = 30;
        }
      } else if (partLower.includes("stream")) {
        type = "Streaming";
        if (!extractedPrice) extractedPrice = 15;
      } else if (partLower.includes("sécurité") || partLower.includes("alarm")) {
        type = "Security";
        if (!extractedPrice) extractedPrice = 30;
      }
      
      services.push({
        type,
        name: part,
        price: extractedPrice,
        priceLabel,
      });
    }
  }
  
  // If we still have no services, create a single "Other" service
  if (services.length === 0) {
    services.push({
      type: "Other",
      name: serviceType,
      price: subtotal,
      priceLabel: "/mois",
    });
  }
  
  return services;
}

/**
 * Creates line_items from order fields for orders that don't have them
 */
export function createLineItemsFromOrderFields(order: OrderForBackfill): OrderLineItem[] {
  const services: Array<{
    type: "Internet" | "TV" | "Mobile" | "Streaming" | "Security" | "Other";
    name: string;
    price: number;
    priceLabel: string;
  }> = [];
  
  const equipment: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
  }> = [];
  
  const fees: Array<{
    name: string;
    amount: number;
  }> = [];
  
  // Parse services from service_type
  if (order.service_type) {
    const parsed = parseServiceType(order.service_type, order.subtotal || 0);
    services.push(...parsed);
  }
  
  // Add equipment
  if (order.router_fee && order.router_fee > 0) {
    equipment.push({
      name: "Routeur Nivra Born WiFi",
      quantity: 1,
      unitPrice: order.router_fee,
    });
  }
  
  if (order.terminal_fee && order.terminal_fee > 0) {
    equipment.push({
      name: "Terminal Nivra 4K Smart",
      quantity: order.terminal_count || 1,
      unitPrice: (order.terminal_fee / (order.terminal_count || 1)),
    });
  }
  
  if (order.sim_fee && order.sim_fee > 0) {
    equipment.push({
      name: "Carte SIM",
      quantity: 1,
      unitPrice: order.sim_fee,
    });
  }
  
  // Add fees
  if (order.activation_fee && order.activation_fee > 0) {
    fees.push({ name: "Frais d'activation", amount: order.activation_fee });
  }
  
  if (order.delivery_fee && order.delivery_fee > 0) {
    fees.push({ name: "Frais de livraison", amount: order.delivery_fee });
  }
  
  if (order.installation_fee && order.installation_fee > 0) {
    fees.push({ name: "Installation professionnelle", amount: order.installation_fee });
  }
  
  return buildOrderLineItems({ services, equipment, fees });
}

/**
 * Checks if an order has valid line_items
 */
export function hasValidLineItems(equipmentDetails: any): boolean {
  if (!equipmentDetails || typeof equipmentDetails !== 'object') {
    return false;
  }
  
  const lineItems = equipmentDetails.line_items;
  return Array.isArray(lineItems) && lineItems.length > 0;
}

/**
 * Backfills line_items for an order and saves to database
 * Returns the created line_items
 */
export async function backfillOrderLineItems(orderId: string): Promise<OrderLineItem[] | null> {
  // Fetch the order
  const { data: order, error } = await supabase
    .from("orders")
    .select(`
      id, service_type, category, subtotal, 
      activation_fee, delivery_fee, installation_fee, 
      terminal_fee, terminal_count, router_fee,
      equipment_details
    `)
    .eq("id", orderId)
    .single();
  
  if (error || !order) {
    console.error("[Backfill] Failed to fetch order:", error);
    return null;
  }
  
  // Check if already has valid line_items
  if (hasValidLineItems(order.equipment_details)) {
    console.log("[Backfill] Order already has line_items, skipping:", orderId);
    return null;
  }
  
  // Create line_items from existing fields
  const lineItems = createLineItemsFromOrderFields(order as any);
  
  if (lineItems.length === 0) {
    console.log("[Backfill] No line_items could be created for order:", orderId);
    return null;
  }
  
  // Wrap and save
  const wrappedData = wrapLineItemsForOrder(lineItems);
  
  // Merge with existing equipment_details if any
  const existingDetails = (order.equipment_details && typeof order.equipment_details === 'object') 
    ? order.equipment_details 
    : {};
  
  const updatedDetails = {
    ...existingDetails,
    ...wrappedData,
    backfilled_at: new Date().toISOString(),
  };
  
  const { error: updateError } = await supabase
    .from("orders")
    .update({ equipment_details: updatedDetails })
    .eq("id", orderId);
  
  if (updateError) {
    console.error("[Backfill] Failed to update order:", updateError);
    return null;
  }
  
  console.log("[Backfill] Successfully backfilled order:", orderId, "with", lineItems.length, "items");
  return lineItems;
}

/**
 * Backfills all orders that don't have line_items
 * Returns count of orders backfilled
 */
export async function backfillAllOrders(): Promise<{ backfilled: number; errors: number }> {
  // Fetch all orders without line_items
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, equipment_details")
    .order("created_at", { ascending: false })
    .limit(100);
  
  if (error || !orders) {
    console.error("[Backfill] Failed to fetch orders:", error);
    return { backfilled: 0, errors: 1 };
  }
  
  let backfilled = 0;
  let errors = 0;
  
  for (const order of orders) {
    if (!hasValidLineItems(order.equipment_details)) {
      const result = await backfillOrderLineItems(order.id);
      if (result) {
        backfilled++;
      } else {
        errors++;
      }
    }
  }
  
  console.log(`[Backfill] Complete: ${backfilled} backfilled, ${errors} errors`);
  return { backfilled, errors };
}
