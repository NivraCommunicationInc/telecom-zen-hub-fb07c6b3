/**
 * Nivra External API Client
 * Source of truth for product pricing and order creation.
 */

const API_BASE = "https://telecom-zen-hub-b5f9c7c4.proud-band-c162.workers.dev";

// ── Product types ──

export interface NivraProduct {
  id: string;
  sku: string;
  name: string;
  product_type: "internet_plan" | "mobile_plan" | "bundle" | "equipment" | "fee";
  base_price: number; // dollars (string from API, parsed to number)
}

export interface NivraOrderItem {
  sku: string;
  quantity: number;
}

export interface NivraCreateOrderPayload {
  customer_name: string;
  customer_email: string;
  items: NivraOrderItem[];
}

export interface NivraOrderResponse {
  order_id: number;
  order_number: string;
  subtotal: number;
  gst: number;
  qst: number;
  total: number;
  /** Payment number returned by Nivra Core — used to notify mark-paid after PayPal capture */
  payment_number: string;
  /** Invoice number returned by Nivra Core */
  invoice_number: string;
}

// ── Category mapping (API product_type → internal category) ──

const PRODUCT_TYPE_TO_CATEGORY: Record<string, string> = {
  internet_plan: "Internet",
  mobile_plan: "Mobile",
  bundle: "TV",
  equipment: "Équipement",
  fee: "Frais",
};

export function mapProductTypeToCategory(productType: string): string {
  return PRODUCT_TYPE_TO_CATEGORY[productType] || productType;
}

// ── API calls ──

export async function fetchNivraProducts(): Promise<NivraProduct[]> {
  const response = await fetch(`${API_BASE}/products`);

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("[NivraAPI] GET /products failed:", response.status, body);
    throw new Error(`Failed to fetch products (${response.status})`);
  }

  const raw: Array<{
    id: string;
    sku: string;
    name: string;
    product_type: string;
    base_price: string;
  }> = await response.json();

  return raw.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    product_type: p.product_type as NivraProduct["product_type"],
    base_price: parseFloat(p.base_price),
  }));
}

export async function createNivraOrder(
  payload: NivraCreateOrderPayload
): Promise<NivraOrderResponse> {
  console.log("[NivraAPI] POST /create-order payload:", payload);

  const response = await fetch(`${API_BASE}/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("[NivraAPI] POST /create-order failed:", response.status, body);
    throw new Error(`Order creation failed (${response.status}): ${body}`);
  }

  const data: NivraOrderResponse = await response.json();
  console.log("[NivraAPI] Order created:", data);
  return data;
}

// ── SKU helpers ──

/** Build a SKU→Product lookup map */
export function buildSkuMap(products: NivraProduct[]): Map<string, NivraProduct> {
  const map = new Map<string, NivraProduct>();
  for (const p of products) {
    map.set(p.sku, p);
  }
  return map;
}

/** Find product by SKU */
export function findProductBySku(
  products: NivraProduct[],
  sku: string
): NivraProduct | undefined {
  return products.find((p) => p.sku === sku);
}

/** Map a product name to a SKU using fuzzy matching against loaded products */
export function findSkuByName(
  products: NivraProduct[],
  name: string
): string | null {
  const lower = name.toLowerCase().trim();

  // Direct name match
  const exact = products.find((p) => p.name.toLowerCase() === lower);
  if (exact) return exact.sku;

  // Partial match
  const partial = products.find(
    (p) =>
      lower.includes(p.name.toLowerCase()) ||
      p.name.toLowerCase().includes(lower)
  );
  if (partial) return partial.sku;

  return null;
}

// ── Equipment SKU constants (for checkout item building) ──

export const SKU = {
  // Internet plans
  INT_100: "INT-100",
  INT_500: "INT-500",
  INT_GIGA: "INT-GIGA",
  // Mobile plans
  MOB_50GB: "MOB-50GB",
  MOB_75GB: "MOB-75GB",
  // Equipment
  ROUTER: "EQ-ROUTER",
  TVBOX: "EQ-TVBOX",
  // Fees
  ACTIVATION_1: "FEE-ACT-1",
  ACTIVATION_2PLUS: "FEE-ACT-2PLUS",
  SIM: "FEE-SIM",
  ESIM: "FEE-ESIM",
  DELIVERY: "FEE-DELIVERY",
} as const;
